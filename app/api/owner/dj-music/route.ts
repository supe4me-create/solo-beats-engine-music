import {
  adminBucket,
  adminDb,
} from "../../../../lib/firebaseAdmin";

import {
  requireRadioOwner,
  radioAccessFailure,
  RadioAccessError,
} from "../../../../lib/radioDjAccess";

import {
  bodyOf,
} from "../../../../lib/djApplicationReview";

import {
  djMusicTrackRef,
  publicTrackData,
  reviewUpdate,
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
        "Cache-Control": "no-store",
      },
    }
  );

export async function GET(
  request: Request
) {
  try {
    await requireRadioOwner(request);

    const snapshot =
      await adminDb
        .collection("djMusicTracks")
        .limit(500)
        .get();

    const tracks =
      snapshot.docs.map(doc => {
        const data = doc.data();

        return {
          ...publicTrackData(
            doc.id,
            data
          ),

          uid:
            typeof data.uid === "string"
              ? data.uid
              : "",

          email:
            typeof data.email === "string"
              ? data.email
              : "",

          proofNote:
            typeof data.proofNote === "string"
              ? data.proofNote
              : "",

          fingerprintAlgorithm:
            typeof data.fingerprintAlgorithm === "string"
              ? data.fingerprintAlgorithm
              : "",

          fingerprintScope:
            typeof data.fingerprintScope === "string"
              ? data.fingerprintScope
              : "",

          fingerprintSha256:
            typeof data.fingerprintSha256 === "string"
              ? data.fingerprintSha256
              : "",
        };
      });

    return reply({
      success: true,
      tracks,
    });
  } catch (error) {
    return radioAccessFailure(error);
  }
}

export async function POST(
  request: Request
) {
  try {
    const { account } =
      await requireRadioOwner(request);

    const body =
      await bodyOf(request);

    const trackId =
      typeof body.trackId === "string"
        ? body.trackId.trim()
        : "";

    const action =
      typeof body.action === "string"
        ? body.action.trim()
        : "";

    const note =
      typeof body.note === "string"
        ? body.note
        : "";

    if (
      !/^[a-f0-9-]{36}$/i.test(
        trackId
      )
    ) {
      throw new RadioAccessError(
        "Invalid DJ track.",
        400
      );
    }

    const ref =
      djMusicTrackRef(trackId);

    const snapshot =
      await ref.get();

    if (!snapshot.exists) {
      throw new RadioAccessError(
        "DJ track was not found.",
        404
      );
    }

    const reviewedBy =
      account.email || "owner";

    // ==========================================================
    // SOLO_DJ_REJECTED_MUSIC_DELETE_V1
    // Permanently deletes only a REJECTED DJ music submission.
    // The private audio object and Firestore record are removed.
    // ==========================================================
    if (action === "delete") {
      const data = snapshot.data() || {};

      if (data.status !== "rejected") {
        throw new RadioAccessError(
          "Only rejected DJ music submissions can be deleted.",
          409
        );
      }

      const storagePath =
        typeof data.storagePath === "string"
          ? data.storagePath
          : "";

      if (storagePath) {
        try {
          await adminBucket
            .file(storagePath)
            .delete({ ignoreNotFound: true });
        } catch (error) {
          console.error(
            "Rejected DJ music storage delete failed:",
            error
          );

          throw new RadioAccessError(
            "The rejected track could not be removed from private storage.",
            500
          );
        }
      }

      await ref.delete();

      return reply({
        success: true,
        status: "deleted",
        message:
          "Rejected DJ music submission permanently deleted.",
      });
    }

    if (action === "approve") {
      await ref.update(
        reviewUpdate(
          "cleared",
          reviewedBy,
          note
        )
      );

      return reply({
        success: true,
        status: "cleared",
        message:
          "DJ track approved and CLEARED.",
      });
    }

    if (action === "reject") {
      await ref.update(
        reviewUpdate(
          "rejected",
          reviewedBy,
          note
        )
      );

      return reply({
        success: true,
        status: "rejected",
        message:
          "DJ track REJECTED.",
      });
    }

    if (action === "requestProof") {
      await ref.update({
        ...reviewUpdate(
          "flagged",
          reviewedBy,
          note
        ),

        reviewReason:
          "Owner requested ownership/license proof.",
      });

      return reply({
        success: true,
        status: "flagged",
        message:
          "Ownership proof requested.",
      });
    }

    throw new RadioAccessError(
      "Invalid owner review action.",
      400
    );
  } catch (error) {
    return radioAccessFailure(error);
  }
}
