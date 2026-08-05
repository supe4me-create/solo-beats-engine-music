import { NextResponse } from "next/server";

import {
  adminBucket,
  adminDb,
} from "../../../../lib/firebaseAdmin";

const ALLOWED = new Set([
  "homepage",
  "store",
  "radio",
  "tv",
]);

function isActive(
  startDate: unknown,
  endDate: unknown
) {
  if (
    typeof startDate !== "string" ||
    typeof endDate !== "string"
  ) {
    return false;
  }

  const now = new Date();
  const start = new Date(
    `${startDate}T00:00:00.000Z`
  );
  const end = new Date(
    `${endDate}T23:59:59.999Z`
  );

  return (
    !Number.isNaN(start.getTime()) &&
    !Number.isNaN(end.getTime()) &&
    now >= start &&
    now <= end
  );
}

async function signedUrl(
  storagePath: unknown
) {
  if (
    typeof storagePath !== "string" ||
    !storagePath
  ) {
    return null;
  }

  try {
    const file =
      adminBucket.file(storagePath);

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
      "Business advertising signed URL error:",
      error
    );

    return null;
  }
}

export async function GET(
  request: Request
) {
  try {
    const placement =
      (
        new URL(request.url)
          .searchParams.get(
            "placement"
          ) || "homepage"
      ).toLowerCase();

    if (!ALLOWED.has(placement)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid business advertising placement.",
        },
        { status: 400 }
      );
    }

    const snapshot =
      await adminDb
        .collection(
          "businessAdvertisingSubmissions"
        )
        .where(
          "placementStatus",
          "==",
          "scheduled"
        )
        .get();

    const activeDocs =
      snapshot.docs.filter(
        (document) => {
          const data =
            document.data();

          return (
            data.reviewStatus ===
              "approved" &&
            data.paymentStatus ===
              "paid" &&
            (
              (Array.isArray(
                data.placementLocations
              ) &&
                data.placementLocations.includes(
                  placement
                )) ||
              data.placementLocation ===
                placement
            ) &&
            isActive(
              data.scheduleStartDate,
              data.scheduleEndDate
            )
          );
        }
      );

    const campaigns =
      await Promise.all(
        activeDocs.map(
          async (document) => {
            const data =
              document.data();

            const [
              imageUrl,
              videoUrl,
            ] =
              await Promise.all([
                signedUrl(
                  data.imageStoragePath
                ),
                signedUrl(
                  data.videoStoragePath
                ),
              ]);

            return {
              submissionId:
                document.id,
              businessName:
                data.businessName ||
                "Sponsored Business",
              campaignName:
                data.campaignName ||
                "Sponsored Campaign",
              campaignGoal:
                data.campaignGoal ||
                "brand_awareness",
              headline:
                data.headline ||
                data.campaignName ||
                "Sponsored Message",
              description:
                data.description ||
                "",
              callToAction:
                data.callToAction ||
                "Learn More",
              businessWebsite:
                data.businessWebsite ||
                null,
              youtubeLink:
                data.youtubeLink ||
                null,
              imageUrl,
              videoUrl,
              sponsoredLabel:
                data.sponsoredLabel ||
                "Sponsored",
              scheduleStartDate:
                data.scheduleStartDate ||
                null,
              scheduleEndDate:
                data.scheduleEndDate ||
                null,
              placementLocation:
                placement,
              placementLocations:
                Array.isArray(
                  data.placementLocations
                )
                  ? data.placementLocations
                  : data.placementLocation
                    ? [data.placementLocation]
                    : [placement],
            };
          }
        )
      );

    return NextResponse.json({
      success: true,
      placement,
      campaigns,
    });
  } catch (error) {
    console.error(
      "Public business advertising error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Sponsored business campaigns could not be loaded.",
      },
      { status: 500 }
    );
  }
}
