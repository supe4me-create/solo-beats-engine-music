import { NextResponse } from "next/server";

import {
  adminBucket,
  adminDb,
} from "../../../../lib/firebaseAdmin";

import {
  requirePremiumAccess,
} from "../../../../lib/requirePremium";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function signedReadUrl(
  storagePath: unknown
) {
  if (
    typeof storagePath !== "string" ||
    !storagePath.trim()
  ) {
    return null;
  }

  const file =
    adminBucket.file(
      storagePath.trim()
    );

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
}

export async function GET(
  request: Request
) {
  try {
    const premium =
      await requirePremiumAccess(
        request
      );

    if (!premium.allowed) {
      return NextResponse.json(
        {
          success: false,
          tracks: [],
          error:
            premium.error,
        },
        {
          status:
            premium.statusCode,
          headers: {
            "Cache-Control":
              "no-store, max-age=0",
          },
        }
      );
    }

    const snapshot =
      await adminDb
        .collection(
          "mediaLibrary"
        )
        .where(
          "premiumAssigned",
          "==",
          true
        )
        .get();

    const tracks = (
      await Promise.all(
        snapshot.docs.map(
          async (mediaDoc) => {
            const media =
              mediaDoc.data();

            if (
              media.kind !== "audio" ||
              media.status ===
                "deleted" ||
              media.published !==
                true ||
              media.premiumAssigned !==
                true ||
              media.source !==
                "ai-music"
            ) {
              return null;
            }

            const previewUrl =
              await signedReadUrl(
                media.storagePath
              );

            if (!previewUrl) {
              return null;
            }

            return {
              id:
                mediaDoc.id,

              title:
                typeof media.title ===
                  "string" &&
                media.title.trim()
                  ? media.title.trim()
                  : "AI Music",

              artist:
                "Solo Beats",

              albumTitle:
                "AI Music",

              previewUrl,
            };
          }
        )
      )
    ).filter(
      (
        track
      ): track is {
        id: string;
        title: string;
        artist: string;
        albumTitle: string;
        previewUrl: string;
      } => track !== null
    );

    tracks.sort(
      (a, b) =>
        a.title.localeCompare(
          b.title
        )
    );

    return NextResponse.json(
      {
        success: true,
        tracks,
      },
      {
        headers: {
          "Cache-Control":
            "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error(
      "Premium AI Music feed error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        tracks: [],
        error:
          error instanceof Error
            ? error.message
            : "Premium AI Music could not be loaded.",
      },
      {
        status: 500,
        headers: {
          "Cache-Control":
            "no-store, max-age=0",
        },
      }
    );
  }
}
