import {
  AccessToken,
} from "livekit-server-sdk";

import {
  FieldValue,
} from "firebase-admin/firestore";

import {
  adminDb,
} from "../../../../../lib/firebaseAdmin";

import {
  requireRadioDj,
  radioAccessFailure,
  RadioAccessError,
} from "../../../../../lib/radioDjAccess";

export const runtime = "nodejs";

const LIVE_ROOM =
  "solo-beats-premium-radio";

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

    const url =
      process.env.LIVEKIT_URL;

    const apiKey =
      process.env
        .LIVEKIT_API_KEY;

    const apiSecret =
      process.env
        .LIVEKIT_API_SECRET;

    if (
      !url ||
      !apiKey ||
      !apiSecret
    ) {
      return Response.json(
        {
          success: false,
          error:
            "LiveKit server configuration is incomplete.",
        },
        { status: 500 }
      );
    }

    const accessToken =
      new AccessToken(
        apiKey,
        apiSecret,
        {
          identity:
            account.uid,

          name:
            account.displayName ||
            account.email ||
            "SOLO BEATS DJ",
        }
      );

    accessToken.addGrant({
      roomJoin: true,
      room: LIVE_ROOM,

      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const token =
      await accessToken.toJwt();

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

        const radioOnAir =
          typeof current.radioOnAir ===
          "boolean"
            ? current.radioOnAir
            : true;

        if (!radioOnAir) {
          throw new RadioAccessError(
            "SOLO BEATS Radio is currently off air.",
            409
          );
        }

        const alreadyLive =
          current.liveMicOnAir ===
          true;

        const currentUid =
          typeof current.liveBroadcasterUid ===
          "string"
            ? current.liveBroadcasterUid
            : null;

        if (
          alreadyLive &&
          currentUid !==
            account.uid
        ) {
          throw new RadioAccessError(
            "Another DJ or owner broadcast is already live.",
            409
          );
        }

        transaction.set(
          ref,
          {
            liveMicOnAir:
              true,

            liveMicRoom:
              LIVE_ROOM,

            liveBroadcasterUid:
              account.uid,

            liveBroadcasterEmail:
              account.email ||
              null,

            liveBroadcasterRole:
              owner
                ? "owner"
                : "dj",

            liveStartedAt:
              alreadyLive
                ? current.liveStartedAt ||
                  FieldValue
                    .serverTimestamp()
                : FieldValue
                    .serverTimestamp(),

            updatedAt:
              FieldValue
                .serverTimestamp(),

            updatedBy:
              account.email ||
              account.uid,
          },
          { merge: true }
        );
      }
    );

    return Response.json(
      {
        success: true,
        token,
        url,
        room:
          LIVE_ROOM,
        identity:
          account.uid,
        broadcaster:
          account.displayName ||
          account.email ||
          "SOLO BEATS DJ",
      },
      {
        headers: {
          "Cache-Control":
            "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    return radioAccessFailure(
      error
    );
  }
}