import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";

import {
  adminBucket,
  adminDb,
  firebaseAdminApp,
} from "../../../../lib/firebaseAdmin";

const OWNER_EMAIL =
  "supe4.me@gmail.com";

function getBearerToken(
  request: Request
): string | null {
  const authorization =
    request.headers.get("authorization");

  if (!authorization) {
    return null;
  }

  const match =
    authorization.match(
      /^Bearer\s+(.+)$/i
    );

  return match?.[1]?.trim() || null;
}

async function verifyOwner(
  request: Request
) {
  const idToken =
    getBearerToken(request);

  if (!idToken) {
    throw new Error(
      "OWNER_AUTH_REQUIRED"
    );
  }

  const decodedToken =
    await getAuth(
      firebaseAdminApp
    ).verifyIdToken(idToken);

  if (
    decodedToken.email?.toLowerCase() !==
    OWNER_EMAIL
  ) {
    throw new Error(
      "OWNER_ACCESS_ONLY"
    );
  }

  return decodedToken;
}

function timestampToIso(
  value: unknown
): string | null {
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

  if (
    typeof value === "string"
  ) {
    return value;
  }

  return null;
}

async function signedPreviewUrl(
  storagePath: unknown
): Promise<string | null> {
  if (
    typeof storagePath !== "string" ||
    !storagePath
  ) {
    return null;
  }

  try {
    const file =
      adminBucket.file(
        storagePath
      );

    const [exists] =
      await file.exists();

    if (!exists) {
      return null;
    }

    const [url] =
      await file.getSignedUrl({
        action: "read",
        expires:
          Date.now() +
          60 * 60 * 1000,
      });

    return url;
  } catch (error) {
    console.error(
      "Artist promotion preview URL error:",
      error
    );

    return null;
  }
}

export async function GET(
  request: Request
) {
  try {
    await verifyOwner(request);

    const snapshot =
      await adminDb
        .collection(
          "artistPromotionSubmissions"
        )
        .orderBy(
          "createdAt",
          "desc"
        )
        .get();

    const submissions =
      await Promise.all(
        snapshot.docs.map(
          async (document) => {
            const data =
              document.data();

            const [
              songUrl,
              artworkUrl,
            ] =
              await Promise.all([
                signedPreviewUrl(
                  data.songStoragePath
                ),
                signedPreviewUrl(
                  data.artworkStoragePath
                ),
              ]);

            return {
              submissionId:
                document.id,
              artistUid:
                data.artistUid ||
                "",
              artistAccountEmail:
                data.artistAccountEmail ||
                null,
              artistAccountName:
                data.artistAccountName ||
                null,
              artistName:
                data.artistName ||
                "Unknown Artist",
              songTitle:
                data.songTitle ||
                "Untitled Song",
              genre:
                data.genre ||
                "Unknown",
              description:
                data.description ||
                "",
              socialLink:
                data.socialLink ||
                null,
              youtubeLink:
                data.youtubeLink ||
                null,
              promotionDurationDays:
                Number(
                  data.promotionDurationDays ||
                    0
                ),
              reviewStatus:
                data.reviewStatus ||
                "pending",
              paymentStatus:
                data.paymentStatus ||
                "not_requested",
              placementStatus:
                data.placementStatus ||
                "not_scheduled",
              sponsoredLabel:
                data.sponsoredLabel ||
                "Promoted",
              createdAt:
                timestampToIso(
                  data.createdAt
                ),
              reviewedAt:
                timestampToIso(
                  data.reviewedAt
                ),
              rejectionReason:
                data.rejectionReason ||
                null,
              scheduleStartDate:
                data.scheduleStartDate ||
                null,
              scheduleEndDate:
                data.scheduleEndDate ||
                null,
              placementLocation:
                data.placementLocation ||
                null,
              songUrl,
              artworkUrl,
              songOriginalName:
                data.songOriginalName ||
                null,
              artworkOriginalName:
                data.artworkOriginalName ||
                null,
            };
          }
        )
      );

    return NextResponse.json({
      success: true,
      submissions,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "";

    if (
      message ===
      "OWNER_AUTH_REQUIRED"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Owner sign-in is required.",
        },
        { status: 401 }
      );
    }

    if (
      message ===
      "OWNER_ACCESS_ONLY"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Owner access only.",
        },
        { status: 403 }
      );
    }

    console.error(
      "Artist promotion owner list error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Artist promotion submissions could not be loaded.",
      },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request
) {
  try {
    const owner =
      await verifyOwner(request);

    const body =
      await request.json();

    const submissionId =
      typeof body.submissionId ===
        "string"
        ? body.submissionId.trim()
        : "";

    const action =
      body.action === "approve" ||
      body.action === "reject" ||
      body.action === "schedule"
        ? body.action
        : "";

    const rejectionReason =
      typeof body.rejectionReason ===
        "string"
        ? body.rejectionReason.trim()
        : "";

    if (
      !submissionId ||
      !action
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "A valid submission and review action are required.",
        },
        { status: 400 }
      );
    }

    if (
      action === "reject" &&
      !rejectionReason
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "A rejection reason is required.",
        },
        { status: 400 }
      );
    }

    const submissionRef =
      adminDb
        .collection(
          "artistPromotionSubmissions"
        )
        .doc(submissionId);

    const snapshot =
      await submissionRef.get();

    if (!snapshot.exists) {
      return NextResponse.json(
        {
          success: false,
          error:
            "The promotion submission was not found.",
        },
        { status: 404 }
      );
    }

    if (action === "schedule") {
      const submission =
        snapshot.data() || {};

      if (
        submission.reviewStatus !==
          "approved" ||
        submission.paymentStatus !==
          "paid"
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Only approved and paid promotions can be scheduled.",
          },
          { status: 400 }
        );
      }

      const startDate =
        typeof body.startDate ===
          "string"
          ? body.startDate.trim()
          : "";
      const endDate =
        typeof body.endDate ===
          "string"
          ? body.endDate.trim()
          : "";
      const placementLocation =
        typeof body.placementLocation ===
          "string"
          ? body.placementLocation.trim()
          : "";

      const allowedPlacements =
        new Set([
          "homepage",
          "store",
          "radio",
          "tv",
        ]);

      const start =
        new Date(
          `${startDate}T00:00:00.000Z`
        );
      const end =
        new Date(
          `${endDate}T23:59:59.999Z`
        );

      if (
        !startDate ||
        !endDate ||
        Number.isNaN(
          start.getTime()
        ) ||
        Number.isNaN(
          end.getTime()
        ) ||
        end <= start
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Choose a valid start date and end date.",
          },
          { status: 400 }
        );
      }

      if (
        !allowedPlacements.has(
          placementLocation
        )
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Choose a valid promotion placement.",
          },
          { status: 400 }
        );
      }

      const purchasedDays =
        Number(
          submission.promotionDurationDays ||
            0
        );

      const scheduledDays =
        Math.ceil(
          (end.getTime() -
            start.getTime()) /
            (24 * 60 * 60 * 1000)
        );

      if (
        scheduledDays >
        purchasedDays
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              `This campaign purchased ${purchasedDays} days. The selected schedule is ${scheduledDays} days.`,
          },
          { status: 400 }
        );
      }

      await submissionRef.set(
        {
          placementStatus:
            "scheduled",
          scheduleStartDate:
            startDate,
          scheduleEndDate:
            endDate,
          placementLocation,
          scheduledByUid:
            owner.uid,
          scheduledByEmail:
            owner.email || null,
          scheduledAt:
            FieldValue.serverTimestamp(),
          updatedAt:
            FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      return NextResponse.json({
        success: true,
        submissionId,
        placementStatus:
          "scheduled",
        scheduleStartDate:
          startDate,
        scheduleEndDate:
          endDate,
        placementLocation,
      });
    }

    const update =
      action === "approve"
        ? {
            reviewStatus:
              "approved",
            paymentStatus:
              "awaiting_payment",
            placementStatus:
              "not_scheduled",
            rejectionReason:
              null,
            reviewedByUid:
              owner.uid,
            reviewedByEmail:
              owner.email || null,
            reviewedAt:
              FieldValue.serverTimestamp(),
            updatedAt:
              FieldValue.serverTimestamp(),
          }
        : {
            reviewStatus:
              "rejected",
            paymentStatus:
              "not_requested",
            placementStatus:
              "not_scheduled",
            rejectionReason,
            reviewedByUid:
              owner.uid,
            reviewedByEmail:
              owner.email || null,
            reviewedAt:
              FieldValue.serverTimestamp(),
            updatedAt:
              FieldValue.serverTimestamp(),
          };

    await submissionRef.set(
      update,
      { merge: true }
    );

    return NextResponse.json({
      success: true,
      submissionId,
      reviewStatus:
        action === "approve"
          ? "approved"
          : "rejected",
      paymentStatus:
        action === "approve"
          ? "awaiting_payment"
          : "not_requested",
      placementStatus:
        "not_scheduled",
      rejectionReason:
        action === "reject"
          ? rejectionReason
          : null,
      reviewedAt:
        new Date().toISOString(),
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "";

    if (
      message ===
      "OWNER_AUTH_REQUIRED"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Owner sign-in is required.",
        },
        { status: 401 }
      );
    }

    if (
      message ===
      "OWNER_ACCESS_ONLY"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Owner access only.",
        },
        { status: 403 }
      );
    }

    console.error(
      "Artist promotion owner review error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "The promotion submission could not be reviewed.",
      },
      { status: 500 }
    );
  }
}
