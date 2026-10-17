import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";
import { spawn } from "child_process";
import { existsSync } from "fs";
import { join } from "path";
import ffmpegStaticPath from "ffmpeg-static";

import {
  adminBucket,
  adminDb,
  firebaseAdminApp,
} from "../../../../../lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const OWNER_EMAIL = (
  process.env.OWNER_EMAIL ||
  process.env.NEXT_PUBLIC_OWNER_EMAIL ||
  "supe4.me@gmail.com"
).trim().toLowerCase();

function bearer(request: Request) {
  return (
    request.headers
      .get("authorization")
      ?.match(/^Bearer\s+(.+)$/i)?.[1]
      ?.trim() || null
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
      ? decoded.email.toLowerCase()
      : "";

  if (email !== OWNER_EMAIL) {
    throw new Error("OWNER_ONLY");
  }

  return decoded;
}

function clean(value: unknown, max = 500) {
  return typeof value === "string"
    ? value.replace(/\0/g, "").trim().slice(0, max)
    : "";
}

function resolveFfmpegPath() {
  const localPath =
    join(
      process.cwd(),
      "node_modules",
      "ffmpeg-static",
      process.platform === "win32"
        ? "ffmpeg.exe"
        : "ffmpeg"
    );

  if (existsSync(localPath)) {
    return localPath;
  }

  if (
    ffmpegStaticPath &&
    typeof ffmpegStaticPath === "string"
  ) {
    return ffmpegStaticPath;
  }

  throw new Error("FFMPEG_BINARY_NOT_AVAILABLE");
}

function runFfmpegStream(
  args: string[],
  inputStream: NodeJS.ReadableStream,
  outputStream: NodeJS.WritableStream
) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(
      resolveFfmpegPath(),
      args,
      {
        windowsHide: true,
        stdio: ["pipe", "pipe", "pipe"],
      }
    );

    let stderr = "";

    child.stderr.on("data", chunk => {
      stderr += String(chunk);

      if (stderr.length > 20000) {
        stderr = stderr.slice(-20000);
      }
    });

    child.on("error", reject);

    inputStream.on("error", reject);
    outputStream.on("error", reject);

    child.stdout.pipe(outputStream);
    inputStream.pipe(child.stdin);

    child.on("close", code => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          `FFMPEG_PROMO_FAILED_${code}: ${stderr.slice(-5000)}`
        )
      );
    });
  });
}

export async function POST(request: Request) {

  try {
    const owner = await verifyOwner(request);
    const body = await request.json();

    const videoMediaId =
      clean(body?.videoMediaId, 200);

    // SOLO_DEVICE_AUTO_CLIP_V1
    const directSourceStoragePath =
      clean(body?.sourceStoragePath, 2000);

    const videoRotationEnabled =
      body?.videoRotationEnabled === true;

    const videoRotationSources =
      Array.isArray(
        body?.videoRotationSources
      )
        ? body.videoRotationSources
            .map(
              (item: any) => ({
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
              (item: any) =>
                item.storagePath ||
                item.mediaId
            )
            .slice(
              0,
              20
            )
        : [];

    const title =
      clean(body?.title, 200);

    const trackTitle =
      clean(body?.trackTitle, 200);

    const scheduledFor =
      clean(body?.scheduledFor, 100);

    const platforms =
      Array.isArray(body?.platforms)
        ? body.platforms.filter(
            (value: unknown) =>
              value === "facebook" ||
              value === "instagram" ||
              value === "youtube"
          )
        : [];

    const youtubeContentType:
      "short" | "long" =
        body?.youtubeContentType === "long"
          ? "long"
          : "short";

    const youtubePrivacyStatus:
      "public" | "unlisted" | "private" =
        body?.youtubePrivacyStatus === "private"
          ? "private"
          : body?.youtubePrivacyStatus === "unlisted"
            ? "unlisted"
            : "public";

    if (
      videoRotationEnabled &&
      videoRotationSources.length < 2
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Daily Video Rotation requires at least 2 source videos.",
        },
        { status: 400 }
      );
    }

    if (
      !videoRotationEnabled &&
      !videoMediaId &&
      !directSourceStoragePath
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Choose or upload a source video.",
        },
        { status: 400 }
      );
    }

    if (!title) {
      return NextResponse.json(
        {
          success: false,
          error: "Promotion title is required.",
        },
        { status: 400 }
      );
    }

    if (!trackTitle) {
      return NextResponse.json(
        {
          success: false,
          error: "Track title is required.",
        },
        { status: 400 }
      );
    }

    if (!scheduledFor) {
      return NextResponse.json(
        {
          success: false,
          error: "Choose a posting time.",
        },
        { status: 400 }
      );
    }

    if (platforms.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Choose at least one platform.",
        },
        { status: 400 }
      );
    }

    const rotationSourceList =
      videoRotationEnabled &&
      videoRotationSources.length > 1
        ? videoRotationSources
        : [
            {
              storagePath:
                directSourceStoragePath,
              mediaId:
                videoMediaId,
              previewUrl: "",
              fileName: "",
            },
          ];

    const generatedRotationClips:
      Array<{
        sourceMediaId: string;
        sourceStoragePath: string;
        videoStoragePath: string;
      }> = [];

    for (
      const rotationSource of
      rotationSourceList
    ) {
      let sourceStoragePath =
        clean(
          rotationSource?.storagePath,
          2000
        );

      const sourceMediaId =
        clean(
          rotationSource?.mediaId,
          200
        );

      if (
        !sourceStoragePath &&
        sourceMediaId
      ) {
        const mediaRef =
          adminDb
            .collection(
              "mediaLibrary"
            )
            .doc(
              sourceMediaId
            );

        const mediaSnapshot =
          await mediaRef.get();

        if (!mediaSnapshot.exists) {
          throw new Error(
            "Selected rotation video was not found."
          );
        }

        const media =
          mediaSnapshot.data() || {};

        sourceStoragePath =
          clean(
            media.storagePath,
            2000
          );
      }

      if (!sourceStoragePath) {
        throw new Error(
          "A rotation video has no storage path."
        );
      }

      const sourceFile =
        adminBucket.file(
          sourceStoragePath
        );

      const [exists] =
        await sourceFile.exists();

      if (!exists) {
        throw new Error(
          "A rotation source video file is missing."
        );
      }

      const assetId =
        crypto.randomUUID();

      const generatedStoragePath =
        `social-promotions/${assetId}/promo.mp4`;

      const inputStream =
        sourceFile.createReadStream();

      const destinationFile =
        adminBucket.file(
          generatedStoragePath
        );

      const outputStream =
        destinationFile.createWriteStream({
          resumable: false,
          metadata: {
            contentType:
              "video/mp4",
          },
        });

      await runFfmpegStream(
        [
          "-y",
          "-ss", "10",
          "-i", "pipe:0",
          "-t", "30",
          "-vf",
          "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black",
          "-c:v", "libx264",
          "-preset", "veryfast",
          "-crf", "21",
          "-c:a", "aac",
          "-b:a", "192k",
          "-movflags",
          "frag_keyframe+empty_moov+default_base_moof",
          "-f", "mp4",
          "pipe:1",
        ],
        inputStream,
        outputStream
      );

      generatedRotationClips.push({
        sourceMediaId,
        sourceStoragePath,
        videoStoragePath:
          generatedStoragePath,
      });
    }

    if (
      generatedRotationClips.length === 0
    ) {
      throw new Error(
        "No short-form clips were generated."
      );
    }

    const storagePath =
      generatedRotationClips[0]
        .videoStoragePath;
    const caption = [
      `${trackTitle} by Solo Beats`,
      "",
      "Turn it up and feel the movement.",
      "",
      "SOLO BEATS ENGINE MUSIC",
      "",
      "https://www.solobeatsenginemusic.com",
      "",
      "#SoloBeats #SoloBeatsEngineMusic #NewMusic #ElectronicMusic #Reels #Shorts",
    ].join("\n");

    // ============================================================
    // SOLO_RECURRING_AUTO_PROMOTION_V3
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

    const scheduleTimes: string[] = [];

    const start =
      new Date(scheduledFor);

    if (
      Number.isNaN(
        start.getTime()
      )
    ) {
      throw new Error(
        "INVALID_SCHEDULE_TIME"
      );
    }

    if (recurringEnabled) {

      if (
        !recurringUntilCancelled &&
        !recurringEndDate
      ) {
        throw new Error(
          "RECURRING_END_DATE_REQUIRED"
        );
      }

      const finish =
        recurringUntilCancelled
          ? new Date(start.getTime())
          : new Date(
              `${recurringEndDate}T23:59:59`
            );

      if (
        Number.isNaN(
          finish.getTime()
        )
      ) {
        throw new Error(
          "INVALID_RECURRING_END_DATE"
        );
      }

      if (
        finish.getTime() <
        start.getTime()
      ) {
        throw new Error(
          "RECURRING_END_BEFORE_START"
        );
      }

      const cursor =
        new Date(
          start.getTime()
        );

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
        start.toISOString()
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

        const videoRotationIndex =
          videoRotationEnabled &&
          generatedRotationClips.length > 1
            ? (
                recurringIndex %
                generatedRotationClips.length
              )
            : 0;

        const selectedRotationClip =
          generatedRotationClips[
            videoRotationIndex
          ] ||
          generatedRotationClips[0];

        batch.set(
          ref,
          {
            postId: ref.id,
            title,
            caption,
            trackTitle,
            platforms,
            youtubeContentType,
            youtubePrivacyStatus,
            status: "scheduled",

            scheduledFor:
              scheduleTime,

            timezone:
              "America/New_York",

            videoMediaId:
              selectedRotationClip
                .sourceMediaId ||
              videoMediaId,

            videoStoragePath:
              selectedRotationClip
                .videoStoragePath,

            videoRotationEnabled:
              videoRotationEnabled &&
              generatedRotationClips.length > 1,

            videoRotationIndex,

            videoRotationClips:
              generatedRotationClips,

            autoGenerated: true,
            autoClip: true,
            autoCaption: true,
            clipDurationSeconds: 30,

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
              "solo-beats-auto-promotion",

            createdByUid:
              owner.uid,

            createdByEmail:
              owner.email || null,

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
            owner.email || null,
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
      caption,
    });

  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Automatic promotion failed.";

    if (message === "OWNER_AUTH_REQUIRED") {
      return NextResponse.json(
        {
          success: false,
          error: "Owner sign-in required.",
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

    console.error(
      "AUTO PROMOTION ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}










