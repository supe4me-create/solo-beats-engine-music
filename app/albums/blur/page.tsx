"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePlayer } from "../../player/usePlayer";
import type { PlayerTrack } from "../../player/types";

type AnyRecord = Record<string, any>;

type BlurTrack = {
  number: number;
  title: string;
  audio: string;
};

const FALLBACK_TRACKS: BlurTrack[] = [
  {
    number: 1,
    title: "Bunny Hops",
    audio: "/previews/blur/Bunny Hops.mp3",
  },
  {
    number: 2,
    title: "Classic Cadence",
    audio: "/previews/blur/Classic Cadence.mp3",
  },
  {
    number: 3,
    title: "Cryptic Chords",
    audio: "/previews/blur/Cryptic Chords.mp3",
  },
];

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function albumId(album: AnyRecord): string {
  return text(
    album?.albumId ||
      album?.id ||
      album?.slug
  ).toLowerCase();
}

function findBlur(payload: any): AnyRecord | null {
  const candidates: AnyRecord[] = [];

  if (Array.isArray(payload)) {
    candidates.push(...payload);
  }

  if (Array.isArray(payload?.albums)) {
    candidates.push(...payload.albums);
  }

  if (payload?.album && typeof payload.album === "object") {
    candidates.push(payload.album);
  }

  return (
    candidates.find(
      (album) =>
        albumId(album) === "blur" ||
        text(album?.title).toLowerCase() === "blur"
    ) || null
  );
}

function trackAudio(track: AnyRecord): string {
  return text(
    track?.previewUrl ||
      track?.audio ||
      track?.audioUrl ||
      track?.streamUrl ||
      track?.url
  );
}

function normalizeTracks(album: AnyRecord | null): BlurTrack[] {
  if (!album || !Array.isArray(album.tracks)) {
    return FALLBACK_TRACKS;
  }

  const result = album.tracks.map(
    (track: AnyRecord, index: number): BlurTrack => ({
      number: Number(track?.number || index + 1),
      title:
        text(track?.title) ||
        `Track ${index + 1}`,
      audio: trackAudio(track),
    })
  );

  return result.length ? result : FALLBACK_TRACKS;
}

export default function BlurAlbumPage() {
  const {
    currentTrack,
    isPlaying,
    playQueue,
    togglePlay,
  } = usePlayer();

  const [album, setAlbum] =
    useState<AnyRecord | null>(null);

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadAlbum() {
      try {
        const response =
          await fetch("/api/catalog/albums", {
            cache: "no-store",
          });

        if (!response.ok) {
          throw new Error(
            `Catalog request failed: ${response.status}`
          );
        }

        const payload = await response.json();
        const found = findBlur(payload);

        if (!cancelled) {
          setAlbum(found);
        }
      } catch (error) {
        console.error(
          "Blur catalog load:",
          error
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadAlbum();

    return () => {
      cancelled = true;
    };
  }, []);

  const tracks =
    useMemo(
      () => normalizeTracks(album),
      [album]
    );

  const queue: PlayerTrack[] =
    tracks.map((track) => ({
      id: `blur-${track.number}`,
      title: track.title,
      artist: "Solo Beats",
      albumTitle: "Blur",
      audio: track.audio,
      cover: "/covers/blur.png",
      trackNumber: track.number,
      requiresPremium:
        track.number > 3,
    }));

  function playTrack(track: BlurTrack) {
    if (track.number > 3) {
      return;
    }

    if (!track.audio) {
      return;
    }

    const id =
      `blur-${track.number}`;

    if (currentTrack?.id === id) {
      togglePlay();
      return;
    }

    const index =
      queue.findIndex(
        (item) => item.id === id
      );

    if (index >= 0) {
      playQueue(queue, index);
    }
  }

  const trackCount =
    tracks.length || 18;

  return (
    <main className="min-h-screen bg-black pb-36 text-white">
      <section className="mx-auto max-w-7xl px-5 py-12">
        <Link
          href="/albums"
          className="font-bold text-purple-300 hover:text-purple-200"
        >
           Back to Albums
        </Link>

        <div className="mt-8 grid gap-10 lg:grid-cols-[380px_1fr] lg:items-center">
          <img
            src="/covers/blur.png"
            alt="Blur"
            className="aspect-square w-full rounded-3xl object-cover shadow-2xl"
          />

          <div>
            <p className="text-sm font-black uppercase tracking-[0.3em] text-purple-300">
              Released Album
            </p>

            <h1 className="mt-3 text-5xl font-black sm:text-6xl">
              Blur
            </h1>

            <p className="mt-3 text-gray-400">
              Solo Beats  2026  {trackCount} Tracks  Electronic
            </p>

            <p className="mt-6 max-w-3xl text-lg leading-8 text-gray-300">
              Experience Blur, an eighteen-track Solo Beats album filled
              with colorful electronic textures, rhythmic movement,
              atmospheric melodies and futuristic energy.
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              <button
                type="button"
                disabled={!tracks[0]?.audio}
                onClick={() =>
                  tracks[0] &&
                  playTrack(tracks[0])
                }
                className="rounded-full bg-purple-600 px-7 py-3 font-black transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {currentTrack?.id ===
                  "blur-1" &&
                isPlaying
                  ? "Pause Preview"
                  : "Play Album Preview"}
              </button>

              <Link
                href="/store"
                className="rounded-full bg-white px-7 py-3 font-black text-black"
              >
                Open in Store
              </Link>

              <Link
                href="/premium"
                className="rounded-full border border-white/20 bg-white/10 px-7 py-3 font-black"
              >
                Subscribe for Full Access
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-16">
        <div className="mb-7">
          <p className="text-sm font-black uppercase tracking-[0.3em] text-purple-300">
            Current Tracklist
          </p>

          <h2 className="mt-2 text-3xl font-black">
            {trackCount} Tracks
          </h2>

          <p className="mt-2 text-gray-500">
            3 public previews. Subscribe for full album access.
          </p>

          {loading && (
            <p className="mt-2 text-sm text-gray-600">
              Loading catalog...
            </p>
          )}
        </div>

        <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]">
          {tracks.map((track) => {
            const id =
              `blur-${track.number}`;

            const active =
              currentTrack?.id === id;

            const playing =
              active && isPlaying;

            const premium =
              track.number > 3;

            const playable =
              !premium &&
              Boolean(track.audio);

            return (
              <div
                key={`${track.number}-${track.title}`}
                className={`grid gap-4 border-b border-white/10 p-4 last:border-b-0 sm:grid-cols-[55px_1fr_auto] sm:items-center ${
                  active
                    ? "bg-purple-500/10"
                    : "hover:bg-white/[0.04]"
                }`}
              >
                <div className="font-black text-gray-500">
                  {String(
                    track.number
                  ).padStart(2, "0")}
                </div>

                <div>
                  <h3 className="text-lg font-bold">
                    {track.title}
                  </h3>

                  <p className="text-sm text-gray-500">
                    Blur  Solo Beats
                  </p>

                  {premium && (
                    <p className="mt-1 text-xs font-black uppercase tracking-wider text-purple-300">
                      Premium
                    </p>
                  )}
                </div>

                {premium ? (
                  <Link
                    href="/premium"
                    className="rounded-full border border-purple-400/30 bg-purple-500/10 px-5 py-3 text-center text-sm font-black text-purple-200"
                  >
                    Premium
                  </Link>
                ) : (
                  <button
                    type="button"
                    disabled={!playable}
                    onClick={() =>
                      playTrack(track)
                    }
                    className={`rounded-full px-5 py-3 text-sm font-black transition ${
                      playing
                        ? "bg-purple-500"
                        : "border border-white/20 bg-white/10 hover:bg-white/20"
                    } disabled:cursor-not-allowed disabled:opacity-40`}
                  >
                    {playing
                      ? "Pause Preview"
                      : active
                        ? "Resume Preview"
                        : playable
                          ? "Play Preview"
                          : "Preview unavailable"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
