import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";
import { randomUUID } from "crypto";
import { spawn } from "child_process";
import {
  mkdtemp,
  readFile,
  rm,
} from "fs/promises";
import os from "os";
import path from "path";

import {
  adminBucket,
  adminDb,
  firebaseAdminApp,
} from "../../../../../lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// SOLO_AUTO_VIDEO_STAGE2

const ffmpegPath =
  process.platform === "win32"
    ? path.join(
        process.cwd(),
        "node_modules",
        "ffmpeg-static",
        "ffmpeg.exe"
      )
    : path.join(
        process.cwd(),
        "node_modules",
        "ffmpeg-static",
        "ffmpeg"
      );

function clean(
  value: unknown,
  max = 2000
) {
  return typeof value === "string"
    ? value
        .replace(/\0/g, "")
        .trim()
        .slice(0, max)
    : "";
}

function clamp(
  value: unknown,
  min: number,
  max: number,
  fallback: number
) {
  const number =
    Number(value);

  if (!Number.isFinite(number)) {
    return fallback;
  }

  return Math.min(
    max,
    Math.max(
      min,
      number
    )
  );
}

function bearer(
  request: Request
) {
  return (
    request.headers
      .get("authorization")
      ?.match(/^Bearer\s+(.+)$/i)?.[1]
      ?.trim() ||
    ""
  );
}

async function verifyOwner(
  request: Request
) {
  const token =
    bearer(request);

  if (!token) {
    throw new Error(
      "OWNER_AUTH_REQUIRED"
    );
  }

  const user =
    await getAuth(
      firebaseAdminApp
    ).verifyIdToken(token);

  const ownerEmail =
    (
      process.env.OWNER_EMAIL ||
      process.env.NEXT_PUBLIC_OWNER_EMAIL ||
      "supe4.me@gmail.com"
    )
      .trim()
      .toLowerCase();

  const email =
    (
      user.email ||
      ""
    )
      .trim()
      .toLowerCase();

  if (
    email !== ownerEmail
  ) {
    throw new Error(
      "OWNER_ACCESS_REQUIRED"
    );
  }

  return user;
}

function safeExtension(
  name: string,
  fallback: string
) {
  const ext =
    path
      .extname(name)
      .toLowerCase();

  return /^[.][a-z0-9]{1,8}$/.test(
    ext
  )
    ? ext
    : fallback;
}

function runFfmpeg(
  args: string[],
  cancelled: () => Promise<boolean>
) {
  return new Promise<void>(
    (
      resolve,
      reject
    ) => {
      const child =
        spawn(
          ffmpegPath,
          args,
          {
            windowsHide:
              true,
          }
        );

      let stderr = "";
      let ended = false;
      let checking = false;
      let stopped = false;
      const poll = setInterval(async () => {
        if (ended || checking) return;
        checking = true;
        try {
          if (await cancelled()) {
            stopped = true;
            child.kill("SIGKILL");
          }
        } catch (error) {
          console.error("SOLO_CANCEL_CHECK_FAILED", error);
        } finally { checking = false; }
      }, 800);

      child.stderr.on(
        "data",
        chunk => {
          stderr +=
            String(chunk);

          if (
            stderr.length >
            24000
          ) {
            stderr =
              stderr.slice(
                -24000
              );
          }
        }
      );

      child.on("error", error => {
        ended = true;
        clearInterval(poll);
        reject(error);
      });

      child.on(
        "close",
        code => {
          ended = true;
          clearInterval(poll);
          if (stopped) { reject(new Error("RENDER_CANCELLED")); return; }
          if (
            code === 0
          ) {
            resolve();
            return;
          }

          reject(
            new Error(
              stderr ||
              `FFMPEG_EXIT_${code}`
            )
          );
        }
      );
    }
  );
}

function styleValues(
  style: string,
  scene: number
) {
  if (
    style === "fire"
  ) {
    return [
      "eq=contrast=1.10:saturation=1.30:brightness=0.015",
      "eq=contrast=1.18:saturation=1.55:brightness=0.025",
      "eq=contrast=1.14:saturation=1.40:brightness=0.010",
    ][scene];
  }

  if (
    style === "neon"
  ) {
    return [
      "eq=contrast=1.14:saturation=1.45:brightness=0.010",
      "eq=contrast=1.22:saturation=1.75:brightness=0.020",
      "eq=contrast=1.18:saturation=1.55:brightness=0.005",
    ][scene];
  }

  return [
    "eq=contrast=1.06:saturation=1.05:brightness=0.000",
    "eq=contrast=1.12:saturation=1.15:brightness=0.010",
    "eq=contrast=1.08:saturation=1.00:brightness=-0.005",
  ][scene];
}

export async function POST(
  request: Request
) {
  let workDir = "";
  let jobRef: FirebaseFirestore.DocumentReference | null = null;
  let cancelledCheck: (() => Promise<boolean>) | null = null;

  let audioStoragePath = "";
  let imageStoragePath = "";
  let overlayStoragePath = "";

  try {
    const owner =
      await verifyOwner(
        request
      );

    const body =
      await request.json();
    const jobId = clean(body?.jobId, 60);
    if (!/^[a-f0-9-]{36}$/i.test(jobId)) {
      return NextResponse.json({success:false,error:"INVALID_RENDER_JOB"},{status:400});
    }
    jobRef = adminDb.collection("soloRenderJobs").doc(`${owner.uid}_${jobId}`);
    if (body?.action === "cancel") {
      await jobRef.set({cancelled:true, updatedAt:FieldValue.serverTimestamp()},{merge:true});
      return NextResponse.json({success:true,cancelled:true});
    }
    cancelledCheck = async () => (await jobRef!.get()).data()?.cancelled === true;
    const ensureNotCancelled = async () => {
      if (await cancelledCheck!()) throw new Error("RENDER_CANCELLED");
    };
    await ensureNotCancelled();

    audioStoragePath =
      clean(
        body?.audioStoragePath,
        2000
      );

    imageStoragePath =
      clean(
        body?.imageStoragePath,
        2000
      );

    overlayStoragePath =
      clean(
        body?.overlayStoragePath,
        2000
      );

    const audioName =
      clean(
        body?.audioName,
        500
      ) ||
      "track.wav";

    const imageName =
      clean(
        body?.imageName,
        500
      ) ||
      "cover.jpg";

    const title =
      clean(
        body?.title,
        300
      ) ||
      "Solo Beats Promo";

    const artist =
      clean(
        body?.artist,
        200
      );

    const format =
      clean(
        body?.format,
        30
      ) === "landscape"
        ? "landscape"
        : "vertical";

    const visualMode =
      clean(
        body?.visualMode,
        20
      ) === "manual"
        ? "manual"
        : "auto";

    const visualStyleRaw =
      clean(
        body?.visualStyle,
        30
      );

    const visualStyle =
      [
        "cinematic",
        "fire",
        "neon",
      ].includes(
        visualStyleRaw
      )
        ? visualStyleRaw
        : "cinematic";

    const duration =
      clamp(
        body?.duration,
        5,
        60,
        15
      );

    const clipStartSeconds =
      clamp(
        body?.clipStartSeconds,
        0,
        3600,
        0
      );

    const bpm =
      clamp(
        body?.bpm,
        60,
        200,
        120
      );

    const intensity =
      clamp(
        body?.intensity,
        0,
        100,
        visualMode ===
          "auto"
          ? 65
          : 50
      );

    const introSeconds =
      clamp(
        body?.introSeconds,
        0,
        3,
        0.5
      );

    const outroSeconds =
      clamp(
        body?.outroSeconds,
        0,
        3,
        0.75
      );

    const sourcePrefix =
      `media/auto-video-source/${owner.uid}/`;

    for (
      const value of [
        audioStoragePath,
        imageStoragePath,
        overlayStoragePath,
      ]
    ) {
      if (
        value &&
        (
          !value.startsWith(
            sourcePrefix
          ) ||
          value.includes("..")
        )
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Invalid source upload path.",
          },
          {
            status: 400,
          }
        );
      }
    }

    if (
      !audioStoragePath ||
      !imageStoragePath
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Track and cover are required.",
        },
        {
          status: 400,
        }
      );
    }

    const audioSource =
      adminBucket.file(
        audioStoragePath
      );

    const imageSource =
      adminBucket.file(
        imageStoragePath
      );

    const audioExists =
      await audioSource.exists();

    const imageExists =
      await imageSource.exists();

    if (
      !audioExists[0]
    ) {
      throw new Error(
        "TRACK_UPLOAD_NOT_FOUND"
      );
    }

    if (
      !imageExists[0]
    ) {
      throw new Error(
        "COVER_UPLOAD_NOT_FOUND"
      );
    }

    const audioExt =
      safeExtension(
        audioName,
        ".wav"
      );

    const imageExt =
      safeExtension(
        imageName,
        ".jpg"
      );

    workDir =
      await mkdtemp(
        path.join(
          os.tmpdir(),
          "solo-auto-stage2-"
        )
      );

    const audioPath =
      path.join(
        workDir,
        `audio${audioExt}`
      );

    const imagePath =
      path.join(
        workDir,
        `cover${imageExt}`
      );

    const overlayPath =
      path.join(
        workDir,
        "overlay.png"
      );

    const outputPath =
      path.join(
        workDir,
        "promo.mp4"
      );

    await Promise.all([
      audioSource.download({
        destination:
          audioPath,
      }),

      imageSource.download({
        destination:
          imagePath,
      }),
    ]);

    let hasOverlay =
      false;

    if (
      overlayStoragePath
    ) {
      const overlaySource =
        adminBucket.file(
          overlayStoragePath
        );

      const exists =
        await overlaySource.exists();

      if (
        exists[0]
      ) {
        await overlaySource.download({
          destination:
            overlayPath,
        });

        hasOverlay =
          true;
      }
    }

    const width =
      format === "landscape"
        ? 1920
        : 1080;

    const height =
      format === "landscape"
        ? 1080
        : 1920;

    const framesPerBeat =
      Math.max(
        8,
        Math.round(
          30 * 60 / bpm
        )
      );

    const sceneOneEnd =
      (
        duration / 3
      ).toFixed(3);

    const sceneTwoEnd =
      (
        duration * 2 / 3
      ).toFixed(3);

    const zoomFilter =
      [
        `scale=${width}:${height}:force_original_aspect_ratio=decrease:flags=lanczos`,
        `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black`,
        "setsar=1",
        "fps=30",
      ].join(",");

    const scene0 =
      styleValues(
        visualStyle,
        0
      );

    const scene1 =
      styleValues(
        visualStyle,
        1
      );

    const scene2 =
      styleValues(
        visualStyle,
        2
      );

    const flashAmount =
      (
        intensity /
        100 *
        0.055
      ).toFixed(4);

    const rhythmicEq =
      `eq=brightness='${flashAmount}*(0.5+0.5*sin(2*PI*n/${framesPerBeat}))':eval=frame`;

    const filterParts = [
      `[0:v]${zoomFilter},split=3[s0][s1][s2]`,

      `[s0]trim=start=0:end=${sceneOneEnd},setpts=PTS-STARTPTS,${scene0}[v0]`,

      `[s1]trim=start=${sceneOneEnd}:end=${sceneTwoEnd},setpts=PTS-STARTPTS,${scene1}[v1]`,

      `[s2]trim=start=${sceneTwoEnd}:end=${duration.toFixed(
        3
      )},setpts=PTS-STARTPTS,${scene2}[v2]`,

      `[v0][v1][v2]concat=n=3:v=1:a=0,${rhythmicEq},fade=t=in:st=0:d=${introSeconds.toFixed(
        2
      )},fade=t=out:st=${Math.max(
        0,
        duration -
          outroSeconds
      ).toFixed(
        2
      )}:d=${outroSeconds.toFixed(
        2
      )}[scene]`,
    ];

    if (
      hasOverlay
    ) {
      filterParts.push(
        `[2:v]scale=${width}:${height}[overlay]`
      );

      filterParts.push(
        "[scene][overlay]overlay=0:0:format=auto,format=yuv420p[vout]"
      );
    }
    else {
      filterParts.push(
        "[scene]format=yuv420p[vout]"
      );
    }

    const ffmpegArgs = [
      "-y",

      "-loop",
      "1",

      "-i",
      imagePath,

      "-ss",
      String(
        clipStartSeconds
      ),

      "-i",
      audioPath,
    ];

    if (
      hasOverlay
    ) {
      ffmpegArgs.push(
        "-loop",
        "1",
        "-i",
        overlayPath
      );
    }

    ffmpegArgs.push(
      "-filter_complex",
      filterParts.join(";"),

      "-map",
      "[vout]",

      "-map",
      "1:a:0",

      // SOLO_SOCIAL_MP4_PLAYBACK_FIX_V1
      // Force a clean, fixed-duration, browser/social-safe MP4.
      "-t",
      String(duration),

      "-vsync",
      "cfr",

      "-r",
      "30",

      "-c:v",
      "libx264",

      "-preset",
      "medium",

      "-crf",
      "23",

      "-pix_fmt",
      "yuv420p",

      "-profile:v",
      "high",

      "-level",
      "4.1",

      "-g",
      "60",

      "-keyint_min",
      "60",

      "-sc_threshold",
      "0",

      "-c:a",
      "aac",

      "-b:a",
      "192k",

      "-ar",
      "48000",

      "-af",
      "aresample=async=1:first_pts=0",

      "-avoid_negative_ts",
      "make_zero",

      "-fflags",
      "+genpts",

      "-movflags",
      "+faststart",

      outputPath
    );

    await ensureNotCancelled();
    await runFfmpeg(ffmpegArgs, cancelledCheck);
    await ensureNotCancelled();

    const output =
      await readFile(
        outputPath
      );

    if (
      !output.length
    ) {
      throw new Error(
        "VIDEO_OUTPUT_EMPTY"
      );
    }

    const id =
      randomUUID();

    const storagePath =
      `media/video/auto-promos/${id}.mp4`;

    const downloadToken =
      randomUUID();

    const storageFile =
      adminBucket.file(
        storagePath
      );

    await ensureNotCancelled();
    await storageFile.save(
      output,
      {
        resumable:
          false,

        metadata: {
          contentType:
            "video/mp4",

          cacheControl:
            "public,max-age=31536000",

          metadata: {
            firebaseStorageDownloadTokens:
              downloadToken,

            generatedBy:
              "SOLO_AUTO_VIDEO_STAGE2",

            title,

            artist,

            visualStyle,

            visualMode,

            format,
          },
        },
      }
    );

    if (await cancelledCheck()) {
      await storageFile.delete({ignoreNotFound:true});
      throw new Error("RENDER_CANCELLED");
    }
    const videoUrl =
      `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(
        adminBucket.name
      )}/o/${encodeURIComponent(
        storagePath
      )}?alt=media&token=${downloadToken}`;

    await ensureNotCancelled();
    await adminDb
      .collection(
        "mediaLibrary"
      )
      .doc(id)
      .set({
        mediaId:
          id,

        kind:
          "video",

        title,

        artist,

        description:
          `SOLO BEATS Auto Video Stage 2 - ${visualStyle} ${format}.`,

        storagePath,

        mimeType:
          "video/mp4",

        extension:
          "mp4",

        sizeBytes:
          output.length,

        status:
          "active",

        sourceType:
          "auto-video-generator",

        autoGenerated:
          true,

        generatedBy:
          "SOLO_AUTO_VIDEO_STAGE2",

        sourceTrack:
          audioName,

        sourceCover:
          imageName,

        sourceClipStartSeconds:
          clipStartSeconds,

        promoDuration:
          duration,

        visualStyle,

        visualMode,

        format,

        bpm,

        intensity,

        width,

        height,

        published:
          false,

        featured:
          false,

        homepageEnabled:
          false,

        premiumTvEnabled:
          false,

        createdAt:
          FieldValue.serverTimestamp(),

        updatedAt:
          FieldValue.serverTimestamp(),
      });

    if (await cancelledCheck()) {
      await adminDb.collection("mediaLibrary").doc(id).delete();
      await storageFile.delete({ignoreNotFound:true});
      throw new Error("RENDER_CANCELLED");
    }
    return NextResponse.json({
      success:
        true,

      video: {
        id,
        mediaId:
          id,

        title,
        artist,

        duration,

        width,
        height,

        format:
          "mp4",

        layout:
          format,

        visualStyle,

        visualMode,

        bpm,

        intensity,

        clipStartSeconds,

        storagePath,

        videoUrl,
      },
    });
  }
  catch (error) {
    console.error(
      "AUTO_VIDEO_STAGE2_ERROR",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "Video generation failed.";

    return NextResponse.json(
      {
        success:
          false,

        error:
          message,
      },
      {
        status:
          message.includes(
            "OWNER_"
          )
            ? 401
            : 500,
      }
    );
  }
  finally {
    if (
      workDir
    ) {
      await rm(
        workDir,
        {
          recursive:
            true,

          force:
            true,
        }
      ).catch(
        () => {}
      );
    }

    for (
      const sourcePath of [
        audioStoragePath,
        imageStoragePath,
        overlayStoragePath,
      ]
    ) {
      if (
        sourcePath
      ) {
        await adminBucket
          .file(
            sourcePath
          )
          .delete({
            ignoreNotFound:
              true,
          })
          .catch(
            () => {}
          );
      }
    }
  }
}