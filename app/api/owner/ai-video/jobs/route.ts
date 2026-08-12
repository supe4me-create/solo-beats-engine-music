import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";

import {
  adminDb,
  firebaseAdminApp,
} from "../../../../../lib/firebaseAdmin";

const OWNER_EMAIL = "supe4.me@gmail.com";

type GenerationMode = "text" | "image" | "music";
type AspectRatio = "16:9" | "9:16" | "1:1";
type Duration = 5 | 10 | 15 | 30 | 60;

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

  if (email !== OWNER_EMAIL) {
    throw new Error("FORBIDDEN");
  }

  return decoded;
}

function isGenerationMode(
  value: unknown
): value is GenerationMode {
  return (
    value === "text" ||
    value === "image" ||
    value === "music"
  );
}

function isAspectRatio(
  value: unknown
): value is AspectRatio {
  return (
    value === "16:9" ||
    value === "9:16" ||
    value === "1:1"
  );
}

function isDuration(
  value: unknown
): value is Duration {
  return (
    value === 5 ||
    value === 10 ||
    value === 15 ||
    value === 30 ||
    value === 60
  );
}

function toIsoString(
  value: unknown
): string | null {
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
    )
      .toDate()
      .toISOString();
  }

  return typeof value === "string"
    ? value
    : null;
}

export async function GET(
  request: Request
) {
  try {
    await verifyOwner(request);

    const snapshot =
      await adminDb
        .collection(
          "aiVideoJobs"
        )
        .orderBy(
          "createdAt",
          "desc"
        )
        .limit(25)
        .get();

    const jobs =
      snapshot.docs.map(
        (document) => {
          const data =
            document.data();

          return {
            id: document.id,
            mode:
              typeof data.mode ===
              "string"
                ? data.mode
                : "text",
            prompt:
              typeof data.prompt ===
              "string"
                ? data.prompt
                : "",
            aspectRatio:
              typeof data.aspectRatio ===
              "string"
                ? data.aspectRatio
                : "16:9",
            duration:
              typeof data.duration ===
              "number"
                ? data.duration
                : 10,
            status:
              typeof data.status ===
              "string"
                ? data.status
                : "ready_for_provider",
            progress:
              typeof data.progress ===
              "number"
                ? data.progress
                : 0,
            imageName:
              typeof data.imageName ===
              "string"
                ? data.imageName
                : null,
            audioName:
              typeof data.audioName ===
              "string"
                ? data.audioName
                : null,
            provider:
              typeof data.provider ===
              "string"
                ? data.provider
                : null,
            providerJobId:
              typeof data.providerJobId ===
              "string"
                ? data.providerJobId
                : null,
            outputUrl:
              typeof data.outputUrl ===
              "string"
                ? data.outputUrl
                : null,
            error:
              typeof data.error ===
              "string"
                ? data.error
                : null,
            createdAt:
              toIsoString(
                data.createdAt
              ),
            updatedAt:
              toIsoString(
                data.updatedAt
              ),
          };
        }
      );

    return NextResponse.json({
      success: true,
      jobs,
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
            "Owner authentication is required.",
        },
        { status: 401 }
      );
    }

    if (
      error instanceof Error &&
      error.message ===
        "FORBIDDEN"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Owner access only.",
        },
        { status: 403 }
      );
    }

    console.error(
      "AI video jobs GET error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "AI video jobs could not be loaded.",
      },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request
) {
  try {
    const decoded =
      await verifyOwner(
        request
      );

    const body =
      (await request.json()) as {
        mode?: unknown;
        prompt?: unknown;
        aspectRatio?: unknown;
        duration?: unknown;
        imageName?: unknown;
        audioName?: unknown;
      };

    const mode =
      body.mode;

    const prompt =
      typeof body.prompt ===
      "string"
        ? body.prompt.trim()
        : "";

    const aspectRatio =
      body.aspectRatio;

    const durationValue =
      typeof body.duration ===
      "string"
        ? Number(
            body.duration
          )
        : body.duration;

    if (
      !isGenerationMode(
        mode
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "A valid generation mode is required.",
        },
        { status: 400 }
      );
    }

    if (!prompt) {
      return NextResponse.json(
        {
          success: false,
          error:
            "A generation prompt is required.",
        },
        { status: 400 }
      );
    }

    if (
      !isAspectRatio(
        aspectRatio
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "A valid aspect ratio is required.",
        },
        { status: 400 }
      );
    }

    if (
      !isDuration(
        durationValue
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "A valid duration is required.",
        },
        { status: 400 }
      );
    }

    const imageName =
      typeof body.imageName ===
      "string" &&
      body.imageName.trim()
        ? body.imageName.trim()
        : null;

    const audioName =
      typeof body.audioName ===
      "string" &&
      body.audioName.trim()
        ? body.audioName.trim()
        : null;

    if (
      mode === "image" &&
      !imageName
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Image to Video requires a source image.",
        },
        { status: 400 }
      );
    }

    if (
      mode === "music" &&
      (!imageName ||
        !audioName)
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Song + Cover requires both an image and an audio file.",
        },
        { status: 400 }
      );
    }

    const reference =
      adminDb
        .collection(
          "aiVideoJobs"
        )
        .doc();

    await reference.set({
      ownerUid:
        decoded.uid,
      ownerEmail:
        typeof decoded.email ===
        "string"
          ? decoded.email
          : OWNER_EMAIL,
      mode,
      prompt,
      aspectRatio,
      duration:
        durationValue,
      imageName,
      audioName,
      status:
        "ready_for_provider",
      progress: 0,
      provider: null,
      providerJobId: null,
      outputUrl: null,
      error: null,
      createdAt:
        FieldValue.serverTimestamp(),
      updatedAt:
        FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      success: true,
      job: {
        id: reference.id,
        mode,
        prompt,
        aspectRatio,
        duration:
          durationValue,
        imageName,
        audioName,
        status:
          "ready_for_provider",
        progress: 0,
      },
      message:
        "AI video job created. Provider connection is not active yet.",
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
            "Owner authentication is required.",
        },
        { status: 401 }
      );
    }

    if (
      error instanceof Error &&
      error.message ===
        "FORBIDDEN"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Owner access only.",
        },
        { status: 403 }
      );
    }

    console.error(
      "AI video jobs POST error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "AI video job could not be created.",
      },
      { status: 500 }
    );
  }
}