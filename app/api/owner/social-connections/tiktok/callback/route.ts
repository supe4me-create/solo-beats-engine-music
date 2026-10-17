import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  createCipheriv,
  createHash,
  randomBytes,
} from "crypto";

import {
  FieldValue,
} from "firebase-admin/firestore";

import {
  adminDb,
} from "../../../../../../lib/firebaseAdmin";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";
// SOLO_TIKTOK_CUSTOMER_STORAGE_FIX_V1
function connectionRefFromStateData(
  stateData: any
) {
  const customerUid =
    typeof stateData?.customerUid ===
    "string"
      ? stateData.customerUid.trim()
      : "";

  if (
    stateData?.connectionScope ===
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
    process.env
      .SOCIAL_PUBLISHER_SECRET ||
    "";

  if (!secret) {
    throw new Error(
      "SOCIAL_PUBLISHER_SECRET_MISSING"
    );
  }

  return createHash(
    "sha256"
  )
    .update(secret)
    .digest();
}

function encrypt(
  value: string
) {
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

export async function GET(
  request: NextRequest
) {
  const home =
    "https://www.solobeatsenginemusic.com/developer/social-scheduler";

  try {
    const code =
      request.nextUrl
        .searchParams
        .get("code")
        ?.trim() || "";

    const state =
      request.nextUrl
        .searchParams
        .get("state")
        ?.trim() || "";

    const oauthError =
      request.nextUrl
        .searchParams
        .get("error")
        ?.trim() || "";

    if (oauthError) {
      return NextResponse.redirect(
        `${home}?tiktok=error`
      );
    }

    if (
      !code ||
      !state
    ) {
      return NextResponse.redirect(
        `${home}?tiktok=missing`
      );
    }

    const stateRef =
      adminDb
        .collection(
          "socialOauthStates"
        )
        .doc(
          `tiktok-${state}`
        );

    const stateSnapshot =
      await stateRef.get();

    if (
      !stateSnapshot.exists
    ) {
      return NextResponse.redirect(
        `${home}?tiktok=state-error`
      );
    }

    const stateData =
      stateSnapshot.data() || {};

    const expiresAt =
      Number(
        stateData.expiresAt
      );

    await stateRef.delete();

    if (
      !expiresAt ||
      expiresAt < Date.now()
    ) {
      return NextResponse.redirect(
        `${home}?tiktok=state-expired`
      );
    }

    const clientKey =
      process.env
        .TIKTOK_CLIENT_KEY
        ?.trim();

    const clientSecret =
      process.env
        .TIKTOK_CLIENT_SECRET
        ?.trim();

    const redirectUri =
      process.env
        .TIKTOK_REDIRECT_URI
        ?.trim();

    if (
      !clientKey ||
      !clientSecret ||
      !redirectUri
    ) {
      throw new Error(
        "TIKTOK_OAUTH_ENV_MISSING"
      );
    }

    const tokenResponse =
      await fetch(
        "https://open.tiktokapis.com/v2/oauth/token/",
        {
          method:
            "POST",

          headers: {
            "Content-Type":
              "application/x-www-form-urlencoded",
          },

          body:
            new URLSearchParams({
              client_key:
                clientKey,

              client_secret:
                clientSecret,

              code,

              grant_type:
                "authorization_code",

              redirect_uri:
                redirectUri,
            }),
        }
      );

    const tokenData =
      await tokenResponse.json();

    if (
      !tokenResponse.ok ||
      !tokenData?.access_token
    ) {
      console.error(
        "TikTok token response:",
        tokenData
      );

      throw new Error(
        "TIKTOK_TOKEN_EXCHANGE_FAILED"
      );
    }

    const accessToken =
      String(
        tokenData.access_token
      );

    const refreshToken =
      typeof tokenData.refresh_token ===
      "string"
        ? tokenData.refresh_token
        : "";

    const expiresIn =
      Number(
        tokenData.expires_in
      ) || 86400;

    const refreshExpiresIn =
      Number(
        tokenData.refresh_expires_in
      ) || 0;

    const openId =
      typeof tokenData.open_id ===
      "string"
        ? tokenData.open_id
        : "";

    const scope =
      typeof tokenData.scope ===
      "string"
        ? tokenData.scope
        : "";

    let displayName = "";
    let username = "";

    try {
      const userResponse =
        await fetch(
          "https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,username,avatar_url",
          {
            headers: {
              Authorization:
                `Bearer ${accessToken}`,
            },
          }
        );

      const userData =
        await userResponse.json();

      displayName =
        typeof userData
          ?.data
          ?.user
          ?.display_name ===
        "string"
          ? userData.data.user.display_name
          : "";

      username =
        typeof userData
          ?.data
          ?.user
          ?.username ===
        "string"
          ? userData.data.user.username
          : "";

    } catch (error) {
      console.warn(
        "TikTok user-info warning:",
        error
      );
    }

    await connectionRefFromStateData(stateData)
      .set(
        {
          tiktokConnected:
            true,

          tiktokAccessTokenEncrypted:
            encrypt(
              accessToken
            ),

          tiktokRefreshTokenEncrypted:
            refreshToken
              ? encrypt(
                  refreshToken
                )
              : null,

          tiktokOpenId:
            openId,

          tiktokScope:
            scope,

          tiktokDisplayName:
            displayName,

          tiktokUsername:
            username,

          tiktokAccessTokenExpiresAt:
            Date.now() +
            expiresIn * 1000,

          tiktokRefreshTokenExpiresAt:
            refreshExpiresIn
              ? Date.now() +
                refreshExpiresIn *
                  1000
              : null,

          tiktokConnectedAt:
            FieldValue
              .serverTimestamp(),

          updatedAt:
            FieldValue
              .serverTimestamp(),
        },
        {
          merge: true,
        }
      );

    if (
      stateData.connectionScope ===
        "customer"
    ) {
      return NextResponse.redirect(
        new URL(
          "/social-scheduler/connections?tiktok=connected",
          request.url
        )
      );
    }

    return NextResponse.redirect(
      `${home}?tiktok=connected`
    );

  } catch (error) {
    console.error(
      "TikTok callback error:",
      error
    );

    return NextResponse.redirect(
      `${home}?tiktok=callback-error`
    );
  }
}



