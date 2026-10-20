import crypto from "crypto";
import os from "os";
import path from "path";

import {
  existsSync,
} from "fs";

import {
  promises as fs,
} from "fs";

import {
  spawn,
} from "child_process";

import {
  pipeline,
} from "stream/promises";

import {
  Readable,
} from "stream";

import {
  getAuth,
} from "firebase-admin/auth";

import {
  put,
} from "@vercel/blob";

import ffmpegStaticPath from "ffmpeg-static";

import {
  NextResponse,
} from "next/server";

import {
  FieldValue,
} from "firebase-admin/firestore";

import {
  adminDb,
  firebaseAdminApp,
} from "../../../../lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_BYTES =
  250 * 1024 * 1024;

function getBearerToken(
  request: Request
) {
  const authorization =
    request.headers.get(
      "authorization"
    ) || "";

  return (
    authorization.match(
      /^Bearer\s+(.+)$/i
    )?.[1]?.trim() ||
    null
  );
}

async function requireUser(
  request: Request
) {
  const token =
    getBearerToken(
      request
    );

  if (!token) {
    throw new Error(
      "AUTH_REQUIRED"
    );
  }

  const user =
    await getAuth(
      firebaseAdminApp
    ).verifyIdToken(
      token
    );

  if (
    user.email_verified !==
    true
  ) {
    throw new Error(
      "EMAIL_VERIFICATION_REQUIRED"
    );
  }

  return user;
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
    existsSync(
      localCandidate
    )
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
          if (
            code ===
            0
          ) {
            resolve();
            return;
          }

          reject(
            new Error(
              `FFMPEG_FAILED_${code}: ${stderr.slice(
                -3000
              )}`
            )
          );
        }
      );
    }
  );
}

function validateInputUrl(
  value: unknown
) {
  const raw =
    String(
      value ||
      ""
    );

  let url: URL;

  try {
    url =
      new URL(
        raw
      );
  } catch {
    throw new Error(
      "INVALID_AUDIO_UPLOAD_URL"
    );
  }

  if (
    url.protocol !==
      "https:" ||
    !url.hostname.endsWith(
      ".public.blob.vercel-storage.com"
    ) ||
    !url.pathname.includes(
      "/customer-audio-input/"
    )
  ) {
    throw new Error(
      "INVALID_AUDIO_UPLOAD_URL"
    );
  }

  return url.toString();
}

function safeBaseName(
  value: string
) {
  return (
    path
      .parse(
        value
      )
      .name
      .replace(
        /[<>:"/\\|?*\x00-\x1F]/g,
        "_"
      )
      .trim()
      .slice(
        0,
        120
      ) ||
    "audio"
  );
}

type AudioCreditReservationMetadata = {
  format: string;
  originalName: string;
  blobUrl: string;
};

async function reserveAudioCredit(
  uid: string,
  metadata: AudioCreditReservationMetadata
) {
  const reservationId =
    crypto.randomUUID();

  const accountRef =
    adminDb
      .collection(
        "audioCredits"
      )
      .doc(uid);

  const ledgerRef =
    accountRef
      .collection(
        "ledger"
      )
      .doc(
        `reservation_${reservationId}`
      );

  const result =
    await adminDb.runTransaction(
      async transaction => {
        const accountSnapshot =
          await transaction.get(
            accountRef
          );

        const accountData =
          accountSnapshot.exists
            ? accountSnapshot.data() || {}
            : {};

        const currentBalance =
          typeof accountData.balance ===
            "number" &&
          Number.isFinite(
            accountData.balance
          )
            ? Math.max(
                0,
                Math.floor(
                  accountData.balance
                )
              )
            : 0;

        if (
          currentBalance <
          1
        ) {
          throw new Error(
            "INSUFFICIENT_AUDIO_CREDITS"
          );
        }

        const newBalance =
          currentBalance - 1;

        transaction.set(
          accountRef,
          {
            balance:
              newBalance,

            updatedAt:
              FieldValue.serverTimestamp(),
          },
          {
            merge:
              true,
          }
        );

        transaction.set(
          ledgerRef,
          {
            type:
              "debit",

            amount:
              -1,

            reason:
              "audio_conversion_reservation",

            status:
              "reserved",

            reservationId,

            format:
              metadata.format,

            originalName:
              metadata.originalName,

            inputUrl:
              metadata.blobUrl,

            balanceBefore:
              currentBalance,

            balanceAfter:
              newBalance,

            createdAt:
              FieldValue.serverTimestamp(),

            updatedAt:
              FieldValue.serverTimestamp(),
          }
        );

        return {
          id:
            reservationId,

          balance:
            newBalance,
        };
      }
    );

  return result;
}

async function commitAudioCreditReservation(
  uid: string,
  reservationId: string
) {
  const accountRef =
    adminDb
      .collection(
        "audioCredits"
      )
      .doc(uid);

  const ledgerRef =
    accountRef
      .collection(
        "ledger"
      )
      .doc(
        `reservation_${reservationId}`
      );

  return adminDb.runTransaction(
    async transaction => {
      const [
        accountSnapshot,
        ledgerSnapshot,
      ] =
        await Promise.all([
          transaction.get(
            accountRef
          ),

          transaction.get(
            ledgerRef
          ),
        ]);

      if (
        !ledgerSnapshot.exists
      ) {
        throw new Error(
          "AUDIO_CREDIT_RESERVATION_NOT_FOUND"
        );
      }

      const ledger =
        ledgerSnapshot.data() ||
        {};

      const accountData =
        accountSnapshot.exists
          ? accountSnapshot.data() || {}
          : {};

      const currentBalance =
        typeof accountData.balance ===
          "number" &&
        Number.isFinite(
          accountData.balance
        )
          ? Math.max(
              0,
              Math.floor(
                accountData.balance
              )
            )
          : 0;

      if (
        ledger.status ===
        "refunded"
      ) {
        throw new Error(
          "AUDIO_CREDIT_RESERVATION_ALREADY_REFUNDED"
        );
      }

      if (
        ledger.status ===
        "committed"
      ) {
        return currentBalance;
      }

      if (
        ledger.status !==
        "reserved"
      ) {
        throw new Error(
          "INVALID_AUDIO_CREDIT_RESERVATION_STATE"
        );
      }

      transaction.set(
        ledgerRef,
        {
          status:
            "committed",

          reason:
            "audio_conversion",

          committedAt:
            FieldValue.serverTimestamp(),

          updatedAt:
            FieldValue.serverTimestamp(),
        },
        {
          merge:
            true,
        }
      );

      return currentBalance;
    }
  );
}

async function refundAudioCreditReservation(
  uid: string,
  reservationId: string
) {
  const accountRef =
    adminDb
      .collection(
        "audioCredits"
      )
      .doc(uid);

  const ledgerRef =
    accountRef
      .collection(
        "ledger"
      )
      .doc(
        `reservation_${reservationId}`
      );

  return adminDb.runTransaction(
    async transaction => {
      const [
        accountSnapshot,
        ledgerSnapshot,
      ] =
        await Promise.all([
          transaction.get(
            accountRef
          ),

          transaction.get(
            ledgerRef
          ),
        ]);

      if (
        !ledgerSnapshot.exists
      ) {
        return null;
      }

      const ledger =
        ledgerSnapshot.data() ||
        {};

      if (
        ledger.status ===
          "refunded" ||
        ledger.status ===
          "committed"
      ) {
        return null;
      }

      if (
        ledger.status !==
        "reserved"
      ) {
        return null;
      }

      const accountData =
        accountSnapshot.exists
          ? accountSnapshot.data() || {}
          : {};

      const currentBalance =
        typeof accountData.balance ===
          "number" &&
        Number.isFinite(
          accountData.balance
        )
          ? Math.max(
              0,
              Math.floor(
                accountData.balance
              )
            )
          : 0;

      const restoredBalance =
        currentBalance + 1;

      transaction.set(
        accountRef,
        {
          balance:
            restoredBalance,

          updatedAt:
            FieldValue.serverTimestamp(),
        },
        {
          merge:
            true,
        }
      );

      transaction.set(
        ledgerRef,
        {
          status:
            "refunded",

          refundAmount:
            1,

          balanceBeforeRefund:
            currentBalance,

          balanceAfterRefund:
            restoredBalance,

          refundedAt:
            FieldValue.serverTimestamp(),

          updatedAt:
            FieldValue.serverTimestamp(),
        },
        {
          merge:
            true,
        }
      );

      return restoredBalance;
    }
  );
}
export async function POST(
  request: Request
) {
  let creditReservation:
    | {
        uid: string;
        id: string;
      }
    | null =
    null;

  let inputPath:
    string | null =
    null;

  let outputPath:
    string | null =
    null;

  try {
    const user =
      await requireUser(
        request
      );

    const body =
      await request.json();

    const blobUrl =
      validateInputUrl(
        body?.blobUrl
      );

    const originalName =
      String(
        body?.originalName ||
        "audio"
      );

    const format =
      String(
        body?.format ||
        ""
      )
        .trim()
        .toLowerCase();

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
        format
      )
    ) {
      return NextResponse.json(
        {
          success:
            false,

          error:
            "FORMAT_NOT_SUPPORTED",
        },
        {
          status:
            400,
        }
      );
    }

    const reservation =
      await reserveAudioCredit(
        user.uid,
        {
          format,
          originalName,
          blobUrl,
        }
      );

    creditReservation = {
      uid:
        user.uid,

      id:
        reservation.id,
    };

    const source =
      await fetch(
        blobUrl,
        {
          cache:
            "no-store",
        }
      );

    if (
      !source.ok ||
      !source.body
    ) {
      throw new Error(
        "AUDIO_SOURCE_DOWNLOAD_FAILED"
      );
    }

    const contentLength =
      Number(
        source.headers.get(
          "content-length"
        ) ||
        0
      );

    if (
      contentLength >
      MAX_FILE_BYTES
    ) {
      throw new Error(
        "FILE_TOO_LARGE"
      );
    }

    const id =
      crypto.randomUUID();

    const inputExtension =
      path.extname(
        originalName
      ) || ".audio";

    inputPath =
      path.join(
        os.tmpdir(),
        `solo-customer-audio-in-${id}${inputExtension}`
      );

    outputPath =
      path.join(
        os.tmpdir(),
        `solo-customer-audio-out-${id}.${format}`
      );

    await pipeline(
      Readable.fromWeb(
        source.body as any
      ),
      (
        await import("fs")
      ).createWriteStream(
        inputPath
      )
    );

    const stat =
      await fs.stat(
        inputPath
      );

    if (
      stat.size >
      MAX_FILE_BYTES
    ) {
      throw new Error(
        "FILE_TOO_LARGE"
      );
    }

    const args =
      [
        "-y",
        "-i",
        inputPath,
      ];

    if (
      format ===
      "mp3"
    ) {
      args.push(
        "-codec:a",
        "libmp3lame",
        "-b:a",
        "320k"
      );
    }

    if (
      format ===
      "wav"
    ) {
      args.push(
        "-codec:a",
        "pcm_s24le"
      );
    }

    if (
      format ===
      "flac"
    ) {
      args.push(
        "-codec:a",
        "flac"
      );
    }

    if (
      format ===
      "m4a"
    ) {
      args.push(
        "-codec:a",
        "aac",
        "-b:a",
        "256k"
      );
    }

    if (
      format ===
      "aac"
    ) {
      args.push(
        "-codec:a",
        "aac",
        "-b:a",
        "256k"
      );
    }

    if (
      format ===
      "ogg"
    ) {
      args.push(
        "-codec:a",
        "libvorbis",
        "-q:a",
        "7"
      );
    }

    args.push(
      outputPath
    );

    await runFfmpeg(
      args
    );

    const outputBuffer =
      await fs.readFile(
        outputPath
      );

    if (
      !outputBuffer.length
    ) {
      throw new Error(
        "EMPTY_CONVERTED_AUDIO"
      );
    }

    const base =
      safeBaseName(
        originalName
      );

    const result =
      await put(
        `customer-audio-output/${user.uid}/${id}-${base}.${format}`,
        outputBuffer,
        {
          access:
            "public",

          contentType:
            format === "mp3"
              ? "audio/mpeg"
              : format === "wav"
              ? "audio/wav"
              : format === "flac"
              ? "audio/flac"
              : format === "ogg"
              ? "audio/ogg"
              : "audio/mp4",
        }
      );

    if (
      !creditReservation
    ) {
      throw new Error(
        "AUDIO_CREDIT_RESERVATION_MISSING"
      );
    }

    const remainingBalance =
      await commitAudioCreditReservation(
        creditReservation.uid,
        creditReservation.id
      );

    creditReservation =
      null;

    return NextResponse.json({
      success:
        true,

      url:
        result.url,

      filename:
        `${base}.${format}`,

      creditsUsed:
        1,

      balance:
        remainingBalance,
    });
  } catch (error) {
    if (
      creditReservation
    ) {
      try {
        await refundAudioCreditReservation(
          creditReservation.uid,
          creditReservation.id
        );
      } catch (refundError) {
        console.error(
          "Audio credit refund failed:",
          refundError
        );
      }
    }

    const message =
      error instanceof Error
        ? error.message
        : "AUDIO_CONVERSION_FAILED";

    console.error(
      "Customer audio converter error:",
      error
    );

    return NextResponse.json(
      {
        success:
          false,

        error:
          message,
      },
      {
        status:
          message ===
          "AUTH_REQUIRED"
            ? 401
            : message ===
              "EMAIL_VERIFICATION_REQUIRED"
            ? 403
            : message ===
              "INSUFFICIENT_AUDIO_CREDITS"
            ? 402
            : message ===
              "FILE_TOO_LARGE"
            ? 413
            : 500,
      }
    );
  } finally {
    if (
      inputPath
    ) {
      await fs.unlink(
        inputPath
      ).catch(
        () => {}
      );
    }

    if (
      outputPath
    ) {
      await fs.unlink(
        outputPath
      ).catch(
        () => {}
      );
    }
  }
}

