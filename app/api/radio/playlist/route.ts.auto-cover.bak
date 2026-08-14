import { NextResponse } from "next/server";

import {
  adminBucket,
  adminDb,
} from "../../../../lib/firebaseAdmin";

type PlaylistDoc = {
  name?: string;
  description?: string;
  enabled?: boolean;
  scheduleEnabled?: boolean;
  scheduleStartAt?: unknown;
  scheduleEndAt?: unknown;
  priority?: number;
};

type TrackDoc = {
  mediaId?: string;
  enabled?: boolean;
  order?: number;
  title?: string;
  albumTitle?: string;
  artist?: string;
  cover?: string;
};

function dateMs(value: unknown) {
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as { toDate?: unknown })
      .toDate === "function"
  ) {
    return (
      value as { toDate: () => Date }
    ).toDate().getTime();
  }

  if (typeof value === "string") {
    const time =
      new Date(value).getTime();

    return Number.isFinite(time)
      ? time
      : null;
  }

  return null;
}

async function signedReadUrl(
  storagePath: unknown
) {
  if (
    typeof storagePath !== "string" ||
    !storagePath
  ) {
    return null;
  }

  const file =
    adminBucket.file(storagePath);

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

async function chooseLivePlaylist() {
  const [playlistSnapshot, settingsSnapshot] =
    await Promise.all([
      adminDb
        .collection("radioPlaylists")
        .get(),
      adminDb
        .collection("radioSettings")
        .doc("station")
        .get(),
    ]);

  const playlists =
    playlistSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as PlaylistDoc),
    }));

  const now = Date.now();

  const scheduled = playlists
    .filter((playlist) => {
      if (
        playlist.enabled === false ||
        playlist.scheduleEnabled !== true
      ) {
        return false;
      }

      const start =
        dateMs(
          playlist.scheduleStartAt
        );

      const end =
        dateMs(
          playlist.scheduleEndAt
        );

      return (
        start !== null &&
        end !== null &&
        now >= start &&
        now < end
      );
    })
    .sort((a, b) => {
      const priorityDifference =
        (Number(b.priority) || 0) -
        (Number(a.priority) || 0);

      if (priorityDifference !== 0) {
        return priorityDifference;
      }

      return (
        (dateMs(
          b.scheduleStartAt
        ) || 0) -
        (dateMs(
          a.scheduleStartAt
        ) || 0)
      );
    });

  if (scheduled[0]) {
    return {
      playlist: scheduled[0],
      source: "schedule" as const,
    };
  }

  const settings =
    settingsSnapshot.exists
      ? settingsSnapshot.data() || {}
      : {};

  const manualPlaylistId =
    typeof settings.manualPlaylistId ===
    "string"
      ? settings.manualPlaylistId
      : "";

  const manual =
    playlists.find(
      (playlist) =>
        playlist.id ===
          manualPlaylistId &&
        playlist.enabled !== false
    );

  if (manual) {
    return {
      playlist: manual,
      source: "manual" as const,
    };
  }

  const fallback =
    playlists.find(
      (playlist) =>
        playlist.enabled !== false
    );

  return fallback
    ? {
        playlist: fallback,
        source: "fallback" as const,
      }
    : null;
}

export async function GET() {
  try {
    const selected =
      await chooseLivePlaylist();

    if (!selected) {
      return NextResponse.json(
        {
          success: true,
          playlist: null,
          source: "none",
          tracks: [],
        },
        {
          headers: {
            "Cache-Control":
              "no-store, max-age=0",
          },
        }
      );
    }

    const trackSnapshot =
      await adminDb
        .collection("radioPlaylists")
        .doc(selected.playlist.id)
        .collection("tracks")
        .get();

    const activeDocs =
      trackSnapshot.docs
        .map((doc) => ({
          id: doc.id,
          ...(doc.data() as TrackDoc),
        }))
        .filter(
          (item) =>
            item.enabled !== false
        )
        .sort(
          (a, b) =>
            (Number(a.order) || 0) -
            (Number(b.order) || 0)
        );

    const tracks = (
      await Promise.all(
        activeDocs.map(
          async (item) => {
            const mediaId =
              typeof item.mediaId ===
              "string"
                ? item.mediaId
                : item.id;

            const mediaSnapshot =
              await adminDb
                .collection(
                  "mediaLibrary"
                )
                .doc(mediaId)
                .get();

            if (
              !mediaSnapshot.exists
            ) {
              return null;
            }

            const media =
              mediaSnapshot.data()!;

            if (
              media.kind !== "audio" ||
              media.status === "deleted"
            ) {
              return null;
            }

            const src =
              await signedReadUrl(
                media.storagePath
              );

            if (!src) {
              return null;
            }

            return {
              id: mediaId,
              title:
                item.title ||
                media.title ||
                media.originalName ||
                "Untitled Track",
              albumTitle:
                item.albumTitle ||
                selected.playlist.name ||
                "SOLO BEATS RADIO",
              artist:
                item.artist ||
                "Solo Beats",
              cover:
                item.cover || "",
              src,
              order:
                Number(item.order) || 0,
            };
          }
        )
      )
    ).filter(
      (
        track
      ): track is NonNullable<
        typeof track
      > => Boolean(track)
    );

    return NextResponse.json(
      {
        success: true,
        source: selected.source,
        playlist: {
          playlistId:
            selected.playlist.id,
          name:
            selected.playlist.name ||
            "SOLO BEATS RADIO",
          description:
            selected.playlist.description ||
            "",
        },
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
      "Radio playlist GET error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        playlist: null,
        tracks: [],
        error:
          "Radio playlist could not be loaded.",
      },
      { status: 500 }
    );
  }
}

