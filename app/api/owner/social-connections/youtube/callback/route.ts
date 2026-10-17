import { NextResponse } from "next/server";
import { createCipheriv, createHash, randomBytes } from "crypto";
import { FieldValue } from "firebase-admin/firestore";

import {
  adminDb,
} from "../../../../../../lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// SOLO_CUSTOMER_CONNECTION_TARGET_V3
async function connectionRefFromState(
  stateRef: any
) {
  const snapshot =
    await stateRef.get();

  const stateData =
    snapshot.exists
      ? snapshot.data() || {}
      : {};

  const customerUid =
    typeof stateData.customerUid ===
      "string"
      ? stateData.customerUid.trim()
      : "";

  if (
    stateData.connectionScope ===
      "customer" &&
    customerUid
  ) {
    return adminDb
      .collection(
        "socialSchedulerConnections"
      )
      .doc(customerUid);
  }

  return adminDb
    .collection(
      "socialPlatformConnections"
    )
    .doc("owner");
}

function encryptionKey() {
  const secret =
    process.env.SOCIAL_PUBLISHER_SECRET || "";

  if (!secret) {
    throw new Error(
      "SOCIAL_PUBLISHER_SECRET_MISSING"
    );
  }

  return createHash("sha256")
    .update(secret)
    .digest();
}

function encrypt(value: string) {
  const iv =
    randomBytes(12);

  const cipher =
    createCipheriv(
      "aes-256-gcm",
      encryptionKey(),
      iv
    );

  const encrypted =
    Buffer.concat([
      cipher.update(
        value,
        "utf8"
      ),
      cipher.final(),
    ]);

  const tag =
    cipher.getAuthTag();

  return [
    iv.toString("base64"),
    tag.toString("base64"),
    encrypted.toString("base64"),
  ].join(".");
}

function redirect(
  request: Request,
  status: string
) {
  const url =
    new URL(
      "/developer/social-scheduler",
      request.url
    );

  url.searchParams.set(
    "youtube",
    status
  );

  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  try {
    const url =
      new URL(request.url);

    const code =
      url.searchParams.get("code") || "";

    const state =
      url.searchParams.get("state") || "";

    const error =
      url.searchParams.get("error") || "";

    if (error) {
      return redirect(
        request,
        "denied"
      );
    }

    if (!code || !state) {
      return redirect(
        request,
        "invalid"
      );
    }

    const stateRef =
      adminDb
        .collection("socialOAuthStates")
        .doc(state);

    const stateSnapshot =
      await stateRef.get();

    if (!stateSnapshot.exists) {
      return redirect(
        request,
        "invalid"
      );
    }

    const stateData =
      stateSnapshot.data() || {};

    if (
      stateData.provider !== "youtube" ||
      stateData.used === true ||
      typeof stateData.expiresAt !== "number" ||
      stateData.expiresAt < Date.now()
    ) {
      return redirect(
        request,
        "expired"
      );
    }

    const clientId =
      process.env.YOUTUBE_CLIENT_ID?.trim();

    const clientSecret =
      process.env.YOUTUBE_CLIENT_SECRET?.trim();

    const redirectUri =
      process.env.YOUTUBE_REDIRECT_URI?.trim();

    if (
      !clientId ||
      !clientSecret ||
      !redirectUri
    ) {
      throw new Error(
        "YOUTUBE_OAUTH_NOT_CONFIGURED"
      );
    }

    const tokenResponse =
      await fetch(
        "https://oauth2.googleapis.com/token",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/x-www-form-urlencoded",
          },
          body:
            new URLSearchParams({
              code,
              client_id:
                clientId,
              client_secret:
                clientSecret,
              redirect_uri:
                redirectUri,
              grant_type:
                "authorization_code",
            }),
        }
      );

    const tokens =
      await tokenResponse.json();

    if (
      !tokenResponse.ok ||
      !tokens.access_token
    ) {
      throw new Error(
        tokens.error_description ||
        tokens.error ||
        "YOUTUBE_TOKEN_EXCHANGE_FAILED"
      );
    }

    const accessToken =
      String(
        tokens.access_token
      );

    const channelResponse =
      await fetch(
        "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
        {
          headers: {
            Authorization:
              `Bearer ${accessToken}`,
          },
        }
      );

    const channelData =
      await channelResponse.json();

    if (
      !channelResponse.ok
    ) {
      throw new Error(
        channelData?.error?.message ||
        "YOUTUBE_CHANNEL_LOOKUP_FAILED"
      );
    }

    const channel =
      Array.isArray(
        channelData.items
      )
        ? channelData.items[0]
        : null;

    const refreshToken =
      typeof tokens.refresh_token ===
      "string"
        ? tokens.refresh_token
        : "";

    if (!refreshToken) {
      throw new Error(
        "YOUTUBE_REFRESH_TOKEN_MISSING"
      );
    }

    await (await connectionRefFromState(stateRef))
      .set(
        {
          youtubeConnected:
            true,

          youtubeChannelId:
            channel?.id ||
            null,

          youtubeChannelTitle:
            channel?.snippet?.title ||
            "Connected YouTube Channel",

          youtubeRefreshTokenEncrypted:
            encrypt(
              refreshToken
            ),

          youtubeScopes:
            typeof tokens.scope ===
            "string"
              ? tokens.scope
              : null,

          youtubeConnectedAt:
            FieldValue.serverTimestamp(),

          updatedAt:
            FieldValue.serverTimestamp(),
        },
        {
          merge: true,
        }
      );

    await stateRef.set(
      {
        used: true,
        usedAt:
          FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    const completedState =
      (await stateRef.get()).data() || {};

    if (
      completedState.connectionScope ===
        "customer"
    ) {
      return NextResponse.redirect(
        new URL(
          "/social-scheduler/connections?youtube=connected",
          request.url
        )
      );
    }

    return redirect(
      request,
      "connected"
    );

  } catch (error) {
    console.error(
      "YouTube OAuth callback error:",
      error
    );

    return redirect(
      request,
      "error"
    );
  }
}


