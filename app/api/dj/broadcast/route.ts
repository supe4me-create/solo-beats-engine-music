import {
  FieldValue,
} from "firebase-admin/firestore";

import {
  adminDb,
} from "../../../../lib/firebaseAdmin";

import {
  requireRadioDj,
  radioAccessFailure,
  RadioAccessError,
} from "../../../../lib/radioDjAccess";

export const runtime = "nodejs";

const LIVE_ROOM =
  "solo-beats-premium-radio";

function reply(
  body: object,
  status = 200
) {
  return Response.json(
    body,
    {
      status,
      headers: {
        "Cache-Control":
          "no-store, max-age=0",
      },
    }
  );
}

function statusFrom(
  data: Record<string, unknown>
) {
  return {
    radioOnAir:
      typeof data.radioOnAir ===
      "boolean"
        ? data.radioOnAir
        : true,

    liveMicOnAir:
      data.liveMicOnAir === true,

    liveMicRoom:
      typeof data.liveMicRoom ===
      "string"
        ? data.liveMicRoom
        : LIVE_ROOM,

    liveMicMode:
      data.liveMicMode ===
      "takeover"
        ? "takeover"
        : "duck",

    liveBroadcasterUid:
      typeof data.liveBroadcasterUid ===
      "string"
        ? data.liveBroadcasterUid
        : null,

    liveBroadcasterEmail:
      typeof data.liveBroadcasterEmail ===
      "string"
        ? data.liveBroadcasterEmail
        : null,

    liveBroadcasterRole:
      data.liveBroadcasterRole ===
      "owner"
        ? "owner"
        : data.liveBroadcasterRole ===
            "dj"
          ? "dj"
          : null,
  };
}

export async function GET(
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

    const ref =
      adminDb
        .collection(
          "platformSettings"
        )
        .doc("broadcast");

    const snapshot =
      await ref.get();

    const data =
      snapshot.exists
        ? snapshot.data() || {}
        : {};

    const status =
      statusFrom(data);

    return reply({
      success: true,
      ...status,
      mine:
        status.liveBroadcasterUid ===
        account.uid,
      owner,
    });
  } catch (error) {
    return radioAccessFailure(
      error
    );
  }
}

export async function PATCH(
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
      await request.json();

    const hasLive =
      typeof body.liveMicOnAir ===
      "boolean";

    const hasMode =
      body.liveMicMode ===
        "duck" ||
      body.liveMicMode ===
        "takeover";

    if (!hasLive && !hasMode) {
      throw new RadioAccessError(
        "A Live Mix status or mode is required.",
        400
      );
    }

    const ref =
      adminDb
        .collection(
          "platformSettings"
        )
        .doc("broadcast");

    await adminDb.runTransaction(
      async transaction => {
        const snapshot =
          await transaction.get(
            ref
          );

        const current =
          snapshot.exists
            ? snapshot.data() || {}
            : {};

        const currentLive =
          current.liveMicOnAir ===
          true;

        const currentUid =
          typeof current.liveBroadcasterUid ===
          "string"
            ? current.liveBroadcasterUid
            : null;

        const radioOnAir =
          typeof current.radioOnAir ===
          "boolean"
            ? current.radioOnAir
            : true;

        if (
          hasMode &&
          currentLive &&
          currentUid !==
            account.uid
        ) {
          throw new RadioAccessError(
            "Another broadcast is already live. End it before changing Live Mix mode.",
            409
          );
        }

        const updates: Record<
          string,
          unknown
        > = {
          updatedAt:
            FieldValue
              .serverTimestamp(),

          updatedBy:
            account.email ||
            account.uid,
        };

        if (hasMode) {
          updates.liveMicMode =
            body.liveMicMode;
        }

        if (hasLive) {
          if (
            body.liveMicOnAir ===
            true
          ) {
            if (!radioOnAir) {
              throw new RadioAccessError(
                "SOLO BEATS Radio is currently off air.",
                409
              );
            }

            if (
              currentLive &&
              currentUid !==
                account.uid
            ) {
              throw new RadioAccessError(
                "Another DJ or owner broadcast is already live.",
                409
              );
            }

            updates.liveMicOnAir =
              true;

            updates.liveMicRoom =
              LIVE_ROOM;

            updates.liveBroadcasterUid =
              account.uid;

            updates.liveBroadcasterEmail =
              account.email || null;

            updates.liveBroadcasterRole =
              owner
                ? "owner"
                : "dj";

            if (!currentLive) {
              updates.liveStartedAt =
                FieldValue
                  .serverTimestamp();
            }
          } else {
            if (
              currentLive &&
              !owner &&
              currentUid !==
                account.uid
            ) {
              throw new RadioAccessError(
                "Only the DJ who started this broadcast can end it.",
                403
              );
            }

            updates.liveMicOnAir =
              false;

            updates.liveBroadcasterUid =
              null;

            updates.liveBroadcasterEmail =
              null;

            updates.liveBroadcasterRole =
              null;

            updates.liveEndedAt =
              FieldValue
                .serverTimestamp();
          }
        }

        transaction.set(
          ref,
          updates,
          { merge: true }
        );
      }
    );

    const snapshot =
      await ref.get();

    const data =
      snapshot.exists
        ? snapshot.data() || {}
        : {};

    return reply({
      success: true,
      ...statusFrom(data),
    });
  } catch (error) {
    return radioAccessFailure(
      error
    );
  }
}