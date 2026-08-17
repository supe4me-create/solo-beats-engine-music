import { NextResponse } from "next/server";

import {
  adminBucket,
} from "../../../../lib/firebaseAdmin";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request
) {
  try {
    const url =
      new URL(request.url);

    const storagePath =
      url.searchParams
        .get("path")
        ?.trim() || "";

    if (
      !storagePath ||
      !storagePath.startsWith(
        "media/image/"
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid cover path.",
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
          error: "Cover not found.",
        },
        {
          status: 404,
        }
      );
    }

    const [buffer] =
      await file.download();

    const [metadata] =
      await file.getMetadata();

    const contentType =
      metadata.contentType ||
      "image/png";

    return new NextResponse(
      new Uint8Array(buffer),
      {
        status: 200,
        headers: {
          "Content-Type":
            contentType,
          "Cache-Control":
            "public, max-age=300, stale-while-revalidate=3600",
        },
      }
    );
  } catch (error) {
    console.error(
      "Radio cover error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Cover could not be loaded.",
      },
      {
        status: 500,
      }
    );
  }
}
