"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { albums } from "../store/albums";
import { useFavorites } from "../favorites/useFavorites";
import { usePlayer } from "../player/usePlayer";
import type { PlayerTrack } from "../player/types";

type SearchResult =
  | {
      key: string;
      type: "album";
      title: string;
      subtitle: string;
      cover: string;
      href: string;
      status: string;
    }
  | {
      key: string;
      type: "track";
      title: string;
      subtitle: string;
      cover: string;
      href: string;
      preview: string;
      trackNumber: number;
    };

function normalize(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

export default function SearchPage() {
  const { isFavorite, toggleFavorite } = useFavorites();
  const {
    currentTrack,
    isPlaying,
    playTrack,
    togglePlay,
  } = usePlayer();
  const [query, setQuery] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setQuery(params.get("q") || "");
  }, []);

  const results = useMemo<SearchResult[]>(() => {
    const search = normalize(query);

    if (!search) {
      return [];
    }

    const matches: SearchResult[] = [];

    for (const album of albums) {
      const albumMatches = [
        album.title,
        album.artist,
        album.genre,
        album.year,
        album.status,
        album.description,
      ].some((value) => normalize(value).includes(search));

      if (albumMatches) {
        matches.push({
          key: `album-${album.id}`,
          type: "album",
          title: album.title,
          subtitle: `${album.artist} • ${album.genre} • ${album.year}`,
          cover: album.cover,
          href: album.pageLink || `/store?album=${album.id}`,
          status: album.status,
        });
      }

      for (const track of album.tracks) {
        const trackMatches = [
          track.title,
          track.number,
        ].some((value) => normalize(value).includes(search));

        if (trackMatches) {
          matches.push({
            key: `track-${album.id}-${track.id}`,
            type: "track",
            title: track.title,
            subtitle: `${album.title} • Track ${track.number}`,
            cover: album.cover,
            href: `/store?album=${album.id}&track=${track.id}`,
            preview: track.preview,
            trackNumber: track.number,
          });
        }
      }
    }

    return matches;
  }, [query]);

  const albumResults = results.filter((result) => result.type === "album");
  const trackResults = results.filter((result) => result.type === "track");

  function playSearchTrack(result: Extract<SearchResult, { type: "track" }>) {
    if (!result.preview) {
      return;
    }

    const albumTitle = result.subtitle.split(" • ")[0] || "Solo Beats";

    const track: PlayerTrack = {
      id: result.key,
      title: result.title,
      artist: "Solo Beats",
      albumTitle,
      audio: result.preview,
      cover: result.cover,
      trackNumber: result.trackNumber,
    };

    if (currentTrack?.id === track.id) {
      togglePlay();
      return;
    }

    playTrack(track);
  }

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextQuery = query.trim();
    const url = nextQuery
      ? `/search?q=${encodeURIComponent(nextQuery)}`
      : "/search";

    window.history.pushState({}, "", url);
  }

  return (
    <main className="min-h-screen px-5 py-10 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <section className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-violet-500/20 via-white/[0.04] to-cyan-400/10 p-7 shadow-2xl sm:p-10">
          <p className="text-sm font-bold uppercase tracking-[0.22em] text-emerald-300">
            Global catalog search
          </p>

          <h1 className="mt-3 text-4xl font-black sm:text-6xl">
            Find your music
          </h1>

          <p className="mt-4 max-w-2xl text-white/65">
            Search every Solo Beats album and track from one place.
          </p>

          <form
            onSubmit={submitSearch}
            className="mt-7 flex flex-col gap-3 sm:flex-row"
          >
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              type="search"
              placeholder="Album, track, genre or year..."
              className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/25 px-5 py-4 text-white outline-none placeholder:text-white/35 focus:border-violet-400"
            />

            <button
              type="submit"
              className="rounded-2xl bg-white px-7 py-4 font-black text-black"
            >
              Search Catalog
            </button>
          </form>
        </section>

        {!query.trim() ? (
          <section className="mt-8 rounded-[2rem] border border-dashed border-white/15 bg-white/[0.025] p-10 text-center">
            <h2 className="text-2xl font-black">
              Start typing to search
            </h2>
            <p className="mt-3 text-white/55">
              Try an album title, track name, genre, year or release status.
            </p>
          </section>
        ) : results.length === 0 ? (
          <section className="mt-8 rounded-[2rem] border border-dashed border-white/15 bg-white/[0.025] p-10 text-center">
            <h2 className="text-2xl font-black">No results found</h2>
            <p className="mt-3 text-white/55">
              No albums or tracks matched “{query}”.
            </p>
          </section>
        ) : (
          <>
            <section className="mt-8 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
                <p className="text-sm text-white/50">Total results</p>
                <p className="mt-2 text-3xl font-black">{results.length}</p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
                <p className="text-sm text-white/50">Albums</p>
                <p className="mt-2 text-3xl font-black">
                  {albumResults.length}
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
                <p className="text-sm text-white/50">Tracks</p>
                <p className="mt-2 text-3xl font-black">
                  {trackResults.length}
                </p>
              </div>
            </section>

            {albumResults.length > 0 ? (
              <section className="mt-10">
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-violet-300">
                  Albums
                </p>
                <h2 className="mt-2 text-3xl font-black">
                  Matching albums
                </h2>

                <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {albumResults.map((result) => {
                    const favorite = isFavorite(result.title);

                    return (
                      <article
                        key={result.key}
                        className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.035] transition hover:-translate-y-1 hover:bg-white/[0.06]"
                      >
                        <button
                          type="button"
                          onClick={() => toggleFavorite(result.title)}
                          aria-label={
                            favorite
                              ? `Remove ${result.title} from favorites`
                              : `Add ${result.title} to favorites`
                          }
                          title={
                            favorite
                              ? "Remove from Favorites"
                              : "Add to Favorites"
                          }
                          className={`absolute right-4 top-4 z-10 grid h-12 w-12 place-items-center rounded-full border text-2xl shadow-lg backdrop-blur-md transition ${
                            favorite
                              ? "border-pink-300 bg-pink-500 text-white"
                              : "border-white/20 bg-black/60 text-white hover:border-pink-300 hover:text-pink-300"
                          }`}
                        >
                          {favorite ? "♥" : "♡"}
                        </button>

                        <Link href={result.href} className="block">
                          <img
                            src={result.cover}
                            alt={`${result.title} cover`}
                            className="aspect-square w-full object-cover"
                          />

                          <div className="p-5">
                            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-emerald-300">
                              {result.status}
                            </span>

                            <h3 className="mt-4 text-2xl font-black">
                              {result.title}
                            </h3>

                            <p className="mt-2 text-sm text-white/55">
                              {result.subtitle}
                            </p>
                          </div>
                        </Link>
                      </article>
                    );
                  })}
                </div>
              </section>
            ) : null}

            {trackResults.length > 0 ? (
              <section className="mt-10">
                <p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-300">
                  Tracks
                </p>
                <h2 className="mt-2 text-3xl font-black">
                  Matching tracks
                </h2>

                <div className="mt-5 grid gap-4">
                  {trackResults.map((result) => (
                    <article
                      key={result.key}
                      className="grid gap-4 rounded-2xl border border-white/10 bg-white/[0.035] p-4 sm:grid-cols-[88px_minmax(0,1fr)_auto] sm:items-center"
                    >
                      <img
                        src={result.cover}
                        alt={`${result.title} cover`}
                        className="h-[88px] w-[88px] rounded-xl object-cover"
                      />

                      <div className="min-w-0">
                        <p className="text-xs font-black uppercase tracking-[0.16em] text-violet-300">
                          Track {result.trackNumber}
                        </p>

                        <h3 className="mt-2 truncate text-xl font-black">
                          {result.title}
                        </h3>

                        <p className="mt-2 text-sm text-white/50">
                          {result.subtitle}
                        </p>

                        {result.preview ? (
                          <button
                            type="button"
                            onClick={() => playSearchTrack(result)}
                            className="mt-3 rounded-2xl border border-violet-400/25 bg-violet-400/10 px-5 py-3 font-black text-violet-100 hover:bg-violet-400/15"
                          >
                            {currentTrack?.id === result.key && isPlaying
                              ? "Pause Preview"
                              : currentTrack?.id === result.key
                                ? "Resume Preview"
                                : "Play Preview"}
                          </button>
                        ) : null}
                      </div>

                      <Link
                        href={result.href}
                        className="rounded-2xl bg-white px-5 py-4 text-center font-black text-black"
                      >
                        Open in Store
                      </Link>
                    </article>
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

