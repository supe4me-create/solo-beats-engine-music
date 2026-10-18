import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";

import {
  adminBucket,
  adminDb,
  firebaseAdminApp,
} from "../../../../../lib/firebaseAdmin";

import { spawn } from "child_process";
import {
  createReadStream,
  existsSync,
} from "fs";
import { promises as fs } from "fs";
import { pipeline } from "stream/promises";
import os from "os";
import path from "path";
import crypto from "crypto";
import ffmpegStaticPath from "ffmpeg-static";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const OWNER_EMAIL =
  "supe4.me@gmail.com";

const AUTO_ENGINE_VERSION =
  "AUTO_MIX_MASTER_V1";

const AUTO_MASTER_ENGINE_VERSION =
  "AUTO_MASTER_V1";

type OrderStem = {
  name?: string;
  originalName?: string;
  storagePath?: string;
  sizeBytes?: number;
  contentType?: string;
  type?: string;
};

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
    email !==
    OWNER_EMAIL.toLowerCase()
  ) {
    throw new Error(
      "OWNER_ONLY"
    );
  }

  return decoded;
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
      const executable =
        resolveFfmpegPath();

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
              `FFMPEG_AUTO_MASTER_FAILED_${code}: ${stderr.slice(
                -6000
              )}`
            )
          );
        }
      );
    }
  );
}

function detectRole(
  value: string
) {
  const name =
    value.toLowerCase();

  if (
    /lead.?vocal|main.?vocal|vocals?|vox|voice/.test(
      name
    )
  ) {
    return "VOCAL";
  }

  if (
    /kick/.test(name)
  ) {
    return "KICK";
  }

  if (
    /bass|sub/.test(name)
  ) {
    return "BASS";
  }

  if (
    /drum|snare|hat|hihat|perc|clap|tom|cymbal/.test(
      name
    )
  ) {
    return "DRUMS";
  }

  if (
    /guitar|piano|keys|keyboard|synth|pad|strings|organ|instrumental|music|beat/.test(
      name
    )
  ) {
    return "MUSIC";
  }

  if (
    /fx|effect|ambience|ambient|risers?|sweep|noise/.test(
      name
    )
  ) {
    return "FX";
  }

  return "GENERAL";
}

function roleFilter(
  role: string
) {
  if (role === "VOCAL") {
    return [
      "highpass=f=80",
      "lowpass=f=18000",
      "equalizer=f=250:t=q:w=1:g=-1.5",
      "equalizer=f=3500:t=q:w=1:g=1.5",
      "acompressor=threshold=-18dB:ratio=3:attack=15:release=180",
      "volume=1.0",
    ].join(",");
  }

  if (role === "KICK") {
    return [
      "highpass=f=25",
      "lowpass=f=12000",
      "equalizer=f=70:t=q:w=1:g=1.5",
      "equalizer=f=300:t=q:w=1:g=-1",
      "acompressor=threshold=-15dB:ratio=2.5:attack=15:release=150",
      "volume=0.92",
    ].join(",");
  }

  if (role === "BASS") {
    return [
      "highpass=f=25",
      "lowpass=f=9000",
      "equalizer=f=90:t=q:w=1:g=1",
      "equalizer=f=250:t=q:w=1:g=-1",
      "acompressor=threshold=-16dB:ratio=3:attack=25:release=220",
      "volume=0.90",
    ].join(",");
  }

  if (role === "DRUMS") {
    return [
      "highpass=f=30",
      "lowpass=f=19000",
      "acompressor=threshold=-14dB:ratio=2:attack=10:release=130",
      "volume=0.90",
    ].join(",");
  }

  if (role === "MUSIC") {
    return [
      "highpass=f=40",
      "lowpass=f=19000",
      "acompressor=threshold=-16dB:ratio=1.7:attack=25:release=200",
      "volume=0.82",
    ].join(",");
  }

  if (role === "FX") {
    return [
      "highpass=f=60",
      "lowpass=f=18000",
      "acompressor=threshold=-18dB:ratio=1.5:attack=30:release=250",
      "volume=0.72",
    ].join(",");
  }

  return [
    "highpass=f=35",
    "lowpass=f=19000",
    "acompressor=threshold=-17dB:ratio=1.8:attack=25:release=200",
    "volume=0.82",
  ].join(",");
}

async function uploadLocalFile(
  localPath: string,
  storagePath: string,
  contentType: string
) {
  const destination =
    adminBucket.file(
      storagePath
    );

  await pipeline(
    createReadStream(
      localPath
    ),
    destination.createWriteStream({
      resumable: false,
      metadata: {
        contentType,
      },
    })
  );

  const stat =
    await fs.stat(
      localPath
    );

  return {
    storagePath,
    sizeBytes:
      stat.size,
    contentType,
  };
}

export async function POST(
  request: Request
) {
  let wavPath:
    string | null = null;

  let mp3Path:
    string | null = null;

  let orderId =
    "";

  try {
    await verifyOwner(
      request
    );

    const body =
      await request.json();

    orderId =
      String(
        body?.orderId || ""
      ).trim();

    if (!orderId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "ORDER_ID_REQUIRED",
        },
        {
          status: 400,
        }
      );
    }

    const orderRef =
      adminDb
        .collection(
          "mixMasteringOrders"
        )
        .doc(orderId);

    const snapshot =
      await orderRef.get();

    if (!snapshot.exists) {
      return NextResponse.json(
        {
          success: false,
          error:
            "ORDER_NOT_FOUND",
        },
        {
          status: 404,
        }
      );
    }

    const order =
      snapshot.data() || {};

    if (
      order.ownerDirect !== true &&
      order.paymentStatus !== "PAID"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "CUSTOMER_PAYMENT_REQUIRED",
        },
        {
          status: 402,
        }
      );
    }

    const serviceType =
      String(
        order.serviceType ||
        order.orderType ||
        "MIX_MASTER"
      );

    const isMasterOnly =
      serviceType ===
      "MASTER_ONLY";

    const engineVersion =
      isMasterOnly
        ? AUTO_MASTER_ENGINE_VERSION
        : AUTO_ENGINE_VERSION;

    if (
      order.uploadComplete !==
      true
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "ORDER_UPLOAD_NOT_COMPLETE",
        },
        {
          status: 409,
        }
      );
    }

    const stems =
      Array.isArray(
        order.stems
      )
        ? (
            order.stems as
              OrderStem[]
          )
        : [];

    if (
      isMasterOnly &&
      stems.length !== 1
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "MASTER_ONLY_REQUIRES_ONE_STEREO_FILE",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !isMasterOnly &&
      (
        stems.length < 1 ||
        stems.length > 20
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "INVALID_STEM_COUNT",
        },
        {
          status: 400,
        }
      );
    }

    const startedAt =
      new Date()
        .toISOString();

    await orderRef.set(
      {
        processingStatus:
          "AUTO_PROCESSING",

        status:
          "AUTO_PROCESSING",

        autoMixMaster: {
          version:
            engineVersion,

          state:
            "PROCESSING",

          startedAt,

          targetLufs:
            -12,

          truePeakDb:
            -1,

          stemCount:
            stems.length,
        },

        updatedAt:
          startedAt,
      },
      {
        merge: true,
      }
    );

    const inputUrls:
      string[] = [];

    const recipe =
      [];

    for (
      let index = 0;
      index <
      stems.length;
      index += 1
    ) {
      const stem =
        stems[index];

      const storagePath =
        String(
          stem.storagePath ||
            ""
        );

      if (!storagePath) {
        throw new Error(
          `STEM_PATH_MISSING_${index}`
        );
      }

      const storageFile =
        adminBucket.file(
          storagePath
        );

      const [exists] =
        await storageFile.exists();

      if (!exists) {
        throw new Error(
          `STEM_NOT_FOUND_${index}`
        );
      }

      const [url] =
        await storageFile
          .getSignedUrl({
            action: "read",

            expires:
              Date.now() +
              60 *
                60 *
                1000,
          });

      inputUrls.push(
        url
      );

      const stemName =
        String(
          stem.originalName ||
            stem.name ||
            `Stem ${index + 1}`
        );

      if (!isMasterOnly) {
        recipe.push({
          index,
          name:
            stemName,
          role:
            detectRole(
              stemName
            ),
        });
      }
    }

    const jobId =
      crypto.randomUUID();

    wavPath =
      path.join(
        os.tmpdir(),
        `solo-auto-master-${jobId}.wav`
      );

    mp3Path =
      path.join(
        os.tmpdir(),
        `solo-auto-master-${jobId}.mp3`
      );

    const args:
      string[] = [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
      ];

    for (
      const inputUrl of
      inputUrls
    ) {
      args.push(
        "-thread_queue_size",
        "1024",
        "-i",
        inputUrl
      );
    }

    const filterParts:
      string[] = [];

    if (isMasterOnly) {
      filterParts.push(
        `[0:a]aresample=44100,aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,highpass=f=20,lowpass=f=20000,acompressor=threshold=-12dB:ratio=1.5:attack=25:release=250,loudnorm=I=-12:TP=-1:LRA=10,alimiter=limit=0.8913:attack=5:release=100,aresample=44100,asplit=2[masterwav][mastermp3]`
      );
    } else {
      const mixInputs:
        string[] = [];

      recipe.forEach(
        (
          item,
          index
        ) => {
          const outputLabel =
            `s${index}`;

          filterParts.push(
            `[${index}:a]aresample=44100,aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,${roleFilter(
              item.role
            )}[${outputLabel}]`
          );

          mixInputs.push(
            `[${outputLabel}]`
          );
        }
      );

      filterParts.push(
        `${mixInputs.join(
          ""
        )}amix=inputs=${
          stems.length
        }:duration=longest:dropout_transition=2:normalize=1,highpass=f=20,lowpass=f=20000,acompressor=threshold=-12dB:ratio=1.5:attack=25:release=250,loudnorm=I=-12:TP=-1:LRA=10,alimiter=limit=0.8913:attack=5:release=100,aresample=44100,asplit=2[masterwav][mastermp3]`
      );
    }

    args.push(
      "-filter_complex",
      filterParts.join(
        ";"
      ),

      "-map",
      "[masterwav]",

      "-codec:a",
      "pcm_s24le",

      "-ar",
      "44100",

      "-ac",
      "2",

      wavPath,

      "-map",
      "[mastermp3]",

      "-codec:a",
      "libmp3lame",

      "-b:a",
      "320k",

      "-ar",
      "44100",

      "-ac",
      "2",

      mp3Path
    );

    await runFfmpeg(
      args
    );

    const uid =
      String(
        order.uid || "customer"
      );

    const masterBase =
      `mix-mastering/${uid}/${orderId}/masters`;

    const wavStoragePath =
      `${masterBase}/auto-master-v1.wav`;

    const mp3StoragePath =
      `${masterBase}/auto-master-v1.mp3`;

    const wav =
      await uploadLocalFile(
        wavPath,
        wavStoragePath,
        "audio/wav"
      );

    const mp3 =
      await uploadLocalFile(
        mp3Path,
        mp3StoragePath,
        "audio/mpeg"
      );

    const completedAt =
      new Date()
        .toISOString();

    await orderRef.set(
      {
        processingStatus:
          "AUTO_COMPLETE",

        status:
          "AUTO_COMPLETE",

        autoMixMaster: {
          version:
            engineVersion,

          state:
            "COMPLETE",

          processMode:
            isMasterOnly
              ? "MASTER_ONLY"
              : "MIX_MASTER",

          startedAt,

          completedAt,

          targetLufs:
            -12,

          truePeakDb:
            -1,

          stemCount:
            stems.length,

          recipe,

          outputs: {
            wav,

            mp3,
          },
        },

        autoMasterWavPath:
          wavStoragePath,

        autoMasterMp3Path:
          mp3StoragePath,

        updatedAt:
          completedAt,
      },
      {
        merge: true,
      }
    );

    const wavFile =
      adminBucket.file(
        wavStoragePath
      );

    const mp3File =
      adminBucket.file(
        mp3StoragePath
      );

    const [
      wavUrl,
    ] =
      await wavFile
        .getSignedUrl({
          action: "read",

          expires:
            Date.now() +
            60 *
              60 *
              1000,
        });

    const [
      mp3Url,
    ] =
      await mp3File
        .getSignedUrl({
          action: "read",

          expires:
            Date.now() +
            60 *
              60 *
              1000,
        });

    return NextResponse.json({
      success: true,

      orderId,

      status:
        "AUTO_COMPLETE",

      engine:
        engineVersion,

      recipe,

      wavUrl,

      mp3Url,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : String(error);

    console.error(
      "AUTO MIX MASTER ERROR:",
      error
    );

    if (orderId) {
      const failedAt =
        new Date()
          .toISOString();

      await adminDb
        .collection(
          "mixMasteringOrders"
        )
        .doc(orderId)
        .set(
          {
            processingStatus:
              "AUTO_FAILED",

            status:
              "AUTO_FAILED",

            autoMixMaster: {
              state:
                "FAILED",

              version:
                AUTO_ENGINE_VERSION,

              error:
                message.slice(
                  0,
                  4000
                ),

              failedAt,
            },

            updatedAt:
              failedAt,
          },
          {
            merge: true,
          }
        )
        .catch(
          () => {}
        );
    }

    const authError =
      message ===
        "OWNER_ONLY" ||
      message ===
        "OWNER_AUTH_REQUIRED";

    return NextResponse.json(
      {
        success: false,

        error:
          message,
      },
      {
        status:
          authError
            ? 403
            : 500,
      }
    );
  } finally {
    if (wavPath) {
      await fs
        .unlink(
          wavPath
        )
        .catch(
          () => {}
        );
    }

    if (mp3Path) {
      await fs
        .unlink(
          mp3Path
        )
        .catch(
          () => {}
        );
    }
  }
}


