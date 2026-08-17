import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";

import {
  adminBucket,
  adminDb,
  firebaseAdminApp,
} from "../../../../lib/firebaseAdmin";

function token(request: Request) {
  return (
    request.headers
      .get("authorization")
      ?.match(/^Bearer\s+(.+)$/i)?.[1]
      ?.trim() || null
  );
}

async function userFromRequest(
  request: Request
) {
  const idToken = token(request);

  if (!idToken) {
    throw new Error("AUTH_REQUIRED");
  }

  return getAuth(
    firebaseAdminApp
  ).verifyIdToken(idToken);
}

export async function POST(
  request: Request
) {
  try {
    const user =
      await userFromRequest(request);

    const body =
      await request.json();

    const generationId =
      typeof body.generationId === "string"
        ? body.generationId.trim()
        : "";

    if (!generationId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Generation ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    const generationRef =
      adminDb
        .collection("aiMusicGenerations")
        .doc(generationId);

    const snapshot =
      await generationRef.get();

    if (!snapshot.exists) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Generation not found.",
        },
        {
          status: 404,
        }
      );
    }

    const generation =
      snapshot.data() || {};

    if (
      generation.uid !== user.uid
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "You do not own this generation.",
        },
        {
          status: 403,
        }
      );
    }

    if (
      typeof generation.mediaLibraryId ===
        "string" &&
      generation.mediaLibraryId
    ) {
      return NextResponse.json({
        success: true,
        alreadySaved: true,
        mediaId:
          generation.mediaLibraryId,
        message:
          "This song is already saved to the Media Library.",
      });
    }

    const storagePath =
      typeof generation.storagePath ===
        "string"
        ? generation.storagePath
        : "";

    if (!storagePath) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Stored audio file is missing.",
        },
        {
          status: 400,
        }
      );
    }

    const file =
      adminBucket.file(
        storagePath
      );

    const [exists] =
      await file.exists();

    if (!exists) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Stored audio file was not found.",
        },
        {
          status: 404,
        }
      );
    }

    const [metadata] =
      await file.getMetadata();

    const mediaRef =
      adminDb
        .collection("mediaLibrary")
        .doc(generationId);

    const genre =
      typeof generation.genre === "string"
        ? generation.genre.trim()
        : "";

    const title =
      genre
        ? `AI Music - ${genre}`
        : `AI Music - ${generationId.slice(
            0,
            8
          )}`;

    await mediaRef.set(
      {
        title,

        kind:
          "audio",

        mimeType:
          metadata.contentType ||
          "audio/mpeg",

        originalName:
          `ai-music-${generationId}.mp3`,

        extension:
          "mp3",

        sizeBytes:
          Number(metadata.size) || 0,

        storagePath,

        status:
          "active",

        uploadedBy:
          user.email ||
          user.uid,

        ownerUid:
          user.uid,

        source:
          "ai-music",

        aiMusicGenerationId:
          generationId,

        published:
          false,

        createdAt:
          FieldValue.serverTimestamp(),

        updatedAt:
          FieldValue.serverTimestamp(),
      },
      {
        merge: true,
      }
    );

    await generationRef.set(
      {
        savedToMediaLibrary:
          true,

        mediaLibraryId:
          mediaRef.id,

        savedToMediaLibraryAt:
          FieldValue.serverTimestamp(),

        updatedAt:
          new Date().toISOString(),
      },
      {
        merge: true,
      }
    );

    return NextResponse.json({
      success: true,

      mediaId:
        mediaRef.id,

      message:
        "Song saved to the Media Library.",
    });
  } catch (error) {
    console.error(
      "AI MUSIC SAVE ERROR",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Song could not be saved to the Media Library.",
      },
      {
        status: 500,
      }
    );
  }
}
