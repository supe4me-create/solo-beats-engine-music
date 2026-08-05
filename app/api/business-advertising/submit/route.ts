import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";

import {
  adminBucket,
  adminDb,
  firebaseAdminApp,
} from "../../../../lib/firebaseAdmin";

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const MAX_VIDEO_SIZE = 250 * 1024 * 1024;

const ALLOWED_DURATIONS = new Set(["7", "14", "30"]);
const ALLOWED_GOALS = new Set([
  "brand_awareness",
  "website_traffic",
  "video_views",
  "product_promotion",
  "event_promotion",
  "app_promotion",
  "other",
]);
const ALLOWED_PLACEMENTS = new Set([
  "homepage",
  "store",
  "radio",
  "tv",
]);

type UploadFileInfo = {
  name: string;
  type: string;
  size: number;
};

type BusinessSubmissionPayload = {
  action?: "prepare" | "finalize";
  submissionId?: string;
  businessName?: string;
  contactName?: string;
  businessEmail?: string;
  businessWebsite?: string;
  campaignName?: string;
  campaignGoal?: string;
  headline?: string;
  description?: string;
  callToAction?: string;
  targetAudience?: string;
  targetGenre?: string;
  duration?: string;
  budget?: string;
  baseBudget?: string;
  preferredStartDate?: string;
  youtubeLink?: string;
  placements?: string[];
  imageFile?: UploadFileInfo | null;
  videoFile?: UploadFileInfo | null;
  imageStoragePath?: string | null;
  videoStoragePath?: string | null;
};

function getBearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeUrl(value: string): string | null {
  if (!value) return null;

  try {
    const url = new URL(value);
    return url.protocol === "https:" ||
      url.protocol === "http:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function normalizeYouTubeLink(value: string): string | null {
  if (!value) return null;

  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    const allowed =
      host === "youtube.com" ||
      host === "www.youtube.com" ||
      host === "m.youtube.com" ||
      host === "youtu.be";

    return allowed ? url.toString() : null;
  } catch {
    return null;
  }
}

function safeFileName(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function validateOptionalFile(
  file: UploadFileInfo | null | undefined,
  kind: "image" | "video",
  maxSize: number,
  label: string
): string | null {
  if (!file) return null;

  if (
    !file.name ||
    !file.type ||
    !Number.isFinite(file.size) ||
    file.size <= 0
  ) {
    return `The ${label} is invalid.`;
  }

  if (file.size > maxSize) {
    return `The ${label} exceeds the ${Math.round(
      maxSize / 1024 / 1024
    )} MB limit.`;
  }

  if (!file.type.startsWith(`${kind}/`)) {
    return `The ${label} must be a valid ${kind} file.`;
  }

  return null;
}

export async function POST(request: Request) {
  try {
    const idToken = getBearerToken(request);

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

    const decodedToken = await getAuth(
      firebaseAdminApp
    ).verifyIdToken(idToken);

    const payload =
      (await request.json()) as BusinessSubmissionPayload;

    const action = payload.action || "prepare";
    const businessName = cleanText(payload.businessName);
    const contactName = cleanText(payload.contactName);
    const businessEmail = cleanText(
      payload.businessEmail
    ).toLowerCase();
    const businessWebsite = normalizeUrl(
      cleanText(payload.businessWebsite)
    );
    const campaignName = cleanText(payload.campaignName);
    const campaignGoal = cleanText(payload.campaignGoal);
    const headline = cleanText(payload.headline);
    const description = cleanText(payload.description);
    const callToAction = cleanText(payload.callToAction);
    const targetAudience = cleanText(payload.targetAudience);
    const targetGenre = cleanText(payload.targetGenre);
    const duration = cleanText(payload.duration);
    const budgetInput = cleanText(payload.budget);
    const preferredStartDate = cleanText(
      payload.preferredStartDate
    );
    const youtubeLinkInput = cleanText(payload.youtubeLink);
    const youtubeLink = normalizeYouTubeLink(
      youtubeLinkInput
    );

    const placements = Array.from(
      new Set(
        (
          Array.isArray(payload.placements)
            ? payload.placements
            : []
        ).filter(
          (item): item is string =>
            typeof item === "string" &&
            ALLOWED_PLACEMENTS.has(item)
        )
      )
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
          error: "Enter a valid business website link.",
        },
        { status: 400 }
      );
    }

    if (!ALLOWED_GOALS.has(campaignGoal)) {
      return NextResponse.json(
        {
          success: false,
          error: "Choose a valid campaign goal.",
        },
        { status: 400 }
      );
    }

    if (!ALLOWED_DURATIONS.has(duration)) {
      return NextResponse.json(
        {
          success: false,
          error: "Choose a valid campaign duration.",
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

    const placementPackagePrices: Record<number, number> = {
      1: 25,
      2: 45,
      3: 60,
      4: 75,
    };
    const durationMultipliers: Record<string, number> = {
      "7": 1,
      "14": 2,
      "30": 3.5,
    };
    const placementPackagePrice =
      placementPackagePrices[placements.length] || 0;
    const proposedBudget =
      placementPackagePrice *
      (durationMultipliers[duration] || 0);

    if (proposedBudget <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: "The advertising package price could not be calculated.",
        },
        { status: 400 }
      );
    }

    if (youtubeLinkInput && !youtubeLink) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Enter a valid YouTube video link from youtube.com or youtu.be.",
        },
        { status: 400 }
      );
    }

    const imageError = validateOptionalFile(
      payload.imageFile,
      "image",
      MAX_IMAGE_SIZE,
      "advertising image"
    );
    const videoError = validateOptionalFile(
      payload.videoFile,
      "video",
      MAX_VIDEO_SIZE,
      "promotional video"
    );

    if (imageError || videoError) {
      return NextResponse.json(
        {
          success: false,
          error: imageError || videoError,
        },
        { status: 400 }
      );
    }

    if (
      !payload.imageFile &&
      !payload.videoFile &&
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

    if (action === "prepare") {
      const submissionId = adminDb
        .collection("businessAdvertisingSubmissions")
        .doc().id;

      const basePath =
        `business-advertising/${decodedToken.uid}/${submissionId}`;

      let imageStoragePath: string | null = null;
      let videoStoragePath: string | null = null;
      let imageUploadUrl: string | null = null;
      let videoUploadUrl: string | null = null;

      if (payload.imageFile) {
        imageStoragePath =
          `${basePath}/image-${safeFileName(
            payload.imageFile.name
          )}`;

        [imageUploadUrl] = await adminBucket
          .file(imageStoragePath)
          .getSignedUrl({
            action: "write",
            expires: Date.now() + 15 * 60 * 1000,
            contentType: payload.imageFile.type,
          });
      }

      if (payload.videoFile) {
        videoStoragePath =
          `${basePath}/video-${safeFileName(
            payload.videoFile.name
          )}`;

        [videoUploadUrl] = await adminBucket
          .file(videoStoragePath)
          .getSignedUrl({
            action: "write",
            expires: Date.now() + 15 * 60 * 1000,
            contentType: payload.videoFile.type,
          });
      }

      return NextResponse.json({
        success: true,
        submissionId,
        imageStoragePath,
        videoStoragePath,
        imageUploadUrl,
        videoUploadUrl,
      });
    }

    if (action !== "finalize") {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid submission action.",
        },
        { status: 400 }
      );
    }

    const submissionId = cleanText(payload.submissionId);
    const imageStoragePath = payload.imageStoragePath
      ? cleanText(payload.imageStoragePath)
      : null;
    const videoStoragePath = payload.videoStoragePath
      ? cleanText(payload.videoStoragePath)
      : null;

    const expectedPrefix =
      `business-advertising/${decodedToken.uid}/${submissionId}/`;

    if (
      !submissionId ||
      (imageStoragePath &&
        !imageStoragePath.startsWith(expectedPrefix)) ||
      (videoStoragePath &&
        !videoStoragePath.startsWith(expectedPrefix))
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid upload information.",
        },
        { status: 400 }
      );
    }

    if (imageStoragePath) {
      const [exists] = await adminBucket
        .file(imageStoragePath)
        .exists();

      if (!exists) {
        return NextResponse.json(
          {
            success: false,
            error:
              "The advertising image did not finish uploading.",
          },
          { status: 400 }
        );
      }
    }

    if (videoStoragePath) {
      const [exists] = await adminBucket
        .file(videoStoragePath)
        .exists();

      if (!exists) {
        return NextResponse.json(
          {
            success: false,
            error:
              "The promotional video did not finish uploading.",
          },
          { status: 400 }
        );
      }
    }

    const submissionRef = adminDb
      .collection("businessAdvertisingSubmissions")
      .doc(submissionId);

    await submissionRef.set({
      submissionId,
      advertiserUid: decodedToken.uid,
      advertiserAccountEmail: decodedToken.email || null,
      advertiserAccountName: decodedToken.name || null,
      businessName,
      contactName,
      businessEmail,
      businessWebsite,
      campaignName,
      campaignGoal,
      headline,
      description,
      callToAction,
      targetAudience: targetAudience || null,
      targetGenre: targetGenre || null,
      requestedPlacements: placements,
      requestedDurationDays: Number(duration),
      proposedBudget: proposedBudget.toFixed(2),
      finalPrice: proposedBudget.toFixed(2),
      baseBudget: placementPackagePrice.toFixed(2),
      placementCount: placements.length,
      pricingModel: "fixed_platform_package",
      currency: "USD",
      preferredStartDate: preferredStartDate || null,
      youtubeLink,
      imageStoragePath,
      imageOriginalName:
        payload.imageFile?.name || null,
      imageContentType:
        payload.imageFile?.type || null,
      imageSize: payload.imageFile?.size || null,
      videoStoragePath,
      videoOriginalName:
        payload.videoFile?.name || null,
      videoContentType:
        payload.videoFile?.type || null,
      videoSize: payload.videoFile?.size || null,
      creativeType:
        payload.videoFile || youtubeLink
          ? payload.imageFile
            ? "image_and_video"
            : "video"
          : "image",
      reviewStatus: "pending",
      paymentStatus: "not_requested",
      placementStatus: "not_scheduled",
      sponsoredLabel: "Sponsored",
      source:
        "solo-beats-engine-music-business-advertising",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    const ownerNotificationType =
      payload.videoFile || youtubeLink
        ? "video_advertising_submission"
        : "business_advertising_submission";

    await adminDb
      .collection("ownerNotifications")
      .doc(`business-advertising-${submissionId}`)
      .set({
        type: ownerNotificationType,
        category: "business_advertising",
        title:
          ownerNotificationType ===
          "video_advertising_submission"
            ? "New video advertising submission"
            : "New business advertising submission",
        message: `${businessName} submitted the "${campaignName}" campaign for review.`,
        targetUrl:
          `/developer/business-advertising?submissionId=${encodeURIComponent(
            submissionId
          )}`,
        relatedId: submissionId,
        submissionId,
        businessName,
        campaignName,
        creativeType:
          payload.videoFile || youtubeLink
            ? "video"
            : "image",
        read: false,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

    return NextResponse.json({
      success: true,
      submissionId,
      reviewStatus: "pending",
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
