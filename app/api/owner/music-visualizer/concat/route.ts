import { spawn } from "child_process";
import { promises as fs } from "fs";
import os from "os";
import path from "path";

import {
  adminBucket,
} from "../../../../../lib/firebaseAdmin";

import {
  completeVisualizerReservation,
  requireVisualizerRenderAccess,
  refundVisualizerReservation,
  type VisualizerRenderAccess,
} from "../../../../../lib/visualizerRenderAccess";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type ConcatBody = {
  sessionId?: string;
  chunkPaths?: string[];
  title?: string;
  reservationId?: string;
};

function clean(
  value: unknown,
  max = 300
) {
  return String(
    value || ""
  )
    .trim()
    .slice(
      0,
      max
    );
}

function safeName(
  value: string
) {
  const safe =
    value
      .replace(
        /[^a-zA-Z0-9_-]+/g,
        "-"
      )
      .replace(
        /-+/g,
        "-"
      )
      .replace(
        /^-|-$/g,
        ""
      );

  return (
    safe ||
    "visualizer"
  ).slice(
    0,
    100
  );
}

async function resolveFfmpegPath() {
  const candidates = [
    process.env.FFMPEG_PATH,

    path.join(
      process.cwd(),
      "node_modules",
      "ffmpeg-static",
      process.platform === "win32"
        ? "ffmpeg.exe"
        : "ffmpeg"
    ),
  ].filter(
    Boolean
  ) as string[];

  for (
    const candidate of candidates
  ) {
    try {
      await fs.access(
        candidate
      );

      return candidate;
    }
    catch {}
  }

  throw new Error(
    "FFMPEG_BINARY_NOT_FOUND"
  );
}

/*
 * Streams FFmpeg output directly into Firebase Storage.
 *
 * This avoids creating another full final.mp4 inside /tmp.
 * That is especially important for 4-5 minute visualizers.
 */
async function runFfmpegToFirebase(
  args: string[],
  destination: string
) {
  const ffmpegPath =
    await resolveFfmpegPath();

  const targetFile =
    adminBucket.file(
      destination
    );

  await new Promise<void>(
    (
      resolve,
      reject
    ) => {
      const child =
        spawn(
          ffmpegPath,
          args,
          {
            stdio: [
              "ignore",
              "pipe",
              "pipe",
            ],

            windowsHide:
              true,
          }
        );

      const upload =
        targetFile.createWriteStream({
          resumable: false,

          metadata: {
            contentType:
              "video/mp4",

            cacheControl:
              "private,max-age=0,no-store",
          },
        });

      let stderr = "";
      let processDone = false;
      let uploadDone = false;
      let failed = false;

      const fail = (
        error: Error
      ) => {
        if (
          failed
        ) {
          return;
        }

        failed = true;

        try {
          child.kill(
            "SIGKILL"
          );
        }
        catch {}

        try {
          upload.destroy();
        }
        catch {}

        reject(
          error
        );
      };

      const maybeResolve =
        () => {
          if (
            !failed &&
            processDone &&
            uploadDone
          ) {
            resolve();
          }
        };

      child.stderr.on(
        "data",
        data => {
          stderr +=
            data.toString();

          if (
            stderr.length >
            20000
          ) {
            stderr =
              stderr.slice(
                -20000
              );
          }
        }
      );

      child.on(
        "error",
        error => {
          fail(
            error
          );
        }
      );

      child.on(
        "close",
        code => {
          if (
            code !== 0
          ) {
            fail(
              new Error(
                [
                  "FFMPEG_CONCAT_FAILED",
                  "",
                  stderr.slice(
                    -12000
                  ),
                ].join(
                  "\n"
                )
              )
            );

            return;
          }

          processDone =
            true;

          maybeResolve();
        }
      );

      upload.on(
        "error",
        error => {
          fail(
            error
          );
        }
      );

      upload.on(
        "finish",
        () => {
          uploadDone =
            true;

          maybeResolve();
        }
      );

      if (
        !child.stdout
      ) {
        fail(
          new Error(
            "FFMPEG_STDOUT_UNAVAILABLE"
          )
        );

        return;
      }

      child.stdout.pipe(
        upload
      );
    }
  );
}

export async function POST(
  request: Request
) {
  let renderAccess:
    VisualizerRenderAccess | null =
    null;

  const tempDir =
    await fs.mkdtemp(
      path.join(
        os.tmpdir(),
        "solo-visualizer-concat-"
      )
    );

  try {
    const body =
      await request.json() as ConcatBody;

    renderAccess =
      await requireVisualizerRenderAccess(
        request,
        body.reservationId
      );

    const sessionId =
      clean(
        body.sessionId,
        120
      ).replace(
        /[^a-zA-Z0-9_-]/g,
        ""
      );

    const title =
      clean(
        body.title,
        200
      ) ||
      "Solo Beats Visualizer";

    const chunkPaths =
      Array.isArray(
        body.chunkPaths
      )
        ? body.chunkPaths
            .map(
              item =>
                clean(
                  item,
                  1000
                )
            )
            .filter(
              Boolean
            )
        : [];

    if (
      !sessionId ||
      chunkPaths.length < 1 ||
      chunkPaths.length > 20
    ) {
      return Response.json(
        {
          success: false,
          error:
            "INVALID_CHUNK_SESSION",
        },
        {
          status: 400,
        }
      );
    }

    const requiredPrefix =
      `owner/music-visualizer/chunks/${sessionId}/`;

    for (
      const chunkPath of chunkPaths
    ) {
      if (
        !chunkPath.startsWith(
          requiredPrefix
        )
      ) {
        return Response.json(
          {
            success: false,
            error:
              "INVALID_CHUNK_PATH",
          },
          {
            status: 400,
          }
        );
      }
    }

    const localChunks: string[] =
      [];

    for (
      let index = 0;
      index <
      chunkPaths.length;
      index += 1
    ) {
      const localPath =
        path.join(
          tempDir,
          `chunk-${String(
            index
          ).padStart(
            3,
            "0"
          )}.mp4`
        );

      await adminBucket
        .file(
          chunkPaths[
            index
          ]
        )
        .download({
          destination:
            localPath,
        });

      localChunks.push(
        localPath
      );
    }

    const concatListPath =
      path.join(
        tempDir,
        "concat.txt"
      );

    const concatList =
      localChunks
        .map(
          localPath =>
            `file '${localPath.replace(
              /'/g,
              "'\\''"
            )}'`
        )
        .join(
          "\n"
        );

    await fs.writeFile(
      concatListPath,
      concatList,
      "utf8"
    );

    const finalStoragePath =
      `owner/music-visualizer/exports/${sessionId}/${safeName(
        title
      )}.mp4`;

    /*
     * FAST PATH
     *
     * Keep the original no-reencode behavior,
     * but send the MP4 directly to Firebase
     * instead of creating final.mp4 in /tmp.
     */
    try {
      console.log(
        "VISUALIZER CONCAT FAST PATH",
        {
          sessionId,
          chunks:
            chunkPaths.length,
        }
      );

      await runFfmpegToFirebase(
        [
          "-y",

          "-f",
          "concat",

          "-safe",
          "0",

          "-i",
          concatListPath,

          "-map",
          "0:v:0",

          "-map",
          "0:a?",

          "-c",
          "copy",

          "-movflags",
          "+frag_keyframe+empty_moov+default_base_moof",

          "-f",
          "mp4",

          "pipe:1",
        ],
        finalStoragePath
      );
    }
    catch (
      fastError
    ) {
      console.warn(
        "VISUALIZER FAST CONCAT FAILED - USING NORMALIZED FALLBACK",
        fastError
      );

      /*
       * Remove any partial cloud object created
       * by the failed fast attempt.
       */
      await adminBucket
        .file(
          finalStoragePath
        )
        .delete({
          ignoreNotFound:
            true,
        })
        .catch(
          () => {}
        );

      /*
       * FALLBACK
       *
       * Decode and normalize timestamps/streams.
       * This is only used when direct stream-copy
       * joining fails.
       */
      await runFfmpegToFirebase(
        [
          "-y",

          "-fflags",
          "+genpts",

          "-f",
          "concat",

          "-safe",
          "0",

          "-i",
          concatListPath,

          "-map",
          "0:v:0",

          "-map",
          "0:a?",

          "-c:v",
          "libx264",

          "-preset",
          "ultrafast",

          "-crf",
          "23",

          "-pix_fmt",
          "yuv420p",

          "-c:a",
          "aac",

          "-b:a",
          "192k",

          "-avoid_negative_ts",
          "make_zero",

          "-movflags",
          "+frag_keyframe+empty_moov+default_base_moof",

          "-f",
          "mp4",

          "pipe:1",
        ],
        finalStoragePath
      );
    }

    const finalFile =
      adminBucket.file(
        finalStoragePath
      );

    const [
      downloadUrl,
    ] =
      await finalFile.getSignedUrl(
        {
          action: "read",

          expires:
            Date.now() +
            7 *
            24 *
            60 *
            60 *
            1000,
        }
      );

      // SOLO_BEATS_MP4_ATTACHMENT_FIX_V1
      const [downloadAttachmentUrl] = await finalFile.getSignedUrl({
        action: "read",
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
        responseDisposition: `attachment; filename="${safeName(title)}-visualizer.mp4"`,
      });


    await Promise.all(
      chunkPaths.map(
        chunkPath =>
          adminBucket
            .file(
              chunkPath
            )
            .delete({
              ignoreNotFound:
                true,
            })
            .catch(
              () => {}
            )
      )
    );

    console.log(
      "VISUALIZER CHUNKS JOINED",
      {
        sessionId,
        chunks:
          chunkPaths.length,
        finalStoragePath,
        streamedDirectly:
          true,
      }
    );

    if (renderAccess) {
      await completeVisualizerReservation(
        renderAccess
      );
    }

    return Response.json(
      {
        success: true,
        downloadUrl,
        downloadAttachmentUrl,
        storagePath:
          finalStoragePath,
      }
    );
  }
  catch (error) {
    console.error(
      "VISUALIZER CONCAT ERROR:",
      error
    );

    if (renderAccess) {
      await refundVisualizerReservation(
        renderAccess,
        error instanceof Error
          ? error.message
          : "VISUALIZER_CONCAT_FAILED"
      ).catch(() => {});
    }

    return Response.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "VISUALIZER_CONCAT_FAILED",
      },
      {
        status: 500,
      }
    );
  }
  finally {
    await fs.rm(
      tempDir,
      {
        recursive: true,
        force: true,
      }
    ).catch(
      () => {}
    );
  }
}