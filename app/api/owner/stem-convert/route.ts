import { NextResponse } from "next/server";
import {
  del,
  put,
} from "@vercel/blob";
import { getAuth } from "firebase-admin/auth";
import { spawn } from "child_process";
import {
  createReadStream,
  createWriteStream,
  existsSync,
} from "fs";
import { promises as fs } from "fs";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import os from "os";
import path from "path";
import crypto from "crypto";
import ffmpegStaticPath from "ffmpeg-static";

import {
  firebaseAdminApp,
} from "../../../../lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OWNER_EMAIL =
  "supe4.me@gmail.com";

const MAX_FILE_BYTES =
  250 * 1024 * 1024;

function getBearerToken(
  request: Request
) {
  const header =
    request.headers.get(
      "authorization"
    ) || "";

  return (
    header.match(
      /^Bearer\s+(.+)$/i
    )?.[1]?.trim() || null
  );
}

async function verifyOwner(
  request: Request
) {
  const token =
    getBearerToken(request);

  if (!token) {
    throw new Error(
      "OWNER_AUTH_REQUIRED"
    );
  }

  const decoded =
    await getAuth(
      firebaseAdminApp
    ).verifyIdToken(token);

  const email =
    decoded.email
      ?.trim()
      .toLowerCase() || "";

  if (
    email !== OWNER_EMAIL.toLowerCase()
  ) {
    throw new Error("OWNER_ONLY");
  }

  return decoded;
}

function safeBaseName(
  name: string
) {
  const parsed =
    path.parse(name);

  const clean =
    parsed.name
      .replace(
        /[<>:"/\\|?*\x00-\x1F]/g,
        "_"
      )
      .trim() || "stem";

  return clean.slice(0, 150);
}

function cleanMetadata(
  value: unknown
) {
  return String(value || "")
    .replace(
      /[\x00-\x1F\x7F]/g,
      " "
    )
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
}

function resolveFfmpegPath() {
  const localCandidate =
    path.join(
      process.cwd(),
      "node_modules",
      "ffmpeg-static",
      process.platform === "win32"
        ? "ffmpeg.exe"
        : "ffmpeg"
    );

  if (
    existsSync(localCandidate)
  ) {
    return localCandidate;
  }

  if (
    ffmpegStaticPath &&
    typeof ffmpegStaticPath ===
      "string"
  ) {
    return ffmpegStaticPath;
  }

  throw new Error(
    "FFMPEG_BINARY_NOT_AVAILABLE"
  );
}

function runFfmpeg(
  args: string[]
) {
  return new Promise<void>(
    (resolve, reject) => {
      let executable: string;

      try {
        executable =
          resolveFfmpegPath();
      } catch (error) {
        reject(error);
        return;
      }

      const child =
        spawn(
          executable,
          args,
          {
            windowsHide: true,
          }
        );

      let stderr = "";

      child.stderr.on(
        "data",
        chunk => {
          stderr +=
            chunk.toString();
        }
      );

      child.on(
        "error",
        reject
      );

      child.on(
        "close",
        code => {
          if (code === 0) {
            resolve();
            return;
          }

          reject(
            new Error(
              `FFMPEG_FAILED_${code}: ${stderr.slice(-4000)}`
            )
          );
        }
      );
    }
  );
}

function validateStemBlobUrl(
  value: unknown
) {
  const raw =
    String(value || "");

  let url: URL;

  try {
    url = new URL(raw);
  } catch {
    throw new Error(
      "INVALID_STEM_BLOB_URL"
    );
  }

  if (
    url.protocol !== "https:" ||
    !url.hostname.endsWith(
      ".public.blob.vercel-storage.com"
    ) ||
    !url.pathname.includes(
      "/solo-stem-input/"
    )
  ) {
    throw new Error(
      "INVALID_STEM_BLOB_URL"
    );
  }

  return url.toString();
}

export async function POST(
  request: Request
) {
  let inputPath:
    string | null = null;

  let outputPath:
    string | null = null;

  let inputBlobUrl:
    string | null = null;

  // SOLO_STEM_COVER_EMBED_V1
  let coverPath:
    string | null = null;

  let coverBlobUrl:
    string | null = null;

  try {
    await verifyOwner(request);

    const body =
      await request.json();

    inputBlobUrl =
      validateStemBlobUrl(
        body?.blobUrl
      );

    const originalName =
      String(
        body?.originalName ||
          "stem.audio"
      );

    const formatRaw =
      String(body?.format || "")
        .trim()
        .toLowerCase();

    const bitrateRaw =
      String(
        body?.bitrate || "320"
      ).trim();

    const flacCompressionRaw =
      String(
        body?.flacCompression ||
          "8"
      ).trim();

    const oggQualityRaw =
      String(
        body?.oggQuality || "7"
      ).trim();

    const metadataRaw =
      String(
        body?.metadata || "strip"
      )
        .trim()
        .toLowerCase();

    const stripMetadata =
      metadataRaw !== "preserve";

    const metadataTitle =
      cleanMetadata(
        body?.metadataTitle
      );

    const metadataArtist =
      cleanMetadata(
        body?.metadataArtist
      );

    const metadataAlbum =
      cleanMetadata(
        body?.metadataAlbum
      );

    coverBlobUrl =
      String(
        body?.coverUrl || ""
      ).trim();

    if (coverBlobUrl) {

      let parsedCoverUrl: URL;

      try {
        parsedCoverUrl =
          new URL(
            coverBlobUrl
          );
      } catch {
        throw new Error(
          "INVALID_COVER_URL"
        );
      }

      if (
        parsedCoverUrl.protocol !== "https:" ||
        !parsedCoverUrl.hostname.endsWith(
          ".public.blob.vercel-storage.com"
        ) ||
        !parsedCoverUrl.pathname.includes(
          "/solo-stem-cover/"
        )
      ) {
        throw new Error(
          "INVALID_COVER_URL"
        );
      }
    }

    const allowedFormats =
      new Set([
        "mp3",
        "wav",
        "flac",
        "m4a",
        "aac",
        "ogg",
      ]);

    if (
      !allowedFormats.has(
        formatRaw
      )
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "FORMAT_NOT_SUPPORTED",
        },
        {
          status: 400,
        }
      );
    }

    const id =
      crypto.randomUUID();

    const originalExtension =
      path.extname(
        originalName
      ) || ".audio";

    const inputExtension =
      originalExtension
        .replace(".", "")
        .trim()
        .toLowerCase();

    const isWavToWav =
      inputExtension === "wav" &&
      formatRaw === "wav";

    const base =
      safeBaseName(
        originalName
      );

    inputPath =
      path.join(
        os.tmpdir(),
        `solo-stem-input-${id}${originalExtension}`
      );

    outputPath =
      path.join(
        os.tmpdir(),
        `solo-stem-output-${id}.${formatRaw}`
      );

    const source =
      await fetch(
        inputBlobUrl,
        {
          cache: "no-store",
        }
      );

    if (
      !source.ok ||
      !source.body
    ) {
      throw new Error(
        `STEM_BLOB_DOWNLOAD_FAILED_${source.status}`
      );
    }

    const declaredSize =
      Number(
        source.headers.get(
          "content-length"
        ) || "0"
      );

    if (
      declaredSize >
      MAX_FILE_BYTES
    ) {
      throw new Error(
        "FILE_TOO_LARGE"
      );
    }

    await pipeline(
      Readable.fromWeb(
        source.body as any
      ),
      createWriteStream(
        inputPath
      )
    );

    const stat =
      await fs.stat(
        inputPath
      );

    if (
      stat.size <= 0
    ) {
      throw new Error(
        "EMPTY_AUDIO_FILE"
      );
    }

    if (
      stat.size >
      MAX_FILE_BYTES
    ) {
      throw new Error(
        "FILE_TOO_LARGE"
      );
    }

    if (
      coverBlobUrl &&
      (
        formatRaw === "mp3" ||
        formatRaw === "m4a"
      )
    ) {

      const coverExtension =
        path.extname(
          new URL(
            coverBlobUrl
          ).pathname
        ) || ".jpg";

      coverPath =
        path.join(
          os.tmpdir(),
          `solo-stem-cover-${id}${coverExtension}`
        );

      const coverResponse =
        await fetch(
          coverBlobUrl,
          {
            cache: "no-store",
          }
        );

      if (
        !coverResponse.ok ||
        !coverResponse.body
      ) {
        throw new Error(
          `COVER_DOWNLOAD_FAILED_${coverResponse.status}`
        );
      }

      await pipeline(
        Readable.fromWeb(
          coverResponse.body as any
        ),
        createWriteStream(
          coverPath
        )
      );
    }

    const args:
      string[] = [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        inputPath,
      ];

    if (coverPath) {
      args.push(
        "-i",
        coverPath
      );
    }

    if (stripMetadata) {
      args.push(
        "-map_metadata",
        "-1"
      );
    }

    if (metadataTitle) {
      args.push(
        "-metadata",
        `title=${metadataTitle}`
      );
    }

    if (metadataArtist) {
      args.push(
        "-metadata",
        `artist=${metadataArtist}`
      );
    }

    if (metadataAlbum) {
      args.push(
        "-metadata",
        `album=${metadataAlbum}`
      );
    }

    if (!coverPath) {
      args.push("-vn");
    }

    const validBitrates =
      new Set([
        "128",
        "160",
        "192",
        "256",
        "320",
      ]);

    const bitrate =
      validBitrates.has(
        bitrateRaw
      )
        ? bitrateRaw
        : "320";

    const validFlacCompression =
      new Set([
        "0",
        "5",
        "8",
        "12",
      ]);

    const flacCompression =
      validFlacCompression.has(
        flacCompressionRaw
      )
        ? flacCompressionRaw
        : "8";

    const validOggQuality =
      new Set([
        "3",
        "5",
        "7",
        "10",
      ]);

    const oggQuality =
      validOggQuality.has(
        oggQualityRaw
      )
        ? oggQualityRaw
        : "7";

    if (
      formatRaw === "mp3"
    ) {

      if (coverPath) {
        args.push(
          "-map",
          "0:a:0",
          "-map",
          "1:v:0",
          "-codec:v",
          "mjpeg",
          "-disposition:v",
          "attached_pic",
          "-metadata:s:v",
          "title=Album cover",
          "-metadata:s:v",
          "comment=Cover (front)"
        );
      }

      args.push(
        "-codec:a",
        "libmp3lame",
        "-b:a",
        `${bitrate}k`,
        "-ar",
        "44100",
        outputPath
      );
    } else if (
      formatRaw === "wav"
    ) {
      if (isWavToWav) {
        args.push(
          "-map",
          "0:a:0",
          "-codec:a",
          "pcm_s24le",
          "-ar",
          "44100",
          "-ac",
          "2",
          "-f",
          "wav",
          outputPath
        );
      } else {
        args.push(
          "-codec:a",
          "pcm_s24le",
          "-ar",
          "44100",
          "-f",
          "wav",
          outputPath
        );
      }
    } else if (
      formatRaw === "flac"
    ) {
      args.push(
        "-codec:a",
        "flac",
        "-compression_level",
        flacCompression,
        "-ar",
        "44100",
        outputPath
      );
    } else if (
      formatRaw === "m4a"
    ) {

      if (coverPath) {
        args.push(
          "-map",
          "0:a:0",
          "-map",
          "1:v:0",
          "-codec:v",
          "mjpeg",
          "-disposition:v",
          "attached_pic"
        );
      }

      args.push(
        "-codec:a",
        "aac",
        "-b:a",
        `${bitrate}k`,
        "-ar",
        "44100",
        outputPath
      );
    } else if (
      formatRaw === "aac"
    ) {
      args.push(
        "-codec:a",
        "aac",
        "-b:a",
        `${bitrate}k`,
        "-ar",
        "44100",
        "-f",
        "adts",
        outputPath
      );
    } else if (
      formatRaw === "ogg"
    ) {
      args.push(
        "-codec:a",
        "libvorbis",
        "-q:a",
        oggQuality,
        "-ar",
        "44100",
        outputPath
      );
    }

    await runFfmpeg(args);

    const outputName =
      `${base}.${formatRaw}`;

    const blob =
      await put(
        `solo-stem-output/${outputName}`,
        createReadStream(
          outputPath
        ),
        {
          access: "public",
          addRandomSuffix: true,
          multipart: true,
        }
      );

    return NextResponse.json({
      ok: true,
      url: blob.url,
      outputName,
      originalName,
      format: formatRaw,
      conversion:
        isWavToWav
          ? "WAV_TO_WAV"
          : "STANDARD",
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : String(error);

    console.error(
      "OWNER STEM CONVERT ERROR:",
      error
    );

    const authError =
      message ===
        "OWNER_AUTH_REQUIRED" ||
      message ===
        "OWNER_ONLY";

    const tooLarge =
      message ===
        "FILE_TOO_LARGE";

    return NextResponse.json(
      {
        ok: false,
        error: message,
        maxMb: tooLarge
          ? 250
          : undefined,
      },
      {
        status: authError
          ? 403
          : tooLarge
          ? 413
          : 500,
      }
    );
  } finally {
    if (inputPath) {
      await fs.unlink(
        inputPath
      ).catch(() => {});
    }

    if (coverPath) {
      await fs.unlink(
        coverPath
      ).catch(() => {});
    }

    if (outputPath) {
      await fs.unlink(
        outputPath
      ).catch(() => {});
    }

    if (inputBlobUrl) {
      await del(
        inputBlobUrl
      ).catch(() => {});
    }
  }
}

export async function GET(
  request: Request
) {
  try {
    await verifyOwner(request);

    return NextResponse.json({
      ok: true,
      service:
        "SOLO BEATS OWNER STEM CONVERTER",
      ownerOnly: true,
      encoder: "FFmpeg",
      transport:
        "VERCEL BLOB DIRECT",
      formats: {
        input: [
          "wav",
          "mp3",
          "flac",
          "aac",
          "m4a",
          "ogg",
          "other FFmpeg-supported audio",
        ],
        output: [
          "wav",
          "mp3",
          "flac",
          "m4a",
          "aac",
          "ogg",
        ],
      },
      mp3Bitrates: [
        128,
        160,
        192,
        256,
        320,
      ],
      wav:
        "24-bit PCM / 44.1 kHz",
      maxFileMb: 250,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : String(error);

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      {
        status: 403,
      }
    );
  }
}


