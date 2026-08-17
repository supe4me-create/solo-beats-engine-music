import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";

import {
  adminBucket,
  adminDb,
  firebaseAdminApp,
} from "../../../../../lib/firebaseAdmin";

import {
  requirePremiumAccess,
} from "../../../../../lib/requirePremium";

export const runtime = "nodejs";

const OWNER_EMAIL =
  "supe4.me@gmail.com";

const MAX_AUDIO_BYTES =
  250 * 1024 * 1024;

function getBearerToken(
  request: Request
): string | null {
  const authorization =
    request.headers.get(
      "authorization"
    );

  if (!authorization) {
    return null;
  }

  const match =
    authorization.match(
      /^Bearer\s+(.+)$/i
    );

  return match?.[1]?.trim() || null;
}

async function verifyAuthenticatedUser(
  request: Request
) {
  const idToken =
    getBearerToken(request);

  if (!idToken) {
    throw new Error(
      "UNAUTHORIZED"
    );
  }

  try {
    return await getAuth(
      firebaseAdminApp
    ).verifyIdToken(
      idToken
    );
  } catch {
    throw new Error(
      "UNAUTHORIZED"
    );
  }
}

function safeFileName(
  name: string
) {
  return (
    name.replace(
      /[^a-zA-Z0-9._-]+/g,
      "-"
    ) || "music"
  );
}

function extensionFromName(
  name: string
) {
  const match =
    name
      .toLowerCase()
      .match(/\.([a-z0-9]+)$/);

  return match?.[1] || "mp3";
}

export async function POST(
  request: Request
) {
  try {
    const decoded =
      await verifyAuthenticatedUser(
        request
      );

    const email =
      typeof decoded.email ===
      "string"
        ? decoded.email
            .toLowerCase()
        : "";

    const isOwner =
      email === OWNER_EMAIL;

    if (!isOwner) {
      const premium =
        await requirePremiumAccess(
          request
        );

      if (!premium.allowed) {
        return NextResponse.json(
          {
            success: false,
            error:
              premium.error,
          },
          {
            status:
              premium.statusCode,
          }
        );
      }

      if (
        premium.uid !==
        decoded.uid
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Premium account verification failed.",
          },
          {
            status: 403,
          }
        );
      }
    }

    const formData =
      await request.formData();

    const jobIdValue =
      formData.get(
        "jobId"
      );

    const audioValue =
      formData.get(
        "audio"
      );

    const jobId =
      typeof jobIdValue ===
      "string"
        ? jobIdValue.trim()
        : "";

    if (!jobId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "AI video job ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !(audioValue instanceof File)
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Choose a song or audio file.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      audioValue.size <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "The selected audio file is empty.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      audioValue.size >
      MAX_AUDIO_BYTES
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "The audio file must be 250 MB or smaller.",
        },
        {
          status: 400,
        }
      );
    }

    const jobReference =
      adminDb
        .collection(
          "aiVideoJobs"
        )
        .doc(jobId);

    const jobSnapshot =
      await jobReference.get();

    if (
      !jobSnapshot.exists
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "AI video job was not found.",
        },
        {
          status: 404,
        }
      );
    }

    const job =
      jobSnapshot.data() || {};

    if (
      job.ownerUid !==
      decoded.uid
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "You do not have access to this AI video job.",
        },
        {
          status: 403,
        }
      );
    }

    if (
      job.mode !== "music"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "This job is not a Song + Cover job.",
        },
        {
          status: 400,
        }
      );
    }

    const mediaReference =
      adminDb
        .collection(
          "mediaLibrary"
        )
        .doc();

    const audioMediaId =
      mediaReference.id;

    const originalName =
      audioValue.name ||
      "music.mp3";

    const extension =
      extensionFromName(
        originalName
      );

    const storagePath =
      `media/audio/${audioMediaId}/${safeFileName(
        originalName
      )}`;

    const storageFile =
      adminBucket.file(
        storagePath
      );

    const buffer =
      Buffer.from(
        await audioValue.arrayBuffer()
      );

    await storageFile.save(
      buffer,
      {
        resumable: false,
        metadata: {
          contentType:
            audioValue.type ||
            "audio/mpeg",
          metadata: {
            ownerUid:
              decoded.uid,
            aiVideoJobId:
              jobId,
            source:
              "solo-beats-song-cover",
          },
        },
      }
    );

    const title =
      originalName.replace(
        /\.[^.]+$/,
        ""
      );

    await mediaReference.set({
      kind:
        "audio",
      title,
      originalName,
      mimeType:
        audioValue.type ||
        "audio/mpeg",
      extension,
      sizeBytes:
        audioValue.size,
      storagePath,
      status:
        "active",
      sourceType:
        "solo-beats-song-cover",
      ownerUid:
        decoded.uid,
      createdAt:
        FieldValue.serverTimestamp(),
      updatedAt:
        FieldValue.serverTimestamp(),
    });

    await jobReference.set(
      {
        audioName:
          originalName,
        audioMediaId,
        audioStoragePath:
          storagePath,
        audioUploadedAt:
          FieldValue.serverTimestamp(),
        updatedAt:
          FieldValue.serverTimestamp(),
      },
      {
        merge: true,
      }
    );

    return NextResponse.json({
      success: true,
      jobId,
      audioMediaId,
      audioName:
        originalName,
      storagePath,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message ===
        "UNAUTHORIZED"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Authentication is required.",
        },
        {
          status: 401,
        }
      );
    }

    console.error(
      "Song + Cover audio upload error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Song upload failed.",
      },
      {
        status: 500,
      }
    );
  }
}
