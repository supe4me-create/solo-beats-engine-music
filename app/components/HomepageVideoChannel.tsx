"use client";

import { useEffect, useState } from "react";

type HomepageVideo = {
  mediaId: string;
  title: string;
  description: string;
  sourceType: string;
  featured: boolean;
  displayOrder: number;
  videoUrl: string;
};

export default function HomepageVideoChannel() {
  const [videos, setVideos] =
    useState<HomepageVideo[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadVideos() {
      try {
        const response = await fetch(
          "/api/videos/homepage",
          {
            cache: "no-store",
          }
        );

        const contentType =
          response.headers.get(
            "content-type"
          ) || "";

        if (
          !contentType.includes(
            "application/json"
          )
        ) {
          throw new Error(
            "Homepage video service returned an invalid response."
          );
        }

        const data =
          await response.json();

        if (
          !response.ok ||
          !data.success
        ) {
          throw new Error(
            data.error ||
              "Homepage videos could not be loaded."
          );
        }

        if (!cancelled) {
          setVideos(
            Array.isArray(data.videos)
              ? data.videos
              : []
          );
        }
      } catch (loadError) {
        console.error(
          "Homepage videos could not be loaded:",
          loadError
        );

        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Homepage videos could not be loaded."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadVideos();

    return () => {
      cancelled = true;
    };
  }, []);

  if (
    !loading &&
    videos.length === 0
  ) {
    return null;
  }

  return (
    <section className="mb-14 overflow-hidden rounded-[2.5rem] border border-violet-400/20 bg-gradient-to-br from-violet-950/70 via-zinc-950 to-cyan-950/40 p-5 shadow-2xl md:p-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.24em] text-fuchsia-300">
            SOLO BEATS VIDEO
          </p>

          <h2 className="mt-2 text-3xl font-black md:text-4xl">
            Video Channel
          </h2>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/50">
            Official SOLO BEATS videos, featured music,
            artist showcases, and selected platform content.
          </p>
        </div>

        <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-white/50">
          {loading
            ? "Loading"
            : `${videos.length} ${
                videos.length === 1
                  ? "Video"
                  : "Videos"
              }`}
        </div>
      </div>

      {loading ? (
        <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-6 text-center text-sm text-white/45">
          Loading SOLO BEATS Video Channel...
        </div>
      ) : error ? (
        <div className="mt-5 rounded-2xl border border-red-300/15 bg-red-400/5 p-5 text-sm text-red-100/60">
          Video Channel is temporarily unavailable.
        </div>
      ) : (
        <div
          className={`mt-6 grid gap-5 ${
            videos.length === 1
              ? "mx-auto max-w-4xl"
              : videos.length === 2
                ? "md:grid-cols-2"
                : "md:grid-cols-2 xl:grid-cols-3"
          }`}
        >
          {videos
            .slice(0, 6)
            .map((video) => (
              <article
                key={video.mediaId}
                className="overflow-hidden rounded-2xl border border-white/10 bg-black/35"
              >
                <div className="relative bg-black">
                  <video
                    src={video.videoUrl}
                    controls
                    playsInline
                    preload="metadata"
                    className="aspect-video w-full bg-black object-contain"
                  />

                  {video.featured ? (
                    <span className="absolute left-3 top-3 rounded-full border border-yellow-300/30 bg-black/75 px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-yellow-200 backdrop-blur">
                      Featured
                    </span>
                  ) : null}
                </div>

                <div className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate text-lg font-black">
                        {video.title}
                      </h3>

                      {video.description ? (
                        <p className="mt-1 line-clamp-2 text-sm leading-6 text-white/50">
                          {video.description}
                        </p>
                      ) : null}
                    </div>

                    <span className="rounded-full border border-violet-300/15 bg-violet-400/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-violet-200">
                      {video.sourceType ===
                      "solo-beats"
                        ? "SOLO BEATS"
                        : video.sourceType}
                    </span>
                  </div>
                </div>
              </article>
            ))}
        </div>
      )}
    </section>
  );
}
