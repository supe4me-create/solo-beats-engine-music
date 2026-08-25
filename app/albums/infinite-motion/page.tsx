"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type AnyRecord = Record<string, any>;

type Track = {
  id: string;
  number: number;
  title: string;
  mediaId?: string;
  storagePath?: string;
  previewUrl?: string;
  price: number;
};

type Album = {
  id: string;
  title: string;
  artist: string;
  year: number;
  genre: string;
  description: string;
  coverUrl?: string;
  coverStoragePath?: string;
  pageLink: string;
  price: number;
  trackPrice: number;
  trackCount: number;
  isFlagship: boolean;
  tracks: Track[];
};

const FALLBACK_TRACKS: Track[] = [
  { id: "saber", number: 1, title: "Saber", price: 1 },
  { id: "club-neon", number: 2, title: "Club Neon", price: 1 },
  {
    id: "red-wave",
    number: 3,
    title: "Red Wave",
    mediaId: "R2y3I5oiJM9pnPH03OlR",
    storagePath: "media/audio/R2y3I5oiJM9pnPH03OlR/3-Red-Wave.wav",
    price: 1,
  },
  { id: "infinite-motion", number: 4, title: "Infinite Motion", price: 1 },
  { id: "chasing-lights", number: 5, title: "Chasing Lights", price: 1 },
  {
    id: "paper-planes",
    number: 6,
    title: "Paper Planes",
    mediaId: "NT3FW1TqfUhh5NLtSGxO",
    storagePath: "media/audio/NT3FW1TqfUhh5NLtSGxO/6-Paper-Planes.wav",
    price: 1,
  },
  {
    id: "daydream-engine",
    number: 7,
    title: "Daydream Engine",
    mediaId: "2VLSoKcXsxweiFnaZSUo",
    storagePath:
      "media/audio/2VLSoKcXsxweiFnaZSUo/7-Daydream-Engine.wav",
    price: 1,
  },
  { id: "midnight-gold", number: 8, title: "Midnight Gold", price: 1 },
  { id: "color-theory", number: 9, title: "Color Theory", price: 1 },
  { id: "first-light", number: 10, title: "First Light", price: 1 },
  { id: "second-nature", number: 11, title: "Second Nature", price: 1 },
  { id: "still-rising", number: 12, title: "Still Rising", price: 1 },
  { id: "next-chapter", number: 13, title: "Next Chapter", price: 1 },
  { id: "a-place-beyond", number: 14, title: "A Place Beyond", price: 1 },
  { id: "endless-blue", number: 15, title: "Endless Blue", price: 1 },
  {
    id: "cybermelon-shockwave",
    number: 16,
    title: "Cybermelon Shockwave",
    price: 1,
  },
  { id: "better-days", number: 17, title: "Better Days", price: 1 },
  { id: "the-last-sunset", number: 18, title: "The Last Sunset", price: 1 },
  { id: "oceans-of-sky", number: 19, title: "Oceans of Sky", price: 1 },
  { id: "ever-forward", number: 20, title: "Ever Forward", price: 1 },
];

const PUBLIC_PREVIEW_MEDIA_IDS = new Set([
  "R2y3I5oiJM9pnPH03OlR",
  "NT3FW1TqfUhh5NLtSGxO",
  "2VLSoKcXsxweiFnaZSUo",
]);

function isPublicPreviewTrack(track: Track): boolean {
  return Boolean(
    track.mediaId &&
      PUBLIC_PREVIEW_MEDIA_IDS.has(track.mediaId)
  );
}

const FALLBACK_ALBUM: Album = {
  id: "infinite-motion",
  title: "Infinite Motion",
  artist: "Solo Beats",
  year: 2026,
  genre: "Electronic",
  description:
    "Infinite Motion is a high-energy electronic album built around relentless momentum, futuristic textures, deep bass, and cinematic intensity. Each track pushes forward with powerful rhythms, evolving synths, and a sense of constant movement, creating a sound designed for driving, gaming, workouts, and late-night energy.",
  coverStoragePath: "media/image/6SyVkuVJM0yubVFDIoHn/cover.png",
  pageLink: "/albums/infinite-motion",
  price: 20,
  trackPrice: 1,
  trackCount: 20,
  isFlagship: true,
  tracks: FALLBACK_TRACKS,
};

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function numberValue(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function pickUrl(obj: AnyRecord): string {
  return (
    text(obj.previewUrl) ||
    text(obj.audioUrl) ||
    text(obj.playUrl) ||
    text(obj.signedUrl) ||
    text(obj.downloadUrl) ||
    text(obj.url)
  );
}

function normalizeTrack(raw: AnyRecord, index: number): Track {
  const fallback = FALLBACK_TRACKS[index];

  return {
    id:
      text(raw.id) ||
      text(raw.trackId) ||
      text(raw.mediaId) ||
      fallback?.id ||
      `track-${index + 1}`,
    number: numberValue(
      raw.number ?? raw.trackNumber ?? raw.trackNo,
      fallback?.number ?? index + 1
    ),
    title:
      text(raw.title) ||
      text(raw.name) ||
      fallback?.title ||
      `Track ${index + 1}`,
    mediaId: text(raw.mediaId) || fallback?.mediaId || undefined,
    storagePath:
      text(raw.storagePath) ||
      text(raw.audioStoragePath) ||
      fallback?.storagePath ||
      undefined,
    previewUrl: pickUrl(raw) || fallback?.previewUrl || undefined,
    price: numberValue(raw.price ?? raw.trackPrice, 1),
  };
}

function findAlbumPayload(payload: any): AnyRecord | null {
  const pools: any[] = [];

  if (Array.isArray(payload)) pools.push(payload);
  if (Array.isArray(payload?.albums)) pools.push(payload.albums);
  if (Array.isArray(payload?.data)) pools.push(payload.data);
  if (Array.isArray(payload?.items)) pools.push(payload.items);

  if (payload?.album && typeof payload.album === "object") {
    pools.push([payload.album]);
  }

  for (const pool of pools) {
    const match = pool.find((item: AnyRecord) => {
      const id = text(item?.id || item?.albumId || item?.slug).toLowerCase();
      const title = text(item?.title).toLowerCase();
      const link = text(item?.pageLink || item?.href).toLowerCase();

      return (
        id === "infinite-motion" ||
        title === "infinite motion" ||
        link === "/albums/infinite-motion"
      );
    });

    if (match) return match;
  }

  return null;
}

function normalizeAlbum(raw: AnyRecord): Album {
  const rawTracks = Array.isArray(raw.tracks) ? raw.tracks : [];

  const tracks =
    rawTracks.length > 0
      ? rawTracks
          .map((track: AnyRecord, index: number) =>
            normalizeTrack(track, index)
          )
          .sort((a: Track, b: Track) => a.number - b.number)
      : FALLBACK_TRACKS;

  return {
    id: text(raw.id || raw.albumId || raw.slug) || FALLBACK_ALBUM.id,
    title: text(raw.title) || FALLBACK_ALBUM.title,
    artist: text(raw.artist) || FALLBACK_ALBUM.artist,
    year: numberValue(raw.year, FALLBACK_ALBUM.year),
    genre: text(raw.genre) || FALLBACK_ALBUM.genre,
    description: text(raw.description) || FALLBACK_ALBUM.description,
    coverUrl:
      text(raw.coverUrl) ||
      text(raw.coverSignedUrl) ||
      text(raw.imageUrl) ||
      text(raw.artworkUrl) ||
      undefined,
    coverStoragePath:
      text(raw.coverStoragePath) || FALLBACK_ALBUM.coverStoragePath,
    pageLink:
      text(raw.pageLink || raw.href) || FALLBACK_ALBUM.pageLink,
    price: numberValue(
      raw.price ?? raw.albumPrice,
      FALLBACK_ALBUM.price
    ),
    trackPrice: numberValue(raw.trackPrice, FALLBACK_ALBUM.trackPrice),
    trackCount: numberValue(raw.trackCount, tracks.length),
    isFlagship:
      typeof raw.isFlagship === "boolean"
        ? raw.isFlagship
        : FALLBACK_ALBUM.isFlagship,
    tracks,
  };
}

export default function InfiniteMotionPage() {
  const [album, setAlbum] = useState<Album>(FALLBACK_ALBUM);
  const [loading, setLoading] = useState(true);
  const [currentTrack, setCurrentTrack] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadAlbum() {
      try {
        const response = await fetch("/api/catalog/albums", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`Catalog request failed: ${response.status}`);
        }

        const payload = await response.json();
        const found = findAlbumPayload(payload);

        if (found && !cancelled) {
          setAlbum(normalizeAlbum(found));
        }
      } catch (error) {
        console.error("Infinite Motion catalog load:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadAlbum();

    return () => {
      cancelled = true;
    };
  }, []);

  const playableCount = useMemo(
    () =>
      album.tracks.filter(
        (track) =>
          Boolean(track.previewUrl) &&
          isPublicPreviewTrack(track)
      ).length,
    [album.tracks]
  );

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top, #18253f 0%, #070a10 42%, #020305 100%)",
        color: "#fff",
        padding: "32px 18px 80px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 1120,
          margin: "0 auto",
        }}
      >
        <Link
          href="/"
          style={{
            color: "#9fb8ff",
            textDecoration: "none",
            fontWeight: 700,
          }}
        >
           SOLO BEATS ENGINE MUSIC
        </Link>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 32,
            marginTop: 28,
            alignItems: "center",
          }}
        >
          <div>
            {album.coverUrl ? (
              <img
                src={album.coverUrl}
                alt="Infinite Motion by Solo Beats"
                style={{
                  width: "100%",
                  maxWidth: 500,
                  aspectRatio: "1 / 1",
                  objectFit: "cover",
                  borderRadius: 20,
                  boxShadow: "0 28px 80px rgba(0,0,0,.45)",
                }}
              />
            ) : (
              <div
                style={{
                  width: "100%",
                  maxWidth: 500,
                  aspectRatio: "1 / 1",
                  borderRadius: 20,
                  display: "grid",
                  placeItems: "center",
                  textAlign: "center",
                  padding: 30,
                  background:
                    "linear-gradient(135deg,#18233c,#45227a,#d04a70)",
                  boxShadow: "0 28px 80px rgba(0,0,0,.45)",
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 38,
                      fontWeight: 900,
                      letterSpacing: 2,
                    }}
                  >
                    INFINITE MOTION
                  </div>
                  <div style={{ marginTop: 12, opacity: 0.85 }}>
                    SOLO BEATS
                  </div>
                </div>
              </div>
            )}
          </div>

          <div>
            {album.isFlagship && (
              <div
                style={{
                  display: "inline-block",
                  padding: "7px 12px",
                  borderRadius: 999,
                  background: "#ffffff14",
                  border: "1px solid #ffffff25",
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: 1.5,
                }}
              >
                FLAGSHIP ALBUM
              </div>
            )}

            <h1
              style={{
                fontSize: "clamp(42px,7vw,78px)",
                lineHeight: 0.95,
                margin: "18px 0 12px",
                letterSpacing: -3,
              }}
            >
              {album.title}
            </h1>

            <div
              style={{
                fontSize: 20,
                fontWeight: 700,
                color: "#c6d4ff",
              }}
            >
              {album.artist}
            </div>

            <div
              style={{
                marginTop: 12,
                opacity: 0.72,
                fontWeight: 600,
              }}
            >
              {album.year}  {album.genre}  {album.trackCount} tracks
            </div>

            <p
              style={{
                marginTop: 24,
                lineHeight: 1.75,
                color: "#c8ccd5",
                maxWidth: 680,
              }}
            >
              {album.description}
            </p>

            <div
              style={{
                marginTop: 24,
                display: "flex",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div
                style={{
                  padding: "13px 18px",
                  borderRadius: 12,
                  background: "#fff",
                  color: "#050505",
                  fontWeight: 900,
                }}
              >
                Album ${album.price.toFixed(2)}
              </div>

              <div
                style={{
                  padding: "13px 18px",
                  borderRadius: 12,
                  background: "#ffffff10",
                  border: "1px solid #ffffff20",
                  fontWeight: 800,
                }}
              >
                Tracks ${album.trackPrice.toFixed(2)}
              </div>
            </div>
          </div>
        </section>

        <section style={{ marginTop: 54 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 20,
              alignItems: "end",
              marginBottom: 18,
            }}
          >
            <div>
              <h2 style={{ fontSize: 30, margin: 0 }}>Tracklist</h2>
              <div
                style={{
                  marginTop: 6,
                  color: "#8f98aa",
                  fontSize: 14,
                }}
              >
                {loading
                  ? "Loading catalog media..."
                  : `${playableCount} catalog previews available`}
              </div>
            </div>
          </div>

          <div
            style={{
              border: "1px solid #ffffff17",
              borderRadius: 18,
              overflow: "hidden",
              background: "#ffffff08",
            }}
          >
            {album.tracks.map((track, index) => {
              const isPlaying = currentTrack === track.id;

              return (
                <div
                  key={`${track.id}-${track.number}`}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "48px 1fr auto",
                    gap: 14,
                    alignItems: "center",
                    padding: "16px 18px",
                    borderBottom:
                      index === album.tracks.length - 1
                        ? "none"
                        : "1px solid #ffffff10",
                  }}
                >
                  <div
                    style={{
                      color: "#7f8aa0",
                      fontWeight: 800,
                    }}
                  >
                    {String(track.number).padStart(2, "0")}
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontWeight: 800,
                        fontSize: 16,
                      }}
                    >
                      {track.title}
                    </div>

                    {track.previewUrl &&
                      isPublicPreviewTrack(track) && (
                        <audio
                          controls
                          preload="none"
                          src={track.previewUrl}
                          onPlay={() => setCurrentTrack(track.id)}
                          onPause={() =>
                            setCurrentTrack((current) =>
                              current === track.id ? null : current
                            )
                          }
                          style={{
                            width: "100%",
                            maxWidth: 520,
                            marginTop: 10,
                            height: 36,
                          }}
                        />
                      )}

                    {!loading &&
                      !isPublicPreviewTrack(track) && (
                        <div
                          style={{
                            marginTop: 8,
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            flexWrap: "wrap",
                          }}
                        >
                          <span
                            style={{
                              fontSize: 12,
                              color: "#9aa4b7",
                              fontWeight: 700,
                            }}
                          >
                            Premium track
                          </span>

                          <Link
                            href="/premium"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              padding: "8px 12px",
                              borderRadius: 999,
                              background:
                                "linear-gradient(135deg,#7c3aed,#2563eb)",
                              color: "#fff",
                              textDecoration: "none",
                              fontSize: 12,
                              fontWeight: 900,
                            }}
                          >
                            Subscribe to Play
                          </Link>
                        </div>
                      )}

                    {!loading &&
                      isPublicPreviewTrack(track) &&
                      !track.previewUrl && (
                        <div
                          style={{
                            marginTop: 5,
                            fontSize: 12,
                            color: "#697386",
                          }}
                        >
                          Preview unavailable from public catalog
                        </div>
                      )}
                  </div>

                  <div
                    style={{
                      fontWeight: 900,
                      whiteSpace: "nowrap",
                    }}
                  >
                    ${track.price.toFixed(2)}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}