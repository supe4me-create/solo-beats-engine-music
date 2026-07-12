"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type Album = {
  title: string;
  image: string;
  year?: string;
  tracks?: string;
  audio?: string;
  link?: string;
  genre?: string;
};

const upcomingAlbums: Album[] = [
  {
    title: "Dark Horse",
    year: "2026",
    tracks: "20 Tracks",
    image: "/covers/darkhorse.png",
    audio: "/previews/darkhorse.wav",
    link: "/albums/dark-horse",
    genre: "Complextro",
  },
  {
    title: "Bass King",
    year: "2026",
    tracks: "20 Tracks",
    image: "/covers/bassking.png",
    audio: "/previews/bassking.wav",
    link: "/albums/bass-king",
    genre: "Electro House",
  },
  {
    title: "Zombie Bassline",
    year: "2026",
    tracks: "20 Tracks",
    image: "/covers/zombiebassline.png",
    audio: "/previews/zombiebassline.wav",
    link: "/albums/zombie-bassline",
    genre: "Complextro",
  },
  {
    title: "A World Built on Sound",
    year: "2026",
    tracks: "20 Tracks",
    image: "/covers/aworldbuiltonsound.png",
    audio: "/previews/aworldbuiltonsound.wav",
    link: "/albums/aworldbuiltonsound",
    genre: "Electronic",
  },
];

const releasedAlbums: Album[] = [
  {
    title: "Neon Lights",
    image: "/covers/neonlights.jpg",
    genre: "Electronic",
  },
  {
    title: "Mystery",
    image: "/covers/mystery.jpg",
    genre: "Electronic",
  },
  {
    title: "Echoes of Power",
    image: "/covers/echoes-of-power.jpg",
    genre: "Electro House",
  },
  {
    title: "Neon Overdrive",
    image: "/covers/neon-overdrive.jpg",
    genre: "Complextro",
  },
  {
    title: "Unchained Energy",
    image: "/covers/unchained-energy.png",
    genre: "Electro House",
  },
  {
    title: "Novafx",
    image: "/covers/novafx.jpg",
    genre: "Electronic",
  },
  {
    title: "More Touch",
    image: "/covers/more-touch.jpg",
    genre: "Electronic",
  },
  {
    title: "Summer Blast",
    image: "/covers/summer-blast.jpg",
    genre: "Dance",
  },
  {
    title: "Obsession",
    image: "/covers/obsession.jpg",
    genre: "Electronic",
  },
  {
    title: "Tasty Smile",
    image: "/covers/tasty-smile.jpg",
    genre: "Dance",
  },
  {
    title: "Beaming Dance",
    image: "/covers/beaming-dance.jpg",
    genre: "Dance",
  },
  {
    title: "Can't Miss It!",
    image: "/covers/cant-miss-it.jpg",
    genre: "Electronic",
  },
  {
    title: "All Ears",
    image: "/covers/all-ears.jpg",
    genre: "Electronic",
  },
  {
    title: "Boost",
    image: "/covers/boost.jpg",
    genre: "Electro House",
  },
  {
    title: "Cygnus X",
    image: "/covers/cygnus-x.jpg",
    genre: "Electronic",
  },
  {
    title: "Blur",
    image: "/covers/blur.png",
    genre: "Electronic",
  },
  {
    title: "Trust No One",
    image: "/covers/trust-no-one.jpg",
    genre: "Complextro",
  },
  {
    title: "Full Speed",
    image: "/covers/fullspeed.jpg",
    genre: "Electro House",
  },
  {
    title: "Night Terror",
    image: "/covers/nightterror.jpg",
    genre: "Complextro",
  },
  {
    title: "Reboot",
    image: "/covers/reboot.jpg",
    genre: "Electronic",
  },
  {
    title: "Strange Feeling",
    image: "/covers/strangefeeling.png",
    genre: "Complextro",
  },
];

const ALBUMS_PER_PAGE = 8;

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "0:00";
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);

  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

export default function AlbumsPage() {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [currentAlbum, setCurrentAlbum] = useState<Album | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);

  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [currentPage, setCurrentPage] = useState(1);

  const [favorites, setFavorites] = useState<string[]>([]);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [favoritesLoaded, setFavoritesLoaded] = useState(false);

  function sortAlbums(albums: Album[]) {
    const sortedAlbums = [...albums];

    if (sortBy === "oldest") {
      return sortedAlbums.reverse();
    }

    if (sortBy === "az") {
      return sortedAlbums.sort((a, b) =>
        a.title.localeCompare(b.title)
      );
    }

    if (sortBy === "za") {
      return sortedAlbums.sort((a, b) =>
        b.title.localeCompare(a.title)
      );
    }

    return sortedAlbums;
  }

  function filterAlbums(albums: Album[]) {
    const searchText = search.trim().toLowerCase();

    return sortAlbums(albums).filter((album) => {
      const matchesSearch = album.title
        .toLowerCase()
        .includes(searchText);

      const matchesFavorites =
        !favoritesOnly || favorites.includes(album.title);

      return matchesSearch && matchesFavorites;
    });
  }

  function toggleFavorite(albumTitle: string) {
    setFavorites((currentFavorites) => {
      if (currentFavorites.includes(albumTitle)) {
        return currentFavorites.filter(
          (title) => title !== albumTitle
        );
      }

      return [...currentFavorites, albumTitle];
    });
  }

  function isFavorite(albumTitle: string) {
    return favorites.includes(albumTitle);
  }

  async function playPreview(album: Album) {
    const audio = audioRef.current;

    if (!audio || !album.audio) {
      return;
    }

    if (currentAlbum?.audio === album.audio) {
      if (audio.paused) {
        try {
          await audio.play();
        } catch (error) {
          console.error("Preview could not play:", error);
        }
      } else {
        audio.pause();
      }

      return;
    }

    audio.src = album.audio;
    audio.currentTime = 0;

    setCurrentAlbum(album);
    setCurrentTime(0);
    setDuration(0);

    try {
      await audio.play();
    } catch (error) {
      console.error("Preview could not play:", error);
      setIsPlaying(false);
    }
  }

  async function togglePlayer() {
    const audio = audioRef.current;

    if (!audio || !currentAlbum?.audio) {
      return;
    }

    if (audio.paused) {
      try {
        await audio.play();
      } catch (error) {
        console.error("Preview could not play:", error);
      }
    } else {
      audio.pause();
    }
  }

  function stopPlayer() {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    audio.pause();
    audio.currentTime = 0;

    setIsPlaying(false);
    setCurrentTime(0);
  }

  function closePlayer() {
    stopPlayer();
    setCurrentAlbum(null);
    setDuration(0);
  }

  function seekAudio(value: number) {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    audio.currentTime = value;
    setCurrentTime(value);
  }

  function changeVolume(value: number) {
    const audio = audioRef.current;

    setVolume(value);

    if (audio) {
      audio.volume = value;
    }
  }

  function handleAudioTimeUpdate() {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    setCurrentTime(audio.currentTime);
  }

  function handleAudioMetadata() {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    setDuration(
      Number.isFinite(audio.duration) ? audio.duration : 0
    );
  }

  function handleAudioEnded() {
    const audio = audioRef.current;

    if (audio) {
      audio.currentTime = 0;
    }

    setIsPlaying(false);
    setCurrentTime(0);
  }

  const visibleUpcomingAlbums = filterAlbums(upcomingAlbums);
  const visibleReleasedAlbums = filterAlbums(releasedAlbums);

  const totalVisibleAlbums =
    visibleUpcomingAlbums.length + visibleReleasedAlbums.length;

  const totalPages = Math.max(
    1,
    Math.ceil(visibleReleasedAlbums.length / ALBUMS_PER_PAGE)
  );

  const firstAlbumIndex =
    (currentPage - 1) * ALBUMS_PER_PAGE;

  const lastAlbumIndex =
    firstAlbumIndex + ALBUMS_PER_PAGE;

  const paginatedReleasedAlbums =
    visibleReleasedAlbums.slice(
      firstAlbumIndex,
      lastAlbumIndex
    );

  const noResults = totalVisibleAlbums === 0;

  useEffect(() => {
    try {
      const savedFavorites =
        window.localStorage.getItem("solo-beats-favorites");

      if (savedFavorites) {
        const parsedFavorites = JSON.parse(savedFavorites);

        if (Array.isArray(parsedFavorites)) {
          setFavorites(parsedFavorites);
        }
      }
    } catch (error) {
      console.error("Favorites could not be loaded:", error);
    } finally {
      setFavoritesLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!favoritesLoaded) {
      return;
    }

    try {
      window.localStorage.setItem(
        "solo-beats-favorites",
        JSON.stringify(favorites)
      );
    } catch (error) {
      console.error("Favorites could not be saved:", error);
    }
  }, [favorites, favoritesLoaded]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, sortBy, favoritesOnly]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    const audio = audioRef.current;

    if (audio) {
      audio.volume = volume;
    }
  }, [volume]);

  function goToPage(pageNumber: number) {
    setCurrentPage(pageNumber);

    window.setTimeout(() => {
      document
        .getElementById("released-albums")
        ?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
    }, 0);
  }

  function clearFilters() {
    setSearch("");
    setFavoritesOnly(false);
    setSortBy("newest");
  }

  return (
    <main
      className={`min-h-screen bg-black px-5 py-12 text-white md:px-10 ${
        currentAlbum ? "pb-96 md:pb-48" : ""
      }`}
    >
      <audio
        ref={audioRef}
        preload="metadata"
        onTimeUpdate={handleAudioTimeUpdate}
        onLoadedMetadata={handleAudioMetadata}
        onDurationChange={handleAudioMetadata}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={handleAudioEnded}
      />

      <section className="mx-auto max-w-7xl">
        <h1 className="text-center text-4xl font-black md:text-6xl">
          SOLO BEATS ALBUMS
        </h1>

        <p className="mb-10 mt-4 text-center text-gray-400">
          Explore upcoming projects and the official Solo Beats catalog.
        </p>

        <div className="mx-auto mb-6 grid max-w-5xl gap-4 md:grid-cols-[1fr_220px_auto]">
          <input
            type="text"
            placeholder="Search albums..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-5 py-4 text-white outline-none transition duration-300 placeholder:text-gray-500 focus:border-fuchsia-500 focus:shadow-[0_0_20px_rgba(217,70,239,0.18)]"
          />

          <select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value)}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-4 text-white outline-none transition duration-300 focus:border-fuchsia-500 focus:shadow-[0_0_20px_rgba(217,70,239,0.18)]"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="az">A to Z</option>
            <option value="za">Z to A</option>
          </select>

          <button
            type="button"
            onClick={() => setFavoritesOnly((current) => !current)}
            className={`rounded-xl border px-5 py-4 font-bold transition-all duration-300 ${
              favoritesOnly
                ? "border-pink-500 bg-pink-500 text-white shadow-lg shadow-pink-500/30"
                : "border-zinc-700 bg-zinc-900 text-gray-200 hover:border-pink-500 hover:text-pink-400"
            }`}
          >
            ♥ Favorites
          </button>
        </div>

        <div className="mx-auto mb-14 flex max-w-5xl flex-wrap items-center justify-between gap-3 text-sm">
          <p className="text-gray-400">
            Showing{" "}
            <span className="font-bold text-white">
              {totalVisibleAlbums}
            </span>{" "}
            album{totalVisibleAlbums === 1 ? "" : "s"}
          </p>

          {(search || favoritesOnly || sortBy !== "newest") && (
            <button
              type="button"
              onClick={clearFilters}
              className="font-bold text-fuchsia-400 transition hover:text-fuchsia-300"
            >
              Clear all filters
            </button>
          )}
        </div>

        {noResults ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 px-6 py-16 text-center">
            <h2 className="text-2xl font-black">
              No albums found
            </h2>

            <p className="mt-3 text-gray-400">
              Try another title or clear your current filters.
            </p>

            <button
              type="button"
              onClick={clearFilters}
              className="mt-6 rounded-xl bg-fuchsia-600 px-6 py-3 font-bold transition duration-300 hover:-translate-y-1 hover:bg-fuchsia-700 hover:shadow-lg hover:shadow-fuchsia-500/30"
            >
              Clear Filters
            </button>
          </div>
        ) : (
          <>
            {visibleUpcomingAlbums.length > 0 && (
              <section className="mb-20">
                <div className="mb-8">
                  <p className="font-bold uppercase tracking-[0.3em] text-fuchsia-500">
                    Coming Soon
                  </p>

                  <h2 className="mt-2 text-3xl font-black md:text-4xl">
                    Upcoming Releases
                  </h2>
                </div>

                <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
                  {visibleUpcomingAlbums.map((album) => {
                    const albumIsPlaying =
                      currentAlbum?.audio === album.audio &&
                      isPlaying;

                    const albumIsFavorite =
                      isFavorite(album.title);

                    return (
                      <article
                        key={album.title}
                        className="group relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-xl transition-all duration-300 ease-out hover:-translate-y-3 hover:scale-[1.02] hover:border-fuchsia-500 hover:shadow-[0_22px_55px_rgba(217,70,239,0.28)]"
                      >
                        <button
                          type="button"
                          onClick={() =>
                            toggleFavorite(album.title)
                          }
                          aria-label={
                            albumIsFavorite
                              ? `Remove ${album.title} from favorites`
                              : `Add ${album.title} to favorites`
                          }
                          className={`absolute right-7 top-7 z-10 flex h-11 w-11 items-center justify-center rounded-full border text-xl shadow-lg backdrop-blur-md transition-all duration-300 hover:scale-110 ${
                            albumIsFavorite
                              ? "border-pink-400 bg-pink-500 text-white"
                              : "border-white/20 bg-black/60 text-white hover:border-pink-400 hover:text-pink-400"
                          }`}
                        >
                          {albumIsFavorite ? "♥" : "♡"}
                        </button>

                        <div className="overflow-hidden rounded-xl">
                          {album.link ? (
                            <Link
                              href={album.link}
                              className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-500"
                            >
                              <img
                                src={album.image}
                                alt={`${album.title} album cover`}
                                className="aspect-square w-full rounded-xl object-cover transition-transform duration-500 ease-out group-hover:scale-110"
                              />
                            </Link>
                          ) : (
                            <img
                              src={album.image}
                              alt={`${album.title} album cover`}
                              className="aspect-square w-full rounded-xl object-cover transition-transform duration-500 ease-out group-hover:scale-110"
                            />
                          )}
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          <span className="rounded-full bg-fuchsia-500/15 px-3 py-1 text-xs font-bold text-fuchsia-300">
                            Upcoming
                          </span>

                          <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs font-bold text-gray-300">
                            {album.genre}
                          </span>
                        </div>

                        <h3 className="mt-4 text-2xl font-black transition-colors duration-300 group-hover:text-fuchsia-400">
                          {album.title}
                        </h3>

                        <p className="mt-1 text-sm text-gray-400">
                          Upcoming Album · Solo Beats
                        </p>

                        <p className="mt-1 text-sm text-gray-500">
                          {album.year} · {album.tracks}
                        </p>

                        <button
                          type="button"
                          onClick={() => playPreview(album)}
                          className="mt-5 w-full rounded-xl bg-fuchsia-600 py-3 font-bold transition-all duration-300 hover:-translate-y-1 hover:bg-fuchsia-700 hover:shadow-lg hover:shadow-fuchsia-500/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-300"
                        >
                          {albumIsPlaying
                            ? "Pause Preview"
                            : "Play Preview"}
                        </button>

                        {album.link && (
                          <Link
                            href={album.link}
                            className="mt-3 block w-full rounded-xl border border-fuchsia-500 py-3 text-center font-bold transition-all duration-300 hover:-translate-y-1 hover:bg-fuchsia-500 hover:shadow-lg hover:shadow-fuchsia-500/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-300"
                          >
                            View Album
                          </Link>
                        )}
                      </article>
                    );
                  })}
                </div>
              </section>
            )}

            {visibleReleasedAlbums.length > 0 && (
              <section
                id="released-albums"
                className="scroll-mt-8"
              >
                <div className="mb-8">
                  <p className="font-bold uppercase tracking-[0.3em] text-fuchsia-500">
                    Official Catalog
                  </p>

                  <h2 className="mt-2 text-3xl font-black md:text-4xl">
                    Released Albums
                  </h2>

                  <p className="mt-3 max-w-2xl text-gray-400">
                    Browse officially released Solo Beats albums.
                    Listening and purchasing options will be connected
                    next.
                  </p>
                </div>

                <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {paginatedReleasedAlbums.map((album) => {
                    const albumIsFavorite =
                      isFavorite(album.title);

                    return (
                      <article
                        key={album.title}
                        className="group relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-xl transition-all duration-300 ease-out hover:-translate-y-3 hover:scale-[1.02] hover:border-fuchsia-500 hover:shadow-[0_22px_55px_rgba(217,70,239,0.28)]"
                      >
                        <button
                          type="button"
                          onClick={() =>
                            toggleFavorite(album.title)
                          }
                          aria-label={
                            albumIsFavorite
                              ? `Remove ${album.title} from favorites`
                              : `Add ${album.title} to favorites`
                          }
                          className={`absolute right-7 top-7 z-10 flex h-11 w-11 items-center justify-center rounded-full border text-xl shadow-lg backdrop-blur-md transition-all duration-300 hover:scale-110 ${
                            albumIsFavorite
                              ? "border-pink-400 bg-pink-500 text-white"
                              : "border-white/20 bg-black/60 text-white hover:border-pink-400 hover:text-pink-400"
                          }`}
                        >
                          {albumIsFavorite ? "♥" : "♡"}
                        </button>

                        <div className="overflow-hidden rounded-xl">
                          <img
                            src={album.image}
                            alt={`${album.title} album cover`}
                            className="aspect-square w-full rounded-xl object-cover transition-transform duration-500 ease-out group-hover:scale-110"
                          />
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          <span className="rounded-full bg-green-500/15 px-3 py-1 text-xs font-bold text-green-300">
                            Released
                          </span>

                          <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs font-bold text-gray-300">
                            {album.genre}
                          </span>
                        </div>

                        <h3 className="mt-4 text-2xl font-black transition-colors duration-300 group-hover:text-fuchsia-400">
                          {album.title}
                        </h3>

                        <p className="mt-1 text-sm text-gray-400">
                          Released Album · Solo Beats
                        </p>

                        <div className="mt-5 grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            disabled
                            className="cursor-not-allowed rounded-xl bg-fuchsia-600/50 py-3 font-bold text-white/70"
                          >
                            Listen
                          </button>

                          <button
                            type="button"
                            disabled
                            className="cursor-not-allowed rounded-xl border border-fuchsia-500/50 py-3 font-bold text-white/60"
                          >
                            Buy
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>

                {totalPages > 1 && (
                  <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        goToPage(currentPage - 1)
                      }
                      disabled={currentPage === 1}
                      className="rounded-xl border border-zinc-700 px-5 py-3 font-bold transition-all duration-300 hover:-translate-y-1 hover:border-fuchsia-500 hover:bg-fuchsia-500 hover:shadow-lg hover:shadow-fuchsia-500/20 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:border-zinc-700 disabled:hover:bg-transparent disabled:hover:shadow-none"
                    >
                      Previous
                    </button>

                    {Array.from(
                      { length: totalPages },
                      (_, index) => index + 1
                    ).map((pageNumber) => (
                      <button
                        key={pageNumber}
                        type="button"
                        onClick={() =>
                          goToPage(pageNumber)
                        }
                        className={`h-12 min-w-12 rounded-xl px-4 font-bold transition-all duration-300 hover:-translate-y-1 ${
                          currentPage === pageNumber
                            ? "bg-fuchsia-600 text-white shadow-lg shadow-fuchsia-500/30"
                            : "border border-zinc-700 bg-zinc-900 hover:border-fuchsia-500 hover:bg-fuchsia-500"
                        }`}
                      >
                        {pageNumber}
                      </button>
                    ))}

                    <button
                      type="button"
                      onClick={() =>
                        goToPage(currentPage + 1)
                      }
                      disabled={currentPage === totalPages}
                      className="rounded-xl border border-zinc-700 px-5 py-3 font-bold transition-all duration-300 hover:-translate-y-1 hover:border-fuchsia-500 hover:bg-fuchsia-500 hover:shadow-lg hover:shadow-fuchsia-500/20 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:border-zinc-700 disabled:hover:bg-transparent disabled:hover:shadow-none"
                    >
                      Next
                    </button>
                  </div>
                )}

                <p className="mt-5 text-center text-sm text-gray-500">
                  Page {currentPage} of {totalPages}
                </p>
              </section>
            )}
          </>
        )}
      </section>

      {currentAlbum && (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-fuchsia-500/40 bg-zinc-950/95 px-4 py-4 shadow-[0_-10px_40px_rgba(217,70,239,0.18)] backdrop-blur-xl md:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="grid items-center gap-5 md:grid-cols-[260px_1fr_220px_50px]">
              <div className="flex min-w-0 items-center gap-3">
                <img
                  src={currentAlbum.image}
                  alt={`${currentAlbum.title} album cover`}
                  className="h-16 w-16 flex-none rounded-xl object-cover"
                />

                <div className="min-w-0">
                  <p className="truncate font-black">
                    {currentAlbum.title}
                  </p>

                  <p className="text-sm text-gray-400">
                    Solo Beats Preview
                  </p>
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={stopPlayer}
                    className="rounded-xl border border-zinc-700 px-4 py-2 text-sm font-bold transition-all duration-300 hover:-translate-y-1 hover:border-fuchsia-500 hover:bg-fuchsia-500"
                  >
                    Stop
                  </button>

                  <button
                    type="button"
                    onClick={togglePlayer}
                    className="rounded-xl bg-fuchsia-600 px-6 py-3 font-black transition-all duration-300 hover:-translate-y-1 hover:scale-105 hover:bg-fuchsia-700 hover:shadow-lg hover:shadow-fuchsia-500/30"
                  >
                    {isPlaying ? "Pause" : "Play"}
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <span className="w-11 text-right text-xs text-gray-400">
                    {formatTime(currentTime)}
                  </span>

                  <input
                    type="range"
                    min="0"
                    max={duration || 0}
                    step="0.1"
                    value={Math.min(
                      currentTime,
                      duration || 0
                    )}
                    onChange={(event) =>
                      seekAudio(
                        Number(event.target.value)
                      )
                    }
                    className="w-full accent-fuchsia-500"
                    aria-label="Preview progress"
                  />

                  <span className="w-11 text-xs text-gray-400">
                    {formatTime(duration)}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-gray-400">
                  Volume
                </span>

                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={volume}
                  onChange={(event) =>
                    changeVolume(
                      Number(event.target.value)
                    )
                  }
                  className="w-full accent-fuchsia-500"
                  aria-label="Preview volume"
                />
              </div>

              <button
                type="button"
                onClick={closePlayer}
                aria-label="Close player"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-700 text-lg font-bold text-gray-300 transition-all duration-300 hover:rotate-90 hover:border-red-500 hover:bg-red-500 hover:text-white"
              >
                X
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
