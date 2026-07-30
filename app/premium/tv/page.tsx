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
import { premiumAlbums } from "../../premiumCatalog";

type AccessState =
  | "loading"
  | "signed-out"
  | "active"
  | "inactive"
  | "error";

type VisualizerMode =
  | "bars"
  | "wave"
  | "circle"
  | "mirror";

type TvProgram = {
  id: string;
  title: string;
  albumTitle: string;
  artist: string;
  cover: string;
  src: string;
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
          <p className="text-sm font-black uppercase tracking-[0.2em] text-cyan-300">Sponsored Business</p>
          <h2 className="mt-2 text-3xl font-black">{title}</h2>
        </div>
        <Link href="/business-advertising" className="rounded-2xl border border-white/15 bg-white/5 px-5 py-3 font-black">Advertise Your Business</Link>
      </div>
      <div className="mt-6 grid gap-6">
        {campaigns.map((campaign) => {
          const embedUrl = getPromotionYouTubeEmbedUrl(campaign.youtubeLink);
          return (
            <article key={campaign.submissionId} className="grid gap-6 rounded-2xl border border-white/10 bg-black/30 p-5 lg:grid-cols-[260px_minmax(0,1fr)]">
              {campaign.imageUrl ? (
                <img src={campaign.imageUrl} alt={`${campaign.campaignName} advertisement`} className="aspect-square w-full rounded-2xl object-cover" />
              ) : (
                <div className="grid aspect-square place-items-center rounded-2xl border border-white/10 bg-black/30 text-center text-white/35">Sponsored creative</div>
              )}
              <div className="min-w-0">
                <span className="inline-flex rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-cyan-100">{campaign.sponsoredLabel || "Sponsored"}</span>
                <p className="mt-4 text-sm font-black uppercase tracking-[0.16em] text-emerald-300">{campaign.businessName}</p>
                <h3 className="mt-2 text-3xl font-black">{campaign.headline}</h3>
                <p className="mt-2 text-white/45">{campaign.campaignName}</p>
                <p className="mt-4 max-w-3xl leading-7 text-white/60">{campaign.description}</p>
                {embedUrl ? (
                  <div className="mt-5 aspect-video overflow-hidden rounded-2xl border border-white/10 bg-black">
                    <iframe src={embedUrl} title={`${campaign.campaignName} sponsored video`} className="h-full w-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen />
                  </div>
                ) : campaign.videoUrl ? (
                  <video controls preload="metadata" src={campaign.videoUrl} className="mt-5 aspect-video w-full rounded-2xl bg-black" />
                ) : null}
                <div className="mt-5 flex flex-wrap gap-3">
                  {campaign.businessWebsite ? (
                    <a href={campaign.businessWebsite} target="_blank" rel="noreferrer" className="inline-flex rounded-xl bg-white px-5 py-3 font-black text-black">{campaign.callToAction || "Learn More"}</a>
                  ) : null}
                  <Link href="/business-advertising" className="inline-flex rounded-xl border border-white/15 bg-white/5 px-5 py-3 font-black">Get Sponsored</Link>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function shufflePrograms(
  programs: TvProgram[]
) {
  const shuffled = [...programs];

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

export default function PremiumTvPage() {
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

  const allPrograms = useMemo(
    () =>
      premiumAlbums.flatMap((album) =>
        album.tracks.map((track) => ({
          id: track.id,
          title: track.title,
          albumTitle: album.title,
          artist: album.artist,
          cover: album.cover,
          src: track.preview,
        }))
      ),
    []
  );

  const [queue, setQueue] =
    useState<TvProgram[]>([]);
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
  const [theaterMode, setTheaterMode] =
    useState(false);
  const [playbackMessage, setPlaybackMessage] =
    useState("");
  const [visualizerMode, setVisualizerMode] =
    useState<VisualizerMode>("bars");
  const [isVisualizerFullscreen, setIsVisualizerFullscreen] =
    useState(false);

  const audioRef =
    useRef<HTMLAudioElement | null>(null);
  const canvasRef =
    useRef<HTMLCanvasElement | null>(null);
  const visualizerPanelRef =
    useRef<HTMLDivElement | null>(null);
  const audioContextRef =
    useRef<AudioContext | null>(null);
  const analyserRef =
    useRef<AnalyserNode | null>(null);
  const sourceNodeRef =
    useRef<MediaElementAudioSourceNode | null>(null);
  const animationFrameRef =
    useRef<number | null>(null);

  const currentProgram =
    queue[currentIndex] || null;

  useEffect(() => {
    let cancelled = false;

    async function loadPromotedCampaigns() {
      try {
        const response = await fetch(
          "/api/promotions/active?placement=tv",
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
          "Featured on Premium TV promotions could not be loaded:",
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
        const response = await fetch("/api/business-advertising/active?placement=tv", { cache: "no-store" });
        const contentType = response.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) throw new Error("The business advertising service returned an invalid response.");
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error || "Sponsored business campaigns could not be loaded.");
        if (!cancelled) setBusinessCampaigns(Array.isArray(data.campaigns) ? data.campaigns : []);
      } catch (error) {
        console.error("Sponsored Premium TV campaigns could not be loaded:", error);
      }
    }
    void loadSponsoredBusinessCampaigns();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    setQueue(
      shufflePrograms(allPrograms)
    );
  }, [allPrograms]);

  useEffect(() => {
    function handleFullscreenChange() {
      setIsVisualizerFullscreen(
        document.fullscreenElement ===
          visualizerPanelRef.current
      );
    }

    document.addEventListener(
      "fullscreenchange",
      handleFullscreenChange
    );

    return () => {
      document.removeEventListener(
        "fullscreenchange",
        handleFullscreenChange
      );
    };
  }, []);

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
              "Premium TV access error:",
              error
            );

            setMessage(
              error instanceof Error
                ? error.message
                : "Premium TV access could not be checked."
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
      !currentProgram ||
      accessState !== "active"
    ) {
      return;
    }

    audio.src = currentProgram.src;
    audio.load();

    if (isPlaying) {
      void audio.play().catch(() => {
        setIsPlaying(false);
      });
    }
  }, [
    currentProgram,
    accessState,
  ]);

  async function playCurrentProgram() {
    const audio = audioRef.current;

    if (!audio || !currentProgram) return;

    try {
      setPlaybackMessage("");
      await ensureVisualizer();
      await audio.play();
      setIsPlaying(true);
    } catch (error) {
      console.warn(
        "Premium TV skipped an unsupported source:",
        error
      );

      setIsPlaying(false);
      setPlaybackMessage(
        `"${currentProgram.title}" could not play in this browser, so Premium TV moved to the next program.`
      );

      setCurrentIndex((index) =>
        index >= queue.length - 1
          ? 0
          : index + 1
      );
    }
  }

  async function startTv() {
    await playCurrentProgram();
  }

  async function togglePlayPause() {
    const audio = audioRef.current;

    if (!audio || !currentProgram) return;

    if (audio.paused) {
      await playCurrentProgram();
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  }

  function stopTv() {
    const audio = audioRef.current;

    if (!audio) return;

    audio.pause();
    audio.currentTime = 0;
    setCurrentTime(0);
    setIsPlaying(false);
  }

  function previousProgram() {
    if (queue.length === 0) return;

    setCurrentIndex((index) =>
      index <= 0
        ? queue.length - 1
        : index - 1
    );
  }

  function nextProgram() {
    if (queue.length === 0) return;

    setCurrentIndex((index) =>
      index >= queue.length - 1
        ? 0
        : index + 1
    );
  }

  function shuffleChannel() {
    setQueue(
      shufflePrograms(allPrograms)
    );
    setCurrentIndex(0);
  }

  function handleEnded() {
    setIsPlaying(false);

    if (autoplay) {
      nextProgram();

      setTimeout(() => {
        const audio =
          audioRef.current;

        if (audio) {
          void audio
            .play()
            .then(() =>
              setIsPlaying(true)
            )
            .catch(() =>
              setIsPlaying(false)
            );
        }
      }, 0);
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

  async function toggleVisualizerFullscreen() {
    const panel =
      visualizerPanelRef.current;

    if (!panel) return;

    try {
      if (
        document.fullscreenElement === panel
      ) {
        await document.exitFullscreen();
      } else {
        await panel.requestFullscreen();
      }
    } catch (error) {
      console.warn(
        "Fullscreen could not be activated:",
        error
      );
    }
  }

  async function ensureVisualizer() {
    const audio = audioRef.current;
    const canvas = canvasRef.current;

    if (!audio || !canvas) return;

    const AudioContextClass =
      window.AudioContext ||
      (
        window as typeof window & {
          webkitAudioContext?: typeof AudioContext;
        }
      ).webkitAudioContext;

    if (!AudioContextClass) {
      return;
    }

    if (!audioContextRef.current) {
      const audioContext =
        new AudioContextClass();
      const analyser =
        audioContext.createAnalyser();

      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.82;

      const source =
        audioContext.createMediaElementSource(
          audio
        );

      source.connect(analyser);
      analyser.connect(
        audioContext.destination
      );

      audioContextRef.current =
        audioContext;
      analyserRef.current = analyser;
      sourceNodeRef.current = source;
    }

    if (
      audioContextRef.current.state ===
      "suspended"
    ) {
      await audioContextRef.current.resume();
    }

    drawVisualizer();
  }

  function drawVisualizer() {
    const canvas = canvasRef.current;
    const analyser =
      analyserRef.current;

    if (!canvas || !analyser) {
      return;
    }

    const context =
      canvas.getContext("2d");

    if (!context) return;

    const pixelRatio =
      window.devicePixelRatio || 1;
    const width =
      canvas.clientWidth;
    const height =
      canvas.clientHeight;

    if (
      canvas.width !==
        Math.floor(width * pixelRatio) ||
      canvas.height !==
        Math.floor(height * pixelRatio)
    ) {
      canvas.width =
        Math.floor(width * pixelRatio);
      canvas.height =
        Math.floor(height * pixelRatio);
    }

    context.setTransform(
      pixelRatio,
      0,
      0,
      pixelRatio,
      0,
      0
    );

    const frequencyData =
      new Uint8Array(
        analyser.frequencyBinCount
      );
    const timeData =
      new Uint8Array(
        analyser.fftSize
      );

    analyser.getByteFrequencyData(
      frequencyData
    );
    analyser.getByteTimeDomainData(
      timeData
    );

    const background =
      context.createLinearGradient(
        0,
        0,
        width,
        height
      );

    background.addColorStop(
      0,
      "rgba(15, 23, 42, 0.98)"
    );
    background.addColorStop(
      0.5,
      "rgba(6, 10, 25, 0.98)"
    );
    background.addColorStop(
      1,
      "rgba(0, 0, 0, 0.98)"
    );

    context.fillStyle = background;
    context.fillRect(
      0,
      0,
      width,
      height
    );

    if (visualizerMode === "bars") {
      const barCount = 56;
      const gap = 4;
      const barWidth =
        (width -
          gap * (barCount - 1)) /
        barCount;

      for (
        let index = 0;
        index < barCount;
        index += 1
      ) {
        const dataIndex = Math.floor(
          (index /
            Math.max(
              1,
              barCount - 1
            )) *
            (frequencyData.length - 1)
        );

        const strength =
          frequencyData[dataIndex] /
          255;

        const barHeight = Math.max(
          6,
          strength * height * 0.88
        );

        const x =
          index *
          (barWidth + gap);
        const y =
          height - barHeight;

        const gradient =
          context.createLinearGradient(
            0,
            y,
            0,
            height
          );

        gradient.addColorStop(
          0,
          "rgba(236, 72, 153, 0.98)"
        );
        gradient.addColorStop(
          0.45,
          "rgba(168, 85, 247, 0.95)"
        );
        gradient.addColorStop(
          1,
          "rgba(34, 211, 238, 0.9)"
        );

        context.fillStyle =
          gradient;
        context.shadowBlur =
          18;
        context.shadowColor =
          "rgba(168, 85, 247, 0.55)";

        context.fillRect(
          x,
          y,
          Math.max(
            1,
            barWidth
          ),
          barHeight
        );
      }
    }

    if (visualizerMode === "wave") {
      context.lineWidth = 4;
      context.strokeStyle =
        "rgba(236, 72, 153, 0.95)";
      context.shadowBlur = 20;
      context.shadowColor =
        "rgba(168, 85, 247, 0.55)";
      context.beginPath();

      for (
        let index = 0;
        index < timeData.length;
        index += 1
      ) {
        const value =
          timeData[index] / 128;
        const x =
          (index /
            (timeData.length - 1)) *
          width;
        const y =
          (value * height) / 2;

        if (index === 0) {
          context.moveTo(x, y);
        } else {
          context.lineTo(x, y);
        }
      }

      context.stroke();
    }

    if (visualizerMode === "circle") {
      const centerX =
        width / 2;
      const centerY =
        height / 2;
      const baseRadius =
        Math.min(width, height) *
        0.18;
      const barCount = 96;

      context.save();
      context.translate(
        centerX,
        centerY
      );

      for (
        let index = 0;
        index < barCount;
        index += 1
      ) {
        const dataIndex = Math.floor(
          (index /
            Math.max(
              1,
              barCount - 1
            )) *
            (frequencyData.length - 1)
        );

        const strength =
          frequencyData[dataIndex] /
          255;
        const barLength =
          18 +
          strength *
            Math.min(
              width,
              height
            ) *
            0.18;
        const angle =
          (Math.PI *
            2 *
            index) /
          barCount;

        const x1 =
          Math.cos(angle) *
          baseRadius;
        const y1 =
          Math.sin(angle) *
          baseRadius;
        const x2 =
          Math.cos(angle) *
          (baseRadius +
            barLength);
        const y2 =
          Math.sin(angle) *
          (baseRadius +
            barLength);

        const gradient =
          context.createLinearGradient(
            x1,
            y1,
            x2,
            y2
          );

        gradient.addColorStop(
          0,
          "rgba(34, 211, 238, 0.85)"
        );
        gradient.addColorStop(
          0.5,
          "rgba(168, 85, 247, 0.95)"
        );
        gradient.addColorStop(
          1,
          "rgba(236, 72, 153, 0.98)"
        );

        context.strokeStyle =
          gradient;
        context.lineWidth = 3;
        context.shadowBlur = 16;
        context.shadowColor =
          "rgba(236, 72, 153, 0.35)";

        context.beginPath();
        context.moveTo(
          x1,
          y1
        );
        context.lineTo(
          x2,
          y2
        );
        context.stroke();
      }

      context.restore();
    }

    if (visualizerMode === "mirror") {
      const barCount = 34;
      const gap = 5;
      const halfWidth =
        width / 2;
      const totalWidth =
        halfWidth - 12;
      const barWidth =
        (totalWidth -
          gap *
            (barCount - 1)) /
        barCount;
      const centerY =
        height / 2;

      for (
        let index = 0;
        index < barCount;
        index += 1
      ) {
        const dataIndex = Math.floor(
          (index /
            Math.max(
              1,
              barCount - 1
            )) *
            (frequencyData.length - 1)
        );

        const strength =
          frequencyData[dataIndex] /
          255;
        const barHeight =
          Math.max(
            4,
            strength *
              (height * 0.42)
          );

        const rightX =
          halfWidth +
          index *
            (barWidth + gap);
        const leftX =
          halfWidth -
          (index + 1) *
            barWidth -
          index * gap;

        const gradient =
          context.createLinearGradient(
            0,
            centerY -
              barHeight,
            0,
            centerY +
              barHeight
          );

        gradient.addColorStop(
          0,
          "rgba(236, 72, 153, 0.95)"
        );
        gradient.addColorStop(
          0.5,
          "rgba(168, 85, 247, 0.95)"
        );
        gradient.addColorStop(
          1,
          "rgba(34, 211, 238, 0.9)"
        );

        context.fillStyle =
          gradient;
        context.shadowBlur = 14;
        context.shadowColor =
          "rgba(99, 102, 241, 0.45)";

        context.fillRect(
          leftX,
          centerY -
            barHeight,
          barWidth,
          barHeight * 2
        );

        context.fillRect(
          rightX,
          centerY -
            barHeight,
          barWidth,
          barHeight * 2
        );
      }
    }

    context.shadowBlur = 0;
    animationFrameRef.current =
      window.requestAnimationFrame(
        drawVisualizer
      );
  }

  useEffect(() => {
    if (
      analyserRef.current &&
      canvasRef.current
    ) {
      if (
        animationFrameRef.current !==
        null
      ) {
        window.cancelAnimationFrame(
          animationFrameRef.current
        );
      }

      drawVisualizer();
    }
  }, [visualizerMode]);

  useEffect(() => {
    return () => {
      if (
        animationFrameRef.current !==
        null
      ) {
        window.cancelAnimationFrame(
          animationFrameRef.current
        );
      }

      if (
        audioContextRef.current &&
        audioContextRef.current.state !==
          "closed"
      ) {
        void audioContextRef.current.close();
      }
    };
  }, []);

  if (accessState === "loading") {
    return (
      <main className="min-h-screen px-5 pb-32 pt-52 sm:px-8">
        <section className="mx-auto max-w-5xl rounded-[2rem] border border-white/10 bg-white/[0.035] p-10 text-center">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-fuchsia-300">
            SOLO BEATS PREMIUM TV
          </p>
          <h1 className="mt-3 text-4xl font-black">
            Checking membership...
          </h1>
        </section>
      </main>
    );
  }

  if (accessState === "signed-out") {
    return (
      <main className="min-h-screen px-5 pb-32 pt-52 sm:px-8">
        <section className="mx-auto max-w-5xl rounded-[2rem] border border-white/10 bg-gradient-to-br from-fuchsia-500/20 via-white/[0.04] to-cyan-400/10 p-10 text-center">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-fuchsia-300">
            Premium TV Locked
          </p>
          <h1 className="mt-3 text-5xl font-black">
            Sign in to watch
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

  if (
    accessState === "inactive" ||
    accessState === "error"
  ) {
    return (
      <main className="min-h-screen px-5 pb-32 pt-52 sm:px-8">
        <section className="mx-auto max-w-5xl rounded-[2rem] border border-red-300/15 bg-gradient-to-br from-red-500/10 via-white/[0.03] to-fuchsia-500/10 p-10 text-center">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-red-200">
            Premium Access Required
          </p>
          <h1 className="mt-3 text-5xl font-black">
            Premium TV is locked
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-white/55">
            {message ||
              "An active SOLO BEATS PREMIUM membership is required."}
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link
              href="/premium"
              className="rounded-2xl bg-white px-6 py-4 font-black text-black"
            >
              Join Premium
            </Link>
            <Link
              href="/account"
              className="rounded-2xl border border-white/15 bg-white/5 px-6 py-4 font-black"
            >
              Open Account
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-5 pb-48 pt-52 sm:px-8">
      <audio
        ref={audioRef}
        onPlay={() =>
          setIsPlaying(true)
        }
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
        onError={() => {
          if (!currentProgram) return;

          setIsPlaying(false);
          setPlaybackMessage(
            `"${currentProgram.title}" has an unsupported or missing audio source. Premium TV skipped it.`
          );

          setCurrentIndex((index) =>
            index >= queue.length - 1
              ? 0
              : index + 1
          );
        }}
      />

      <div className="mx-auto max-w-7xl">
        <section className="rounded-[2.5rem] border border-fuchsia-300/20 bg-gradient-to-br from-fuchsia-700/25 via-black/50 to-cyan-500/15 p-6 shadow-2xl sm:p-10">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.22em] text-emerald-300">
                Premium Access Confirmed
              </p>
              <h1 className="mt-3 text-4xl font-black sm:text-6xl">
                SOLO BEATS PREMIUM TV
              </h1>
              <p className="mt-3 max-w-3xl text-white/55">
                Continuous visual music programming powered by {premiumAlbums.length} selected albums and {allPrograms.length} tracks.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={startTv}
                className="rounded-2xl bg-white px-6 py-4 font-black text-black"
              >
                Start TV
              </button>

              <button
                type="button"
                onClick={shuffleChannel}
                className="rounded-2xl border border-white/15 bg-white/5 px-6 py-4 font-black"
              >
                Shuffle Channel
              </button>

              <Link
                href="/premium/radio"
                className="rounded-2xl border border-white/15 bg-white/5 px-6 py-4 font-black"
              >
                Open Radio
              </Link>
            </div>
          </div>

          {playbackMessage ? (
            <p className="mt-6 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4 text-amber-100">
              {playbackMessage}
            </p>
          ) : null}

          <div
            className={`relative mt-8 overflow-hidden rounded-[2rem] border border-white/10 bg-black ${
              theaterMode
                ? "min-h-[72vh]"
                : "min-h-[520px]"
            }`}
          >
            {currentProgram ? (
              <>
                <img
                  src={currentProgram.cover}
                  alt=""
                  className="absolute inset-0 h-full w-full scale-110 object-cover opacity-25 blur-2xl"
                />

                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />

                <div className="relative grid min-h-[520px] gap-8 p-8 lg:grid-cols-[360px_minmax(0,1fr)] lg:items-center">
                  <div className="text-center lg:text-left">
                    <img
                      src={currentProgram.cover}
                      alt={`${currentProgram.albumTitle} cover`}
                      className="mx-auto aspect-square w-full max-w-sm rounded-[2rem] object-cover shadow-2xl shadow-black/60 lg:mx-0"
                    />

                    <p className="mt-6 text-sm font-black uppercase tracking-[0.2em] text-emerald-300">
                      Now Showing
                    </p>

                    <h2 className="mt-3 text-4xl font-black sm:text-5xl">
                      {currentProgram.title}
                    </h2>

                    <p className="mt-2 text-lg text-white/55">
                      {currentProgram.artist} • {currentProgram.albumTitle}
                    </p>
                  </div>

                  <div
                    ref={visualizerPanelRef}
                    className={`overflow-hidden rounded-[2rem] border border-white/10 bg-black/55 p-5 backdrop-blur ${
                      isVisualizerFullscreen
                        ? "h-screen w-screen p-8"
                        : ""
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-sm font-black uppercase tracking-[0.18em] text-fuchsia-300">
                        Live Visualizer
                      </p>

                      <div className="flex flex-wrap gap-2">
                        {(
                          [
                            "bars",
                            "wave",
                            "circle",
                            "mirror",
                          ] as VisualizerMode[]
                        ).map(
                          (mode) => (
                            <button
                              key={mode}
                              type="button"
                              onClick={() =>
                                setVisualizerMode(
                                  mode
                                )
                              }
                              className={`rounded-xl px-3 py-2 text-xs font-black uppercase tracking-[0.12em] ${
                                visualizerMode ===
                                mode
                                  ? "bg-white text-black"
                                  : "border border-white/10 bg-white/5 text-white/70"
                              }`}
                            >
                              {mode}
                            </button>
                          )
                        )}

                        <button
                          type="button"
                          onClick={
                            toggleVisualizerFullscreen
                          }
                          className="rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-cyan-100"
                        >
                          {isVisualizerFullscreen
                            ? "Exit Fullscreen"
                            : "Fullscreen"}
                        </button>
                      </div>
                    </div>

                    <canvas
                      ref={canvasRef}
                      className={`mt-4 w-full rounded-2xl ${
                        isVisualizerFullscreen
                          ? "h-[80vh]"
                          : "h-72 sm:h-96"
                      }`}
                      aria-label="Live audio visualizer"
                    />

                    <p className="mt-4 text-center text-sm text-white/40">
                      Current mode:{" "}
                      {visualizerMode.toUpperCase()}
                    </p>
                  </div>
                </div>

                <div className="absolute left-5 top-5 flex items-center gap-3 rounded-full border border-white/10 bg-black/50 px-4 py-2 backdrop-blur">
                  <span className="h-3 w-3 animate-pulse rounded-full bg-red-500" />
                  <span className="text-xs font-black uppercase tracking-[0.16em]">
                    Premium TV Live
                  </span>
                </div>
              </>
            ) : (
              <div className="grid min-h-[520px] place-items-center p-8 text-center text-white/50">
                No Premium TV programs are available.
              </div>
            )}
          </div>

          <div className="mt-6 rounded-[2rem] border border-white/10 bg-black/35 p-5 backdrop-blur">
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={previousProgram}
                className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 font-black"
              >
                Previous
              </button>

              <button
                type="button"
                onClick={togglePlayPause}
                className="min-w-32 rounded-2xl bg-white px-6 py-4 font-black text-black"
              >
                {isPlaying ? "Pause" : "Play"}
              </button>

              <button
                type="button"
                onClick={stopTv}
                className="rounded-2xl border border-red-300/20 bg-red-300/10 px-5 py-4 font-black text-red-200"
              >
                Stop
              </button>

              <button
                type="button"
                onClick={nextProgram}
                className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 font-black"
              >
                Next
              </button>

              <button
                type="button"
                onClick={() => setAutoplay((value) => !value)}
                className={`rounded-2xl border px-5 py-4 font-black ${
                  autoplay
                    ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-200"
                    : "border-white/10 bg-white/5 text-white/60"
                }`}
              >
                Autoplay {autoplay ? "On" : "Off"}
              </button>
            </div>

            <div className="mt-5 flex items-center gap-3">
              <span className="w-12 text-right text-xs text-white/45">
                {formatTime(currentTime)}
              </span>

              <input
                type="range"
                min={0}
                max={Number.isFinite(duration) ? duration : 0}
                step={0.1}
                value={Math.min(currentTime, duration || 0)}
                onChange={(event) => handleSeek(Number(event.target.value))}
                className="min-w-0 flex-1"
                aria-label="TV playback position"
              />

              <span className="w-12 text-xs text-white/45">
                {formatTime(duration)}
              </span>
            </div>

            <div className="mt-4 flex items-center justify-end gap-3">
              <span className="text-xs font-black uppercase tracking-[0.14em] text-white/35">
                Volume
              </span>

              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={volume}
                onChange={(event) => handleVolume(Number(event.target.value))}
                className="w-40"
                aria-label="TV volume"
              />
            </div>
          </div>
        </section>

        <SponsoredBusinessPlacement
          title="Sponsored on Premium TV"
          campaigns={businessCampaigns}
        />

        <PromotedPlacement
          title="Featured on Premium TV"
          campaigns={promotedCampaigns}
        />

        <section className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
          <article className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-6 sm:p-8">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-fuchsia-300">
              TV Controls
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={previousProgram}
                className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 font-black"
              >
                Previous
              </button>

              <button
                type="button"
                onClick={togglePlayPause}
                className="min-w-32 rounded-2xl bg-white px-6 py-4 font-black text-black"
              >
                {isPlaying
                  ? "Pause"
                  : "Play"}
              </button>

              <button
                type="button"
                onClick={stopTv}
                className="rounded-2xl border border-red-300/20 bg-red-300/10 px-5 py-4 font-black text-red-200"
              >
                Stop
              </button>

              <button
                type="button"
                onClick={nextProgram}
                className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 font-black"
              >
                Next
              </button>

              <button
                type="button"
                onClick={() =>
                  setTheaterMode(
                    (value) => !value
                  )
                }
                className="rounded-2xl border border-white/10 bg-white/5 px-5 py-4 font-black"
              >
                Theater Mode {theaterMode ? "On" : "Off"}
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
              Coming Up
            </p>

            <div className="mt-5 grid gap-3">
              {queue
                .slice(
                  currentIndex + 1,
                  currentIndex + 6
                )
                .map((program) => (
                  <button
                    type="button"
                    key={program.id}
                    onClick={() => {
                      const index =
                        queue.findIndex(
                          (item) =>
                            item.id ===
                            program.id
                        );

                      if (index >= 0) {
                        setCurrentIndex(index);
                      }
                    }}
                    className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/20 p-3 text-left hover:bg-white/[0.05]"
                  >
                    <img
                      src={program.cover}
                      alt=""
                      className="h-16 w-16 rounded-xl object-cover"
                    />

                    <span className="min-w-0">
                      <span className="block truncate font-black">
                        {program.title}
                      </span>
                      <span className="block truncate text-xs text-white/40">
                        {program.albumTitle}
                      </span>
                    </span>
                  </button>
                ))}
            </div>
          </aside>
        </section>

        <section className="mt-8 rounded-[2rem] border border-white/10 bg-white/[0.03] p-6 text-white/55">
          <p className="font-black text-white">
            Premium TV Phase 1
          </p>
          <p className="mt-2 leading-7">
            This first version uses album artwork and Premium audio as continuous visual programming. Actual music videos can be added later as video files become available.
          </p>
        </section>
      </div>
    </main>
  );
}
