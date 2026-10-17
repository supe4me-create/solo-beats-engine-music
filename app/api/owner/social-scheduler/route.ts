import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";

import {
  adminDb,
  firebaseAdminApp,
} from "../../../../lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OWNER_EMAIL = (
  process.env.OWNER_EMAIL ||
  process.env.NEXT_PUBLIC_OWNER_EMAIL ||
  "supe4.me@gmail.com"
)
  .trim()
  .toLowerCase();

type Platform =
  | "facebook"
  | "instagram"
  | "youtube"
  | "tiktok";

type Status =
  | "draft"
  | "scheduled"
  | "publishing"
  | "published"
  | "failed"
  | "cancelled";

function bearer(request: Request) {
  const value =
    request.headers.get("authorization") || "";

  return (
    value.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() ||
    null
  );
}

async function verifyOwner(request: Request) {
  const token = bearer(request);

  if (!token) {
    throw new Error("OWNER_AUTH_REQUIRED");
  }

  const decoded =
    await getAuth(firebaseAdminApp)
      .verifyIdToken(token);

  const email =
    typeof decoded.email === "string"
      ? decoded.email.trim().toLowerCase()
      : "";

  if (email !== OWNER_EMAIL) {
    throw new Error("OWNER_ONLY");
  }

  return decoded;
}

function clean(
  value: unknown,
  max = 500
) {
  return typeof value === "string"
    ? value.replace(/\0/g, "").trim().slice(0, max)
    : "";
}

function cleanPlatforms(
  value: unknown
): Platform[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const allowed =
    new Set<Platform>([
      "facebook",
      "instagram",
      "youtube",
      "tiktok",
    ]);

  return Array.from(
    new Set(
      value.filter(
        (item): item is Platform =>
          typeof item === "string" &&
          allowed.has(item as Platform)
      )
    )
  );
}

function timestampToIso(
  value: unknown
): string | null {
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as {
      toDate?: unknown
    }).toDate === "function"
  ) {
    return (
      value as {
        toDate: () => Date
      }
    )
      .toDate()
      .toISOString();
  }

  return null;
}

function authError(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : "";

  if (message === "OWNER_AUTH_REQUIRED") {
    return NextResponse.json(
      {
        success: false,
        error: "Owner sign-in is required.",
      },
      { status: 401 }
    );
  }

  if (message === "OWNER_ONLY") {
    return NextResponse.json(
      {
        success: false,
        error: "Owner access only.",
      },
      { status: 403 }
    );
  }

  return null;
}

export async function GET(
  request: Request
) {
  try {
    await verifyOwner(request);

    const snapshot =
      await adminDb
        .collection("socialPromotionQueue")
        .orderBy("scheduledFor", "asc")
        .limit(250)
        .get();

    const posts =
      snapshot.docs.map((doc) => {
        const data = doc.data();

        return {
          postId: doc.id,
          title:
            clean(data.title, 200),
          caption:
            clean(data.caption, 5000),
          facebookOptimizationEnabled:
            data.facebookOptimizationEnabled !== false,

          facebookCaption:
            clean(
              data.facebookCaption,
              5000
            ),

          instagramOptimizationEnabled:
            data.instagramOptimizationEnabled !== false,

          instagramCaption:
            clean(
              data.instagramCaption,
              5000
            ),

          tiktokOptimizationEnabled:
            data.tiktokOptimizationEnabled !== false,

          tiktokCaption:
            clean(
              data.tiktokCaption,
              2200
            ),

          videoUrl:
            clean(data.videoUrl, 2000),

          mediaType:
            data.mediaType === "image"
              ? "image"
              : "video",

          imageUrl:
            clean(
              data.imageUrl,
              2000
            ),

          imageStoragePath:
            clean(
              data.imageStoragePath,
              2000
            ),

          trackTitle:
            clean(data.trackTitle, 200),
          platforms:
            Array.isArray(data.platforms)
              ? data.platforms
              : [],

          youtubeContentType:
            data.youtubeContentType === "long"
              ? "long"
              : "short",

          youtubePrivacyStatus:
            data.youtubePrivacyStatus === "private"
              ? "private"
              : data.youtubePrivacyStatus === "unlisted"
                ? "unlisted"
                : "public",

          youtubeShortDescription:
            clean(
              data.youtubeShortDescription,
              5000
            ),

          youtubeLongDescription:
            clean(
              data.youtubeLongDescription,
              5000
            ),
          youtubeShortTitle:
            clean(
              data.youtubeShortTitle,
              100
            ),

          youtubeLongTitle:
            clean(
              data.youtubeLongTitle,
              100
            ),

          youtubeSeoEnabled:
            data.youtubeSeoEnabled !== false,
          videoSource:
            data.videoSource === "youtube"
              ? "youtube"
              : "manager",

          youtubeVideoUrl:
            clean(data.youtubeVideoUrl, 2000),

          youtubeShortVideoUrl:
            clean(
              data.youtubeShortVideoUrl,
              2000
            ),

          youtubeLongVideoUrl:
            clean(
              data.youtubeLongVideoUrl,
              2000
            ),
          status:
            clean(data.status, 50) ||
            "draft",
          scheduledFor:
            typeof data.scheduledFor ===
              "string"
              ? data.scheduledFor
              : null,
          timezone:
            clean(data.timezone, 100) ||
            "America/New_York",
          retryCount:
            Number(data.retryCount) || 0,
          maxRetries:
            Number(data.maxRetries) || 3,
          publishedUrls:
            data.publishedUrls || {},

          platformStatus:
            data.platformStatus || {},

          tiktokPrivacyLevel:
            typeof data.tiktokPrivacyLevel ===
              "string"
              ? data.tiktokPrivacyLevel
              : "",

          recurringEnabled:
            data.recurringEnabled === true,

          recurringGroupId:
            clean(
              data.recurringGroupId,
              200
            ),

          recurringIndex:
            Number(
              data.recurringIndex
            ) || 0,

          recurringFrequencyDays:
            Number(
              data.recurringFrequencyDays
            ) || 0,

          recurringEndDate:
            clean(
              data.recurringEndDate,
              100
            ),

          recurringUntilCancelled:
            data.recurringUntilCancelled === true,

          recurringSeriesCancelled:
            data.recurringSeriesCancelled === true,

          lastError:
            clean(data.lastError, 2000) ||
            null,
          createdAt:
            timestampToIso(data.createdAt),
          updatedAt:
            timestampToIso(data.updatedAt),
        };
      });

    return NextResponse.json(
      {
        success: true,
        posts,
      },
      {
        headers: {
          "Cache-Control":
            "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    const auth =
      authError(error);

    if (auth) {
      return auth;
    }

    console.error(
      "Social scheduler GET error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Social promotion queue could not be loaded.",
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

    const action =
      clean(body?.action, 50);

    if (action === "create") {
      const title =
        clean(body?.title, 200);

      const caption =
        clean(body?.caption, 5000);

      const facebookOptimizationEnabled =
        body?.facebookOptimizationEnabled !== false;

      const facebookCaption =
        clean(
          body?.facebookCaption,
          5000
        );

      const instagramOptimizationEnabled =
        body?.instagramOptimizationEnabled !== false;

      const instagramCaption =
        clean(
          body?.instagramCaption,
          5000
        );

      const tiktokOptimizationEnabled =
        body?.tiktokOptimizationEnabled !== false;

      const tiktokCaption =
        clean(
          body?.tiktokCaption,
          2200
        );

      const videoUrl =
        clean(body?.videoUrl, 2000);

      const mediaType:
        "video" | "image" =
          body?.mediaType === "image"
            ? "image"
            : "video";

      const imageUrl =
        clean(
          body?.imageUrl,
          2000
        );

      const imageStoragePath =
        clean(
          body?.imageStoragePath,
          2000
        );

      const imageRotationEnabled =
        mediaType === "image" &&
        body?.imageRotationEnabled === true;

      const imageRotationImages =
        Array.isArray(
          body?.imageRotationImages
        )
          ? body.imageRotationImages
              .map(
                (
                  item: any
                ) => ({
                  previewUrl:
                    clean(
                      item?.previewUrl,
                      2000
                    ),
                  storagePath:
                    clean(
                      item?.storagePath,
                      2000
                    ),
                  mediaId:
                    clean(
                      item?.mediaId,
                      200
                    ),
                  fileName:
                    clean(
                      item?.fileName,
                      300
                    ),
                })
              )
              .filter(
                (
                  item: any
                ) =>
                  item.previewUrl &&
                  item.storagePath
              )
              .slice(
                0,
                50
              )
          : [];

      const trackTitle =
        clean(body?.trackTitle, 200);

      const videoMediaId =
        clean(body?.videoMediaId, 200);

      const videoStoragePath =
        clean(body?.videoStoragePath, 2000);

      // ============================================================
      // SOLO_VIDEO_ROTATION_BACKEND_V1
      // Persist normal scheduler video rotation for recurring posts.
      // ============================================================

      const videoRotationEnabled =
        mediaType === "video" &&
        body?.videoRotationEnabled === true;

      const videoRotationSources =
        Array.isArray(
          body?.videoRotationSources
        )
          ? body.videoRotationSources
              .map(
                (
                  item: any
                ) => ({
                  previewUrl:
                    clean(
                      item?.previewUrl,
                      2000
                    ),

                  storagePath:
                    clean(
                      item?.storagePath,
                      2000
                    ),

                  mediaId:
                    clean(
                      item?.mediaId,
                      200
                    ),

                  fileName:
                    clean(
                      item?.fileName,
                      300
                    ),
                })
              )
              .filter(
                (
                  item: any
                ) =>
                  item.storagePath
              )
              .slice(
                0,
                50
              )
          : [];

      const videoRotationClips =
        videoRotationSources.map(
          (
            item: any
          ) => ({
            videoStoragePath:
              item.storagePath,

            sourceMediaId:
              item.mediaId || "",

            previewUrl:
              item.previewUrl || "",

            fileName:
              item.fileName || "",
          })
        );

      const platforms =
        cleanPlatforms(body?.platforms);

      const youtubeContentType =
        body?.youtubeContentType === "long"
          ? "long"
          : "short";

      const youtubePrivacyStatus =
        body?.youtubePrivacyStatus === "private"
          ? "private"
          : body?.youtubePrivacyStatus === "unlisted"
            ? "unlisted"
            : "public";

      const youtubeShortDescription =
        clean(
          body?.youtubeShortDescription,
          5000
        );

      const youtubeLongDescription =
        clean(
          body?.youtubeLongDescription,
          5000
        );
      const youtubeShortTitle =
        clean(
          body?.youtubeShortTitle,
          100
        );

      const youtubeLongTitle =
        clean(
          body?.youtubeLongTitle,
          100
        );

      const youtubeSeoEnabled =
        body?.youtubeSeoEnabled !== false;
      const videoSource =
        body?.videoSource === "youtube"
          ? "youtube"
          : "manager";

      const youtubeVideoUrl =
        clean(body?.youtubeVideoUrl, 2000);

      const youtubeShortVideoUrl =
        clean(
          body?.youtubeShortVideoUrl,
          2000
        );

      const youtubeLongVideoUrl =
        clean(
          body?.youtubeLongVideoUrl,
          2000
        );

      const scheduledFor =
        clean(body?.scheduledFor, 100);

      const timezone =
        clean(body?.timezone, 100) ||
        "America/New_York";

      // ============================================================
      // SOLO_RECURRING_POSTING_NORMAL_V3
      // ============================================================

      const recurringEnabled =
        body?.recurringEnabled === true;

      const recurringEndDate =
        clean(
          body?.recurringEndDate,
          100
        );

      const recurringFrequencyDays =
        body?.recurringFrequencyDays === 7
          ? 7
          : body?.recurringFrequencyDays === 3
            ? 3
            : body?.recurringFrequencyDays === 2
              ? 2
              : 1;

      const recurringUntilCancelled =
        recurringEnabled &&
        body?.recurringUntilCancelled === true;

      if (!title) {
        return NextResponse.json(
          {
            success: false,
            error: "Post title is required.",
          },
          { status: 400 }
        );
      }

      if (
        mediaType === "video" &&
        videoSource === "youtube" &&
        (
          !youtubeVideoUrl ||
          !/^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(
            youtubeVideoUrl
          )
        )
      ) {
        return NextResponse.json(
          {
            success: false,
            error: "INVALID_YOUTUBE_VIDEO_LINK",
          },
          { status: 400 }
        );
      }

      if (
        mediaType === "video" &&
        !videoUrl
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "A promotional video URL is required.",
          },
          { status: 400 }
        );
      }

      if (
        mediaType === "image" &&
        imageRotationEnabled &&
        imageRotationImages.length < 2
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Image rotation requires at least 2 uploaded images.",
          },
          { status: 400 }
        );
      }

      if (
        mediaType === "image" &&
        (
          !imageUrl ||
          !imageStoragePath
        )
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "An uploaded image is required.",
          },
          { status: 400 }
        );
      }

      if (
        mediaType === "image" &&
        platforms.includes("youtube")
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Image posts do not support YouTube.",
          },
          { status: 400 }
        );
      }

      if (platforms.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Choose at least one social platform.",
          },
          { status: 400 }
        );
      }

      if (
        scheduledFor &&
        Number.isNaN(
          Date.parse(scheduledFor)
        )
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "scheduledFor must be a valid ISO date/time.",
          },
          { status: 400 }
        );
      }

      const status: Status =
        scheduledFor
          ? "scheduled"
          : "draft";

      const scheduleTimes: string[] = [];

      if (
        recurringEnabled &&
        scheduledFor
      ) {
        if (
          !recurringUntilCancelled &&
          !recurringEndDate
        ) {
          return NextResponse.json(
            {
              success: false,
              error:
                "Choose a finish date for recurring posting.",
            },
            { status: 400 }
          );
        }

        const start =
          new Date(scheduledFor);

        const finish =
          recurringUntilCancelled
            ? new Date(start.getTime())
            : new Date(
                `${recurringEndDate}T23:59:59`
              );

        if (
          Number.isNaN(start.getTime()) ||
          Number.isNaN(finish.getTime())
        ) {
          return NextResponse.json(
            {
              success: false,
              error:
                "Recurring schedule date is invalid.",
            },
            { status: 400 }
          );
        }

        if (
          finish.getTime() <
          start.getTime()
        ) {
          return NextResponse.json(
            {
              success: false,
              error:
                "Finish date must be after the start date.",
            },
            { status: 400 }
          );
        }

        const cursor =
          new Date(start.getTime());

        while (
          cursor.getTime() <=
          finish.getTime()
        ) {
          scheduleTimes.push(
            cursor.toISOString()
          );

          cursor.setDate(
            cursor.getDate() +
            recurringFrequencyDays
          );

          if (
            scheduleTimes.length >= 366
          ) {
            break;
          }
        }
      }
      else {
        scheduleTimes.push(
          scheduledFor || ""
        );
      }

      const recurringGroupId =
        recurringEnabled
          ? adminDb
              .collection(
                "socialPromotionQueue"
              )
              .doc()
              .id
          : "";

      const batch =
        adminDb.batch();

      let firstPostId = "";

      scheduleTimes.forEach(
        (
          scheduleTime: string,
          recurringIndex: number
        ) => {
          const ref =
            adminDb
              .collection(
                "socialPromotionQueue"
              )
              .doc();

          if (!firstPostId) {
            firstPostId =
              ref.id;
          }

          batch.set(
            ref,
            {
              postId: ref.id,
        title,
        caption,
        facebookOptimizationEnabled,

        facebookCaption:
          facebookCaption || null,

        instagramOptimizationEnabled,

        instagramCaption:
          instagramCaption || null,

        tiktokOptimizationEnabled,

        tiktokCaption:
          tiktokCaption || null,

        mediaType,

        imageRotationEnabled:
          mediaType === "image"
            ? imageRotationEnabled
            : false,

        imageRotationImages:
          mediaType === "image"
            ? imageRotationImages
            : [],

        imageRotationIndex:
          mediaType === "image" &&
          imageRotationEnabled &&
          imageRotationImages.length > 0
            ? (
                recurringIndex %
                imageRotationImages.length
              )
            : 0,

        imageUrl:
          mediaType === "image"
            ? (
                imageRotationEnabled &&
                imageRotationImages.length > 0
                  ? imageRotationImages[
                      recurringIndex %
                      imageRotationImages.length
                    ].previewUrl
                  : imageUrl
              )
            : null,

        imageStoragePath:
          mediaType === "image"
            ? (
                imageRotationEnabled &&
                imageRotationImages.length > 0
                  ? imageRotationImages[
                      recurringIndex %
                      imageRotationImages.length
                    ].storagePath
                  : imageStoragePath
              )
            : null,

        videoUrl:
          mediaType === "video"
            ? videoUrl
            : null,
        videoMediaId:
          mediaType === "video" &&
          videoRotationEnabled &&
          videoRotationClips.length > 0
            ? (
                videoRotationClips[
                  recurringIndex %
                  videoRotationClips.length
                ].sourceMediaId ||
                videoMediaId ||
                null
              )
            : videoMediaId || null,

        videoStoragePath:
          mediaType === "video" &&
          videoRotationEnabled &&
          videoRotationClips.length > 0
            ? videoRotationClips[
                recurringIndex %
                videoRotationClips.length
              ].videoStoragePath
            : videoStoragePath || null,

        videoRotationEnabled:
          mediaType === "video" &&
          videoRotationEnabled &&
          videoRotationClips.length > 1,

        videoRotationSources:
          mediaType === "video"
            ? videoRotationSources
            : [],

        videoRotationClips:
          mediaType === "video"
            ? videoRotationClips
            : [],

        videoRotationIndex:
          mediaType === "video" &&
          videoRotationEnabled &&
          videoRotationClips.length > 0
            ? (
                recurringIndex %
                videoRotationClips.length
              )
            : 0,

        trackTitle:
          trackTitle || null,
        platforms:
          videoSource === "youtube"
            ? ["youtube"]
            : platforms,

        youtubeContentType,
        youtubePrivacyStatus,
        youtubeShortTitle:
          youtubeShortTitle || null,

        youtubeLongTitle:
          youtubeLongTitle || null,

        youtubeSeoEnabled,
        youtubeShortDescription:
          youtubeShortDescription || null,

        youtubeLongDescription:
          youtubeLongDescription || null,

        videoSource,

        youtubeVideoUrl:
          videoSource === "youtube"
            ? youtubeVideoUrl
            : null,

        youtubeShortVideoUrl:
          videoSource === "youtube"
            ? youtubeShortVideoUrl || null
            : null,

        youtubeLongVideoUrl:
          videoSource === "youtube"
            ? youtubeLongVideoUrl || null
            : null,

        status,

        scheduledFor:
          scheduleTime || null,

        timezone,

        recurringEnabled,

        recurringGroupId:
          recurringEnabled
            ? recurringGroupId
            : null,

        recurringIndex,

        recurringFrequencyDays:
          recurringEnabled
            ? recurringFrequencyDays
            : null,

        recurringEndDate:
          recurringEnabled &&
          !recurringUntilCancelled
            ? recurringEndDate
            : null,

        recurringUntilCancelled,

        recurringSeriesCancelled:
          false,

        retryCount: 0,
        maxRetries: 3,
        publishedUrls: {},
        publishLog: [],
        lastError: null,
        source:
          "solo-beats-social-scheduler",
        createdByUid:
          owner.uid,
        createdByEmail:
          typeof owner.email ===
          "string"
            ? owner.email
            : null,
        createdAt:
          FieldValue.serverTimestamp(),
        updatedAt:
          FieldValue.serverTimestamp(),
            }
          );
        }
      );

      if (
        recurringEnabled &&
        recurringUntilCancelled &&
        recurringGroupId
      ) {
        const seriesRef =
          adminDb
            .collection(
              "socialRecurringSeries"
            )
            .doc(recurringGroupId);

        batch.set(
          seriesRef,
          {
            recurringGroupId,
            active: true,
            recurringFrequencyDays,
            lastGeneratedIndex: 0,
            nextPostId:
              firstPostId || null,
            createdByUid:
              owner.uid,
            createdByEmail:
              typeof owner.email === "string"
                ? owner.email
                : null,
            createdAt:
              FieldValue.serverTimestamp(),
            updatedAt:
              FieldValue.serverTimestamp(),
          }
        );
      }

      await batch.commit();

      return NextResponse.json({
        success: true,
        postId:
          firstPostId,
        postCount:
          scheduleTimes.length,
        recurringEnabled,
        status,
      });
    }

    if (action === "cancel_series") {
      const postId =
        clean(body?.postId, 200);

      if (!postId) {
        return NextResponse.json(
          {
            success: false,
            error: "Post ID is required.",
          },
          { status: 400 }
        );
      }

      const sourceRef =
        adminDb
          .collection(
            "socialPromotionQueue"
          )
          .doc(postId);

      const sourceSnapshot =
        await sourceRef.get();

      if (!sourceSnapshot.exists) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Recurring post was not found.",
          },
          { status: 404 }
        );
      }

      const sourceData =
        sourceSnapshot.data() || {};

      const recurringGroupId =
        clean(
          sourceData.recurringGroupId,
          200
        );

      if (
        !recurringGroupId ||
        sourceData.recurringUntilCancelled !== true
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "This post is not an until-cancelled recurring series.",
          },
          { status: 400 }
        );
      }

      const seriesRef =
        adminDb
          .collection(
            "socialRecurringSeries"
          )
          .doc(recurringGroupId);

      await adminDb.runTransaction(
        async transaction => {
          const seriesSnapshot =
            await transaction.get(
              seriesRef
            );

          const series =
            seriesSnapshot.exists
              ? seriesSnapshot.data() || {}
              : {};

          const nextPostId =
            clean(
              series.nextPostId,
              200
            );

          transaction.set(
            seriesRef,
            {
              active: false,
              cancelledAt:
                FieldValue.serverTimestamp(),
              cancelledFromPostId:
                postId,
              updatedAt:
                FieldValue.serverTimestamp(),
            },
            { merge: true }
          );

          transaction.set(
            sourceRef,
            {
              recurringSeriesCancelled:
                true,
              updatedAt:
                FieldValue.serverTimestamp(),
            },
            { merge: true }
          );

          if (nextPostId) {
            const nextRef =
              adminDb
                .collection(
                  "socialPromotionQueue"
                )
                .doc(nextPostId);

            const nextSnapshot =
              await transaction.get(
                nextRef
              );

            if (nextSnapshot.exists) {
              const nextData =
                nextSnapshot.data() || {};

              if (
                nextData.status === "scheduled" ||
                nextData.status === "draft"
              ) {
                transaction.set(
                  nextRef,
                  {
                    status: "cancelled",
                    recurringSeriesCancelled:
                      true,
                    cancelledAt:
                      FieldValue.serverTimestamp(),
                    updatedAt:
                      FieldValue.serverTimestamp(),
                  },
                  { merge: true }
                );
              }
            }
          }
        }
      );

      return NextResponse.json({
        success: true,
        postId,
        recurringGroupId,
        status:
          "series_cancelled",
      });
    }

    if (
      action === "cancel" ||
      action === "retry"
    ) {
      const postId =
        clean(body?.postId, 200);

      if (!postId) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Post ID is required.",
          },
          { status: 400 }
        );
      }

      const ref =
        adminDb
          .collection(
            "socialPromotionQueue"
          )
          .doc(postId);

      const snapshot =
        await ref.get();

      if (!snapshot.exists) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Scheduled post was not found.",
          },
          { status: 404 }
        );
      }

      if (action === "cancel") {
        await ref.set(
          {
            status: "cancelled",
            cancelledAt:
              FieldValue.serverTimestamp(),
            updatedAt:
              FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        return NextResponse.json({
          success: true,
          postId,
          status: "cancelled",
        });
      }

      await ref.set(
        {
          status: "scheduled",
          lastError: null,
          updatedAt:
            FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      return NextResponse.json({
        success: true,
        postId,
        status: "scheduled",
      });
    }

    // ============================================================
    // SOLO_ADD_TIKTOK_TO_SERIES_V1
    // Add TikTok to future occurrences of an existing recurring series.
    // ============================================================

    if (action === "add_tiktok_to_series") {
      const postId =
        clean(body?.postId, 200);

      if (!postId) {
        return NextResponse.json(
          {
            success: false,
            error: "Post ID is required.",
          },
          { status: 400 }
        );
      }

      const sourceRef =
        adminDb
          .collection("socialPromotionQueue")
          .doc(postId);

      const sourceSnapshot =
        await sourceRef.get();

      if (!sourceSnapshot.exists) {
        return NextResponse.json(
          {
            success: false,
            error: "Scheduled post was not found.",
          },
          { status: 404 }
        );
      }

      const sourceData =
        sourceSnapshot.data() || {};

      const recurringGroupId =
        clean(
          sourceData.recurringGroupId,
          200
        );

      if (
        !recurringGroupId ||
        sourceData.recurringUntilCancelled !== true
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "This post is not an active until-cancelled recurring series.",
          },
          { status: 400 }
        );
      }

      const seriesSnapshot =
        await adminDb
          .collection("socialPromotionQueue")
          .where(
            "recurringGroupId",
            "==",
            recurringGroupId
          )
          .limit(250)
          .get();

      const batch =
        adminDb.batch();

      let updatedCount = 0;

      seriesSnapshot.docs.forEach(
        doc => {
          const data =
            doc.data() || {};

          const status =
            typeof data.status === "string"
              ? data.status
              : "";

          /*
           * Do not rewrite already-published history.
           * Update future/scheduled occurrences only.
           */
          if (
            status === "published" ||
            status === "cancelled"
          ) {
            return;
          }

          /*
           * Existing YouTube-only source mode should remain
           * YouTube-only.
           */
          if (
            data.videoSource === "youtube"
          ) {
            return;
          }

          const currentPlatforms =
            Array.isArray(data.platforms)
              ? data.platforms.filter(
                  (item: unknown) =>
                    typeof item === "string"
                )
              : [];

          const nextPlatforms =
            Array.from(
              new Set([
                ...currentPlatforms,
                "tiktok",
              ])
            );

          batch.update(
            doc.ref,
            {
              platforms:
                nextPlatforms,

              "platformStatus.tiktok":
                "scheduled",

              updatedAt:
                FieldValue
                  .serverTimestamp(),
            }
          );

          updatedCount += 1;
        }
      );

      if (updatedCount > 0) {
        await batch.commit();
      }

      /*
       * Store the preference on the series document too.
       * This provides a durable series-level marker.
       */
      await adminDb
        .collection(
          "socialRecurringSeries"
        )
        .doc(recurringGroupId)
        .set(
          {
            tiktokEnabled:
              true,

            updatedAt:
              FieldValue
                .serverTimestamp(),
          },
          {
            merge: true,
          }
        );

      return NextResponse.json({
        success: true,
        postId,
        recurringGroupId,
        updatedCount,
      });
    }
    if (action === "reschedule") {
      const postId =
        clean(body?.postId, 200);

      const youtubeContentType =
        body?.youtubeContentType === "long"
          ? "long"
          : "short";

      const youtubePrivacyStatus =
        body?.youtubePrivacyStatus === "private"
          ? "private"
          : body?.youtubePrivacyStatus === "unlisted"
            ? "unlisted"
            : "public";

      const videoSource =
        body?.videoSource === "youtube"
          ? "youtube"
          : "manager";

      const youtubeVideoUrl =
        clean(body?.youtubeVideoUrl, 2000);

      const youtubeShortVideoUrl =
        clean(
          body?.youtubeShortVideoUrl,
          2000
        );

      const youtubeLongVideoUrl =
        clean(
          body?.youtubeLongVideoUrl,
          2000
        );

      const scheduledFor =
        clean(body?.scheduledFor, 100);

      if (
        !postId ||
        !scheduledFor ||
        Number.isNaN(
          Date.parse(scheduledFor)
        )
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Post ID and valid schedule time are required.",
          },
          { status: 400 }
        );
      }

      await adminDb
        .collection(
          "socialPromotionQueue"
        )
        .doc(postId)
        .set(
          {
            // TIKTOK_RESCHEDULE_RESET_V1
            // A rescheduled TikTok post must start a fresh
            // Direct Post attempt instead of polling an old
            // incomplete publish_id.
            scheduledFor,
            status: "scheduled",

            tiktokPublishId:
              FieldValue.delete(),

            tiktokPublishLock:
              FieldValue.delete(),

            tiktokPublishLockAt:
              FieldValue.delete(),

            tiktokLastStatus:
              FieldValue.delete(),

            tiktokPublishComplete:
              FieldValue.delete(),

            tiktokPublishedPostId:
              FieldValue.delete(),

            "platformStatus.tiktok":
              "scheduled",

            retryCount: 0,

            lastError: null,

            updatedAt:
              FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

      return NextResponse.json({
        success: true,
        postId,
        status: "scheduled",
        scheduledFor,
      });
    }

    return NextResponse.json(
      {
        success: false,
        error:
          "Unsupported scheduler action.",
      },
      { status: 400 }
    );
  } catch (error) {
    const auth =
      authError(error);

    if (auth) {
      return auth;
    }

    console.error(
      "Social scheduler POST error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Social promotion request failed.",
      },
      { status: 500 }
    );
  }
}





















