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

type AccessState =
  | "loading"
  | "signed-out"
  | "active"
  | "inactive"
  | "error";

type RadioTrack = {
  id: string;
  title: string;
  albumTitle: string;
  artist: string;
  cover: string;
  src: string;
};

const RADIO_PREVIEW_LIMIT = 2;
const RADIO_PREVIEW_STORAGE_KEY = "solo-beats-radio-preview-count";


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
  scheduleStartDate: string | null;
  scheduleEndDate: string | null;
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
  scheduleStartDate: string;
  scheduleEndDate: string;
};

function getPromotionYouTubeEmbedUrl(
  value: string | null
): string | null {
  if (!value) return null;

  try {
    const url = new URL(value);
    let videoId = "";

    if (url.hostname === "youtu.be") {
      videoId =
        url.pathname
          .replace(/^\//, "")
          .split("/")[0] || "";
    } else {
      videoId =
        url.searchParams.get("v") ||
        url.pathname
          .split("/")
          .filter(Boolean)
          .pop() ||
        "";
    }

    if (!videoId) return null;

    return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(
      videoId
    )}`;
  } catch {
    return null;
  }
}

function PromotedPlacement({
  title,
  campaigns,
}: {
  title: string;
  campaigns: PromotedCampaign[];
}) {
  if (campaigns.length === 0) {
    return null;
  }

  return (
    <section className="mt-8 overflow-hidden rounded-[2rem] border border-fuchsia-300/20 bg-gradient-to-br from-fuchsia-700/20 via-black/40 to-cyan-500/10 p-6 sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.2em] text-fuchsia-300">
            Promoted Music
          </p>
          <h2 className="mt-2 text-3xl font-black">
            {title}
          </h2>
        </div>

        <Link
          href="/artist-promotion"
          className="rounded-2xl border border-white/15 bg-white/5 px-5 py-3 font-black"
        >
          Promote Your Music
        </Link>
      </div>

      <div className="mt-6 grid gap-6">
        {campaigns.map((campaign) => {
          const embedUrl =
            getPromotionYouTubeEmbedUrl(
              campaign.youtubeLink
            );

          return (
            <article
              key={campaign.submissionId}
              className="grid gap-6 rounded-2xl border border-white/10 bg-black/30 p-5 lg:grid-cols-[220px_minmax(0,1fr)]"
            >
              {campaign.artworkUrl ? (
                <img
                  src={campaign.artworkUrl}
                  alt={`${campaign.songTitle} artwork`}
                  className="aspect-square w-full rounded-2xl object-cover"
                />
              ) : (
                <div className="grid aspect-square place-items-center rounded-2xl border border-white/10 bg-black/30 text-white/35">
                  Artwork unavailable
                </div>
              )}

              <div className="min-w-0">
                <span className="inline-flex rounded-full border border-fuchsia-300/25 bg-fuchsia-300/10 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-fuchsia-200">
                  {campaign.sponsoredLabel || "Promoted"}
                </span>

                <p className="mt-4 text-sm font-black uppercase tracking-[0.16em] text-cyan-300">
                  {campaign.artistName}
                </p>

                <h3 className="mt-2 text-3xl font-black">
                  {campaign.songTitle}
                </h3>

                <p className="mt-2 text-white/45">
                  {campaign.genre}
                </p>

                <p className="mt-4 max-w-3xl leading-7 text-white/60">
                  {campaign.description}
                </p>

                {embedUrl ? (
                  <div className="mt-5 aspect-video overflow-hidden rounded-2xl border border-white/10 bg-black">
                    <iframe
                      src={embedUrl}
                      title={`${campaign.songTitle} promotional video`}
                      className="h-full w-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    />
                  </div>
                ) : campaign.songUrl ? (
                  <audio
                    controls
                    preload="metadata"
                    src={campaign.songUrl}
                    className="mt-5 w-full"
                  />
                ) : null}

                {campaign.socialLink ? (
                  <a
                    href={campaign.socialLink}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-5 inline-flex rounded-xl bg-white px-5 py-3 font-black text-black"
                  >
                    Visit Artist
                  </a>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}


function SponsoredBusinessPlacement({
  title,
  campaigns,
}: {
  title: string;
  campaigns: SponsoredBusinessCampaign[];
}) {
  if (campaigns.length === 0) return null;

  return (
    <section className="mt-8 overflow-hidden rounded-[2rem] border border-cyan-300/20 bg-gradient-to-br from-cyan-700/20 via-black/40 to-violet-500/10 p-6 sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.2em] text-cyan-300">
            Sponsored Business
          </p>
          <h2 className="mt-2 text-3xl font-black">{title}</h2>
        </div>

        <Link
          href="/business-advertising"
          className="rounded-2xl border border-white/15 bg-white/5 px-5 py-3 font-black"
        >
          Advertise Your Business
        </Link>
      </div>

      <div className="mt-6 grid gap-6">
        {campaigns.map((campaign) => {
          const embedUrl = getPromotionYouTubeEmbedUrl(campaign.youtubeLink);

          return (
            <article
              key={campaign.submissionId}
              className="grid gap-6 rounded-2xl border border-white/10 bg-black/30 p-5 lg:grid-cols-[260px_minmax(0,1fr)]"
            >
              {campaign.imageUrl ? (
                <img
                  src={campaign.imageUrl}
                  alt={`${campaign.campaignName} advertisement`}
                  className="aspect-square w-full rounded-2xl object-cover"
                />
              ) : (
                <div className="grid aspect-square place-items-center rounded-2xl border border-white/10 bg-black/30 text-center text-white/35">
                  Sponsored creative
                </div>
              )}

              <div className="min-w-0">
                <span className="inline-flex rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-cyan-100">
                  {campaign.sponsoredLabel || "Sponsored"}
                </span>

                <p className="mt-4 text-sm font-black uppercase tracking-[0.16em] text-emerald-300">
                  {campaign.businessName}
                </p>

                <h3 className="mt-2 text-3xl font-black">
                  {campaign.headline}
                </h3>

                <p className="mt-2 text-white/45">
                  {campaign.campaignName}
                </p>

                <p className="mt-4 max-w-3xl leading-7 text-white/60">
                  {campaign.description}
                </p>

                {embedUrl ? (
                  <div className="mt-5 aspect-video overflow-hidden rounded-2xl border border-white/10 bg-black">
                    <iframe
                      src={embedUrl}
                      title={`${campaign.campaignName} sponsored video`}
                      className="h-full w-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    />
                  </div>
                ) : campaign.videoUrl ? (
                  <video
                    controls
                    preload="metadata"
                    src={campaign.videoUrl}
                    className="mt-5 aspect-video w-full rounded-2xl bg-black"
                  />
                ) : null}

                <div className="mt-5 flex flex-wrap gap-3">
                  {campaign.businessWebsite ? (
                    <a
                      href={campaign.businessWebsite}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex rounded-xl bg-white px-5 py-3 font-black text-black"
                    >
                      {campaign.callToAction || "Learn More"}
                    </a>
                  ) : null}

                  <Link
                    href="/business-advertising"
                    className="inline-flex rounded-xl border border-white/15 bg-white/5 px-5 py-3 font-black"
                  >
                    Get Sponsored
                  </Link>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function shuffleTracks(
  tracks: RadioTrack[]
) {
  const shuffled = [...tracks];

  for (
    let index = shuffled.length - 1;
    index > 0;
    index -= 1
  ) {
    const randomIndex = Math.floor(
      Math.random() * (index + 1)
    );

    [
      shuffled[index],
      shuffled[randomIndex],
    ] = [
      shuffled[randomIndex],
      shuffled[index],
    ];
  }

  return shuffled;
}

function formatTime(seconds: number) {
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

export default function PremiumRadioPage() {
  const [user, setUser] =
    useState<User | null>(null);
  const [accessState, setAccessState] =
    useState<AccessState>("loading");
  const [message, setMessage] =
    useState("");
  const [promotedCampaigns, setPromotedCampaigns] =
    useState<PromotedCampaign[]>([]);
  const [businessCampaigns, setBusinessCampaigns] =
    useState<SponsoredBusinessCampaign[]>([]);

  const [radioOnAir, setRadioOnAir] =
    useState<boolean | null>(null);
  const [broadcastError, setBroadcastError] =
    useState("");

  const [stationTracks, setStationTracks] = useState<RadioTrack[]>([]);

  const [queue, setQueue] =
    useState<RadioTrack[]>([]);
  const [currentIndex, setCurrentIndex] =
    useState(0);
  const [isPlaying, setIsPlaying] =
    useState(false);
  const [autoplay, setAutoplay] =
    useState(true);
  const [currentTime, setCurrentTime] =
    useState(0);
  const [duration, setDuration] =
    useState(0);
  const [volume, setVolume] =
    useState(1);
  const [previewPlays, setPreviewPlays] =
    useState(0);
  const [previewLocked, setPreviewLocked] =
    useState(false);
  const [previewLoaded, setPreviewLoaded] =
    useState(false);

  const audioRef =
    useRef<HTMLAudioElement | null>(null);
  const previewStartedTrackRef =
    useRef<string | null>(null);

  const currentTrack =
    queue[currentIndex] || null;

  const hasPremiumAccess =
    accessState === "active";
  const isPublicPreview =
    accessState !== "loading" &&
    !hasPremiumAccess;

  useEffect(() => {
    let cancelled = false;

    async function loadRadioBroadcastStatus() {
      try {
        const response = await fetch("/api/broadcast/status", {
          cache: "no-store",
        });

        const contentType =
          response.headers.get("content-type") || "";

        if (!contentType.includes("application/json")) {
          throw new Error(
            "Radio broadcast status returned an invalid response."
          );
        }

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.error || "Radio broadcast status could not be loaded."
          );
        }

        if (!cancelled) {
          setBroadcastError("");
          setRadioOnAir(
            typeof data.radioOnAir === "boolean"
              ? data.radioOnAir
              : true
          );
        }
      } catch (error) {
        console.error(
          "Premium Radio broadcast status error:",
          error
        );

        if (!cancelled) {
          setRadioOnAir(null);
          setBroadcastError(
            error instanceof Error
              ? error.message
              : "Radio broadcast status could not be loaded."
          );
        }
      }
    }

    void loadRadioBroadcastStatus();

    const intervalId = window.setInterval(() => {
      void loadRadioBroadcastStatus();
    }, 5000);

    const handleFocus = () => {
      void loadRadioBroadcastStatus();
    };

    window.addEventListener("focus", handleFocus);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  useEffect(() => {
    if (radioOnAir !== false) return;

    const audio = audioRef.current;

    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }

    setCurrentTime(0);
    setIsPlaying(false);
  }, [radioOnAir]);

  useEffect(() => {
    try {
      const savedCount = Number(
        window.localStorage.getItem(
          RADIO_PREVIEW_STORAGE_KEY
        ) || "0"
      );
      const safeCount = Number.isFinite(savedCount)
        ? Math.max(0, savedCount)
        : 0;

      setPreviewPlays(safeCount);
      setPreviewLocked(
        safeCount >= RADIO_PREVIEW_LIMIT
      );
    } catch {
      setPreviewPlays(0);
      setPreviewLocked(false);
    } finally {
      setPreviewLoaded(true);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadPromotedCampaigns() {
      try {
        const response = await fetch(
          "/api/promotions/active?placement=radio",
          {
            cache: "no-store",
          }
        );

        const contentType =
          response.headers.get("content-type") || "";

        if (!contentType.includes("application/json")) {
          throw new Error(
            "The promoted-music service returned an invalid response."
          );
        }

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(
            data.error ||
              "Promoted music could not be loaded."
          );
        }

        if (!cancelled) {
          setPromotedCampaigns(
            Array.isArray(data.promotions)
              ? data.promotions
              : []
          );
        }
      } catch (error) {
        console.error(
          "Featured on Premium Radio promotions could not be loaded:",
          error
        );
      }
    }

    void loadPromotedCampaigns();

    return () => {
      cancelled = true;
    };
  }, []);


  useEffect(() => {
    let cancelled = false;

    async function loadSponsoredBusinessCampaigns() {
      try {
        const response = await fetch(
          "/api/business-advertising/active?placement=radio",
          { cache: "no-store" }
        );

        const contentType = response.headers.get("content-type") || "";

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
        console.error(
          "Sponsored Premium Radio campaigns could not be loaded:",
          error
        );
      }
    }

    void loadSponsoredBusinessCampaigns();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let lastPlaylistKey = "";

    async function loadRadioPlaylist() {
      try {
        const response = await fetch(
          `/api/radio/playlist?t=${Date.now()}`,
          { cache: "no-store" }
        );

        const data = (await response.json()) as {
          success?: boolean;
          source?: string;
          playlist?: {
            playlistId?: string;
            name?: string;
            description?: string;
          } | null;
          tracks?: RadioTrack[];
          error?: string;
        };

        if (!response.ok || !data.success) {
          throw new Error(
            data.error ||
              "Radio playlist could not be loaded."
          );
        }

        const nextTracks =
          Array.isArray(data.tracks)
            ? data.tracks
            : [];

        const playlistId =
          data.playlist?.playlistId || "none";

        const source =
          data.source || "none";

        const trackIdentity =
          nextTracks
            .map((track) => track.id)
            .join("|");

        const nextPlaylistKey =
          `${source}:${playlistId}:${trackIdentity}`;

        if (
          !cancelled &&
          nextPlaylistKey !== lastPlaylistKey
        ) {
          lastPlaylistKey = nextPlaylistKey;
          setStationTracks(nextTracks);
        }
      } catch (error) {
        console.error(
          "Premium Radio playlist refresh error:",
          error
        );
      }
    }

    void loadRadioPlaylist();

    const intervalId = window.setInterval(() => {
      void loadRadioPlaylist();
    }, 5000);

    const handleFocus = () => {
      void loadRadioPlaylist();
    };

    window.addEventListener(
      "focus",
      handleFocus
    );

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener(
        "focus",
        handleFocus
      );
    };
  }, []);

useEffect(() => {
  setQueue(shuffleTracks(stationTracks));
}, [stationTracks]);

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
              return;
            }

            setMessage(
              data.error ||
                "An active Premium membership is required."
            );
            setAccessState(
              response.status === 401
                ? "signed-out"
                : "inactive"
            );
          } catch (error) {
            console.error(
              "Premium Radio access error:",
              error
            );

            setMessage(
              error instanceof Error
                ? error.message
                : "Premium Radio access could not be checked."
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

    if (
      !audio ||
      !currentTrack ||
      accessState === "loading" ||
      (isPublicPreview && previewLocked)
    ) {
      return;
    }

    audio.src = currentTrack.src;
    audio.load();

    if (isPlaying) {
      void audio.play().catch(() => {
        setIsPlaying(false);
      });
    }
  }, [
    currentTrack,
    accessState,
    isPublicPreview,
    previewLocked,
  ]);

  function registerRadioPreviewStart() {
    const audio = audioRef.current;

    if (
      !isPublicPreview ||
      !currentTrack ||
      !audio
    ) {
      return true;
    }

    if (
      previewStartedTrackRef.current ===
      currentTrack.id
    ) {
      return true;
    }

    if (
      previewPlays >=
      RADIO_PREVIEW_LIMIT
    ) {
      audio.pause();
      audio.currentTime = 0;
      setCurrentTime(0);
      setIsPlaying(false);
      setPreviewLocked(true);
      setMessage(
        "Your two-song Radio preview is complete. Subscribe to SOLO BEATS PREMIUM for unlimited Radio and TV."
      );
      return false;
    }

    const nextPreviewCount =
      previewPlays + 1;

    previewStartedTrackRef.current =
      currentTrack.id;

    setPreviewPlays(nextPreviewCount);

    try {
      window.localStorage.setItem(
        RADIO_PREVIEW_STORAGE_KEY,
        String(nextPreviewCount)
      );
    } catch {
      // The in-memory preview limit still applies.
    }

    return true;
  }

  async function startRadio() {
    const audio = audioRef.current;

    if (
      !audio ||
      !currentTrack ||
      (isPublicPreview && previewLocked)
    ) {
      return;
    }

    await audio.play();
    setIsPlaying(true);
  }

  async function togglePlayPause() {
    const audio = audioRef.current;

    if (
      !audio ||
      !currentTrack ||
      (isPublicPreview && previewLocked)
    ) {
      return;
    }

    if (audio.paused) {
      await audio.play();
      setIsPlaying(true);
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  }

  function stopRadio() {
    const audio = audioRef.current;

    if (!audio) return;

    audio.pause();
    audio.currentTime = 0;
    setCurrentTime(0);
    setIsPlaying(false);
  }

  function previousTrack() {
    if (queue.length === 0) return;

    setCurrentIndex((index) =>
      index <= 0
        ? queue.length - 1
        : index - 1
    );
  }

  function nextTrack() {
    if (queue.length === 0) return;

    setCurrentIndex((index) =>
      index >= queue.length - 1
        ? 0
        : index + 1
    );
  }

  function shuffleStation() {
    setQueue(
      shuffleTracks(stationTracks)
    );
    setCurrentIndex(0);
  }

  function handleEnded() {
    setIsPlaying(false);

    if (
      isPublicPreview &&
      previewPlays >= RADIO_PREVIEW_LIMIT
    ) {
      setPreviewLocked(true);
      setMessage(
        "Your two-song Radio preview is complete. Subscribe to SOLO BEATS PREMIUM for unlimited Radio and TV."
      );
      return;
    }

    if (autoplay) {
      setIsPlaying(true);
      setCurrentIndex((index) =>
        index >= queue.length - 1
          ? 0
          : index + 1
      );
    }
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
    setVolume(value);

    if (audioRef.current) {
      audioRef.current.volume = value;
    }
  }

  if (radioOnAir === null && !broadcastError) {
    return (
      <main className="min-h-screen px-5 pb-32 pt-52 sm:px-8">
        <section className="mx-auto max-w-5xl rounded-[2rem] border border-cyan-300/15 bg-gradient-to-br from-cyan-500/10 via-white/[0.035] to-violet-500/10 p-10 text-center shadow-2xl">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-cyan-300">
            SOLO BEATS PREMIUM RADIO
          </p>
          <h1 className="mt-3 text-4xl font-black">
            Checking station status...
          </h1>
          <p className="mt-4 text-white/55">
            Confirming whether Premium Radio is currently on air.
          </p>
        </section>
      </main>
    );
  }

  if (broadcastError) {
    return (
      <main className="min-h-screen px-5 pb-32 pt-52 sm:px-8">
        <section className="mx-auto max-w-5xl rounded-[2rem] border border-amber-300/20 bg-gradient-to-br from-amber-500/15 via-white/[0.035] to-red-500/10 p-10 text-center shadow-2xl">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-amber-300">
            PREMIUM RADIO STATUS
          </p>
          <h1 className="mt-3 text-4xl font-black">
            Station status unavailable
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-white/60">
            Premium Radio cannot start until the broadcast status can be confirmed.
          </p>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-red-200/80">
            {broadcastError}
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link
              href="/premium"
              className="rounded-2xl bg-white px-6 py-4 font-black text-black"
            >
              Premium Home
            </Link>
            <Link
              href="/"
              className="rounded-2xl border border-white/15 bg-white/5 px-6 py-4 font-black"
            >
              Home
            </Link>
          </div>
        </section>
      </main>
    );
  }

  if (radioOnAir === false) {
    return (
      <main className="min-h-screen px-5 pb-32 pt-52 sm:px-8">
        <section className="mx-auto max-w-5xl overflow-hidden rounded-[2.5rem] border border-red-300/20 bg-gradient-to-br from-red-500/15 via-black/50 to-violet-500/15 p-10 text-center shadow-2xl sm:p-14">
          <div className="mx-auto inline-flex items-center gap-3 rounded-full border border-red-300/25 bg-red-400/10 px-4 py-2">
            <span className="h-3 w-3 rounded-full bg-red-400" />
            <span className="text-xs font-black uppercase tracking-[0.2em] text-red-200">
              OFF AIR
            </span>
          </div>

          <p className="mt-8 text-sm font-black uppercase tracking-[0.22em] text-violet-300">
            SOLO BEATS ENGINE MUSIC
          </p>

          <h1 className="mt-3 text-4xl font-black sm:text-6xl">
            PREMIUM RADIO IS OFF AIR
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-white/60">
            Premium Radio is temporarily unavailable. Please check back when the station is back on air.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/premium"
              className="rounded-2xl bg-white px-6 py-4 font-black text-black"
            >
              Premium Home
            </Link>
            <Link
              href="/"
              className="rounded-2xl border border-white/15 bg-white/5 px-6 py-4 font-black"
            >
              Home
            </Link>
          </div>

          <p className="mt-8 text-sm text-white/35">
            This page automatically checks the station status and will become available again when Radio is placed back ON AIR.
          </p>
        </section>
      </main>
    );
  }

  if (accessState === "loading") {
    return (
      <main className="min-h-screen px-5 pb-32 pt-52 sm:px-8">
        <section className="mx-auto max-w-5xl rounded-[2rem] border border-white/10 bg-white/[0.035] p-10 text-center">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-violet-300">
            SOLO BEATS PREMIUM RADIO
          </p>
          <h1 className="mt-3 text-4xl font-black">
            Checking membership...
          </h1>
        </section>
      </main>
    );
  }
  return (
    <main className="min-h-screen overflow-x-hidden px-5 pb-48 pt-52 sm:px-8">
      <audio
        ref={audioRef}
        onPlay={() => {
          setIsPlaying(true);
          registerRadioPreviewStart();
        }}
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
        onEnded={handleEnded}
      />

      <div className="mx-auto max-w-7xl">
        {isPublicPreview ? (
          <section className="mb-6 rounded-[2rem] border border-amber-300/25 bg-gradient-to-r from-amber-500/15 via-white/[0.04] to-violet-500/15 p-6 sm:p-8">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-amber-200">
              Free Radio Preview
            </p>

            {previewLocked ? (
              <>
                <h2 className="mt-2 text-3xl font-black">
                  Your two-song preview is complete
                </h2>
                <p className="mt-3 max-w-3xl text-white/60">
                  Subscribe to SOLO BEATS PREMIUM for unlimited Radio, Premium TV, the Premium Library, and member downloads.
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <Link
                    href="/premium"
                    className="rounded-2xl bg-white px-6 py-4 font-black text-black"
                  >
                    Subscribe Now
                  </Link>
                  <Link
                    href="/account"
                    className="rounded-2xl border border-white/15 bg-white/5 px-6 py-4 font-black"
                  >
                    Sign In
                  </Link>
                </div>
              </>
            ) : (
              <>
                <h2 className="mt-2 text-3xl font-black">
                  Listen to two songs free
                </h2>
                <p className="mt-3 text-white/60">
                  {Math.max(
                    RADIO_PREVIEW_LIMIT - previewPlays,
                    0
                  )} free {RADIO_PREVIEW_LIMIT - previewPlays === 1 ? "song" : "songs"} remaining. Playback stops after your second song.
                </p>
              </>
            )}
          </section>
        ) : null}
<section className="overflow-hidden rounded-[2.5rem] border border-violet-300/20 bg-gradient-to-br from-violet-700/35 via-black/40 to-cyan-500/20 p-8 shadow-2xl sm:p-12">
          <div className="grid gap-10 lg:grid-cols-[1fr_360px] lg:items-center">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.22em] text-emerald-300">
                {hasPremiumAccess ? "Premium Access Confirmed" : "Public Preview Access"}
              </p>

              <h1 className="mt-4 text-5xl font-black sm:text-7xl">
                SOLO BEATS
                <span className="block text-violet-300">
                  PREMIUM RADIO
                </span>
              </h1>

              <p className="mt-5 max-w-3xl text-lg leading-8 text-white/60">
                {hasPremiumAccess
                  ? `A continuous member station powered by ${stationTracks.length} dashboard-managed tracks.`
                  : "Preview two songs, then subscribe for unlimited Radio and TV."}
              </p>

              <div className="mt-7 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={togglePlayPause}
                  disabled={
                    !previewLoaded ||
                    (isPublicPreview && previewLocked)
                  }
                  className="rounded-2xl bg-white px-6 py-4 font-black text-black"
                >
                  {isPlaying ? "Pause Radio" : currentTime > 0 ? "Resume Radio" : "Start Radio"}
                </button>

                <button
                  type="button"
                  onClick={previousTrack}
                  className="rounded-2xl border border-white/15 bg-white/5 px-6 py-4 font-black"
                >
                  Previous
                </button>

                <button
                  type="button"
                  onClick={nextTrack}
                  className="rounded-2xl border border-white/15 bg-white/5 px-6 py-4 font-black"
                >
                  Next
                </button>

                <button
                  type="button"
                  onClick={stopRadio}
                  className="rounded-2xl border border-red-300/20 bg-red-300/10 px-6 py-4 font-black text-red-200"
                >
                  Stop
                </button>

                <button
                  type="button"
                  onClick={shuffleStation}
                  className="rounded-2xl border border-white/15 bg-white/5 px-6 py-4 font-black"
                >
                  Shuffle Station
                </button>

                <Link
                  href="/premium/library"
                  className="rounded-2xl border border-white/15 bg-white/5 px-6 py-4 font-black"
                >
                  Premium Library
                </Link>
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-black/30 p-5">
              <div className="flex items-center gap-3">
                <span className="h-3 w-3 animate-pulse rounded-full bg-emerald-400" />
                <span className="text-sm font-black uppercase tracking-[0.18em] text-emerald-300">
                  {hasPremiumAccess ? "Member Station" : "Preview Station"}
                </span>
              </div>

              {currentTrack ? (
                <>
                  {currentTrack.cover ? (
                  <img
                    src={currentTrack.cover}
                    alt={`${currentTrack.albumTitle} cover`}
                    className="mt-5 aspect-square w-full rounded-2xl object-cover"
                  />
                ) : (
                  <div className="mt-5 flex aspect-square w-full items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-center text-sm font-black text-white/35">
                    SOLO BEATS RADIO
                  </div>
                )}

                  {currentTrack.albumTitle === "Bullet Carnage" ? (
                    <p className="mt-5 inline-flex rounded-full border border-orange-300/30 bg-orange-400/10 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-orange-200">
                      Upcoming Exclusive
                    </p>
                  ) : null}

                  <p className="mt-5 text-sm font-black uppercase tracking-[0.14em] text-white/40">
                    Now Playing
                  </p>

                  <h2 className="mt-2 text-3xl font-black">
                    {currentTrack.title}
                  </h2>

                  <p className="mt-1 text-white/50">
                    {currentTrack.artist} &bull; {currentTrack.albumTitle}
                  </p>
                </>
              ) : (
                <p className="mt-5 text-white/50">
                  No tracks are available.
                </p>
              )}
            </div>
          </div>
        </section>

        <SponsoredBusinessPlacement
          title="Sponsored on Premium Radio"
          campaigns={businessCampaigns}
        />

        <PromotedPlacement
          title="Featured on Premium Radio"
          campaigns={promotedCampaigns}
        />

        <section className="mt-8 grid gap-6 lg:grid-cols-[1fr_340px]">
          <article className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-6 sm:p-8">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-violet-300">
              Station Controls
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={previousTrack}
                className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 font-black"
              >
                Previous
              </button>

              <button
                type="button"
                onClick={togglePlayPause}
                  disabled={
                    !previewLoaded ||
                    (isPublicPreview && previewLocked)
                  }
                  className="min-w-32 rounded-2xl bg-white px-6 py-4 font-black text-black"
              >
                {isPlaying
                  ? "Pause"
                  : "Play"}
              </button>

              <button
                type="button"
                onClick={stopRadio}
                className="rounded-2xl border border-red-300/20 bg-red-300/10 px-5 py-4 font-black text-red-200"
              >
                Stop
              </button>

              <button
                type="button"
                onClick={nextTrack}
                className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 font-black"
              >
                Next
              </button>
            </div>

            <div className="mt-7">
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

              <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={() =>
                    setAutoplay(
                      (value) => !value
                    )
                  }
                  className={`rounded-2xl border px-5 py-3 font-black ${
                    autoplay
                      ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-200"
                      : "border-white/10 bg-white/5 text-white/60"
                  }`}
                >
                  Autoplay {autoplay
                    ? "On"
                    : "Off"}
                </button>

                <div className="flex items-center gap-3">
                  <span className="text-xs font-black uppercase tracking-[0.14em] text-white/35">
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
                    className="w-36"
                    aria-label="Volume"
                  />
                </div>
              </div>
            </div>
          </article>

          <aside className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-6">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-emerald-300">
              Up Next
            </p>

            <div className="mt-5 grid gap-3">
              {queue
                .slice(
                  currentIndex + 1,
                  currentIndex + 6
                )
                .map((track) => (
                  <button
                    type="button"
                    key={track.id}
                    onClick={() => {
                      const index =
                        queue.findIndex(
                          (item) =>
                            item.id ===
                            track.id
                        );

                      if (index >= 0) {
                        setCurrentIndex(index);
                      }
                    }}
                    className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 p-3 text-left hover:bg-white/[0.05]"
                  >
                    <img
                      src={track.cover || undefined}
                      alt=""
                      className="h-14 w-14 rounded-xl object-cover"
                    />

                    <span className="min-w-0">
                      <span className="block truncate font-black">
                        {track.title}
                      </span>
                      <span className="block truncate text-xs text-white/40">
                        {track.albumTitle}
                      </span>
                    </span>
                  </button>
                ))}
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}










