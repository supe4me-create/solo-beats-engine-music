"use client";

import Link from "next/link";
import {
  ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useAuth } from "../../auth/AuthContext";

const OWNER_EMAIL = "supe4.me@gmail.com";

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

type MediaResponse = {
  success: boolean;
  media?: MediaItem[];
  error?: string;
};

type UploadState =
  | "idle"
  | "preparing"
  | "uploading"
  | "finalizing"
  | "done"
  | "error";

function formatBytes(value: number) {
  if (!value || value <= 0) return "0 B";

  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(
    Math.floor(Math.log(value) / Math.log(1024)),
    units.length - 1
  );

  return `${(
    value / Math.pow(1024, index)
  ).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatDate(value: string | null) {
  if (!value) return "Unknown";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export default function MediaLibraryPage() {
  const { user, loading } = useAuth();

  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [selectedFile, setSelectedFile] =
    useState<File | null>(null);

  const [title, setTitle] = useState("");

  const [uploadState, setUploadState] =
    useState<UploadState>("idle");

  const [uploadPercent, setUploadPercent] =
    useState(0);

  const [search, setSearch] = useState("");

  const [kindFilter, setKindFilter] =
    useState<"all" | MediaKind>("all");

  
  const [deletingMediaId, setDeletingMediaId] =
    useState("");
const isOwner =
    !!user &&
    user.email?.toLowerCase() === OWNER_EMAIL;

  const loadMedia = useCallback(
    async (currentUser = user) => {
      if (
        !currentUser ||
        currentUser.email?.toLowerCase() !== OWNER_EMAIL
      ) {
        return;
      }

      setLoadingMedia(true);
      setError("");

      try {
        const token =
          await currentUser.getIdToken();

        const response = await fetch(
          "/api/owner/media",
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            cache: "no-store",
          }
        );

        const data =
          (await response.json()) as MediaResponse;

        if (!response.ok || !data.success) {
          throw new Error(
            data.error ||
              "Media Library could not be loaded."
          );
        }

        setMedia(data.media || []);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Media Library could not be loaded."
        );
      } finally {
        setLoadingMedia(false);
      }
    },
    [user]
  );

  useEffect(() => {
    if (!loading && isOwner && user) {
      void loadMedia(user);
    }
  }, [loading, isOwner, user, loadMedia]);

  const stats = useMemo(
    () => ({
      total: media.length,
      audio: media.filter(
        (item) => item.kind === "audio"
      ).length,
      video: media.filter(
        (item) => item.kind === "video"
      ).length,
      image: media.filter(
        (item) => item.kind === "image"
      ).length,
    }),
    [media]
  );

  const filteredMedia = useMemo(() => {
    const query =
      search.trim().toLowerCase();

    return media.filter((item) => {
      const kindMatches =
        kindFilter === "all" ||
        item.kind === kindFilter;

      const searchMatches =
        !query ||
        item.title
          .toLowerCase()
          .includes(query) ||
        (item.originalName || "")
          .toLowerCase()
          .includes(query) ||
        (item.storagePath || "")
          .toLowerCase()
          .includes(query);

      return kindMatches && searchMatches;
    });
  }, [media, search, kindFilter]);

  function handleFileChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const nextFile =
      event.target.files?.[0] || null;

    setSelectedFile(nextFile);
    setError("");
    setNotice("");
    setUploadState("idle");
    setUploadPercent(0);

    if (nextFile) {
      setTitle(
        nextFile.name.replace(/\.[^.]+$/, "")
      );
    }
  }
  async function deleteMedia(item: MediaItem) {
    if (!user || deletingMediaId) {
      return;
    }

    const confirmed = window.confirm(
      `Delete "${item.originalName || item.title}" from the Media Library?`
    );

    if (!confirmed) {
      return;
    }

    setDeletingMediaId(item.mediaId);
    setError("");
    setNotice("");

    try {
      const token = await user.getIdToken();

      const response = await fetch(
        "/api/owner/media",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            action: "delete",
            mediaId: item.mediaId,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error ||
            "Media could not be deleted."
        );
      }

      setMedia((current) =>
        current.filter(
          (mediaItem) =>
            mediaItem.mediaId !== item.mediaId
        )
      );

      setNotice(
        `${item.originalName || item.title} removed from the Media Library.`
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

  async function uploadMedia() {
    if (!user || !isOwner) return;

    if (!selectedFile) {
      setError("Choose a media file first.");
      return;
    }

    setError("");
    setNotice("");
    setUploadPercent(0);

    try {
      const token =
        await user.getIdToken();

      const fileInfo = {
        name: selectedFile.name,
        type:
          selectedFile.type ||
          "application/octet-stream",
        size: selectedFile.size,
      };

      setUploadState("preparing");
      setUploadPercent(10);

      const prepareResponse = await fetch(
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
            action: "prepare",
            file: fileInfo,
          }),
        }
      );

      const prepareData =
        await prepareResponse.json();

      if (
        !prepareResponse.ok ||
        !prepareData.success
      ) {
        throw new Error(
          prepareData.error ||
            "Could not prepare upload."
        );
      }

      setUploadState("uploading");
      setUploadPercent(35);

      const uploadResponse = await fetch(
        prepareData.uploadUrl,
        {
          method: "PUT",
          headers: {
            "Content-Type":
              selectedFile.type ||
              "application/octet-stream",
          },
          body: selectedFile,
        }
      );

      if (!uploadResponse.ok) {
        throw new Error(
          `Firebase upload failed (${uploadResponse.status}).`
        );
      }

      setUploadState("finalizing");
      setUploadPercent(80);

      const finalizeResponse = await fetch(
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
            action: "finalize",
            mediaId: prepareData.mediaId,
            storagePath:
              prepareData.storagePath,
            title: title.trim(),
            file: fileInfo,
          }),
        }
      );

      const finalizeData =
        await finalizeResponse.json();

      if (
        !finalizeResponse.ok ||
        !finalizeData.success
      ) {
        throw new Error(
          finalizeData.error ||
            "Could not finalize upload."
        );
      }

      setUploadState("done");
      setUploadPercent(100);

      setNotice(
        `${
          title.trim() || selectedFile.name
        } added to the Media Library.`
      );

      setSelectedFile(null);
      setTitle("");

      const input =
        document.getElementById(
          "media-upload-input"
        ) as HTMLInputElement | null;

      if (input) {
        input.value = "";
      }

      await loadMedia(user);
    } catch (err) {
      setUploadState("error");

      setError(
        err instanceof Error
          ? err.message
          : "Media upload failed."
      );
    }
  }

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center px-6">
        <p className="text-white/70">
          Loading Media Library...
        </p>
      </main>
    );
  }

  if (!isOwner) {
    return (
      <main className="grid min-h-screen place-items-center px-5 pb-20 pt-52">
        <section className="w-full max-w-xl rounded-[2rem] border border-red-400/20 bg-red-400/10 p-8 text-center">
          <p className="text-sm font-black uppercase tracking-[0.22em] text-red-200">
            Restricted area
          </p>

          <h1 className="mt-3 text-4xl font-black">
            Owner access only
          </h1>

          <Link
            href="/account"
            className="mt-7 inline-flex rounded-2xl bg-white px-6 py-4 font-black text-black"
          >
            Open Account
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-5 pb-40 pt-52 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <section className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-violet-500/25 via-white/[0.04] to-cyan-400/10 p-7 shadow-2xl sm:p-10">
          <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.22em] text-emerald-300">
                Owner dashboard
              </p>

              <h1 className="mt-3 text-4xl font-black sm:text-6xl">
                Central Media Library
              </h1>

              <p className="mt-4 max-w-3xl text-white/65">
                Upload music, videos, and artwork once
                and reuse the same files across Albums,
                Premium, Radio, TV, Ads, and Beats.
              </p>
            </div>

            <Link
              href="/developer"
              className="rounded-2xl bg-white px-6 py-4 font-black text-black"
            >
              Back to Dashboard
            </Link>
          </div>
        </section>

        <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat
            label="Total Media"
            value={stats.total}
          />
          <Stat
            label="Audio"
            value={stats.audio}
          />
          <Stat
            label="Video"
            value={stats.video}
          />
          <Stat
            label="Images"
            value={stats.image}
          />
        </section>

        <section className="mt-8 rounded-[2rem] border border-white/10 bg-white/[0.03] p-6 sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
            Upload Center
          </p>

          <h2 className="mt-2 text-3xl font-black">
            Add Media
          </h2>

          <p className="mt-2 text-sm text-white/55">
            MP3, WAV, MP4, JPG, JPEG, PNG and WebP
            are supported.
          </p>

          <div className="mt-7 grid gap-5 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
            <div>
              <label className="mb-2 block text-sm font-black">
                Media title
              </label>

              <input
                value={title}
                onChange={(event) =>
                  setTitle(event.target.value)
                }
                placeholder="Media title"
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-5 py-4 text-white outline-none"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-black">
                Media file
              </label>

              <input
                id="media-upload-input"
                type="file"
                accept=".mp3,.wav,.mp4,.jpg,.jpeg,.png,.webp"
                onChange={handleFileChange}
                className="block w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white"
              />
            </div>

            <button
              type="button"
              onClick={uploadMedia}
              disabled={
                !selectedFile ||
                uploadState === "preparing" ||
                uploadState === "uploading" ||
                uploadState === "finalizing"
              }
              className="rounded-2xl bg-gradient-to-r from-violet-500 to-cyan-400 px-7 py-4 font-black text-black disabled:opacity-40"
            >
              {uploadState === "preparing"
                ? "Preparing..."
                : uploadState === "uploading"
                ? "Uploading..."
                : uploadState === "finalizing"
                ? "Saving..."
                : "Upload Media"}
            </button>
          </div>

          {selectedFile && (
            <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="font-black">
                {selectedFile.name}
              </p>

              <p className="mt-1 text-sm text-white/45">
                {formatBytes(
                  selectedFile.size
                )}
              </p>
            </div>
          )}

          {uploadState !== "idle" &&
            uploadState !== "error" && (
              <div className="mt-5">
                <div className="h-3 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full bg-gradient-to-r from-violet-500 to-cyan-400"
                    style={{
                      width: `${uploadPercent}%`,
                    }}
                  />
                </div>

                <p className="mt-2 text-xs text-white/45">
                  {uploadPercent}% complete
                </p>
              </div>
            )}

          {notice && (
            <div className="mt-5 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-emerald-100">
              {notice}
            </div>
          )}

          {error && (
            <div className="mt-5 rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-red-100">
              {error}
            </div>
          )}
        </section>

        <section className="mt-8 rounded-[2rem] border border-white/10 bg-white/[0.03] p-5">
          <div className="grid gap-4 lg:grid-cols-[1fr_220px_auto]">
            <input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search Media Library..."
              className="rounded-2xl border border-white/10 bg-black/30 px-5 py-4 text-white outline-none"
            />

            <select
              value={kindFilter}
              onChange={(event) =>
                setKindFilter(
                  event.target.value as
                    | "all"
                    | MediaKind
                )
              }
              className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-white"
            >
              <option value="all">
                All Media
              </option>
              <option value="audio">
                Audio
              </option>
              <option value="video">
                Video
              </option>
              <option value="image">
                Images
              </option>
            </select>

            <button
              type="button"
              onClick={() =>
                void loadMedia(user)
              }
              className="rounded-2xl border border-white/15 bg-white/10 px-6 py-4 font-black"
            >
              Refresh
            </button>
          </div>
        </section>

        <section className="mt-8">
          <h2 className="mb-5 text-3xl font-black">
            Library
          </h2>

          {loadingMedia &&
          media.length === 0 ? (
            <div className="rounded-[2rem] border border-white/10 p-10 text-center text-white/50">
              Loading media...
            </div>
          ) : filteredMedia.length === 0 ? (
            <div className="rounded-[2rem] border border-dashed border-white/15 p-12 text-center">
              <p className="text-2xl font-black">
                No media yet
              </p>

              <p className="mt-3 text-white/45">
                Upload your first file above.
              </p>
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {filteredMedia.map(
                (item) => (
                  <article
                    key={item.mediaId}
                    className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.035]"
                  >
                    <div className="flex min-h-52 items-center justify-center bg-black/30 p-5">
                      {item.kind ===
                        "image" &&
                      item.previewUrl ? (
                        <img
                          src={
                            item.previewUrl
                          }
                          alt={item.title}
                          className="max-h-64 w-full rounded-2xl object-contain"
                        />
                      ) : item.kind ===
                          "video" &&
                        item.previewUrl ? (
                        <video
                          src={
                            item.previewUrl
                          }
                          controls
                          preload="metadata"
                          className="max-h-64 w-full rounded-2xl bg-black"
                        />
                      ) : item.kind ===
                          "audio" &&
                        item.previewUrl ? (
                        <audio
                          src={
                            item.previewUrl
                          }
                          controls
                          preload="metadata"
                          className="w-full"
                        />
                      ) : (
                        <p className="text-white/40">
                          Preview unavailable
                        </p>
                      )}
                    </div>

                    <div className="p-6">
                      <div className="flex gap-2">
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-black uppercase">
                          {item.kind}
                        </span>

                        {item.extension && (
                          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-black uppercase text-white/50">
                            {
                              item.extension
                            }
                          </span>
                        )}
                      </div>

                      <h3 className="mt-4 text-2xl font-black">
                        {item.title}
                      </h3>

                      <p className="mt-2 break-all text-xs text-white/40">
                        {item.originalName}
                      </p>

                      <div className="mt-5 grid grid-cols-2 gap-3">
                        <Info
                          label="Size"
                          value={formatBytes(
                            item.sizeBytes
                          )}
                        />

                        <Info
                          label="Status"
                          value={
                            item.status
                          }
                        />
                      </div>

                      <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                        <p className="text-xs font-black uppercase text-white/35">
                          Media ID
                        </p>

                        <p className="mt-2 break-all text-xs">
                          {item.mediaId}
                        </p>
                      </div>

                      <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-4">
                        <p className="text-xs font-black uppercase text-white/35">
                          Firebase Storage
                        </p>

                        <p className="mt-2 break-all text-xs text-white/45">
                          {
                            item.storagePath
                          }
                        </p>
                      </div>

                      <p className="mt-4 text-xs text-white/30">
                        Uploaded{" "}
                        {formatDate(
                          item.createdAt
                        )}
                      </p>
                  <button
                    type="button"
                    onClick={() =>
                      void deleteMedia(item)
                    }
                    disabled={
                      deletingMediaId ===
                      item.mediaId
                    }
                    className="mt-5 w-full rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm font-black text-red-200 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {deletingMediaId ===
                    item.mediaId
                      ? "Deleting..."
                      : "Delete Media"}
                  </button>
                    </div>
                  </article>
                )
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-[1.7rem] border border-white/10 bg-white/[0.035] p-5">
      <p className="text-xs font-black uppercase tracking-[0.15em] text-white/35">
        {label}
      </p>

      <p className="mt-2 text-3xl font-black">
        {value}
      </p>
    </div>
  );
}

function Info({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-3">
      <p className="text-[10px] font-black uppercase text-white/30">
        {label}
      </p>

      <p className="mt-1 truncate text-sm font-black">
        {value}
      </p>
    </div>
  );
}

