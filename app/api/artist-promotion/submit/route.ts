import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";

import {
  adminBucket,
  adminDb,
  firebaseAdminApp,
} from "../../../../lib/firebaseAdmin";

const MAX_SONG_SIZE =
  100 * 1024 * 1024;
const MAX_ARTWORK_SIZE =
  10 * 1024 * 1024;

const ALLOWED_DURATIONS =
  new Set(["7", "14", "30"]);

function getBearerToken(
  request: Request
): string | null {
  const authorization =
    request.headers.get("authorization");

  if (!authorization) {
    return null;
  }

  const match =
    authorization.match(
      /^Bearer\s+(.+)$/i
    );

  return match?.[1]?.trim() || null;
}

function cleanText(
  value: FormDataEntryValue | null
): string {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function normalizeYouTubeLink(
  value: string
): string | null {
  if (!value) return null;

  try {
    const url = new URL(value);
    const host =
      url.hostname.toLowerCase();

    const allowed =
      host === "youtube.com" ||
      host === "www.youtube.com" ||
      host === "m.youtube.com" ||
      host === "youtu.be";

    if (!allowed) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

function safeFileName(
  value: string
): string {
  return value
    .normalize("NFKD")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

export async function POST(
  request: Request
) {
  try {
    const idToken =
      getBearerToken(request);

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

    const decodedToken =
      await getAuth(
        firebaseAdminApp
      ).verifyIdToken(idToken);

    const formData =
      await request.formData();

    const artistName =
      cleanText(
        formData.get("artistName")
      );
    const songTitle =
      cleanText(
        formData.get("songTitle")
      );
    const genre =
      cleanText(
        formData.get("genre")
      );
    const duration =
      cleanText(
        formData.get("duration")
      );
    const description =
      cleanText(
        formData.get("description")
      );
    const socialLink =
      cleanText(
        formData.get("socialLink")
      );
    const youtubeLinkInput =
      cleanText(
        formData.get("youtubeLink")
      );
    const youtubeLink =
      normalizeYouTubeLink(
        youtubeLinkInput
      );

    const songFile =
      formData.get("songFile");
    const artworkFile =
      formData.get("artworkFile");

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

    if (
      youtubeLinkInput &&
      !youtubeLink
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Enter a valid YouTube video link from youtube.com or youtu.be.",
        },
        { status: 400 }
      );
    }

    if (
      !ALLOWED_DURATIONS.has(
        duration
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "A valid promotion duration is required.",
        },
        { status: 400 }
      );
    }

    if (
      !(songFile instanceof File) ||
      songFile.size === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "A valid song file is required.",
        },
        { status: 400 }
      );
    }

    if (
      !(artworkFile instanceof File) ||
      artworkFile.size === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "A valid artwork file is required.",
        },
        { status: 400 }
      );
    }

    if (
      songFile.size >
      MAX_SONG_SIZE
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "The song file exceeds the 100 MB limit.",
        },
        { status: 400 }
      );
    }

    if (
      artworkFile.size >
      MAX_ARTWORK_SIZE
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "The artwork file exceeds the 10 MB limit.",
        },
        { status: 400 }
      );
    }

    if (
      !songFile.type.startsWith(
        "audio/"
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "The song upload must be an audio file.",
        },
        { status: 400 }
      );
    }

    if (
      !artworkFile.type.startsWith(
        "image/"
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "The artwork upload must be an image file.",
        },
        { status: 400 }
      );
    }

    const submissionRef =
      adminDb
        .collection(
          "artistPromotionSubmissions"
        )
        .doc();

    const submissionId =
      submissionRef.id;

    const songName =
      safeFileName(
        songFile.name ||
          "song"
      );

    const artworkName =
      safeFileName(
        artworkFile.name ||
          "artwork"
      );

    const basePath =
      `artist-promotion/${decodedToken.uid}/${submissionId}`;

    const songStoragePath =
      `${basePath}/song-${songName}`;

    const artworkStoragePath =
      `${basePath}/artwork-${artworkName}`;

    const songBuffer =
      Buffer.from(
        await songFile.arrayBuffer()
      );

    const artworkBuffer =
      Buffer.from(
        await artworkFile.arrayBuffer()
      );

    await Promise.all([
      adminBucket
        .file(songStoragePath)
        .save(songBuffer, {
          metadata: {
            contentType:
              songFile.type,
          },
          resumable: false,
        }),
      adminBucket
        .file(artworkStoragePath)
        .save(artworkBuffer, {
          metadata: {
            contentType:
              artworkFile.type,
          },
          resumable: false,
        }),
    ]);

    await submissionRef.set({
      submissionId,
      artistUid:
        decodedToken.uid,
      artistAccountEmail:
        decodedToken.email || null,
      artistAccountName:
        decodedToken.name || null,
      artistName,
      songTitle,
      genre,
      description,
      socialLink:
        socialLink || null,
      youtubeLink,
      promotionDurationDays:
        Number(duration),
      songStoragePath,
      songOriginalName:
        songFile.name,
      songContentType:
        songFile.type,
      songSize:
        songFile.size,
      artworkStoragePath,
      artworkOriginalName:
        artworkFile.name,
      artworkContentType:
        artworkFile.type,
      artworkSize:
        artworkFile.size,
      reviewStatus:
        "pending",
      paymentStatus:
        "not_requested",
      placementStatus:
        "not_scheduled",
      sponsoredLabel:
        "Promoted",
      source:
        "solo-beats-engine-music-artist-promotion",
      createdAt:
        FieldValue.serverTimestamp(),
      updatedAt:
        FieldValue.serverTimestamp(),
    });

    await adminDb
      .collection("ownerNotifications")
      .doc(`artist-promotion-${submissionId}`)
      .set({
        type: "artist_promotion_submission",
        category: "artist_promotions",
        title: "New artist promotion submission",
        message: `${artistName} submitted "${songTitle}" for promotion.`,
        targetUrl: `/developer/artist-promotions?submissionId=${encodeURIComponent(submissionId)}`,
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
      reviewStatus:
        "pending",
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

