import { NextResponse } from "next/server";
import { albums as staticAlbums } from "../../../store/albums";
import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";

import {
  adminBucket,
  adminDb,
  firebaseAdminApp,
} from "../../../../lib/firebaseAdmin";

const OWNER_EMAIL = "supe4.me@gmail.com";

type ReleaseStatus = "released" | "upcoming";
type PublishStatus = "draft" | "published";
type AccessType = "standard" | "premium";

type TrackInput = {
  mediaId?: unknown;
  title?: unknown;
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

  const decoded = await getAuth(firebaseAdminApp).verifyIdToken(token);

  if (decoded.email?.toLowerCase() !== OWNER_EMAIL) {
    throw new Error("OWNER_ACCESS_ONLY");
  }

  return decoded;
}

function authError(error: unknown) {
  const message = error instanceof Error ? error.message : "";

  if (message === "OWNER_AUTH_REQUIRED") {
    return NextResponse.json(
      { success: false, error: "Owner sign-in is required." },
      { status: 401 }
    );
  }

  if (message === "OWNER_ACCESS_ONLY") {
    return NextResponse.json(
      { success: false, error: "Owner access only." },
      { status: 403 }
    );
  }

  return null;
}

function cleanText(value: unknown, maxLength = 250) {
  if (typeof value !== "string") return "";

  return value
    .replace(/\0/g, "")
    .trim()
    .slice(0, maxLength);
}

function slugify(value: string) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

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
    console.error("Album Manager media URL error:", error);
    return null;
  }
}

async function getMedia(mediaId: string) {
  const snapshot = await adminDb
    .collection("mediaLibrary")
    .doc(mediaId)
    .get();

  if (!snapshot.exists) {
    return null;
  }

  return {
    mediaId: snapshot.id,
    ...snapshot.data(),
  } as Record<string, unknown> & { mediaId: string };
}

function validReleaseStatus(value: unknown): ReleaseStatus {
  return value === "released" ? "released" : "upcoming";
}

function validPublishStatus(value: unknown): PublishStatus {
  return value === "published" ? "published" : "draft";
}

function validAccessType(value: unknown): AccessType {
  return value === "premium" ? "premium" : "standard";
}

export async function GET(request: Request) {
  try {
    await verifyOwner(request);

    const snapshot = await adminDb
      .collection("albums")
      .orderBy("updatedAt", "desc")
      .get();

    const albums = await Promise.all(
      snapshot.docs.map(async (document) => {
        const data = document.data();

        const staticAlbum = staticAlbums.find(
          (album) => album.id === document.id
        );

        const legacyCoverPath =
          typeof data.legacyCoverPath === "string" &&
          data.legacyCoverPath.trim()
            ? data.legacyCoverPath.trim()
            : staticAlbum?.cover || null;

        const coverPreviewUrl =
          (await signedReadUrl(data.coverStoragePath)) ||
          legacyCoverPath;

        const tracks = await Promise.all(
          (Array.isArray(data.tracks) ? data.tracks : []).map(
            async (track: Record<string, unknown>) => ({
              ...track,
              previewUrl: await signedReadUrl(track.storagePath),
            })
          )
        );

        return {
          albumId: document.id,
          title: data.title || "Untitled Album",
          artist: data.artist || "Solo Beats",
          year: data.year || new Date().getFullYear(),
          genre: data.genre || "Electronic",
          description: data.description || "",
          status: data.status || "upcoming",
          publishStatus: data.publishStatus || "draft",
          isFlagship: data.isFlagship === true,
          flagshipPreviewTrackIds:
            Array.isArray(data.flagshipPreviewTrackIds)
              ? data.flagshipPreviewTrackIds.filter(
                  (value: unknown) =>
                    typeof value === "string"
                )
              : [],
          accessType: data.accessType || "standard",
          coverMediaId: data.coverMediaId || null,
          coverStoragePath: data.coverStoragePath || null,
          coverPreviewUrl,
          albumPreviewMediaId: data.albumPreviewMediaId || null,
          albumPrice: Number(data.albumPrice || 0),
          trackPrice: Number(data.trackPrice || 1),
          pageLink: data.pageLink || `/albums/${document.id}`,
          trackCount: tracks.length,
          tracks,
          createdAt: toIso(data.createdAt),
          updatedAt: toIso(data.updatedAt),
        };
      })
    );

    return NextResponse.json({
      success: true,
      albums,
    });
  } catch (error) {
    const response = authError(error);
    if (response) return response;

    console.error("Owner Album Manager GET error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Albums could not be loaded.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const owner = await verifyOwner(request);
    const body = await request.json();

    const action = cleanText(body.action, 40);

    if (
      ![
        "create",
        "update",
        "publish",
        "unpublish",
        "delete",
        "set-flagship",
        "import-static",
        "migrate-neon-overdrive",
      ].includes(action)
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Use action "create", "update", "publish", "unpublish", "delete", "set-flagship", or "import-static".',
        },
        { status: 400 }
      );
    }

    if (action === "import-static") {
      const premiumAlbumIds = new Set([
        "reckoning",
        "full-speed",
        "night-terror",
        "reboot",
        "novafx",
      ]);

      let imported = 0;
      let skipped = 0;

      for (const album of staticAlbums) {
        const albumRef = adminDb
          .collection("albums")
          .doc(album.id);

        const existing = await albumRef.get();

        if (existing.exists) {
          skipped += 1;
          continue;
        }

        const legacyTracks = album.tracks.map((track) => ({
          id: track.id,
          number: track.number,
          title: track.title,
          mediaId: null,
          storagePath: null,
          legacyPreviewPath: track.preview,
          originalName: null,
          mimeType: "audio/mpeg",
          price: track.price,
        }));

        await albumRef.set({
          id: album.id,
          title: album.title,
          artist: album.artist,
          year: album.year,
          genre: album.genre,
          description: album.description,
          status: album.status,
          publishStatus: "published",
          isFlagship: false,
          flagshipPreviewTrackIds: [],
          accessType: premiumAlbumIds.has(album.id)
            ? "premium"
            : "standard",

          legacySource: true,
          legacyCoverPath: album.cover,
          legacyAlbumPreviewPath: album.albumPreview,

          coverMediaId: null,
          coverStoragePath: null,
          albumPreviewMediaId: null,
          albumPreviewStoragePath: null,

          trackPrice: album.trackPrice,
          albumPrice: album.albumPrice,
          pageLink: album.pageLink,
          tracks: legacyTracks,

          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          createdBy: owner.email || OWNER_EMAIL,
          updatedBy: owner.email || OWNER_EMAIL,
        });

        imported += 1;
      }

      return NextResponse.json({
        success: true,
        imported,
        skipped,
        total: staticAlbums.length,
        message:
          `Existing catalog imported. ${imported} added, ${skipped} already managed.`,
      });
    }

    if (action === "migrate-neon-overdrive") {
      const albumId = "neon-overdrive";

      const legacyTracks = [
        {
          title: "Pulse Invaders",
          fileName: "Pulse Invaders1.wav",
        },
        {
          title: "Pixel Riot",
          fileName: "Pixel Riot2.wav",
        },
        {
          title: "Rhythm Nexus",
          fileName: "Rhythm Nexus3.wav",
        },
        {
          title: "Voltage Arena",
          fileName: "Voltage Arena4.wav",
        },
        {
          title: "Level Up",
          fileName: "Level Up5.wav",
        },
        {
          title: "Dance Protocol",
          fileName: "Dance Protocol6.wav",
        },
        {
          title: "Nightshift Energy",
          fileName: "Nightshift Energy7.wav",
        },
        {
          title: "Neon Overdrive",
          fileName: "Neon Overdrive8.wav",
        },
        {
          title: "Bass Crusaders",
          fileName: "Bass Crusaders9.wav",
        },
        {
          title: "Cyber Groove",
          fileName: "Cyber Groove10.wav",
        },
      ];

      const albumRef = adminDb
        .collection("albums")
        .doc(albumId);

      const albumSnapshot = await albumRef.get();

      if (!albumSnapshot.exists) {
        return NextResponse.json(
          {
            success: false,
            error: "Neon Overdrive album was not found.",
          },
          { status: 404 }
        );
      }

      const currentAlbum = albumSnapshot.data() || {};
      const currentTracks = Array.isArray(currentAlbum.tracks)
        ? currentAlbum.tracks
        : [];

      const migratedTracks = [];

      for (
        let index = 0;
        index < legacyTracks.length;
        index += 1
      ) {
        const legacyTrack = legacyTracks[index];
        const number = index + 1;

        const mediaId =
          `legacy-neon-overdrive-${String(number).padStart(2, "0")}`;

        const storagePath =
          `tracks/neon-overdrive/${legacyTrack.fileName}`;

        const storageFile =
          adminBucket.file(storagePath);

        const [exists] =
          await storageFile.exists();

        if (!exists) {
          return NextResponse.json(
            {
              success: false,
              error:
                `Storage file was not found: ${storagePath}`,
            },
            { status: 404 }
          );
        }

        const [metadata] =
          await storageFile.getMetadata();

        const extension =
          legacyTrack.fileName
            .split(".")
            .pop()
            ?.toLowerCase() || "mp3";

        const mimeType =
          metadata.contentType ||
          (extension === "wav"
            ? "audio/wav"
            : "audio/mpeg");

        const mediaRef = adminDb
          .collection("mediaLibrary")
          .doc(mediaId);

        const mediaSnapshot =
          await mediaRef.get();

        await mediaRef.set(
          {
            title: legacyTrack.title,
            kind: "audio",
            mimeType,
            originalName:
              legacyTrack.fileName,
            extension,
            sizeBytes:
              Number(metadata.size) || 0,
            storagePath,
            status: "active",
            uploadedBy:
              owner.email || OWNER_EMAIL,
            ...(mediaSnapshot.exists
              ? {}
              : {
                  createdAt:
                    FieldValue.serverTimestamp(),
                }),
            updatedAt:
              FieldValue.serverTimestamp(),
            legacyMigration: true,
            legacyAlbumId: albumId,
          },
          { merge: true }
        );

        const existingTrack =
          currentTracks[index] &&
          typeof currentTracks[index] === "object"
            ? currentTracks[index]
            : {};

        migratedTracks.push({
          ...existingTrack,
          id:
            `${albumId}-${String(number).padStart(2, "0")}`,
          number,
          title: legacyTrack.title,
          mediaId,
          storagePath,
          originalName:
            legacyTrack.fileName,
          mimeType,
          price:
            Number(
              (existingTrack as Record<string, unknown>)
                .price
            ) || 1,
        });
      }

      const previewTrack =
        migratedTracks[7] ||
        migratedTracks[0];

      await albumRef.set(
        {
          tracks: migratedTracks,
          albumPreviewMediaId:
            previewTrack.mediaId,
          albumPreviewStoragePath:
            previewTrack.storagePath,
          updatedAt:
            FieldValue.serverTimestamp(),
          updatedBy:
            owner.email || OWNER_EMAIL,
          legacyMediaMigrated: true,
        },
        { merge: true }
      );

      return NextResponse.json({
        success: true,
        albumId,
        migrated:
          migratedTracks.length,
        albumPreviewMediaId:
          previewTrack.mediaId,
        message:
          "Neon Overdrive legacy audio linked to the Central Media Library.",
      });
    }
    if (action === "set-flagship") {
      const albumId = slugify(cleanText(body.albumId, 100));

      if (!albumId) {
        return NextResponse.json(
          {
            success: false,
            error: "Album ID is required.",
          },
          { status: 400 }
        );
      }

      const targetRef = adminDb.collection("albums").doc(albumId);
      const target = await targetRef.get();

      if (!target.exists) {
        return NextResponse.json(
          {
            success: false,
            error: "Album was not found.",
          },
          { status: 404 }
        );
      }

      

      const targetData = target.data() || {};

      const flagshipPreviewTrackIds =
        Array.isArray(
          targetData.flagshipPreviewTrackIds
        )
          ? targetData.flagshipPreviewTrackIds.filter(
              (value: unknown) =>
                typeof value === "string"
            )
          : [];

      if (flagshipPreviewTrackIds.length !== 3) {
        return NextResponse.json(
          {
            success: false,
            error:
              "A flagship album must have exactly 3 Early Access preview tracks.",
          },
          { status: 400 }
        );
      }

const albumsSnapshot = await adminDb
        .collection("albums")
        .get();

      const batch = adminDb.batch();

      for (const document of albumsSnapshot.docs) {
        batch.set(
          document.ref,
          {
            isFlagship: document.id === albumId,
            updatedAt: FieldValue.serverTimestamp(),
            updatedBy: owner.email || OWNER_EMAIL,
          },
          { merge: true }
        );
      }

      await batch.commit();

      return NextResponse.json({
        success: true,
        albumId,
        isFlagship: true,
        message: "Flagship album updated.",
      });
    }

    if (
      action === "publish" ||
      action === "unpublish" ||
      action === "delete"
    ) {
      const albumId = slugify(cleanText(body.albumId, 100));

      if (!albumId) {
        return NextResponse.json(
          { success: false, error: "Album ID is required." },
          { status: 400 }
        );
      }

      const albumRef = adminDb.collection("albums").doc(albumId);
      const existing = await albumRef.get();

      if (!existing.exists) {
        return NextResponse.json(
          { success: false, error: "Album was not found." },
          { status: 404 }
        );
      }

      if (action === "delete") {
        await albumRef.delete();

        return NextResponse.json({
          success: true,
          albumId,
          message: "Album deleted.",
        });
      }

      const publishStatus =
        action === "publish" ? "published" : "draft";

      await albumRef.set(
        {
          publishStatus,
          updatedAt: FieldValue.serverTimestamp(),
          updatedBy: owner.email || OWNER_EMAIL,
        },
        { merge: true }
      );

      return NextResponse.json({
        success: true,
        albumId,
        publishStatus,
      });
    }

    const title = cleanText(body.title, 160);
    const requestedId = cleanText(body.albumId || body.id, 100);
    const albumId = slugify(requestedId || title);

    const artist = cleanText(body.artist, 120) || "Solo Beats";
    const genre = cleanText(body.genre, 100) || "Electronic";
    const description = cleanText(body.description, 3000);

    const yearNumber = Number(body.year);
    const year =
      Number.isInteger(yearNumber) &&
      yearNumber >= 1900 &&
      yearNumber <= 2200
        ? yearNumber
        : new Date().getFullYear();

    const status = validReleaseStatus(body.status);
    const publishStatus = validPublishStatus(body.publishStatus);
    const accessType = validAccessType(body.accessType);

    const trackPriceInput = Number(body.trackPrice);
    const trackPrice =
      Number.isFinite(trackPriceInput) && trackPriceInput > 0
        ? Number(trackPriceInput.toFixed(2))
        : 1;

    const coverMediaId = cleanText(body.coverMediaId, 100);
    const albumPreviewMediaId = cleanText(
      body.albumPreviewMediaId,
      100
    );

    const trackInputs: TrackInput[] = Array.isArray(body.tracks)
      ? body.tracks
      : [];

    const flagshipPreviewTrackIdsInput =
      Array.isArray(body.flagshipPreviewTrackIds)
        ? body.flagshipPreviewTrackIds
        : [];

    const flagshipPreviewTrackIds = [
      ...new Set(
        flagshipPreviewTrackIdsInput
          .map((value: unknown) =>
            cleanText(value, 100)
          )
          .filter(Boolean)
      ),
    ];

    if (flagshipPreviewTrackIds.length > 3) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Choose no more than 3 Flagship Early Access preview tracks.",
        },
        { status: 400 }
      );
    }

    if (!title || !albumId) {
      return NextResponse.json(
        {
          success: false,
          error: "Album title and Album ID are required.",
        },
        { status: 400 }
      );
    }

    if (!coverMediaId) {
      return NextResponse.json(
        {
          success: false,
          error: "Choose an album cover from the Media Library.",
        },
        { status: 400 }
      );
    }

    if (trackInputs.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Add at least one audio track.",
        },
        { status: 400 }
      );
    }

    const coverMedia = await getMedia(coverMediaId);

    if (!coverMedia || coverMedia.kind !== "image") {
      return NextResponse.json(
        {
          success: false,
          error: "The selected album cover is not a valid image.",
        },
        { status: 400 }
      );
    }

    const tracks = [];

    for (let index = 0; index < trackInputs.length; index += 1) {
      const input = trackInputs[index];
      const mediaId = cleanText(input.mediaId, 100);

      if (!mediaId) {
        return NextResponse.json(
          {
            success: false,
            error: `Track ${index + 1} is missing a Media Library ID.`,
          },
          { status: 400 }
        );
      }

      const media = await getMedia(mediaId);

      if (!media || media.kind !== "audio") {
        return NextResponse.json(
          {
            success: false,
            error: `Track ${index + 1} is not a valid audio file.`,
          },
          { status: 400 }
        );
      }

      const number = index + 1;
      const titleOverride = cleanText(input.title, 180);
      const mediaTitle = cleanText(media.title, 180);
      const originalName = cleanText(media.originalName, 220);

      tracks.push({
        id: `${albumId}-${String(number).padStart(2, "0")}`,
        number,
        title:
          titleOverride ||
          mediaTitle ||
          originalName.replace(/\.[^.]+$/, "") ||
          `Track ${number}`,
        mediaId,
        storagePath: cleanText(media.storagePath, 500),
        originalName: originalName || null,
        mimeType: cleanText(media.mimeType, 120) || null,
        price: trackPrice,
      });
    }

    const albumTrackMediaIds = new Set(
      tracks.map((track) => track.mediaId)
    );

    if (
      flagshipPreviewTrackIds.some(
        (mediaId) =>
          !albumTrackMediaIds.has(String(mediaId))
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Every Flagship Early Access preview must belong to this album.",
        },
        { status: 400 }
      );
    }

    let previewMediaId = albumPreviewMediaId;

    if (!previewMediaId) {
      previewMediaId = tracks[0].mediaId;
    }

    const previewTrack = tracks.find(
      (track) => track.mediaId === previewMediaId
    );

    if (!previewTrack) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Album preview must be one of the album's selected tracks.",
        },
        { status: 400 }
      );
    }

    const albumPrice = Number(
      tracks
        .reduce((total, track) => total + track.price, 0)
        .toFixed(2)
    );

    const albumRef = adminDb.collection("albums").doc(albumId);
    const existing = await albumRef.get();

    if (action === "create" && existing.exists) {
      return NextResponse.json(
        {
          success: false,
          error: "An album with this ID already exists.",
        },
        { status: 409 }
      );
    }

    if (action === "update" && !existing.exists) {
      return NextResponse.json(
        {
          success: false,
          error: "Album was not found.",
        },
        { status: 404 }
      );
    }

    await albumRef.set(
      {
        id: albumId,
        title,
        artist,
        year,
        genre,
        description,
        status,
        publishStatus,
        accessType,
        coverMediaId,
        coverStoragePath: cleanText(
          coverMedia.storagePath,
          500
        ),
        albumPreviewMediaId: previewMediaId,
        albumPreviewStoragePath: previewTrack.storagePath,
        flagshipPreviewTrackIds,
        trackPrice,
        albumPrice,
        pageLink: `/albums/${albumId}`,
        tracks,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: owner.email || OWNER_EMAIL,
        ...(existing.exists
          ? {}
          : {
              createdAt: FieldValue.serverTimestamp(),
              createdBy: owner.email || OWNER_EMAIL,
            }),
      },
      { merge: true }
    );

    return NextResponse.json({
      success: true,
      albumId,
      albumPrice,
      trackCount: tracks.length,
      publishStatus,
      message:
        action === "create"
          ? "Album created."
          : "Album updated.",
    });
  } catch (error) {
    const response = authError(error);
    if (response) return response;

    console.error("Owner Album Manager POST error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Album operation could not be completed.",
      },
      { status: 500 }
    );
  }
}






