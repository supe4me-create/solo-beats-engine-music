import { NextResponse } from "next/server";

import {
  adminBucket,
  adminDb,
} from "../../../../lib/firebaseAdmin";

export const dynamic = "force-dynamic";

function toIso(value: unknown): string | null {
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as { toDate?: unknown }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }

  return typeof value === "string" ? value : null;
}

async function signedReadUrl(path: unknown) {
  if (typeof path !== "string" || !path) {
    return null;
  }

  try {
    const file = adminBucket.file(path);
    const [exists] = await file.exists();

    if (!exists) {
      return null;
    }

    const [url] = await file.getSignedUrl({
      action: "read",
      expires: Date.now() + 60 * 60 * 1000,
    });

    return url;
  } catch (error) {
    console.error("Public catalog media URL error:", error);
    return null;
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const includeFlagshipDraft =
      searchParams.get("includeFlagshipDraft") === "1";

    const albumsRef =
      adminDb.collection("albums");

    const snapshot = includeFlagshipDraft
      ? await albumsRef.get()
      : await albumsRef
          .where(
            "publishStatus",
            "==",
            "published"
          )
          .get();

    const visibleDocs = includeFlagshipDraft
      ? snapshot.docs.filter((document) => {
          const data = document.data();

          return (
            data.publishStatus === "published" ||
            data.isFlagship === true
          );
        })
      : snapshot.docs;

    const albums = await Promise.all(
      visibleDocs.map(async (document) => {
        const data = document.data();

        const coverStorageUrl = await signedReadUrl(
          data.coverStoragePath
        );

        const coverUrl =
          coverStorageUrl ||
          (
            typeof data.legacyCoverPath === "string"
              ? data.legacyCoverPath
              : null
          );

        const tracks = await Promise.all(
          (Array.isArray(data.tracks) ? data.tracks : []).map(
            async (
              track: Record<string, unknown>,
              index: number
            ) => ({
              id:
                typeof track.id === "string" && track.id
                  ? track.id
                  : `${document.id}-${String(index + 1).padStart(2, "0")}`,
              number:
                typeof track.number === "number"
                  ? track.number
                  : index + 1,
              title:
                typeof track.title === "string" && track.title
                  ? track.title
                  : `Track ${index + 1}`,
              mediaId:
                typeof track.mediaId === "string"
                  ? track.mediaId
                  : null,
              storagePath:
                typeof track.storagePath === "string"
                  ? track.storagePath
                  : null,
              previewUrl:
                (await signedReadUrl(
                  track.storagePath
                )) ||
                (
                  typeof track.previewUrl === "string"
                    ? track.previewUrl
                    : typeof track.audio === "string"
                      ? track.audio
                      : typeof track.preview === "string"
                        ? track.preview
                        : null
                ),
              price: Number(data.trackPrice || 1),
            })
          )
        );

        let albumPreviewUrl: string | null = null;

        if (data.albumPreviewMediaId) {
          const previewTrack = tracks.find(
            (track) =>
              track.mediaId === data.albumPreviewMediaId
          );

          albumPreviewUrl =
            previewTrack?.previewUrl || null;
        }

        if (!albumPreviewUrl) {
          albumPreviewUrl =
            tracks.find((track) => track.previewUrl)
              ?.previewUrl || null;
        }

        if (
          !albumPreviewUrl &&
          typeof data.legacyAlbumPreviewPath === "string"
        ) {
          albumPreviewUrl =
            data.legacyAlbumPreviewPath || null;
        }

        return {
          id: document.id,
          albumId: document.id,
          title: data.title || "Untitled Album",
          artist: data.artist || "Solo Beats",
          year: Number(
            data.year || new Date().getFullYear()
          ),
          genre: data.genre || "Electronic",
          description: data.description || "",
          status:
            data.status === "released"
              ? "released"
              : "upcoming",
          publishStatus:
            data.publishStatus === "published"
              ? "published"
              : "draft",
          isFlagship: data.isFlagship === true,
          flagshipPreviewTrackIds:
            Array.isArray(data.flagshipPreviewTrackIds)
              ? data.flagshipPreviewTrackIds.filter(
                  (value: unknown) =>
                    typeof value === "string"
                )
              : [],
          accessType:
            data.accessType === "premium"
              ? "premium"
              : "standard",
          cover: coverUrl,
          coverUrl,
          albumPreview: albumPreviewUrl,
          albumPreviewUrl,
          albumPrice: Number(data.albumPrice || 0),
          trackPrice: Number(data.trackPrice || 1),
          pageLink:
            data.pageLink ||
            `/albums/${document.id}`,
          trackCount: tracks.length,
          tracks,
          createdAt: toIso(data.createdAt),
          updatedAt: toIso(data.updatedAt),
        };
      })
    );

    albums.sort((a, b) => {
      const aTime = a.updatedAt
        ? new Date(a.updatedAt).getTime()
        : 0;

      const bTime = b.updatedAt
        ? new Date(b.updatedAt).getTime()
        : 0;

      return bTime - aTime;
    });

    return NextResponse.json(
      {
        success: true,
        albums,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    console.error("Public catalog GET error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Public catalog could not be loaded.",
      },
      { status: 500 }
    );
  }
}

