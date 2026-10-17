import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { randomBytes } from "crypto";

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
)
  .trim()
  .toLowerCase();

function bearer(request: Request) {
  return (
    request.headers
      .get("authorization")
      ?.match(/^Bearer\s+(.+)$/i)?.[1]
      ?.trim() || null
  );
}

async function verifyOwner(
  request: Request
) {
  const token =
    bearer(request);

  if (!token) {
    throw new Error(
      "OWNER_AUTH_REQUIRED"
    );
  }

  const decoded =
    await getAuth(
      firebaseAdminApp
    ).verifyIdToken(token);

  const email =
    typeof decoded.email === "string"
      ? decoded.email
          .trim()
          .toLowerCase()
      : "";

  if (email !== OWNER_EMAIL) {
    throw new Error(
      "OWNER_ONLY"
    );
  }

  return decoded;
}

export async function POST(
  request: Request
) {
  try {
    await verifyOwner(request);

    const clientKey =
      process.env
        .TIKTOK_CLIENT_KEY
        ?.trim();

    const redirectUri =
      process.env
        .TIKTOK_REDIRECT_URI
        ?.trim();

    if (
      !clientKey ||
      !redirectUri
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "TikTok credentials are not configured yet.",
        },
        {
          status: 500,
        }
      );
    }

    const state =
      randomBytes(24)
        .toString("hex");

    await adminDb
      .collection(
        "socialOauthStates"
      )
      .doc(
        `tiktok-${state}`
      )
      .set({
        provider:
          "tiktok",

        state,

        createdAt:
          Date.now(),

        expiresAt:
          Date.now() +
          10 * 60 * 1000,
      });

    const params =
      new URLSearchParams({
        client_key:
          clientKey,

        response_type:
          "code",

        scope:
          [
            "user.info.basic",
            "video.upload",
            "video.publish",
          ].join(","),

        redirect_uri:
          redirectUri,

        state,
      });

    return NextResponse.json({
      success: true,

      authUrl:
        "https://www.tiktok.com/v2/auth/authorize/?" +
        params.toString(),
    });

  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "";

    if (
      message ===
        "OWNER_AUTH_REQUIRED" ||
      message ===
        "OWNER_ONLY"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Owner access only.",
        },
        {
          status:
            message ===
            "OWNER_AUTH_REQUIRED"
              ? 401
              : 403,
        }
      );
    }

    console.error(
      "TikTok connect start error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "TikTok connection could not start.",
      },
      {
        status: 500,
      }
    );
  }
}
