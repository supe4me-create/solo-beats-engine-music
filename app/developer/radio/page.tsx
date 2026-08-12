"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useAuth } from "../../auth/AuthContext";

const OWNER_EMAIL = "supe4.me@gmail.com";

type RadioDetails = {
  enabled: boolean;
  order: number;
  title: string;
  artist: string;
  albumTitle: string;
  cover: string;
  createdAt: string | null;
  updatedAt: string | null;
};

type AudioMediaItem = {
  mediaId: string;
  title: string;
  originalName: string | null;
  storagePath: string | null;
  previewUrl: string | null;
  createdAt: string | null;
  assignedToRadio: boolean;
  radio: RadioDetails | null;
};

type PlaylistTrack = {
  mediaId: string;
  enabled: boolean;
  order: number;
  title: string;
  artist: string;
  albumTitle: string;
  cover: string;
  storagePath: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

type RadioPlaylist = {
  playlistId: string;
  name: string;
  description: string;
  enabled: boolean;
  scheduleEnabled: boolean;
  scheduleStartAt: string | null;
  scheduleEndAt: string | null;
  priority: number;
  createdAt: string | null;
  updatedAt: string | null;
  trackCount: number;
  enabledTrackCount: number;
  tracks: PlaylistTrack[];
};

type RadioResponse = {
  success: boolean;
  audioMedia?: AudioMediaItem[];
  playlists?: RadioPlaylist[];
  selectedPlaylistId?: string;
  manualPlaylistId?: string;
  error?: string;
};

type EditState = {
  title: string;
  artist: string;
  albumTitle: string;
  cover: string;
};

type PlaylistFormState = {
  name: string;
  description: string;
  enabled: boolean;
  scheduleEnabled: boolean;
  scheduleStartAt: string;
  scheduleEndAt: string;
  priority: string;
};

function formatDate(value: string | null) {
  if (!value) return "Not set";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function toLocalInput(value: string | null) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const offset =
    date.getTimezoneOffset() * 60_000;

  return new Date(
    date.getTime() - offset
  )
    .toISOString()
    .slice(0, 16);
}

function localInputToIso(value: string) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString();
}

export default function RadioManagerPage() {
  const { user, loading } = useAuth();

  const [items, setItems] =
    useState<AudioMediaItem[]>([]);

  const [playlists, setPlaylists] =
    useState<RadioPlaylist[]>([]);

  const [
    selectedPlaylistId,
    setSelectedPlaylistId,
  ] = useState("");

  const [
    manualPlaylistId,
    setManualPlaylistId,
  ] = useState("");

  const [loadingItems, setLoadingItems] =
    useState(false);

  const [error, setError] =
    useState("");

  const [notice, setNotice] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [filter, setFilter] =
    useState<
      "all" | "radio" | "available"
    >("all");

  const [savingId, setSavingId] =
    useState<string | null>(null);

  const [savingPlaylist, setSavingPlaylist] =
    useState(false);

  const [editId, setEditId] =
    useState<string | null>(null);

  const [editState, setEditState] =
    useState<EditState>({
      title: "",
      artist: "",
      albumTitle: "",
      cover: "",
    });

  const [newPlaylistName, setNewPlaylistName] =
    useState("");

  const [
    playlistForm,
    setPlaylistForm,
  ] = useState<PlaylistFormState>({
    name: "",
    description: "",
    enabled: true,
    scheduleEnabled: false,
    scheduleStartAt: "",
    scheduleEndAt: "",
    priority: "0",
  });

  const isOwner =
    !!user &&
    user.email?.toLowerCase() === OWNER_EMAIL;

  const loadRadio = useCallback(
    async (
      currentUser = user,
      preferredPlaylistId = ""
    ) => {
      if (
        !currentUser ||
        currentUser.email?.toLowerCase() !==
          OWNER_EMAIL
      ) {
        return;
      }

      setLoadingItems(true);
      setError("");

      try {
        const token =
          await currentUser.getIdToken();

        const query =
          preferredPlaylistId
            ? `?playlistId=${encodeURIComponent(
                preferredPlaylistId
              )}`
            : "";

        const response = await fetch(
          `/api/owner/radio${query}`,
          {
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
            cache: "no-store",
          }
        );

        const data =
          (await response.json()) as RadioResponse;

        if (
          !response.ok ||
          !data.success
        ) {
          throw new Error(
            data.error ||
              "Radio programming could not be loaded."
          );
        }

        setItems(
          data.audioMedia || []
        );

        setPlaylists(
          data.playlists || []
        );

        const nextSelected =
          data.selectedPlaylistId ||
          data.playlists?.[0]
            ?.playlistId ||
          "";

        setSelectedPlaylistId(
          nextSelected
        );

        setManualPlaylistId(
          data.manualPlaylistId || ""
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Radio programming could not be loaded."
        );
      } finally {
        setLoadingItems(false);
      }
    },
    [user]
  );

  useEffect(() => {
    if (
      !loading &&
      isOwner &&
      user
    ) {
      void loadRadio(user, "");
    }
  }, [
    loading,
    isOwner,
    user,
    loadRadio,
  ]);

  const selectedPlaylist =
    useMemo(
      () =>
        playlists.find(
          (playlist) =>
            playlist.playlistId ===
            selectedPlaylistId
        ) || null,
      [
        playlists,
        selectedPlaylistId,
      ]
    );

  useEffect(() => {
    if (!selectedPlaylist) {
      return;
    }

    setPlaylistForm({
      name: selectedPlaylist.name,
      description:
        selectedPlaylist.description,
      enabled:
        selectedPlaylist.enabled,
      scheduleEnabled:
        selectedPlaylist.scheduleEnabled,
      scheduleStartAt:
        toLocalInput(
          selectedPlaylist.scheduleStartAt
        ),
      scheduleEndAt:
        toLocalInput(
          selectedPlaylist.scheduleEndAt
        ),
      priority:
        String(
          selectedPlaylist.priority || 0
        ),
    });
  }, [selectedPlaylist]);

  const radioItems = useMemo(
    () =>
      items
        .filter(
          (item) =>
            item.assignedToRadio &&
            item.radio
        )
        .sort(
          (a, b) =>
            (a.radio?.order || 0) -
            (b.radio?.order || 0)
        ),
    [items]
  );

  const stats = useMemo(
    () => ({
      audio: items.length,
      playlists: playlists.length,
      radio: radioItems.length,
      enabled: radioItems.filter(
        (item) =>
          item.radio?.enabled !== false
      ).length,
    }),
    [
      items,
      playlists,
      radioItems,
    ]
  );

  const filteredItems =
    useMemo(() => {
      const query =
        search.trim().toLowerCase();

      return items.filter((item) => {
        const filterMatch =
          filter === "all" ||
          (filter === "radio" &&
            item.assignedToRadio) ||
          (filter === "available" &&
            !item.assignedToRadio);

        if (!filterMatch) {
          return false;
        }

        if (!query) {
          return true;
        }

        const haystack = [
          item.title,
          item.originalName || "",
          item.radio?.title || "",
          item.radio?.artist || "",
          item.radio?.albumTitle || "",
        ]
          .join(" ")
          .toLowerCase();

        return haystack.includes(query);
      });
    }, [items, search, filter]);

  async function radioAction(
    body: Record<string, unknown>,
    successMessage: string,
    preferredPlaylistId =
      selectedPlaylistId
  ) {
    if (!user || !isOwner) {
      return false;
    }

    setError("");
    setNotice("");

    try {
      const token =
        await user.getIdToken();

      const response = await fetch(
        "/api/owner/radio",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
            Authorization:
              `Bearer ${token}`,
          },
          body: JSON.stringify(body),
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
            "Radio update failed."
        );
      }

      setNotice(
        data.message ||
          successMessage
      );

      const nextPreferred =
        typeof data.playlistId ===
          "string"
          ? data.playlistId
          : preferredPlaylistId;

      await loadRadio(
        user,
        nextPreferred
      );

      return true;
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Radio update failed."
      );

      return false;
    }
  }

  async function choosePlaylist(
    playlistId: string
  ) {
    setSelectedPlaylistId(
      playlistId
    );

    if (user) {
      await loadRadio(
        user,
        playlistId
      );
    }

    setEditId(null);
  }

  async function createPlaylist() {
    const name =
      newPlaylistName.trim();

    if (!name) {
      setError(
        "Enter a playlist name."
      );
      return;
    }

    setSavingPlaylist(true);

    try {
      const success =
        await radioAction(
          {
            action:
              "createPlaylist",
            name,
          },
          "Radio playlist created.",
          ""
        );

      if (success) {
        setNewPlaylistName("");
      }
    } finally {
      setSavingPlaylist(false);
    }
  }

  async function savePlaylist() {
    if (!selectedPlaylist) {
      return;
    }

    if (!playlistForm.name.trim()) {
      setError(
        "Playlist name cannot be empty."
      );
      return;
    }

    if (
      playlistForm.scheduleEnabled &&
      (
        !playlistForm.scheduleStartAt ||
        !playlistForm.scheduleEndAt
      )
    ) {
      setError(
        "Set both schedule start and end times."
      );
      return;
    }

    setSavingPlaylist(true);

    try {
      await radioAction(
        {
          action:
            "updatePlaylist",
          playlistId:
            selectedPlaylist.playlistId,
          name:
            playlistForm.name.trim(),
          description:
            playlistForm.description.trim(),
          enabled:
            playlistForm.enabled,
          scheduleEnabled:
            playlistForm.scheduleEnabled,
          scheduleStartAt:
            playlistForm.scheduleStartAt
              ? localInputToIso(
                  playlistForm.scheduleStartAt
                )
              : "",
          scheduleEndAt:
            playlistForm.scheduleEndAt
              ? localInputToIso(
                  playlistForm.scheduleEndAt
                )
              : "",
          priority:
            Number(
              playlistForm.priority
            ) || 0,
        },
        "Playlist settings saved."
      );
    } finally {
      setSavingPlaylist(false);
    }
  }

  async function makeActive() {
    if (!selectedPlaylist) {
      return;
    }

    setSavingPlaylist(true);

    try {
      await radioAction(
        {
          action:
            "setActivePlaylist",
          playlistId:
            selectedPlaylist.playlistId,
        },
        "Playlist is now live manually."
      );
    } finally {
      setSavingPlaylist(false);
    }
  }

  async function deletePlaylist() {
    if (!selectedPlaylist) {
      return;
    }

    const confirmed =
      window.confirm(
        `Delete playlist "${selectedPlaylist.name}"?\n\nIts tracks will only be removed from this Radio playlist. The original Media Library files will stay safe.`
      );

    if (!confirmed) {
      return;
    }

    setSavingPlaylist(true);

    try {
      const success =
        await radioAction(
          {
            action:
              "deletePlaylist",
            playlistId:
              selectedPlaylist.playlistId,
          },
          "Radio playlist deleted.",
          ""
        );

      if (!success) {
        return;
      }
    } finally {
      setSavingPlaylist(false);
    }
  }

  async function addToRadio(
    item: AudioMediaItem
  ) {
    if (!selectedPlaylistId) {
      setError(
        "Choose a playlist first."
      );
      return;
    }

    setSavingId(item.mediaId);

    try {
      await radioAction(
        {
          action: "add",
          playlistId:
            selectedPlaylistId,
          mediaId: item.mediaId,
          title: item.title,
          artist: "Solo Beats",
          albumTitle:
            selectedPlaylist?.name ||
            "SOLO BEATS RADIO",
          cover: "",
        },
        "Track added to playlist."
      );
    } finally {
      setSavingId(null);
    }
  }

  async function removeFromRadio(
    item: AudioMediaItem
  ) {
    const confirmed =
      window.confirm(
        `Remove "${item.radio?.title || item.title}" from "${selectedPlaylist?.name || "this playlist"}"?\n\nThe original MP3/WAV will stay in the Media Library.`
      );

    if (!confirmed) {
      return;
    }

    setSavingId(item.mediaId);

    try {
      if (
        await radioAction(
          {
            action: "remove",
            playlistId:
              selectedPlaylistId,
            mediaId: item.mediaId,
          },
          "Track removed from playlist."
        )
      ) {
        if (
          editId === item.mediaId
        ) {
          setEditId(null);
        }
      }
    } finally {
      setSavingId(null);
    }
  }

  async function setEnabled(
    item: AudioMediaItem,
    enabled: boolean
  ) {
    setSavingId(item.mediaId);

    try {
      await radioAction(
        {
          action: "update",
          playlistId:
            selectedPlaylistId,
          mediaId: item.mediaId,
          enabled,
        },
        enabled
          ? "Track enabled."
          : "Track disabled."
      );
    } finally {
      setSavingId(null);
    }
  }

  function beginEdit(
    item: AudioMediaItem
  ) {
    setEditId(item.mediaId);

    setEditState({
      title:
        item.radio?.title ||
        item.title,
      artist:
        item.radio?.artist ||
        "Solo Beats",
      albumTitle:
        item.radio?.albumTitle ||
        selectedPlaylist?.name ||
        "SOLO BEATS RADIO",
      cover:
        item.radio?.cover || "",
    });

    setError("");
    setNotice("");
  }

  async function saveEdit(
    item: AudioMediaItem
  ) {
    setSavingId(item.mediaId);

    try {
      const success =
        await radioAction(
          {
            action: "update",
            playlistId:
              selectedPlaylistId,
            mediaId: item.mediaId,
            title:
              editState.title.trim(),
            artist:
              editState.artist.trim(),
            albumTitle:
              editState.albumTitle.trim(),
            cover:
              editState.cover.trim(),
          },
          "Radio metadata saved."
        );

      if (success) {
        setEditId(null);
      }
    } finally {
      setSavingId(null);
    }
  }

  async function moveTrack(
    mediaId: string,
    direction: "up" | "down"
  ) {
    const ordered =
      [...radioItems];

    const index =
      ordered.findIndex(
        (item) =>
          item.mediaId === mediaId
      );

    if (index < 0) {
      return;
    }

    const targetIndex =
      direction === "up"
        ? index - 1
        : index + 1;

    if (
      targetIndex < 0 ||
      targetIndex >= ordered.length
    ) {
      return;
    }

    const temp =
      ordered[index];

    ordered[index] =
      ordered[targetIndex];

    ordered[targetIndex] =
      temp;

    setSavingId(mediaId);

    try {
      await radioAction(
        {
          action: "reorder",
          playlistId:
            selectedPlaylistId,
          items: ordered.map(
            (item, itemIndex) => ({
              mediaId:
                item.mediaId,
              order:
                itemIndex + 1,
            })
          ),
        },
        "Radio order updated."
      );
    } finally {
      setSavingId(null);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen px-5 pb-24 pt-40 text-white sm:px-8">
        <div className="mx-auto max-w-7xl">
          <p className="text-white/60">
            Loading Radio Manager...
          </p>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen px-5 pb-24 pt-40 text-white sm:px-8">
        <div className="mx-auto max-w-3xl rounded-[2rem] border border-white/10 bg-white/[0.04] p-8">
          <h1 className="text-3xl font-black">
            Owner sign-in required
          </h1>

          <p className="mt-3 text-white/60">
            Sign in with the owner account to manage Premium Radio programming.
          </p>

          <Link
            href="/account"
            className="mt-6 inline-flex rounded-xl bg-white px-5 py-3 font-black text-black"
          >
            Open Account
          </Link>
        </div>
      </main>
    );
  }

  if (!isOwner) {
    return (
      <main className="min-h-screen px-5 pb-24 pt-40 text-white sm:px-8">
        <div className="mx-auto max-w-3xl rounded-[2rem] border border-red-300/20 bg-red-400/10 p-8">
          <h1 className="text-3xl font-black">
            Owner access only
          </h1>

          <p className="mt-3 text-red-100/70">
            This Radio Manager is restricted to the SOLO BEATS ENGINE MUSIC owner account.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-5 pb-28 pt-36 text-white sm:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-fuchsia-300">
              Owner Control Center
            </p>

            <h1 className="mt-3 text-4xl font-black sm:text-5xl">
              Premium Radio Manager
            </h1>

            <p className="mt-4 max-w-3xl text-white/60">
              Build multiple Radio playlists, switch the live playlist, schedule programming, and reuse MP3/WAV files from Central Media Library.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/developer"
              className="rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-black"
            >
              Control Center
            </Link>

            <Link
              href="/developer/media"
              className="rounded-xl border border-violet-300/20 bg-violet-400/10 px-4 py-3 text-sm font-black text-violet-200"
            >
              Media Library
            </Link>

            <Link
              href="/premium/radio"
              className="rounded-xl bg-fuchsia-300 px-4 py-3 text-sm font-black text-black"
            >
              Open Live Radio
            </Link>
          </div>
        </div>

        <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Audio Library"
            value={stats.audio}
          />
          <StatCard
            label="Playlists"
            value={stats.playlists}
          />
          <StatCard
            label="Selected Tracks"
            value={stats.radio}
          />
          <StatCard
            label="Enabled Tracks"
            value={stats.enabled}
          />
        </section>

        {error ? (
          <div className="mt-6 rounded-2xl border border-red-300/20 bg-red-400/10 px-5 py-4 text-sm font-bold text-red-100">
            {error}
          </div>
        ) : null}

        {notice ? (
          <div className="mt-6 rounded-2xl border border-emerald-300/20 bg-emerald-400/10 px-5 py-4 text-sm font-bold text-emerald-100">
            {notice}
          </div>
        ) : null}

        <section className="mt-8 rounded-[2rem] border border-fuchsia-300/15 bg-fuchsia-400/[0.05] p-5 sm:p-7">
          <div className="grid gap-5 xl:grid-cols-[1fr_1.4fr]">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-fuchsia-300">
                Playlists
              </p>

              <h2 className="mt-2 text-2xl font-black">
                Radio Programming
              </h2>

              <div className="mt-5 flex gap-2">
                <input
                  type="text"
                  value={newPlaylistName}
                  onChange={(event) =>
                    setNewPlaylistName(
                      event.target.value
                    )
                  }
                  onKeyDown={(event) => {
                    if (
                      event.key ===
                      "Enter"
                    ) {
                      event.preventDefault();
                      void createPlaylist();
                    }
                  }}
                  placeholder="New playlist name"
                  className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none placeholder:text-white/25 focus:border-fuchsia-300/40"
                />

                <button
                  type="button"
                  onClick={() =>
                    void createPlaylist()
                  }
                  disabled={
                    savingPlaylist ||
                    !newPlaylistName.trim()
                  }
                  className="rounded-xl bg-fuchsia-300 px-4 py-3 text-sm font-black text-black disabled:opacity-40"
                >
                  Create
                </button>
              </div>

              <div className="mt-5 space-y-2">
                {playlists.map(
                  (playlist) => {
                    const selected =
                      playlist.playlistId ===
                      selectedPlaylistId;

                    const manual =
                      playlist.playlistId ===
                      manualPlaylistId;

                    return (
                      <button
                        key={
                          playlist.playlistId
                        }
                        type="button"
                        onClick={() =>
                          void choosePlaylist(
                            playlist.playlistId
                          )
                        }
                        className={`w-full rounded-xl border p-4 text-left ${
                          selected
                            ? "border-fuchsia-300/40 bg-fuchsia-400/10"
                            : "border-white/10 bg-black/20"
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-black">
                            {
                              playlist.name
                            }
                          </span>

                          <div className="flex flex-wrap gap-2">
                            {manual ? (
                              <span className="rounded-full bg-emerald-300 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-black">
                                Manual Live
                              </span>
                            ) : null}

                            {playlist.scheduleEnabled ? (
                              <span className="rounded-full border border-amber-300/25 bg-amber-400/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-amber-100">
                                Scheduled
                              </span>
                            ) : null}

                            {!playlist.enabled ? (
                              <span className="rounded-full border border-red-300/25 bg-red-400/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-red-100">
                                Disabled
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <p className="mt-2 text-xs text-white/45">
                          {
                            playlist.trackCount
                          } tracks ·{" "}
                          {
                            playlist.enabledTrackCount
                          } enabled
                        </p>
                      </button>
                    );
                  }
                )}
              </div>
            </div>

            {selectedPlaylist ? (
              <div className="rounded-2xl border border-white/10 bg-black/25 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-white/40">
                      Selected Playlist
                    </p>

                    <h3 className="mt-2 text-2xl font-black">
                      {
                        selectedPlaylist.name
                      }
                    </h3>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      void makeActive()
                    }
                    disabled={
                      savingPlaylist ||
                      selectedPlaylist.playlistId ===
                        manualPlaylistId
                    }
                    className="rounded-xl bg-emerald-300 px-4 py-3 text-sm font-black text-black disabled:opacity-40"
                  >
                    {selectedPlaylist.playlistId ===
                    manualPlaylistId
                      ? "Manual Live"
                      : "Play Now"}
                  </button>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <Field
                    label="Playlist name"
                    value={
                      playlistForm.name
                    }
                    onChange={(value) =>
                      setPlaylistForm(
                        (current) => ({
                          ...current,
                          name: value,
                        })
                      )
                    }
                  />

                  <Field
                    label="Priority"
                    value={
                      playlistForm.priority
                    }
                    onChange={(value) =>
                      setPlaylistForm(
                        (current) => ({
                          ...current,
                          priority: value,
                        })
                      )
                    }
                    placeholder="0"
                  />
                </div>

                <label className="mt-4 block">
                  <span className="text-xs font-black uppercase tracking-[0.14em] text-white/45">
                    Description
                  </span>

                  <textarea
                    value={
                      playlistForm.description
                    }
                    onChange={(event) =>
                      setPlaylistForm(
                        (current) => ({
                          ...current,
                          description:
                            event.target
                              .value,
                        })
                      )
                    }
                    rows={3}
                    className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none focus:border-fuchsia-300/40"
                  />
                </label>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <ToggleCard
                    title="Playlist Enabled"
                    checked={
                      playlistForm.enabled
                    }
                    onChange={(checked) =>
                      setPlaylistForm(
                        (current) => ({
                          ...current,
                          enabled:
                            checked,
                        })
                      )
                    }
                  />

                  <ToggleCard
                    title="Scheduling"
                    checked={
                      playlistForm.scheduleEnabled
                    }
                    onChange={(checked) =>
                      setPlaylistForm(
                        (current) => ({
                          ...current,
                          scheduleEnabled:
                            checked,
                        })
                      )
                    }
                  />
                </div>

                {playlistForm.scheduleEnabled ? (
                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <DateTimeField
                      label="Start"
                      value={
                        playlistForm.scheduleStartAt
                      }
                      onChange={(value) =>
                        setPlaylistForm(
                          (current) => ({
                            ...current,
                            scheduleStartAt:
                              value,
                          })
                        )
                      }
                    />

                    <DateTimeField
                      label="End"
                      value={
                        playlistForm.scheduleEndAt
                      }
                      onChange={(value) =>
                        setPlaylistForm(
                          (current) => ({
                            ...current,
                            scheduleEndAt:
                              value,
                          })
                        )
                      }
                    />
                  </div>
                ) : null}

                <div className="mt-5 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/50">
                  <p>
                    <strong className="text-white/75">
                      Schedule:
                    </strong>{" "}
                    {selectedPlaylist.scheduleEnabled
                      ? `${formatDate(
                          selectedPlaylist.scheduleStartAt
                        )} → ${formatDate(
                          selectedPlaylist.scheduleEndAt
                        )}`
                      : "Off"}
                  </p>

                  <p className="mt-1">
                    Higher priority wins if two scheduled playlists overlap.
                  </p>
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      void savePlaylist()
                    }
                    disabled={
                      savingPlaylist
                    }
                    className="rounded-xl bg-violet-300 px-4 py-3 text-sm font-black text-black disabled:opacity-40"
                  >
                    {savingPlaylist
                      ? "Saving..."
                      : "Save Playlist"}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      void deletePlaylist()
                    }
                    disabled={
                      savingPlaylist ||
                      playlists.length <= 1
                    }
                    className="rounded-xl border border-red-300/20 bg-red-400/10 px-4 py-3 text-sm font-black text-red-100 disabled:opacity-40"
                  >
                    Delete Playlist
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-white/10 p-8 text-white/45">
                Create or select a playlist.
              </div>
            )}
          </div>
        </section>

        <section className="mt-8 rounded-[2rem] border border-white/10 bg-white/[0.035] p-5 sm:p-7">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-white/40">
                Track Programming
              </p>

              <h2 className="mt-2 text-2xl font-black">
                {selectedPlaylist
                  ? `${selectedPlaylist.name} Track Library`
                  : "Radio Track Library"}
              </h2>

              <p className="mt-2 max-w-2xl text-sm text-white/50">
                Add Central Media Library audio to the selected playlist. Each playlist has its own track order and enable/disable controls.
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                user
                  ? void loadRadio(
                      user,
                      selectedPlaylistId
                    )
                  : undefined
              }
              disabled={
                loadingItems ||
                savingId !== null
              }
              className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-black disabled:opacity-40"
            >
              {loadingItems
                ? "Refreshing..."
                : "Refresh"}
            </button>
          </div>

          <div className="mt-6 grid gap-3 lg:grid-cols-[1fr_auto]">
            <input
              type="search"
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="Search tracks, artist, or album..."
              className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none placeholder:text-white/30 focus:border-fuchsia-300/40"
            />

            <div className="flex flex-wrap gap-2">
              {[
                ["all", "All Audio"],
                ["radio", "In Playlist"],
                [
                  "available",
                  "Available",
                ],
              ].map(
                ([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() =>
                      setFilter(
                        value as
                          | "all"
                          | "radio"
                          | "available"
                      )
                    }
                    className={`rounded-xl px-4 py-3 text-sm font-black ${
                      filter === value
                        ? "bg-white text-black"
                        : "border border-white/10 bg-black/30 text-white/65"
                    }`}
                  >
                    {label}
                  </button>
                )
              )}
            </div>
          </div>

          {loadingItems ? (
            <p className="mt-8 text-white/50">
              Loading Radio programming...
            </p>
          ) : filteredItems.length ===
            0 ? (
            <div className="mt-8 rounded-2xl border border-dashed border-white/10 p-8 text-center">
              <p className="font-black">
                No matching audio found.
              </p>

              <p className="mt-2 text-sm text-white/45">
                Upload MP3 or WAV files in the Media Library first.
              </p>
            </div>
          ) : (
            <div className="mt-7 space-y-4">
              {filteredItems.map(
                (item) => {
                  const isSaving =
                    savingId ===
                    item.mediaId;

                  const isEditing =
                    editId ===
                    item.mediaId;

                  const radioIndex =
                    radioItems.findIndex(
                      (radioItem) =>
                        radioItem.mediaId ===
                        item.mediaId
                    );

                  return (
                    <article
                      key={item.mediaId}
                      className="rounded-[1.5rem] border border-white/10 bg-black/25 p-5"
                    >
                      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate text-xl font-black">
                              {item.radio?.title ||
                                item.title}
                            </h3>

                            {item.assignedToRadio ? (
                              <span className="rounded-full border border-fuchsia-300/25 bg-fuchsia-400/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-fuchsia-200">
                                In Playlist
                              </span>
                            ) : (
                              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-white/45">
                                Library
                              </span>
                            )}

                            {item.radio ? (
                              <span
                                className={`rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.14em] ${
                                  item.radio
                                    .enabled
                                    ? "border-emerald-300/25 bg-emerald-400/10 text-emerald-200"
                                    : "border-red-300/25 bg-red-400/10 text-red-200"
                                }`}
                              >
                                {item.radio
                                  .enabled
                                  ? "Enabled"
                                  : "Disabled"}
                              </span>
                            ) : null}
                          </div>

                          <div className="mt-3 space-y-1 text-sm text-white/50">
                            <p>
                              <span className="font-bold text-white/70">
                                File:
                              </span>{" "}
                              {item.originalName ||
                                item.title}
                            </p>

                            {item.radio ? (
                              <>
                                <p>
                                  <span className="font-bold text-white/70">
                                    Artist:
                                  </span>{" "}
                                  {item.radio.artist}
                                </p>

                                <p>
                                  <span className="font-bold text-white/70">
                                    Album / Program:
                                  </span>{" "}
                                  {
                                    item.radio
                                      .albumTitle
                                  }
                                </p>

                                <p>
                                  <span className="font-bold text-white/70">
                                    Order:
                                  </span>{" "}
                                  {radioIndex + 1}
                                </p>
                              </>
                            ) : null}
                          </div>

                          {item.previewUrl ? (
                            <audio
                              controls
                              preload="metadata"
                              src={
                                item.previewUrl
                              }
                              className="mt-4 w-full max-w-xl"
                            />
                          ) : (
                            <p className="mt-4 text-sm text-amber-200/70">
                              Preview URL unavailable.
                            </p>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-2 xl:max-w-[430px] xl:justify-end">
                          {!item.assignedToRadio ? (
                            <button
                              type="button"
                              onClick={() =>
                                void addToRadio(
                                  item
                                )
                              }
                              disabled={
                                isSaving ||
                                !selectedPlaylistId
                              }
                              className="rounded-xl bg-fuchsia-300 px-4 py-3 text-sm font-black text-black disabled:opacity-40"
                            >
                              {isSaving
                                ? "Adding..."
                                : "Add to Playlist"}
                            </button>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() =>
                                  void moveTrack(
                                    item.mediaId,
                                    "up"
                                  )
                                }
                                disabled={
                                  isSaving ||
                                  radioIndex <= 0
                                }
                                className="rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-black disabled:opacity-30"
                              >
                                ↑ Up
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  void moveTrack(
                                    item.mediaId,
                                    "down"
                                  )
                                }
                                disabled={
                                  isSaving ||
                                  radioIndex < 0 ||
                                  radioIndex ===
                                    radioItems.length -
                                      1
                                }
                                className="rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-black disabled:opacity-30"
                              >
                                ↓ Down
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  void setEnabled(
                                    item,
                                    !item.radio
                                      ?.enabled
                                  )
                                }
                                disabled={
                                  isSaving
                                }
                                className={`rounded-xl px-4 py-3 text-sm font-black disabled:opacity-40 ${
                                  item.radio
                                    ?.enabled
                                    ? "border border-amber-300/20 bg-amber-400/10 text-amber-100"
                                    : "bg-emerald-300 text-black"
                                }`}
                              >
                                {isSaving
                                  ? "Saving..."
                                  : item.radio
                                        ?.enabled
                                    ? "Disable"
                                    : "Enable"}
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  beginEdit(
                                    item
                                  )
                                }
                                disabled={
                                  isSaving
                                }
                                className="rounded-xl border border-violet-300/20 bg-violet-400/10 px-4 py-3 text-sm font-black text-violet-100 disabled:opacity-40"
                              >
                                Edit
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  void removeFromRadio(
                                    item
                                  )
                                }
                                disabled={
                                  isSaving
                                }
                                className="rounded-xl border border-red-300/20 bg-red-400/10 px-4 py-3 text-sm font-black text-red-100 disabled:opacity-40"
                              >
                                Remove
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {isEditing ? (
                        <div className="mt-5 rounded-2xl border border-violet-300/15 bg-violet-400/[0.06] p-5">
                          <h4 className="font-black">
                            Edit Radio Metadata
                          </h4>

                          <div className="mt-4 grid gap-4 md:grid-cols-2">
                            <Field
                              label="Radio title"
                              value={
                                editState.title
                              }
                              onChange={(
                                value
                              ) =>
                                setEditState(
                                  (current) => ({
                                    ...current,
                                    title:
                                      value,
                                  })
                                )
                              }
                            />

                            <Field
                              label="Artist"
                              value={
                                editState.artist
                              }
                              onChange={(
                                value
                              ) =>
                                setEditState(
                                  (current) => ({
                                    ...current,
                                    artist:
                                      value,
                                  })
                                )
                              }
                            />

                            <Field
                              label="Album / program"
                              value={
                                editState.albumTitle
                              }
                              onChange={(
                                value
                              ) =>
                                setEditState(
                                  (current) => ({
                                    ...current,
                                    albumTitle:
                                      value,
                                  })
                                )
                              }
                            />

                            <Field
                              label="Cover path or URL"
                              value={
                                editState.cover
                              }
                              placeholder="/covers/album.png"
                              onChange={(
                                value
                              ) =>
                                setEditState(
                                  (current) => ({
                                    ...current,
                                    cover:
                                      value,
                                  })
                                )
                              }
                            />
                          </div>

                          <div className="mt-4 flex flex-wrap gap-3">
                            <button
                              type="button"
                              onClick={() =>
                                void saveEdit(
                                  item
                                )
                              }
                              disabled={
                                isSaving ||
                                !editState.title.trim()
                              }
                              className="rounded-xl bg-violet-300 px-4 py-3 text-sm font-black text-black disabled:opacity-40"
                            >
                              {isSaving
                                ? "Saving..."
                                : "Save Changes"}
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                setEditId(null)
                              }
                              disabled={
                                isSaving
                              }
                              className="rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-sm font-black"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </article>
                  );
                }
              )}
            </div>
          )}
        </section>

        <section className="mt-8 rounded-[2rem] border border-fuchsia-300/15 bg-fuchsia-400/[0.05] p-6">
          <h2 className="text-xl font-black">
            Automatic Programming
          </h2>

          <p className="mt-3 max-w-4xl text-sm leading-6 text-white/55">
            Scheduled playlists override the manual live playlist while their time window is active. If schedules overlap, the higher Priority value wins. When no scheduled playlist is active, Radio falls back to the playlist selected with Play Now.
          </p>
        </section>
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.035] p-5">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-white/40">
        {label}
      </p>

      <p className="mt-2 text-3xl font-black">
        {value}
      </p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-black uppercase tracking-[0.14em] text-white/45">
        {label}
      </span>

      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(event) =>
          onChange(
            event.target.value
          )
        }
        className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none placeholder:text-white/25 focus:border-violet-300/40"
      />
    </label>
  );
}

function DateTimeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-black uppercase tracking-[0.14em] text-white/45">
        {label}
      </span>

      <input
        type="datetime-local"
        value={value}
        onChange={(event) =>
          onChange(
            event.target.value
          )
        }
        className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none focus:border-fuchsia-300/40"
      />
    </label>
  );
}

function ToggleCard({
  title,
  checked,
  onChange,
}: {
  title: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between rounded-xl border border-white/10 bg-black/25 px-4 py-3">
      <span className="font-black">
        {title}
      </span>

      <input
        type="checkbox"
        checked={checked}
        onChange={(event) =>
          onChange(
            event.target.checked
          )
        }
        className="h-5 w-5 accent-fuchsia-300"
      />
    </label>
  );
}


