import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";

import {
  adminBucket,
  adminDb,
  firebaseAdminApp,
} from "../../../../lib/firebaseAdmin";

const OWNER_EMAIL = "supe4.me@gmail.com";

function bearer(request: Request) {
  const value = request.headers.get("authorization") || "";
  return value.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || null;
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

function clean(
  value: unknown,
  max = 500
) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .replace(/\0/g, "")
    .trim()
    .slice(0, max);
}

function toIso(value: unknown) {
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (
      value as {
        toDate?: unknown;
      }
    ).toDate === "function"
  ) {
    return (
      value as {
        toDate: () => Date;
      }
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

function youtubeVideoId(
  value: unknown
): string | null {
  if (
    typeof value !== "string" ||
    !value.trim()
  ) {
    return null;
  }

  const input = value.trim();

  try {
    const url = new URL(input);

    const host =
      url.hostname
        .replace(/^www\./i, "")
        .toLowerCase();

    if (host === "youtu.be") {
      const id =
        url.pathname
          .split("/")
          .filter(Boolean)[0];

      return id &&
        /^[A-Za-z0-9_-]{11}$/.test(id)
        ? id
        : null;
    }

    if (
      host === "youtube.com" ||
      host === "m.youtube.com"
    ) {
      const watchId =
        url.searchParams.get("v");

      if (
        watchId &&
        /^[A-Za-z0-9_-]{11}$/.test(
          watchId
        )
      ) {
        return watchId;
      }

      const parts =
        url.pathname
          .split("/")
          .filter(Boolean);

      if (
        ["shorts", "embed", "live"].includes(
          parts[0] || ""
        ) &&
        parts[1] &&
        /^[A-Za-z0-9_-]{11}$/.test(
          parts[1]
        )
      ) {
        return parts[1];
      }
    }
  } catch {
    return null;
  }

  return null;
}

function youtubeWatchUrl(
  videoId: string
) {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

function youtubeEmbedUrl(
  videoId: string
) {
  return `https://www.youtube.com/embed/${videoId}`;
}
export async function GET(
  request: Request
) {
  try {
    await verifyOwner(request);

    const snapshot = await adminDb
      .collection("mediaLibrary")
      .where("kind", "==", "video")
      .get();

    const videos = await Promise.all(
      snapshot.docs.map(async (doc) => {
        const data = doc.data();

        return {
          mediaId: doc.id,
          title:
            data.title ||
            data.originalName ||
            "Untitled Video",
          description:
            data.description || "",
          sourceType:
            data.sourceType || "solo-beats",
          originalName:
            data.originalName || null,
          mimeType:
            data.mimeType || null,
          sizeBytes:
            data.sizeBytes || 0,
          storagePath:
            data.storagePath || null,
          status:
            data.status || "active",

          published:
            data.published === true,

          homepageEnabled:
            data.homepageEnabled === true,

          premiumTvEnabled:
            data.premiumTvEnabled === true,

          featured:
            data.featured === true,

          displayOrder:
            Number.isFinite(
              Number(data.displayOrder)
            )
              ? Number(data.displayOrder)
              : 0,

          tvScheduleStart:
            typeof data.tvScheduleStart === "string"
              ? data.tvScheduleStart
              : null,

          tvScheduleEnd:
            typeof data.tvScheduleEnd === "string"
              ? data.tvScheduleEnd
              : null,

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

    videos.sort((a, b) =>
      String(b.createdAt || "").localeCompare(
        String(a.createdAt || "")
      )
    );

    return NextResponse.json({
      success: true,
      videos,
    });
  } catch (error) {
    const response = authError(error);

    if (response) {
      return response;
    }

    console.error(
      "Owner Video Manager GET error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Videos could not be loaded.",
      },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request
) {
  try {
    const owner =
      await verifyOwner(request);

    const payload =
      await request.json();

    if (
      payload.action !==
      "create-youtube"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid Video Manager action.",
        },
        { status: 400 }
      );
    }

    const videoId =
      youtubeVideoId(
        payload.youtubeUrl
      );

    if (!videoId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Enter a valid YouTube video, Shorts, Live, or youtu.be link.",
        },
        { status: 400 }
      );
    }

    const title =
      clean(payload.title, 200);

    if (!title) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Video title is required.",
        },
        { status: 400 }
      );
    }

    const sourceType =
      clean(
        payload.sourceType,
        50
      ) || "solo-beats";

    const allowedSources = [
      "solo-beats",
      "artist",
      "advertiser",
      "customer",
    ];

    if (
      !allowedSources.includes(
        sourceType
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid video source type.",
        },
        { status: 400 }
      );
    }

    const ref =
      adminDb
        .collection("mediaLibrary")
        .doc();

    const youtubeUrl =
      youtubeWatchUrl(videoId);

    await ref.set({
      mediaId: ref.id,

      kind: "video",

      videoSource: "youtube",

      youtubeVideoId:
        videoId,

      youtubeUrl,

      title,

      description:
        clean(
          payload.description,
          2000
        ),

      sourceType,

      originalName: null,
      mimeType:
        "video/youtube",
      sizeBytes: 0,
      storagePath: null,

      status: "active",

      published:
        payload.published === true,

      homepageEnabled:
        payload.homepageEnabled ===
        true,

      premiumTvEnabled:
        payload.premiumTvEnabled ===
        true,

      featured:
        payload.featured === true,

      displayOrder:
        Number.isFinite(
          Number(
            payload.displayOrder
          )
        )
          ? Math.max(
              0,
              Math.floor(
                Number(
                  payload.displayOrder
                )
              )
            )
          : 0,

      createdByUid:
        owner.uid,

      createdByEmail:
        owner.email || null,

      createdAt:
        FieldValue.serverTimestamp(),

      updatedAt:
        FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      success: true,
      mediaId: ref.id,
      videoSource: "youtube",
      youtubeVideoId:
        videoId,
      youtubeUrl,
      youtubeEmbedUrl:
        youtubeEmbedUrl(
          videoId
        ),
      message:
        "YouTube video added to Video Manager.",
    });
  } catch (error) {
    const response =
      authError(error);

    if (response) {
      return response;
    }

    console.error(
      "Owner Video Manager YouTube POST error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "YouTube video could not be added to Video Manager.",
      },
      { status: 500 }
    );
  }
}
export async function PATCH(
  request: Request
) {
  try {
    await verifyOwner(request);

    const payload = await request.json();

    const mediaId =
      clean(payload.mediaId, 120);

    if (!mediaId) {
      return NextResponse.json(
        {
          success: false,
          error: "Video ID is required.",
        },
        { status: 400 }
      );
    }

    const ref = adminDb
      .collection("mediaLibrary")
      .doc(mediaId);

    const snapshot = await ref.get();

    if (!snapshot.exists) {
      return NextResponse.json(
        {
          success: false,
          error: "Video was not found.",
        },
        { status: 404 }
      );
    }

    const current = snapshot.data() || {};

    if (current.kind !== "video") {
      return NextResponse.json(
        {
          success: false,
          error:
            "This Media Library item is not a video.",
        },
        { status: 400 }
      );
    }

    if (payload.action === "replace-file") {
      const replacementMediaId =
        clean(payload.replacementMediaId, 120);

      if (!replacementMediaId) {
        return NextResponse.json(
          {
            success: false,
            error: "Replacement video ID is required.",
          },
          { status: 400 }
        );
      }

      if (replacementMediaId === mediaId) {
        return NextResponse.json(
          {
            success: false,
            error: "Replacement video must be a different Media Library item.",
          },
          { status: 400 }
        );
      }

      const replacementRef = adminDb
        .collection("mediaLibrary")
        .doc(replacementMediaId);

      const replacementSnapshot =
        await replacementRef.get();

      if (!replacementSnapshot.exists) {
        return NextResponse.json(
          {
            success: false,
            error: "Replacement video was not found.",
          },
          { status: 404 }
        );
      }

      const replacement =
        replacementSnapshot.data() || {};

      if (
        replacement.kind !== "video" ||
        typeof replacement.storagePath !== "string" ||
        !replacement.storagePath ||
        !replacement.storagePath.startsWith(
          `media/video/${replacementMediaId}/`
        )
      ) {
        return NextResponse.json(
          {
            success: false,
            error: "Invalid replacement video.",
          },
          { status: 400 }
        );
      }

      const replacementFile =
        adminBucket.file(
          replacement.storagePath
        );

      const [replacementExists] =
        await replacementFile.exists();

      if (!replacementExists) {
        return NextResponse.json(
          {
            success: false,
            error: "Replacement MP4 is missing from Storage.",
          },
          { status: 400 }
        );
      }

      const oldStoragePath =
        typeof current.storagePath === "string"
          ? current.storagePath
          : null;

      await ref.set(
        {
          storagePath:
            replacement.storagePath,
          originalName:
            replacement.originalName || null,
          mimeType:
            replacement.mimeType || "video/mp4",
          extension:
            replacement.extension || "mp4",
          sizeBytes:
            Number(replacement.sizeBytes) || 0,
          status: "active",
          updatedAt:
            FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      await replacementRef.delete();

      if (
        oldStoragePath &&
        oldStoragePath !==
          replacement.storagePath
      ) {
        try {
          await adminBucket
            .file(oldStoragePath)
            .delete({
              ignoreNotFound: true,
            });
        } catch (storageError) {
          console.error(
            "Old replaced video cleanup warning:",
            storageError
          );
        }
      }

      return NextResponse.json({
        success: true,
        mediaId,
        storagePath:
          replacement.storagePath,
        message: "MP4 replaced successfully.",
      });
    }

    const update: Record<
      string,
      unknown
    > = {
      updatedAt:
        FieldValue.serverTimestamp(),
    };

    if ("title" in payload) {
      const title =
        clean(payload.title, 200);

      if (!title) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Video title cannot be empty.",
          },
          { status: 400 }
        );
      }

      update.title = title;
    }

    if ("description" in payload) {
      update.description =
        clean(payload.description, 2000);
    }

    if ("sourceType" in payload) {
      const sourceType =
        clean(payload.sourceType, 50);

      const allowed = [
        "solo-beats",
        "artist",
        "advertiser",
        "customer",
      ];

      if (!allowed.includes(sourceType)) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Invalid video source type.",
          },
          { status: 400 }
        );
      }

      update.sourceType =
        sourceType;
    }

    if ("published" in payload) {
      update.published =
        payload.published === true;
    }

    if (
      "homepageEnabled" in payload
    ) {
      update.homepageEnabled =
        payload.homepageEnabled === true;
    }

    if (
      "premiumTvEnabled" in payload
    ) {
      update.premiumTvEnabled =
        payload.premiumTvEnabled === true;
    }

    if ("featured" in payload) {
      update.featured =
        payload.featured === true;
    }

    if ("displayOrder" in payload) {
      const value =
        Number(payload.displayOrder);

      update.displayOrder =
        Number.isFinite(value)
          ? Math.max(
              0,
              Math.floor(value)
            )
          : 0;
    }

    if ("tvScheduleStart" in payload) {
      const value = clean(
        payload.tvScheduleStart,
        100
      );

      if (
        value &&
        Number.isNaN(Date.parse(value))
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Premium TV schedule start is invalid.",
          },
          { status: 400 }
        );
      }

      update.tvScheduleStart =
        value || null;
    }

    if ("tvScheduleEnd" in payload) {
      const value = clean(
        payload.tvScheduleEnd,
        100
      );

      if (
        value &&
        Number.isNaN(Date.parse(value))
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Premium TV schedule end is invalid.",
          },
          { status: 400 }
        );
      }

      update.tvScheduleEnd =
        value || null;
    }

    const start =
      typeof update.tvScheduleStart === "string"
        ? Date.parse(update.tvScheduleStart)
        : typeof current.tvScheduleStart === "string"
          ? Date.parse(current.tvScheduleStart)
          : null;

    const end =
      typeof update.tvScheduleEnd === "string"
        ? Date.parse(update.tvScheduleEnd)
        : typeof current.tvScheduleEnd === "string"
          ? Date.parse(current.tvScheduleEnd)
          : null;

    if (
      start !== null &&
      end !== null &&
      Number.isFinite(start) &&
      Number.isFinite(end) &&
      end <= start
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Premium TV schedule end must be after the start.",
        },
        { status: 400 }
      );
    }

    await ref.set(
      update,
      { merge: true }
    );

    return NextResponse.json({
      success: true,
      mediaId,
      message:
        "Video settings updated.",
    });
  } catch (error) {
    const response = authError(error);

    if (response) {
      return response;
    }

    console.error(
      "Owner Video Manager PATCH error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Video settings could not be updated.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request
) {
  try {
    await verifyOwner(request);

    const url =
      new URL(request.url);

    const mediaId =
      clean(
        url.searchParams.get("mediaId"),
        120
      );

    if (!mediaId) {
      return NextResponse.json(
        {
          success: false,
          error: "Video ID is required.",
        },
        { status: 400 }
      );
    }

    const ref = adminDb
      .collection("mediaLibrary")
      .doc(mediaId);

    const snapshot = await ref.get();

    if (!snapshot.exists) {
      return NextResponse.json(
        {
          success: false,
          error: "Video was not found.",
        },
        { status: 404 }
      );
    }

    const data = snapshot.data() || {};

    if (data.kind !== "video") {
      return NextResponse.json(
        {
          success: false,
          error:
            "This Media Library item is not a video.",
        },
        { status: 400 }
      );
    }

    if (
      typeof data.storagePath ===
        "string" &&
      data.storagePath
    ) {
      try {
        await adminBucket
          .file(data.storagePath)
          .delete({
            ignoreNotFound: true,
          });
      } catch (storageError) {
        console.error(
          "Video storage delete warning:",
          storageError
        );
      }
    }

    await ref.delete();

    return NextResponse.json({
      success: true,
      mediaId,
      message: "Video deleted.",
    });
  } catch (error) {
    const response = authError(error);

    if (response) {
      return response;
    }

    console.error(
      "Owner Video Manager DELETE error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Video could not be deleted.",
      },
      { status: 500 }
    );
  }
}




