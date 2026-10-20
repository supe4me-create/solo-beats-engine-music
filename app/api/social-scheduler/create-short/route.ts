import {
  randomUUID,
} from "crypto";

import {
  spawn,
} from "child_process";

import {
  mkdtemp,
  readFile,
  rm,
} from "fs/promises";

import os from "os";
import path from "path";

import {
  adminBucket,
} from "../../../../lib/firebaseAdmin";

import {
  requireSchedulerCustomer,
} from "../../../../lib/socialSchedulerCustomer";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export const maxDuration =
  300;

// ============================================================
// SOLO_CUSTOMER_CREATE_SHORT_V1
// Long customer video -> vertical social short.
// Original uploaded source remains untouched.
// ============================================================

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
  max = 3000
) {
  return typeof value === "string"
    ? value
        .replace(/\0/g, "")
        .trim()
        .slice(
          0,
          max
        )
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

  if (
    !Number.isFinite(
      number
    )
  ) {
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

function safeExtension(
  storagePath: string
) {
  const ext =
    path
      .extname(
        storagePath
      )
      .toLowerCase();

  return /^[.][a-z0-9]{1,8}$/.test(
    ext
  )
    ? ext
    : ".mp4";
}

function runFfmpeg(
  args: string[]
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

      let stderr =
        "";

      child.stderr.on(
        "data",
        chunk => {
          stderr +=
            String(
              chunk
            );

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

      child.on(
        "error",
        reject
      );

      child.on(
        "close",
        code => {
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

export async function POST(
  request: Request
) {
  let workDir =
    "";

  try {
    const {
      decoded,
    } =
      await requireSchedulerCustomer(
        request
      );

    const body =
      await request.json();

    const sourceStoragePath =
      clean(
        body?.sourceStoragePath
      );

    const requestedDuration =
      Number(
        body?.duration
      );

    const duration =
      [
        15,
        30,
        60,
      ].includes(
        requestedDuration
      )
        ? requestedDuration
        : 30;

    const startSeconds =
      clamp(
        body?.startSeconds,
        0,
        3600,
        0
      );

    const requiredPrefix =
      `social-promotions/device/${decoded.uid}/`;

    if (
      !sourceStoragePath ||
      !sourceStoragePath.startsWith(
        requiredPrefix
      ) ||
      sourceStoragePath.includes(
        ".."
      )
    ) {
      return Response.json(
        {
          success:
            false,

          error:
            "Invalid customer video source.",
        },
        {
          status:
            400,
        }
      );
    }

    const sourceFile =
      adminBucket.file(
        sourceStoragePath
      );

    const exists =
      await sourceFile.exists();

    if (
      !exists[0]
    ) {
      return Response.json(
        {
          success:
            false,

          error:
            "Uploaded video could not be found.",
        },
        {
          status:
            404,
        }
      );
    }

    workDir =
      await mkdtemp(
        path.join(
          os.tmpdir(),
          "solo-customer-short-"
        )
      );

    const sourcePath =
      path.join(
        workDir,
        `source${safeExtension(
          sourceStoragePath
        )}`
      );

    const outputPath =
      path.join(
        workDir,
        "short.mp4"
      );

    await sourceFile.download({
      destination:
        sourcePath,
    });

    const videoFilter =
      [
        "scale=1080:1920:force_original_aspect_ratio=increase",
        "crop=1080:1920",
        "setsar=1",
        "fps=30",
      ].join(",");

    const args = [
      "-y",

      "-ss",
      String(
        startSeconds
      ),

      "-i",
      sourcePath,

      "-t",
      String(
        duration
      ),

      "-map",
      "0:v:0",

      "-map",
      "0:a?",

      "-vf",
      videoFilter,

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

      "-r",
      "30",

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

      "-avoid_negative_ts",
      "make_zero",

      "-movflags",
      "+faststart",

      outputPath,
    ];

    await runFfmpeg(
      args
    );

    const output =
      await readFile(
        outputPath
      );

    if (
      !output.length
    ) {
      throw new Error(
        "SHORT_VIDEO_OUTPUT_EMPTY"
      );
    }

    const shortId =
      randomUUID();

    const storagePath =
      `social-promotions/device/${decoded.uid}/${shortId}/customer-short-${duration}s.mp4`;

    const downloadToken =
      randomUUID();

    const outputFile =
      adminBucket.file(
        storagePath
      );

    await outputFile.save(
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

            source:
              "solo-beats-customer-short-maker",

            customerUid:
              decoded.uid,

            originalStoragePath:
              sourceStoragePath,

            shortDuration:
              String(
                duration
              ),

            shortStartSeconds:
              String(
                startSeconds
              ),
          },
        },
      }
    );

    const videoUrl =
      `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(
        adminBucket.name
      )}/o/${encodeURIComponent(
        storagePath
      )}?alt=media&token=${downloadToken}`;

    return Response.json({
      success:
        true,

      short: {
        videoUrl,

        storagePath,

        fileName:
          `customer-short-${duration}s.mp4`,

        duration,

        startSeconds,

        width:
          1080,

        height:
          1920,
      },
    });
  } catch (error) {
    console.error(
      "CUSTOMER_CREATE_SHORT_ERROR",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "Short video could not be created.";

    if (
      message ===
        "CUSTOMER_AUTH_REQUIRED"
    ) {
      return Response.json(
        {
          success:
            false,

          error:
            "Sign in to create a short.",
        },
        {
          status:
            401,
        }
      );
    }

    if (
      message ===
        "SCHEDULER_SUBSCRIPTION_REQUIRED"
    ) {
      return Response.json(
        {
          success:
            false,

          error:
            "An active Social Scheduler subscription is required.",
        },
        {
          status:
            403,
        }
      );
    }

    return Response.json(
      {
        success:
          false,

        error:
          message,
      },
      {
        status:
          500,
      }
    );
  } finally {
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
  }
}
