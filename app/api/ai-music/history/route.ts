import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { appendFileSync } from "node:fs";
import { join } from "node:path";

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

async function signedUrl(
  storagePath: unknown
) {
  if (
    typeof storagePath !== "string" ||
    !storagePath
  ) {
    return null;
  }

  try {
    const file =
      adminBucket.file(storagePath);

    const [exists] =
      await file.exists();

    if (!exists) {
      return null;
    }

    const [url] =
      await file.getSignedUrl({
        action: "read",
        expires:
          Date.now() +
          60 * 60 * 1000,
      });

    return url;
  } catch (error) {
    console.error(
      "AI MUSIC HISTORY SIGNED URL ERROR",
      storagePath,
      error
    );

    return null;
  }
}

export async function GET(
  request: Request
) {
  try {
    const user =
      await userFromRequest(request);

    // AI_MUSIC_HISTORY_PERSISTENCE_V2
    //
    // UID remains the primary ownership key.
    // Email fallback preserves legitimate history
    // if the Firebase account UID changed while
    // the verified email remained the same.

    const queries = [
      adminDb
        .collection("aiMusicGenerations")
        .where("uid", "==", user.uid)
        .limit(50)
        .get(),
    ];

    const normalizedEmail =
      typeof user.email === "string"
        ? user.email.trim()
        : "";

    if (normalizedEmail) {
      queries.push(
        adminDb
          .collection(
            "aiMusicGenerations"
          )
          .where(
            "userEmail",
            "==",
            normalizedEmail
          )
          .limit(50)
          .get()
      );
    }

    const snapshots =
      await Promise.all(queries);

    const docsById =
      new Map<
        string,
        (typeof snapshots)[number]["docs"][number]
      >();

    for (const snapshot of snapshots) {
      for (const doc of snapshot.docs) {
        docsById.set(
          doc.id,
          doc
        );
      }
    }

    const generations =
      await Promise.all(
        Array.from(
          docsById.values()
        ).map(async (doc) => {
          const data =
            doc.data();

          return {
            generationId:
              doc.id,

            prompt:
              typeof data.prompt ===
              "string"
                ? data.prompt
                : "",

            genre:
              typeof data.genre ===
              "string"
                ? data.genre
                : "",

            mood:
              typeof data.mood ===
              "string"
                ? data.mood
                : "",

            bpm:
              Number(data.bpm) || 0,

            musicKey:
              typeof data.musicKey ===
              "string"
                ? data.musicKey
                : "",

            duration:
              Number(data.duration) || 0,

            vocalMode:
              typeof data.vocalMode ===
              "string"
                ? data.vocalMode
                : "",

            accessMode:
              typeof data.accessMode ===
              "string"
                ? data.accessMode
                : "",

            audioUrl:
              await signedUrl(
                data.storagePath
              ),

            savedToMediaLibrary:
              Boolean(
                data.mediaLibraryId
              ),

            mediaLibraryId:
              typeof data.mediaLibraryId ===
              "string"
                ? data.mediaLibraryId
                : null,

            createdAt:
              typeof data.createdAt ===
              "string"
                ? data.createdAt
                : "",
          };
        })
      );

    generations.sort(
      (a, b) =>
        new Date(
          b.createdAt || 0
        ).getTime() -
        new Date(
          a.createdAt || 0
        ).getTime()
    );

    return NextResponse.json({
      success: true,
      generations:
        generations.slice(0, 50),
    });
  } catch (error) {
    console.error(
      "AI MUSIC HISTORY ERROR",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : "";

    if (
      message === "AUTH_REQUIRED"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Sign in to view AI Music history.",
        },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error:
          "AI Music history could not be loaded.",
      },
      {
        status: 500,
      }
    );
  }
}


