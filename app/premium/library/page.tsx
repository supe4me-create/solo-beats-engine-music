"use client";

import Link from "next/link";
import {
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { firebaseAuth } from "../../../lib/firebaseClient";
import { premiumAlbums } from "../../premiumCatalog";

type AccessState =
  | "loading"
  | "signed-out"
  | "active"
  | "inactive"
  | "error";

type PlayerItem = {
  id: string;
  title: string;
  albumTitle: string;
  src: string;
};

type PremiumUsage = {
  downloadsUsed: number;
  downloadsRemaining: number;
  downloadLimit: number;
  cycleKey: string | null;
};

export default function PremiumLibraryPage() {
  const [user, setUser] =
    useState<User | null>(null);
  const [accessState, setAccessState] =
    useState<AccessState>("loading");
  const [message, setMessage] =
    useState("");
  const [openAlbumId, setOpenAlbumId] =
    useState<string | null>(null);

  const [queue, setQueue] =
    useState<PlayerItem[]>([]);
  const [currentIndex, setCurrentIndex] =
    useState(0);
  const [isPlaying, setIsPlaying] =
    useState(false);
  const [currentTime, setCurrentTime] =
    useState(0);
  const [duration, setDuration] =
    useState(0);
  const [volume, setVolume] =
    useState(1);

  const [usage, setUsage] =
    useState<PremiumUsage>({
      downloadsUsed: 0,
      downloadsRemaining: 10,
      downloadLimit: 10,
      cycleKey: null,
    });
  const [downloadingTrackId, setDownloadingTrackId] =
    useState<string | null>(null);
  const [downloadMessage, setDownloadMessage] =
    useState("");
  const [downloadError, setDownloadError] =
    useState("");

  const audioRef =
    useRef<HTMLAudioElement | null>(null);

  const currentItem =
    queue[currentIndex] || null;

  const totalTracks = useMemo(
    () =>
      premiumAlbums.reduce(
        (total, album) =>
          total + album.tracks.length,
        0
      ),
    []
  );

  useEffect(() => {
    let cancelled = false;

    const unsubscribe =
      onAuthStateChanged(
        firebaseAuth,
        async (currentUser) => {
          if (cancelled) return;

          setUser(currentUser);
          setMessage("");

          if (!currentUser) {
            setAccessState("signed-out");
            return;
          }

          setAccessState("loading");

          try {
            const idToken =
              await currentUser.getIdToken();

            const response = await fetch(
              "/api/premium/access",
              {
                headers: {
                  Authorization:
                    `Bearer ${idToken}`,
                },
                cache: "no-store",
              }
            );

            const data =
              await response.json();

            if (
              response.ok &&
              data.success &&
              data.premiumAccess
            ) {
              setAccessState("active");

              const usageResponse = await fetch(
                "/api/premium/download-usage",
                {
                  headers: {
                    Authorization:
                      `Bearer ${idToken}`,
                  },
                  cache: "no-store",
                }
              );

              const usageData =
                await usageResponse.json();

              if (
                usageResponse.ok &&
                usageData.success
              ) {
                setUsage({
                  downloadsUsed:
                    usageData.downloadsUsed,
                  downloadsRemaining:
                    usageData.downloadsRemaining,
                  downloadLimit:
                    usageData.downloadLimit,
                  cycleKey:
                    usageData.cycleKey,
                });
              }

              return;
            }

            if (
              response.status === 401
            ) {
              setAccessState(
                "signed-out"
              );
              return;
            }

            setMessage(
              data.error ||
                "An active Premium membership is required."
            );
            setAccessState("inactive");
          } catch (error) {
            console.error(
              "Premium library access error:",
              error
            );

            setMessage(
              error instanceof Error
                ? error.message
                : "Premium access could not be checked."
            );

            setAccessState("error");
          }
        }
      );

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;

    if (!audio || !currentItem) {
      return;
    }

    audio.src = currentItem.src;
    audio.load();

    void audio
      .play()
      .then(() => {
        setIsPlaying(true);
      })
      .catch(() => {
        setIsPlaying(false);
      });
  }, [currentItem]);

  function playAlbumPreview(
    albumId: string,
    albumTitle: string,
    src: string
  ) {
    setQueue([
      {
        id: `${albumId}-album-preview`,
        title: `${albumTitle} Album Preview`,
        albumTitle,
        src,
      },
    ]);
    setCurrentIndex(0);
  }

  function playAlbumTrack(
    albumId: string,
    trackId: string
  ) {
    const album = premiumAlbums.find(
      (item) => item.id === albumId
    );

    if (!album) return;

    const albumQueue: PlayerItem[] =
      album.tracks.map((track) => ({
        id: track.id,
        title: track.title,
        albumTitle: album.title,
        src: track.preview,
      }));

    const nextIndex = albumQueue.findIndex(
      (track) => track.id === trackId
    );

    setQueue(albumQueue);
    setCurrentIndex(
      nextIndex >= 0 ? nextIndex : 0
    );
  }

  async function togglePlayPause() {
    const audio = audioRef.current;

    if (!audio || !currentItem) return;

    if (audio.paused) {
      await audio.play();
      setIsPlaying(true);
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  }

  function stopPlayback() {
    const audio = audioRef.current;

    if (!audio) return;

    audio.pause();
    audio.currentTime = 0;
    setCurrentTime(0);
    setIsPlaying(false);
  }

  function playPrevious() {
    if (queue.length === 0) return;

    setCurrentIndex((index) =>
      index <= 0
        ? queue.length - 1
        : index - 1
    );
  }

  function playNext() {
    if (queue.length === 0) return;

    setCurrentIndex((index) =>
      index >= queue.length - 1
        ? 0
        : index + 1
    );
  }

  function handleSeek(
    value: number
  ) {
    const audio = audioRef.current;

    if (!audio) return;

    audio.currentTime = value;
    setCurrentTime(value);
  }

  function handleVolume(
    value: number
  ) {
    const audio = audioRef.current;

    setVolume(value);

    if (audio) {
      audio.volume = value;
    }
  }

  async function downloadPremiumTrack(
    trackId: string
  ) {
    if (!user) return;

    setDownloadingTrackId(trackId);
    setDownloadMessage("");
    setDownloadError("");

    try {
      const idToken =
        await user.getIdToken();

      const response = await fetch(
        "/api/download",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
            Authorization:
              `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            premiumDownload: true,
            itemType: "track",
            itemId: trackId,
          }),
        }
      );

      const data =
        await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error ||
            "Premium track download could not be prepared."
        );
      }

      setUsage({
        downloadsUsed:
          data.downloadsUsed,
        downloadsRemaining:
          data.downloadsRemaining,
        downloadLimit:
          data.downloadLimit,
        cycleKey:
          data.cycleKey || null,
      });

      setDownloadMessage(
        data.message ||
          "Your Premium download is ready."
      );

      window.location.href =
        data.downloadUrl;
    } catch (error) {
      setDownloadError(
        error instanceof Error
          ? error.message
          : "Premium track download could not be prepared."
      );
    } finally {
      setDownloadingTrackId(null);
    }
  }

  function formatTime(
    seconds: number
  ) {
    if (
      !Number.isFinite(seconds) ||
      seconds < 0
    ) {
      return "0:00";
    }

    const minutes = Math.floor(
      seconds / 60
    );
    const remainingSeconds =
      Math.floor(seconds % 60);

    return `${minutes}:${String(
      remainingSeconds
    ).padStart(2, "0")}`;
  }

  if (accessState === "loading") {
    return (
      <main className="min-h-screen px-5 pb-40 pt-52 sm:px-8">
        <div className="mx-auto max-w-5xl">
          <section className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-10 text-center">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-violet-300">
              SOLO BEATS PREMIUM
            </p>
            <h1 className="mt-3 text-4xl font-black">
              Checking membership...
            </h1>
          </section>
        </div>
      </main>
    );
  }

  if (accessState === "signed-out") {
    return (
      <main className="min-h-screen px-5 pb-40 pt-52 sm:px-8">
        <div className="mx-auto max-w-5xl">
          <section className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-violet-500/20 via-white/[0.04] to-cyan-400/10 p-8 text-center shadow-2xl sm:p-12">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-violet-300">
              Premium Library Locked
            </p>
            <h1 className="mt-3 text-4xl font-black sm:text-5xl">
              Sign in to continue
            </h1>
            <Link
              href="/account"
              className="mt-7 inline-flex rounded-2xl bg-white px-6 py-4 font-black text-black"
            >
              Sign In
            </Link>
          </section>
        </div>
      </main>
    );
  }

  if (
    accessState === "inactive" ||
    accessState === "error"
  ) {
    return (
      <main className="min-h-screen px-5 pb-40 pt-52 sm:px-8">
        <div className="mx-auto max-w-5xl">
          <section className="rounded-[2rem] border border-red-300/15 bg-gradient-to-br from-red-500/10 via-white/[0.03] to-violet-500/10 p-8 text-center shadow-2xl sm:p-12">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-red-200">
              Premium Access Required
            </p>
            <h1 className="mt-3 text-4xl font-black sm:text-5xl">
              Your Premium library is locked
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-white/55">
              {message ||
                "An active SOLO BEATS PREMIUM membership is required."}
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <Link
                href="/premium"
                className="rounded-2xl bg-white px-6 py-4 font-black text-black"
              >
                Join Premium
              </Link>
              <Link
                href="/account"
                className="rounded-2xl border border-white/15 bg-white/5 px-6 py-4 font-black text-white"
              >
                Open Account
              </Link>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-5 pb-72 pt-52 sm:px-8">
      <audio
        ref={audioRef}
        onPlay={() =>
          setIsPlaying(true)
        }
        onPause={() =>
          setIsPlaying(false)
        }
        onTimeUpdate={(event) =>
          setCurrentTime(
            event.currentTarget.currentTime
          )
        }
        onLoadedMetadata={(event) =>
          setDuration(
            event.currentTarget.duration
          )
        }
        onEnded={playNext}
      />

      <div className="mx-auto max-w-7xl">
        <section className="overflow-hidden rounded-[2.25rem] border border-emerald-300/20 bg-gradient-to-br from-violet-600/25 via-white/[0.04] to-emerald-400/15 p-8 shadow-2xl sm:p-12">
          <p className="text-sm font-black uppercase tracking-[0.22em] text-emerald-300">
            Premium Access Confirmed
          </p>

          <h1 className="mt-3 text-5xl font-black sm:text-7xl">
            Your Premium Library
          </h1>

          <p className="mt-5 max-w-3xl text-lg leading-8 text-white/60">
            Welcome{user?.displayName
              ? `, ${user.displayName}`
              : ""}. Your membership unlocks {premiumAlbums.length} selected albums and {totalTracks} tracks.
          </p>
        </section>

        <section className="mt-8 rounded-[2rem] border border-white/10 bg-white/[0.035] p-6 sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.2em] text-emerald-300">
                Monthly Downloads
              </p>

              <h2 className="mt-2 text-3xl font-black">
                {usage.downloadsRemaining} of {usage.downloadLimit} remaining
              </h2>

              <p className="mt-2 text-white/50">
                {`Download up to ${usage.downloadLimit} Premium tracks during each billing month.`}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 px-6 py-5 text-center">
              <p className="text-sm text-white/45">
                Used this cycle
              </p>
              <p className="mt-1 text-4xl font-black">
                {usage.downloadsUsed}
              </p>
            </div>
          </div>

          {downloadMessage ? (
            <p className="mt-5 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-emerald-200">
              {downloadMessage}
            </p>
          ) : null}

          {downloadError ? (
            <p className="mt-5 rounded-xl border border-red-400/20 bg-red-400/10 p-4 text-red-200">
              {downloadError}
            </p>
          ) : null}
        </section>

        <section className="mt-10">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.2em] text-violet-300">
                Premium Catalog
              </p>
              <h2 className="mt-2 text-4xl font-black">
                Selected member releases
              </h2>
            </div>

            <Link
              href="/account"
              className="w-fit rounded-2xl border border-white/15 bg-white/5 px-5 py-3 font-black"
            >
              View Membership
            </Link>
          </div>

          <div className="mt-7 grid gap-6 lg:grid-cols-2">
            {premiumAlbums.map((album) => {
              const isOpen =
                openAlbumId === album.id;

              return (
                <article
                  key={album.id}
                  className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.035]"
                >
                  <div className="grid gap-6 p-6 sm:grid-cols-[170px_minmax(0,1fr)]">
                    <img
                      src={album.cover}
                      alt={`${album.title} cover`}
                      className="aspect-square w-full rounded-2xl object-cover"
                    />

                    <div>
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-emerald-200">
                          Premium
                        </span>

                        {album.status === "upcoming" ? (
                          <span className="rounded-full border border-violet-300/20 bg-violet-300/10 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-violet-200">
                            Early Access
                          </span>
                        ) : null}
                      </div>

                      <h3 className="mt-4 text-3xl font-black">
                        {album.title}
                      </h3>

                      <p className="mt-2 text-sm text-white/45">
                        {album.genre} â€¢ {album.year} â€¢ {album.tracks.length} tracks
                      </p>

                      <p className="mt-4 line-clamp-3 leading-7 text-white/55">
                        {album.description}
                      </p>

                      <div className="mt-5 flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={() =>
                            playAlbumPreview(
                              album.id,
                              album.title,
                              album.albumPreview
                            )
                          }
                          className="rounded-2xl bg-white px-5 py-3 font-black text-black"
                        >
                          Play Album Preview
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            setOpenAlbumId(
                              isOpen
                                ? null
                                : album.id
                            )
                          }
                          className="rounded-2xl border border-white/15 bg-white/5 px-5 py-3 font-black"
                        >
                          {isOpen
                            ? "Hide Tracks"
                            : "View Tracks"}
                        </button>
                      </div>
                    </div>
                  </div>

                  {isOpen ? (
                    <div className="border-t border-white/10 p-5">
                      <div className="grid gap-2">
                        {album.tracks.map(
                          (track) => (
                            <div
                              key={track.id}
                              className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3"
                            >
                              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10 text-sm font-black">
                                {track.number}
                              </span>

                              <button
                                type="button"
                                onClick={() =>
                                  playAlbumTrack(
                                    album.id,
                                    track.id
                                  )
                                }
                                className="min-w-0 flex-1 text-left"
                              >
                                <span className="block truncate font-bold">
                                  {track.title}
                                </span>
                                <span className="block text-xs text-white/40">
                                  {album.title}
                                </span>
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  playAlbumTrack(
                                    album.id,
                                    track.id
                                  )
                                }
                                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-black text-emerald-300 hover:bg-white/10"
                              >
                                Play
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  downloadPremiumTrack(
                                    track.id
                                  )
                                }
                                disabled={
                                  downloadingTrackId ===
                                  track.id
                                }
                                className="rounded-xl bg-white px-3 py-2 text-sm font-black text-black disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {downloadingTrackId ===
                                track.id
                                  ? "Preparing..."
                                  : "Download"}
                              </button>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>
      </div>

      {currentItem ? (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-black/95 px-4 py-4 shadow-2xl backdrop-blur-xl sm:px-6">
          <div className="mx-auto max-w-7xl">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
              <div className="min-w-0 lg:w-72">
                <p className="truncate text-lg font-black">
                  {currentItem.title}
                </p>
                <p className="truncate text-sm text-white/45">
                  {currentItem.albumTitle}
                </p>
              </div>

              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={playPrevious}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-black hover:bg-white/10"
                  aria-label="Previous track"
                >
                  Previous
                </button>

                <button
                  type="button"
                  onClick={togglePlayPause}
                  className="min-w-28 rounded-xl bg-white px-5 py-3 font-black text-black"
                >
                  {isPlaying
                    ? "Pause"
                    : "Play"}
                </button>

                <button
                  type="button"
                  onClick={stopPlayback}
                  className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 font-black text-red-200 hover:bg-red-400/15"
                >
                  Stop
                </button>

                <button
                  type="button"
                  onClick={playNext}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-black hover:bg-white/10"
                  aria-label="Next track"
                >
                  Next
                </button>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3">
                  <span className="w-12 text-right text-xs text-white/45">
                    {formatTime(currentTime)}
                  </span>

                  <input
                    type="range"
                    min={0}
                    max={
                      Number.isFinite(duration)
                        ? duration
                        : 0
                    }
                    step={0.1}
                    value={Math.min(
                      currentTime,
                      duration || 0
                    )}
                    onChange={(event) =>
                      handleSeek(
                        Number(
                          event.target.value
                        )
                      )
                    }
                    className="min-w-0 flex-1"
                    aria-label="Seek"
                  />

                  <span className="w-12 text-xs text-white/45">
                    {formatTime(duration)}
                  </span>
                </div>

                <div className="mt-2 flex items-center justify-end gap-3">
                  <span className="text-xs font-bold uppercase tracking-[0.14em] text-white/35">
                    Volume
                  </span>

                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={volume}
                    onChange={(event) =>
                      handleVolume(
                        Number(
                          event.target.value
                        )
                      )
                    }
                    className="w-32"
                    aria-label="Volume"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
