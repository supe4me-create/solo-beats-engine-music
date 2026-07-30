"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { useAuth } from "../../auth/AuthContext";
import { albums } from "../../store/albums";

const OWNER_EMAIL = "supe4.me@gmail.com";

type StatusFilter = "all" | "released" | "upcoming";

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

export default function CatalogManagementPage() {
  const { user, loading } = useAuth();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>("all");
  const [genreFilter, setGenreFilter] = useState("all");
  const [openAlbumId, setOpenAlbumId] = useState<string | null>(null);

  const genres = useMemo(
    () =>
      Array.from(new Set(albums.map((album) => album.genre))).sort(
        (a, b) => a.localeCompare(b)
      ),
    []
  );

  const filteredAlbums = useMemo(() => {
    const query = search.trim().toLowerCase();

    return albums.filter((album) => {
      const matchesSearch =
        !query ||
        album.title.toLowerCase().includes(query) ||
        album.artist.toLowerCase().includes(query) ||
        album.genre.toLowerCase().includes(query) ||
        album.id.toLowerCase().includes(query) ||
        album.tracks.some((track) =>
          track.title.toLowerCase().includes(query)
        );

      const matchesStatus =
        statusFilter === "all" || album.status === statusFilter;

      const matchesGenre =
        genreFilter === "all" || album.genre === genreFilter;

      return matchesSearch && matchesStatus && matchesGenre;
    });
  }, [search, statusFilter, genreFilter]);

  const releasedCount = albums.filter(
    (album) => album.status === "released"
  ).length;

  const upcomingCount = albums.filter(
    (album) => album.status === "upcoming"
  ).length;

  const totalTracks = albums.reduce(
    (total, album) => total + album.tracks.length,
    0
  );

  const totalValue = albums.reduce(
    (total, album) => total + album.albumPrice,
    0
  );

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center px-6">
        <p className="text-white/70">Loading catalog management...</p>
      </main>
    );
  }

  if (!user || user.email?.toLowerCase() !== OWNER_EMAIL) {
    return (
      <main className="grid min-h-screen place-items-center px-5 pb-20 pt-52">
        <section className="w-full max-w-xl rounded-[2rem] border border-red-400/20 bg-red-400/10 p-8 text-center shadow-2xl">
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
                Catalog Management
              </h1>
              <p className="mt-4 max-w-3xl text-white/65">
                Review every album, track count, release status, pricing, cover,
                preview path, and Store page from one place.
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

        <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Stat label="Catalog albums" value={albums.length} />
          <Stat label="Released" value={releasedCount} />
          <Stat label="Upcoming" value={upcomingCount} />
          <Stat label="Catalog tracks" value={totalTracks} />
          <Stat label="Catalog value" value={formatMoney(totalValue)} />
        </section>

        <section className="mt-8 rounded-[2rem] border border-white/10 bg-white/[0.03] p-5">
          <div className="grid gap-4 lg:grid-cols-[1fr_220px_220px]">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search albums, tracks, genres, or album IDs..."
              className="w-full rounded-2xl border border-white/10 bg-black/30 px-5 py-4 text-white outline-none placeholder:text-white/35 focus:border-violet-400"
            />

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as StatusFilter)
              }
              className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-white outline-none focus:border-violet-400"
            >
              <option value="all">All statuses</option>
              <option value="released">Released</option>
              <option value="upcoming">Upcoming</option>
            </select>

            <select
              value={genreFilter}
              onChange={(event) => setGenreFilter(event.target.value)}
              className="rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-white outline-none focus:border-violet-400"
            >
              <option value="all">All genres</option>
              {genres.map((genre) => (
                <option key={genre} value={genre}>
                  {genre}
                </option>
              ))}
            </select>
          </div>
        </section>

        <section className="mt-8">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.2em] text-violet-300">
                Catalog results
              </p>
              <h2 className="mt-2 text-3xl font-black">
                {filteredAlbums.length}{" "}
                {filteredAlbums.length === 1 ? "album" : "albums"}
              </h2>
            </div>

            {(search || statusFilter !== "all" || genreFilter !== "all") && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setStatusFilter("all");
                  setGenreFilter("all");
                }}
                className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 font-black text-white"
              >
                Clear Filters
              </button>
            )}
          </div>

          {filteredAlbums.length === 0 ? (
            <div className="rounded-[2rem] border border-dashed border-white/15 bg-white/[0.025] p-10 text-center">
              <h3 className="text-2xl font-black">No albums found</h3>
              <p className="mt-3 text-white/55">
                Try a different search or clear the filters.
              </p>
            </div>
          ) : (
            <div className="grid gap-6">
              {filteredAlbums.map((album) => {
                const isOpen = openAlbumId === album.id;

                return (
                  <article
                    key={album.id}
                    className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.035]"
                  >
                    <div className="grid gap-6 p-5 md:grid-cols-[150px_1fr_auto] md:items-center sm:p-7">
                      <img
                        src={album.cover}
                        alt={`${album.title} cover`}
                        className="aspect-square w-full max-w-[150px] rounded-2xl object-cover shadow-xl"
                      />

                      <div className="min-w-0">
                        <div className="flex flex-wrap gap-2">
                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${
                              album.status === "released"
                                ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
                                : "border-amber-300/20 bg-amber-300/10 text-amber-100"
                            }`}
                          >
                            {album.status}
                          </span>

                          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-violet-300">
                            {album.genre}
                          </span>

                          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-white/60">
                            {album.year}
                          </span>
                        </div>

                        <h3 className="mt-3 truncate text-3xl font-black">
                          {album.title}
                        </h3>

                        <p className="mt-2 text-sm text-white/45">
                          ID: {album.id}
                        </p>

                        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/60">
                          <span>{album.tracks.length} tracks</span>
                          <span>Album {formatMoney(album.albumPrice)}</span>
                          <span>Track {formatMoney(album.trackPrice)}</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-3 md:flex-col">
                        <Link
                          href={album.pageLink}
                          className="rounded-2xl bg-white px-5 py-3 text-center font-black text-black"
                        >
                          Open Album Page
                        </Link>

                        <Link
                          href={`/store?album=${album.id}`}
                          className="rounded-2xl border border-white/15 bg-white/5 px-5 py-3 text-center font-black text-white"
                        >
                          Open in Store
                        </Link>

                        <button
                          type="button"
                          onClick={() =>
                            setOpenAlbumId(isOpen ? null : album.id)
                          }
                          className="rounded-2xl border border-violet-400/25 bg-violet-500/10 px-5 py-3 font-black text-violet-200"
                        >
                          {isOpen ? "Hide Tracks" : "View Tracks"}
                        </button>
                      </div>
                    </div>

                    {isOpen ? (
                      <div className="border-t border-white/10 bg-black/15 p-4 sm:p-5">
                        <div className="mb-4 grid gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/55 md:grid-cols-2">
                          <div>
                            <p className="font-black text-white/75">
                              Album preview
                            </p>
                            <p className="mt-1 break-all">
                              {album.albumPreview}
                            </p>
                          </div>

                          <div>
                            <p className="font-black text-white/75">
                              Cover path
                            </p>
                            <p className="mt-1 break-all">
                              {album.cover}
                            </p>
                          </div>
                        </div>

                        <div className="grid gap-3">
                          {album.tracks.map((track) => (
                            <div
                              key={track.id}
                              className="grid gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 md:grid-cols-[60px_1fr_auto] md:items-center"
                            >
                              <span className="text-lg font-black text-white/35">
                                {String(track.number).padStart(2, "0")}
                              </span>

                              <div className="min-w-0">
                                <p className="truncate font-black">
                                  {track.title}
                                </p>
                                <p className="mt-1 truncate text-xs text-white/35">
                                  {track.id}
                                </p>
                                <p className="mt-1 break-all text-xs text-white/25">
                                  {track.preview}
                                </p>
                              </div>

                              <span className="font-black">
                                {formatMoney(track.price)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </article>
                );
              })}
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
  value: number | string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
      <p className="text-sm text-white/50">{label}</p>
      <p className="mt-2 text-3xl font-black">{value}</p>
    </div>
  );
}
