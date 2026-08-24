"use client";

import Link from "next/link";
import {
  ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useAuth } from "../../auth/AuthContext";

const OWNER_EMAIL = "supe4.me@gmail.com";

type ReleaseStatus = "released" | "upcoming";
type PublishStatus = "draft" | "published";
type AccessType = "standard" | "premium";
type MediaKind = "audio" | "video" | "image";

type MediaItem = {
  mediaId: string;
  title: string;
  kind: MediaKind;
  mimeType: string | null;
  originalName: string | null;
  extension: string | null;
  sizeBytes: number;
  storagePath: string | null;
  status: string;
  createdAt: string | null;
  updatedAt: string | null;
  previewUrl: string | null;
};

type AlbumTrack = {
  id?: string;
  number?: number;
  title: string;
  mediaId: string;
  storagePath?: string | null;
  originalName?: string | null;
  mimeType?: string | null;
  price?: number;
  previewUrl?: string | null;
};

type Album = {
  albumId: string;
  title: string;
  artist: string;
  year: number;
  genre: string;
  description: string;
  status: ReleaseStatus;
  publishStatus: PublishStatus;
  isFlagship: boolean;
  flagshipPreviewTrackIds: string[];
  accessType: AccessType;
  coverMediaId: string | null;
  coverStoragePath: string | null;
  coverPreviewUrl: string | null;
  albumPreviewMediaId: string | null;
  albumPrice: number;
  trackPrice: number;
  pageLink: string;
  trackCount: number;
  tracks: AlbumTrack[];
  createdAt: string | null;
  updatedAt: string | null;
};

type AlbumsResponse = {
  success: boolean;
  albums?: Album[];
  error?: string;
};

type MediaResponse = {
  success: boolean;
  media?: MediaItem[];
  error?: string;
};

type AlbumForm = {
  albumId: string;
  title: string;
  artist: string;
  year: string;
  genre: string;
  description: string;
  status: ReleaseStatus;
  publishStatus: PublishStatus;
  flagshipPreviewTrackIds: string[];
  accessType: AccessType;
  coverMediaId: string;
  albumPreviewMediaId: string;
  trackPrice: string;
  tracks: AlbumTrack[];
};

function emptyForm(): AlbumForm {
  return {
    albumId: "",
    title: "",
    artist: "Solo Beats",
    year: String(new Date().getFullYear()),
    genre: "Electronic",
    description: "",
    status: "upcoming",
    publishStatus: "draft",
    flagshipPreviewTrackIds: [],
    accessType: "standard",
    coverMediaId: "",
    albumPreviewMediaId: "",
    trackPrice: "1.00",
    tracks: [],
  };
}

function formFromAlbum(album: Album): AlbumForm {
  return {
    albumId: album.albumId,
    title: album.title,
    artist: album.artist,
    year: String(album.year),
    genre: album.genre,
    description: album.description,
    status: album.status,
    publishStatus: album.publishStatus,
    flagshipPreviewTrackIds:
      album.flagshipPreviewTrackIds || [],
    accessType: album.accessType,
    coverMediaId: album.coverMediaId || "",
    albumPreviewMediaId: album.albumPreviewMediaId || "",
    trackPrice: String(album.trackPrice || 1),
    tracks: (album.tracks || []).map((track) => ({
      ...track,
      mediaId: track.mediaId || "",
      title: track.title || "",
    })),
  };
}

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number.isFinite(value) ? value : 0);
}

function compactDate(value: string | null) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not available";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function fileName(item: MediaItem) {
  return item.originalName || item.title || item.mediaId;
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/45">
        {label}
      </p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
    </div>
  );
}

export default function AlbumManagerPage() {
  const { user, loading } = useAuth();

  const [albums, setAlbums] = useState<Album[]>([]);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [form, setForm] = useState<AlbumForm>(() => emptyForm());
  const [editingAlbumId, setEditingAlbumId] = useState<string | null>(null);

  const [loadingData, setLoadingData] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionBusy, setActionBusy] = useState("");
  const [uploadingTracks, setUploadingTracks] = useState(false);
  const [uploadTrackStatus, setUploadTrackStatus] = useState("");
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadCoverStatus, setUploadCoverStatus] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [albumSearch, setAlbumSearch] = useState("");
  const [albumFilter, setAlbumFilter] = useState<
    "all" | "published" | "released" | "upcoming" | "flagship" | "draft"
  >("all");
  const [mediaSearch, setMediaSearch] = useState("");
  const [deletingMediaId, setDeletingMediaId] = useState("");

  const managedAlbumsRef = useRef<HTMLElement | null>(null);

  const isOwner =
    !!user && user.email?.toLowerCase() === OWNER_EMAIL;

  const imageMedia = useMemo(
    () =>
      media.filter(
        (item) =>
          item.kind === "image" &&
          item.status !== "deleted"
      ),
    [media]
  );

  const audioMedia = useMemo(
    () =>
      media.filter(
        (item) =>
          item.kind === "audio" &&
          item.status !== "deleted"
      ),
    [media]
  );

  const selectedCover = useMemo(
    () =>
      imageMedia.find(
        (item) => item.mediaId === form.coverMediaId
      ) || null,
    [imageMedia, form.coverMediaId]
  );

  const filteredAlbums = useMemo(() => {
    const query = albumSearch.trim().toLowerCase();

    return albums.filter((album) => {
      const matchesSearch =
        !query ||
        [
          album.title,
          album.artist,
          album.genre,
          album.albumId,
          album.status,
          album.publishStatus,
          album.accessType,
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);

      const matchesFilter =
        albumFilter === "all"
          ? true
          : albumFilter === "published"
            ? album.publishStatus === "published"
            : albumFilter === "flagship"
              ? album.isFlagship === true
              : albumFilter === "draft"
                ? album.publishStatus === "draft"
                : album.status === albumFilter;

      return matchesSearch && matchesFilter;
    });
  }, [albums, albumSearch, albumFilter]);

  const filteredImages = useMemo(() => {
    const query = mediaSearch.trim().toLowerCase();
    if (!query) return imageMedia;

    return imageMedia.filter((item) =>
      [item.title, item.originalName, item.storagePath]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [imageMedia, mediaSearch]);

  const filteredAudio = useMemo(() => {
    const query = mediaSearch.trim().toLowerCase();
    if (!query) return audioMedia;

    return audioMedia.filter((item) =>
      [item.title, item.originalName, item.storagePath]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [audioMedia, mediaSearch]);

  const selectedTrackIds = useMemo(
    () => new Set(form.tracks.map((track) => track.mediaId)),
    [form.tracks]
  );

  const estimatedAlbumPrice = useMemo(() => {
    const price = Number(form.trackPrice);
    if (!Number.isFinite(price) || price <= 0) return 0;
    return Number((price * form.tracks.length).toFixed(2));
  }, [form.trackPrice, form.tracks.length]);

  const loadData = useCallback(async () => {
    const currentUser = user;

    if (
      !currentUser ||
      currentUser.email?.toLowerCase() !== OWNER_EMAIL
    ) {
      return;
    }

    setLoadingData(true);
    setError("");

    try {
      const token = await currentUser.getIdToken();

      const [albumsResponse, mediaResponse] = await Promise.all([
        fetch("/api/owner/albums", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        }),
        fetch("/api/owner/media", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        }),
      ]);

      const albumsData =
        (await albumsResponse.json()) as AlbumsResponse;
      const mediaData =
        (await mediaResponse.json()) as MediaResponse;

      if (!albumsResponse.ok || !albumsData.success) {
        throw new Error(
          albumsData.error || "Albums could not be loaded."
        );
      }

      if (!mediaResponse.ok || !mediaData.success) {
        throw new Error(
          mediaData.error ||
            "Central Media Library could not be loaded."
        );
      }

      setAlbums(albumsData.albums || []);
      setMedia(mediaData.media || []);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Album Manager could not be loaded."
      );
    } finally {
      setLoadingData(false);
    }
  }, [user]);

  useEffect(() => {
    if (!loading && isOwner) {
      void loadData();
    }
  }, [loading, isOwner, loadData]);

  function loadAlbumSection(
    filter:
      | "all"
      | "published"
      | "released"
      | "upcoming"
      | "flagship"
      | "draft"
  ) {
    setAlbumFilter(filter);
    setAlbumSearch("");

    window.setTimeout(() => {
      managedAlbumsRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 50);
  }

  function beginNewAlbum() {
    setEditingAlbumId(null);
    setForm(emptyForm());
    setNotice("");
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function editAlbum(album: Album) {
    setEditingAlbumId(album.albumId);
    setForm(formFromAlbum(album));
    setNotice("");
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }



  async function uploadCoverFile(file: File) {
    const currentUser = user;

    if (
      !currentUser ||
      currentUser.email?.toLowerCase() !== OWNER_EMAIL
    ) {
      throw new Error("Owner sign-in is required.");
    }

    const token = await currentUser.getIdToken();

    const fileInfo = {
      name: file.name,
      type: file.type || "application/octet-stream",
      size: file.size,
    };

    const title = file.name.replace(/\.[^.]+$/, "");

    const prepareResponse = await fetch("/api/owner/media", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        action: "prepare",
        file: fileInfo,
        title,
      }),
    });

    const prepareData = await prepareResponse.json();

    if (!prepareResponse.ok || !prepareData.success) {
      throw new Error(
        prepareData.error || `Could not prepare ${file.name}.`
      );
    }

    if (prepareData.kind !== "image") {
      throw new Error(`${file.name} is not a supported cover image.`);
    }

    const uploadResponse = await fetch(prepareData.uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type":
          file.type || "application/octet-stream",
      },
      body: file,
    });

    if (!uploadResponse.ok) {
      throw new Error(
        `Firebase upload failed for ${file.name} (${uploadResponse.status}).`
      );
    }

    const finalizeResponse = await fetch("/api/owner/media", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        action: "finalize",
        mediaId: prepareData.mediaId,
        storagePath: prepareData.storagePath,
        title,
        file: fileInfo,
      }),
    });

    const finalizeData = await finalizeResponse.json();

    if (!finalizeResponse.ok || !finalizeData.success) {
      throw new Error(
        finalizeData.error || `Could not finalize ${file.name}.`
      );
    }

    return {
      mediaId: prepareData.mediaId as string,
      title,
      kind: "image" as const,
      mimeType: file.type || "application/octet-stream",
      originalName: file.name,
      extension:
        file.name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] || null,
      sizeBytes: file.size,
      storagePath: prepareData.storagePath as string,
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      previewUrl: null,
    } satisfies MediaItem;
  }

  async function handleCoverUpload(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0] || null;

    if (!file) {
      return;
    }

    const lower = file.name.toLowerCase();
    const valid =
      lower.endsWith(".jpg") ||
      lower.endsWith(".jpeg") ||
      lower.endsWith(".png") ||
      lower.endsWith(".webp");

    if (!valid) {
      setError(
        `Unsupported cover: ${file.name}. Use JPG, JPEG, PNG, or WebP.`
      );
      event.target.value = "";
      return;
    }

    setUploadingCover(true);
    setError("");
    setNotice("");
    setUploadCoverStatus(`Uploading cover: ${file.name}`);

    try {
      const item = await uploadCoverFile(file);

      setMedia((current) => [item, ...current]);

      setForm((current) => ({
        ...current,
        coverMediaId: item.mediaId,
      }));

      setUploadCoverStatus("Cover upload complete.");
      setNotice(
        `${item.title} uploaded and selected as the album cover.`
      );

      await loadData();
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Cover upload failed."
      );
      setUploadCoverStatus("");
    } finally {
      setUploadingCover(false);
      event.target.value = "";
    }
  }

  async function uploadTrackFile(file: File) {
    const currentUser = user;

    if (
      !currentUser ||
      currentUser.email?.toLowerCase() !== OWNER_EMAIL
    ) {
      throw new Error("Owner sign-in is required.");
    }

    const token = await currentUser.getIdToken();

    const fileInfo = {
      name: file.name,
      type: file.type || "application/octet-stream",
      size: file.size,
    };

    const title = file.name.replace(/\.[^.]+$/, "");

    const prepareResponse = await fetch("/api/owner/media", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        action: "prepare",
        file: fileInfo,
        title,
      }),
    });

    const prepareData = await prepareResponse.json();

    if (!prepareResponse.ok || !prepareData.success) {
      throw new Error(
        prepareData.error || `Could not prepare ${file.name}.`
      );
    }

    if (prepareData.kind !== "audio") {
      throw new Error(`${file.name} is not a supported audio file.`);
    }

    const uploadResponse = await fetch(prepareData.uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type":
          file.type || "application/octet-stream",
      },
      body: file,
    });

    if (!uploadResponse.ok) {
      throw new Error(
        `Firebase upload failed for ${file.name} (${uploadResponse.status}).`
      );
    }

    const finalizeResponse = await fetch("/api/owner/media", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        action: "finalize",
        mediaId: prepareData.mediaId,
        storagePath: prepareData.storagePath,
        title,
        file: fileInfo,
      }),
    });

    const finalizeData = await finalizeResponse.json();

    if (!finalizeResponse.ok || !finalizeData.success) {
      throw new Error(
        finalizeData.error || `Could not finalize ${file.name}.`
      );
    }

    return {
      mediaId: prepareData.mediaId as string,
      title,
      kind: "audio" as const,
      mimeType: file.type || "application/octet-stream",
      originalName: file.name,
      extension:
        file.name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] || null,
      sizeBytes: file.size,
      storagePath: prepareData.storagePath as string,
      status: "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      previewUrl: null,
    } satisfies MediaItem;
  }

  async function handleTrackUpload(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const files = Array.from(event.target.files || []);

    if (files.length === 0) {
      return;
    }

    const invalid = files.find((file) => {
      const lower = file.name.toLowerCase();
      return !lower.endsWith(".mp3") && !lower.endsWith(".wav");
    });

    if (invalid) {
      setError(
        `Unsupported file: ${invalid.name}. Use MP3 or WAV tracks only.`
      );
      event.target.value = "";
      return;
    }

    setUploadingTracks(true);
    setError("");
    setNotice("");
    setUploadTrackStatus("");

    try {
      const uploaded: MediaItem[] = [];

      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];

        setUploadTrackStatus(
          `Uploading ${index + 1} of ${files.length}: ${file.name}`
        );

        const item = await uploadTrackFile(file);
        uploaded.push(item);
      }

      setMedia((current) => [...uploaded, ...current]);

      setForm((current) => {
        const existingIds = new Set(
          current.tracks.map((track) => track.mediaId)
        );

        const newTracks = uploaded
          .filter((item) => !existingIds.has(item.mediaId))
          .map((item) => ({
            mediaId: item.mediaId,
            title: item.title,
            storagePath: item.storagePath,
            originalName: item.originalName,
            mimeType: item.mimeType,
            previewUrl: item.previewUrl,
          }));

        const combined = [...current.tracks, ...newTracks];

        return {
          ...current,
          tracks: combined,
          albumPreviewMediaId:
            current.albumPreviewMediaId ||
            combined[0]?.mediaId ||
            "",
        };
      });

      setNotice(
        `${uploaded.length} track${
          uploaded.length === 1 ? "" : "s"
        } uploaded and added to this album.`
      );

      setUploadTrackStatus("Upload complete.");

      await loadData();
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Track upload failed."
      );
      setUploadTrackStatus("");
    } finally {
      setUploadingTracks(false);
      event.target.value = "";
    }
  }

  async function deleteMediaItem(item: MediaItem) {
    if (item.mediaId === form.coverMediaId) {
      setError(
        "This cover is currently selected. Select another cover first."
      );
      return;
    }

    const usedByAlbum = albums.find(
      (album) =>
        album.coverMediaId === item.mediaId
    );

    if (usedByAlbum) {
      setError(
        `This cover is currently used by "${usedByAlbum.title}". Change that album's cover first.`
      );
      return;
    }

    const confirmed = window.confirm(
      `Delete "${fileName(item)}" from the Media Library?`
    );

    if (!confirmed) {
      return;
    }

    setDeletingMediaId(item.mediaId);
    setError("");
    setNotice("");

    try {
      if (!user) {
        throw new Error(
          "Owner sign-in is required."
        );
      }

      const token =
        await user.getIdToken();

      const response = await fetch(
        "/api/owner/media",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
            Authorization:
              `Bearer ${token}`,
          },
          body: JSON.stringify({
            action: "delete",
            mediaId: item.mediaId,
          }),
        }
      );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.error ||
            "Media could not be deleted."
        );
      }

      setMedia((current) =>
        current.filter(
          (mediaItem) =>
            mediaItem.mediaId !==
            item.mediaId
        )
      );

      setNotice(
        `${fileName(item)} removed from the Media Library.`
      );
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Media could not be deleted."
      );
    } finally {
      setDeletingMediaId("");
    }
  }

  function chooseCover(item: MediaItem) {
    setForm((current) => ({
      ...current,
      coverMediaId: item.mediaId,
    }));
    setNotice(`Cover selected: ${item.title}`);
    setError("");
  }

  function addTrack(item: MediaItem) {
    if (selectedTrackIds.has(item.mediaId)) {
      setError("That audio file is already in this album.");
      return;
    }

    setForm((current) => {
      const nextTracks = [
        ...current.tracks,
        {
          mediaId: item.mediaId,
          title:
            item.title ||
            item.originalName?.replace(/\.[^.]+$/, "") ||
            `Track ${current.tracks.length + 1}`,
          storagePath: item.storagePath,
          originalName: item.originalName,
          mimeType: item.mimeType,
          previewUrl: item.previewUrl,
        },
      ];

      return {
        ...current,
        tracks: nextTracks,
        albumPreviewMediaId:
          current.albumPreviewMediaId || item.mediaId,
      };
    });

    setError("");
  }

  function toggleFlagshipPreviewTrack(mediaId: string) {
    if (!mediaId) {
      setError(
        "This track has no Media Library ID. Link the audio file before choosing it as an Early Access Preview."
      );
      return;
    }

    setForm((current) => {
      const alreadySelected =
        current.flagshipPreviewTrackIds.includes(mediaId);

      if (alreadySelected) {
        return {
          ...current,
          flagshipPreviewTrackIds:
            current.flagshipPreviewTrackIds.filter(
              (id) => id !== mediaId
            ),
        };
      }

      if (current.flagshipPreviewTrackIds.length >= 3) {
        window.setTimeout(() => {
          setError(
            "A flagship album can have exactly 3 Early Access preview tracks."
          );
        }, 0);

        return current;
      }

      window.setTimeout(() => {
        setError("");
      }, 0);

      return {
        ...current,
        flagshipPreviewTrackIds: [
          ...current.flagshipPreviewTrackIds,
          mediaId,
        ],
      };
    });
  }

  function removeTrack(index: number) {
    setForm((current) => {
      const removed = current.tracks[index];
      const nextTracks = current.tracks.filter(
        (_, trackIndex) => trackIndex !== index
      );

      const nextPreview =
        current.albumPreviewMediaId === removed.mediaId
          ? nextTracks[0]?.mediaId || ""
          : current.albumPreviewMediaId;

      return {
        ...current,
        tracks: nextTracks,
        albumPreviewMediaId: nextPreview,
            flagshipPreviewTrackIds:
        current.flagshipPreviewTrackIds.filter(
          (id) => id !== removed.mediaId
        ),
    };
    });
  }

  function moveTrack(index: number, direction: -1 | 1) {
    setForm((current) => {
      const target = index + direction;

      if (target < 0 || target >= current.tracks.length) {
        return current;
      }

      const nextTracks = [...current.tracks];
      [nextTracks[index], nextTracks[target]] = [
        nextTracks[target],
        nextTracks[index],
      ];

      return {
        ...current,
        tracks: nextTracks,
      };
    });
  }

  function updateTrackTitle(index: number, title: string) {
    setForm((current) => ({
      ...current,
      tracks: current.tracks.map((track, trackIndex) =>
        trackIndex === index ? { ...track, title } : track
      ),
    }));
  }

  async function postAlbumAction(
    body: Record<string, unknown>
  ) {
    const currentUser = user;

    if (
      !currentUser ||
      currentUser.email?.toLowerCase() !== OWNER_EMAIL
    ) {
      throw new Error("Owner sign-in is required.");
    }

    const token = await currentUser.getIdToken();

    const response = await fetch("/api/owner/albums", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(
        data.error || "Album operation failed."
      );
    }

    return data;
  }

  async function saveAlbum() {
    setError("");
    setNotice("");

    if (!form.title.trim()) {
      setError("Enter an album title.");
      return;
    }

    if (!form.coverMediaId) {
      setError("Choose an album cover from the Media Library.");
      return;
    }

    if (form.tracks.length === 0) {
      setError("Add at least one audio track.");
      return;
    }

    if (
      form.tracks.some(
        (track) => !track.mediaId || !track.title.trim()
      )
    ) {
      setError(
        "Every track needs a Media Library audio file and title."
      );
      return;
    }

    if (form.flagshipPreviewTrackIds.length > 3) {
      setError(
        "Choose no more than 3 Early Access preview tracks."
      );
      return;
    }

    setSaving(true);

    try {
      const action = editingAlbumId ? "update" : "create";

      const data = await postAlbumAction({
        action,
        albumId: editingAlbumId || form.albumId,
        title: form.title,
        artist: form.artist,
        year: Number(form.year),
        genre: form.genre,
        description: form.description,
        status: form.status,
        publishStatus: form.publishStatus,
        accessType: form.accessType,
        coverMediaId: form.coverMediaId,
        albumPreviewMediaId: form.albumPreviewMediaId,
        flagshipPreviewTrackIds:
          form.flagshipPreviewTrackIds,
        trackPrice: Number(form.trackPrice),
        tracks: form.tracks.map((track) => ({
          mediaId: track.mediaId,
          title: track.title,
        })),
      });

      const savedAlbumId =
        typeof data.albumId === "string"
          ? data.albumId
          : editingAlbumId;

      setNotice(
        `${data.message || "Album saved."} ${data.trackCount ?? form.tracks.length} ${(data.trackCount ?? form.tracks.length) === 1 ? "track" : "tracks"} - ${money(Number(data.albumPrice ?? estimatedAlbumPrice))}`
      );

      await loadData();

      if (savedAlbumId) {
        setEditingAlbumId(savedAlbumId);
      }
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Album could not be saved."
      );
    } finally {
      setSaving(false);
    }
  }

  async function migrateNeonOverdrive() {
    const confirmed = window.confirm(
      "Link the existing Neon Overdrive Storage tracks to the Central Media Library? No audio files will be uploaded or duplicated."
    );

    if (!confirmed) {
      return;
    }

    setActionBusy("migrate-neon-overdrive");
    setError("");
    setNotice("");

    try {
      const data = await postAlbumAction({
        action: "migrate-neon-overdrive",
      });

      setNotice(
        `${data.message || "Neon Overdrive migration complete."} ${data.migrated ?? 0} tracks linked.`
      );

      await loadData();
    } catch (migrationError) {
      setError(
        migrationError instanceof Error
          ? migrationError.message
          : "Neon Overdrive migration could not be completed."
      );
    } finally {
      setActionBusy("");
    }
  }
  async function importExistingCatalog() {
    setActionBusy("import-static");
    setError("");
    setNotice("");

    try {
      const data = await postAlbumAction({
        action: "import-static",
      });

      const imported =
        typeof data.imported === "number"
          ? data.imported
          : 0;

      const skipped =
        typeof data.skipped === "number"
          ? data.skipped
          : 0;

      setNotice(
        `Existing catalog imported. ${imported} added, ${skipped} already managed.`
      );

      await loadData();
    } catch (importError) {
      setError(
        importError instanceof Error
          ? importError.message
          : "Existing catalog could not be imported."
      );
    } finally {
      setActionBusy("");
    }
  }

  async function setFlagship(albumId: string) {
    const currentUser = user;

    if (!currentUser) {
      return;
    }

    setActionBusy(`flagship:${albumId}`);
    setError("");
    setNotice("");

    try {
      const token = await currentUser.getIdToken();

      const response = await fetch("/api/owner/albums", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: "set-flagship",
          albumId,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error || "Flagship album could not be changed."
        );
      }

      setNotice("Flagship album updated.");
      await loadData();

      window.setTimeout(() => {
        managedAlbumsRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 50);
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Flagship album could not be changed."
      );
    } finally {
      setActionBusy("");
    }
  }

  async function changePublishState(
    albumId: string,
    action: "publish" | "unpublish"
  ) {
    setActionBusy(`${action}:${albumId}`);
    setError("");
    setNotice("");

    try {
      await postAlbumAction({
        action,
        albumId,
      });

      setNotice(
        action === "publish"
          ? "Album published."
          : "Album moved back to draft."
      );

      await loadData();

      if (editingAlbumId === albumId) {
        setForm((current) => ({
          ...current,
          publishStatus:
            action === "publish" ? "published" : "draft",
        }));
      }
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Publish status could not be changed."
      );
    } finally {
      setActionBusy("");
    }
  }

  async function deleteAlbum(album: Album) {
    const confirmed = window.confirm(
      `Delete "${album.title}" from the Album Manager? This removes the album record, not the Media Library files.`
    );

    if (!confirmed) return;

    setActionBusy(`delete:${album.albumId}`);
    setError("");
    setNotice("");

    try {
      await postAlbumAction({
        action: "delete",
        albumId: album.albumId,
      });

      setNotice(`Deleted ${album.title}.`);

      if (editingAlbumId === album.albumId) {
        setEditingAlbumId(null);
        setForm(emptyForm());
      }

      await loadData();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Album could not be deleted."
      );
    } finally {
      setActionBusy("");
    }
  }

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#07080b] px-6 text-white">
        <p className="text-white/70">Loading Album Manager...</p>
      </main>
    );
  }

  if (!isOwner) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#07080b] px-5 pb-20 pt-40 text-white">
        <section className="w-full max-w-xl rounded-[2rem] border border-red-400/20 bg-red-400/10 p-8 text-center">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-red-200">
            Owner Access Only
          </p>
          <h1 className="mt-3 text-3xl font-black">
            Album Manager
          </h1>
          <p className="mt-4 text-white/65">
            Sign in with the owner account to manage albums and
            Central Media Library assets.
          </p>
          <Link
            href="/developer"
            className="mt-6 inline-flex rounded-xl border border-white/15 px-5 py-3 font-bold text-white hover:bg-white/10"
          >
            Back to Developer Dashboard
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#07080b] px-4 pb-24 pt-28 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1600px]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.25em] text-amber-300">
              SOLO BEATS ENGINE MUSIC
            </p>
            <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">
              Album Manager
            </h1>
            <p className="mt-3 max-w-3xl text-white/60">
              Create, edit, publish, and organize albums using
              covers and audio already stored in the Central
              Media Library.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={actionBusy === "import-static"}
              onClick={() => void importExistingCatalog()}
              className="rounded-xl border border-violet-300/25 bg-violet-300/10 px-4 py-3 text-sm font-black text-violet-100 hover:bg-violet-300/15 disabled:opacity-50"
            >
              {actionBusy === "import-static"
                ? "Importing..."
                : "Import Existing Catalog"}
            </button>

            <button
              type="button"
              disabled={actionBusy === "migrate-neon-overdrive"}
              onClick={() => void migrateNeonOverdrive()}
              className="rounded-xl border border-cyan-300/25 bg-cyan-300/10 px-4 py-3 text-sm font-black text-cyan-100 hover:bg-cyan-300/15 disabled:opacity-50"
            >
              {actionBusy === "migrate-neon-overdrive"
                ? "Migrating Neon Overdrive..."
                : "Migrate Neon Overdrive"}
            </button>
            <Link
              href="/developer"
              className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold hover:bg-white/[0.08]"
            >
              Dashboard
            </Link>
            <Link
              href="/developer/media"
              className="rounded-xl border border-violet-400/20 bg-violet-400/10 px-4 py-3 text-sm font-bold text-violet-100 hover:bg-violet-400/20"
            >
              Central Media Library
            </Link>
            <button
              type="button"
              onClick={() => void loadData()}
              disabled={loadingData}
              className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-bold disabled:opacity-50"
            >
              {loadingData ? "Refreshing..." : "Refresh"}
            </button>
            <button
              type="button"
              onClick={beginNewAlbum}
              className="rounded-xl bg-amber-300 px-4 py-3 text-sm font-black text-black hover:bg-amber-200"
            >
              + New Album
            </button>
          </div>
        </div>

        <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
          <button
            type="button"
            onClick={() => loadAlbumSection("all")}
            className="text-left"
          >
            <StatCard label="Albums" value={albums.length} />
          </button>

          <button
            type="button"
            onClick={() => loadAlbumSection("published")}
            className="text-left"
          >
            <StatCard
              label="Published"
              value={
                albums.filter(
                  (album) => album.publishStatus === "published"
                ).length
              }
            />
          </button>

          <button
            type="button"
            onClick={() => loadAlbumSection("upcoming")}
            className="text-left"
          >
            <StatCard
              label="Upcoming"
              value={
                albums.filter(
                  (album) => album.status === "upcoming"
                ).length
              }
            />
          </button>

          <button
            type="button"
            onClick={() => loadAlbumSection("flagship")}
            className="text-left"
          >
            <StatCard
              label="Flagship"
              value={
                albums.filter(
                  (album) => album.isFlagship === true
                ).length
              }
            />
          </button>

          <button
            type="button"
            onClick={() => loadAlbumSection("draft")}
            className="text-left"
          >
            <StatCard
              label="Drafts"
              value={
                albums.filter(
                  (album) => album.publishStatus === "draft"
                ).length
              }
            />
          </button>

          <StatCard label="Audio Files" value={audioMedia.length} />
          <StatCard label="Cover Images" value={imageMedia.length} />
        </div>

        {(error || notice) && (
          <div className="mt-6 space-y-3">
            {error && (
              <div className="rounded-2xl border border-red-400/25 bg-red-400/10 px-5 py-4 font-semibold text-red-100">
                {error}
              </div>
            )}
            {notice && (
              <div className="rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-5 py-4 font-semibold text-emerald-100">
                {notice}
              </div>
            )}
          </div>
        )}

        <div className="mt-8 grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
          <section className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-300">
                  {editingAlbumId ? "Editing Album" : "Create Album"}
                </p>
                <h2 className="mt-1 text-2xl font-black">
                  {editingAlbumId
                    ? form.title || editingAlbumId
                    : "New Album"}
                </h2>
              </div>
              {editingAlbumId && (
                <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs font-bold text-white/60">
                  ID: {editingAlbumId}
                </span>
              )}
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-bold text-white/70">
                  Album Title
                </span>
                <input
                  value={form.title}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  placeholder="Bullet Carnage"
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-amber-300/50"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-bold text-white/70">
                  Album ID / URL Slug
                </span>
                <input
                  value={form.albumId}
                  disabled={!!editingAlbumId}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      albumId: event.target.value,
                    }))
                  }
                  placeholder="Leave blank to generate from title"
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none disabled:cursor-not-allowed disabled:opacity-45 focus:border-amber-300/50"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-bold text-white/70">
                  Artist
                </span>
                <input
                  value={form.artist}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      artist: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-amber-300/50"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-bold text-white/70">
                  Genre
                </span>
                <input
                  value={form.genre}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      genre: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-amber-300/50"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-bold text-white/70">
                  Year
                </span>
                <input
                  type="number"
                  min={1900}
                  max={2200}
                  value={form.year}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      year: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-amber-300/50"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-bold text-white/70">
                  Track Price
                </span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.trackPrice}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      trackPrice: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-amber-300/50"
                />
                <span className="block text-xs text-white/40">
                  Album price is automatic: {money(estimatedAlbumPrice)}
                </span>
              </label>

              <label className="space-y-2">
                <span className="text-sm font-bold text-white/70">
                  Release Status
                </span>
                <select
                  value={form.status}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      status: event.target.value as ReleaseStatus,
                    }))
                  }
                  className="w-full rounded-xl border border-white/10 bg-[#111318] px-4 py-3 outline-none"
                >
                  <option value="upcoming">Upcoming</option>
                  <option value="released">Released</option>
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-sm font-bold text-white/70">
                  Access
                </span>
                <select
                  value={form.accessType}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      accessType: event.target.value as AccessType,
                    }))
                  }
                  className="w-full rounded-xl border border-white/10 bg-[#111318] px-4 py-3 outline-none"
                >
                  <option value="standard">Standard</option>
                  <option value="premium">Premium</option>
                </select>
              </label>
            </div>

            <label className="mt-4 block space-y-2">
              <span className="text-sm font-bold text-white/70">
                Description
              </span>
              <textarea
                rows={4}
                value={form.description}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                placeholder="Album description..."
                className="w-full resize-y rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-amber-300/50"
              />
            </label>

            <div className="mt-7">
              <div className="flex flex-col gap-4 rounded-2xl border border-fuchsia-300/20 bg-fuchsia-300/[0.05] p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-fuchsia-300">
                    Direct Cover Upload
                  </p>
                  <h3 className="mt-1 text-xl font-black">
                    Upload Album Cover
                  </h3>
                  <p className="mt-2 text-sm text-white/50">
                    Upload JPG, JPEG, PNG, or WebP directly from your computer.
                    The image will be saved to the Central Media Library and
                    selected as this album cover automatically.
                  </p>
                </div>

                <label
                  className={`inline-flex shrink-0 cursor-pointer items-center justify-center rounded-xl px-5 py-3 font-black ${
                    uploadingCover
                      ? "cursor-not-allowed bg-white/10 text-white/35"
                      : "bg-fuchsia-300 text-black hover:bg-fuchsia-200"
                  }`}
                >
                  {uploadingCover ? "Uploading..." : "+ Upload Cover"}
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                    disabled={uploadingCover}
                    onChange={(event) =>
                      void handleCoverUpload(event)
                    }
                    className="hidden"
                  />
                </label>
              </div>

              {uploadCoverStatus && (
                <div className="mt-3 rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm font-semibold text-fuchsia-100">
                  {uploadCoverStatus}
                </div>
              )}

              <div className="mt-5 flex items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-white/40">
                    Album Artwork
                  </p>
                  <h3 className="mt-1 text-xl font-black">
                    Selected Cover
                  </h3>
                </div>
                <span className="text-xs text-white/45">
                  {imageMedia.length} images available
                </span>
              </div>

              {selectedCover ? (
                <div className="mt-4 flex items-center gap-4 rounded-2xl border border-amber-300/25 bg-amber-300/[0.06] p-4">
                  {selectedCover.previewUrl ? (
                    <img
                      src={selectedCover.previewUrl}
                      alt={selectedCover.title}
                      className="h-24 w-24 rounded-xl object-cover"
                    />
                  ) : (
                    <div className="grid h-24 w-24 place-items-center rounded-xl bg-white/5 text-xs text-white/40">
                      No preview
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-black">{selectedCover.title}</p>
                    <p className="mt-1 truncate text-xs text-white/45">
                      {fileName(selectedCover)}
                    </p>
                    <p className="mt-2 text-xs font-bold text-amber-200">
                      Selected cover
                    </p>
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-dashed border-white/15 p-5 text-sm text-white/45">
                  No cover selected yet. Choose one from the
                  Central Media Library panel.
                </div>
              )}
            </div>

            <div className="mt-8 rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.05] p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
                    Direct Track Upload
                  </p>
                  <h3 className="mt-1 text-xl font-black">
                    Upload MP3 / WAV Tracks
                  </h3>
                  <p className="mt-2 max-w-2xl text-sm text-white/50">
                    Choose one or multiple tracks from your computer.
                    They will be uploaded to the Central Media Library
                    and added to this album automatically.
                  </p>
                </div>

                <label
                  className={`inline-flex cursor-pointer items-center justify-center rounded-xl px-5 py-3 font-black ${
                    uploadingTracks
                      ? "cursor-not-allowed bg-white/10 text-white/35"
                      : "bg-cyan-300 text-black hover:bg-cyan-200"
                  }`}
                >
                  {uploadingTracks
                    ? "Uploading..."
                    : "+ Upload Tracks"}
                  <input
                    type="file"
                    accept=".mp3,.wav,audio/mpeg,audio/wav,audio/x-wav"
                    multiple
                    disabled={uploadingTracks}
                    onChange={(event) =>
                      void handleTrackUpload(event)
                    }
                    className="hidden"
                  />
                </label>
              </div>

              {uploadTrackStatus && (
                <div className="mt-4 rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm font-semibold text-cyan-100">
                  {uploadTrackStatus}
                </div>
              )}
            </div>

            <div className="mt-8">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-white/40">
                    Track List
                  </p>
                  <h3 className="mt-1 text-xl font-black">
                    {form.tracks.length} {form.tracks.length === 1 ? "Track" : "Tracks"}
                  </h3>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/25 px-4 py-2 text-sm font-black text-amber-200">
                  Album {money(estimatedAlbumPrice)}
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {form.tracks.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-white/15 p-6 text-center text-sm text-white/45">
                    Add audio from the Central Media Library.
                  </div>
                )}

                {form.tracks.map((track, index) => {
                  const mediaItem = audioMedia.find(
                    (item) => item.mediaId === track.mediaId
                  );
                  const preview =
                    mediaItem?.previewUrl || track.previewUrl || null;

                  return (
                    <div
                      key={`${track.mediaId}-${index}`}
                      className="rounded-2xl border border-white/10 bg-black/25 p-4"
                    >
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10 text-sm font-black">
                          {index + 1}
                        </div>

                        <div className="min-w-[280px] flex-1 basis-full sm:basis-[420px]">
                          <input
                            value={track.title}
                            onChange={(event) =>
                              updateTrackTitle(
                                index,
                                event.target.value
                              )
                            }
                            className="w-full rounded-lg border border-white/10 bg-black/25 px-3 py-2 font-bold outline-none focus:border-amber-300/50"
                          />
                          <p className="mt-1 break-words text-xs text-white/40">
                            {mediaItem
                              ? fileName(mediaItem)
                              : track.mediaId || "Missing media ID"}
                          </p>
                        </div>

                        <label className="flex shrink-0 items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-bold">
                          <input
                            type="radio"
                            name="albumPreview"
                            checked={
                              Boolean(track.mediaId) &&
                              form.albumPreviewMediaId ===
                              track.mediaId
                            }
                            disabled={!track.mediaId}
                            onChange={() =>
                              setForm((current) => ({
                                ...current,
                                albumPreviewMediaId:
                                  track.mediaId,
                              }))
                            }
                          />
                          Album Preview
                        </label>

                        <label
                          className={`flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold ${
                            Boolean(track.mediaId) &&
                            form.flagshipPreviewTrackIds.includes(
                              track.mediaId
                            )
                              ? "border-yellow-300/40 bg-yellow-300/10 text-yellow-100"
                              : "border-white/10 text-white/70"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={
                              Boolean(track.mediaId) &&
                              form.flagshipPreviewTrackIds.includes(
                                track.mediaId
                              )
                            }
                            disabled={!track.mediaId}
                            onChange={() =>
                              toggleFlagshipPreviewTrack(
                                track.mediaId
                              )
                            }
                          />
                          Early Access Preview
                          <span className="text-white/40">
                            ({form.flagshipPreviewTrackIds.length}/3)
                          </span>
                        </label>

                        <div className="flex shrink-0 gap-1">
                          <button
                            type="button"
                            onClick={() => moveTrack(index, -1)}
                            disabled={index === 0}
                            className="rounded-lg border border-white/10 px-3 py-2 font-black disabled:opacity-30"
                            title="Move up"
                          >
                            Up
                          </button>
                          <button
                            type="button"
                            onClick={() => moveTrack(index, 1)}
                            disabled={
                              index === form.tracks.length - 1
                            }
                            className="rounded-lg border border-white/10 px-3 py-2 font-black disabled:opacity-30"
                            title="Move down"
                          >
                            Down
                          </button>
                          <button
                            type="button"
                            onClick={() => removeTrack(index)}
                            className="rounded-lg border border-red-400/20 bg-red-400/10 px-3 py-2 font-black text-red-200"
                            title="Remove track"
                          >
                            Remove
                          </button>
                        </div>
                      </div>

                      {preview && (
                        <audio
                          controls
                          preload="none"
                          src={preview}
                          className="mt-3 w-full"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-8 flex flex-wrap gap-3 border-t border-white/10 pt-6">
              <button
                type="button"
                onClick={() => void saveAlbum()}
                disabled={saving}
                className="rounded-xl bg-amber-300 px-6 py-3 font-black text-black hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving
                  ? "Saving..."
                  : editingAlbumId
                    ? "Save Album Changes"
                    : "Create Album"}
              </button>

              {editingAlbumId && (
                <>
                  {form.publishStatus === "published" ? (
                    <button
                      type="button"
                      disabled={
                        actionBusy ===
                        `unpublish:${editingAlbumId}`
                      }
                      onClick={() =>
                        void changePublishState(
                          editingAlbumId,
                          "unpublish"
                        )
                      }
                      className="rounded-xl border border-orange-300/25 bg-orange-300/10 px-5 py-3 font-bold text-orange-100 disabled:opacity-50"
                    >
                      Move to Draft
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={
                        actionBusy ===
                        `publish:${editingAlbumId}`
                      }
                      onClick={() =>
                        void changePublishState(
                          editingAlbumId,
                          "publish"
                        )
                      }
                      className="rounded-xl border border-emerald-300/25 bg-emerald-300/10 px-5 py-3 font-bold text-emerald-100 disabled:opacity-50"
                    >
                      Publish Album
                    </button>
                  )}
                </>
              )}
            </div>
          </section>

          <aside className="space-y-6">
            <section className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-5 sm:p-6">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-300">
                    Central Media Library
                  </p>
                  <h2 className="mt-1 text-2xl font-black">
                    Choose Media
                  </h2>
                </div>
                <Link
                  href="/developer/media"
                  className="text-sm font-bold text-violet-200 hover:text-white"
                >
                  Upload Media
                </Link>
              </div>

              <input
                value={mediaSearch}
                onChange={(event) =>
                  setMediaSearch(event.target.value)
                }
                placeholder="Search covers or audio..."
                className="mt-5 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none focus:border-violet-300/50"
              />

              <div className="mt-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-black">Cover Images</h3>
                  <span className="text-xs text-white/40">
                    {filteredImages.length}
                  </span>
                </div>

                <div className="mt-3 grid max-h-[420px] grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3">
                  {filteredImages.map((item) => {
                    const active =
                      item.mediaId ===
                      form.coverMediaId;

                    const usedByAlbum =
                      albums.some(
                        (album) =>
                          album.coverMediaId ===
                          item.mediaId
                      );

                    const deleteBlocked =
                      active || usedByAlbum;

                    return (
                      <div
                        key={item.mediaId}
                        className={`overflow-hidden rounded-xl border transition ${
                          active
                            ? "border-amber-300 bg-amber-300/10"
                            : "border-white/10 bg-black/25"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            chooseCover(item)
                          }
                          className="block w-full text-left"
                        >
                          {item.previewUrl ? (
                            <img
                              src={
                                item.previewUrl
                              }
                              alt={item.title}
                              className="aspect-square w-full object-cover"
                            />
                          ) : (
                            <div className="grid aspect-square place-items-center bg-white/5 text-xs text-white/35">
                              Image
                            </div>
                          )}

                          <div className="p-2">
                            <p className="truncate text-xs font-black">
                              {item.title}
                            </p>
                          </div>
                        </button>

                        <div className="border-t border-white/10 p-2">
                          <button
                            type="button"
                            disabled={
                              deleteBlocked ||
                              deletingMediaId ===
                                item.mediaId
                            }
                            onClick={() =>
                              void deleteMediaItem(
                                item
                              )
                            }
                            className="w-full rounded-lg border border-red-300/20 bg-red-300/10 px-3 py-2 text-xs font-black text-red-100 transition hover:bg-red-300/20 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/5 disabled:text-white/25"
                            title={
                              active
                                ? "Select another cover first."
                                : usedByAlbum
                                  ? "This cover is currently used by an album."
                                  : "Delete this cover"
                            }
                          >
                            {deletingMediaId ===
                            item.mediaId
                              ? "Deleting..."
                              : deleteBlocked
                                ? "In Use"
                                : "Delete"}
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  {filteredImages.length === 0 && (
                    <p className="col-span-full rounded-xl border border-dashed border-white/10 p-4 text-center text-xs text-white/40">
                      No matching cover images.
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-7 border-t border-white/10 pt-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-black">Audio Files</h3>
                  <span className="text-xs text-white/40">
                    {filteredAudio.length}
                  </span>
                </div>

                <div className="mt-3 max-h-[520px] space-y-2 overflow-y-auto pr-1">
                  {filteredAudio.map((item) => {
                    const selected = selectedTrackIds.has(
                      item.mediaId
                    );

                    return (
                      <div
                        key={item.mediaId}
                        className="rounded-xl border border-white/10 bg-black/25 p-3"
                      >
                        <div className="flex items-start gap-3">
                          <div className="min-w-[280px] flex-1 basis-full sm:basis-[420px]">
                            <p className="truncate text-sm font-black">
                              {item.title}
                            </p>
                            <p className="mt-1 break-words text-xs text-white/40">
                              {fileName(item)}
                            </p>
                          </div>

                          <button
                            type="button"
                            disabled={selected}
                            onClick={() => addTrack(item)}
                            className="shrink-0 rounded-lg border border-violet-300/25 bg-violet-300/10 px-3 py-2 text-xs font-black text-violet-100 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/5 disabled:text-white/30"
                          >
                            {selected ? "Added" : "+ Add"}
                          </button>
                        </div>

                        {item.previewUrl && (
                          <audio
                            controls
                            preload="none"
                            src={item.previewUrl}
                            className="mt-3 w-full"
                          />
                        )}
                      </div>
                    );
                  })}

                  {filteredAudio.length === 0 && (
                    <p className="rounded-xl border border-dashed border-white/10 p-4 text-center text-xs text-white/40">
                      No matching audio files.
                    </p>
                  )}
                </div>
              </div>
            </section>
          </aside>
        </div>

        <section ref={managedAlbumsRef} className="mt-8 rounded-[2rem] border border-white/10 bg-white/[0.035] p-5 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
                Existing Catalog
              </p>
              <h2 className="mt-1 text-2xl font-black">
                Managed Albums
              </h2>
            </div>

            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["all", "All"],
                  ["published", "Published"],
                  ["released", "Released"],
                  ["upcoming", "Upcoming"],
                  ["flagship", "Flagship"],
                  ["draft", "Drafts"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setAlbumFilter(value)}
                  className={`rounded-xl border px-4 py-2 text-xs font-black transition ${
                    albumFilter === value
                      ? "border-violet-300/40 bg-violet-400/20 text-violet-100"
                      : "border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <input
              value={albumSearch}
              onChange={(event) =>
                setAlbumSearch(event.target.value)
              }
              placeholder="Search albums..."
              className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 outline-none lg:max-w-sm"
            />
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredAlbums.map((album) => (
              <article
                key={album.albumId}
                className="overflow-hidden rounded-2xl border border-white/10 bg-black/25"
              >
                <div className="flex gap-4 p-4">
                  {album.coverPreviewUrl ? (
                    <img
                      src={album.coverPreviewUrl}
                      alt={album.title}
                      className="h-28 w-28 shrink-0 rounded-xl object-cover"
                    />
                  ) : (
                    <div className="grid h-28 w-28 shrink-0 place-items-center rounded-xl bg-white/5 text-xs text-white/35">
                      No cover
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap gap-1.5">
                      <span
                        className={`rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-wide ${
                          album.publishStatus === "published"
                            ? "bg-emerald-400/15 text-emerald-200"
                            : "bg-orange-400/15 text-orange-200"
                        }`}
                      >
                        {album.publishStatus}
                      </span>
                      <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-white/60">
                        {album.status}
                      </span>
                      {album.isFlagship && (
                        <span className="rounded-full bg-yellow-400/15 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-yellow-200">
                          Flagship
                        </span>
                      )}

                      {album.accessType === "premium" && (
                        <span className="rounded-full bg-violet-400/15 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-violet-200">
                          Premium
                        </span>
                      )}
                    </div>

                    <h3 className="mt-2 truncate text-lg font-black">
                      {album.title}
                    </h3>
                    <p className="truncate text-sm text-white/50">
                      {album.artist} - {album.genre}
                    </p>
                    <p className="mt-2 text-sm font-bold text-amber-200">
                      {album.trackCount} {album.trackCount === 1 ? "track" : "tracks"} -{" "}
                      {money(album.albumPrice)}
                    </p>
                  </div>
                </div>

                <div className="border-t border-white/10 px-4 py-3 text-xs text-white/40">
                  Updated {compactDate(album.updatedAt)}
                </div>

                <div className="flex flex-wrap gap-2 border-t border-white/10 p-4">
                  <button
                    type="button"
                    onClick={() => editAlbum(album)}
                    className="rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-black hover:bg-white/10"
                  >
                    Edit
                  </button>

                  {album.publishStatus === "published" ? (
                    <button
                      type="button"
                      disabled={
                        actionBusy ===
                        `unpublish:${album.albumId}`
                      }
                      onClick={() =>
                        void changePublishState(
                          album.albumId,
                          "unpublish"
                        )
                      }
                      className="rounded-lg border border-orange-300/20 bg-orange-300/10 px-3 py-2 text-xs font-black text-orange-100 disabled:opacity-50"
                    >
                      Draft
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={
                        actionBusy ===
                        `publish:${album.albumId}`
                      }
                      onClick={() =>
                        void changePublishState(
                          album.albumId,
                          "publish"
                        )
                      }
                      className="rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-xs font-black text-emerald-100 disabled:opacity-50"
                    >
                      Publish
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={
                      actionBusy === `delete:${album.albumId}`
                    }
                    onClick={() => void deleteAlbum(album)}
                    className="rounded-lg border border-red-300/20 bg-red-300/10 px-3 py-2 text-xs font-black text-red-100 disabled:opacity-50"
                  >
                    Delete
                  </button>
              {!album.isFlagship ? (
                <button
                  type="button"
                  disabled={
                    actionBusy === `flagship:${album.albumId}`
                  }
                  onClick={() =>
                    void setFlagship(album.albumId)
                  }
                  className="rounded-lg border border-yellow-300/20 bg-yellow-300/10 px-3 py-2 text-xs font-black text-yellow-100 disabled:opacity-50"
                >
                  {actionBusy === `flagship:${album.albumId}`
                    ? "Setting..."
                    : "Set as Flagship"}
                </button>
              ) : (
                <span className="rounded-lg border border-yellow-300/25 bg-yellow-300/10 px-3 py-2 text-xs font-black text-yellow-100">
                  Current Flagship
                </span>
              )}

                  <Link
                    href={album.pageLink || `/albums/${album.albumId}`}
                    className="rounded-lg border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs font-black text-cyan-100"
                  >
                    View Page
                  </Link>
                </div>
              </article>
            ))}

            {!loadingData && filteredAlbums.length === 0 && (
              <div className="col-span-full rounded-2xl border border-dashed border-white/15 p-8 text-center text-white/45">
                No managed albums found yet. Create your first
                dashboard-managed album above.
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
















