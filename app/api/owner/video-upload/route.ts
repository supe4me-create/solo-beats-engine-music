import { createHash } from "node:crypto";

import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";

import {
  adminBucket,
  adminDb,
  firebaseAdminApp,
} from "../../../../lib/firebaseAdmin";

export const runtime = "nodejs";

const OWNER_EMAIL = "supe4.me@gmail.com";
const MAX_VIDEO_SIZE =
  2 * 1024 * 1024 * 1024;

type UploadFile = {
  name: string;
  type: string;
  size: number;
  lastModified?: number;
};

type UploadStatus = {
  offset: number;
  complete: boolean;
  expired: boolean;
};

function bearer(request: Request) {
  const value =
    request.headers.get("authorization") || "";

  return (
    value.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() ||
    null
  );
}

async function verifyOwner(request: Request) {
  const token = bearer(request);

  if (!token) {
    throw new Error("OWNER_AUTH_REQUIRED");
  }

  const decoded = await getAuth(
    firebaseAdminApp
  ).verifyIdToken(token);

  if (
    decoded.email?.toLowerCase() !==
    OWNER_EMAIL.toLowerCase()
  ) {
    throw new Error("OWNER_ACCESS_ONLY");
  }

  return decoded;
}

function authError(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : "";

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

function safeFileName(value: string) {
  return (
    value
      .normalize("NFKD")
      .replace(/[^\w.\-() ]+/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^\.+/, "")
      .slice(0, 180) ||
    `video-${Date.now()}.mp4`
  );
}

function validateFile(
  file: UploadFile | undefined
) {
  if (
    !file ||
    typeof file.name !== "string" ||
    typeof file.type !== "string" ||
    !Number.isFinite(file.size) ||
    file.size <= 0
  ) {
    return "Invalid video file information.";
  }

  const lower = file.name.toLowerCase();

  if (
    file.type !== "video/mp4" &&
    !lower.endsWith(".mp4")
  ) {
    return "Video Manager currently accepts MP4 files only.";
  }

  if (file.size > MAX_VIDEO_SIZE) {
    return "Video files must be 2 GB or smaller.";
  }

  return null;
}

function sessionIdFor(
  uid: string,
  file: UploadFile
) {
  return createHash("sha256")
    .update(
      [
        uid,
        file.name,
        String(file.size),
        String(file.lastModified || 0),
      ].join("|")
    )
    .digest("hex");
}

function offsetFromRange(
  value: string | null
) {
  if (!value) {
    return 0;
  }

  const match =
    value.match(/bytes=0-(\d+)/i);

  if (!match) {
    return 0;
  }

  const lastByte = Number(match[1]);

  return Number.isFinite(lastByte)
    ? lastByte + 1
    : 0;
}

async function checkUploadStatus(
  uploadUrl: string,
  totalSize: number
): Promise<UploadStatus> {
  try {
    const response = await fetch(
      uploadUrl,
      {
        method: "PUT",
        headers: {
          "Content-Length": "0",
          "Content-Range":
            `bytes */${totalSize}`,
        },
        cache: "no-store",
      }
    );

    if (
      response.status === 200 ||
      response.status === 201
    ) {
      return {
        offset: totalSize,
        complete: true,
        expired: false,
      };
    }

    if (response.status === 308) {
      return {
        offset: offsetFromRange(
          response.headers.get("range")
        ),
        complete: false,
        expired: false,
      };
    }

    if (
      response.status === 404 ||
      response.status === 410
    ) {
      return {
        offset: 0,
        complete: false,
        expired: true,
      };
    }

    if (response.status >= 500) {
      throw new Error(
        `Cloud Storage status check failed (${response.status}).`
      );
    }

    return {
      offset: 0,
      complete: false,
      expired: true,
    };
  } catch (error) {
    console.error(
      "Upload status check error:",
      error
    );

    throw error;
  }
}

async function ensureUploadCors() {
  const [metadata] =
    await adminBucket.getMetadata();

  const current = Array.isArray(
    (
      metadata as {
        cors?: unknown;
      }
    ).cors
  )
    ? (
        metadata as {
          cors: Array<{
            origin?: string[];
            method?: string[];
            responseHeader?: string[];
            maxAgeSeconds?: number;
          }>;
        }
      ).cors
    : [];

  const installed =
    current.some((item) => {
      const origins =
        Array.isArray(item.origin)
          ? item.origin
          : [];

      const methods =
        Array.isArray(item.method)
          ? item.method
          : [];

      const headers =
        Array.isArray(item.responseHeader)
          ? item.responseHeader
          : [];

      return (
        origins.includes("*") &&
        methods.includes("PUT") &&
        headers.includes("Range")
      );
    });

  if (installed) {
    return;
  }

  await adminBucket.setCorsConfiguration([
    ...current,
    {
      origin: ["*"],
      method: [
        "GET",
        "HEAD",
        "PUT",
      ],
      responseHeader: [
        "Content-Type",
        "Content-Range",
        "Range",
      ],
      maxAgeSeconds: 3600,
    },
  ]);
}

async function createUploadUrl(
  storagePath: string,
  file: UploadFile,
  mediaId: string,
  uploadedBy: string,
  origin?: string
) {
  const storageFile =
    adminBucket.file(storagePath);

  return await new Promise<string>(
    (resolve, reject) => {
      storageFile.createResumableUpload(
        {
          metadata: {
            contentType:
              file.type || "video/mp4",
            metadata: {
              mediaId,
              uploadedBy,
            },
          },
          origin,
        },
        (error, uri) => {
          if (error) {
            reject(error);
            return;
          }

          if (!uri) {
            reject(
              new Error(
                "Cloud Storage did not return a resumable session URI."
              )
            );
            return;
          }

          resolve(uri);
        }
      );
    }
  );
}

export async function POST(
  request: Request
) {
  try {
    const owner =
      await verifyOwner(request);

    const payload =
      await request.json();

    const action =
      typeof payload.action === "string"
        ? payload.action
        : "start";

    if (action === "status") {
      const sessionId =
        typeof payload.sessionId === "string"
          ? payload.sessionId.trim()
          : "";

      if (!sessionId) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Upload session ID is required.",
          },
          { status: 400 }
        );
      }

      const ref =
        adminDb
          .collection("videoUploadSessions")
          .doc(sessionId);

      const snapshot = await ref.get();

      if (!snapshot.exists) {
        return NextResponse.json({
          success: true,
          found: false,
          expired: true,
          offset: 0,
          complete: false,
        });
      }

      const data = snapshot.data();

      if (
        data?.ownerUid !== owner.uid
      ) {
        return NextResponse.json(
          {
            success: false,
            error: "Owner access only.",
          },
          { status: 403 }
        );
      }

      if (
        typeof data.uploadUrl !== "string" ||
        !data.uploadUrl ||
        !Number.isFinite(
          Number(data.fileSize)
        )
      ) {
        return NextResponse.json({
          success: true,
          found: false,
          expired: true,
          offset: 0,
          complete: false,
        });
      }

      const status =
        await checkUploadStatus(
          data.uploadUrl,
          Number(data.fileSize)
        );

      return NextResponse.json({
        success: true,
        found: true,
        ...status,
      });
    }

    if (action === "cancel") {
      const sessionId =
        typeof payload.sessionId === "string"
          ? payload.sessionId.trim()
          : "";

      if (!sessionId) {
        return NextResponse.json(
          {
            success: false,
            error: "Upload session ID is required.",
          },
          { status: 400 }
        );
      }

      const ref =
        adminDb
          .collection("videoUploadSessions")
          .doc(sessionId);

      const snapshot = await ref.get();

      if (snapshot.exists) {
        const data = snapshot.data();

        if (data?.ownerUid !== owner.uid) {
          return NextResponse.json(
            {
              success: false,
              error: "Owner access only.",
            },
            { status: 403 }
          );
        }

        await ref.delete();
      }

      return NextResponse.json({
        success: true,
        cancelled: true,
      });
    }
    if (action === "complete") {
      const sessionId =
        typeof payload.sessionId === "string"
          ? payload.sessionId.trim()
          : "";

      if (!sessionId) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Upload session ID is required.",
          },
          { status: 400 }
        );
      }

      const ref =
        adminDb
          .collection("videoUploadSessions")
          .doc(sessionId);

      const snapshot = await ref.get();

      if (
        snapshot.exists &&
        snapshot.data()?.ownerUid ===
          owner.uid
      ) {
        await ref.set(
          {
            completed: true,
            completedAt:
              new Date().toISOString(),
            uploadUrl: null,
          },
          { merge: true }
        );
      }

      return NextResponse.json({
        success: true,
      });
    }

    const file =
      payload.file as
        | UploadFile
        | undefined;

    const validationError =
      validateFile(file);

    if (
      validationError ||
      !file
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            validationError ||
            "Invalid video.",
        },
        { status: 400 }
      );
    }

    const sessionId =
      sessionIdFor(owner.uid, file);

    const sessionRef =
      adminDb
        .collection("videoUploadSessions")
        .doc(sessionId);

    const existing =
      await sessionRef.get();

    if (
      existing.exists &&
      existing.data()?.completed !== true
    ) {
      const data =
        existing.data();

      if (
        typeof data?.uploadUrl === "string" &&
        data.uploadUrl &&
        typeof data.mediaId === "string" &&
        typeof data.storagePath === "string"
      ) {
        const status =
          await checkUploadStatus(
            data.uploadUrl,
            file.size
          );

        if (!status.expired) {
          return NextResponse.json({
            success: true,
            reused: true,
            sessionId,
            mediaId: data.mediaId,
            storagePath:
              data.storagePath,
            uploadUrl:
              data.uploadUrl,
            offset: status.offset,
            complete:
              status.complete,
          });
        }
      }
    }

    await ensureUploadCors();

    const mediaRef =
      adminDb
        .collection("mediaLibrary")
        .doc();

    const mediaId =
      mediaRef.id;

    const storagePath =
      `media/video/${mediaId}/` +
      safeFileName(file.name);

    const origin =
      request.headers.get("origin") ||
      undefined;

    const uploadUrl =
      await createUploadUrl(
        storagePath,
        file,
        mediaId,
        owner.email ||
          OWNER_EMAIL,
        origin
      );

    await sessionRef.set({
      ownerUid: owner.uid,
      ownerEmail:
        owner.email ||
        OWNER_EMAIL,
      mediaId,
      storagePath,
      uploadUrl,
      fileName: file.name,
      fileSize: file.size,
      fileType:
        file.type || "video/mp4",
      lastModified:
        file.lastModified || 0,
      completed: false,
      createdAt:
        new Date().toISOString(),
      updatedAt:
        new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      reused: false,
      sessionId,
      mediaId,
      storagePath,
      uploadUrl,
      offset: 0,
      complete: false,
    });
  } catch (error) {
    const response =
      authError(error);

    if (response) {
      return response;
    }

    console.error(
      "Video resumable upload API error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Video upload session failed.",
      },
      { status: 500 }
    );
  }
}

