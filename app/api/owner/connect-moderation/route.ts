import { NextResponse } from "next/server";

import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";

import {
  adminBucket,
  adminDb,
  firebaseAdminApp,
} from "../../../../lib/firebaseAdmin";

export const dynamic = "force-dynamic";

const OWNER_EMAIL = (
  process.env.OWNER_EMAIL ||
  process.env.NEXT_PUBLIC_OWNER_EMAIL ||
  "supe4.me@gmail.com"
)
  .trim()
  .toLowerCase();

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

async function verifyOwner(request: Request) {
  const token = bearer(request);

  if (!token) {
    throw new Error(
      "OWNER_AUTH_REQUIRED"
    );
  }

  const user =
    await getAuth(
      firebaseAdminApp
    ).verifyIdToken(token);

  const email =
    (
      user.email ||
      ""
    )
      .trim()
      .toLowerCase();

  if (
    email !== OWNER_EMAIL
  ) {
    throw new Error(
      "OWNER_ONLY"
    );
  }

  return user;
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

async function removePost(postId: string) {
  const postRef =
    adminDb
      .collection(
        "soloConnectPosts"
      )
      .doc(postId);

  const postSnapshot =
    await postRef.get();

  if (
    !postSnapshot.exists
  ) {
    throw new Error(
      "POST_NOT_FOUND"
    );
  }

  const post =
    postSnapshot.data() || {};

  const authorUid =
    clean(
      post.authorUid,
      128
    );

  const mediaPath =
    clean(
      post.mediaPath,
      1000
    );

  const comments =
    await adminDb
      .collection(
        "soloConnectComments"
      )
      .where(
        "postId",
        "==",
        postId
      )
      .get();

  const likes =
    await adminDb
      .collection(
        "soloConnectLikes"
      )
      .where(
        "postId",
        "==",
        postId
      )
      .get();

  const batch =
    adminDb.batch();

  comments.docs.forEach(
    document =>
      batch.delete(
        document.ref
      )
  );

  likes.docs.forEach(
    document =>
      batch.delete(
        document.ref
      )
  );

  batch.delete(
    postRef
  );

  if (authorUid) {
    const profileRef =
      adminDb
        .collection(
          "soloConnectProfiles"
        )
        .doc(
          authorUid
        );

    const profileSnapshot =
      await profileRef.get();

    if (
      profileSnapshot.exists
    ) {
      const count =
        Math.max(
          0,
          Number(
            profileSnapshot
              .data()
              ?.postCount ||
              0
          )
        );

      batch.update(
        profileRef,
        {
          postCount:
            Math.max(
              0,
              count - 1
            ),

          updatedAt:
            FieldValue.serverTimestamp(),
        }
      );
    }
  }

  await batch.commit();

  if (
    mediaPath.startsWith(
      "solo-connect/"
    )
  ) {
    try {
      await adminBucket
        .file(mediaPath)
        .delete({
          ignoreNotFound:
            true,
        });
    }
    catch (error) {
      console.error(
        "MODERATION MEDIA DELETE:",
        error
      );
    }
  }
}

export async function GET(request: Request) {
  try {
    await verifyOwner(request);

    const snapshot =
      await adminDb
        .collection(
          "soloConnectReports"
        )
        .limit(500)
        .get();

    const reports =
      snapshot.docs
        .map(document => {
          const data =
            document.data() || {};

          return {
            id:
              document.id,

            reporterUid:
              clean(
                data.reporterUid,
                128
              ),

            reporterEmail:
              clean(
                data.reporterEmail,
                320
              ),

            reportType:
              clean(
                data.reportType,
                30
              ),

            postId:
              clean(
                data.postId,
                128
              ),

            targetUid:
              clean(
                data.targetUid,
                128
              ),

            username:
              clean(
                data.username,
                24
              ),

            reason:
              clean(
                data.reason,
                100
              ),

            details:
              clean(
                data.details,
                3000
              ),

            status:
              clean(
                data.status,
                30
              ) ||
              "open",

            ownerNote:
              clean(
                data.ownerNote,
                1000
              ),

            createdAt:
              toIso(
                data.createdAt
              ),

            updatedAt:
              toIso(
                data.updatedAt
              ),
          };
        })
        .sort(
          (a, b) =>
            String(
              b.createdAt ||
                ""
            ).localeCompare(
              String(
                a.createdAt ||
                  ""
              )
            )
        );

    return NextResponse.json({
      success: true,
      reports,
      openCount:
        reports.filter(
          report =>
            report.status ===
            "open"
        ).length,
    });
  }
  catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "";

    if (
      message ===
        "OWNER_AUTH_REQUIRED" ||
      message ===
        "OWNER_ONLY"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Owner access only.",
        },
        {
          status:
            message ===
            "OWNER_AUTH_REQUIRED"
              ? 401
              : 403,
        }
      );
    }

    console.error(
      "OWNER CONNECT MODERATION GET:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Moderation reports could not be loaded.",
      },
      {
        status: 500,
      }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const owner =
      await verifyOwner(request);

    const body =
      await request.json();

    const reportId =
      clean(
        body?.reportId,
        128
      );

    const action =
      clean(
        body?.action,
        40
      );

    const ownerNote =
      clean(
        body?.ownerNote,
        1000
      );

    if (!reportId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Report ID is required.",
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
        .doc(reportId);

    const reportSnapshot =
      await reportRef.get();

    if (
      !reportSnapshot.exists
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Report not found.",
        },
        {
          status: 404,
        }
      );
    }

    const report =
      reportSnapshot.data() || {};

    if (
      action ===
      "remove-post"
    ) {
      const postId =
        clean(
          report.postId,
          128
        );

      if (!postId) {
        return NextResponse.json(
          {
            success: false,
            error:
              "This report does not contain a post.",
          },
          {
            status: 400,
          }
        );
      }

      await removePost(
        postId
      );

      await reportRef.set(
        {
          status:
            "resolved",

          resolution:
            "post_removed",

          ownerNote,

          reviewedBy:
            owner.uid,

          resolvedAt:
            FieldValue.serverTimestamp(),

          updatedAt:
            FieldValue.serverTimestamp(),
        },
        {
          merge: true,
        }
      );

      return NextResponse.json({
        success: true,
      });
    }

    if (
      action !== "resolve" &&
      action !== "dismiss" &&
      action !== "reopen"
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

    const status =
      action === "resolve"
        ? "resolved"
        : action === "dismiss"
          ? "dismissed"
          : "open";

    await reportRef.set(
      {
        status,

        ownerNote,

        reviewedBy:
          owner.uid,

        reviewedAt:
          FieldValue.serverTimestamp(),

        updatedAt:
          FieldValue.serverTimestamp(),
      },
      {
        merge: true,
      }
    );

    return NextResponse.json({
      success: true,
      status,
    });
  }
  catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "";

    if (
      message ===
        "OWNER_AUTH_REQUIRED" ||
      message ===
        "OWNER_ONLY"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Owner access only.",
        },
        {
          status:
            message ===
            "OWNER_AUTH_REQUIRED"
              ? 401
              : 403,
        }
      );
    }

    if (
      message ===
      "POST_NOT_FOUND"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Reported post was already removed.",
        },
        {
          status: 404,
        }
      );
    }

    console.error(
      "OWNER CONNECT MODERATION PATCH:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Moderation action failed.",
      },
      {
        status: 500,
      }
    );
  }
}