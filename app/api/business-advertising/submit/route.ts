import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";

import {
  adminBucket,
  adminDb,
  firebaseAdminApp,
} from "../../../../lib/firebaseAdmin";

const MAX_IMAGE_SIZE =
  10 * 1024 * 1024;
const MAX_VIDEO_SIZE =
  250 * 1024 * 1024;

const ALLOWED_DURATIONS =
  new Set(["7", "14", "30"]);

const ALLOWED_GOALS =
  new Set([
    "brand_awareness",
    "website_traffic",
    "video_views",
    "product_promotion",
    "event_promotion",
    "app_promotion",
    "other",
  ]);

const ALLOWED_PLACEMENTS =
  new Set([
    "homepage",
    "store",
    "radio",
    "tv",
  ]);

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

function cleanText(
  value: FormDataEntryValue | null
): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function normalizeUrl(
  value: string
): string | null {
  if (!value) return null;

  try {
    const url = new URL(value);

    if (
      url.protocol !== "https:" &&
      url.protocol !== "http:"
    ) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

function normalizeYouTubeLink(
  value: string
): string | null {
  if (!value) return null;

  try {
    const url = new URL(value);
    const host =
      url.hostname.toLowerCase();

    const allowed =
      host === "youtube.com" ||
      host === "www.youtube.com" ||
      host === "m.youtube.com" ||
      host === "youtu.be";

    if (!allowed) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

function safeFileName(
  value: string
): string {
  return value
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function parsePlacements(
  value: string
): string[] {
  try {
    const parsed =
      JSON.parse(value);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return Array.from(
      new Set(
        parsed.filter(
          (item): item is string =>
            typeof item === "string" &&
            ALLOWED_PLACEMENTS.has(
              item
            )
        )
      )
    );
  } catch {
    return [];
  }
}

export async function POST(
  request: Request
) {
  try {
    const idToken =
      getBearerToken(request);

    if (!idToken) {
      return NextResponse.json(
        {
          success: false,
          error:
            "You must be signed in before submitting a business advertising campaign.",
        },
        { status: 401 }
      );
    }

    const decodedToken =
      await getAuth(
        firebaseAdminApp
      ).verifyIdToken(idToken);

    const formData =
      await request.formData();

    const businessName =
      cleanText(
        formData.get(
          "businessName"
        )
      );
    const contactName =
      cleanText(
        formData.get(
          "contactName"
        )
      );
    const businessEmail =
      cleanText(
        formData.get(
          "businessEmail"
        )
      ).toLowerCase();
    const businessWebsiteInput =
      cleanText(
        formData.get(
          "businessWebsite"
        )
      );
    const businessWebsite =
      normalizeUrl(
        businessWebsiteInput
      );
    const campaignName =
      cleanText(
        formData.get(
          "campaignName"
        )
      );
    const campaignGoal =
      cleanText(
        formData.get(
          "campaignGoal"
        )
      );
    const headline =
      cleanText(
        formData.get(
          "headline"
        )
      );
    const description =
      cleanText(
        formData.get(
          "description"
        )
      );
    const callToAction =
      cleanText(
        formData.get(
          "callToAction"
        )
      );
    const targetAudience =
      cleanText(
        formData.get(
          "targetAudience"
        )
      );
    const targetGenre =
      cleanText(
        formData.get(
          "targetGenre"
        )
      );
    const duration =
      cleanText(
        formData.get(
          "duration"
        )
      );
    const budgetInput =
      cleanText(
        formData.get(
          "budget"
        )
      );
    const preferredStartDate =
      cleanText(
        formData.get(
          "preferredStartDate"
        )
      );
    const youtubeLinkInput =
      cleanText(
        formData.get(
          "youtubeLink"
        )
      );
    const youtubeLink =
      normalizeYouTubeLink(
        youtubeLinkInput
      );
    const placements =
      parsePlacements(
        cleanText(
          formData.get(
            "placements"
          )
        )
      );

    const imageFile =
      formData.get(
        "imageFile"
      );
    const videoFile =
      formData.get(
        "videoFile"
      );

    if (
      !businessName ||
      !contactName ||
      !businessEmail ||
      !campaignName ||
      !headline ||
      !description ||
      !callToAction
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Business name, contact name, email, campaign name, headline, description, and call-to-action are required.",
        },
        { status: 400 }
      );
    }

    if (!businessWebsite) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Enter a valid business website link.",
        },
        { status: 400 }
      );
    }

    if (
      !ALLOWED_GOALS.has(
        campaignGoal
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Choose a valid campaign goal.",
        },
        { status: 400 }
      );
    }

    if (
      !ALLOWED_DURATIONS.has(
        duration
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Choose a valid campaign duration.",
        },
        { status: 400 }
      );
    }

    if (placements.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Choose at least one advertising placement.",
        },
        { status: 400 }
      );
    }

    const proposedBudget =
      Number(budgetInput);

    if (
      !Number.isFinite(
        proposedBudget
      ) ||
      proposedBudget <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Enter a valid proposed budget.",
        },
        { status: 400 }
      );
    }

    if (
      youtubeLinkInput &&
      !youtubeLink
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Enter a valid YouTube video link from youtube.com or youtu.be.",
        },
        { status: 400 }
      );
    }

    const hasImage =
      imageFile instanceof File &&
      imageFile.size > 0;
    const hasVideo =
      videoFile instanceof File &&
      videoFile.size > 0;

    if (
      !hasImage &&
      !hasVideo &&
      !youtubeLink
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Add an advertising image, video file, or YouTube video link.",
        },
        { status: 400 }
      );
    }

    if (
      hasImage &&
      imageFile.size >
        MAX_IMAGE_SIZE
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "The advertising image exceeds the 10 MB limit.",
        },
        { status: 400 }
      );
    }

    if (
      hasVideo &&
      videoFile.size >
        MAX_VIDEO_SIZE
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "The promotional video exceeds the 250 MB limit.",
        },
        { status: 400 }
      );
    }

    if (
      hasImage &&
      !imageFile.type.startsWith(
        "image/"
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "The advertising image must be a valid image file.",
        },
        { status: 400 }
      );
    }

    if (
      hasVideo &&
      !videoFile.type.startsWith(
        "video/"
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "The promotional video must be a valid video file.",
        },
        { status: 400 }
      );
    }

    const submissionRef =
      adminDb
        .collection(
          "businessAdvertisingSubmissions"
        )
        .doc();

    const submissionId =
      submissionRef.id;

    const basePath =
      `business-advertising/${decodedToken.uid}/${submissionId}`;

    let imageStoragePath:
      | string
      | null = null;
    let videoStoragePath:
      | string
      | null = null;

    const uploads: Promise<unknown>[] =
      [];

    if (hasImage) {
      const imageName =
        safeFileName(
          imageFile.name ||
            "advertising-image"
        );

      imageStoragePath =
        `${basePath}/image-${imageName}`;

      const imageBuffer =
        Buffer.from(
          await imageFile.arrayBuffer()
        );

      uploads.push(
        adminBucket
          .file(
            imageStoragePath
          )
          .save(imageBuffer, {
            metadata: {
              contentType:
                imageFile.type,
            },
            resumable: false,
          })
      );
    }

    if (hasVideo) {
      const videoName =
        safeFileName(
          videoFile.name ||
            "promotional-video"
        );

      videoStoragePath =
        `${basePath}/video-${videoName}`;

      const videoBuffer =
        Buffer.from(
          await videoFile.arrayBuffer()
        );

      uploads.push(
        adminBucket
          .file(
            videoStoragePath
          )
          .save(videoBuffer, {
            metadata: {
              contentType:
                videoFile.type,
            },
            resumable: false,
          })
      );
    }

    await Promise.all(uploads);

    await submissionRef.set({
      submissionId,
      advertiserUid:
        decodedToken.uid,
      advertiserAccountEmail:
        decodedToken.email ||
        null,
      advertiserAccountName:
        decodedToken.name ||
        null,
      businessName,
      contactName,
      businessEmail,
      businessWebsite,
      campaignName,
      campaignGoal,
      headline,
      description,
      callToAction,
      targetAudience:
        targetAudience || null,
      targetGenre:
        targetGenre || null,
      requestedPlacements:
        placements,
      requestedDurationDays:
        Number(duration),
      proposedBudget:
        proposedBudget.toFixed(
          2
        ),
      currency: "USD",
      preferredStartDate:
        preferredStartDate ||
        null,
      youtubeLink,
      imageStoragePath,
      imageOriginalName:
        hasImage
          ? imageFile.name
          : null,
      imageContentType:
        hasImage
          ? imageFile.type
          : null,
      imageSize:
        hasImage
          ? imageFile.size
          : null,
      videoStoragePath,
      videoOriginalName:
        hasVideo
          ? videoFile.name
          : null,
      videoContentType:
        hasVideo
          ? videoFile.type
          : null,
      videoSize:
        hasVideo
          ? videoFile.size
          : null,
      creativeType:
        hasVideo ||
        youtubeLink
          ? hasImage
            ? "image_and_video"
            : "video"
          : "image",
      reviewStatus:
        "pending",
      paymentStatus:
        "not_requested",
      placementStatus:
        "not_scheduled",
      sponsoredLabel:
        "Sponsored",
      source:
        "solo-beats-engine-music-business-advertising",
      createdAt:
        FieldValue.serverTimestamp(),
      updatedAt:
        FieldValue.serverTimestamp(),
    });

    const ownerNotificationType =
      hasVideo || youtubeLink
        ? "video_advertising_submission"
        : "business_advertising_submission";

    await adminDb
      .collection("ownerNotifications")
      .doc(`business-advertising-${submissionId}`)
      .set({
        type: ownerNotificationType,
        category: "business_advertising",
        title:
          ownerNotificationType === "video_advertising_submission"
            ? "New video advertising submission"
            : "New business advertising submission",
        message: `${businessName} submitted the "${campaignName}" campaign for review.`,
        targetUrl: `/developer/business-advertising?submissionId=${encodeURIComponent(submissionId)}`,
        relatedId: submissionId,
        submissionId,
        businessName,
        campaignName,
        creativeType:
          hasVideo || youtubeLink ? "video" : "image",
        read: false,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    return NextResponse.json({
      success: true,
      submissionId,
      reviewStatus:
        "pending",
      message:
        "Your business advertising campaign was received and is waiting for owner review.",
    });
  } catch (error) {
    console.error(
      "Business advertising submission error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "The business advertising submission could not be completed.",
      },
      { status: 500 }
    );
  }
}

