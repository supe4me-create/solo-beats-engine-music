import { NextResponse } from "next/server";

import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";

import {
  adminDb,
  firebaseAdminApp,
} from "../../../../lib/firebaseAdmin";

export const dynamic = "force-dynamic";

function clean(value: unknown, max = 4000) {
  return typeof value === "string"
    ? value.trim().slice(0, max)
    : "";
}

function bearer(request: Request) {
  return (
    request.headers
      .get("authorization")
      ?.match(/^Bearer\s+(.+)$/i)?.[1]
      ?.trim() ||
    ""
  );
}

async function verifyUser(request: Request) {
  const token = bearer(request);

  if (!token) {
    return null;
  }

  try {
    return await getAuth(
      firebaseAdminApp
    ).verifyIdToken(token);
  }
  catch {
    return null;
  }
}

function toIso(value: unknown) {
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (
      value as {
        toDate?: unknown;
      }
    ).toDate === "function"
  ) {
    return (
      value as {
        toDate: () => Date;
      }
    )
      .toDate()
      .toISOString();
  }

  return null;
}

export async function GET(request: Request) {
  try {
    const user =
      await verifyUser(request);

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: "Sign in required.",
        },
        {
          status: 401,
        }
      );
    }

    const snapshot =
      await adminDb
        .collection("soloConnectBlocks")
        .where(
          "blockerUid",
          "==",
          user.uid
        )
        .limit(500)
        .get();

    const blocks =
      snapshot.docs.map(document => {
        const data =
          document.data() || {};

        return {
          id: document.id,

          blockedUid:
            clean(
              data.blockedUid,
              128
            ),

          username:
            clean(
              data.username,
              24
            ),

          displayName:
            clean(
              data.displayName,
              100
            ),

          createdAt:
            toIso(
              data.createdAt
            ),
        };
      });

    return NextResponse.json({
      success: true,
      blocks,
    });
  }
  catch (error) {
    console.error(
      "CONNECT MODERATION GET:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Moderation settings could not be loaded.",
      },
      {
        status: 500,
      }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user =
      await verifyUser(request);

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: "Sign in required.",
        },
        {
          status: 401,
        }
      );
    }

    const body =
      await request.json();

    const action =
      clean(
        body?.action,
        40
      );

    if (
      action === "block" ||
      action === "unblock"
    ) {
      const targetUid =
        clean(
          body?.targetUid,
          128
        );

      if (
        !targetUid ||
        targetUid === user.uid
      ) {
        return NextResponse.json(
          {
            success: false,
            error: "Invalid member.",
          },
          {
            status: 400,
          }
        );
      }

      const blockRef =
        adminDb
          .collection(
            "soloConnectBlocks"
          )
          .doc(
            `${user.uid}_${targetUid}`
          );

      if (
        action === "unblock"
      ) {
        await blockRef.delete();

        return NextResponse.json({
          success: true,
          blocked: false,
        });
      }

      const profileSnapshot =
        await adminDb
          .collection(
            "soloConnectProfiles"
          )
          .doc(targetUid)
          .get();

      if (
        !profileSnapshot.exists
      ) {
        return NextResponse.json(
          {
            success: false,
            error: "Member not found.",
          },
          {
            status: 404,
          }
        );
      }

      const profile =
        profileSnapshot.data() || {};

      await blockRef.set({
        blockerUid:
          user.uid,

        blockedUid:
          targetUid,

        username:
          clean(
            profile.username,
            24
          ),

        displayName:
          clean(
            profile.displayName,
            100
          ),

        createdAt:
          FieldValue.serverTimestamp(),

        updatedAt:
          FieldValue.serverTimestamp(),
      });

      return NextResponse.json({
        success: true,
        blocked: true,
      });
    }

    if (
      action !== "report"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid moderation action.",
        },
        {
          status: 400,
        }
      );
    }

    const reportType =
      clean(
        body?.reportType,
        30
      );

    const postId =
      clean(
        body?.postId,
        128
      );

    const targetUid =
      clean(
        body?.targetUid,
        128
      );

    const username =
      clean(
        body?.username,
        24
      );

    const reason =
      clean(
        body?.reason,
        100
      );

    const details =
      clean(
        body?.details,
        3000
      );

    if (
      ![
        "post",
        "profile",
        "copyright",
      ].includes(
        reportType
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid report type.",
        },
        {
          status: 400,
        }
      );
    }

    if (!reason) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Choose a report reason.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      reportType === "post" &&
      !postId
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Post ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    const reportRef =
      adminDb
        .collection(
          "soloConnectReports"
        )
        .doc();

    await reportRef.set({
      reporterUid:
        user.uid,

      reporterEmail:
        clean(
          user.email,
          320
        ),

      reportType,

      postId,

      targetUid,

      username,

      reason,

      details,

      status:
        "open",

      ownerNote:
        "",

      createdAt:
        FieldValue.serverTimestamp(),

      updatedAt:
        FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      success: true,
      reportId:
        reportRef.id,
    });
  }
  catch (error) {
    console.error(
      "CONNECT MODERATION POST:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Moderation request could not be completed.",
      },
      {
        status: 500,
      }
    );
  }
}