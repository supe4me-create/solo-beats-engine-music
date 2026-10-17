import { NextResponse } from "next/server";
import {
  createCipheriv,
  createHash,
  randomBytes,
} from "crypto";
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
      cipher.update(value, "utf8"),
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
    "meta",
    status
  );

  return NextResponse.redirect(url);
}


// SOLO_CUSTOMER_META_ERROR_ROUTING_V2
async function redirectMetaByRequestState(
  request: Request,
  status: string
) {
  try {
    const requestUrl =
      new URL(request.url);

    const state =
      requestUrl.searchParams
        .get("state")
        ?.trim() || "";

    if (state) {
      const snapshot =
        await adminDb
          .collection(
            "socialOAuthStates"
          )
          .doc(state)
          .get();

      const stateData =
        snapshot.exists
          ? snapshot.data() || {}
          : {};

      if (
        stateData.connectionScope ===
          "customer" &&
        typeof stateData.customerUid ===
          "string" &&
        stateData.customerUid.trim()
      ) {
        const provider =
          stateData.provider ===
            "instagram"
            ? "instagram"
            : "facebook";

        const customerUrl =
          new URL(
            "/social-scheduler/connections",
            request.url
          );

        customerUrl.searchParams.set(
          provider,
          status
        );

        return NextResponse.redirect(
          customerUrl
        );
      }
    }
  } catch (error) {
    console.error(
      "Customer Meta redirect routing error:",
      error
    );
  }

  return redirect(
    request,
    status
  );
}
async function handleInstagram(
  request: Request,
  code: string,
  stateRef: FirebaseFirestore.DocumentReference
) {
  const appId =
    process.env.INSTAGRAM_APP_ID?.trim();

  const appSecret =
    process.env.INSTAGRAM_APP_SECRET?.trim();

  const redirectUri =
    process.env.INSTAGRAM_REDIRECT_URI?.trim();


  if (
    !appId ||
    !appSecret ||
    !redirectUri
  ) {
    throw new Error(
      "INSTAGRAM_OAUTH_NOT_CONFIGURED"
    );
  }

  /*
   * Instagram Business Login authorization codes are exchanged
   * through api.instagram.com rather than the Facebook OAuth
   * token endpoint.
   */
  const form =
    new URLSearchParams();

  form.set(
    "client_id",
    appId
  );

  form.set(
    "client_secret",
    appSecret
  );

  form.set(
    "grant_type",
    "authorization_code"
  );

  form.set(
    "redirect_uri",
    redirectUri
  );

  form.set(
    "code",
    code
  );

  const tokenResponse =
    await fetch(
      "https://api.instagram.com/oauth/access_token",
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded",
        },
        body:
          form.toString(),
        cache: "no-store",
      }
    );

  const tokenData =
    await tokenResponse.json();

  if (
    !tokenResponse.ok ||
    typeof tokenData.access_token !== "string"
  ) {
    throw new Error(
      tokenData?.error_message ||
      tokenData?.error?.message ||
      "INSTAGRAM_TOKEN_EXCHANGE_FAILED"
    );
  }

  let accessToken =
    String(
      tokenData.access_token
    );

  let expiresIn: number | null =
    typeof tokenData.expires_in === "number"
      ? tokenData.expires_in
      : null;

  /*
   * Exchange short-lived token for long-lived token.
   * If Meta declines the exchange, the valid short-lived
   * token is retained instead of destroying the connection.
   */
  try {
    const longUrl =
      new URL(
        "https://graph.instagram.com/access_token"
      );

    longUrl.searchParams.set(
      "grant_type",
      "ig_exchange_token"
    );

    longUrl.searchParams.set(
      "client_secret",
      appSecret
    );

    longUrl.searchParams.set(
      "access_token",
      accessToken
    );

    const longResponse =
      await fetch(
        longUrl,
        {
          cache: "no-store",
        }
      );

    const longData =
      await longResponse.json();

    if (
      longResponse.ok &&
      typeof longData.access_token === "string"
    ) {
      accessToken =
        String(
          longData.access_token
        );

      expiresIn =
        typeof longData.expires_in === "number"
          ? longData.expires_in
          : expiresIn;
    }
  } catch (error) {
    console.warn(
      "INSTAGRAM LONG TOKEN EXCHANGE WARNING:",
      error
    );
  }

  /*
   * Read the Instagram professional account identity.
   */
  const profileUrl =
    new URL(
      "https://graph.instagram.com/me"
    );

  profileUrl.searchParams.set(
    "fields",
    "id,user_id,username"
  );

  profileUrl.searchParams.set(
    "access_token",
    accessToken
  );

  const profileResponse =
    await fetch(
      profileUrl,
      {
        cache: "no-store",
      }
    );

  const profileData =
    await profileResponse.json();

  if (!profileResponse.ok) {
    throw new Error(
      profileData?.error?.message ||
      "INSTAGRAM_PROFILE_LOOKUP_FAILED"
    );
  }

  const instagramAccountId =
    typeof profileData.user_id === "string"
      ? profileData.user_id
      : typeof profileData.user_id === "number"
        ? String(profileData.user_id)
        : typeof profileData.id === "string"
          ? profileData.id
          : typeof tokenData.user_id === "number"
            ? String(tokenData.user_id)
            : typeof tokenData.user_id === "string"
              ? tokenData.user_id
              : "";

  if (!instagramAccountId) {
    throw new Error(
      "INSTAGRAM_ACCOUNT_ID_MISSING"
    );
  }

  const username =
    typeof profileData.username === "string"
      ? profileData.username
      : null;

  const expiresAt =
    typeof expiresIn === "number"
      ? Date.now() + expiresIn * 1000
      : null;

  await (await connectionRefFromState(stateRef))
    .set(
      {
        instagramConnected:
          true,

        instagramAccountId,

        instagramUsername:
          username,

        instagramAccessTokenEncrypted:
          encrypt(
            accessToken
          ),

        instagramTokenExpiresAt:
          expiresAt,

        instagramConnectedAt:
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
    {
      merge: true,
    }
  );

  const completedState =
    (await stateRef.get()).data() || {};

  if (
    completedState.connectionScope ===
      "customer"
  ) {
    return NextResponse.redirect(
      new URL(
        "/social-scheduler/connections?instagram=connected",
        request.url
      )
    );
  }

  return redirect(
    request,
    "instagram-connected"
  );
}

async function handleFacebook(
  request: Request,
  code: string,
  stateRef: FirebaseFirestore.DocumentReference
) {
  const appId =
    process.env.META_APP_ID?.trim();

  const appSecret =
    process.env.META_APP_SECRET?.trim();

  const redirectUri =
    process.env.META_REDIRECT_URI?.trim();

  const version =
    process.env.META_GRAPH_VERSION?.trim() ||
    "v23.0";

  if (
    !appId ||
    !appSecret ||
    !redirectUri
  ) {
    throw new Error(
      "META_OAUTH_NOT_CONFIGURED"
    );
  }

  const tokenUrl =
    new URL(
      `https://graph.facebook.com/${version}/oauth/access_token`
    );

  tokenUrl.searchParams.set(
    "client_id",
    appId
  );

  tokenUrl.searchParams.set(
    "client_secret",
    appSecret
  );

  tokenUrl.searchParams.set(
    "redirect_uri",
    redirectUri
  );

  tokenUrl.searchParams.set(
    "code",
    code
  );

  const tokenResponse =
    await fetch(
      tokenUrl,
      {
        cache: "no-store",
      }
    );

  const tokenData =
    await tokenResponse.json();

  if (
    !tokenResponse.ok ||
    typeof tokenData.access_token !== "string"
  ) {
    throw new Error(
      tokenData?.error?.message ||
      "META_TOKEN_EXCHANGE_FAILED"
    );
  }

  let userAccessToken =
    String(
      tokenData.access_token
    );

  const longTokenUrl =
    new URL(
      `https://graph.facebook.com/${version}/oauth/access_token`
    );

  longTokenUrl.searchParams.set(
    "grant_type",
    "fb_exchange_token"
  );

  longTokenUrl.searchParams.set(
    "client_id",
    appId
  );

  longTokenUrl.searchParams.set(
    "client_secret",
    appSecret
  );

  longTokenUrl.searchParams.set(
    "fb_exchange_token",
    userAccessToken
  );

  const longResponse =
    await fetch(
      longTokenUrl,
      {
        cache: "no-store",
      }
    );

  const longData =
    await longResponse.json();

  if (
    longResponse.ok &&
    typeof longData.access_token === "string"
  ) {
    userAccessToken =
      String(
        longData.access_token
      );
  }

  const accountsUrl =
    new URL(
      `https://graph.facebook.com/${version}/me/accounts`
    );

  accountsUrl.searchParams.set(
    "fields",
    "id,name,access_token,instagram_business_account{id,username}"
  );

  accountsUrl.searchParams.set(
    "limit",
    "100"
  );

  accountsUrl.searchParams.set(
    "access_token",
    userAccessToken
  );

  const accountsResponse =
    await fetch(
      accountsUrl,
      {
        cache: "no-store",
      }
    );

  const accountsData =
    await accountsResponse.json();

  if (!accountsResponse.ok) {
    throw new Error(
      accountsData?.error?.message ||
      "META_PAGE_LOOKUP_FAILED"
    );
  }

  const pages =
    Array.isArray(accountsData.data)
      ? accountsData.data
      : [];

  if (pages.length === 0) {
    throw new Error(
      "NO_FACEBOOK_PAGES_AVAILABLE"
    );
  }

  const preferred =
    pages.find(
      (page: any) =>
        typeof page?.name === "string" &&
        /solo\s*beats/i.test(page.name)
    ) ||
    pages.find(
      (page: any) =>
        page?.instagram_business_account?.id
    ) ||
    pages[0];

  if (
    !preferred ||
    typeof preferred.id !== "string" ||
    typeof preferred.access_token !== "string"
  ) {
    throw new Error(
      "FACEBOOK_PAGE_TOKEN_MISSING"
    );
  }

  /*
   * IMPORTANT:
   * Facebook connection remains intact.
   *
   * Do NOT overwrite the dedicated Instagram token here.
   * The Instagram card now has its own Business Login flow.
   */
  await (await connectionRefFromState(stateRef))
    .set(
      {
        facebookConnected:
          true,

        facebookPageId:
          preferred.id,

        facebookPageName:
          typeof preferred.name === "string"
            ? preferred.name
            : "Facebook Page",

        facebookPageAccessTokenEncrypted:
          encrypt(
            preferred.access_token
          ),

        metaUserAccessTokenEncrypted:
          encrypt(
            userAccessToken
          ),

        metaConnectedAt:
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
    {
      merge: true,
    }
  );

  const completedState =
    (await stateRef.get()).data() || {};

  if (
    completedState.connectionScope ===
      "customer"
  ) {
    return NextResponse.redirect(
      new URL(
        "/social-scheduler/connections?facebook=connected",
        request.url
      )
    );
  }

  return redirect(
    request,
    "facebook-connected"
  );
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

    const errorReason =
      url.searchParams.get("error_reason") || "";

    if (error || errorReason) {
      return await redirectMetaByRequestState(
        request,
        "denied"
      );
    }

    if (!code || !state) {
      return await redirectMetaByRequestState(
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
      return await redirectMetaByRequestState(
        request,
        "invalid"
      );
    }

    const stateData =
      stateSnapshot.data() || {};

    if (
      stateData.used === true ||
      typeof stateData.expiresAt !== "number" ||
      stateData.expiresAt < Date.now()
    ) {
      return await redirectMetaByRequestState(
        request,
        "expired"
      );
    }

    if (
      stateData.provider === "instagram"
    ) {
      return await handleInstagram(
        request,
        code,
        stateRef
      );
    }

    if (
      stateData.provider === "meta"
    ) {
      return await handleFacebook(
        request,
        code,
        stateRef
      );
    }

    return await redirectMetaByRequestState(
        request,
        "invalid"
      );

  } catch (error) {
    console.error(
      "SOCIAL OAUTH CALLBACK ERROR:",
      error
    );

    return await redirectMetaByRequestState(
        request,
        "error"
      );
  }
}







