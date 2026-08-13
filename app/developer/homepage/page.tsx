"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useState,
} from "react";

type HomepageVideo = {
  mediaId: string;
  title: string;
  description: string;
  sourceType: string;
  videoSource: "upload" | "youtube";
  youtubeEmbedUrl: string | null;
  videoUrl: string | null;
  featured: boolean;
  displayOrder: number;
};

type FlagshipAlbum = {
  id: string;
  albumId: string;
  title: string;
  artist: string;
  year: number;
  genre: string;
  description: string;
  status: "released" | "upcoming";
  publishStatus: "published" | "draft";
  isFlagship: boolean;
  accessType: "standard" | "premium";
  cover: string | null;
  coverUrl: string | null;
  pageLink: string;
  trackCount: number;
};

export default function HomepageManagerPage() {
  const [videos, setVideos] =
    useState<HomepageVideo[]>([]);

  const [flagship, setFlagship] =
    useState<FlagshipAlbum | null>(null);

  const [catalogAlbums, setCatalogAlbums] =
    useState<FlagshipAlbum[]>([]);

  const [businessCampaignCount, setBusinessCampaignCount] =
    useState(0);

  const [artistPromotionCount, setArtistPromotionCount] =
    useState(0);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const loadHomepage = useCallback(
    async () => {
      setLoading(true);
      setError("");

      try {
        const [
          videosResponse,
          albumsResponse,
          businessResponse,
          promotionsResponse,
        ] = await Promise.all([
          fetch(
            "/api/videos/homepage",
            {
              cache: "no-store",
            }
          ),
          fetch(
            "/api/catalog/albums?includeFlagshipDraft=1",
            {
              cache: "no-store",
            }
          ),
          fetch(
            "/api/business-advertising/active?placement=homepage",
            {
              cache: "no-store",
            }
          ),
          fetch(
            "/api/promotions/active?placement=homepage",
            {
              cache: "no-store",
            }
          ),
        ]);

        const videosData =
          await videosResponse.json();

        const albumsData =
          await albumsResponse.json();

        const businessData =
          await businessResponse.json();

        const promotionsData =
          await promotionsResponse.json();

        if (
          !videosResponse.ok ||
          !videosData.success
        ) {
          throw new Error(
            videosData.error ||
              "Homepage videos could not be loaded."
          );
        }

        if (
          !albumsResponse.ok ||
          !albumsData.success
        ) {
          throw new Error(
            albumsData.error ||
              "Homepage flagship could not be loaded."
          );
        }
        if (
          !businessResponse.ok ||
          !businessData.success
        ) {
          throw new Error(
            businessData.error ||
              "Homepage business campaigns could not be loaded."
          );
        }

        if (
          !promotionsResponse.ok ||
          !promotionsData.success
        ) {
          throw new Error(
            promotionsData.error ||
              "Homepage artist promotions could not be loaded."
          );
        }

        const nextVideos =
          Array.isArray(
            videosData.videos
          )
            ? videosData.videos
            : [];

        const albums =
          Array.isArray(
            albumsData.albums
          )
            ? albumsData.albums
            : [];

        setVideos(nextVideos);

        setCatalogAlbums(albums);

        setBusinessCampaignCount(
          Array.isArray(businessData.campaigns)
            ? businessData.campaigns.length
            : 0
        );

        setArtistPromotionCount(
          Array.isArray(promotionsData.promotions)
            ? promotionsData.promotions.length
            : 0
        );

        setFlagship(
          albums.find(
            (
              album: FlagshipAlbum
            ) =>
              album.isFlagship ===
              true
          ) || null
        );
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Homepage Manager could not be loaded."
        );
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    void loadHomepage();
  }, [loadHomepage]);
  const upcomingAlbums = catalogAlbums.filter(
    (album) => album.status === "upcoming"
  );

  const releasedAlbums = catalogAlbums.filter(
    (album) => album.status === "released"
  );

  return (
    <main className="min-h-screen bg-[#06070a] px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <section className="rounded-[2rem] border border-violet-300/20 bg-gradient-to-br from-violet-500/20 via-black to-cyan-500/10 p-6 shadow-2xl sm:p-9">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-violet-300">
                SOLO BEATS Owner Control
              </p>

              <h1 className="mt-2 text-4xl font-black sm:text-5xl">
                Homepage Manager
              </h1>

              <p className="mt-3 max-w-3xl text-white/55">
                Preview and manage the same content that visitors see on the public homepage.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() =>
                  void loadHomepage()
                }
                className="rounded-2xl border border-white/15 bg-white/5 px-5 py-3 font-black"
              >
                Refresh
              </button>

              <Link
                href="/"
                className="rounded-2xl bg-white px-5 py-3 font-black text-black"
              >
                Open Public Homepage
              </Link>

              <Link
                href="/developer"
                className="rounded-2xl border border-violet-300/25 bg-violet-300/10 px-5 py-3 font-black text-violet-100"
              >
                Control Center
              </Link>
            </div>
          </div>
        </section>

        {error ? (
          <section className="mt-6 rounded-2xl border border-red-300/20 bg-red-400/10 p-5 font-bold text-red-200">
            {error}
          </section>
        ) : null}

        <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            [
              "Homepage Videos",
              loading
                ? "..."
                : videos.length,
            ],
            [
              "Featured Videos",
              loading
                ? "..."
                : videos.filter(
                    (video) =>
                      video.featured
                  ).length,
            ],
            [
              "Flagship",
              loading
                ? "..."
                : flagship
                  ? "Live"
                  : "None",
            ],
            [
              "Homepage Status",
              error
                ? "Error"
                : loading
                  ? "Loading"
                  : "Online",
            ],
          ].map(
            ([label, value]) => (
              <div
                key={String(label)}
                className="rounded-2xl border border-white/10 bg-white/[0.035] p-5"
              >
                <p className="text-xs font-black uppercase tracking-[0.16em] text-white/40">
                  {label}
                </p>

                <p className="mt-2 text-3xl font-black">
                  {value}
                </p>
              </div>
            )
          )}
        </section>

        <section className="mt-8 rounded-[2rem] border border-white/10 bg-white/[0.035] p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
                Section 1
              </p>

              <h2 className="mt-2 text-3xl font-black">
                Hero
              </h2>
            </div>

            <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-xs font-black uppercase text-emerald-200">
              Live
            </span>
          </div>

          <img
            src="/covers/hero-home-final.png"
            alt="SOLO BEATS homepage hero"
            className="mt-6 w-full rounded-2xl border border-white/10 object-cover"
          />
        </section>

        <section className="mt-8 rounded-[2rem] border border-fuchsia-300/20 bg-fuchsia-400/5 p-6 sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-fuchsia-300">
            Section 2
          </p>

          <h2 className="mt-2 text-3xl font-black">
            Now Launched
          </h2>

          <p className="mt-3 text-white/55">
            Artist Promotion, Business Advertising, and Premium TV Promotion are live on the public homepage.
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/artist-promotion"
              className="rounded-xl bg-fuchsia-500 px-4 py-3 font-black"
            >
              Artist Promotion
            </Link>

            <Link
              href="/business-advertising"
              className="rounded-xl bg-cyan-300 px-4 py-3 font-black text-black"
            >
              Business Advertising
            </Link>
          </div>
        </section>

        <section className="mt-8 rounded-[2rem] border border-violet-300/20 bg-violet-400/5 p-6 sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-300">
                Section 3
              </p>

              <h2 className="mt-2 text-3xl font-black">
                Homepage Video Channel
              </h2>

              <p className="mt-2 text-white/50">
                This is the live public ordering returned by the Homepage Video API.
              </p>
            </div>

            <Link
              href="/developer/videos"
              className="rounded-xl border border-violet-300/25 bg-violet-300/10 px-4 py-3 font-black text-violet-100"
            >
              Manage Videos
            </Link>
          </div>

          {loading ? (
            <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-8 text-center text-white/45">
              Loading homepage videos...
            </div>
          ) : videos.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-8 text-center text-white/45">
              No homepage videos are currently live.
            </div>
          ) : (
            <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {videos.map(
                (video, index) => (
                  <article
                    key={
                      video.mediaId
                    }
                    className="overflow-hidden rounded-2xl border border-white/10 bg-black/35"
                  >
                    <div className="relative bg-black">
                      {video.youtubeEmbedUrl ? (
                        <iframe
                          src={
                            video.youtubeEmbedUrl
                          }
                          title={
                            video.title
                          }
                          className="aspect-video w-full"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                          allowFullScreen
                        />
                      ) : video.videoUrl ? (
                        <video
                          src={
                            video.videoUrl
                          }
                          controls
                          playsInline
                          preload="metadata"
                          className="aspect-video w-full bg-black object-contain"
                        />
                      ) : null}

                      <span className="absolute left-3 top-3 rounded-full border border-white/15 bg-black/75 px-3 py-1 text-[10px] font-black uppercase">
                        Position{" "}
                        {index + 1}
                      </span>
                    </div>

                    <div className="p-4">
                      <h3 className="text-lg font-black">
                        {
                          video.title
                        }
                      </h3>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold">
                          Order{" "}
                          {
                            video.displayOrder
                          }
                        </span>

                        {video.featured ? (
                          <span className="rounded-full border border-yellow-300/20 bg-yellow-300/10 px-3 py-1 text-xs font-black text-yellow-200">
                            Featured
                          </span>
                        ) : (
                          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/45">
                            Standard
                          </span>
                        )}
                      </div>
                    </div>
                  </article>
                )
              )}
            </div>
          )}
        </section>

        <section className="mt-8 rounded-[2rem] border border-red-300/20 bg-red-500/5 p-6 sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-red-300">
                Section 4
              </p>

              <h2 className="mt-2 text-3xl font-black">
                Flagship Album
              </h2>
            </div>

            <Link
              href="/developer/albums"
              className="rounded-xl border border-red-300/25 bg-red-300/10 px-4 py-3 font-black text-red-100"
            >
              Manage Albums
            </Link>
          </div>

          {loading ? (
            <div className="mt-6 text-white/45">
              Loading flagship...
            </div>
          ) : flagship ? (
            <div className="mt-6 grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:items-center">
              <img
                src={
                  flagship.coverUrl ||
                  flagship.cover ||
                  "/covers/bullet-carnage.png"
                }
                alt={`${flagship.title} cover`}
                className="aspect-square w-full rounded-2xl object-cover"
              />

              <div>
                <p className="text-sm font-black uppercase tracking-[0.18em] text-red-300">
                  Current Homepage Flagship
                </p>

                <h3 className="mt-2 text-4xl font-black">
                  {flagship.title}
                </h3>

                <p className="mt-2 text-white/50">
                  {flagship.artist}
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold">
                    {flagship.status}
                  </span>

                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold">
                    {
                      flagship.publishStatus
                    }
                  </span>

                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold">
                    {
                      flagship.trackCount
                    }{" "}
                    Tracks
                  </span>
                </div>

                <p className="mt-5 max-w-3xl leading-7 text-white/55">
                  {
                    flagship.description
                  }
                </p>
              </div>
            </div>
          ) : (
            <div className="mt-6 rounded-2xl border border-yellow-300/20 bg-yellow-300/10 p-5 text-yellow-100">
              No flagship album is currently selected.
            </div>
          )}
        </section>

        <section className="mt-8 grid gap-5 md:grid-cols-2">
          <div className="rounded-[2rem] border border-cyan-300/20 bg-cyan-400/5 p-6">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">
              Live Homepage Status
            </p>

            <h2 className="mt-2 text-2xl font-black">
              Business Advertising
            </h2>

            <p className="mt-3 text-white/50">
              {loading ? "Checking active sponsored campaigns..." : `${businessCampaignCount} sponsored business campaign${businessCampaignCount === 1 ? "" : "s"} currently live on the homepage.`}
            </p>

            <Link
              href="/developer/business-advertising"
              className="mt-5 inline-flex rounded-xl bg-cyan-300 px-4 py-3 font-black text-black"
            >
              Manage Advertising
            </Link>
          </div>

          <div className="rounded-[2rem] border border-fuchsia-300/20 bg-fuchsia-400/5 p-6">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-fuchsia-300">
              Live Homepage Status
            </p>

            <h2 className="mt-2 text-2xl font-black">
              Artist Promotions
            </h2>

            <p className="mt-3 text-white/50">
              {loading ? "Checking active artist promotions..." : `${artistPromotionCount} promoted artist campaign${artistPromotionCount === 1 ? "" : "s"} currently live on the homepage.`}
            </p>

            <Link
              href="/developer/artist-promotion"
              className="mt-5 inline-flex rounded-xl bg-fuchsia-500 px-4 py-3 font-black"
            >
              Manage Promotions
            </Link>
          </div>
        </section>

        <section className="mt-8 rounded-[2rem] border border-white/10 bg-white/[0.035] p-6 sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-white/45">
                Live Catalog
              </p>

              <h2 className="mt-2 text-3xl font-black">
                Album Sections
              </h2>

              <p className="mt-3 text-white/50">
                Live album counts from the same catalog powering the public homepage.
              </p>
            </div>

            <Link
              href="/developer/albums"
              className="rounded-xl bg-white px-4 py-3 font-black text-black"
            >
              Open Album Manager
            </Link>
          </div>

          <div className="mt-7 grid gap-5 md:grid-cols-2">
            <div className="rounded-2xl border border-violet-300/20 bg-violet-400/5 p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-violet-300">
                    Upcoming Releases
                  </p>

                  <p className="mt-2 text-4xl font-black">
                    {upcomingAlbums.length}
                  </p>
                </div>

                <span className="rounded-full border border-violet-300/20 bg-violet-300/10 px-3 py-1 text-xs font-black text-violet-100">
                  UPCOMING
                </span>
              </div>

              <div className="mt-5 space-y-2">
                {upcomingAlbums.slice(0, 4).map((album) => (
                  <div
                    key={album.albumId}
                    className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3"
                  >
                    <span className="min-w-0 truncate font-bold">
                      {album.title}
                    </span>

                    <span className="shrink-0 text-xs font-black uppercase text-white/40">
                      {album.publishStatus}
                    </span>
                  </div>
                ))}

                {upcomingAlbums.length === 0 ? (
                  <p className="text-sm text-white/40">
                    No upcoming releases.
                  </p>
                ) : null}
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-300/20 bg-emerald-400/5 p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-300">
                    Released Albums
                  </p>

                  <p className="mt-2 text-4xl font-black">
                    {releasedAlbums.length}
                  </p>
                </div>

                <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-xs font-black text-emerald-100">
                  RELEASED
                </span>
              </div>

              <div className="mt-5 space-y-2">
                {releasedAlbums.slice(0, 4).map((album) => (
                  <div
                    key={album.albumId}
                    className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3"
                  >
                    <span className="min-w-0 truncate font-bold">
                      {album.title}
                    </span>

                    <span className="shrink-0 text-xs font-black uppercase text-white/40">
                      {album.trackCount} Tracks
                    </span>
                  </div>
                ))}

                {releasedAlbums.length === 0 ? (
                  <p className="text-sm text-white/40">
                    No released albums.
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}



