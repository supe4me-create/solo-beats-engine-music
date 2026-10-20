import { createHash, randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { FieldValue } from "firebase-admin/firestore";

import {
  adminBucket,
  adminDb,
} from "./firebaseAdmin";

import {
  RadioAccessError,
} from "./radioDjAccess";

export const DJ_MUSIC_MAX_BYTES =
  150 * 1024 * 1024;

export const DJ_MUSIC_ALLOWED_MIME = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/mp4",
  "audio/aac",
  "audio/ogg",
  "audio/flac",
  "audio/x-flac",
]);

export const DJ_ACOUSTIC_VERSION =
  "chromaprint-v1";

export const DJ_ACOUSTIC_MATCH_THRESHOLD =
  0.88;

const DJ_ACOUSTIC_MAX_OFFSET = 64;

const DJ_ACOUSTIC_MIN_OVERLAP = 80;

const DJ_ACOUSTIC_MAX_TRACKS = 500;

export type DjMusicStatus =
  | "cleared"
  | "flagged"
  | "rejected";

export type DjOwnershipType =
  | "owner"
  | "licensed"
  | "authorized";

export type DjAcousticFingerprint = {
  duration: number;
  raw: number[];
  checksum: string;
};

export type DjAcousticMatch = {
  id: string;
  similarity: number;
  data: Record<string, unknown>;
};

function clean(
  value: unknown,
  max: number
) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .replace(/\0/g, "")
    .trim()
    .slice(0, max);
}

function required(
  value: unknown,
  label: string,
  max: number
) {
  const result = clean(value, max);

  if (!result) {
    throw new RadioAccessError(
      `${label} is required.`,
      400
    );
  }

  return result;
}

export function validateDjMusicSubmission(
  body: Record<string, unknown>
) {
  const title = required(
    body.title,
    "Track title",
    160
  );

  const artist = required(
    body.artist,
    "Artist name",
    160
  );

  const rightsholder = required(
    body.rightsholder,
    "Rights holder",
    200
  );

  const ownershipType =
    clean(
      body.ownershipType,
      40
    ) as DjOwnershipType;

  if (
    ![
      "owner",
      "licensed",
      "authorized",
    ].includes(ownershipType)
  ) {
    throw new RadioAccessError(
      "Choose whether you own the music, licensed it, or are otherwise authorized to use it.",
      400
    );
  }

  const label = clean(
    body.label,
    160
  );

  const publisher = clean(
    body.publisher,
    160
  );

  const proofNote = clean(
    body.proofNote,
    1000
  );

  if (body.ownershipConfirmed !== true) {
    throw new RadioAccessError(
      "Confirm that you own this music or have permission/license to use it.",
      400
    );
  }

  return {
    title,
    artist,
    rightsholder,
    ownershipType,
    label,
    publisher,
    proofNote,
    ownershipConfirmed: true,
  };
}

export function validateDjMusicFile(
  body: Record<string, unknown>
) {
  const originalName = required(
    body.originalName,
    "Audio filename",
    240
  );

  const mime = clean(
    body.mime,
    120
  ).toLowerCase();

  const size = Number(body.size);

  if (
    !Number.isSafeInteger(size) ||
    size < 1 ||
    size > DJ_MUSIC_MAX_BYTES
  ) {
    throw new RadioAccessError(
      "DJ audio must be 150 MB or smaller.",
      400
    );
  }

  if (!DJ_MUSIC_ALLOWED_MIME.has(mime)) {
    throw new RadioAccessError(
      "Use MP3, WAV, M4A/AAC, OGG, or FLAC audio.",
      400
    );
  }

  return {
    originalName,
    mime,
    size,
  };
}

export async function ensurePrivateDjMusicStorage() {
  const [metadata] =
    await adminBucket.getMetadata();

  const [policy] =
    await adminBucket.iam.getPolicy();

  const publicBinding =
    policy.bindings?.some(binding =>
      binding.members?.some(member =>
        member === "allUsers" ||
        member ===
          "allAuthenticatedUsers"
      )
    );

  if (publicBinding) {
    throw new RadioAccessError(
      "DJ music uploads are blocked because the Storage bucket has public IAM access.",
      503
    );
  }

  return (
    metadata.iamConfiguration
      ?.uniformBucketLevelAccess
      ?.enabled === true
  );
}

export async function sha256StorageFile(
  storagePath: string
) {
  const hash = createHash("sha256");

  const stream =
    adminBucket
      .file(storagePath)
      .createReadStream();

  for await (const chunk of stream) {
    hash.update(chunk);
  }

  return hash.digest("hex");
}

function runFpcalc(
  filePath: string
): Promise<string> {
  const configuredPath =
    process.env.FPCALC_PATH?.trim();

  const bundledPath =
    process.platform === "win32"
      ? "fpcalc"
      : join(
          process.cwd(),
          "bin",
          "fpcalc"
        );

  const command =
    configuredPath ||
    bundledPath;

  return new Promise(
    (resolve, reject) => {
      execFile(
        command,
        [
          "-raw",
          "-json",
          "-length",
          "120",
          filePath,
        ],
        {
          encoding: "utf8",
          windowsHide: true,
          maxBuffer:
            12 * 1024 * 1024,
        },
        (
          error,
          stdout,
          stderr
        ) => {
          if (error) {
            const failure =
              error as NodeJS.ErrnoException;

            if (
              failure.code === "ENOENT"
            ) {
              resolve("");
              return;
            }

            reject(
              new Error(
                stderr?.trim() ||
                error.message ||
                "fpcalc failed."
              )
            );

            return;
          }

          resolve(stdout);
        }
      );
    }
  );
}

export async function acousticFingerprintStorageFile(
  storagePath: string
): Promise<DjAcousticFingerprint | null> {
  const temporaryFile =
    join(
      tmpdir(),
      `solo-beats-dj-${randomUUID()}.audio`
    );

  try {
    await adminBucket
      .file(storagePath)
      .download({
        destination: temporaryFile,
      });

    let output = "";

    try {
      output =
        await runFpcalc(
          temporaryFile
        );
    } catch (error) {
      throw new RadioAccessError(
        error instanceof Error
          ? `Acoustic fingerprint failed: ${error.message}`
          : "Acoustic fingerprint failed.",
        400
      );
    }

    if (!output.trim()) {
      return null;
    }

    let parsed: {
      duration?: unknown;
      fingerprint?: unknown;
    };

    try {
      parsed =
        JSON.parse(output);
    } catch {
      throw new RadioAccessError(
        "The acoustic fingerprint response could not be read.",
        500
      );
    }

    if (
      !Array.isArray(
        parsed.fingerprint
      )
    ) {
      throw new RadioAccessError(
        "The uploaded audio did not produce a valid acoustic fingerprint.",
        400
      );
    }

    const raw =
      parsed.fingerprint
        .map(value =>
          Number(value) >>> 0
        )
        .filter(value =>
          Number.isFinite(value)
        );

    if (
      raw.length <
      DJ_ACOUSTIC_MIN_OVERLAP
    ) {
      throw new RadioAccessError(
        "The uploaded audio is too short or could not produce enough acoustic fingerprint data.",
        400
      );
    }

    const duration =
      Number(parsed.duration);

    const checksum =
      createHash("sha256")
        .update(
          raw.join(",")
        )
        .digest("hex");

    return {
      duration:
        Number.isFinite(duration)
          ? duration
          : 0,

      raw,

      checksum,
    };
  } finally {
    await rm(
      temporaryFile,
      {
        force: true,
      }
    ).catch(() => undefined);
  }
}

function popcount32(
  input: number
) {
  let value =
    input >>> 0;

  value =
    value -
    ((value >>> 1) &
      0x55555555);

  value =
    (value & 0x33333333) +
    ((value >>> 2) &
      0x33333333);

  return (
    (((value +
      (value >>> 4)) &
      0x0f0f0f0f) *
      0x01010101) >>>
    24
  );
}

export function acousticSimilarity(
  first: number[],
  second: number[]
) {
  if (
    first.length <
      DJ_ACOUSTIC_MIN_OVERLAP ||
    second.length <
      DJ_ACOUSTIC_MIN_OVERLAP
  ) {
    return 0;
  }

  let best = 0;

  for (
    let offset =
      -DJ_ACOUSTIC_MAX_OFFSET;
    offset <=
      DJ_ACOUSTIC_MAX_OFFSET;
    offset++
  ) {
    const firstStart =
      Math.max(
        0,
        -offset
      );

    const secondStart =
      Math.max(
        0,
        offset
      );

    const overlap =
      Math.min(
        first.length -
          firstStart,

        second.length -
          secondStart
      );

    if (
      overlap <
      DJ_ACOUSTIC_MIN_OVERLAP
    ) {
      continue;
    }

    let differingBits = 0;

    for (
      let index = 0;
      index < overlap;
      index++
    ) {
      const a =
        first[
          firstStart + index
        ] >>> 0;

      const b =
        second[
          secondStart + index
        ] >>> 0;

      differingBits +=
        popcount32(
          (a ^ b) >>> 0
        );
    }

    const similarity =
      1 -
      differingBits /
        (overlap * 32);

    if (
      similarity > best
    ) {
      best = similarity;
    }
  }

  return Math.max(
    0,
    Math.min(
      1,
      best
    )
  );
}

export function djMusicUploadRef(
  id: string
) {
  return adminDb
    .collection("djMusicUploads")
    .doc(id);
}

export function djMusicTrackRef(
  id: string
) {
  return adminDb
    .collection("djMusicTracks")
    .doc(id);
}

export function djMusicStoragePath(
  uidHash: string,
  id: string
) {
  return (
    `private-dj-music/` +
    `${uidHash}/${id}/audio`
  );
}

export async function findExactFingerprintMatches(
  sha256: string
) {
  const snapshot =
    await adminDb
      .collection("djMusicTracks")
      .where(
        "fingerprintSha256",
        "==",
        sha256
      )
      .limit(10)
      .get();

  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  }));
}

export async function findAcousticFingerprintMatches(
  raw: number[]
): Promise<DjAcousticMatch[]> {
  const snapshot =
    await adminDb
      .collection("djMusicTracks")
      .where(
        "acousticFingerprintVersion",
        "==",
        DJ_ACOUSTIC_VERSION
      )
      .limit(
        DJ_ACOUSTIC_MAX_TRACKS
      )
      .get();

  const matches:
    DjAcousticMatch[] = [];

  for (
    const document
    of snapshot.docs
  ) {
    const data =
      document.data();

    if (
      !Array.isArray(
        data.acousticFingerprintRaw
      )
    ) {
      continue;
    }

    const candidate =
      data.acousticFingerprintRaw
        .map((value: unknown) =>
          Number(value) >>> 0
        )
        .filter((value: number) =>
          Number.isFinite(value)
        );

    const similarity =
      acousticSimilarity(
        raw,
        candidate
      );

    if (
      similarity >=
      DJ_ACOUSTIC_MATCH_THRESHOLD
    ) {
      matches.push({
        id: document.id,
        similarity,
        data,
      });
    }
  }

  matches.sort(
    (a, b) =>
      b.similarity -
      a.similarity
  );

  return matches.slice(
    0,
    10
  );
}

export function reviewUpdate(
  status: DjMusicStatus,
  reviewedBy: string,
  note = ""
) {
  return {
    status,

    reviewNote:
      clean(
        note,
        1000
      ),

    reviewedBy,

    reviewedAt:
      FieldValue.serverTimestamp(),

    updatedAt:
      FieldValue.serverTimestamp(),
  };
}

export function publicTrackData(
  id: string,
  data: Record<string, unknown>
) {
  return {
    id,

    title:
      typeof data.title === "string"
        ? data.title
        : "",

    artist:
      typeof data.artist === "string"
        ? data.artist
        : "",

    rightsholder:
      typeof data.rightsholder === "string"
        ? data.rightsholder
        : "",

    ownershipType:
      typeof data.ownershipType ===
      "string"
        ? data.ownershipType
        : "",

    label:
      typeof data.label === "string"
        ? data.label
        : "",

    publisher:
      typeof data.publisher ===
      "string"
        ? data.publisher
        : "",

    originalName:
      typeof data.originalName ===
      "string"
        ? data.originalName
        : "",

    mime:
      typeof data.mime === "string"
        ? data.mime
        : "",

    size:
      Number(data.size) || 0,

    status:
      typeof data.status === "string"
        ? data.status
        : "flagged",

    duplicateDetected:
      data.duplicateDetected === true,

    duplicateCount:
      Number(
        data.duplicateCount
      ) || 0,

    exactMatchDetected:
      data.exactMatchDetected ===
      true,

    acousticMatchDetected:
      data.acousticMatchDetected ===
      true,

    acousticMatchingAvailable:
      data.acousticMatchingAvailable ===
      true,

    acousticBestSimilarity:
      Number(
        data.acousticBestSimilarity
      ) || 0,

    reviewReason:
      typeof data.reviewReason ===
      "string"
        ? data.reviewReason
        : "",

    reviewNote:
      typeof data.reviewNote ===
      "string"
        ? data.reviewNote
        : "",

    ownershipConfirmed:
      data.ownershipConfirmed ===
      true,
  };
}

