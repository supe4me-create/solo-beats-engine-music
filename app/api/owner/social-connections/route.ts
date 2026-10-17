import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";

import {
  adminDb,
  firebaseAdminApp,
} from "../../../../lib/firebaseAdmin";

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
}

function configured(...values: Array<string | undefined>) {
  return values.every(
    value =>
      typeof value === "string" &&
      value.trim().length > 0
  );
}

export async function GET(request: Request) {
  try {
    await verifyOwner(request);

    const connectionRef =
      adminDb
        .collection("socialPlatformConnections")
        .doc("owner");

    const snapshot =
      await connectionRef.get();

    const stored =
      snapshot.exists
        ? snapshot.data() || {}
        : {};

    const youtubeConfigured =
      configured(
        process.env.YOUTUBE_CLIENT_ID,
        process.env.YOUTUBE_CLIENT_SECRET,
        process.env.YOUTUBE_REDIRECT_URI
      );

    const metaConfigured =
      configured(
        process.env.META_APP_ID,
        process.env.META_APP_SECRET,
        process.env.META_REDIRECT_URI
      );

    const instagramConfigured =
      configured(
        process.env.INSTAGRAM_APP_ID ||
          "1394720918748316",
        process.env.INSTAGRAM_APP_SECRET ||
          process.env.META_APP_SECRET,
        process.env.META_REDIRECT_URI
      );

    const tiktokConfigured =
      configured(
        process.env.TIKTOK_CLIENT_KEY,
        process.env.TIKTOK_CLIENT_SECRET,
        process.env.TIKTOK_REDIRECT_URI
      );

    const instagramTokenStored =
      typeof stored.instagramAccessTokenEncrypted === "string" &&
      stored.instagramAccessTokenEncrypted.trim().length > 0;

    const instagramConnected =
      stored.instagramConnected === true ||
      instagramTokenStored;

    return NextResponse.json({
      success: true,

      youtube: {
        configured:
          youtubeConfigured,

        connected:
          stored.youtubeConnected === true,

        channelTitle:
          typeof stored.youtubeChannelTitle === "string"
            ? stored.youtubeChannelTitle
            : null,
      },

      facebook: {
        configured:
          metaConfigured,

        connected:
          stored.facebookConnected === true,

        pageName:
          typeof stored.facebookPageName === "string"
            ? stored.facebookPageName
            : null,
      },

      instagram: {
        configured:
          instagramConfigured ||
          instagramConnected,

        connected:
          instagramConnected,

        username:
          typeof stored.instagramUsername === "string"
            ? stored.instagramUsername
            : null,
      },

      tiktok: {
        configured:
          tiktokConfigured,

        connected:
          stored.tiktokConnected === true,

        username:
          typeof stored.tiktokUsername === "string"
            ? stored.tiktokUsername
            : null,

        displayName:
          typeof stored.tiktokDisplayName === "string"
            ? stored.tiktokDisplayName
            : null,
      },
    });

  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "";

    if (
      message === "OWNER_AUTH_REQUIRED" ||
      message === "OWNER_ONLY"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Owner access only.",
        },
        {
          status:
            message === "OWNER_AUTH_REQUIRED"
              ? 401
              : 403,
        }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error:
          "Social connection status could not be loaded.",
      },
      { status: 500 }
    );
  }
}


