import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";

import {
  firebaseAdminApp,
} from "../../../../../lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  return decoded;
}

function youtubeVideoId(input: string) {
  try {
    const url = new URL(input);

    if (
      url.hostname === "youtu.be" ||
      url.hostname === "www.youtu.be"
    ) {
      return url.pathname
        .replace(/^\/+/, "")
        .split("/")[0]
        ?.trim() || "";
    }

    if (
      url.hostname === "youtube.com" ||
      url.hostname === "www.youtube.com" ||
      url.hostname === "m.youtube.com"
    ) {
      if (url.pathname.startsWith("/shorts/")) {
        return url.pathname
          .split("/shorts/")[1]
          ?.split("/")[0]
          ?.trim() || "";
      }

      if (url.pathname.startsWith("/embed/")) {
        return url.pathname
          .split("/embed/")[1]
          ?.split("/")[0]
          ?.trim() || "";
      }

      return url.searchParams
        .get("v")
        ?.trim() || "";
    }

    return "";
  } catch {
    return "";
  }
}

export async function POST(request: Request) {
  try {
    await verifyOwner(request);

    const body = await request.json();

    const videoUrl =
      typeof body?.videoUrl === "string"
        ? body.videoUrl.trim()
        : "";

    const videoId =
      youtubeVideoId(videoUrl);

    if (!videoUrl || !videoId) {
      return NextResponse.json(
        {
          success: false,
          error: "INVALID_YOUTUBE_VIDEO_LINK",
        },
        { status: 400 }
      );
    }

    const canonicalUrl =
      `https://www.youtube.com/watch?v=${encodeURIComponent(
        videoId
      )}`;

    const response = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(
        canonicalUrl
      )}&format=json`,
      {
        cache: "no-store",
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          error: "YOUTUBE_VIDEO_NOT_AVAILABLE",
        },
        { status: 400 }
      );
    }

    const data = await response.json();

    return NextResponse.json({
      success: true,
      videoId,
      canonicalUrl,
      embedUrl:
        `https://www.youtube.com/embed/${videoId}`,
      title:
        typeof data?.title === "string"
          ? data.title
          : "",
      authorName:
        typeof data?.author_name === "string"
          ? data.author_name
          : "",
      thumbnailUrl:
        typeof data?.thumbnail_url === "string"
          ? data.thumbnail_url
          : "",
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "YOUTUBE_PREVIEW_FAILED";

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      {
        status:
          message === "OWNER_AUTH_REQUIRED"
            ? 401
            : 500,
      }
    );
  }
}