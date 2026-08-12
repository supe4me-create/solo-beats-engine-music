import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import {
  FieldValue,
  Timestamp,
} from "firebase-admin/firestore";

import {
  adminBucket,
  adminDb,
  firebaseAdminApp,
} from "../../../../lib/firebaseAdmin";

const OWNER_EMAIL = "supe4.me@gmail.com";
const DEFAULT_PLAYLIST_ID = "default";

type PlaylistDoc = {
  name?: string;
  description?: string;
  enabled?: boolean;
  scheduleEnabled?: boolean;
  scheduleStartAt?: unknown;
  scheduleEndAt?: unknown;
  priority?: number;
  createdAt?: unknown;
  updatedAt?: unknown;
};

type TrackDoc = {
  mediaId?: string;
  enabled?: boolean;
  order?: number;
  title?: string;
  albumTitle?: string;
  artist?: string;
  cover?: string;
  storagePath?: string | null;
  createdAt?: unknown;
  updatedAt?: unknown;
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

  const decoded =
    await getAuth(firebaseAdminApp).verifyIdToken(token);

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

function toIso(value: unknown) {
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as { toDate?: unknown }).toDate ===
      "function"
  ) {
    return (
      value as { toDate: () => Date }
    ).toDate().toISOString();
  }

  if (typeof value === "string") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString();
    }
  }

  return null;
}

function parseDate(value: unknown) {
  const text = clean(value, 100);

  if (!text) {
    return null;
  }

  const date = new Date(text);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

async function signedReadUrl(storagePath: unknown) {
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

async function ensureDefaultPlaylist() {
  const playlistsRef =
    adminDb.collection("radioPlaylists");

  const playlistSnapshot =
    await playlistsRef.limit(1).get();

  if (!playlistSnapshot.empty) {
    return;
  }

  const defaultRef =
    playlistsRef.doc(DEFAULT_PLAYLIST_ID);

  const legacySnapshot =
    await adminDb
      .collection("radioPlaylist")
      .get();

  const batch = adminDb.batch();

  batch.set(defaultRef, {
    name: "SOLO BEATS RADIO",
    description:
      "Default playlist migrated from the original Radio programming.",
    enabled: true,
    scheduleEnabled: false,
    priority: 0,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  for (const legacyDoc of legacySnapshot.docs) {
    const data = legacyDoc.data();

    batch.set(
      defaultRef
        .collection("tracks")
        .doc(legacyDoc.id),
      {
        ...data,
        mediaId:
          typeof data.mediaId === "string"
            ? data.mediaId
            : legacyDoc.id,
        createdAt:
          data.createdAt ||
          FieldValue.serverTimestamp(),
        updatedAt:
          FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  }

  batch.set(
    adminDb
      .collection("radioSettings")
      .doc("station"),
    {
      manualPlaylistId: DEFAULT_PLAYLIST_ID,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  await batch.commit();
}

async function getStationSettings() {
  const snapshot =
    await adminDb
      .collection("radioSettings")
      .doc("station")
      .get();

  return snapshot.exists
    ? snapshot.data() || {}
    : {};
}

async function getPlaylistOrThrow(
  playlistId: string
) {
  const ref =
    adminDb
      .collection("radioPlaylists")
      .doc(playlistId);

  const snapshot = await ref.get();

  if (!snapshot.exists) {
    throw new Error("PLAYLIST_NOT_FOUND");
  }

  return {
    ref,
    data: snapshot.data() as PlaylistDoc,
  };
}

export async function GET(request: Request) {
  try {
    await verifyOwner(request);
    await ensureDefaultPlaylist();

    const [mediaSnapshot, playlistSnapshot, settings] =
      await Promise.all([
        adminDb
          .collection("mediaLibrary")
          .orderBy("createdAt", "desc")
          .get(),
        adminDb
          .collection("radioPlaylists")
          .get(),
        getStationSettings(),
      ]);

    const playlists = await Promise.all(
      playlistSnapshot.docs.map(async (doc) => {
        const data = doc.data() as PlaylistDoc;

        const tracksSnapshot =
          await doc.ref
            .collection("tracks")
            .get();

        const trackDocs =
          tracksSnapshot.docs.map((trackDoc) => ({
            id: trackDoc.id,
            ...(trackDoc.data() as TrackDoc),
          }));

        trackDocs.sort(
          (a, b) =>
            (Number(a.order) || 0) -
            (Number(b.order) || 0)
        );

        return {
          playlistId: doc.id,
          name:
            data.name ||
            "Untitled Playlist",
          description:
            data.description || "",
          enabled:
            data.enabled !== false,
          scheduleEnabled:
            data.scheduleEnabled === true,
          scheduleStartAt:
            toIso(data.scheduleStartAt),
          scheduleEndAt:
            toIso(data.scheduleEndAt),
          priority:
            Number(data.priority) || 0,
          createdAt:
            toIso(data.createdAt),
          updatedAt:
            toIso(data.updatedAt),
          trackCount:
            trackDocs.length,
          enabledTrackCount:
            trackDocs.filter(
              (track) =>
                track.enabled !== false
            ).length,
          tracks: trackDocs.map((track) => ({
            mediaId:
              typeof track.mediaId ===
              "string"
                ? track.mediaId
                : track.id,
            enabled:
              track.enabled !== false,
            order:
              Number(track.order) || 0,
            title:
              track.title || "",
            artist:
              track.artist || "",
            albumTitle:
              track.albumTitle || "",
            cover:
              track.cover || "",
            storagePath:
              track.storagePath || null,
            createdAt:
              toIso(track.createdAt),
            updatedAt:
              toIso(track.updatedAt),
          })),
        };
      })
    );

    playlists.sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    const selectedPlaylistId =
      clean(
        new URL(request.url).searchParams.get(
          "playlistId"
        ),
        120
      ) ||
      clean(
        settings.manualPlaylistId,
        120
      ) ||
      playlists[0]?.playlistId ||
      "";

    const selectedPlaylist =
      playlists.find(
        (playlist) =>
          playlist.playlistId ===
          selectedPlaylistId
      ) ||
      playlists[0] ||
      null;

    const selectedTrackMap =
      new Map(
        (selectedPlaylist?.tracks || []).map(
          (track) => [
            track.mediaId,
            track,
          ]
        )
      );

    const audioMedia = await Promise.all(
      mediaSnapshot.docs
        .filter((doc) => {
          const data = doc.data();

          return (
            data.kind === "audio" &&
            data.status !== "deleted"
          );
        })
        .map(async (doc) => {
          const data = doc.data();
          const radio =
            selectedTrackMap.get(doc.id);

          return {
            mediaId: doc.id,
            title:
              data.title ||
              data.originalName ||
              "Untitled Track",
            originalName:
              data.originalName || null,
            storagePath:
              data.storagePath || null,
            previewUrl:
              await signedReadUrl(
                data.storagePath
              ),
            createdAt:
              toIso(data.createdAt),
            assignedToRadio:
              Boolean(radio),
            radio: radio
              ? {
                  enabled:
                    radio.enabled !== false,
                  order:
                    Number(radio.order) || 0,
                  title:
                    radio.title ||
                    data.title ||
                    data.originalName ||
                    "Untitled Track",
                  artist:
                    radio.artist ||
                    "Solo Beats",
                  albumTitle:
                    radio.albumTitle ||
                    selectedPlaylist?.name ||
                    "SOLO BEATS RADIO",
                  cover:
                    radio.cover || "",
                  createdAt:
                    radio.createdAt,
                  updatedAt:
                    radio.updatedAt,
                }
              : null,
          };
        })
    );

    audioMedia.sort((a, b) => {
      if (
        a.assignedToRadio &&
        !b.assignedToRadio
      ) {
        return -1;
      }

      if (
        !a.assignedToRadio &&
        b.assignedToRadio
      ) {
        return 1;
      }

      const aOrder =
        a.radio?.order ??
        Number.MAX_SAFE_INTEGER;

      const bOrder =
        b.radio?.order ??
        Number.MAX_SAFE_INTEGER;

      return aOrder - bOrder;
    });

    return NextResponse.json({
      success: true,
      audioMedia,
      playlists,
      selectedPlaylistId:
        selectedPlaylist?.playlistId || "",
      manualPlaylistId:
        clean(
          settings.manualPlaylistId,
          120
        ),
    });
  } catch (error) {
    const response = authError(error);

    if (response) {
      return response;
    }

    console.error(
      "Owner Radio GET error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Radio programming could not be loaded.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const owner =
      await verifyOwner(request);

    await ensureDefaultPlaylist();

    const payload = await request.json();

    const action =
      clean(payload.action, 50);

    if (action === "createPlaylist") {
      const name =
        clean(payload.name, 120);

      if (!name) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Playlist name is required.",
          },
          { status: 400 }
        );
      }

      const ref =
        adminDb
          .collection("radioPlaylists")
          .doc();

      await ref.set({
        name,
        description:
          clean(
            payload.description,
            500
          ),
        enabled: true,
        scheduleEnabled: false,
        priority: 0,
        createdBy:
          owner.email ||
          OWNER_EMAIL,
        createdAt:
          FieldValue.serverTimestamp(),
        updatedAt:
          FieldValue.serverTimestamp(),
      });

      return NextResponse.json({
        success: true,
        playlistId: ref.id,
        message:
          "Radio playlist created.",
      });
    }

    if (action === "updatePlaylist") {
      const playlistId =
        clean(payload.playlistId, 120);

      if (!playlistId) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Playlist ID is required.",
          },
          { status: 400 }
        );
      }

      const { ref } =
        await getPlaylistOrThrow(
          playlistId
        );

      const update: Record<
        string,
        unknown
      > = {
        updatedAt:
          FieldValue.serverTimestamp(),
      };

      if (
        typeof payload.name ===
        "string"
      ) {
        const name =
          clean(payload.name, 120);

        if (!name) {
          return NextResponse.json(
            {
              success: false,
              error:
                "Playlist name cannot be empty.",
            },
            { status: 400 }
          );
        }

        update.name = name;
      }

      if (
        typeof payload.description ===
        "string"
      ) {
        update.description =
          clean(
            payload.description,
            500
          );
      }

      if (
        typeof payload.enabled ===
        "boolean"
      ) {
        update.enabled =
          payload.enabled;
      }

      if (
        typeof payload.priority !==
        "undefined"
      ) {
        const priority =
          Number(payload.priority);

        if (
          !Number.isFinite(priority)
        ) {
          return NextResponse.json(
            {
              success: false,
              error:
                "Playlist priority must be a number.",
            },
            { status: 400 }
          );
        }

        update.priority = priority;
      }

      if (
        typeof payload.scheduleEnabled ===
        "boolean"
      ) {
        update.scheduleEnabled =
          payload.scheduleEnabled;
      }

      if (
        "scheduleStartAt" in payload ||
        "scheduleEndAt" in payload
      ) {
        const start =
          parseDate(
            payload.scheduleStartAt
          );

        const end =
          parseDate(
            payload.scheduleEndAt
          );

        if (
          payload.scheduleEnabled === true ||
          (
            typeof payload.scheduleEnabled ===
              "undefined" &&
            (
              payload.scheduleStartAt ||
              payload.scheduleEndAt
            )
          )
        ) {
          if (!start || !end) {
            return NextResponse.json(
              {
                success: false,
                error:
                  "A scheduled playlist needs both a start and end time.",
              },
              { status: 400 }
            );
          }

          if (
            end.getTime() <=
            start.getTime()
          ) {
            return NextResponse.json(
              {
                success: false,
                error:
                  "Schedule end must be after schedule start.",
              },
              { status: 400 }
            );
          }
        }

        update.scheduleStartAt =
          start
            ? Timestamp.fromDate(start)
            : null;

        update.scheduleEndAt =
          end
            ? Timestamp.fromDate(end)
            : null;
      }

      await ref.set(
        update,
        { merge: true }
      );

      return NextResponse.json({
        success: true,
        message:
          "Playlist settings updated.",
      });
    }

    if (action === "setActivePlaylist") {
      const playlistId =
        clean(payload.playlistId, 120);

      if (!playlistId) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Playlist ID is required.",
          },
          { status: 400 }
        );
      }

      await getPlaylistOrThrow(
        playlistId
      );

      await adminDb
        .collection("radioSettings")
        .doc("station")
        .set(
          {
            manualPlaylistId:
              playlistId,
            updatedAt:
              FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

      return NextResponse.json({
        success: true,
        message:
          "Playlist is now the manual live playlist.",
      });
    }

    if (action === "deletePlaylist") {
      const playlistId =
        clean(payload.playlistId, 120);

      if (!playlistId) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Playlist ID is required.",
          },
          { status: 400 }
        );
      }

      const playlistSnapshot =
        await adminDb
          .collection("radioPlaylists")
          .get();

      if (
        playlistSnapshot.size <= 1
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Radio must keep at least one playlist.",
          },
          { status: 400 }
        );
      }

      const { ref } =
        await getPlaylistOrThrow(
          playlistId
        );

      const trackSnapshot =
        await ref
          .collection("tracks")
          .get();

      const batch = adminDb.batch();

      for (const doc of trackSnapshot.docs) {
        batch.delete(doc.ref);
      }

      batch.delete(ref);

      const settings =
        await getStationSettings();

      if (
        settings.manualPlaylistId ===
        playlistId
      ) {
        const replacement =
          playlistSnapshot.docs.find(
            (doc) =>
              doc.id !== playlistId
          );

        if (replacement) {
          batch.set(
            adminDb
              .collection("radioSettings")
              .doc("station"),
            {
              manualPlaylistId:
                replacement.id,
              updatedAt:
                FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
        }
      }

      await batch.commit();

      return NextResponse.json({
        success: true,
        message:
          "Radio playlist deleted.",
      });
    }

    const playlistId =
      clean(payload.playlistId, 120);

    if (!playlistId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Playlist ID is required.",
        },
        { status: 400 }
      );
    }

    const { ref: playlistRef } =
      await getPlaylistOrThrow(
        playlistId
      );

    if (action === "add") {
      const mediaId =
        clean(payload.mediaId, 120);

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
            error:
              "Media Library item was not found.",
          },
          { status: 404 }
        );
      }

      const media = mediaSnapshot.data()!;

      if (
        media.kind !== "audio" ||
        media.status === "deleted"
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Only active MP3/WAV Media Library items can be added to Radio.",
          },
          { status: 400 }
        );
      }

      const trackSnapshot =
        await playlistRef
          .collection("tracks")
          .get();

      const existingOrders =
        trackSnapshot.docs.map((doc) => {
          const value =
            Number(doc.data().order);

          return Number.isFinite(value)
            ? value
            : 0;
        });

      const nextOrder =
        existingOrders.length > 0
          ? Math.max(
              ...existingOrders
            ) + 1
          : 1;

      const trackRef =
        playlistRef
          .collection("tracks")
          .doc(mediaId);

      await trackRef.set(
        {
          mediaId,
          enabled: true,
          order: nextOrder,
          title:
            clean(payload.title, 200) ||
            media.title ||
            media.originalName ||
            "Untitled Track",
          artist:
            clean(payload.artist, 200) ||
            "Solo Beats",
          albumTitle:
            clean(
              payload.albumTitle,
              200
            ) ||
            "SOLO BEATS RADIO",
          cover:
            clean(payload.cover, 500),
          storagePath:
            media.storagePath || null,
          addedBy:
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
        message:
          "Track added to playlist.",
      });
    }

    if (action === "update") {
      const mediaId =
        clean(payload.mediaId, 120);

      if (!mediaId) {
        return NextResponse.json(
          {
            success: false,
            error: "Media ID is required.",
          },
          { status: 400 }
        );
      }

      const trackRef =
        playlistRef
          .collection("tracks")
          .doc(mediaId);

      const trackSnapshot =
        await trackRef.get();

      if (!trackSnapshot.exists) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Radio track was not found in this playlist.",
          },
          { status: 404 }
        );
      }

      const update: Record<
        string,
        unknown
      > = {
        updatedAt:
          FieldValue.serverTimestamp(),
      };

      if (
        typeof payload.enabled ===
        "boolean"
      ) {
        update.enabled =
          payload.enabled;
      }

      if (
        Number.isFinite(
          Number(payload.order)
        )
      ) {
        update.order =
          Number(payload.order);
      }

      if (
        typeof payload.title ===
        "string"
      ) {
        update.title =
          clean(payload.title, 200);
      }

      if (
        typeof payload.artist ===
        "string"
      ) {
        update.artist =
          clean(payload.artist, 200);
      }

      if (
        typeof payload.albumTitle ===
        "string"
      ) {
        update.albumTitle =
          clean(
            payload.albumTitle,
            200
          );
      }

      if (
        typeof payload.cover ===
        "string"
      ) {
        update.cover =
          clean(payload.cover, 500);
      }

      await trackRef.set(
        update,
        { merge: true }
      );

      return NextResponse.json({
        success: true,
        message:
          "Radio track updated.",
      });
    }

    if (action === "remove") {
      const mediaId =
        clean(payload.mediaId, 120);

      if (!mediaId) {
        return NextResponse.json(
          {
            success: false,
            error: "Media ID is required.",
          },
          { status: 400 }
        );
      }

      await playlistRef
        .collection("tracks")
        .doc(mediaId)
        .delete();

      return NextResponse.json({
        success: true,
        message:
          "Track removed from playlist.",
      });
    }

    if (action === "reorder") {
      const items = Array.isArray(
        payload.items
      )
        ? payload.items
        : [];

      if (items.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Radio order items are required.",
          },
          { status: 400 }
        );
      }

      const batch =
        adminDb.batch();

      items.forEach(
        (
          item: {
            mediaId?: unknown;
            order?: unknown;
          },
          index: number
        ) => {
          const mediaId =
            clean(item.mediaId, 120);

          if (!mediaId) {
            return;
          }

          const order =
            Number.isFinite(
              Number(item.order)
            )
              ? Number(item.order)
              : index + 1;

          const ref =
            playlistRef
              .collection("tracks")
              .doc(mediaId);

          batch.set(
            ref,
            {
              order,
              updatedAt:
                FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
        }
      );

      await batch.commit();

      return NextResponse.json({
        success: true,
        message:
          "Radio order updated.",
      });
    }

    return NextResponse.json(
      {
        success: false,
        error:
          'Unknown Radio action.',
      },
      { status: 400 }
    );
  } catch (error) {
    const response = authError(error);

    if (response) {
      return response;
    }

    if (
      error instanceof Error &&
      error.message ===
        "PLAYLIST_NOT_FOUND"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Radio playlist was not found.",
        },
        { status: 404 }
      );
    }

    console.error(
      "Owner Radio POST error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Radio programming could not be updated.",
      },
      { status: 500 }
    );
  }
}

