import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";

import {
  adminBucket,
  adminDb,
  firebaseAdminApp,
} from "../../../../lib/firebaseAdmin";

const MAX_SONG_SIZE = 100 * 1024 * 1024;
const MAX_ARTWORK_SIZE = 10 * 1024 * 1024;
const ALLOWED_DURATIONS = new Set(["7", "14", "30"]);

type UploadFileInfo = {
  name: string;
  type: string;
  size: number;
};

type ArtistSubmissionPayload = {
  action?: "prepare" | "finalize";
  submissionId?: string;
  artistName?: string;
  songTitle?: string;
  genre?: string;
  duration?: string;
  description?: string;
  socialLink?: string;
  youtubeLink?: string;
  songFile?: UploadFileInfo;
  artworkFile?: UploadFileInfo;
  songStoragePath?: string;
  artworkStoragePath?: string;
};

function getBearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeYouTubeLink(value: string): string | null {
  if (!value) return null;

  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    const allowed =
      host === "youtube.com" ||
      host === "www.youtube.com" ||
      host === "m.youtube.com" ||
      host === "youtu.be";

    return allowed ? url.toString() : null;
  } catch {
    return null;
  }
}

function safeFileName(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function validateFile(
  file: UploadFileInfo | undefined,
  kind: "audio" | "image",
  maxSize: number,
  label: string
): string | null {
  if (
    !file ||
    !file.name ||
    !file.type ||
    !Number.isFinite(file.size) ||
    file.size <= 0
  ) {
    return `A valid ${label} file is required.`;
  }

  if (file.size > maxSize) {
    return `The ${label} file exceeds the ${Math.round(
      maxSize / 1024 / 1024
    )} MB limit.`;
  }

  if (!file.type.startsWith(`${kind}/`)) {
    return `The ${label} upload must be a valid ${kind} file.`;
  }

  return null;
}

export async function POST(request: Request) {
  try {
    const idToken = getBearerToken(request);

    if (!idToken) {
      return NextResponse.json(
        {
          success: false,
          error:
            "You must be signed in before submitting music for promotion.",
        },
        { status: 401 }
      );
    }

    const decodedToken = await getAuth(
      firebaseAdminApp
    ).verifyIdToken(idToken);

    const payload =
      (await request.json()) as ArtistSubmissionPayload;

    const action = payload.action || "prepare";
    const artistName = cleanText(payload.artistName);
    const songTitle = cleanText(payload.songTitle);
    const genre = cleanText(payload.genre);
    const duration = cleanText(payload.duration);
    const description = cleanText(payload.description);
    const socialLink = cleanText(payload.socialLink);
    const youtubeLinkInput = cleanText(payload.youtubeLink);
    const youtubeLink = normalizeYouTubeLink(
      youtubeLinkInput
    );

    if (
      !artistName ||
      !songTitle ||
      !genre ||
      !description
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Artist name, song title, genre, and description are required.",
        },
        { status: 400 }
      );
    }

    if (!ALLOWED_DURATIONS.has(duration)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "A valid promotion duration is required.",
        },
        { status: 400 }
      );
    }

    if (youtubeLinkInput && !youtubeLink) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Enter a valid YouTube video link from youtube.com or youtu.be.",
        },
        { status: 400 }
      );
    }

    const songError = validateFile(
      payload.songFile,
      "audio",
      MAX_SONG_SIZE,
      "song"
    );
    const artworkError = validateFile(
      payload.artworkFile,
      "image",
      MAX_ARTWORK_SIZE,
      "artwork"
    );

    if (songError || artworkError) {
      return NextResponse.json(
        {
          success: false,
          error: songError || artworkError,
        },
        { status: 400 }
      );
    }

    if (action === "prepare") {
      const submissionId = adminDb
        .collection("artistPromotionSubmissions")
        .doc().id;

      const basePath =
        `artist-promotion/${decodedToken.uid}/${submissionId}`;

      const songStoragePath =
        `${basePath}/song-${safeFileName(
          payload.songFile!.name
        )}`;

      const artworkStoragePath =
        `${basePath}/artwork-${safeFileName(
          payload.artworkFile!.name
        )}`;

      const [songUploadUrl] = await adminBucket
        .file(songStoragePath)
        .getSignedUrl({
          action: "write",
          expires: Date.now() + 15 * 60 * 1000,
          contentType: payload.songFile!.type,
        });

      const [artworkUploadUrl] = await adminBucket
        .file(artworkStoragePath)
        .getSignedUrl({
          action: "write",
          expires: Date.now() + 15 * 60 * 1000,
          contentType: payload.artworkFile!.type,
        });

      return NextResponse.json({
        success: true,
        submissionId,
        songStoragePath,
        artworkStoragePath,
        songUploadUrl,
        artworkUploadUrl,
      });
    }

    if (action !== "finalize") {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid submission action.",
        },
        { status: 400 }
      );
    }

    const submissionId = cleanText(payload.submissionId);
    const songStoragePath = cleanText(
      payload.songStoragePath
    );
    const artworkStoragePath = cleanText(
      payload.artworkStoragePath
    );

    const expectedPrefix =
      `artist-promotion/${decodedToken.uid}/${submissionId}/`;

    if (
      !submissionId ||
      !songStoragePath.startsWith(expectedPrefix) ||
      !artworkStoragePath.startsWith(expectedPrefix)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid upload information.",
        },
        { status: 400 }
      );
    }

    const [[songExists], [artworkExists]] =
      await Promise.all([
        adminBucket.file(songStoragePath).exists(),
        adminBucket.file(artworkStoragePath).exists(),
      ]);

    if (!songExists || !artworkExists) {
      return NextResponse.json(
        {
          success: false,
          error:
            "The files did not finish uploading. Please try again.",
        },
        { status: 400 }
      );
    }

    const submissionRef = adminDb
      .collection("artistPromotionSubmissions")
      .doc(submissionId);

    await submissionRef.set({
      submissionId,
      artistUid: decodedToken.uid,
      artistAccountEmail: decodedToken.email || null,
      artistAccountName: decodedToken.name || null,
      artistName,
      songTitle,
      genre,
      description,
      socialLink: socialLink || null,
      youtubeLink,
      promotionDurationDays: Number(duration),
      songStoragePath,
      songOriginalName: payload.songFile!.name,
      songContentType: payload.songFile!.type,
      songSize: payload.songFile!.size,
      artworkStoragePath,
      artworkOriginalName: payload.artworkFile!.name,
      artworkContentType: payload.artworkFile!.type,
      artworkSize: payload.artworkFile!.size,
      reviewStatus: "pending",
      paymentStatus: "not_requested",
      placementStatus: "not_scheduled",
      sponsoredLabel: "Promoted",
      source:
        "solo-beats-engine-music-artist-promotion",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    await adminDb
      .collection("ownerNotifications")
      .doc(`artist-promotion-${submissionId}`)
      .set({
        type: "artist_promotion_submission",
        category: "artist_promotions",
        title: "New artist promotion submission",
        message: `${artistName} submitted "${songTitle}" for promotion.`,
        targetUrl:
          `/developer/artist-promotions?submissionId=${encodeURIComponent(
            submissionId
          )}`,
        relatedId: submissionId,
        submissionId,
        artistName,
        songTitle,
        genre,
        read: false,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

    return NextResponse.json({
      success: true,
      submissionId,
      reviewStatus: "pending",
      message:
        "Your promotion submission was received and is waiting for owner review.",
    });
  } catch (error) {
    console.error(
      "Artist promotion submission error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "The promotion submission could not be completed.",
      },
      { status: 500 }
    );
  }
}
