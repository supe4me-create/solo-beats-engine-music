"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePlayer } from "./player/usePlayer";
import type { PlayerTrack } from "./player/types";
import { albums as storeAlbums } from "./store/albums";

type Album = {
  title: string;
  image: string;
  year?: string;
  tracks?: string;
  audio?: string;
  link?: string;
  genre?: string;
};


type SponsoredBusinessCampaign = {
  submissionId: string;
  businessName: string;
  campaignName: string;
  campaignGoal: string;
  headline: string;
  description: string;
  callToAction: string;
  businessWebsite: string | null;
  youtubeLink: string | null;
  imageUrl: string | null;
  videoUrl: string | null;
  sponsoredLabel: string;
};

type PromotedCampaign = {
  submissionId: string;
  artistName: string;
  songTitle: string;
  genre: string;
  description: string;
  socialLink: string | null;
  youtubeLink: string | null;
  artworkUrl: string | null;
  songUrl: string | null;
  sponsoredLabel: string;
};


const flagshipTracks: PlayerTrack[] = [
  {
    id: "bullet-carnage-fantasy",
    title: "Fantasy",
    artist: "Solo Beats",
    albumTitle: "Bullet Carnage",
    audio: "/previews/bullet-carnage/1 Fantasy.mp3",
    cover: "/covers/bullet-carnage.png",
  },
  {
    id: "bullet-carnage-neon-execution",
    title: "Neon Execution",
    artist: "Solo Beats",
    albumTitle: "Bullet Carnage",
    audio: "/previews/bullet-carnage/3 Neon Execution.mp3",
    cover: "/covers/bullet-carnage.png",
  },
  {
    id: "bullet-carnage-title-track",
    title: "Bullet Carnage",
    artist: "Solo Beats",
    albumTitle: "Bullet Carnage",
    audio: "/previews/bullet-carnage/7 Bullet Carnage.mp3",
    cover: "/covers/bullet-carnage.png",
  },
  {
    id: "bullet-carnage-terminal-erasure",
    title: "Terminal Erasure",
    artist: "Solo Beats",
    albumTitle: "Bullet Carnage",
    audio: "/previews/bullet-carnage/16 Terminal Erasure.mp3",
    cover: "/covers/bullet-carnage.png",
  },
];

const upcomingAlbums: Album[] = [
  {
    title: "Dark Horse",
    year: "2026",
    tracks: "20 Tracks",
    image: "/covers/darkhorse.png",
    audio: "/previews/darkhorse.mp3",
    link: "/albums/dark-horse",
    genre: "Complextro",
  },
  {
    title: "Bass King",
    year: "2026",
    tracks: "20 Tracks",
    image: "/covers/bassking.png",
    audio: "/previews/bassking.mp3",
    link: "/albums/bass-king",
    genre: "Electro House",
  },
  {
    title: "Zombie Bassline",
    year: "2026",
    tracks: "20 Tracks",
    image: "/covers/zombiebassline.png",
    audio: "/previews/zombiebassline.mp3",
    link: "/albums/zombie-bassline",
    genre: "Complextro",
  },
  {
    title: "A World Built on Sound",
    year: "2026",
    tracks: "20 Tracks",
    image: "/covers/aworldbuiltonsound.png",
    audio: "/previews/aworldbuiltonsound.mp3",
    link: "/albums/aworldbuiltonsound",
    genre: "Electronic",
  },
  {
    title: "Black Sea",
    year: "2026",
    tracks: "20 Tracks",
    image: "/covers/black-sea.png",
    audio: "/previews/18-black-sea.mp3",
    link: "/albums/black-sea",
    genre: "Complextro",
  },
];

const releasedAlbumBase: Album[] = [
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
    title: "Invincible",
    image: "/covers/Invincible-cover.jpg",
    audio: "/previews/invincible/Courageous Time 1.mp3",
    link: "/albums/invincible",
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
    title: "Full Speed",
    image: "/covers/fullspeed.jpg",
    genre: "Electro House",
  },
  {
    title: "Night Terror",
    image: "/covers/nightterror.jpg",
    audio: "/previews/nightterror.mp3",
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
    audio: "/previews/strangefeeling.mp3",
    genre: "Complextro",
  },
];

const releasedAlbums: Album[] = releasedAlbumBase.map((album) => { const match = storeAlbums.find((item) => item.title.toLowerCase().replace(/[^a-z0-9]/g, "") === album.title.toLowerCase().replace(/[^a-z0-9]/g, "")); return { ...album, audio: match?.albumPreview || album.audio, link: "/store", year: match ? String(match.year) : album.year, tracks: match ? `${match.tracks.length} Tracks` : album.tracks }; });

const ALBUMS_PER_PAGE = 8;

const genres = [
  "All Genres",
  ...Array.from(
    new Set(
      [...upcomingAlbums, ...releasedAlbums]
        .map((album) => album.genre)
        .filter((genre): genre is string => Boolean(genre))
    )
  ).sort((a, b) => a.localeCompare(b)),
];

function getYouTubeEmbedUrl(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    const videoId = url.hostname === "youtu.be"
      ? url.pathname.replace(/^\//, "").split("/")[0]
      : url.searchParams.get("v") || url.pathname.split("/").filter(Boolean).pop();
    return videoId ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}` : null;
  } catch {
    return null;
  }
}

export default function AlbumsPage() {
  const {
    currentTrack,
    isPlaying,
    playTrack,
    togglePlay,
  } = usePlayer();
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [selectedGenre, setSelectedGenre] = useState("All Genres");
  const [currentPage, setCurrentPage] = useState(1);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [favoritesLoaded, setFavoritesLoaded] = useState(false);
  const [promotedCampaigns, setPromotedCampaigns] = useState<PromotedCampaign[]>([]);
  const [promotionsLoading, setPromotionsLoading] = useState(true);
  const [businessCampaigns, setBusinessCampaigns] = useState<SponsoredBusinessCampaign[]>([]);
  const [businessCampaignsLoading, setBusinessCampaignsLoading] = useState(true);

  function sortAlbums(albums: Album[]) {
    const sortedAlbums = [...albums];

    if (sortBy === "oldest") {
      return sortedAlbums.reverse();
    }

    if (sortBy === "az") {
      return sortedAlbums.sort((a, b) => a.title.localeCompare(b.title));
    }

    if (sortBy === "za") {
      return sortedAlbums.sort((a, b) => b.title.localeCompare(a.title));
    }

    return sortedAlbums;
  }

  function filterAlbums(albums: Album[]) {
    const searchText = search.trim().toLowerCase();

    return sortAlbums(albums).filter((album) => {
      const matchesSearch = album.title.toLowerCase().includes(searchText);
      const matchesFavorites =
        !favoritesOnly || favorites.includes(album.title);
      const matchesGenre =
        selectedGenre === "All Genres" || album.genre === selectedGenre;

      return matchesSearch && matchesFavorites && matchesGenre;
    });
  }

  function toggleFavorite(albumTitle: string) {
    setFavorites((currentFavorites) => {
      if (currentFavorites.includes(albumTitle)) {
        return currentFavorites.filter((title) => title !== albumTitle);
      }

      return [...currentFavorites, albumTitle];
    });
  }

  function isFavorite(albumTitle: string) {
    return favorites.includes(albumTitle);
  }

  function createPreviewTrack(album: Album): PlayerTrack | null {
    if (!album.audio) {
      return null;
    }

    return {
      id: `album-preview-${album.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")}`,
      title: `${album.title} Preview`,
      artist: "Solo Beats",
      albumTitle: album.title,
      audio: album.audio,
      cover: album.image,
    };
  }

  function playPreview(album: Album) {
    const previewTrack = createPreviewTrack(album);

    if (!previewTrack) {
      return;
    }

    if (currentTrack?.id === previewTrack.id) {
      togglePlay();
      return;
    }

    playTrack(previewTrack);
  }

  const visibleUpcomingAlbums = filterAlbums(upcomingAlbums);
  const visibleReleasedAlbums = filterAlbums(releasedAlbums);
  const totalVisibleAlbums =
    visibleUpcomingAlbums.length + visibleReleasedAlbums.length;
  const totalPages = Math.max(
    1,
    Math.ceil(visibleReleasedAlbums.length / ALBUMS_PER_PAGE)
  );
  const firstAlbumIndex = (currentPage - 1) * ALBUMS_PER_PAGE;
  const lastAlbumIndex = firstAlbumIndex + ALBUMS_PER_PAGE;
  const paginatedReleasedAlbums = visibleReleasedAlbums.slice(
    firstAlbumIndex,
    lastAlbumIndex
  );
  const noResults = totalVisibleAlbums === 0;

  useEffect(() => {
    let cancelled = false;
    async function loadPromotions() {
      try {
        const response = await fetch("/api/promotions/active?placement=homepage", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error || "Promoted music could not be loaded.");
        if (!cancelled) setPromotedCampaigns(Array.isArray(data.promotions) ? data.promotions : []);
      } catch (error) {
        console.error("Homepage promotions could not be loaded:", error);
      } finally {
        if (!cancelled) setPromotionsLoading(false);
      }
    }
    void loadPromotions();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadBusinessCampaigns() {
      try {
        const response = await fetch(
          "/api/business-advertising/active?placement=homepage",
          { cache: "no-store" }
        );

        const contentType =
          response.headers.get("content-type") || "";

        if (!contentType.includes("application/json")) {
          throw new Error(
            "The business advertising service returned an invalid response."
          );
        }

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(
            data.error || "Sponsored business campaigns could not be loaded."
          );
        }

        if (!cancelled) {
          setBusinessCampaigns(
            Array.isArray(data.campaigns) ? data.campaigns : []
          );
        }
      } catch (error) {
        console.error("Homepage business advertising could not be loaded:", error);
      } finally {
        if (!cancelled) {
          setBusinessCampaignsLoading(false);
        }
      }
    }

    void loadBusinessCampaigns();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    try {
      const savedFavorites = window.localStorage.getItem(
        "solo-beats-favorites"
      );

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
  }, [search, sortBy, favoritesOnly, selectedGenre]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  function goToPage(pageNumber: number) {
    setCurrentPage(pageNumber);

    window.setTimeout(() => {
      document.getElementById("released-albums")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 0);
  }

  function clearFilters() {
    setSearch("");
    setFavoritesOnly(false);
    setSortBy("newest");
    setSelectedGenre("All Genres");
  }

  return (
    <main
      className="min-h-screen bg-black px-5 py-12 pb-40 text-white md:px-10"
    >

      <section className="mx-auto max-w-7xl"><section className="mb-14 overflow-hidden rounded-[2.5rem] border border-red-500/30"><img src="/covers/hero-home-final.png" alt="Solo Beats Engine Music" className="w-full object-cover" /></section>
        <h1 className="text-center text-4xl font-black md:text-6xl">
          SOLO BEATS ALBUMS
        </h1>

        <p className="mb-10 mt-4 text-center text-gray-400">
          Explore upcoming projects and the official Solo Beats catalog.
        </p>


        <section className="mb-14 overflow-hidden rounded-[2.5rem] border border-red-500/25 bg-gradient-to-br from-red-950 via-black to-zinc-950 p-6 shadow-2xl md:p-10">
          <div className="grid gap-8 lg:grid-cols-[420px_minmax(0,1fr)] lg:items-center">
            <img
              src="/covers/bullet-carnage.png"
              alt="Bullet Carnage album cover"
              className="aspect-square w-full rounded-[2rem] object-cover shadow-2xl shadow-red-950/60"
            />

            <div>
              <p className="text-sm font-black uppercase tracking-[0.28em] text-red-400">
                New Flagship Album
              </p>

              <h2 className="mt-3 text-5xl font-black md:text-7xl">
                Bullet Carnage
              </h2>

              <p className="mt-4 text-lg text-white/55">
                Upcoming • 20 Tracks • Solo Beats
              </p>

              <p className="mt-6 max-w-3xl text-lg leading-8 text-white/65">
                A devastating unreleased electronic album built with aggressive bass,
                dark futuristic energy, speed, and cinematic power. Preview four flagship tracks
                now, with additional exclusive tracks coming to Premium Radio and Premium TV.
              </p>

              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                {flagshipTracks.map((track) => {
                  const active = currentTrack?.id === track.id;
                  const playing = active && isPlaying;

                  return (
                    <button
                      key={track.id}
                      type="button"
                      onClick={() => {
                        if (active) {
                          togglePlay();
                        } else {
                          playTrack(track);
                        }
                      }}
                      className="rounded-2xl border border-red-400/20 bg-red-500/10 px-5 py-4 text-left transition hover:-translate-y-1 hover:border-red-400/50 hover:bg-red-500/20"
                    >
                      <span className="block text-xs font-black uppercase tracking-[0.18em] text-red-300">
                        Flagship Preview
                      </span>
                      <span className="mt-2 block text-xl font-black">
                        {track.title}
                      </span>
                      <span className="mt-1 block text-sm text-white/45">
                        {playing ? "Pause preview" : active ? "Resume preview" : "Play preview"}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  href="/premium"
                  className="rounded-2xl bg-white px-6 py-4 font-black text-black"
                >
                  Join Premium for Early Access
                </Link>

                <Link
                  href="/store"
                  className="rounded-2xl border border-white/15 bg-white/5 px-6 py-4 font-black"
                >
                  Explore the Store
                </Link>
              </div>
            </div>
          </div>
        </section>


        {(businessCampaignsLoading || businessCampaigns.length > 0) && (
          <section className="mb-14 rounded-[2rem] border border-cyan-300/20 bg-gradient-to-br from-cyan-700/20 via-zinc-950 to-violet-500/10 p-6 md:p-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.24em] text-cyan-300">
                  Sponsored Business
                </p>
                <h2 className="mt-2 text-3xl font-black md:text-4xl">
                  Featured Business Advertising
                </h2>
              </div>

              <Link
                href="/business-advertising"
                className="rounded-xl border border-white/15 bg-white/5 px-5 py-3 font-black"
              >
                Advertise Your Business
              </Link>
            </div>

            {businessCampaignsLoading ? (
              <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-8 text-center text-white/50">
                Loading sponsored businesses...
              </div>
            ) : (
              <div className="mt-6 grid gap-6">
                {businessCampaigns.map((campaign) => {
                  const embedUrl = getYouTubeEmbedUrl(campaign.youtubeLink);

                  return (
                    <article
                      key={campaign.submissionId}
                      className="overflow-hidden rounded-2xl border border-white/10 bg-black/25"
                    >
                      <div className="grid gap-6 p-5 lg:grid-cols-[300px_minmax(0,1fr)]">
                        <div>
                          {campaign.imageUrl ? (
                            <img
                              src={campaign.imageUrl}
                              alt={`${campaign.campaignName} advertisement`}
                              className="aspect-square w-full rounded-2xl object-cover"
                            />
                          ) : (
                            <div className="grid aspect-square place-items-center rounded-2xl border border-white/10 bg-zinc-900 text-center text-white/35">
                              Sponsored creative
                            </div>
                          )}
                        </div>

                        <div className="min-w-0">
                          <span className="inline-flex rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-cyan-100">
                            {campaign.sponsoredLabel || "Sponsored"}
                          </span>

                          <p className="mt-4 text-sm font-black uppercase tracking-[0.18em] text-emerald-300">
                            {campaign.businessName}
                          </p>

                          <h3 className="mt-2 text-4xl font-black">
                            {campaign.headline}
                          </h3>

                          <p className="mt-2 text-white/45">
                            {campaign.campaignName}
                          </p>

                          <p className="mt-5 max-w-3xl leading-7 text-white/60">
                            {campaign.description}
                          </p>

                          {embedUrl ? (
                            <div className="mt-6 aspect-video overflow-hidden rounded-2xl border border-white/10 bg-black">
                              <iframe
                                src={embedUrl}
                                title={`${campaign.campaignName} sponsored video`}
                                className="h-full w-full"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                allowFullScreen
                              />
                            </div>
                          ) : campaign.videoUrl ? (
                            <div className="mt-6 rounded-2xl border border-white/10 bg-zinc-950/70 p-4">
                              <p className="mb-3 text-xs font-black uppercase tracking-[0.16em] text-emerald-300">
                                Sponsored Video
                              </p>
                              <video
                                controls
                                preload="metadata"
                                src={campaign.videoUrl}
                                className="aspect-video w-full rounded-xl bg-black"
                              />
                            </div>
                          ) : null}

                          <div className="mt-6 flex flex-wrap gap-3">
                            {campaign.businessWebsite ? (
                              <a
                                href={campaign.businessWebsite}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-xl bg-white px-5 py-3 font-black text-black"
                              >
                                {campaign.callToAction || "Learn More"}
                              </a>
                            ) : null}

                            <Link
                              href="/business-advertising"
                              className="rounded-xl border border-white/15 bg-white/5 px-5 py-3 font-black"
                            >
                              Get Sponsored
                            </Link>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {(promotionsLoading || promotedCampaigns.length > 0) && (
          <section className="mb-14 rounded-[2rem] border border-fuchsia-400/20 bg-gradient-to-br from-fuchsia-700/20 via-zinc-950 to-cyan-500/10 p-6 md:p-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.24em] text-fuchsia-300">Promoted Music</p>
                <h2 className="mt-2 text-3xl font-black md:text-4xl">Featured Artist Promotions</h2>
              </div>
              <Link href="/artist-promotion" className="rounded-xl border border-white/15 bg-white/5 px-5 py-3 font-black">Promote Your Music</Link>
            </div>
            {promotionsLoading ? (
              <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-8 text-center text-white/50">Loading promoted music...</div>
            ) : (
              <div className="mt-6 grid gap-6">
                {promotedCampaigns.map((campaign) => {
                  const embedUrl = getYouTubeEmbedUrl(campaign.youtubeLink);
                  return (
                    <article key={campaign.submissionId} className="overflow-hidden rounded-2xl border border-white/10 bg-black/25">
                      <div className="grid gap-6 p-5 lg:grid-cols-[260px_minmax(0,1fr)]">
                        <div>{campaign.artworkUrl ? <img src={campaign.artworkUrl} alt={`${campaign.songTitle} artwork`} className="aspect-square w-full rounded-2xl object-cover" /> : <div className="grid aspect-square place-items-center rounded-2xl border border-white/10 bg-zinc-900 text-white/35">Artwork unavailable</div>}</div>
                        <div className="min-w-0">
                          <span className="inline-flex rounded-full border border-fuchsia-300/25 bg-fuchsia-300/10 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-fuchsia-200">{campaign.sponsoredLabel || "Promoted"}</span>
                          <p className="mt-4 text-sm font-black uppercase tracking-[0.18em] text-cyan-300">{campaign.artistName}</p>
                          <h3 className="mt-2 text-4xl font-black">{campaign.songTitle}</h3>
                          <p className="mt-2 text-white/45">{campaign.genre}</p>
                          <p className="mt-5 max-w-3xl leading-7 text-white/60">{campaign.description}</p>
                          {embedUrl ? (
                            <div className="mt-6 aspect-video overflow-hidden rounded-2xl border border-white/10 bg-black"><iframe src={embedUrl} title={`${campaign.songTitle} promotional video`} className="h-full w-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen /></div>
                          ) : campaign.songUrl ? (
                            <div className="mt-6 rounded-2xl border border-white/10 bg-zinc-950/70 p-4"><p className="mb-3 text-xs font-black uppercase tracking-[0.16em] text-emerald-300">Promoted Song</p><audio controls preload="metadata" src={campaign.songUrl} className="w-full" /></div>
                          ) : null}
                          <div className="mt-6 flex flex-wrap gap-3">
                            {campaign.socialLink ? <a href={campaign.socialLink} target="_blank" rel="noreferrer" className="rounded-xl bg-white px-5 py-3 font-black text-black">Visit Artist</a> : null}
                            <Link href="/artist-promotion" className="rounded-xl border border-white/15 bg-white/5 px-5 py-3 font-black">Get Featured</Link>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}

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

        <div className="mx-auto mb-6 max-w-5xl">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-fuchsia-400">
              Filter by genre
            </p>

            <p className="text-sm text-gray-500">
              {selectedGenre === "All Genres"
                ? "Showing every genre"
                : `Showing ${selectedGenre}`}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {genres.map((genre) => {
              const genreCount =
                genre === "All Genres"
                  ? [...upcomingAlbums, ...releasedAlbums].length
                  : [...upcomingAlbums, ...releasedAlbums].filter(
                      (album) => album.genre === genre
                    ).length;

              const active = selectedGenre === genre;

              return (
                <button
                  key={genre}
                  type="button"
                  onClick={() => setSelectedGenre(genre)}
                  className={`rounded-full border px-4 py-2 text-sm font-bold transition-all duration-300 ${
                    active
                      ? "border-fuchsia-500 bg-fuchsia-500 text-white shadow-lg shadow-fuchsia-500/25"
                      : "border-zinc-700 bg-zinc-900 text-gray-300 hover:border-fuchsia-500 hover:text-fuchsia-300"
                  }`}
                >
                  {genre} ({genreCount})
                </button>
              );
            })}
          </div>
        </div>

        <div className="mx-auto mb-14 flex max-w-5xl flex-wrap items-center justify-between gap-3 text-sm">
          <p className="text-gray-400">
            Showing{" "}
            <span className="font-bold text-white">{totalVisibleAlbums}</span>{" "}
            album{totalVisibleAlbums === 1 ? "" : "s"}
          </p>

          {(search || favoritesOnly || sortBy !== "newest" || selectedGenre !== "All Genres") && (
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
            <h2 className="text-2xl font-black">No albums found</h2>

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
                      currentTrack?.audio === album.audio && isPlaying;
                    const albumIsFavorite = isFavorite(album.title);

                    return (
                      <article
                        key={album.title}
                        className="group relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-xl transition-all duration-300 ease-out hover:-translate-y-3 hover:scale-[1.02] hover:border-fuchsia-500 hover:shadow-[0_22px_55px_rgba(217,70,239,0.28)]"
                      >
                        <button
                          type="button"
                          onClick={() => toggleFavorite(album.title)}
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
                          Upcoming Album • Solo Beats
                        </p>

                        <p className="mt-1 text-sm text-gray-500">
                          {album.year} • {album.tracks}
                        </p>

                        <button
                          type="button"
                          onClick={() => playPreview(album)}
                          className="mt-5 w-full rounded-xl bg-fuchsia-600 py-3 font-bold transition-all duration-300 hover:-translate-y-1 hover:bg-fuchsia-700 hover:shadow-lg hover:shadow-fuchsia-500/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-300"
                        >
                          {albumIsPlaying ? "Pause Preview" : "Play Preview"}
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
              <section id="released-albums" className="scroll-mt-8">
                <div className="mb-8">
                  <p className="font-bold uppercase tracking-[0.3em] text-fuchsia-500">
                    Official Catalog
                  </p>

                  <h2 className="mt-2 text-3xl font-black md:text-4xl">
                    Released Albums
                  </h2>

                  <p className="mt-3 max-w-2xl text-gray-400">
                    Browse officially released Solo Beats albums and listen to
                    available previews.
                  </p>
                </div>

                <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {paginatedReleasedAlbums.map((album) => {
                    const albumIsFavorite = isFavorite(album.title);
                    const albumIsPlaying =
                      currentTrack?.audio === album.audio && isPlaying;

                    return (
                      <article
                        key={album.title}
                        className="group relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-xl transition-all duration-300 ease-out hover:-translate-y-3 hover:scale-[1.02] hover:border-fuchsia-500 hover:shadow-[0_22px_55px_rgba(217,70,239,0.28)]"
                      >
                        <button
                          type="button"
                          onClick={() => toggleFavorite(album.title)}
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
                            <Link href={album.link}>
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
                          Released Album • Solo Beats
                        </p>

                        <div className="mt-5 grid grid-cols-2 gap-3">
                          {album.audio ? (
                            <button
                              type="button"
                              onClick={() => playPreview(album)}
                              className="rounded-xl bg-fuchsia-600 py-3 font-bold transition-all duration-300 hover:-translate-y-1 hover:bg-fuchsia-700 hover:shadow-lg hover:shadow-fuchsia-500/30"
                            >
                              {albumIsPlaying ? "Pause" : "Listen"}
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled
                              className="cursor-not-allowed rounded-xl bg-fuchsia-600/50 py-3 font-bold text-white/70"
                            >
                              Listen
                            </button>
                          )}

                          {album.link ? (
                            <Link
                              href={album.link}
                              className="rounded-xl border border-fuchsia-500 py-3 text-center font-bold transition-all duration-300 hover:-translate-y-1 hover:bg-fuchsia-500 hover:shadow-lg hover:shadow-fuchsia-500/30"
                            >
                              Buy
                            </Link>
                          ) : (
                            <button
                              type="button"
                              disabled
                              className="cursor-not-allowed rounded-xl border border-fuchsia-500/50 py-3 font-bold text-white/60"
                            >
                              Buy
                            </button>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>

                {totalPages > 1 && (
                  <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => goToPage(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="rounded-xl border border-zinc-700 px-5 py-3 font-bold transition-all duration-300 hover:-translate-y-1 hover:border-fuchsia-500 hover:bg-fuchsia-500 hover:shadow-lg hover:shadow-fuchsia-500/20 disabled:cursor-not-allowed disabled:opacity-40"
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
                        onClick={() => goToPage(pageNumber)}
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
                      onClick={() => goToPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="rounded-xl border border-zinc-700 px-5 py-3 font-bold transition-all duration-300 hover:-translate-y-1 hover:border-fuchsia-500 hover:bg-fuchsia-500 hover:shadow-lg hover:shadow-fuchsia-500/20 disabled:cursor-not-allowed disabled:opacity-40"
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

    </main>
  );
}















