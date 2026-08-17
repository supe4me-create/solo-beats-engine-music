import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";

import {
  adminDb,
  firebaseAdminApp,
} from "../../../../lib/firebaseAdmin";

const OWNER_EMAIL =
  "supe4.me@gmail.com";

function bearerToken(
  request: Request
) {
  return (
    request.headers
      .get("authorization")
      ?.match(/^Bearer\s+(.+)$/i)?.[1]
      ?.trim() || null
  );
}

export async function GET(
  request: Request
) {
  try {
    const token =
      bearerToken(request);

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          error: "AUTH_REQUIRED",
        },
        { status: 401 }
      );
    }

    const user =
      await getAuth(
        firebaseAdminApp
      ).verifyIdToken(token);

    const email =
      (user.email || "")
        .trim()
        .toLowerCase();

    if (
      email !==
      OWNER_EMAIL.toLowerCase()
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "OWNER_REQUIRED",
        },
        { status: 403 }
      );
    }

    const snapshot =
      await adminDb
        .collection(
          "aiMusicGenerations"
        )
        .limit(200)
        .get();

    const rows =
      snapshot.docs.map((doc) => {
        const data =
          doc.data();

        return {
          generationId:
            doc.id,

          uid:
            typeof data.uid ===
            "string"
              ? data.uid
              : "",

          userEmail:
            typeof data.userEmail ===
            "string"
              ? data.userEmail
              : "",

          normalizedEmail:
            typeof data.userEmail ===
            "string"
              ? data.userEmail
                  .trim()
                  .toLowerCase()
              : "",

          prompt:
            typeof data.prompt ===
            "string"
              ? data.prompt.slice(
                  0,
                  80
                )
              : "",

          storagePath:
            typeof data.storagePath ===
            "string"
              ? data.storagePath
              : "",

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
      });

    const matchingUid =
      rows.filter(
        (row) =>
          row.uid === user.uid
      );

    const matchingEmail =
      rows.filter(
        (row) =>
          row.normalizedEmail ===
          email
      );

    return NextResponse.json({
      success: true,

      currentUser: {
        uid: user.uid,
        email:
          user.email || "",
      },

      counts: {
        totalScanned:
          rows.length,

        uidMatches:
          matchingUid.length,

        emailMatches:
          matchingEmail.length,
      },

      matchingUid,

      matchingEmail,
    });
  } catch (error) {
    console.error(
      "AI MUSIC HISTORY DEBUG ERROR",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "DEBUG_FAILED",
      },
      { status: 500 }
    );
  }
}
