import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";

import {
  spawn,
} from "child_process";

import {
  randomUUID,
} from "crypto";

import {
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "fs/promises";

import {
  tmpdir,
} from "os";

import {
  join,
} from "path";

import {
  adminBucket,
  adminDb,
  firebaseAdminApp,
} from "../../../../../lib/firebaseAdmin";

const OWNER_EMAIL = "supe4.me@gmail.com";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function bearer(
  request: Request
) {
  const value =
    request.headers.get(
      "authorization"
    ) || "";

  return (
    value.match(
      /^Bearer\s+(.+)$/i
    )?.[1]?.trim() || null
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

  const decoded =
    await getAuth(
      firebaseAdminApp
    ).verifyIdToken(token);

  if (
    decoded.email?.toLowerCase() !==
    OWNER_EMAIL.toLowerCase()
  ) {
    throw new Error(
      "OWNER_ACCESS_ONLY"
    );
  }

  return decoded;
}

function clean(
  value: unknown,
  max = 500
) {
  if (
    typeof value !== "string"
  ) {
    return "";
  }

  return value
    .replace(/\0/g, "")
    .trim()
    .slice(0, max);
}

function authResponse(
  error: unknown
) {
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

  return null;
}

async function runFfmpeg(
  args: string[]
) {
  const ffmpegPath =
    process.env.FFMPEG_PATH ||
    "ffmpeg";

  await new Promise<void>(
    (
      resolve,
      reject
    ) => {
      const process =
        spawn(
          ffmpegPath,
          args,
          {
            windowsHide: true,
          }
        );

      let errorText = "";

      process.stderr.on(
        "data",
        (chunk) => {
          errorText +=
            String(chunk);
        }
      );

      process.on(
        "error",
        (error) => {
          reject(
            new Error(
              `FFmpeg could not start: ${error.message}`
            )
          );
        }
      );

      process.on(
        "close",
        (code) => {
          if (code === 0) {
            resolve();
            return;
          }

          reject(
            new Error(
              "FFmpeg merge failed. " +
                errorText.slice(
                  -2500
                )
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
  let workDirectory:
    | string
    | null = null;

  try {
    await verifyOwner(
      request
    );

    const body =
      (await request.json()) as {
        jobId?: unknown;
        audioMediaId?: unknown;
        videoMediaId?: unknown;
        volume?: unknown;
        musicStart?: unknown;
        loopMusic?: unknown;
      };

    const jobId =
      clean(
        body.jobId,
        150
      );

    const audioMediaId =
      clean(
        body.audioMediaId,
        150
      );

    const videoMediaId =
      clean(
        body.videoMediaId,
        150
      );

    if (!jobId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "AI video job ID is required.",
        },
        { status: 400 }
      );
    }

    if (!audioMediaId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Choose a music track first.",
        },
        { status: 400 }
      );
    }

    const volumeNumber =
      Number(
        body.volume
      );

    const volume =
      Number.isFinite(
        volumeNumber
      )
        ? Math.max(
            0,
            Math.min(
              2,
              volumeNumber
            )
          )
        : 1;

    const musicStartNumber =
      Number(
        body.musicStart
      );

    const musicStart =
      Number.isFinite(
        musicStartNumber
      )
        ? Math.max(
            0,
            musicStartNumber
          )
        : 0;

    const loopMusic =
      body.loopMusic !== false;

    const jobReference =
      adminDb
        .collection(
          "aiVideoJobs"
        )
        .doc(jobId);

    const jobSnapshot =
      await jobReference.get();

    if (
      !jobSnapshot.exists
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "AI video job was not found.",
        },
        { status: 404 }
      );
    }

    const job =
      jobSnapshot.data() || {};

    if (
      job.status !==
      "completed"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "The AI video must be completed first.",
        },
        { status: 400 }
      );
    }

    const outputUrl =
      typeof job.outputUrl ===
        "string"
        ? job.outputUrl.trim()
        : "";

    if (
      !outputUrl &&
      !videoMediaId
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "The completed AI video does not have a usable video source.",
        },
        { status: 400 }
      );
    }

    const audioReference =
      adminDb
        .collection(
          "mediaLibrary"
        )
        .doc(
          audioMediaId
        );

    const audioSnapshot =
      await audioReference.get();

    if (
      !audioSnapshot.exists
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "The selected music track was not found.",
        },
        { status: 404 }
      );
    }

    const audio =
      audioSnapshot.data() ||
      {};

    if (
      audio.kind !== "audio"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "The selected Media Library item is not audio.",
        },
        { status: 400 }
      );
    }

    const audioStoragePath =
      typeof audio.storagePath ===
        "string"
        ? audio.storagePath
        : "";

    if (
      !audioStoragePath
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "The selected music track has no Storage file.",
        },
        { status: 400 }
      );
    }

    const audioFile =
      adminBucket.file(
        audioStoragePath
      );

    const [audioExists] =
      await audioFile.exists();

    if (!audioExists) {
      return NextResponse.json(
        {
          success: false,
          error:
            "The selected music file is missing from Firebase Storage.",
        },
        { status: 400 }
      );
    }

    let videoBuffer:
      Buffer | null = null;

    if (videoMediaId) {
      const savedVideoReference =
        adminDb
          .collection(
            "mediaLibrary"
          )
          .doc(
            videoMediaId
          );

      const savedVideoSnapshot =
        await savedVideoReference.get();

      if (savedVideoSnapshot.exists) {
        const savedVideo =
          savedVideoSnapshot.data() ||
          {};

        const savedVideoStoragePath =
          typeof savedVideo.storagePath ===
            "string"
            ? savedVideo.storagePath.trim()
            : "";

        if (
          savedVideo.kind === "video" &&
          savedVideoStoragePath
        ) {
          const savedVideoFile =
            adminBucket.file(
              savedVideoStoragePath
            );

          const [savedVideoExists] =
            await savedVideoFile.exists();

          if (savedVideoExists) {
            const [
              savedVideoBuffer,
            ] =
              await savedVideoFile.download();

            videoBuffer =
              savedVideoBuffer;
          }
        }
      }
    }

    if (
      !videoBuffer &&
      outputUrl
    ) {
      const videoResponse =
        await fetch(
          outputUrl,
          {
            cache:
              "no-store",
          }
        );

      if (
        !videoResponse.ok
      ) {
        throw new Error(
          `AI video download failed with status ${videoResponse.status}.`
        );
      }

      videoBuffer =
        Buffer.from(
          await videoResponse.arrayBuffer()
        );
    }

    if (!videoBuffer) {
      throw new Error(
        "The AI video could not be loaded from Firebase Storage or the provider."
      );
    }

    const [
      audioBuffer,
    ] =
      await audioFile.download();

    workDirectory =
      await mkdtemp(
        join(
          tmpdir(),
          "solo-beats-ai-music-"
        )
      );

    const inputVideo =
      join(
        workDirectory,
        "input.mp4"
      );

    const audioExtension =
      typeof audio.extension ===
        "string" &&
      audio.extension
        ? audio.extension
        : "mp3";

    const inputAudio =
      join(
        workDirectory,
        `music.${audioExtension}`
      );

    const outputVideo =
      join(
        workDirectory,
        "output.mp4"
      );

    await writeFile(
      inputVideo,
      videoBuffer
    );

    await writeFile(
      inputAudio,
      audioBuffer
    );

    const args: string[] =
      [
        "-y",
        "-i",
        inputVideo,
      ];

    if (loopMusic) {
      args.push(
        "-stream_loop",
        "-1"
      );
    }

    if (
      musicStart > 0
    ) {
      args.push(
        "-ss",
        String(
          musicStart
        )
      );
    }

    args.push(
      "-i",
      inputAudio,

      "-map",
      "0:v:0",

      "-map",
      "1:a:0",

      "-c:v",
      "copy",

      "-c:a",
      "aac",

      "-b:a",
      "192k",

      "-af",
      `volume=${volume}`,

      "-shortest",

      "-movflags",
      "+faststart",

      outputVideo
    );

    await runFfmpeg(
      args
    );

    const mergedBuffer =
      await readFile(
        outputVideo
      );

    if (
      !mergedBuffer.length
    ) {
      throw new Error(
        "FFmpeg produced an empty video."
      );
    }

    const mediaReference =
      adminDb
        .collection(
          "mediaLibrary"
        )
        .doc();

    const mediaId =
      mediaReference.id;

    const fileName =
      `ai-music-video-${randomUUID()}.mp4`;

    const storagePath =
      `media/video/${mediaId}/${fileName}`;

    const storageFile =
      adminBucket.file(
        storagePath
      );

    await storageFile.save(
      mergedBuffer,
      {
        resumable: false,
        metadata: {
          contentType:
            "video/mp4",
          metadata: {
            source:
              "solo-beats-ai-video-music",
            aiVideoJobId:
              jobId,
            audioMediaId,
          },
        },
      }
    );

    const [
      previewUrl,
    ] =
      await storageFile.getSignedUrl(
        {
          action: "read",
          expires:
            Date.now() +
            60 *
              60 *
              1000,
        }
      );

    const audioTitle =
      typeof audio.title ===
        "string"
        ? audio.title
        : typeof audio.originalName ===
            "string"
          ? audio.originalName
          : "SOLO BEATS Track";

    const prompt =
      typeof job.prompt ===
        "string"
        ? job.prompt
        : "";

    await mediaReference.set(
      {
        kind:
          "video",

        title:
          `AI Music Video - ${audioTitle}`.slice(
            0,
            200
          ),

        description:
          prompt
            ? `AI-generated music video. Visual prompt: ${prompt}`.slice(
                0,
                2000
              )
            : "AI-generated SOLO BEATS music video.",

        sourceType:
          "solo-beats",

        originalName:
          fileName,

        mimeType:
          "video/mp4",

        extension:
          "mp4",

        sizeBytes:
          mergedBuffer.length,

        storagePath,

        status:
          "active",

        published:
          false,

        homepageEnabled:
          false,

        premiumTvEnabled:
          false,

        featured:
          false,

        displayOrder:
          0,

        tvScheduleStart:
          null,

        tvScheduleEnd:
          null,

        aiGenerated:
          true,

        aiMusicVideo:
          true,

        aiVideoJobId:
          jobId,

        audioMediaId,

        audioTitle,

        musicVolume:
          volume,

        musicStart,

        loopMusic,

        createdAt:
          FieldValue.serverTimestamp(),

        updatedAt:
          FieldValue.serverTimestamp(),
      }
    );

    await jobReference.set(
      {
        musicVideoMediaId:
          mediaId,

        musicVideoStoragePath:
          storagePath,

        musicVideoAudioMediaId:
          audioMediaId,

        musicVideoCreatedAt:
          FieldValue.serverTimestamp(),

        updatedAt:
          FieldValue.serverTimestamp(),
      },
      {
        merge: true,
      }
    );

    return NextResponse.json(
      {
        success: true,
        mediaId,
        storagePath,
        previewUrl,
        audioTitle,
        sizeBytes:
          mergedBuffer.length,
        message:
          "Music was added to the AI video successfully.",
      }
    );
  } catch (error) {
    const auth =
      authResponse(error);

    if (auth) {
      return auth;
    }

    console.error(
      "AI video add music error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Music could not be added to the AI video.",
      },
      {
        status: 500,
      }
    );
  } finally {
    if (
      workDirectory
    ) {
      try {
        await rm(
          workDirectory,
          {
            recursive: true,
            force: true,
          }
        );
      } catch (
        cleanupError
      ) {
        console.error(
          "AI music temp cleanup warning:",
          cleanupError
        );
      }
    }
  }
}



