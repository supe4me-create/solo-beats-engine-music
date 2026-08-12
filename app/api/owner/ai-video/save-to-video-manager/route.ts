import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";

import {
  adminBucket,
  adminDb,
  firebaseAdminApp,
} from "../../../../../lib/firebaseAdmin";

const OWNER_EMAIL = "supe4.me@gmail.com";

export const runtime = "nodejs";

function getBearerToken(
  request: Request
): string | null {
  const authorization =
    request.headers.get("authorization");

  if (!authorization) {
    return null;
  }

  const match =
    authorization.match(/^Bearer\s+(.+)$/i);

  return match?.[1]?.trim() || null;
}

async function verifyOwner(
  request: Request
) {
  const idToken =
    getBearerToken(request);

  if (!idToken) {
    throw new Error("UNAUTHORIZED");
  }

  const decoded =
    await getAuth(
      firebaseAdminApp
    ).verifyIdToken(idToken);

  const email =
    typeof decoded.email === "string"
      ? decoded.email.toLowerCase()
      : "";

  if (
    email !== OWNER_EMAIL.toLowerCase()
  ) {
    throw new Error("FORBIDDEN");
  }

  return decoded;
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

function errorResponse(
  error: unknown
) {
  if (
    error instanceof Error &&
    error.message === "UNAUTHORIZED"
  ) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Owner authentication is required.",
      },
      { status: 401 }
    );
  }

  if (
    error instanceof Error &&
    error.message === "FORBIDDEN"
  ) {
    return NextResponse.json(
      {
        success: false,
        error: "Owner access only.",
      },
      { status: 403 }
    );
  }

  console.error(
    "Save AI video to Video Manager error:",
    error
  );

  return NextResponse.json(
    {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "AI video could not be saved to Video Manager.",
    },
    { status: 500 }
  );
}

export async function POST(
  request: Request
) {
  try {
    await verifyOwner(request);

    const body =
      (await request.json()) as {
        jobId?: unknown;
        title?: unknown;
      };

    const jobId =
      clean(body.jobId, 150);

    if (!jobId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "AI video job ID is required.",
        },
        { status: 400 }
      );
    }

    const jobReference =
      adminDb
        .collection("aiVideoJobs")
        .doc(jobId);

    const jobSnapshot =
      await jobReference.get();

    if (!jobSnapshot.exists) {
      return NextResponse.json(
        {
          success: false,
          error:
            "AI video job was not found.",
        },
        { status: 404 }
      );
    }

    const job =
      jobSnapshot.data() || {};

    if (
      job.status !== "completed"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Only a completed AI video can be saved.",
        },
        { status: 400 }
      );
    }

    const outputUrl =
      typeof job.outputUrl === "string"
        ? job.outputUrl.trim()
        : "";

    if (!outputUrl) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Completed AI video does not have an output URL.",
        },
        { status: 400 }
      );
    }

    const existingMediaId =
      typeof job.videoManagerMediaId ===
        "string"
        ? job.videoManagerMediaId.trim()
        : "";

    if (existingMediaId) {
      const existingMedia =
        await adminDb
          .collection("mediaLibrary")
          .doc(existingMediaId)
          .get();

      if (existingMedia.exists) {
        return NextResponse.json({
          success: true,
          alreadySaved: true,
          mediaId: existingMediaId,
          storagePath:
            existingMedia.data()
              ?.storagePath || null,
          message:
            "This AI video is already saved in Video Manager.",
        });
      }
    }

    const videoResponse =
      await fetch(outputUrl, {
        cache: "no-store",
      });

    if (!videoResponse.ok) {
      throw new Error(
        `Runway video download failed with status ${videoResponse.status}.`
      );
    }

    const arrayBuffer =
      await videoResponse.arrayBuffer();

    if (!arrayBuffer.byteLength) {
      throw new Error(
        "Runway returned an empty video file."
      );
    }

    const contentType =
      videoResponse.headers
        .get("content-type")
        ?.split(";")[0]
        ?.trim() ||
      "video/mp4";

    if (
      !contentType.startsWith("video/")
    ) {
      throw new Error(
        `Runway output is not a video (${contentType}).`
      );
    }

    const mediaReference =
      adminDb
        .collection("mediaLibrary")
        .doc();

    const mediaId =
      mediaReference.id;

    const originalName =
      `ai-video-${jobId}.mp4`;

    const storagePath =
      `media/video/${mediaId}/${originalName}`;

    const storageFile =
      adminBucket.file(storagePath);

    try {
      await storageFile.save(
        Buffer.from(arrayBuffer),
        {
          resumable: false,
          metadata: {
            contentType: "video/mp4",
            metadata: {
              source:
                "solo-beats-ai-video",
              aiVideoJobId: jobId,
              provider:
                typeof job.provider ===
                  "string"
                  ? job.provider
                  : "runway",
            },
          },
        }
      );

      const requestedTitle =
        clean(body.title, 200);

      const prompt =
        typeof job.prompt === "string"
          ? job.prompt.trim()
          : "";

      const title =
        requestedTitle ||
        (
          prompt
            ? `AI Video - ${prompt}`
            : `AI Video ${jobId.slice(0, 8)}`
        ).slice(0, 200);

      await mediaReference.set({
        kind: "video",

        title,

        description:
          prompt
            ? `AI-generated video. Prompt: ${prompt}`.slice(
                0,
                2000
              )
            : "AI-generated SOLO BEATS video.",

        sourceType: "solo-beats",

        originalName,
        mimeType: "video/mp4",
        extension: "mp4",
        sizeBytes:
          arrayBuffer.byteLength,

        storagePath,
        status: "active",

        published: false,
        homepageEnabled: false,
        premiumTvEnabled: false,
        featured: false,
        displayOrder: 0,

        tvScheduleStart: null,
        tvScheduleEnd: null,

        aiGenerated: true,
        aiVideoJobId: jobId,
        aiProvider:
          typeof job.provider === "string"
            ? job.provider
            : "runway",
        aiProviderJobId:
          typeof job.providerJobId ===
            "string"
            ? job.providerJobId
            : null,
        aiPrompt: prompt || null,
        aiAspectRatio:
          typeof job.aspectRatio ===
            "string"
            ? job.aspectRatio
            : null,
        aiDuration:
          typeof job.duration ===
            "number"
            ? job.duration
            : null,

        createdAt:
          FieldValue.serverTimestamp(),
        updatedAt:
          FieldValue.serverTimestamp(),
      });

      await jobReference.set(
        {
          savedToVideoManager: true,
          videoManagerMediaId:
            mediaId,
          videoManagerStoragePath:
            storagePath,
          savedToVideoManagerAt:
            FieldValue.serverTimestamp(),
          updatedAt:
            FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      return NextResponse.json({
        success: true,
        alreadySaved: false,
        jobId,
        mediaId,
        storagePath,
        sizeBytes:
          arrayBuffer.byteLength,
        message:
          "AI video saved to Video Manager.",
      });
    } catch (saveError) {
      try {
        await storageFile.delete({
          ignoreNotFound: true,
        });
      } catch (cleanupError) {
        console.error(
          "AI video Storage cleanup warning:",
          cleanupError
        );
      }

      throw saveError;
    }
  } catch (error) {
    return errorResponse(error);
  }
}
