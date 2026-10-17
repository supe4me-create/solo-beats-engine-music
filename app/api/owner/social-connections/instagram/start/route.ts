import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { randomUUID } from "crypto";
import { FieldValue } from "firebase-admin/firestore";

import {
  adminDb,
  firebaseAdminApp,
} from "../../../../../../lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OWNER_EMAIL = (
  process.env.OWNER_EMAIL ||
  process.env.NEXT_PUBLIC_OWNER_EMAIL ||
  "supe4.me@gmail.com"
).trim().toLowerCase();

function bearer(request: Request) {
  return (
    request.headers
      .get("authorization")
      ?.match(/^Bearer\s+(.+)$/i)?.[1]
      ?.trim() || null
  );
}

async function verifyOwner(request: Request) {
  const token = bearer(request);

  if (!token) {
    throw new Error("OWNER_AUTH_REQUIRED");
  }

  const decoded =
    await getAuth(firebaseAdminApp)
      .verifyIdToken(token);

  const email =
    typeof decoded.email === "string"
      ? decoded.email.trim().toLowerCase()
      : "";

  if (email !== OWNER_EMAIL) {
    throw new Error("OWNER_ONLY");
  }

  return decoded;
}

export async function POST(request: Request) {
  try {
    const owner =
      await verifyOwner(request);

    const appId =
      process.env.INSTAGRAM_APP_ID?.trim() ||
      "1394720918748316";

    const redirectUri =
      process.env.META_REDIRECT_URI?.trim();

    if (!appId || !redirectUri) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Instagram credentials are not configured yet.",
        },
        { status: 400 }
      );
    }

    const state =
      randomUUID();

    await adminDb
      .collection("socialOAuthStates")
      .doc(state)
      .set({
        provider: "instagram",
        ownerUid: owner.uid,
        ownerEmail: owner.email || null,
        used: false,
        createdAt:
          FieldValue.serverTimestamp(),
        expiresAt:
          Date.now() + 10 * 60 * 1000,
      });

    const authUrl =
      new URL(
        "https://www.instagram.com/oauth/authorize"
      );

    authUrl.searchParams.set(
      "force_reauth",
      "true"
    );

    authUrl.searchParams.set(
      "enable_fb_login",
      "false"
    );

    authUrl.searchParams.set(
      "client_id",
      appId
    );

    authUrl.searchParams.set(
      "redirect_uri",
      redirectUri
    );

    authUrl.searchParams.set(
    "response_type",
    "code"
  );

  // SOLO_INSTAGRAM_FORCE_AUTH_V1
  authUrl.searchParams.set(
    "force_authentication",
    "1"
  );

    authUrl.searchParams.set(
      "scope",
      [
        "instagram_business_basic",
        "instagram_business_manage_messages",
        "instagram_business_manage_comments",
        "instagram_business_content_publish",
        "instagram_business_manage_insights",
      ].join(",")
    );

    authUrl.searchParams.set(
      "state",
      state
    );

    return NextResponse.json({
      success: true,
      authUrl:
        authUrl.toString(),
    });

  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "";

    return NextResponse.json(
      {
        success: false,
        error:
          message === "OWNER_AUTH_REQUIRED"
            ? "Owner sign-in required."
            : message === "OWNER_ONLY"
              ? "Owner access only."
              : "Instagram connection could not start.",
      },
      {
        status:
          message === "OWNER_AUTH_REQUIRED"
            ? 401
            : message === "OWNER_ONLY"
              ? 403
              : 500,
      }
    );
  }
}


