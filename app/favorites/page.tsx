"use client";

import Link from "next/link";
import { useMemo } from "react";

import { usePlayer } from "../player/usePlayer";
import type { PlayerTrack } from "../player/types";

import { albums } from "../store/albums";
import { useFavorites } from "./useFavorites";

type FavoriteAlbumCard = {
  id: string;
  title: string;
  cover: string;
  genre: string;
  year?: number | string;
  tracks?: number | string;
  href: string;
  audio?: string;
  source: "store" | "catalog";
};

const catalogExtras: FavoriteAlbumCard[] = [
  {
    id: "dark-horse",
    audio: "/previews/darkhorse.wav",
    title: "Dark Horse",
    cover: "/covers/darkhorse.png",
    genre: "Complextro",
    year: 2026,
    tracks: 20,
    href: "/albums/dark-horse",
    source: "catalog",
  },
  {
    id: "bass-king",
    audio: "/previews/bassking.wav",
    title: "Bass King",
    cover: "/covers/bassking.png",
    genre: "Electro House",
    year: 2026,
    tracks: 20,
    href: "/albums/bass-king",
    source: "catalog",
  },
  {
    id: "zombie-bassline",
    audio: "/previews/zombiebassline.wav",
    title: "Zombie Bassline",
    cover: "/covers/zombiebassline.png",
    genre: "Complextro",
    year: 2026,
    tracks: 20,
    href: "/albums/zombie-bassline",
    source: "catalog",
  },
  {
    id: "a-world-built-on-sound",
    audio: "/previews/aworldbuiltonsound.wav",
    title: "A World Built on Sound",
    cover: "/covers/aworldbuiltonsound.png",
    genre: "Electronic",
    year: 2026,
    tracks: 20,
    href: "/albums/aworldbuiltonsound",
    source: "catalog",
  },
  {
    id: "black-sea",
    audio: "/previews/blacksea.wav",
    title: "Black Sea",
    cover: "/covers/black-sea.png",
    genre: "Complextro",
    year: 2026,
    tracks: 20,
    href: "/albums/black-sea",
    source: "catalog",
  },
  {
    id: "trust-no-one",
    title: "Trust No One",
    cover: "/covers/trust-no-one.jpg",
    genre: "Electronic",
    href: "/albums/trust-no-one",
    source: "catalog",
  },
];

function normalizeTitle(value: string) {
  return value.trim().toLowerCase();
}

export default function FavoritesPage() {
  const {
    currentTrack,
    isPlaying,
    playTrack,
    togglePlay,
  } = usePlayer();

  const {
    favorites,
    loaded,
    count,
    removeFavorite,
    clearFavorites,
  } = useFavorites();

  const allCatalogAlbums = useMemo<FavoriteAlbumCard[]>(
    () => [
      ...albums.map((album) => ({
        id: album.id,
        title: album.title,
        cover: album.cover,
        genre: album.genre,
        year: album.year,
        tracks: album.tracks.length,
        href: `/store?album=${album.id}`,
        audio:
          album.albumPreview ||
          album.tracks.find((track) => Boolean(track.preview))?.preview,
        source: "store" as const,
      })),
      ...catalogExtras,
    ],
    []
  );

  const favoriteAlbums = useMemo(() => {
    const seen = new Set<string>();

    return favorites
      .map((favoriteTitle) =>
        allCatalogAlbums.find(
          (album) =>
            normalizeTitle(album.title) === normalizeTitle(favoriteTitle)
        )
      )
      .filter((album): album is FavoriteAlbumCard => Boolean(album))
      .filter((album) => {
        const key = normalizeTitle(album.title);

        if (seen.has(key)) {
          return false;
        }

        seen.add(key);
        return true;
      });
  }, [allCatalogAlbums, favorites]);

  const unmatchedFavorites = useMemo(
    () =>
      favorites.filter(
        (favoriteTitle) =>
          !allCatalogAlbums.some(
            (album) =>
              normalizeTitle(album.title) === normalizeTitle(favoriteTitle)
          )
      ),
    [allCatalogAlbums, favorites]
  );

  function playPreview(album: FavoriteAlbumCard) {
    if (!album.audio) {
      return;
    }

    const track: PlayerTrack = {
      id: `favorite-preview-${album.id}`,
      title: `${album.title} Preview`,
      artist: "Solo Beats",
      albumTitle: album.title,
      audio: album.audio,
      cover: album.cover,
    };

    if (currentTrack?.id === track.id) {
      togglePlay();
      return;
    }

    playTrack(track);
  }

  if (!loaded) {
    return (
      <main className="min-h-screen grid place-items-center px-6">
        <p className="text-white/70">Loading your favorites...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-5 py-10 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <section className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-pink-500/20 via-white/[0.04] to-violet-500/10 p-7 shadow-2xl sm:p-10">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.22em] text-pink-300">
                Saved collection
              </p>

              <h1 className="mt-3 text-4xl font-black sm:text-6xl">
                Favorites
              </h1>

              <p className="mt-4 max-w-2xl text-white/65">
                Every album you save across Solo Beats appears here as a full card.
              </p>
            </div>

            {count > 0 ? (
              <button
                type="button"
                onClick={clearFavorites}
                className="rounded-2xl border border-red-400/20 bg-red-400/10 px-5 py-3 font-bold text-red-200 hover:bg-red-400/15"
              >
                Clear Favorites
              </button>
            ) : null}
          </div>
        </section>

        <section className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
            <p className="text-sm text-white/50">Saved albums</p>
            <p className="mt-2 text-3xl font-black">{count}</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
            <p className="text-sm text-white/50">Full album cards</p>
            <p className="mt-2 text-3xl font-black">{favoriteAlbums.length}</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
            <p className="text-sm text-white/50">Unmatched titles</p>
            <p className="mt-2 text-3xl font-black">{unmatchedFavorites.length}</p>
          </div>
        </section>

        {count === 0 ? (
          <section className="mt-8 rounded-[2rem] border border-dashed border-white/15 bg-white/[0.025] p-10 text-center">
            <h2 className="text-2xl font-black">No favorites yet</h2>
            <p className="mx-auto mt-3 max-w-xl text-white/60">
              Tap the heart button on an album to save it here.
            </p>
            <Link
              href="/albums"
              className="mt-7 inline-flex rounded-2xl bg-white px-6 py-4 font-black text-black"
            >
              Browse Albums
            </Link>
          </section>
        ) : (
          <>
            <section className="mt-10">
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-violet-300">
                Your collection
              </p>

              <h2 className="mt-2 text-3xl font-black">
                Favorite albums
              </h2>

              <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {favoriteAlbums.map((album) => (
                  <article
                    key={`${album.source}-${album.id}`}
                    className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.035] transition hover:-translate-y-1 hover:bg-white/[0.06]"
                  >
                    <Link href={album.href}>
                      <img
                        src={album.cover}
                        alt={`${album.title} album cover`}
                        className="aspect-square w-full object-cover"
                      />
                    </Link>

                    <div className="p-5">
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-black uppercase tracking-[0.13em] text-pink-300">
                          Favorite
                        </span>

                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-black uppercase tracking-[0.13em] text-emerald-300">
                          {album.source === "store" ? "Store" : "Catalog"}
                        </span>
                      </div>

                      <h3 className="mt-4 text-2xl font-black">
                        {album.title}
                      </h3>

                      <p className="mt-2 text-sm text-white/50">
                        {album.genre}
                        {album.year ? ` Â· ${album.year}` : ""}
                        {album.tracks ? ` Â· ${album.tracks} tracks` : ""}
                      </p>

                      <div className="mt-5 grid gap-3">
                        {album.audio ? (
                          <button
                            type="button"
                            onClick={() => playPreview(album)}
                            className="rounded-2xl border border-violet-400/25 bg-violet-400/10 px-5 py-3 font-black text-violet-100 hover:bg-violet-400/15"
                          >
                            {currentTrack?.id === `favorite-preview-${album.id}` &&
                            isPlaying
                              ? "Pause Preview"
                              : currentTrack?.id === `favorite-preview-${album.id}`
                                ? "Resume Preview"
                                : "Play Preview"}
                          </button>
                        ) : null}

                        <Link
                          href={album.href}
                          className="rounded-2xl bg-white px-5 py-3 text-center font-black text-black"
                        >
                          Open Album
                        </Link>

                        <button
                          type="button"
                          onClick={() => removeFavorite(album.title)}
                          className="rounded-2xl border border-pink-400/20 bg-pink-400/10 px-5 py-3 font-bold text-pink-200 hover:bg-pink-400/15"
                        >
                          Remove Favorite
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>

            {unmatchedFavorites.length > 0 ? (
              <section className="mt-10 rounded-[2rem] border border-amber-300/15 bg-amber-300/[0.04] p-6">
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-amber-200">
                  Needs catalog mapping
                </p>

                <div className="mt-4 grid gap-3">
                  {unmatchedFavorites.map((title) => (
                    <div
                      key={title}
                      className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/20 p-4"
                    >
                      <p className="font-black">{title}</p>

                      <button
                        type="button"
                        onClick={() => removeFavorite(title)}
                        className="rounded-full border border-pink-400/20 bg-pink-400/10 px-4 py-2 text-sm font-bold text-pink-200"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </>
        )}
      </div>
    </main>
  );
}

