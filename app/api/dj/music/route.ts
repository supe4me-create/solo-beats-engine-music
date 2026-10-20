import {
  randomUUID,
  createHash,
} from "node:crypto";

import {
  FieldValue,
} from "firebase-admin/firestore";

import {
  adminBucket,
  adminDb,
} from "../../../../lib/firebaseAdmin";

import {
  requireRadioDj,
  radioAccessFailure,
  RadioAccessError,
} from "../../../../lib/radioDjAccess";

import {
  bodyOf,
} from "../../../../lib/djApplicationReview";

import {
  validateDjMusicSubmission,
  validateDjMusicFile,
  ensurePrivateDjMusicStorage,
  sha256StorageFile,
  acousticFingerprintStorageFile,
  djMusicUploadRef,
  djMusicTrackRef,
  djMusicStoragePath,
  findExactFingerprintMatches,
  findAcousticFingerprintMatches,
  publicTrackData,
  DJ_ACOUSTIC_VERSION,
} from "../../../../lib/djMusicRights";

export const runtime = "nodejs";

const reply = (
  body: object,
  status = 200
) =>
  Response.json(
    body,
    {
      status,
      headers: {
        "Cache-Control":
          "no-store",
      },
    }
  );

const uidKey = (
  uid: string
) =>
  createHash("sha256")
    .update(uid)
    .digest("hex");

export async function GET(
  request: Request
) {
  try {
    const { account } =
      await requireRadioDj(
        request
      );

    const snapshot =
      await adminDb
        .collection(
          "djMusicTracks"
        )
        .where(
          "uid",
          "==",
          account.uid
        )
        .limit(200)
        .get();

    const tracks =
      snapshot.docs.map(doc =>
        publicTrackData(
          doc.id,
          doc.data()
        )
      );

    return reply({
      success: true,
      tracks,
    });
  } catch (error) {
    return radioAccessFailure(
      error
    );
  }
}

export async function POST(
  request: Request
) {
  try {
    const {
      account,
      owner,
    } =
      await requireRadioDj(
        request
      );

    const body =
      await bodyOf(
        request
      );

    const action =
      typeof body.action ===
      "string"
        ? body.action.trim()
        : "";

    if (
      action === "prepare"
    ) {
      const rights =
        validateDjMusicSubmission(
          body
        );

      const audio =
        validateDjMusicFile(
          body
        );

      const id =
        randomUUID();

      const now =
        Date.now();

      const path =
        djMusicStoragePath(
          uidKey(
            account.uid
          ),
          id
        );

      const upload =
        djMusicUploadRef(
          id
        );

      await upload.set({
        id,

        uid:
          account.uid,

        email:
          account.email ||
          "",

        owner:
          owner === true,

        ...rights,
        ...audio,

        path,

        state:
          "prepared",

        createdAt:
          FieldValue
            .serverTimestamp(),

        expiresAt:
          now +
          15 *
          60 *
          1000,
      });

      const uniform =
        await ensurePrivateDjMusicStorage();

      const [policy] =
        await adminBucket
          .file(path)
          .generateSignedPostPolicyV4({
            expires:
              now +
              15 *
              60 *
              1000,

            fields: {
              ...(uniform
                ? {}
                : {
                    acl:
                      "private",
                  }),

              "Content-Type":
                audio.mime,

              "x-goog-meta-uploadid":
                id,

              success_action_status:
                "204",
            },

            conditions: [
              [
                "content-length-range",
                audio.size,
                audio.size,
              ],
            ],
          });

      return reply({
        success: true,
        id,
        uploadUrl:
          policy.url,
        fields:
          policy.fields,
      });
    }

    if (
      action === "finalize"
    ) {
      const id =
        typeof body.id ===
        "string"
          ? body.id.trim()
          : "";

      if (
        !/^[a-f0-9-]{36}$/i.test(
          id
        )
      ) {
        throw new RadioAccessError(
          "Invalid DJ music upload.",
          400
        );
      }

      const uploadRef =
        djMusicUploadRef(
          id
        );

      const uploadSnapshot =
        await uploadRef.get();

      if (
        !uploadSnapshot.exists
      ) {
        throw new RadioAccessError(
          "DJ music upload was not found or has expired.",
          404
        );
      }

      const upload =
        uploadSnapshot.data() ||
        {};

      if (
        upload.uid !==
        account.uid
      ) {
        throw new RadioAccessError(
          "Access denied.",
          403
        );
      }

      if (
        Number(
          upload.expiresAt
        ) <
        Date.now()
      ) {
        throw new RadioAccessError(
          "DJ music upload expired. Select the audio file again.",
          410
        );
      }

      const path =
        typeof upload.path ===
        "string"
          ? upload.path
          : "";

      if (!path) {
        throw new RadioAccessError(
          "Invalid DJ music upload.",
          400
        );
      }

      const file =
        adminBucket.file(
          path
        );

      const [exists] =
        await file.exists();

      if (!exists) {
        throw new RadioAccessError(
          "The uploaded audio file was not found.",
          400
        );
      }

      const [metadata] =
        await file.getMetadata();

      const customMetadata =
        metadata.metadata ||
        {};

      if (
        Number(
          metadata.size
        ) !==
          Number(
            upload.size
          ) ||
        metadata.contentType !==
          upload.mime ||
        customMetadata.uploadid !==
          id
      ) {
        throw new RadioAccessError(
          "The DJ audio upload could not be verified.",
          400
        );
      }

      // ================================================
      // EXACT SHA-256 FINGERPRINT
      // ================================================

      const sha256 =
        await sha256StorageFile(
          path
        );

      const exactMatches =
        await findExactFingerprintMatches(
          sha256
        );

      const exactMatchDetected =
        exactMatches.length >
        0;

      // ================================================
      // CHROMAPRINT ACOUSTIC FINGERPRINT
      // ================================================

      const acoustic =
        await acousticFingerprintStorageFile(
          path
        );

      const acousticMatches =
        acoustic
          ? await findAcousticFingerprintMatches(
              acoustic.raw
            )
          : [];

      const acousticMatchDetected =
        acousticMatches.length >
        0;

      const acousticBestSimilarity =
        acousticMatches.length
          ? acousticMatches[0]
              .similarity
          : 0;

      // ================================================
      // COMBINE MATCH RESULTS
      // ================================================

      const duplicateIds =
        Array.from(
          new Set([
            ...exactMatches.map(
              item =>
                item.id
            ),

            ...acousticMatches.map(
              item =>
                item.id
            ),
          ])
        ).slice(
          0,
          10
        );

      const duplicateDetected =
        exactMatchDetected ||
        acousticMatchDetected;

      const status =
        duplicateDetected
          ? "flagged"
          : "cleared";

      let reviewReason =
        "";

      if (
        exactMatchDetected
      ) {
        reviewReason =
          "Exact SHA-256 audio fingerprint matches an existing DJ submission.";
      } else if (
        acousticMatchDetected
      ) {
        const percentage =
          Math.round(
            acousticBestSimilarity *
            100
          );

        reviewReason =
          `Acoustic fingerprint is ${percentage}% similar to an existing DJ submission. Possible re-encoded or altered duplicate.`;
      }

      const trackRef =
        djMusicTrackRef(
          id
        );

      await trackRef.set({
        id,

        uid:
          account.uid,

        email:
          account.email ||
          "",

        ownerAccount:
          owner === true,

        title:
          upload.title,

        artist:
          upload.artist,

        rightsholder:
          upload.rightsholder,

        ownershipType:
          upload.ownershipType,

        label:
          upload.label ||
          "",

        publisher:
          upload.publisher ||
          "",

        proofNote:
          upload.proofNote ||
          "",

        ownershipConfirmed:
          upload
            .ownershipConfirmed ===
          true,

        originalName:
          upload.originalName,

        mime:
          upload.mime,

        size:
          Number(
            upload.size
          ),

        storagePath:
          path,

        // Exact-file fingerprint
        fingerprintSha256:
          sha256,

        // Acoustic fingerprint
        acousticMatchingAvailable:
          acoustic !== null,

        acousticFingerprintVersion:
          acoustic
            ? DJ_ACOUSTIC_VERSION
            : "",

        acousticFingerprintDuration:
          acoustic
            ? acoustic.duration
            : 0,

        acousticFingerprintChecksum:
          acoustic
            ? acoustic.checksum
            : "",

        acousticFingerprintRaw:
          acoustic
            ? acoustic.raw
            : [],

        fingerprintAlgorithm:
          acoustic
            ? "sha256+chromaprint"
            : "sha256",

        fingerprintScope:
          acoustic
            ? "exact-file+acoustic"
            : "exact-file",

        exactMatchDetected,

        acousticMatchDetected,

        acousticBestSimilarity,

        duplicateDetected,

        duplicateCount:
          duplicateIds.length,

        duplicateTrackIds:
          duplicateIds,

        acousticMatchTrackIds:
          acousticMatches
            .map(
              item =>
                item.id
            )
            .slice(
              0,
              10
            ),

        acousticMatchScores:
          acousticMatches
            .map(item => ({
              trackId:
                item.id,

              similarity:
                Number(
                  item.similarity
                    .toFixed(
                      4
                    )
                ),
            }))
            .slice(
              0,
              10
            ),

        status,

        reviewReason,

        createdAt:
          FieldValue
            .serverTimestamp(),

        updatedAt:
          FieldValue
            .serverTimestamp(),
      });

      await uploadRef.delete();

      let message =
        "Track uploaded and automatically CLEARED.";

      if (
        exactMatchDetected
      ) {
        message =
          "Track uploaded and FLAGGED for owner review because an exact audio match already exists.";
      } else if (
        acousticMatchDetected
      ) {
        message =
          "Track uploaded and FLAGGED for owner review because the acoustic fingerprint matches an existing recording.";
      } else if (
        !acoustic
      ) {
        message =
          "Track uploaded and CLEARED by exact-file protection. Acoustic matching is unavailable on this server.";
      }

      return reply({
        success: true,

        trackId:
          id,

        status,

        duplicateDetected,

        exactMatchDetected,

        acousticMatchDetected,

        acousticMatchingAvailable:
          acoustic !== null,

        acousticBestSimilarity,

        message,
      });
    }

    throw new RadioAccessError(
      "Invalid DJ music action.",
      400
    );
  } catch (error) {
    return radioAccessFailure(
      error
    );
  }
}
