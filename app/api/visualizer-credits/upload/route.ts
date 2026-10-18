import {
  NextResponse,
} from "next/server";

import {
  adminBucket,
} from "../../../../lib/firebaseAdmin";

import {
  requireVisualizerRenderAccess,
} from "../../../../lib/visualizerRenderAccess";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

function safeFilePart(
  value: string
) {
  return (
    value
      .replace(
        /[^a-zA-Z0-9._-]/g,
        "-"
      )
      .replace(
        /-+/g,
        "-"
      )
      .slice(
        0,
        120
      ) ||
    "visualizer-file"
  );
}

export async function POST(
  request: Request
) {
  try {
    const body =
      await request.json();

    const reservationId =
      typeof body?.reservationId ===
      "string"
        ? body.reservationId
        : "";

    const access =
      await requireVisualizerRenderAccess(
        request,
        reservationId
      );

    const originalName =
      typeof body?.name ===
      "string"
        ? body.name.trim()
        : "";

    const contentType =
      typeof body?.contentType ===
      "string"
        ? body.contentType.trim()
        : "application/octet-stream";

    const kind =
      body?.kind === "image"
        ? "image"
        : body?.kind === "audio"
          ? "audio"
          : body?.kind === "video"
            ? "video"
            : "";

    const size =
      Number(
        body?.size ||
        0
      );

    if (
      !originalName ||
      !kind
    ) {
      return NextResponse.json(
        {
          success:
            false,

          error:
            "INVALID_UPLOAD_REQUEST",
        },
        {
          status:
            400,
        }
      );
    }

    if (
      !Number.isFinite(
        size
      ) ||
      size <=
      0
    ) {
      return NextResponse.json(
        {
          success:
            false,

          error:
            "INVALID_FILE_SIZE",
        },
        {
          status:
            400,
        }
      );
    }

    const maxBytes =
      kind === "video"
        ? 1024 *
          1024 *
          1024
        : 300 *
          1024 *
          1024;

    if (
      size >
      maxBytes
    ) {
      return NextResponse.json(
        {
          success:
            false,

          error:
            "VISUALIZER_FILE_TOO_LARGE",
        },
        {
          status:
            413,
        }
      );
    }

    const stamp =
      Date.now();

    const random =
      crypto
        .randomUUID()
        .replace(
          /[^a-zA-Z0-9]/g,
          ""
        )
        .slice(
          0,
          16
        );

    const storagePath =
      `customer/music-visualizer/${access.uid}/${stamp}-${random}-${kind}-${safeFilePart(
        originalName
      )}`;

    const file =
      adminBucket.file(
        storagePath
      );

    const [
      uploadUrl,
    ] =
      await file.getSignedUrl({
        version:
          "v4",

        action:
          "write",

        expires:
          Date.now() +
          15 *
          60 *
          1000,

        contentType,
      });

    return NextResponse.json({
      success:
        true,

      uploadUrl,

      storagePath,
    });
  }
  catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "VISUALIZER_UPLOAD_PREPARE_FAILED";

    const status =
      message ===
        "AUTH_REQUIRED" ||
      message ===
        "AUTH_INVALID"
        ? 401
        : message ===
            "EMAIL_VERIFICATION_REQUIRED" ||
          message ===
            "ACCOUNT_DISABLED"
          ? 403
          : 400;

    console.error(
      "Visualizer upload preparation error:",
      error
    );

    return NextResponse.json(
      {
        success:
          false,

        error:
          message,
      },
      {
        status,
      }
    );
  }
}