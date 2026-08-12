import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";

import {
  adminBucket,
  adminDb,
  firebaseAdminApp,
} from "../../../../lib/firebaseAdmin";

const OWNER_EMAIL = "supe4.me@gmail.com";

const MAX_AUDIO_SIZE = 500 * 1024 * 1024;
const MAX_VIDEO_SIZE = 2 * 1024 * 1024 * 1024;
const MAX_IMAGE_SIZE = 25 * 1024 * 1024;

type MediaKind = "audio" | "video" | "image";

type UploadFile = {
  name: string;
  type: string;
  size: number;
};

function bearer(request: Request) {
  const value = request.headers.get("authorization") || "";
  return value.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || null;
}

async function verifyOwner(request: Request) {
  const token = bearer(request);

  if (!token) {
    throw new Error("OWNER_AUTH_REQUIRED");
  }

  const decoded = await getAuth(firebaseAdminApp).verifyIdToken(token);

  if (decoded.email?.toLowerCase() !== OWNER_EMAIL) {
    throw new Error("OWNER_ACCESS_ONLY");
  }

  return decoded;
}

function authError(error: unknown) {
  const message =
    error instanceof Error ? error.message : "";

  if (message === "OWNER_AUTH_REQUIRED") {
    return NextResponse.json(
      {
        success: false,
        error: "Owner sign-in is required.",
      },
      { status: 401 }
    );
  }

  if (message === "OWNER_ACCESS_ONLY") {
    return NextResponse.json(
      {
        success: false,
        error: "Owner access only.",
      },
      { status: 403 }
    );
  }

  return null;
}

function clean(value: unknown, max = 250) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .replace(/\0/g, "")
    .trim()
    .slice(0, max);
}

function safeFileName(name: string) {
  return (
    name
      .normalize("NFKD")
      .replace(/[^\w.\-() ]+/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^\.+/, "")
      .slice(0, 180) ||
    `media-${Date.now()}`
  );
}

function extension(name: string) {
  return (
    name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ||
    ""
  );
}

function getMediaKind(
  file: UploadFile
): MediaKind | null {
  const mime = file.type.toLowerCase();
  const ext = extension(file.name);

  if (
    mime === "audio/mpeg" ||
    mime === "audio/mp3" ||
    mime === "audio/wav" ||
    mime === "audio/x-wav" ||
    mime === "audio/wave" ||
    ext === "mp3" ||
    ext === "wav"
  ) {
    return "audio";
  }

  if (
    mime === "video/mp4" ||
    ext === "mp4"
  ) {
    return "video";
  }

  if (
    mime === "image/jpeg" ||
    mime === "image/png" ||
    mime === "image/webp" ||
    ["jpg", "jpeg", "png", "webp"].includes(ext)
  ) {
    return "image";
  }

  return null;
}

function validateFile(file?: UploadFile) {
  if (!file) {
    return "A media file is required.";
  }

  if (
    !file.name ||
    !Number.isFinite(file.size) ||
    file.size <= 0
  ) {
    return "Invalid media file.";
  }

  const kind = getMediaKind(file);

  if (!kind) {
    return (
      "Unsupported file type. " +
      "Use MP3, WAV, MP4, JPG, JPEG, PNG, or WebP."
    );
  }

  if (
    kind === "audio" &&
    file.size > MAX_AUDIO_SIZE
  ) {
    return "Audio must be 500 MB or smaller.";
  }

  if (
    kind === "video" &&
    file.size > MAX_VIDEO_SIZE
  ) {
    return "Video must be 2 GB or smaller.";
  }

  if (
    kind === "image" &&
    file.size > MAX_IMAGE_SIZE
  ) {
    return "Images must be 25 MB or smaller.";
  }

  return null;
}

function toIso(value: unknown) {
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as { toDate?: unknown })
      .toDate === "function"
  ) {
    return (
      value as { toDate: () => Date }
    ).toDate().toISOString();
  }

  return null;
}

async function previewUrl(
  storagePath: unknown
) {
  if (
    typeof storagePath !== "string" ||
    !storagePath
  ) {
    return null;
  }

  const file = adminBucket.file(storagePath);
  const [exists] = await file.exists();

  if (!exists) {
    return null;
  }

  const [url] = await file.getSignedUrl({
    action: "read",
    expires: Date.now() + 60 * 60 * 1000,
  });

  return url;
}

export async function GET(request: Request) {
  try {
    await verifyOwner(request);

    const snapshot = await adminDb
      .collection("mediaLibrary")
      .orderBy("createdAt", "desc")
      .get();

    const media = await Promise.all(
      snapshot.docs.map(async (doc) => {
        const data = doc.data();

        return {
          mediaId: doc.id,
          title:
            data.title ||
            data.originalName ||
            "Untitled Media",
          kind: data.kind || null,
          mimeType: data.mimeType || null,
          originalName:
            data.originalName || null,
          extension:
            data.extension || null,
          sizeBytes:
            data.sizeBytes || 0,
          storagePath:
            data.storagePath || null,
          status:
            data.status || "active",
          createdAt:
            toIso(data.createdAt),
          updatedAt:
            toIso(data.updatedAt),
          previewUrl:
            await previewUrl(
              data.storagePath
            ),
        };
      })
    );

    return NextResponse.json({
      success: true,
      media,
    });
  } catch (error) {
    const response = authError(error);

    if (response) {
      return response;
    }

    console.error(
      "Media Library GET error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Media Library could not be loaded.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const owner =
      await verifyOwner(request);

    const payload = await request.json();

    if (payload.action === "prepare") {
      const file =
        payload.file as UploadFile;

      const error =
        validateFile(file);

      if (error) {
        return NextResponse.json(
          {
            success: false,
            error,
          },
          { status: 400 }
        );
      }

      const kind = getMediaKind(file)!;

      const ref = adminDb
        .collection("mediaLibrary")
        .doc();

      const mediaId = ref.id;

      const storagePath =
        `media/${kind}/${mediaId}/` +
        safeFileName(file.name);

      const [uploadUrl] =
        await adminBucket
          .file(storagePath)
          .getSignedUrl({
            action: "write",
            expires:
              Date.now() +
              15 * 60 * 1000,
            contentType:
              file.type ||
              "application/octet-stream",
          });

      return NextResponse.json({
        success: true,
        mediaId,
        kind,
        storagePath,
        uploadUrl,
      });
    }

    if (payload.action === "finalize") {
      const mediaId =
        clean(payload.mediaId, 100);

      const storagePath =
        clean(payload.storagePath, 500);

      const title =
        clean(payload.title, 200);

      const file =
        payload.file as UploadFile;

      const error =
        validateFile(file);

      if (error) {
        return NextResponse.json(
          {
            success: false,
            error,
          },
          { status: 400 }
        );
      }

      const kind = getMediaKind(file)!;

      if (
        !mediaId ||
        !storagePath ||
        !storagePath.startsWith(
          `media/${kind}/${mediaId}/`
        )
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Invalid Media Library upload.",
          },
          { status: 400 }
        );
      }

      const storageFile =
        adminBucket.file(storagePath);

      const [exists] =
        await storageFile.exists();

      if (!exists) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Uploaded file was not found.",
          },
          { status: 400 }
        );
      }

      const [metadata] =
        await storageFile.getMetadata();

      await adminDb
        .collection("mediaLibrary")
        .doc(mediaId)
        .set(
          {
            title:
              title ||
              file.name.replace(
                /\.[^.]+$/,
                ""
              ),
            kind,
            mimeType:
              metadata.contentType ||
              file.type,
            originalName:
              file.name,
            extension:
              extension(file.name),
            sizeBytes:
              Number(metadata.size) ||
              file.size,
            storagePath,
            status: "active",
            uploadedBy:
              owner.email ||
              OWNER_EMAIL,
            createdAt:
              FieldValue.serverTimestamp(),
            updatedAt:
              FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

      return NextResponse.json({
        success: true,
        mediaId,
        kind,
        storagePath,
        message:
          "Media added to the Central Media Library.",
      });
    }

    if (payload.action === "delete") {
      const mediaId =
        clean(payload.mediaId, 100);

      if (!mediaId) {
        return NextResponse.json(
          {
            success: false,
            error: "Media ID is required.",
          },
          { status: 400 }
        );
      }

      const mediaRef = adminDb
        .collection("mediaLibrary")
        .doc(mediaId);

      const mediaSnapshot =
        await mediaRef.get();

      if (!mediaSnapshot.exists) {
        return NextResponse.json(
          {
            success: false,
            error: "Media item was not found.",
          },
          { status: 404 }
        );
      }

      await mediaRef.set(
        {
          status: "deleted",
          deletedAt:
            FieldValue.serverTimestamp(),
          deletedBy:
            owner.email || OWNER_EMAIL,
          updatedAt:
            FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      return NextResponse.json({
        success: true,
        mediaId,
        message:
          "Media removed from the Media Library.",
      });
    }

    return NextResponse.json(
      {
        success: false,
        error:
          'Use action "prepare", "finalize", or "delete".',
      },
      { status: 400 }
    );
  } catch (error) {
    const response = authError(error);

    if (response) {
      return response;
    }

    console.error(
      "Media Library POST error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Media upload could not be completed.",
      },
      { status: 500 }
    );
  }
}

