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
      ? decoded.email.toLowerCase()
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

    const clientId =
      process.env.YOUTUBE_CLIENT_ID?.trim();

    const redirectUri =
      process.env.YOUTUBE_REDIRECT_URI?.trim();

    if (!clientId || !redirectUri) {
      return NextResponse.json(
        {
          success: false,
          error:
            "YouTube OAuth credentials are not configured yet.",
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
        provider: "youtube",
        ownerUid: owner.uid,
        ownerEmail:
          owner.email || null,
        used: false,
        createdAt:
          FieldValue.serverTimestamp(),
        expiresAt:
          Date.now() +
          10 * 60 * 1000,
      });

    const authUrl =
      new URL(
        "https://accounts.google.com/o/oauth2/v2/auth"
      );

    authUrl.searchParams.set(
      "client_id",
      clientId
    );

    authUrl.searchParams.set(
      "redirect_uri",
      redirectUri
    );

    authUrl.searchParams.set(
      "response_type",
      "code"
    );

    authUrl.searchParams.set(
      "access_type",
      "offline"
    );

    authUrl.searchParams.set(
      "prompt",
      "consent"
    );

    authUrl.searchParams.set(
      "state",
      state
    );

    authUrl.searchParams.set(
      "scope",
      [
        "https://www.googleapis.com/auth/youtube.upload",
        "https://www.googleapis.com/auth/youtube.readonly",
      ].join(" ")
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
              : "YouTube connection could not start.",
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
