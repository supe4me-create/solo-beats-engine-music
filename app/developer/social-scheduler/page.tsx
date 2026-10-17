"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  useAuth,
} from "../../auth/AuthContext";

const OWNER_EMAIL =
  "supe4.me@gmail.com";

type SocialPost = {
  postId: string;
  title: string;
  caption: string;
  facebookOptimizationEnabled?: boolean;
  facebookCaption?: string;
  instagramOptimizationEnabled?: boolean;
  instagramCaption?: string;
  tiktokOptimizationEnabled?: boolean;
  tiktokCaption?: string;
  videoUrl: string;

  mediaType?: "video" | "image";
  imageUrl?: string;
  imageStoragePath?: string;

  imageRotationEnabled?: boolean;
  imageRotationImages?: Array<{
    previewUrl: string;
    storagePath: string;
    mediaId?: string;
    fileName?: string;
  }>;

  trackTitle: string;
  platforms: string[];
  youtubeContentType?: "short" | "long";

  youtubeShortTitle?: string;
  youtubeLongTitle?: string;
  youtubeSeoEnabled?: boolean;
  videoSource?: "manager" | "youtube";
  youtubeVideoUrl?: string;
  youtubeShortVideoUrl?: string;
  youtubeLongVideoUrl?: string;
  status: string;
  scheduledFor: string | null;
  timezone: string;
  retryCount: number;
  maxRetries: number;
  publishedUrls:
    Record<string, string>;

  platformStatus?: {
    facebook?: string;
    instagram?: string;
    youtube?: string;
    tiktok?: string;
  };

  tiktokPrivacyLevel?:
    | "PUBLIC_TO_EVERYONE"
    | "SELF_ONLY"
    | string;

  recurringEnabled?: boolean;
  recurringGroupId?: string;
  recurringIndex?: number;
  recurringFrequencyDays?: number;
  recurringEndDate?: string;
  recurringUntilCancelled?: boolean;
  recurringSeriesCancelled?: boolean;

  lastError: string | null;
};

type VideoItem = {
  mediaId: string;
  title: string;
  previewUrl: string | null;
  storagePath: string | null;
};

const platformOptions = [
  {
    id: "facebook",
    label: "Facebook",
  },
  {
    id: "instagram",
    label: "Instagram",
  },
  {
    id: "youtube",
    label: "YouTube",
  },
  {
    id: "tiktok",
    label: "TikTok",
  },
] as const;

function localInputToIso(
  value: string
) {
  if (!value) {
    return "";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  return date.toISOString();
}

export default function SocialSchedulerPage() {
  const {
    user,
    loading,
  } = useAuth();

  const [posts, setPosts] =
    useState<SocialPost[]>([]);

  const [videos, setVideos] =
    useState<VideoItem[]>([]);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const [refreshing, setRefreshing] =
    useState(false);

  // SOLO_SOCIAL_CONNECTION_STATUS_V1
  const [connections, setConnections] =
    useState<any>(null);

  const [saving, setSaving] =
    useState(false);

  // SOLO_RESCHEDULE_PICKER_V1
  const [
    reschedulePostId,
    setReschedulePostId,
  ] = useState("");

  const [
    rescheduleDate,
    setRescheduleDate,
  ] = useState("");

  const [
    rescheduleTime,
    setRescheduleTime,
  ] = useState("");

  const [
    rescheduling,
    setRescheduling,
  ] = useState(false);

  // SOLO_INSTAGRAM_PUBLISHING_STATE_V2
  const [
    facebookPublishing,
    setFacebookPublishing,
  ] = useState(false);
  const [instagramPublishing, setInstagramPublishing] =
    useState(false);

  // SOLO_TIKTOK_PUBLISHER_BUTTON_V1
  const [
    tiktokPublishing,
    setTikTokPublishing,
  ] = useState(false);

  // SOLO_AUTO_PROMOTION_UI_V1
  const [autoPromoting, setAutoPromoting] =
    useState(false);

  const [title, setTitle] =
    useState("");

  const [caption, setCaption] =
    useState("");

  const [
    facebookOptimizationEnabled,
    setFacebookOptimizationEnabled
  ] = useState(true);

  const [
    facebookCaption,
    setFacebookCaption
  ] = useState("");

  const [
    instagramOptimizationEnabled,
    setInstagramOptimizationEnabled
  ] = useState(true);

  const [
    instagramCaption,
    setInstagramCaption
  ] = useState("");

  // SOLO_TIKTOK_AUTO_SEO_V2
  const [
    tiktokOptimizationEnabled,
    setTikTokOptimizationEnabled
  ] = useState(true);

  const [
    tiktokCaption,
    setTikTokCaption
  ] = useState("");

  const [
    tiktokCaptionManuallyEdited,
    setTikTokCaptionManuallyEdited
  ] = useState(false);

  const [trackTitle, setTrackTitle] =
    useState("");

  const [selectedVideoId, setSelectedVideoId] =
    useState("");
  // ============================================================
  // SOLO_DEVICE_UPLOAD_V1
  // Upload directly from the owner's device to Firebase Storage.
  // ============================================================

  const [
    deviceVideo,
    setDeviceVideo,
  ] = useState<{
    previewUrl: string;
    storagePath: string;
    mediaId: string;
    fileName: string;
  } | null>(null);

  const [
    videoRotationVideos,
    setVideoRotationVideos,
  ] = useState<Array<{
    previewUrl: string;
    storagePath: string;
    mediaId: string;
    fileName: string;
  }>>([]);

  const [
    videoRotationEnabled,
    setVideoRotationEnabled,
  ] = useState(false);

  const [
    deviceUploading,
    setDeviceUploading,
  ] = useState(false);

  // ============================================================
  // SOLO_IMAGE_POSTING_V1
  // ============================================================

  const [
    mediaType,
    setMediaType,
  ] = useState<
    "video" | "image"
  >("video");

  // ============================================================
  // SOLO_IMAGE_MUSIC_POST_V1
  // Image + owned music -> vertical MP4 -> social publishers
  // ============================================================

  const [
    imageMusicMode,
    setImageMusicMode,
  ] = useState(false);

  const [
    imageMusicImageFile,
    setImageMusicImageFile,
  ] = useState<File | null>(
    null
  );

  const [
    imageMusicAudioFile,
    setImageMusicAudioFile,
  ] = useState<File | null>(
    null
  );

  const [
    imageMusicDuration,
    setImageMusicDuration,
  ] = useState<
    15 | 30 | 60
  >(30);

  const [imageMusicGenerating, setImageMusicGenerating] = useState(false);
  const soloRenderAbortRef = useRef<AbortController | null>(null);
  const soloRenderCancelRef = useRef(false);
  const soloRenderJobRef = useRef("");
  const soloRenderBusyRef = useRef(false);
  const cancelImageMusicRender = async () => {
    soloRenderCancelRef.current = true;
    setSuccess("CANCELLING RENDERING...");
    const id = soloRenderJobRef.current;
    if (id && user) {
      try {
        const token = await user.getIdToken();
        await fetch("/api/owner/auto-video/generate", {
          method:"POST",
          headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},
          body:JSON.stringify({action:"cancel",jobId:id}),
        });
      } catch (error) {
        console.error("CANCEL_RENDER_REQUEST_FAILED",error);
        setError("Cancel request failed. Please retry Cancel Rendering.");
        return;
      }
    }
    soloRenderAbortRef.current?.abort();
    setSuccess("RENDER CANCELLED");
  };

  // ============================================================
  // SOLO_IMAGE_MUSIC_SECTION_PICKER_V1
  // Lets the owner choose the best part of the uploaded song.
  // ============================================================

  const [
    imageMusicAudioPreviewUrl,
    setImageMusicAudioPreviewUrl,
  ] = useState("");

  const [
    imageMusicAudioDurationSeconds,
    setImageMusicAudioDurationSeconds,
  ] = useState(0);

  const [
    imageMusicClipStartSeconds,
    setImageMusicClipStartSeconds,
  ] = useState(0);

  const imageMusicPreviewAudioRef =
    useRef<HTMLAudioElement | null>(
      null
    );

  const cleanImageMusicTrackName = (
    value: string
  ) =>
    value
      .replace(/\.[^/.]+$/, "")
      .replace(
        /^\s*\d+\s*[-_.()]*\s*/,
        ""
      )
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const formatImageMusicTime = (
    totalSeconds: number
  ) => {
    const safe =
      Math.max(
        0,
        Math.floor(
          Number.isFinite(
            totalSeconds
          )
            ? totalSeconds
            : 0
        )
      );

    const minutes =
      Math.floor(
        safe / 60
      )
        .toString()
        .padStart(
          2,
          "0"
        );

    const seconds =
      (safe % 60)
        .toString()
        .padStart(
          2,
          "0"
        );

    return `${minutes}:${seconds}`;
  };

  const [
    deviceImage,
    setDeviceImage,
  ] = useState<{
    previewUrl: string;
    storagePath: string;
    mediaId: string;
    fileName: string;
  } | null>(null);

  const [
    imageRotationImages,
    setImageRotationImages,
  ] = useState<Array<{
    previewUrl: string;
    storagePath: string;
    mediaId: string;
    fileName: string;
  }>>([]);

  const [
    imageRotationEnabled,
    setImageRotationEnabled,
  ] = useState(false);

  const [
    imageUploading,
    setImageUploading,
  ] = useState(false);

  const [
    imageUploadProgress,
    setImageUploadProgress,
  ] = useState(0);

  const [
    deviceUploadProgress,
    setDeviceUploadProgress,
  ] = useState(0);


  // SOLO_IMAGE_MUSIC_MULTI_IMAGE_V2
  const [
    imageMusicImageFiles,
    setImageMusicImageFiles,
  ] = useState<File[]>([]);
  const [videoSource, setVideoSource] =
    useState<"manager" | "youtube">("manager");

  const [youtubeVideoUrl, setYoutubeVideoUrl] =
    useState("");

  const [
    youtubeShortVideoUrl,
    setYoutubeShortVideoUrl
  ] = useState("");

  const [
    youtubeLongVideoUrl,
    setYoutubeLongVideoUrl
  ] = useState("");

  const [
    youtubeShortVideoReady,
    setYoutubeShortVideoReady
  ] = useState(false);

  const [
    youtubeLongVideoReady,
    setYoutubeLongVideoReady
  ] = useState(false);

  const [
    youtubePreviewLoading,
    setYoutubePreviewLoading
  ] = useState(false);

  const [
    youtubePreviewError,
    setYoutubePreviewError
  ] = useState("");

  const [platforms, setPlatforms] =
    useState<string[]>([
      "facebook",
      "instagram",
      "youtube",
      "tiktok",
    ]);

  const [youtubeContentType, setYoutubeContentType] =
    useState<"short" | "long">("short");
  // ============================================================
  // SOLO_YOUTUBE_VISIBILITY_V1
  // ============================================================

  const [
    youtubePrivacyStatus,
    setYoutubePrivacyStatus,
  ] = useState<
    "public" |
    "unlisted" |
    "private"
  >("public");


  const [
    youtubeShortTitle,
    setYoutubeShortTitle
  ] = useState("");

  const [
    youtubeLongTitle,
    setYoutubeLongTitle
  ] = useState("");

  const [
    youtubeSeoEnabled,
    setYoutubeSeoEnabled
  ] = useState(true);
  const [
    youtubeShortDescription,
    setYoutubeShortDescription
  ] = useState("");

  const [
    youtubeLongDescription,
    setYoutubeLongDescription
  ] = useState("");

  const [scheduleDateTime, setScheduleDateTime] =
    useState("");

  // ============================================================
  // SOLO_RECURRING_POSTING_UI_V3
  // ============================================================

  const [
    recurringEnabled,
    setRecurringEnabled
  ] = useState(false);

  const [
    recurringEndDate,
    setRecurringEndDate
  ] = useState("");

  const [
    recurringFrequencyDays,
    setRecurringFrequencyDays
  ] = useState<
    1 | 2 | 3 | 7
  >(1);

  const [
    recurringUntilCancelled,
    setRecurringUntilCancelled
  ] = useState(false);

  const isOwner =
    user?.email?.toLowerCase() ===
    OWNER_EMAIL;

  const selectedVideo =
    useMemo(
      () =>
        videos.find(
          item =>
            item.mediaId ===
            selectedVideoId
        ) || null,
      [
        videos,
        selectedVideoId,
      ]
    );

  // SOLO_OWNER_BEST_PART_V1
  const [ownerShortMode, setOwnerShortMode] = useState<"long" | "short">("long");
  const [ownerShortPick, setOwnerShortPick] = useState<"manual" | "auto">("manual");
  const [ownerShortDuration, setOwnerShortDuration] = useState<15 | 30 | 60>(30);
  const [ownerShortStart, setOwnerShortStart] = useState(0);
  // SOLO_TIMELINE_MINIMAL_V1
  const [ownerShortVideoDuration, setOwnerShortVideoDuration] = useState(300);
  const ownerShortPreviewRef = useRef<HTMLVideoElement | null>(null);
  const [ownerShortBusy, setOwnerShortBusy] = useState(false);
  const [ownerShortAnalyzing, setOwnerShortAnalyzing] = useState(false);
  const [ownerShortResult, setOwnerShortResult] = useState<{
    previewUrl: string; storagePath: string; mediaId: string; fileName: string;
  } | null>(null);
  const ownerShortSource =
    selectedVideo?.storagePath
      ? {
          previewUrl: selectedVideo.previewUrl || "",
          storagePath: selectedVideo.storagePath,
          mediaId: selectedVideo.mediaId,
          fileName: selectedVideo.title
        }
      : deviceVideo || videoRotationVideos[0] || null;

  function cancelOwnerShort() {
    if (ownerShortBusy || ownerShortAnalyzing) return;
    setOwnerShortMode("long");
    setOwnerShortPick("manual");
    setOwnerShortDuration(30);
    setOwnerShortStart(0);
    setOwnerShortResult(null);
    setError("");
    setSuccess("Original video restored. Short selection cancelled.");
  }

  async function ownerPickBestPart() {
    if (!user || !isOwner || !ownerShortSource?.storagePath) {
      setError("Choose or upload an original video first."); return;
    }
    setOwnerShortAnalyzing(true); setOwnerShortResult(null); setError(""); setSuccess("");
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/owner/social-scheduler/best-part", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ sourceStoragePath: ownerShortSource.storagePath, duration: ownerShortDuration })
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Highlight analysis failed.");
      setOwnerShortStart(data.startSeconds);
      setOwnerShortPick("auto");
      setSuccess(`Recommended start: ${data.startSeconds} seconds. Preview and create your Short.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Highlight analysis failed.");
    } finally { setOwnerShortAnalyzing(false); }
  }

  async function ownerCreateShort() {
    if (!user || !isOwner || !ownerShortSource?.storagePath) {
      setError("Choose or upload an original video first."); return;
    }
    setOwnerShortBusy(true); setError(""); setSuccess("");
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/owner/social-scheduler/create-short", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ sourceStoragePath: ownerShortSource.storagePath, duration: ownerShortDuration, startSeconds: ownerShortStart })
      });
      const data = await response.json();
      if (!response.ok || !data.success || !data.short?.videoUrl || !data.short?.storagePath) {
        throw new Error(data.error || "Short could not be created.");
      }
      setOwnerShortResult({
        previewUrl: data.short.videoUrl,
        storagePath: data.short.storagePath,
        mediaId: `owner-short-${Date.now()}`,
        fileName: data.short.fileName || `owner-short-${ownerShortDuration}s.mp4`
      });
      setSuccess("Owner Short created. Preview it before scheduling.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Short creation failed.");
    } finally { setOwnerShortBusy(false); }
  }

  // ============================================================
  // SOLO_SOCIAL_HISTORY_V1
  // SOLO_PLATFORM_HISTORY_FILTERS_V1
  // ============================================================

  const [
    historyFilter,
    setHistoryFilter,
  ] = useState<
    "all" |
    "upcoming" |
    "published" |
    "failed" |
    "cancelled" |
    "facebook" |
    "instagram" |
    "tiktok" |
    "youtube_short" |
    "youtube_long"
  >("all");

  const filteredPosts =
    useMemo(
      () => {
        if (historyFilter === "all") {
          return posts;
        }

        if (historyFilter === "upcoming") {
          return posts.filter(
            post =>
              post.status === "scheduled" ||
              post.status === "draft" ||
              post.status === "publishing"
          );
        }

        if (historyFilter === "published") {
          return posts.filter(
            post =>
              post.status === "published" ||
              post.status === "existing_verified"
          );
        }

        if (historyFilter === "facebook") {
          return posts.filter(
            post =>
              post.platforms.includes("facebook")
          );
        }

        if (historyFilter === "instagram") {
          return posts.filter(
            post =>
              post.platforms.includes("instagram")
          );
        }

        if (historyFilter === "tiktok") {
          return posts.filter(
            post =>
              post.platforms.includes("tiktok")
          );
        }

        if (historyFilter === "youtube_short") {
          return posts.filter(
            post =>
              post.platforms.includes("youtube") &&
              post.youtubeContentType !== "long"
          );
        }

        if (historyFilter === "youtube_long") {
          return posts.filter(
            post =>
              post.platforms.includes("youtube") &&
              post.youtubeContentType === "long"
          );
        }

        return posts.filter(
          post =>
            post.status === historyFilter
        );
      },
      [
        posts,
        historyFilter,
      ]
    );

  const loadPosts =
    useCallback(async () => {
      if (!user || !isOwner) {
        return;
      }

      setRefreshing(true);
      setError("");

      try {
        const token =
          await user.getIdToken();

        const [
          queueResponse,
          videoResponse,
        ] =
          await Promise.all([
            fetch(
              "/api/owner/social-scheduler",
              {
                headers: {
                  Authorization:
                    `Bearer ${token}`,
                },
                cache: "no-store",
              }
            ),

            fetch(
              "/api/owner/videos",
              {
                headers: {
                  Authorization:
                    `Bearer ${token}`,
                },
                cache: "no-store",
              }
            ),
          ]);

        const [
          queueData,
          videoData,
        ] =
          await Promise.all([
            queueResponse.json(),
            videoResponse.json(),
          ]);

        if (
          !queueResponse.ok ||
          !queueData.success
        ) {
          throw new Error(
            queueData.error ||
              "Scheduler could not be loaded."
          );
        }

        if (
          !videoResponse.ok ||
          !videoData.success
        ) {
          throw new Error(
            videoData.error ||
              "Video Manager could not be loaded."
          );
        }

        try {
          const connectionResponse =
            await fetch(
              "/api/owner/social-connections",
              {
                headers: {
                  Authorization:
                    `Bearer ${token}`,
                },
                cache: "no-store",
              }
            );

          const connectionData =
            await connectionResponse.json();

          if (
            connectionResponse.ok &&
            connectionData.success
          ) {
            setConnections(
              connectionData
            );
          }
        } catch {
          setConnections(null);
        }

        setPosts(
          Array.isArray(queueData.posts)
            ? queueData.posts
            : []
        );

        setVideos(
          Array.isArray(videoData.videos)
            ? videoData.videos
                .filter(
                  (item: any) =>
                    typeof item.storagePath === "string" &&
                    item.storagePath.trim().length > 0
                )
                .map(
                (
                  item: any
                ) => ({
                  mediaId:
                    String(
                      item.mediaId ||
                      ""
                    ),
                  title:
                    String(
                      item.title ||
                      "Untitled Video"
                    ),
                  previewUrl:
                    typeof item.previewUrl ===
                    "string"
                      ? item.previewUrl
                      : null,
                  storagePath:
                    typeof item.storagePath ===
                    "string"
                      ? item.storagePath
                      : null,
                })
              )
            : []
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Scheduler could not be loaded."
        );
      } finally {
        setRefreshing(false);
      }
    }, [user, isOwner]);

  useEffect(() => {
    void loadPosts();
  }, [loadPosts]);

  // SOLO_AUTO_VIDEO_QUERY_HANDOFF_V1
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      videos.length === 0
    ) {
      return;
    }

    const params =
      new URLSearchParams(
        window.location.search
      );

    const incomingVideoId =
      params.get("videoMediaId") || "";

    const incomingTitle =
      params.get("title") || "";

    const incomingTrack =
      params.get("track") || "";

    if (
      incomingVideoId &&
      !selectedVideoId &&
      videos.some(
        item =>
          item.mediaId ===
          incomingVideoId
      )
    ) {
      setSelectedVideoId(
        incomingVideoId
      );
    }

    if (
      incomingTitle &&
      !title
    ) {
      setTitle(
        incomingTitle
      );
    }

    if (
      incomingTrack &&
      !trackTitle
    ) {
      setTrackTitle(
        incomingTrack
      );
    }
  }, [
    videos,
    selectedVideoId,
    title,
    trackTitle,
  ]);

  function togglePlatform(
    platform: string
  ) {
    setPlatforms(
      current =>
        current.includes(
          platform
        )
          ? current.filter(
              item =>
                item !==
                platform
            )
          : [
              ...current,
              platform,
            ]
    );
  }

  // ============================================================
  // SOLO_IMAGE_AUTO_CAPTIONS_V1
  // Automatically fills image-post captions while keeping
  // manual editing available before scheduling.
  // ============================================================

  useEffect(() => {
    if (
      mediaType !== "image" ||
      !deviceImage
    ) {
      return;
    }

    const rawImageTitle =
      deviceImage.fileName
        .replace(/\.[^/.]+$/, "")
        .replace(/[-_]+/g, " ")
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .trim();

    const knownImageTitle =
      rawImageTitle
        .replace(/^solobeats$/i, "Solo Beats")
        .replace(/^solo beats$/i, "Solo Beats");

    const formattedImageTitle =
      knownImageTitle
        .split(/\s+/)
        .filter(Boolean)
        .map(word =>
          word.length <= 3 &&
          word === word.toUpperCase()
            ? word
            : word.charAt(0).toUpperCase() +
              word.slice(1).toLowerCase()
        )
        .join(" ");

    const inferredTitle =
      trackTitle.trim() ||
      title.trim() ||
      formattedImageTitle ||
      "Solo Beats Promotion";

    if (!title.trim()) {
      setTitle(inferredTitle);
    }

    if (!trackTitle.trim()) {
      setTrackTitle(inferredTitle);
    }

    const website =
      "https://www.solobeatsenginemusic.com";

    const mainAutoCaption =
      `${inferredTitle} is now featured on SOLO BEATS ENGINE MUSIC.\n\n` +
      `Your home for music, creativity and premium entertainment.\n` +
      `Stream. Discover. Create. Promote.\n` +
      `${website}\n\n` +
      `#SoloBeats #SoloBeatsEngineMusic #NewMusic #MusicPromotion #IndependentArtist`;

    const facebookAutoCaption =
      `${inferredTitle} is now featured on SOLO BEATS ENGINE MUSIC.\n\n` +
      `Visit ${website} to stream, discover, create and promote.\n\n` +
      `#SoloBeats #SoloBeatsEngineMusic #MusicPromotion #NewMusic`;

    const instagramAutoCaption =
      `${inferredTitle}\n\n` +
      `Now featured on SOLO BEATS ENGINE MUSIC.\n` +
      `Stream. Discover. Create. Promote.\n` +
      `${website}\n\n` +
      `#SoloBeats #SoloBeatsEngineMusic #NewMusic #MusicPromo #IndependentArtist #MusicMarketing`;

    if (
      !caption.trim() ||
      /Solo Beats New Music/i.test(
        caption
      )
    ) {
      setCaption(mainAutoCaption);
    }

    if (!facebookCaption.trim()) {
      setFacebookCaption(
        facebookAutoCaption
      );
    }

    if (!instagramCaption.trim()) {
      setInstagramCaption(
        instagramAutoCaption
      );
    }
  }, [
    mediaType,
    deviceImage,
    title,
    trackTitle,
    caption,
    facebookCaption,
    instagramCaption,
  ]);

  // ============================================================
  // SOLO_IMAGE_MUSIC_SECTION_PICKER_EFFECTS_V1
  // ============================================================

  useEffect(() => {
    if (!imageMusicMode) {
      return;
    }

    if (!imageMusicAudioFile) {
      setImageMusicAudioPreviewUrl("");
      setImageMusicAudioDurationSeconds(0);
      setImageMusicClipStartSeconds(0);
      return;
    }

    const objectUrl =
      URL.createObjectURL(
        imageMusicAudioFile
      );

    setImageMusicAudioPreviewUrl(
      objectUrl
    );

    const inferredTrack =
      cleanImageMusicTrackName(
        imageMusicAudioFile.name
      );

    const currentTrack =
      trackTitle.trim();

    const currentTitle =
      title.trim();

    if (
      !currentTrack ||
      /solo beats new music/i.test(
        currentTrack
      ) ||
      /services poster/i.test(
        currentTrack
      ) ||
      currentTrack ===
        currentTitle
    ) {
      setTrackTitle(
        inferredTrack ||
          "Solo Beats New Music"
      );
    }

    return () => {
      URL.revokeObjectURL(
        objectUrl
      );
    };
  }, [
    imageMusicMode,
    imageMusicAudioFile,
    trackTitle,
    title,
  ]);

  useEffect(() => {
    const maxStart =
      Math.max(
        0,
        Math.floor(
          imageMusicAudioDurationSeconds -
            imageMusicDuration
        )
      );

    if (
      imageMusicClipStartSeconds >
      maxStart
    ) {
      setImageMusicClipStartSeconds(
        maxStart
      );
    }
  }, [
    imageMusicAudioDurationSeconds,
    imageMusicDuration,
    imageMusicClipStartSeconds,
  ]);
  // ============================================================
  // SOLO_IMAGE_MUSIC_AUTO_CAPTIONS_V1
  // Automatically builds editable captions for IMAGE + MUSIC.
  // ============================================================

  useEffect(() => {
    if (!imageMusicMode) {
      return;
    }

    const imageTitle =
      imageMusicImageFile?.name
        ?.replace(/\.[^/.]+$/, "")
        .replace(/[-_]+/g, " ")
        .trim() ||
      "";

    const audioTitle =
      imageMusicAudioFile?.name
        ?.replace(/\.[^/.]+$/, "")
        .replace(/[-_]+/g, " ")
        .trim() ||
      "";

    const sourceTitle =
      trackTitle.trim() ||
      title.trim() ||
      audioTitle ||
      imageTitle ||
      "Solo Beats New Music";

    const website =
      "https://www.solobeatsenginemusic.com";

    const mainImageMusicCaption =
      `${sourceTitle} by Solo Beats\n\n` +
      `Original music from SOLO BEATS ENGINE MUSIC.\n` +
      `Listen. Discover. Create. Promote.\n` +
      `${website}\n\n` +
      `#SoloBeats #SoloBeatsEngineMusic #NewMusic #OriginalMusic #MusicPromotion #IndependentArtist`;

    const facebookImageMusicCaption =
      `${sourceTitle} by Solo Beats\n\n` +
      `Turn it up and discover more original music from SOLO BEATS ENGINE MUSIC.\n\n` +
      `Listen and explore more at ${website}\n\n` +
      `#SoloBeats #SoloBeatsEngineMusic #NewMusic #OriginalMusic #MusicPromotion`;

    const instagramImageMusicCaption =
      `${sourceTitle} by Solo Beats\n\n` +
      `Original music from SOLO BEATS ENGINE MUSIC.\n` +
      `Listen. Follow. Share.\n` +
      `${website}\n\n` +
      `#SoloBeats #SoloBeatsEngineMusic #NewMusic #MusicReels #OriginalMusic #IndependentArtist #MusicDiscovery`;

    if (
      !caption.trim() ||
      /Solo Beats New Music/i.test(
        caption
      )
    ) {
      setCaption(
        mainImageMusicCaption
      );
    }

    if (
      facebookOptimizationEnabled &&
      (
        !facebookCaption.trim() ||
        /Solo Beats New Music/i.test(
          facebookCaption
        )
      )
    ) {
      setFacebookCaption(
        facebookImageMusicCaption
      );
    }

    if (
      instagramOptimizationEnabled &&
      (
        !instagramCaption.trim() ||
        /Solo Beats New Music/i.test(
          instagramCaption
        )
      )
    ) {
      setInstagramCaption(
        instagramImageMusicCaption
      );
    }
  }, [
    imageMusicMode,
    imageMusicImageFile,
    imageMusicAudioFile,
    title,
    trackTitle,
    caption,
    facebookCaption,
    instagramCaption,
    facebookOptimizationEnabled,
    instagramOptimizationEnabled,
  ]);
  // ============================================================
  // SOLO_TIKTOK_VIDEO_AUTO_SEO_V2
  // ============================================================

  useEffect(() => {
    if (
      mediaType !== "video" ||
      !tiktokOptimizationEnabled
    ) {
      return;
    }

    const uploadedFileTitle =
      deviceVideo?.fileName
        ?.replace(/\.[^/.]+$/, "")
        .replace(/[-_]+/g, " ")
        .trim() ||
      "";

    const sourceTitle =
      trackTitle.trim() ||
      title.trim() ||
      selectedVideo?.title?.trim() ||
      uploadedFileTitle ||
      "Solo Beats New Music";

    const website =
      "https://www.solobeatsenginemusic.com";

    const automaticTikTokCaption =
      `${sourceTitle} | Solo Beats\n\n` +
      `New music from SOLO BEATS ENGINE MUSIC.\n` +
      `Stream. Discover. Create. Promote.\n` +
      `${website}\n\n` +
      `#SoloBeats #SoloBeatsEngineMusic #NewMusic #TikTokMusic #MusicTok #OriginalMusic #IndependentArtist #MusicPromotion`;

    if (!tiktokCaptionManuallyEdited) {
      setTikTokCaption(
        automaticTikTokCaption
      );
    }
  }, [
    mediaType,
    tiktokOptimizationEnabled,
    trackTitle,
    title,
    selectedVideo,
    deviceVideo,
    tiktokCaptionManuallyEdited,
  ]);

  // SOLO_YOUTUBE_CONNECT_V1
  // SOLO_YOUTUBE_PUBLISHER_BUTTON_V1
  async function runYouTubePublisher() {
    if (!user) return;

    setError("");
    setSuccess("");

    try {
      const token =
        await user.getIdToken();

      const response =
        await fetch(
          "/api/owner/social-publisher/run",
          {
            method: "POST",

            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          }
        );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.error ||
          "Publisher could not run."
        );
      }

      const youtubeResult =
        Array.isArray(
          data.results
        )
          ? data.results.find(
              (item: any) =>
                item.youtube ===
                  "uploaded_public" ||
                item.youtube ===
                  "uploaded_private" ||
                item.youtube ===
                  "failed"
            )
          : null;

      if (
        youtubeResult?.youtube ===
        "uploaded_public"
      ) {
        setSuccess(
          "YOUTUBE PUBLISHED SUCCESSFULLY."
        );
      }
      else if (
        youtubeResult?.youtube ===
        "uploaded_private"
      ) {
        setSuccess(
          "YOUTUBE UPLOAD SUCCESSFUL ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â Google kept the video private because the API project still requires verification/audit."
        );
      }
      else if (
        youtubeResult?.youtube ===
        "failed"
      ) {
        setError(
          youtubeResult.error ||
          "YouTube upload failed."
        );
      }
      else {
        setSuccess(
          `Publisher checked ${data.due || 0} due promotion(s).`
        );
      }

      await loadPosts();

    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Publisher failed."
      );
    }
  }


  // SOLO_INSTAGRAM_PUBLISHER_BUTTON_V1
    async function runFacebookPublisher() {
    if (!user || facebookPublishing) {
      return;
    }

    setError("");
    setSuccess("");
    setFacebookPublishing(true);

    try {
      const token =
        await user.getIdToken();

      const response =
        await fetch(
          "/api/owner/social-publisher/run",
          {
            method: "POST",
            headers: {
              Authorization:
                `Bearer ${token}`,
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify({
                platform:
                  "facebook",
                manual:
                  true,
              }),
          }
        );

      const data =
        await response.json();

      if (
        !response.ok ||
        data?.success === false
      ) {
        throw new Error(
          data?.error ||
            "Facebook publisher could not run."
        );
      }

      setSuccess(
        "Facebook publisher finished."
      );

      await loadPosts();
    }
    catch (publisherError) {
      setError(
        publisherError instanceof Error
          ? publisherError.message
          : "Facebook publisher could not run."
      );
    }
    finally {
      setFacebookPublishing(false);
    }
  }
async function runInstagramPublisher() {
    if (!user || instagramPublishing) return;

    setError("");
    setSuccess("");
    setInstagramPublishing(true);

    try {
      const token =
        await user.getIdToken();

      const response =
        await fetch(
          "/api/owner/social-publisher/run",
          {
            method: "POST",

            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          }
        );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.error ||
          "Instagram publisher could not run."
        );
      }

      const instagramResult =
        Array.isArray(
          data.results
        )
          ? data.results.find(
              (item: any) =>
                item.instagram ===
                  "published" ||
                item.instagram ===
                  "already_published" ||
                item.instagram ===
                  "already_publishing" ||
                item.instagram ===
                  "failed" ||
                item.instagram ===
                  "not_connected"
            )
          : null;

      if (
        instagramResult?.instagram ===
        "published"
      ) {
        setSuccess(
          "INSTAGRAM REEL PUBLISHED SUCCESSFULLY."
        );
      }
      else if (
        instagramResult?.instagram ===
        "already_published"
      ) {
        setSuccess(
          "INSTAGRAM REEL WAS ALREADY PUBLISHED."
        );
      }
      else if (
        instagramResult?.instagram ===
        "already_publishing"
      ) {
        setSuccess(
          "INSTAGRAM PUBLISH IS ALREADY IN PROGRESS ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â DUPLICATE REQUEST BLOCKED."
        );
      }
      else if (
        instagramResult?.instagram ===
        "not_connected"
      ) {
        setError(
          "Instagram is not connected."
        );
      }
      else if (
        instagramResult?.instagram ===
        "failed"
      ) {
        setError(
          instagramResult.error ||
          "Instagram Reel publishing failed."
        );
      }
      else {
        setSuccess(
          `Publisher checked ${data.due || 0} due promotion(s). No due Instagram Reel was found.`
        );
      }

      await loadPosts();

    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Instagram publisher failed."
      );
    } finally {
      setInstagramPublishing(false);
    }
  }
  async function connectYouTube() {
    if (!user) return;

    setError("");
    setSuccess("");

    try {
      const token =
        await user.getIdToken();

      const response =
        await fetch(
          "/api/owner/social-connections/youtube/start",
          {
            method: "POST",
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          }
        );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data.success ||
        !data.authUrl
      ) {
        throw new Error(
          data.error ||
          "YouTube connection could not start."
        );
      }

      window.location.href =
        data.authUrl;

    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "YouTube connection failed."
      );
    }
  }

  // ============================================================
  // SOLO_TIKTOK_PUBLISHER_BUTTON_V1
  // ============================================================

  async function runTikTokPublisher() {
    if (
      !user ||
      tiktokPublishing
    ) {
      return;
    }

    setError("");
    setSuccess("");
    setTikTokPublishing(true);

    try {
      const token =
        await user.getIdToken();

      const response =
        await fetch(
          "/api/owner/social-publisher/run",
          {
            method:
              "POST",

            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          }
        );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.error ||
          "TikTok publisher could not run."
        );
      }

      const tiktokResult =
        Array.isArray(
          data.results
        )
          ? data.results.find(
              (item: any) =>
                item.tiktok ===
                  "published" ||
                item.tiktok ===
                  "processing" ||
                item.tiktok ===
                  "already_published" ||
                item.tiktok ===
                  "already_publishing" ||
                item.tiktok ===
                  "failed" ||
                item.tiktok ===
                  "not_connected"
            )
          : null;

      if (
        tiktokResult?.tiktok ===
        "published"
      ) {
        setSuccess(
          "TIKTOK PUBLISHED SUCCESSFULLY."
        );
      }
      else if (
        tiktokResult?.tiktok ===
        "processing"
      ) {
        setSuccess(
          "TIKTOK POST IS PROCESSING."
        );
      }
      else if (
        tiktokResult?.tiktok ===
        "already_published"
      ) {
        setSuccess(
          "TIKTOK POST WAS ALREADY PUBLISHED."
        );
      }
      else if (
        tiktokResult?.tiktok ===
        "already_publishing"
      ) {
        setSuccess(
          "TIKTOK PUBLISH IS ALREADY IN PROGRESS."
        );
      }
      else if (
        tiktokResult?.tiktok ===
        "not_connected"
      ) {
        setError(
          "TikTok is not connected."
        );
      }
      else if (
        tiktokResult?.tiktok ===
        "failed"
      ) {
        setError(
          tiktokResult.error ||
          "TikTok publishing failed."
        );
      }
      else {
        setSuccess(
          `Publisher checked ${data.due || 0} due promotion(s). No due TikTok post was found.`
        );
      }

      await loadPosts();
    }
    catch (publisherError) {
      setError(
        publisherError instanceof Error
          ? publisherError.message
          : "TikTok publisher could not run."
      );
    }
    finally {
      setTikTokPublishing(false);
    }
  }


  // SOLO_TIKTOK_CONNECT_V1
  async function connectTikTok() {
    if (!user) return;

    setError("");
    setSuccess("");

    try {
      const token =
        await user.getIdToken();

      const response =
        await fetch(
          "/api/owner/social-connections/tiktok/start",
          {
            method: "POST",
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          }
        );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data.success ||
        !data.authUrl
      ) {
        throw new Error(
          data.error ||
          "TikTok connection could not start."
        );
      }

      window.location.href =
        data.authUrl;

    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "TikTok connection failed."
      );
    }
  }

  // SOLO_META_CONNECT_V1
  async function connectMeta() {
    if (!user) return;

    setError("");
    setSuccess("");

    try {
      const token =
        await user.getIdToken();

      const response =
        await fetch(
          "/api/owner/social-connections/meta/start",
          {
            method: "POST",
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          }
        );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data.success ||
        !data.authUrl
      ) {
        throw new Error(
          data.error ||
          "Facebook/Instagram connection could not start."
        );
      }

      window.location.href =
        data.authUrl;

    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Facebook/Instagram connection failed."
      );
    }
  }

  async function checkLiveInstagramStatus() {
    if (!user) return;

    setError("");
    setSuccess("");

    try {
      const token =
        await user.getIdToken(true);

      const response =
        await fetch(
          "/api/owner/social-connections?ts=" + Date.now(),
          {
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
            cache: "no-store",
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
          "Live connection status failed."
        );
      }

      const instagram =
        data?.instagram || {};

      setSuccess(
        "LIVE INSTAGRAM STATUS: " +
        JSON.stringify({
          configured:
            instagram.configured,
          connected:
            instagram.connected,
          username:
            instagram.username,
        })
      );

    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Live Instagram status failed."
      );
    }
  }
  // SOLO_INSTAGRAM_BUSINESS_CONNECT_V1
  async function connectInstagram() {
    if (!user) return;

    setError("");
    setSuccess("");

    try {
      const token =
        await user.getIdToken();

      const response =
        await fetch(
          "/api/owner/social-connections/instagram/start",
          {
            method: "POST",
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          }
        );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data.success ||
        !data.authUrl
      ) {
        throw new Error(
          data.error ||
          "Instagram connection could not start."
        );
      }

      window.location.href =
        data.authUrl;

    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Instagram connection failed."
      );
    }
  }
  async function autoPromoteForMe() {
    if (!user) return;

    setError("");
    setSuccess("");

    if (
      !selectedVideo &&
      !deviceVideo &&
      videoRotationVideos.length === 0
    ) {
      setError(
        "Choose or upload the source video."
      );
      return;
    }

    // ============================================================
    // SOLO_AUTOMATIC_PROMOTION_METADATA_V1
    // No manual title or track-name entry required.
    //
    // Priority:
    // 1. Existing manually entered value, if present.
    // 2. Video Manager title.
    // 3. Uploaded device filename without extension.
    // 4. Safe SOLO BEATS fallback.
    // ============================================================

    const automaticSourceTitle =
      selectedVideo?.title?.trim() ||
      deviceVideo?.fileName
        ?.replace(/\.[^/.]+$/, "")
        .replace(/[-_]+/g, " ")
        .trim() ||
      "Solo Beats Promotion";

    const automaticPromotionTitle =
      title.trim() ||
      automaticSourceTitle;

    const automaticTrackTitle =
      trackTitle.trim() ||
      automaticSourceTitle;

    if (!scheduleDateTime) {
      setError("Choose the posting time.");
      return;
    }

    const scheduledFor =
      localInputToIso(scheduleDateTime);

    if (!scheduledFor) {
      setError("Choose a valid posting time.");
      return;
    }

    setAutoPromoting(true);

    try {
      const token =
        await user.getIdToken();

      const response =
        await fetch(
          "/api/owner/social-scheduler/auto-promotion",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              title: automaticPromotionTitle,
              trackTitle: automaticTrackTitle,
              videoMediaId:
                  videoRotationVideos[0]?.mediaId ||
                  deviceVideo?.mediaId ||
                  selectedVideo?.mediaId ||
                  "",

              sourceStoragePath:
                  videoRotationVideos[0]?.storagePath ||
                  deviceVideo?.storagePath ||
                  selectedVideo?.storagePath ||
                  "",

              videoRotationEnabled:
                videoRotationEnabled &&
                videoRotationVideos.length > 1,

              videoRotationSources:
                videoRotationVideos.length > 0
                  ? videoRotationVideos
                  : deviceVideo
                    ? [deviceVideo]
                    : selectedVideo
                      ? [{
                          previewUrl:
                            selectedVideo.previewUrl || "",
                          storagePath:
                            selectedVideo.storagePath || "",
                          mediaId:
                            selectedVideo.mediaId,
                          fileName:
                            selectedVideo.title,
                        }]
                      : [],

              scheduledFor,

              recurringEnabled,
              recurringEndDate,
              recurringFrequencyDays,
              recurringUntilCancelled,

              platforms,
              youtubeContentType,
              youtubePrivacyStatus,
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error ||
          "Automatic promotion failed."
        );
      }

      setCaption(data.caption || "");

      setSuccess(
        "AUTO PROMOTION READY ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â short clip, caption and schedule created."
      );

      await loadPosts();

    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Automatic promotion failed."
      );
    } finally {
      setAutoPromoting(false);
    }
  }

    // ============================================================
  // SOLO_DEVICE_UPLOAD_V1_ENGINE
  // ============================================================

  async function uploadDeviceVideo(
    file: File
  ) {
    if (!user) {
      setError("Owner sign-in is required.");
      return;
    }

    if (!file) {
      return;
    }

    if (!file.type.startsWith("video/")) {
      setError(
        "Choose a video file from your device."
      );
      return;
    }

    setError("");
    setSuccess("");
    setDeviceUploading(true);
    setDeviceUploadProgress(0);

    const previousDeviceVideo =
      deviceVideo;

    try {
      const {
        ref,
        uploadBytesResumable,
        getDownloadURL,
        deleteObject,
      } = await import(
        "firebase/storage"
      );

      const {
        firebaseStorage,
      } = await import(
        "../../../lib/firebaseClient"
      );

      const mediaId =
        crypto.randomUUID();

      const originalName =
        file.name || "video.mp4";

      const safeName =
        originalName
          .replace(
            /[^a-zA-Z0-9._-]+/g,
            "-"
          )
          .replace(
            /-+/g,
            "-"
          )
          .slice(
            0,
            120
          );

      const storagePath =
        `social-promotions/device/${user.uid}/${mediaId}/${safeName}`;

      const storageRef =
        ref(
          firebaseStorage,
          storagePath
        );

      const task =
        uploadBytesResumable(
          storageRef,
          file,
          {
            contentType:
              file.type ||
              "video/mp4",

            customMetadata: {
              source:
                "solo-beats-social-scheduler",

              ownerUid:
                user.uid,

              originalFileName:
                originalName,
            },
          }
        );

      await new Promise<void>(
        (
          resolve,
          reject
        ) => {
          task.on(
            "state_changed",

            snapshot => {
              const total =
                snapshot.totalBytes || 1;

              const percent =
                Math.round(
                  (
                    snapshot.bytesTransferred /
                    total
                  ) * 100
                );

              setDeviceUploadProgress(
                percent
              );
            },

            error => {
              reject(error);
            },

            () => {
              resolve();
            }
          );
        }
      );

      const previewUrl =
        await getDownloadURL(
          task.snapshot.ref
        );

      const uploadedVideo = {
        previewUrl,
        storagePath,
        mediaId:
          `device-${mediaId}`,
        fileName:
          originalName,
      };

      setDeviceVideo(
        current =>
          current || uploadedVideo
      );

      setVideoRotationVideos(
        current => {
          if (
            current.some(
              item =>
                item.storagePath ===
                uploadedVideo.storagePath
            )
          ) {
            return current;
          }

          return [
            ...current,
            uploadedVideo,
          ];
        }
      );

      /*
       * Device uploads use the same scheduler/publisher
       * contract as Video Manager media.
       */
      setVideoSource(
        "manager"
      );

      setSelectedVideoId("");

      setOwnerShortResult(null);
      setDeviceUploadProgress(
        100
      );

      setSuccess(
        "Video uploaded from device and ready to schedule."
      );


    } catch (uploadError) {
      console.error(
        "DEVICE VIDEO UPLOAD ERROR:",
        uploadError
      );

      setError(
        uploadError instanceof Error
          ? uploadError.message
          : "Video could not be uploaded from this device."
      );
    } finally {
      setDeviceUploading(false);
    }
  }


  async function removeRotationVideo(
    video: {
      previewUrl: string;
      storagePath: string;
      mediaId: string;
      fileName: string;
    }
  ) {
    if (!video?.storagePath) {
      return;
    }

    setError("");
    setSuccess("");
    setDeviceUploading(true);

    try {
      const {
        ref,
        deleteObject,
      } = await import(
        "firebase/storage"
      );

      const {
        firebaseStorage,
      } = await import(
        "../../../lib/firebaseClient"
      );

      try {
        await deleteObject(
          ref(
            firebaseStorage,
            video.storagePath
          )
        );
      } catch (deleteError: any) {
        if (
          deleteError?.code !==
          "storage/object-not-found"
        ) {
          throw deleteError;
        }
      }

      setVideoRotationVideos(
        current => {
          const remaining =
            current.filter(
              item =>
                item.storagePath !==
                video.storagePath
            );

          if (
            remaining.length < 2
          ) {
            setVideoRotationEnabled(
              false
            );
          }

          setDeviceVideo(
            currentDevice => {
              if (
                currentDevice?.storagePath !==
                video.storagePath
              ) {
                return currentDevice;
              }

              return (
                remaining[0] ||
                null
              );
            }
          );

          return remaining;
        }
      );

      setSuccess(
        `${video.fileName} removed from video rotation.`
      );
    } catch (deleteError) {
      console.error(
        "ROTATION VIDEO DELETE ERROR:",
        deleteError
      );

      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Video could not be removed."
      );
    } finally {
      setDeviceUploading(false);
    }
  }


  async function removeDeviceVideo() {
    if (!deviceVideo) {
      return;
    }

    setError("");
    setSuccess("");
    setDeviceUploading(true);

    try {
      const {
        ref,
        deleteObject,
      } = await import(
        "firebase/storage"
      );

      const {
        firebaseStorage,
      } = await import(
        "../../../lib/firebaseClient"
      );

      try {
        await deleteObject(
          ref(
            firebaseStorage,
            deviceVideo.storagePath
          )
        );
      } catch (deleteError: any) {
        if (
          deleteError?.code !==
          "storage/object-not-found"
        ) {
          throw deleteError;
        }
      }

      setDeviceVideo(null);
      setVideoRotationVideos([]);
      setVideoRotationEnabled(false);
      setDeviceUploadProgress(0);

      setSuccess(
        "Device video removed."
      );
    } catch (removeError) {
      console.error(
        "DEVICE VIDEO REMOVE ERROR:",
        removeError
      );

      setError(
        removeError instanceof Error
          ? removeError.message
          : "Video could not be removed."
      );
    } finally {
      setDeviceUploading(false);
    }
  }

// ============================================================
// SOLO_TIKTOK_AUTO_IMAGE_SIZE_V1
// Automatically converts uploaded images to a TikTok-safe JPEG.
// Preserves aspect ratio and never enlarges smaller images.
// ============================================================

async function makeTikTokSafeImage(
  file: File
): Promise<File> {
  const MAX_DIMENSION =
    1080;

  const QUALITY =
    0.92;

  const objectUrl =
    URL.createObjectURL(
      file
    );

  try {
    const image =
      await new Promise<HTMLImageElement>(
        (
          resolve,
          reject
        ) => {
          const img =
            new Image();

          img.onload =
            () =>
              resolve(
                img
              );

          img.onerror =
            () =>
              reject(
                new Error(
                  "Image could not be read."
                )
              );

          img.src =
            objectUrl;
        }
      );

    const originalWidth =
      image.naturalWidth ||
      image.width;

    const originalHeight =
      image.naturalHeight ||
      image.height;

    if (
      !originalWidth ||
      !originalHeight
    ) {
      throw new Error(
        "Image dimensions could not be detected."
      );
    }

    const scale =
      Math.min(
        1,
        MAX_DIMENSION /
          originalWidth,
        MAX_DIMENSION /
          originalHeight
      );

    const width =
      Math.max(
        1,
        Math.round(
          originalWidth *
            scale
        )
      );

    const height =
      Math.max(
        1,
        Math.round(
          originalHeight *
            scale
        )
      );

    const canvas =
      document.createElement(
        "canvas"
      );

    canvas.width =
      width;

    canvas.height =
      height;

    const context =
      canvas.getContext(
        "2d"
      );

    if (!context) {
      throw new Error(
        "Image processor could not start."
      );
    }

    /*
     * Flatten transparent images onto white
     * because TikTok receives a JPEG.
     */
    context.fillStyle =
      "#ffffff";

    context.fillRect(
      0,
      0,
      width,
      height
    );

    context.drawImage(
      image,
      0,
      0,
      width,
      height
    );

    const blob =
      await new Promise<Blob>(
        (
          resolve,
          reject
        ) => {
          canvas.toBlob(
            result => {
              if (!result) {
                reject(
                  new Error(
                    "Image resizing failed."
                  )
                );

                return;
              }

              resolve(
                result
              );
            },

            "image/jpeg",
            QUALITY
          );
        }
      );

    const baseName =
      (
        file.name ||
        "image"
      )
        .replace(
          /\.[^/.]+$/,
          ""
        )
        .replace(
          /[^a-zA-Z0-9._-]+/g,
          "-"
        )
        .replace(
          /-+/g,
          "-"
        )
        .replace(
          /^-+|-+$/g,
          ""
        ) ||
      "image";

    return new File(
      [
        blob,
      ],
      `${baseName}-social-ready.jpg`,
      {
        type:
          "image/jpeg",

        lastModified:
          Date.now(),
      }
    );
  }
  finally {
    URL.revokeObjectURL(
      objectUrl
    );
  }
}

// ============================================================
// SOLO_IMAGE_MUSIC_GENERATOR_V1
// Upload cover + owned audio, render vertical social MP4,
// then hand the generated video to the existing publishers.
// ============================================================

// ============================================================
// SOLO_IMAGE_MUSIC_MULTI_GENERATOR_V2
// ============================================================

async function generateAllImageMusicPostVideos() {
  if (soloRenderBusyRef.current) return;
  soloRenderBusyRef.current = true;
  soloRenderCancelRef.current = false;
  setImageMusicGenerating(true);
  try {
  const files =
    imageMusicImageFiles.length > 0
      ? imageMusicImageFiles
      : imageMusicImageFile
        ? [imageMusicImageFile]
        : [];

  if (files.length === 0) {
    setError(
      "Choose at least one image first."
    );

    return;
  }

  if (!imageMusicAudioFile) {
    setError(
      "Choose your music file first."
    );

    return;
  }

  setError("");

  for (
    let index = 0;
    index < files.length;
    index += 1
  ) {
    setSuccess(
      "CREATING VIDEO " +
      String(index + 1) +
      " OF " +
      String(files.length) +
      "..."
    );

    if (soloRenderCancelRef.current) break;
    await generateImageMusicPostVideo(files[index]);
  }

  if (soloRenderCancelRef.current) {
    setSuccess("RENDER CANCELLED - remaining images skipped.");
    return;
  }
  setSuccess(
    String(files.length) +
    " IMAGE + MUSIC VIDEO" +
    (files.length === 1 ? "" : "S") +
    " ADDED TO DAILY ROTATION."
  );
  }
  finally {
    soloRenderBusyRef.current = false;
    soloRenderJobRef.current = "";
    soloRenderAbortRef.current = null;
    setImageMusicGenerating(false);
  }
}
async function generateImageMusicPostVideo(
  imageFileOverride?: File
) {
  const activeImageMusicImageFile =
    imageFileOverride ||
    imageMusicImageFile;
  if (!user) {
    setError(
      "Owner sign-in is required."
    );

    return;
  }

  if (!activeImageMusicImageFile) {
    setError(
      "Choose an image first."
    );

    return;
  }

  if (!imageMusicAudioFile) {
    setError(
      "Choose your music file first."
    );

    return;
  }

  setError("");
  setSuccess("");
  const {
    ref,
    uploadBytes,
    deleteObject,
  } = await import(
    "firebase/storage"
  );

  const {
    firebaseStorage,
  } = await import(
    "../../../lib/firebaseClient"
  );

  const uploadId =
    crypto.randomUUID();

  const safeExtension = (
    fileName: string,
    fallback: string
  ) => {
    const extension =
      fileName
        .split(".")
        .pop()
        ?.toLowerCase()
        .replace(
          /[^a-z0-9]/g,
          ""
        );

    return (
      extension ||
      fallback
    );
  };

  const audioExtension =
    safeExtension(
      imageMusicAudioFile.name,
      "mp3"
    );

  const imageExtension =
    safeExtension(
      activeImageMusicImageFile.name,
      "jpg"
    );

  const basePath =
    `media/auto-video-source/${user.uid}/${uploadId}`;

  const audioStoragePath =
    `${basePath}/audio.${audioExtension}`;

  const imageStoragePath =
    `${basePath}/cover.${imageExtension}`;

  const audioRef =
    ref(
      firebaseStorage,
      audioStoragePath
    );

  const imageRef =
    ref(
      firebaseStorage,
      imageStoragePath
    );

  try {
    setSuccess(
      "UPLOADING YOUR MUSIC + IMAGE..."
    );

    await Promise.all([
      uploadBytes(
        audioRef,
        imageMusicAudioFile,
        {
          contentType:
            imageMusicAudioFile.type ||
            "application/octet-stream",
        }
      ),

      uploadBytes(
        imageRef,
        activeImageMusicImageFile,
        {
          contentType:
            activeImageMusicImageFile.type ||
            "application/octet-stream",
        }
      ),
    ]);

    setSuccess(
      "CREATING IMAGE + MUSIC VIDEO..."
    );

    const token =
      await user.getIdToken();

    if (soloRenderCancelRef.current) return;
    const controller = new AbortController();
    soloRenderAbortRef.current = controller;
    const jobId = crypto.randomUUID();
    soloRenderJobRef.current = jobId;
    const response =
      await fetch(
        "/api/owner/auto-video/generate",
        {
          signal: controller.signal,
          method: "POST",

          headers: {
            Authorization:
              `Bearer ${token}`,

            "Content-Type":
              "application/json",
          },

          body:
            JSON.stringify({
              jobId,
              audioStoragePath,
              imageStoragePath,

              audioName:
                imageMusicAudioFile.name,

              imageName:
                activeImageMusicImageFile.name,

              title:
                title.trim() ||
                trackTitle.trim() ||
                imageMusicAudioFile.name
                  .replace(
                    /\.[^/.]+$/,
                    ""
                  ) ||
                "Solo Beats Promotion",

              artist:
                "Solo Beats",

              duration:
                imageMusicDuration,

              clipStartSeconds:
                imageMusicClipStartSeconds,

              format:
                "vertical",

              visualMode:
                "auto",

              visualStyle:
                "cinematic",

              intensity:
                55,

              bpm:
                120,

              introSeconds:
                0.4,

              outroSeconds:
                0.6,
            }),
        }
      );

    if (soloRenderCancelRef.current) return;
    const responseText = await response.text();
    if (soloRenderCancelRef.current) return;

    let data:
      any = null;

    try {
      data =
        JSON.parse(
          responseText
        );
    }
    catch {
      throw new Error(
        response.ok
          ? "Video generator returned an invalid response."
          : `Video generator failed (${response.status}): ${responseText.slice(
              0,
              180
            )}`
      );
    }

    if (
      !response.ok ||
      !data?.success
    ) {
      throw new Error(
        data?.error ||
        "IMAGE + MUSIC generation failed."
      );
    }

    const videoUrl =
      String(
        data?.video?.videoUrl ||
        ""
      );

    const storagePath =
      String(
        data?.video?.storagePath ||
        ""
      );

    const mediaId =
      String(
        data?.video?.mediaId ||
        data?.video?.id ||
        ""
      );

    if (
      !videoUrl ||
      !storagePath ||
      !mediaId
    ) {
      throw new Error(
        "Generated video information is incomplete."
      );
    }

    if (soloRenderCancelRef.current) return;
    const generatedVideo = {
      previewUrl:
        videoUrl,

      storagePath,

      mediaId,

      fileName:
        `${
          trackTitle.trim() ||
          title.trim() ||
          "solo-beats"
        }-image-music.mp4`,
    };

    setDeviceVideo(
      generatedVideo
    );

    setVideoRotationVideos(
      current => {
        const withoutDuplicate =
          current.filter(
            item =>
              item.mediaId !==
              generatedVideo.mediaId
          );

        const next = [
          ...withoutDuplicate,
          generatedVideo,
        ];

        setVideoRotationEnabled(
          next.length > 1
        );

        return next;
      }
    );

    setSelectedVideoId(
      ""
    );

    setVideoSource(
      "manager"
    );

    setYoutubeContentType(
      "short"
    );

    if (
      !trackTitle.trim()
    ) {
      setTrackTitle(
        imageMusicAudioFile.name
          .replace(
            /\.[^/.]+$/,
            ""
          )
          .replace(
            /[-_]+/g,
            " "
          )
          .trim()
      );
    }

    setSuccess(
      "IMAGE + MUSIC VIDEO ADDED TO DAILY ROTATION ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â choose platforms and schedule it."
    );
  }
  catch (generationError) {
    if (soloRenderCancelRef.current) return;
    console.error(
      "IMAGE + MUSIC GENERATOR ERROR:",
      generationError
    );

    setError(
      generationError instanceof Error
        ? generationError.message
        : "IMAGE + MUSIC video could not be created."
    );
  }
  finally {
    await Promise.all([
      deleteObject(
        audioRef
      ).catch(
        () => {}
      ),

      deleteObject(
        imageRef
      ).catch(
        () => {}
      ),
    ]);

    soloRenderAbortRef.current = null;
    soloRenderJobRef.current = "";
  }
}

// ============================================================
// SOLO_IMAGE_POSTING_UPLOAD_V1
// ============================================================

async function uploadDeviceImage(
  file: File
) {
  if (!user) {
    setError("Owner sign-in is required.");
    return;
  }

  if (!file) {
    return;
  }

  if (!file.type.startsWith("image/")) {
    setError(
      "Choose an image file from your device."
    );
    return;
  }

  setError("");
  setSuccess("");
  setImageUploading(true);
  setImageUploadProgress(0);

  const previousImage =
    deviceImage;

  try {
    const uploadFile =
      await makeTikTokSafeImage(
        file
      );

    const {
      ref,
      uploadBytesResumable,
      getDownloadURL,
      deleteObject,
    } = await import(
      "firebase/storage"
    );

    const {
      firebaseStorage,
    } = await import(
      "../../../lib/firebaseClient"
    );

    const mediaId =
      crypto.randomUUID();

    const originalName =
      file.name || "image.jpg";

    const processedName =
      uploadFile.name ||
      "social-ready.jpg";

    const safeName =
      processedName
        .replace(
          /[^a-zA-Z0-9._-]+/g,
          "-"
        )
        .replace(
          /-+/g,
          "-"
        )
        .slice(
          0,
          120
        );

    /*
     * SOLO_IMAGE_UPLOAD_STORAGE_FIX_V2
     *
     * Use the same established Firebase Storage area already used
     * successfully by direct device video uploads.
     */
    const storagePath =
      `social-promotions/device/${user.uid}/${mediaId}/image-${safeName}`;

    const storageRef =
      ref(
        firebaseStorage,
        storagePath
      );

    const task =
      uploadBytesResumable(
        storageRef,
        uploadFile,
        {
          contentType:
            "image/jpeg",

          customMetadata: {
            source:
              "solo-beats-social-scheduler",

            mediaType:
              "image",

            ownerUid:
              user.uid,

            originalFileName:
              originalName,

            processedForTikTok:
              "true",

            processedWidthLimit:
              "1080",
          },
        }
      );

    await new Promise<void>(
      (
        resolve,
        reject
      ) => {
        task.on(
          "state_changed",

          snapshot => {
            const total =
              snapshot.totalBytes || 1;

            const percent =
              Math.round(
                (
                  snapshot.bytesTransferred /
                  total
                ) * 100
              );

            setImageUploadProgress(
              percent
            );
          },

          error => {
            reject(error);
          },

          () => {
            resolve();
          }
        );
      }
    );

    const previewUrl =
      await getDownloadURL(
        task.snapshot.ref
      );

    const uploadedImage = {
      previewUrl,
      storagePath,
      mediaId:
        `image-${mediaId}`,
      fileName:
        originalName,
    };

    setDeviceImage(
      current =>
        current || uploadedImage
    );

    setImageRotationImages(
      current => {
        if (
          current.some(
            item =>
              item.storagePath ===
              uploadedImage.storagePath
          )
        ) {
          return current;
        }

        return [
          ...current,
          uploadedImage,
        ];
      }
    );

    setMediaType("image");

    setPlatforms(
      current => {
        const clean =
          current.filter(
            item =>
              item !== "youtube"
          );

        return clean.length
          ? clean
          : [
              "facebook",
              "instagram",
            ];
      }
    );

    setImageUploadProgress(
      100
    );

    setSuccess(
      "Image uploaded and ready to schedule."
    );

    if (
      previousImage &&
      previousImage.storagePath !==
        storagePath
    ) {
      try {
        await deleteObject(
          ref(
            firebaseStorage,
            previousImage.storagePath
          )
        );
      }
      catch (cleanupError) {
        console.warn(
          "Previous image cleanup warning:",
          cleanupError
        );
      }
    }
  }
  catch (uploadError) {
    console.error(
      "DEVICE IMAGE UPLOAD ERROR:",
      uploadError
    );

    setError(
      uploadError instanceof Error
        ? uploadError.message
        : "Image could not be uploaded."
    );
  }
  finally {
    setImageUploading(false);
  }
}

async function removeDeviceImage() {
  if (!deviceImage) {
    return;
  }

  setError("");
  setSuccess("");
  setImageUploading(true);

  try {
    const {
      ref,
      deleteObject,
    } = await import(
      "firebase/storage"
    );

    const {
      firebaseStorage,
    } = await import(
      "../../../lib/firebaseClient"
    );

    try {
      await deleteObject(
        ref(
          firebaseStorage,
          deviceImage.storagePath
        )
      );
    }
    catch (deleteError: any) {
      if (
        deleteError?.code !==
        "storage/object-not-found"
      ) {
        throw deleteError;
      }
    }

    setDeviceImage(null);
    setImageUploadProgress(0);

    setSuccess(
      "Device image removed."
    );
  }
  catch (removeError) {
    setError(
      removeError instanceof Error
        ? removeError.message
        : "Image could not be removed."
    );
  }
  finally {
    setImageUploading(false);
  }
}

async function validateYoutubePreview(
    kind: "short" | "long",
    videoUrl: string
  ) {
    setYoutubePreviewError("");

    if (!videoUrl.trim()) {
      if (kind === "short") {
        setYoutubeShortVideoReady(false);
      } else {
        setYoutubeLongVideoReady(false);
      }

      return;
    }

    try {
      setYoutubePreviewLoading(true);

      const token =
        await user?.getIdToken();

      if (!token) {
        throw new Error("OWNER_AUTH_REQUIRED");
      }

      const response =
        await fetch(
          "/api/owner/social-scheduler/youtube-preview",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
              Authorization:
                `Bearer ${token}`,
            },
            body: JSON.stringify({
              videoUrl:
                videoUrl.trim(),
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error ||
          "YouTube video could not be validated."
        );
      }

      if (kind === "short") {
        setYoutubeShortVideoUrl(
          data.canonicalUrl || videoUrl.trim()
        );
        setYoutubeShortVideoReady(true);
      } else {
        setYoutubeLongVideoUrl(
          data.canonicalUrl || videoUrl.trim()
        );
        setYoutubeLongVideoReady(true);
      }

      setYoutubePreviewError("");
    } catch (error) {
      if (kind === "short") {
        setYoutubeShortVideoReady(false);
      } else {
        setYoutubeLongVideoReady(false);
      }

      setYoutubePreviewError(
        error instanceof Error
          ? error.message
          : "YouTube video could not be validated."
      );
    } finally {
      setYoutubePreviewLoading(false);
    }
  }
  async function createPost(
    scheduled: boolean
  ) {
    if (!user) return;

    setError("");
    setSuccess("");

    if (
      imageMusicMode &&
      !deviceVideo &&
      videoRotationVideos.length === 0
    ) {
      setError(
        "Create the IMAGE + MUSIC video before scheduling."
      );
      return;
    }

    if (
      mediaType === "video" &&
      videoSource === "manager" &&
      !selectedVideo &&
      !deviceVideo &&
      videoRotationVideos.length === 0
    ) {
      setError(
        "Choose or upload at least one promotional video."
      );
      return;
    }

    if (
      mediaType === "video" &&
      videoRotationEnabled &&
      videoRotationVideos.length < 2
    ) {
      setError(
        "Daily Video Rotation requires at least 2 videos."
      );
      return;
    }

    if (
      mediaType === "video" &&
      videoSource === "youtube" &&
      youtubeContentType === "short" &&
      !youtubeShortVideoUrl.trim()
    ) {
      setError(
        "Paste the YouTube Short video link."
      );
      return;
    }

    if (
      mediaType === "video" &&
      videoSource === "youtube" &&
      youtubeContentType === "long" &&
      !youtubeLongVideoUrl.trim()
    ) {
      setError(
        "Paste the YouTube Long video link."
      );
      return;
    }

    if (
      mediaType === "video" &&
      videoSource === "youtube" &&
      youtubeContentType === "short" &&
      !youtubeShortVideoReady
    ) {
      setError(
        "Verify the Short video before scheduling."
      );
      return;
    }

    if (
      mediaType === "video" &&
      videoSource === "youtube" &&
      youtubeContentType === "long" &&
      !youtubeLongVideoReady
    ) {
      setError(
        "Verify the Long video before scheduling."
      );
      return;
    }

    if (
      mediaType === "image" &&
      !deviceImage &&
      imageRotationImages.length === 0
    ) {
      setError(
        "Upload at least one image before scheduling."
      );
      return;
    }

    if (
      mediaType === "image" &&
      platforms.includes("youtube")
    ) {
      setError(
        "Image posts do not support YouTube."
      );
      return;
    }

    if (
      platforms.length === 0
    ) {
      setError(
        "Choose at least one platform."
      );
      return;
    }

    if (
      scheduled &&
      !scheduleDateTime
    ) {
      setError(
        "Choose a posting date and time."
      );
      return;
    }

        // ============================================================
    // SOLO_SHORT_FORM_AUTO_CLIP_ON_SCHEDULE_V2
    // Full uploaded video -> automatic 30-second vertical clip.
    //
    // Instagram Reel:
    //   Automatically creates a vertical short-form clip.
    //
    // YouTube Short:
    //   Automatically creates a vertical short-form clip instead
    //   of accidentally uploading the original full video.
    // ============================================================

    if (ownerShortMode === "short" && !imageMusicMode && !ownerShortResult) {
      setError("Create the Owner Short before scheduling.");
      return;
    }

    const needsInstagramAutoClip =
      mediaType === "video" &&
      !imageMusicMode &&
      scheduled &&
      videoSource === "manager" &&
      platforms.length === 1 &&
      platforms.includes("instagram");

    const needsYoutubeShortAutoClip =
      mediaType === "video" &&
      !imageMusicMode &&
      scheduled &&
      videoSource === "manager" &&
      platforms.includes("youtube") &&
      youtubeContentType === "short";

    if (
      !ownerShortResult &&
      (needsInstagramAutoClip || needsYoutubeShortAutoClip)
    ) {
      await autoPromoteForMe();
      return;
    }
setSaving(true);

    try {
      const token =
        await user.getIdToken();

      const response =
        await fetch(
          "/api/owner/social-scheduler",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
              Authorization:
                `Bearer ${token}`,
            },
            body: JSON.stringify({
              action: "create",

              mediaType,

              imageUrl:
                mediaType === "image"
                  ? (
                      imageRotationImages[0]?.previewUrl ||
                      deviceImage?.previewUrl ||
                      ""
                    )
                  : "",

              imageStoragePath:
                mediaType === "image"
                  ? (
                      imageRotationImages[0]?.storagePath ||
                      deviceImage?.storagePath ||
                      ""
                    )
                  : "",

              imageRotationEnabled:
                mediaType === "image" &&
                imageRotationEnabled &&
                imageRotationImages.length > 1,

              imageRotationImages:
                mediaType === "image"
                  ? (
                      imageRotationImages.length > 0
                        ? imageRotationImages
                        : deviceImage
                          ? [deviceImage]
                          : []
                    )
                  : [],

              title:
                title.trim() ||
                trackTitle.trim() ||
                "Solo Beats Promotion",
              caption:
                caption.trim(),
                            facebookOptimizationEnabled,

              facebookCaption:
                facebookCaption.trim(),

              instagramOptimizationEnabled,

              instagramCaption:
                instagramCaption.trim(),

              tiktokOptimizationEnabled,

              tiktokCaption:
                tiktokCaption.trim(),

              trackTitle:
                trackTitle.trim(),
              videoUrl:
                mediaType === "video" &&
                videoSource === "youtube"
                  ? (
                      youtubeContentType === "long"
                        ? youtubeLongVideoUrl.trim()
                        : youtubeShortVideoUrl.trim()
                    )
                  : (
                      ownerShortResult?.previewUrl ||
                      deviceVideo?.previewUrl ||
                      selectedVideo?.previewUrl ||
                      ""
                    ),

              videoMediaId:
                mediaType === "video" &&
                videoSource === "manager"
                  ? (
                      ownerShortResult?.mediaId ||
                      videoRotationVideos[0]?.mediaId ||
                      deviceVideo?.mediaId ||
                      selectedVideo?.mediaId ||
                      ""
                    )
                  : "",

              videoStoragePath:
                mediaType === "video" &&
                videoSource === "manager"
                  ? (
                      ownerShortResult?.storagePath ||
                      videoRotationVideos[0]?.storagePath ||
                      deviceVideo?.storagePath ||
                      selectedVideo?.storagePath ||
                      ""
                    )
                  : "",

              videoRotationEnabled:
                mediaType === "video" &&
                !ownerShortResult &&
                videoRotationVideos.length > 1 &&
                (
                  imageMusicMode ||
                  videoRotationEnabled
                ),

              videoRotationSources:
                mediaType === "video" &&
                videoSource === "manager"
                  ? (
                      ownerShortResult ? [ownerShortResult] :
                      videoRotationVideos.length > 0
                        ? videoRotationVideos
                        : deviceVideo
                          ? [deviceVideo]
                          : []
                    )
                  : [],

              videoSource,

              youtubeVideoUrl:
                videoSource === "youtube"
                  ? (
                      youtubeContentType === "long"
                        ? youtubeLongVideoUrl.trim()
                        : youtubeShortVideoUrl.trim()
                    )
                  : "",

              youtubeShortVideoUrl:
                youtubeShortVideoUrl.trim(),

              youtubeLongVideoUrl:
                youtubeLongVideoUrl.trim(),

              platforms:
                mediaType === "image"
                  ? platforms.filter(
                      item =>
                        item !== "youtube"
                    )
                  : videoSource === "youtube"
                    ? ["youtube"]
                    : platforms,

              youtubeContentType,
              youtubePrivacyStatus,
              youtubeShortTitle:
                youtubeShortTitle.trim(),

              youtubeLongTitle:
                youtubeLongTitle.trim(),

              youtubeSeoEnabled,
              youtubeShortDescription:
                youtubeShortDescription.trim(),

              youtubeLongDescription:
                youtubeLongDescription.trim(),
              scheduledFor:
                scheduled
                  ? localInputToIso(
                      scheduleDateTime
                    )
                  : "",
              timezone:
                "America/New_York",

              recurringEnabled,
              recurringEndDate,
              recurringFrequencyDays,
              recurringUntilCancelled,
            }),
          }
        );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.error ||
            "Post could not be created."
        );
      }

      setSuccess(
        scheduled
          ? "Promotion scheduled successfully."
          : "Promotion saved as draft."
      );

      setTitle("");
      setCaption("");
      setFacebookOptimizationEnabled(true);
      setFacebookCaption("");
      setInstagramOptimizationEnabled(true);
      setInstagramCaption("");
      setTikTokOptimizationEnabled(true);
      setTikTokCaption("");
      setTikTokCaptionManuallyEdited(false);
      setTrackTitle("");
      setSelectedVideoId("");

      /*
       * Device upload remains available until the post
       * has actually been saved/scheduled successfully.
       */
      setDeviceVideo(null);
      setVideoRotationVideos([]);
      setVideoRotationEnabled(false);
      setDeviceUploadProgress(0);

      setDeviceImage(null);
      setImageRotationImages([]);
      setImageRotationEnabled(false);
      setImageUploadProgress(0);
      setMediaType("video");

      setImageMusicMode(false);
      setImageMusicImageFile(null);
      setImageMusicImageFiles([]);
      setImageMusicAudioFile(null);
      setImageMusicDuration(30);
      setImageMusicAudioPreviewUrl("");
      setImageMusicAudioDurationSeconds(0);
      setImageMusicClipStartSeconds(0);

      setVideoSource("manager");
      setYoutubeVideoUrl("");
      setYoutubeShortVideoUrl("");
      setYoutubeLongVideoUrl("");
      setYoutubeShortVideoReady(false);
      setYoutubeLongVideoReady(false);
      setYoutubePreviewError("");
      setYoutubeShortTitle("");
      setYoutubeLongTitle("");
      setYoutubeSeoEnabled(true);
      setYoutubePrivacyStatus("public");
      setYoutubeShortDescription("");
      setYoutubeLongDescription("");
      setScheduleDateTime("");
      setRecurringEnabled(false);
      setRecurringEndDate("");
      setRecurringFrequencyDays(1);
      setRecurringUntilCancelled(false);

      await loadPosts();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Post could not be created."
      );
    } finally {
      setSaving(false);
    }
  }

  async function actionPost(
    action:
      | "cancel"
      | "cancel_series"
      | "retry",
    postId: string
  ) {
    if (!user) return;

    setError("");
    setSuccess("");

    try {
      const token =
        await user.getIdToken();

      const response =
        await fetch(
          "/api/owner/social-scheduler",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
              Authorization:
                `Bearer ${token}`,
            },
            body:
              JSON.stringify({
                action,
                postId,
              }),
          }
        );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.error ||
            "Action failed."
        );
      }

      setSuccess(
        action === "cancel_series"
          ? "Daily recurring series cancelled."
          : action === "cancel"
            ? "Post cancelled."
            : "Post queued for retry."
      );

      await loadPosts();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Action failed."
      );
    }
  }

  // ============================================================
  // SOLO_ADD_TIKTOK_TO_SERIES_UI_V1
  // ============================================================

  async function addTikTokToSeries(
    postId: string
  ) {
    if (!user) {
      setError(
        "Owner authentication required."
      );
      return;
    }

    const confirmed =
      window.confirm(
        "Add TikTok to all future posts in this recurring series?"
      );

    if (!confirmed) {
      return;
    }

    setError("");
    setSuccess("");

    try {
      const token =
        await user.getIdToken();

      const response =
        await fetch(
          "/api/owner/social-scheduler",
          {
            method: "POST",

            headers: {
              Authorization:
                `Bearer ${token}`,

              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                action:
                  "add_tiktok_to_series",

                postId,
              }),
          }
        );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.error ||
            "Could not add TikTok to the series."
        );
      }

      setSuccess(
        `TikTok added to this recurring series. ${Number(
          data.updatedCount || 0
        )} future post(s) updated.`
      );

      await loadPosts();
    }
    catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "TikTok series update failed."
      );
    }
  }
  async function deletePost(
    postId: string
  ) {
    if (!user) {
      setError(
        "Owner authentication required."
      );
      return;
    }

    const confirmed =
      window.confirm(
        "Permanently delete this promotion from the scheduler? If it was already published to Instagram or YouTube, this will only remove the scheduler record."
      );

    if (!confirmed) {
      return;
    }

    setError("");
    setSuccess("");

    try {
      const token =
        await user.getIdToken();

      const response =
        await fetch(
          "/api/owner/social-scheduler/delete",
          {
            method: "DELETE",
            headers: {
              "Content-Type":
                "application/json",
              Authorization:
                `Bearer ${token}`,
            },
            body:
              JSON.stringify({
                postId,
              }),
          }
        );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.error ||
            "Promotion could not be deleted."
        );
      }

      setSuccess(
        "Promotion deleted."
      );

      await loadPosts();

    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Promotion could not be deleted."
      );
    }
  }
  function openReschedulePicker(
    postId: string,
    scheduledFor: string | null
  ) {
    const source =
      scheduledFor
        ? new Date(scheduledFor)
        : new Date(
            Date.now() +
            5 * 60 * 1000
          );

    const pad = (
      value: number
    ) =>
      String(value)
        .padStart(2, "0");

    const date =
      `${source.getFullYear()}-${pad(
        source.getMonth() + 1
      )}-${pad(
        source.getDate()
      )}`;

    const time =
      `${pad(
        source.getHours()
      )}:${pad(
        source.getMinutes()
      )}`;

    setReschedulePostId(
      postId
    );

    setRescheduleDate(
      date
    );

    setRescheduleTime(
      time
    );

    setError("");
    setSuccess("");
  }

  async function saveReschedule() {
    if (
      !user ||
      !reschedulePostId
    ) {
      return;
    }

    if (
      !rescheduleDate ||
      !rescheduleTime
    ) {
      setError(
        "Choose both a date and time."
      );
      return;
    }

    const scheduledFor =
      localInputToIso(
        `${rescheduleDate}T${rescheduleTime}`
      );

    if (!scheduledFor) {
      setError(
        "Choose a valid date and time."
      );
      return;
    }

    try {
      setRescheduling(true);
      setError("");
      setSuccess("");

      const token =
        await user.getIdToken();

      const response =
        await fetch(
          "/api/owner/social-scheduler",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
              Authorization:
                `Bearer ${token}`,
            },
            body:
              JSON.stringify({
                action:
                  "reschedule",
                postId:
                  reschedulePostId,
                scheduledFor,
              }),
          }
        );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.error ||
            "Post could not be rescheduled."
        );
      }

      setSuccess(
        "Post rescheduled."
      );

      setReschedulePostId("");
      setRescheduleDate("");
      setRescheduleTime("");

      await loadPosts();
    }
    catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Post could not be rescheduled."
      );
    }
    finally {
      setRescheduling(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black p-8 text-white">
        Loading...
      </main>
    );
  }

  if (!user || !isOwner) {
    return (
      <main className="min-h-screen bg-black p-8 text-white">
        <h1 className="text-3xl font-black">
          Owner access only
        </h1>

        <Link
          href="/account"
          className="mt-5 inline-flex rounded-xl bg-white px-5 py-3 font-black text-black"
        >
          OPEN ACCOUNT
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen w-full overflow-x-hidden bg-[#050505] px-3 py-12 text-white sm:px-5 lg:px-8">
      <div className="mx-auto w-full min-w-0 max-w-7xl overflow-hidden">

        <div className="flex flex-wrap items-start justify-between gap-5">

          <div>
            <p className="text-xs font-black tracking-[0.25em] text-red-400">
              SOLO BEATS PROMOTION SYSTEM
            </p>

            <h1 className="mt-2 text-4xl font-black md:text-6xl">
              Social Promotion Scheduler
            </h1>

            <p className="mt-3 max-w-3xl text-zinc-400">
              Facebook, Instagram, YouTube and TikTok promotions from one queue.
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              void loadPosts()
            }
            disabled={refreshing}
            className="rounded-xl border border-white/15 bg-white/5 px-5 py-3 font-black disabled:opacity-50"
          >
            {refreshing
              ? "REFRESHING..."
              : "REFRESH"}
          </button>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">

          <Link
            href="/developer/control-room"
            className="rounded-xl border border-white/10 px-4 py-3 text-sm font-black"
          >
            CONTROL ROOM
          </Link>

          <Link
            href="/developer/videos"
            className="rounded-xl border border-white/10 px-4 py-3 text-sm font-black"
          >
            VIDEO MANAGER
          </Link>

          <Link
            href="/developer/artist-promotions"
            className="rounded-xl border border-white/10 px-4 py-3 text-sm font-black"
          >
            ARTIST PROMOTIONS
          </Link>

        </div>

        {success ? (
          <div className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 font-bold text-emerald-200">
            {success}
          </div>
        ) : null}

        {error ? (
          <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">
            {error}
          </div>
        ) : null}

        <section className="mt-8 w-full min-w-0 max-w-full overflow-hidden rounded-3xl border border-white/10 bg-[#0b0b0b] p-4 sm:p-6">

          <p className="text-xs font-black tracking-[0.2em] text-red-400">
            PLATFORM CONNECTIONS
          </p>

          <h2 className="mt-2 text-3xl font-black">
            Publishing Accounts
          </h2>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">

            <div>
              <ConnectionCard
                label="YouTube"
                configured={
                  connections?.youtube?.configured === true
                }
                connected={
                  connections?.youtube?.connected === true
                }
                onConnect={
                  connectYouTube
                }
              />

              {/* SOLO_RECONNECT_YOUTUBE_V1 */}
              <button
                type="button"
                onClick={() =>
                  void connectYouTube()
                }
                className="mt-3 w-full rounded-xl bg-red-700 px-4 py-3 text-sm font-black text-white"
              >
                RECONNECT YOUTUBE
              </button>

              {connections?.youtube?.connected === true ? (
                <button
                  type="button"
                  onClick={() =>
                    void runYouTubePublisher()
                  }
                  className="mt-3 w-full rounded-xl bg-red-500 px-4 py-3 text-sm font-black text-white"
                >
                  RUN YOUTUBE PUBLISHER NOW
                </button>
              ) : null}
            </div>

            <div>
              <ConnectionCard
                label="Facebook"
                configured={
                  connections?.facebook?.configured === true
                }
                connected={
                  connections?.facebook?.connected === true
                }
                onConnect={
                  connectMeta
                }
              />

              {/* SOLO_RECONNECT_FACEBOOK_V1 */}
              <button
                type="button"
                onClick={() =>
                  void connectMeta()
                }
                className="mt-3 w-full rounded-xl bg-blue-700 px-4 py-3 text-sm font-black text-white"
              >
                RECONNECT FACEBOOK
              </button>

              {connections?.facebook?.connected === true ? (
                <button
                  type="button"
                  disabled={facebookPublishing}
                  onClick={() =>
                    void runFacebookPublisher()
                  }
                  className="mt-3 w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {facebookPublishing
                    ? "PUBLISHING FACEBOOK..."
                    : "RUN FACEBOOK PUBLISHER NOW"}
                </button>
              ) : null}
            </div>

            <div>
              <ConnectionCard
                label="Instagram"
              configured={
                connections?.instagram?.configured === true
              }
              connected={
                connections?.instagram?.connected === true
              }
                onConnect={
                  connectInstagram
                }
              />

              <button
                type="button"
                onClick={() =>
                  void checkLiveInstagramStatus()
                }
                className="mt-3 w-full rounded-xl border border-white/15 px-4 py-3 text-sm font-black"
              >
                CHECK LIVE INSTAGRAM STATUS
              </button>

              {/* SOLO_RECONNECT_INSTAGRAM_V1 */}
              <button
                type="button"
                onClick={() =>
                  void connectInstagram()
                }
                className="mt-3 w-full rounded-xl bg-purple-600 px-4 py-3 text-sm font-black text-white"
              >
                RECONNECT INSTAGRAM
              </button>
              {connections?.instagram?.connected === true ? (
                <button
                  type="button"
                  disabled={instagramPublishing}
                  onClick={() =>
                    void runInstagramPublisher()
                  }
                  className="mt-3 w-full rounded-xl bg-pink-600 px-4 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {instagramPublishing
                    ? "PUBLISHING INSTAGRAM..."
                    : "RUN INSTAGRAM PUBLISHER NOW"}
                </button>
              ) : null}
            </div>

            <div>
              <ConnectionCard
                label="TikTok"
                configured={
                  connections?.tiktok?.configured === true
                }
                connected={
                  connections?.tiktok?.connected === true
                }
                onConnect={
                  connectTikTok
                }
              />

              <button
                type="button"
                onClick={() =>
                  void connectTikTok()
                }
                className="mt-3 w-full rounded-xl bg-black px-4 py-3 text-sm font-black text-white ring-1 ring-white/20"
              >
                {connections?.tiktok?.connected === true
                  ? "RECONNECT TIKTOK"
                  : "CONNECT TIKTOK"}
              </button>

              {connections?.tiktok?.connected === true ? (
                <>
                  <button
                    type="button"
                    disabled={tiktokPublishing}
                    onClick={() =>
                      void runTikTokPublisher()
                    }
                    className="mt-3 w-full rounded-xl bg-zinc-100 px-4 py-3 text-sm font-black text-black disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {tiktokPublishing
                      ? "PUBLISHING TIKTOK..."
                      : "RUN TIKTOK PUBLISHER NOW"}
                  </button>

                  <div className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-200">
                    TIKTOK CONNECTED
                    {connections?.tiktok?.username
                      ? ` Ãƒâ€š- @${connections.tiktok.username}`
                      : connections?.tiktok?.displayName
                        ? ` Ãƒâ€š- ${connections.tiktok.displayName}`
                        : ""}
                  </div>
                </>
              ) : null}
            </div>

          </div>

        </section>

        <section className="mt-8 w-full min-w-0 max-w-full overflow-hidden rounded-3xl border border-white/10 bg-[#0b0b0b] p-4 sm:p-6">

          <p className="text-xs font-black tracking-[0.2em] text-red-400">
            CREATE PROMOTION
          </p>

          <h2 className="mt-2 text-3xl font-black">
            Schedule New Post
          </h2>

          <div className="mt-6 grid gap-5">

            <label className="grid w-full min-w-0 gap-2">
              <span className="text-sm font-black">
                POST TITLE
              </span>

              <input
                value={title}
                onChange={
                  event =>
                    setTitle(
                      event.target.value
                    )
                }
                placeholder="Bright Shadow - Gentle Scar"
                className="block w-full min-w-0 max-w-full resize-y rounded-xl border border-white/10 bg-black px-4 py-4 outline-none"
              />
            </label>

            <label className="grid w-full min-w-0 gap-2">
              <span className="text-sm font-black">
                TRACK
              </span>

              <input
                value={trackTitle}
                onChange={
                  event =>
                    setTrackTitle(
                      event.target.value
                    )
                }
                placeholder="Gentle Scar"
                className="block w-full min-w-0 max-w-full resize-y rounded-xl border border-white/10 bg-black px-4 py-4 outline-none"
              />
            </label>

            <div className="rounded-2xl border border-white/10 bg-black p-4">

              <div className="text-sm font-black">
                POST TYPE
              </div>

              <div className="mt-3 flex w-full min-w-0 flex-wrap gap-3">

                <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-sm font-bold">
                  <input
                    type="radio"
                    name="mediaType"
                    checked={
                      mediaType === "video" &&
                      !imageMusicMode
                    }
                    onChange={() => {
                      setImageMusicMode(false);
                      setMediaType("video");
                    }}
                  />
                  VIDEO POST
                </label>

                <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-sm font-bold">
                  <input
                    type="radio"
                    name="mediaType"
                    checked={
                      mediaType === "image"
                    }
                    onChange={() => {
                      setImageMusicMode(false);
                      setMediaType("image");

                      setPlatforms(
                        current => {
                          const clean =
                            current.filter(
                              item =>
                                item !== "youtube"
                            );

                          return clean.length
                            ? clean
                            : [
                                "facebook",
                                "instagram",
                              ];
                        }
                      );
                    }}
                  />
                  IMAGE POST
                </label>

                <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-fuchsia-500/30 bg-fuchsia-500/10 px-4 py-3 text-sm font-bold text-fuchsia-200">
                  <input
                    type="radio"
                    name="mediaType"
                    checked={
                      imageMusicMode
                    }
                    onChange={() => {
                      setImageMusicMode(true);
                      setMediaType("video");
                      setVideoSource("manager");
                      setYoutubeContentType("short");

                      setDeviceVideo(null);
                      setVideoRotationVideos([]);
                      setVideoRotationEnabled(false);
                      setSelectedVideoId("");

                      setPlatforms([
                        "facebook",
                        "instagram",
                        "youtube",
                        "tiktok",
                      ]);
                    }}
                  />
                  IMAGE + MUSIC
                </label>

              </div>

            </div>

            {/* =====================================================
                SOLO_POST_TYPE_SCHEDULING_SUMMARY_V1
               ===================================================== */}

            <div className="grid gap-3 rounded-2xl border border-white/10 bg-black/40 p-5">

              <div className="text-xs font-black tracking-[0.2em] text-zinc-400">
                SCHEDULING SUMMARY
              </div>

              {imageMusicMode ? (
                <div className="rounded-xl border border-fuchsia-500/30 bg-fuchsia-500/10 p-4">

                  <div className="text-lg font-black text-fuchsia-200">
                    IMAGE + MUSIC
                  </div>

                  <div className="mt-2 text-sm text-zinc-300">
                    Daily Image + Music Rotation:
                    {" "}
                    <strong className="text-white">
                      {videoRotationVideos.length}
                    </strong>
                    {" "}
                    video
                    {videoRotationVideos.length === 1 ? "" : "s"}
                  </div>

                  <div className="mt-2 text-xs font-bold text-zinc-400">
                    {videoRotationVideos.length > 1
                      ? videoRotationEnabled
                        ? "ROTATION READY AND ON"
                        : "ROTATION READY - TURN ROTATION ON"
                      : "CREATE OR ADD AT LEAST 2 VIDEOS FOR DAILY ROTATION"}
                  </div>

                </div>
              ) : mediaType === "image" ? (
                <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-4">

                  <div className="text-lg font-black text-blue-200">
                    IMAGE POST
                  </div>

                  <div className="mt-2 text-sm text-zinc-300">
                    Daily Image Rotation:
                    {" "}
                    <strong className="text-white">
                      {imageRotationImages.length}
                    </strong>
                    {" "}
                    image
                    {imageRotationImages.length === 1 ? "" : "s"}
                  </div>

                  <div className="mt-2 text-xs font-bold text-zinc-400">
                    {imageRotationImages.length > 1
                      ? imageRotationEnabled
                        ? "ROTATION READY AND ON"
                        : "ROTATION READY - TURN ROTATION ON"
                      : "UPLOAD AT LEAST 2 IMAGES FOR DAILY ROTATION"}
                  </div>

                </div>
              ) : (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">

                  <div className="text-lg font-black text-emerald-200">
                    VIDEO POST
                  </div>

                  <div className="mt-2 text-sm text-zinc-300">
                    Daily Video Rotation:
                    {" "}
                    <strong className="text-white">
                      {videoRotationVideos.length}
                    </strong>
                    {" "}
                    video
                    {videoRotationVideos.length === 1 ? "" : "s"}
                  </div>

                  <div className="mt-2 text-xs font-bold text-zinc-400">
                    {videoRotationVideos.length > 1
                      ? videoRotationEnabled
                        ? "ROTATION READY AND ON"
                        : "ROTATION READY - TURN ROTATION ON"
                      : "SELECT OR UPLOAD AT LEAST 2 VIDEOS FOR DAILY ROTATION"}
                  </div>

                </div>
              )}

              <div className="rounded-xl border border-white/10 bg-[#080808] p-4">

                <div className="text-sm font-black text-white">
                  RECURRING / DAILY POSTING
                </div>

                <div className="mt-2 text-xs text-zinc-400">
                  Use the scheduling section below to choose start date, time,
                  frequency, finish date or Until Cancelled.
                </div>

              </div>

            </div>

            {/* =====================================================
                SOLO_VISIBLE_UPLOAD_TYPE_PANEL_V1
               ===================================================== */}

            <div className="grid gap-4 rounded-2xl border border-white/10 bg-black/50 p-5">

              <div>
                <div className="text-xs font-black tracking-[0.2em] text-zinc-400">
                  CHOOSE WHAT TO UPLOAD
                </div>

                <div className="mt-2 text-sm text-zinc-400">
                  Select a post type below. The correct uploader will open automatically.
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">

                <button
                  type="button"
                  onClick={() => {
                    setImageMusicMode(false);
                    setMediaType("video");
                    setVideoSource("manager");
                  }}
                  className={
                    !imageMusicMode &&
                    mediaType === "video"
                      ? "rounded-xl border border-emerald-400 bg-emerald-500/20 px-5 py-4 font-black text-emerald-200"
                      : "rounded-xl border border-white/10 bg-white/5 px-5 py-4 font-black text-white hover:bg-white/10"
                  }
                >
                  UPLOAD VIDEO
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setImageMusicMode(false);
                    setMediaType("image");

                    setPlatforms(
                      current => {
                        const clean =
                          current.filter(
                            item =>
                              item !== "youtube"
                          );

                        return clean.length
                          ? clean
                          : [
                              "facebook",
                              "instagram",
                            ];
                      }
                    );
                  }}
                  className={
                    !imageMusicMode &&
                    mediaType === "image"
                      ? "rounded-xl border border-blue-400 bg-blue-500/20 px-5 py-4 font-black text-blue-200"
                      : "rounded-xl border border-white/10 bg-white/5 px-5 py-4 font-black text-white hover:bg-white/10"
                  }
                >
                  UPLOAD IMAGE
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setImageMusicMode(true);
                    setMediaType("video");
                    setVideoSource("manager");
                    setYoutubeContentType("short");

                    setDeviceVideo(null);
                    setVideoRotationVideos([]);
                    setVideoRotationEnabled(false);
                    setSelectedVideoId("");

                    setPlatforms([
                      "facebook",
                      "instagram",
                      "youtube",
                      "tiktok",
                    ]);
                  }}
                  className={
                    imageMusicMode
                      ? "rounded-xl border border-fuchsia-400 bg-fuchsia-500/20 px-5 py-4 font-black text-fuchsia-200"
                      : "rounded-xl border border-white/10 bg-white/5 px-5 py-4 font-black text-white hover:bg-white/10"
                  }
                >
                  IMAGE + MUSIC
                </button>

              </div>

              <div className="text-xs font-bold text-zinc-500">
                VIDEO = upload normal video â€¢ IMAGE = upload single or rotating images â€¢ IMAGE + MUSIC = upload artwork and MP3/WAV
              </div>

            </div>
            {/* =====================================================
                SOLO_IMAGE_MUSIC_PANEL_FINAL_V1
               ===================================================== */}

            {imageMusicMode ? (
              <div className="grid gap-5 rounded-2xl border border-fuchsia-500/30 bg-fuchsia-500/5 p-5">

                <div>
                  <div className="text-xs font-black tracking-[0.2em] text-fuchsia-300">
                    IMAGE + YOUR MUSIC
                  </div>

                  <div className="mt-2 text-sm text-zinc-400">
                    Upload your artwork and your own MP3/WAV. SOLO BEATS will create a vertical social video with your music built into it.
                  </div>
                </div>

                <label className="grid w-full min-w-0 gap-2">
                  <span className="text-sm font-black">
                    ARTWORK / IMAGE
                  </span>

                  <input
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp,image/*"
                    onChange={event => {
                      const files =
                        Array.from(
                          event.target.files ||
                          []
                        );

                      setImageMusicImageFiles(
                        files
                      );

                      setImageMusicImageFile(
                        files[0] || null
                      );

                      setDeviceVideo(null);
                    }}
                    className="w-full min-w-0 max-w-full rounded-xl border border-white/10 bg-black px-4 py-4"
                  />

                  {imageMusicImageFiles.length > 0 ? (
                    <div className="grid gap-2 rounded-xl border border-fuchsia-500/20 bg-black/30 p-3">

                      <div className="text-sm font-black text-fuchsia-300">
                        {imageMusicImageFiles.length} IMAGES SELECTED
                      </div>

                      {imageMusicImageFiles.map(
                        (file, index) => (
                          <div
                            key={
                              file.name +
                              "-" +
                              String(index)
                            }
                            className="text-xs font-bold text-zinc-400"
                          >
                            DAY {index + 1}: {file.name}
                          </div>
                        )
                      )}

                    </div>
                  ) : imageMusicImageFile ? (
                    <div className="text-xs font-bold text-fuchsia-300">
                      IMAGE: {imageMusicImageFile.name}
                    </div>
                  ) : null}
                </label>

                <label className="grid w-full min-w-0 gap-2">
                  <span className="text-sm font-black">
                    YOUR MUSIC FILE
                  </span>

                  <input
                    type="file"
                    accept="audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/aac,audio/mp4,audio/*"
                    onChange={event => {
                      const file =
                        event.target.files?.[0] ||
                        null;

                      setImageMusicAudioFile(
                        file
                      );

                      setDeviceVideo(null);
                      setVideoRotationVideos([]);
                    }}
                    className="w-full min-w-0 max-w-full rounded-xl border border-white/10 bg-black px-4 py-4"
                  />

                  {imageMusicAudioFile ? (
                    <div className="text-xs font-bold text-fuchsia-300">
                      MUSIC: {imageMusicAudioFile.name}
                    </div>
                  ) : null}
                </label>

                {imageMusicAudioPreviewUrl ? (
                  <div className="grid w-full min-w-0 gap-4 rounded-xl border border-white/10 bg-black/40 p-4">

                    <div className="text-sm font-black">
                      SONG SECTION
                    </div>

                    <div className="text-xs text-zinc-400">
                      Choose the best part of your song. The generated promo will start from this point.
                    </div>

                    <audio
                      ref={
                        imageMusicPreviewAudioRef
                      }
                      controls
                      preload="metadata"
                      src={
                        imageMusicAudioPreviewUrl
                      }
                      onLoadedMetadata={event => {
                        const loaded =
                          Number.isFinite(
                            event.currentTarget.duration
                          )
                            ? event.currentTarget.duration
                            : 0;

                        setImageMusicAudioDurationSeconds(
                          loaded
                        );
                      }}
                      className="w-full"
                    />

                    <div className="grid gap-3">

                      <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-bold text-zinc-300">
                        <span>
                          START AT: {formatImageMusicTime(
                            imageMusicClipStartSeconds
                          )}
                        </span>

                        <span>
                          CLIP: {formatImageMusicTime(
                            imageMusicClipStartSeconds
                          )} to {formatImageMusicTime(
                            Math.min(
                              imageMusicAudioDurationSeconds || imageMusicDuration,
                              imageMusicClipStartSeconds +
                                imageMusicDuration
                            )
                          )}
                        </span>
                      </div>

                      <input
                        type="range"
                        min={0}
                        max={Math.max(
                          0,
                          Math.floor(
                            imageMusicAudioDurationSeconds -
                              imageMusicDuration
                          )
                        )}
                        step={1}
                        value={Math.min(
                          imageMusicClipStartSeconds,
                          Math.max(
                            0,
                            Math.floor(
                              imageMusicAudioDurationSeconds -
                                imageMusicDuration
                            )
                          )
                        )}
                        onChange={event => {
                          const nextStart =
                            Number(
                              event.target.value
                            ) || 0;

                          setImageMusicClipStartSeconds(
                            nextStart
                          );

                          const player =
                            imageMusicPreviewAudioRef.current;

                          if (player) {
                            player.currentTime =
                              nextStart;
                          }
                        }}
                        className="w-full"
                      />

                      <div className="grid gap-3 sm:grid-cols-2">

                        <label className="grid w-full min-w-0 gap-2">
                          <span className="text-xs font-black text-zinc-300">
                            START TIME (SECONDS)
                          </span>

                          <input
                            type="number"
                            min={0}
                            max={Math.max(
                              0,
                              Math.floor(
                                imageMusicAudioDurationSeconds -
                                  imageMusicDuration
                              )
                            )}
                            step={1}
                            value={Math.round(
                              imageMusicClipStartSeconds
                            )}
                            onChange={event => {
                              const nextStart =
                                Math.max(
                                  0,
                                  Math.min(
                                    Math.max(
                                      0,
                                      Math.floor(
                                        imageMusicAudioDurationSeconds -
                                          imageMusicDuration
                                      )
                                    ),
                                    Number(
                                      event.target.value
                                    ) || 0
                                  )
                                );

                              setImageMusicClipStartSeconds(
                                nextStart
                              );

                              const player =
                                imageMusicPreviewAudioRef.current;

                              if (player) {
                                player.currentTime =
                                  nextStart;
                              }
                            }}
                            className="rounded-xl border border-white/10 bg-black px-4 py-4 font-black"
                          />
                        </label>

                        <div className="grid w-full min-w-0 gap-2">
                          <span className="text-xs font-black text-zinc-300">
                            SELECTED SECTION
                          </span>

                          <div className="rounded-xl border border-white/10 bg-black px-4 py-4 text-sm font-black">
                            {formatImageMusicTime(
                              imageMusicClipStartSeconds
                            )} to {formatImageMusicTime(
                              Math.min(
                                imageMusicAudioDurationSeconds || imageMusicDuration,
                                imageMusicClipStartSeconds +
                                  imageMusicDuration
                              )
                            )}
                          </div>
                        </div>

                      </div>

                    </div>

                  </div>
                ) : null}

                <label className="grid w-full min-w-0 gap-2">
                  <span className="text-sm font-black">
                    PROMO LENGTH
                  </span>

                  <select
                    value={
                      imageMusicDuration
                    }
                    onChange={event =>
                      setImageMusicDuration(
                        Number(
                          event.target.value
                        ) as 15 | 30 | 60
                      )
                    }
                    className="rounded-xl border border-white/10 bg-black px-4 py-4 font-black"
                  >
                    <option value={15}>
                      15 SECONDS
                    </option>

                    <option value={30}>
                      30 SECONDS
                    </option>

                    <option value={60}>
                      60 SECONDS
                    </option>
                  </select>
                </label>

                <button
                  type="button"
                  disabled={
                    imageMusicGenerating ||
                    (imageMusicImageFiles.length === 0 &&
                      !imageMusicImageFile) ||
                    !imageMusicAudioFile
                  }
                  onClick={() =>
                    void generateAllImageMusicPostVideos()
                  }
                  className="rounded-xl bg-fuchsia-500 px-5 py-4 font-black text-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {imageMusicGenerating
                    ? "CREATING IMAGE + MUSIC VIDEO..."
                    : imageMusicImageFiles.length > 1
                      ? "CREATE " +
                        String(imageMusicImageFiles.length) +
                        " IMAGE + MUSIC VIDEOS"
                      : "CREATE IMAGE + MUSIC VIDEO"}
                </button>

                {imageMusicGenerating ? (
                  <button type="button" onClick={() => void cancelImageMusicRender()}
                    className="rounded-xl bg-red-600 px-5 py-4 font-black text-white">
                    CANCEL RENDERING
                  </button>
                ) : null}

                {deviceVideo?.previewUrl ? (
                  <div className="grid gap-3 rounded-xl border border-green-500/30 bg-green-500/5 p-4">

                    <div className="text-sm font-black text-green-300">
                      IMAGE + MUSIC VIDEO ADDED TO DAILY ROTATION
                    </div>

                    <video
                      src={
                        deviceVideo.previewUrl
                      }
                      controls
                      playsInline
                      preload="metadata"
                      className="mx-auto aspect-[9/16] max-h-[620px] rounded-xl bg-black object-contain"
                    />

                    <div className="text-xs text-zinc-400">
                      Ready for Facebook, Instagram, TikTok and YouTube Shorts.
                    </div>

                  </div>
                ) : null}

                {videoRotationVideos.length > 0 ? (
                  <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4">

                    <div className="flex flex-wrap items-center justify-between gap-3">

                      <div>
                        <div className="text-sm font-black text-emerald-300">
                          DAILY IMAGE + MUSIC ROTATION
                        </div>

                        <div className="mt-1 text-xs text-zinc-400">
                          {videoRotationVideos.length} generated videos ready to schedule.
                        </div>
                      </div>

                      <label className="flex items-center gap-2 text-sm font-black">
                        <input
                          type="checkbox"
                          checked={videoRotationEnabled}
                          disabled={
                            videoRotationVideos.length < 2
                          }
                          onChange={event =>
                            setVideoRotationEnabled(
                              event.target.checked
                            )
                          }
                        />

                        ROTATION ON
                      </label>

                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">

                      {videoRotationVideos.map(
                        (video, index) => (
                          <div
                            key={
                              video.storagePath
                            }
                            className="rounded-xl border border-white/10 bg-black p-3"
                          >

                            <video
                              src={
                                video.previewUrl
                              }
                              controls
                              playsInline
                              preload="metadata"
                              className="aspect-[9/16] max-h-[360px] w-full rounded-lg bg-black object-contain"
                            />

                            <div className="mt-2 text-center text-xs font-black text-emerald-300">
                              DAY {index + 1}
                            </div>

                            <div className="mt-1 truncate text-center text-xs text-zinc-500">
                              {video.fileName}
                            </div>

                          </div>
                        )
                      )}

                    </div>

                  </div>
                ) : null}

              </div>
            ) : null}

            {mediaType === "video" && !imageMusicMode ? (
            <div className="rounded-2xl border border-white/10 p-4">
              <div className="text-sm font-black">
                VIDEO SOURCE
              </div>

              <div className="mt-3 flex w-full min-w-0 flex-wrap gap-3">
                <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-sm font-bold">
                  <input
                    type="radio"
                    name="videoSource"
                    checked={videoSource === "manager"}
                    onChange={() =>
                      setVideoSource("manager")
                    }
                  />
                  Uploaded / Generated Video
                </label>

                <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-sm font-bold">
                  <input
                    type="radio"
                    name="videoSource"
                    checked={videoSource === "youtube"}
                    onChange={() => {
                      setVideoSource("youtube");
                      setPlatforms(["youtube"]);
                    }}
                  />
                  Existing YouTube Video
                </label>
              </div>
            </div>
            ) : null}

            {mediaType === "video" &&
videoSource === "youtube" &&
youtubeContentType === "short" ? (
  <div className="grid gap-4">

    <label className="grid w-full min-w-0 gap-2">
      <span className="text-sm font-black">
        SHORT VIDEO LINK
      </span>

      <input
        type="url"
        value={youtubeShortVideoUrl}
        onChange={event => {
          setYoutubeShortVideoUrl(
            event.target.value
          );
          setYoutubeShortVideoReady(false);
          setYoutubePreviewError("");
        }}
        onBlur={() =>
          validateYoutubePreview(
            "short",
            youtubeShortVideoUrl
          )
        }
        placeholder="https://youtube.com/shorts/..."
        className="block w-full min-w-0 max-w-full resize-y rounded-xl border border-white/10 bg-black px-4 py-4 outline-none"
      />
    </label>

    {youtubeShortVideoUrl.trim() ? (
      <div className="grid gap-3">
        <div className="text-sm font-black">
          SHORT VIDEO PREVIEW
        </div>

        <div className="aspect-video overflow-hidden rounded-xl border border-white/10 bg-black">
          <iframe
            src={
              youtubeShortVideoUrl.includes("youtu")
                ? `https://www.youtube.com/embed/${
                    youtubeShortVideoUrl.includes("v=")
                      ? youtubeShortVideoUrl
                          .split("v=")[1]
                          ?.split("&")[0]
                      : youtubeShortVideoUrl
                          .split("/")
                          .filter(Boolean)
                          .pop()
                  }`
                : ""
            }
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>

        <button
          type="button"
          disabled={youtubePreviewLoading}
          onClick={() =>
            validateYoutubePreview(
              "short",
              youtubeShortVideoUrl
            )
          }
          className="rounded-xl border border-white/10 px-4 py-3 text-sm font-black"
        >
          {youtubePreviewLoading
            ? "CHECKING..."
            : "CHECK SHORT VIDEO"}
        </button>

        <div
          className={
            youtubeShortVideoReady
              ? "text-sm font-black text-green-400"
              : "text-sm font-black text-yellow-400"
          }
        >
          {youtubeShortVideoReady
            ? "SHORT VIDEO READY ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦"
            : "SHORT VIDEO MUST BE VERIFIED"}
        </div>
      </div>
    ) : null}

  </div>
) : null}

{mediaType === "video" &&
videoSource === "youtube" &&
youtubeContentType === "long" ? (
  <div className="grid gap-4">

    <label className="grid w-full min-w-0 gap-2">
      <span className="text-sm font-black">
        LONG VIDEO LINK
      </span>

      <input
        type="url"
        value={youtubeLongVideoUrl}
        onChange={event => {
          setYoutubeLongVideoUrl(
            event.target.value
          );
          setYoutubeLongVideoReady(false);
          setYoutubePreviewError("");
        }}
        onBlur={() =>
          validateYoutubePreview(
            "long",
            youtubeLongVideoUrl
          )
        }
        placeholder="https://www.youtube.com/watch?v=..."
        className="block w-full min-w-0 max-w-full resize-y rounded-xl border border-white/10 bg-black px-4 py-4 outline-none"
      />
    </label>

    {youtubeLongVideoUrl.trim() ? (
      <div className="grid gap-3">
        <div className="text-sm font-black">
          LONG VIDEO PREVIEW
        </div>

        <div className="aspect-video overflow-hidden rounded-xl border border-white/10 bg-black">
          <iframe
            src={
              youtubeLongVideoUrl.includes("youtu")
                ? `https://www.youtube.com/embed/${
                    youtubeLongVideoUrl.includes("v=")
                      ? youtubeLongVideoUrl
                          .split("v=")[1]
                          ?.split("&")[0]
                      : youtubeLongVideoUrl
                          .split("/")
                          .filter(Boolean)
                          .pop()
                  }`
                : ""
            }
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>

        <button
          type="button"
          disabled={youtubePreviewLoading}
          onClick={() =>
            validateYoutubePreview(
              "long",
              youtubeLongVideoUrl
            )
          }
          className="rounded-xl border border-white/10 px-4 py-3 text-sm font-black"
        >
          {youtubePreviewLoading
            ? "CHECKING..."
            : "CHECK LONG VIDEO"}
        </button>

        <div
          className={
            youtubeLongVideoReady
              ? "text-sm font-black text-green-400"
              : "text-sm font-black text-yellow-400"
          }
        >
          {youtubeLongVideoReady
            ? "LONG VIDEO READY ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¦"
            : "LONG VIDEO MUST BE VERIFIED"}
        </div>
      </div>
    ) : null}

  </div>
) : null}

{youtubePreviewError ? (
  <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-300">
    {youtubePreviewError}
  </div>
) : null}

            {mediaType === "video" &&
            !imageMusicMode &&
            videoSource === "manager" ? (
              <>

                {/* SOLO_OWNER_BEST_PART_V1_UI */}
                <div className="rounded-2xl border border-fuchsia-400/30 bg-fuchsia-500/10 p-5 space-y-4">
                  <div className="font-black text-fuchsia-200">OWNER SHORT VIDEO CREATOR</div>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => cancelOwnerShort()}
                      className={`rounded-xl p-3 font-bold ${ownerShortMode === "long" ? "bg-cyan-500/30" : "bg-black/50"}`}>
                      LONG VIDEO
                    </button>
                    <button type="button" disabled={ownerShortBusy || ownerShortAnalyzing}
                      onClick={() => { setOwnerShortMode("short"); setOwnerShortResult(null); }}
                      className={`rounded-xl p-3 font-bold ${ownerShortMode === "short" ? "bg-fuchsia-500/30" : "bg-black/50"}`}>
                      SHORT VIDEO
                    </button>
                  </div>
                  {ownerShortMode === "short" ? (
                    <div className="space-y-3">
                      <div className="text-xs text-zinc-300">SOURCE: {ownerShortSource?.fileName || "Upload or select a video"}</div>
                      <div className="grid grid-cols-3 gap-2">
                        {([15, 30, 60] as const).map(seconds => (
                          <button key={seconds} type="button" disabled={ownerShortBusy || ownerShortAnalyzing}
                            onClick={() => { setOwnerShortDuration(seconds); setOwnerShortResult(null); }}
                            className={`rounded-xl p-3 font-bold ${ownerShortDuration === seconds ? "bg-fuchsia-500/40" : "bg-black/60"}`}>
                            {seconds} SEC
                          </button>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button type="button" disabled={ownerShortBusy || ownerShortAnalyzing || !ownerShortSource}
                          onClick={() => void ownerPickBestPart()}
                          className="rounded-xl bg-cyan-600 px-3 py-3 font-black disabled:opacity-40">
                          {ownerShortAnalyzing ? "ANALYZING..." : "AUTO BEST PART PICK"}
                        </button>
                        <button type="button" disabled={ownerShortBusy || ownerShortAnalyzing}
                          onClick={() => setOwnerShortPick("manual")}
                          className="rounded-xl bg-zinc-700 px-3 py-3 font-black disabled:opacity-40">MANUAL PICK</button>
                      </div>
                      <label className="block text-xs font-black">START AT (SECONDS)
                        <input type="number" min={0} max={3600} step={1} value={ownerShortStart}
                          disabled={ownerShortBusy || ownerShortAnalyzing}
                          onChange={e => { setOwnerShortStart(Math.max(0, Math.floor(Number(e.target.value) || 0))); setOwnerShortPick("manual"); setOwnerShortResult(null); }}
                          className="mt-2 w-full rounded-xl border border-white/20 bg-black p-3 text-white" />
<div className="mt-3">
  <input
    type="range"
    min={0}
    max={Math.max(0, Math.floor(ownerShortVideoDuration) - ownerShortDuration)}
    step={1}
    value={ownerShortStart}
    onChange={(e) => {
      const seconds = Number(e.target.value);
      setOwnerShortStart(seconds);
      setOwnerShortPick("manual");
      setOwnerShortResult(null);
      if (ownerShortPreviewRef.current) {
        ownerShortPreviewRef.current.currentTime = seconds;
      }
    }}
    className="w-full cursor-pointer accent-fuchsia-500"
    aria-label="Drag Short start time"
  />
  <div className="mt-2 flex justify-between text-xs text-zinc-400">
    <span>0:00</span>
    <span>
      {Math.floor(ownerShortStart / 60)}:
      {String(ownerShortStart % 60).padStart(2, "0")}
    </span>
    <span>{Math.floor(Math.max(0, ownerShortVideoDuration - ownerShortDuration) / 60)}:{String(Math.floor(Math.max(0, ownerShortVideoDuration - ownerShortDuration)) % 60).padStart(2, "0")}</span>
  </div>
</div>
                      </label>
                      <div className="text-xs text-zinc-400">PICK: {ownerShortPick.toUpperCase()} - original upload stays intact</div>
                      {ownerShortSource?.previewUrl ? (
                        <video key={ownerShortSource.previewUrl} ref={ownerShortPreviewRef} src={ownerShortSource.previewUrl}
                          controls playsInline preload="metadata"
                          onLoadedMetadata={e => {
  const duration = e.currentTarget.duration;
  if (Number.isFinite(duration) && duration > 0) {
    setOwnerShortVideoDuration(duration);
  }
  e.currentTarget.currentTime = ownerShortStart;
}}
                          className="mx-auto max-h-80 rounded-xl bg-black" />
                      ) : null}
                      <button type="button" disabled={!ownerShortSource || ownerShortBusy || ownerShortAnalyzing}
                        onClick={() => void ownerCreateShort()}
                        className="w-full rounded-xl bg-fuchsia-600 px-4 py-3 font-black disabled:opacity-40">
                        {ownerShortBusy ? "CREATING SHORT..." : "CREATE SHORT"}
                      </button>
                      {ownerShortResult ? (
                        <div className="space-y-2">
                          <div className="font-bold text-green-300">SHORT READY TO SCHEDULE</div>
                          <video src={ownerShortResult.previewUrl} controls playsInline preload="metadata"
                            className="mx-auto aspect-[9/16] max-h-96 rounded-xl bg-black" />
                        </div>
                      ) : null}
                      <button type="button" disabled={ownerShortBusy || ownerShortAnalyzing}
                        onClick={cancelOwnerShort}
                        className="w-full rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3 font-black text-red-200 disabled:opacity-40">
                        CANCEL SHORT
                      </button>
                    </div>
                  ) : <div className="text-xs text-zinc-400">LONG VIDEO selected. Original source remains available.</div>}
                </div>

                <label className="grid w-full min-w-0 gap-2">
                  <span className="text-sm font-black">
                    PROMOTIONAL VIDEO
                  </span>

                  <select
                    value={
                      selectedVideoId
                    }
                    onChange={
                      event =>
                        (setSelectedVideoId(event.target.value), setOwnerShortResult(null))
                    }
                    className="w-full min-w-0 max-w-full rounded-xl border border-white/10 bg-black px-4 py-4"
                  >
                    <option value="">
                      Choose video from Video Manager
                    </option>

                    {videos.map(
                      video => (
                        <option
                          key={
                            video.mediaId
                          }
                          value={
                            video.mediaId
                          }
                        >
                          {video.title}
                        </option>
                      )
                    )}
                  </select>
                </label>

                {selectedVideo &&
                videos.filter(
                  item =>
                    item.title.trim().toLowerCase() ===
                    selectedVideo.title.trim().toLowerCase()
                ).length > 1 ? (
                  <button
                    type="button"
                    onClick={() => {
                      const selectedTitle =
                        selectedVideo.title
                          .trim()
                          .toLowerCase();

                      const matchingVideos =
                        videos
                          .filter(
                            item =>
                              item.title
                                .trim()
                                .toLowerCase() ===
                              selectedTitle &&
                              typeof item.storagePath ===
                                "string" &&
                              item.storagePath.length > 0
                          )
                          .map(item => ({
                            previewUrl:
                              item.previewUrl || "",
                            storagePath:
                              item.storagePath || "",
                            mediaId:
                              item.mediaId,
                            fileName:
                              item.title ||
                              "video.mp4",
                          }));

                      setVideoRotationVideos(
                        current => {
                          const combined = [
                            ...current,
                            ...matchingVideos,
                          ];

                          const unique =
                            combined.filter(
                              (item, index, array) =>
                                array.findIndex(
                                  candidate =>
                                    candidate.mediaId ===
                                    item.mediaId
                                ) === index
                            );

                          return unique;
                        }
                      );

                      if (
                        matchingVideos.length > 1
                      ) {
                        setVideoRotationEnabled(
                          true
                        );
                      }

                      setSuccess(
                        `Added ${matchingVideos.length} matching "${selectedVideo.title}" videos.`
                      );

                      setError("");
                    }}
                    className="w-full rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-4 py-4 text-sm font-black text-emerald-300 hover:bg-emerald-500/25"
                  >
                    ADD ALL {
                      videos.filter(
                        item =>
                          item.title
                            .trim()
                            .toLowerCase() ===
                          selectedVideo.title
                            .trim()
                            .toLowerCase()
                      ).length
                    } MATCHING VIDEOS
                  </button>
                ) : null}
                {selectedVideo ? (
                  <div className="grid gap-3">

                    {selectedVideo.previewUrl ? (
                      <video
                        controls
                        preload="metadata"
                        src={
                          selectedVideo.previewUrl
                        }
                        className="block max-h-[420px] w-full min-w-0 max-w-full rounded-2xl bg-black object-contain"
                      />
                    ) : null}

                    <button
                      type="button"
                      onClick={() => {
                        const rotationVideo = {
                          previewUrl:
                            selectedVideo.previewUrl || "",
                          storagePath:
                            selectedVideo.storagePath || "",
                          mediaId:
                            selectedVideo.mediaId,
                          fileName:
                            selectedVideo.title ||
                            "video.mp4",
                        };

                        setVideoRotationVideos(
                          current => {
                            const exists =
                              current.some(
                                item =>
                                  item.mediaId ===
                                  rotationVideo.mediaId
                              );

                            if (exists) {
                              return current;
                            }

                            const next = [
                              ...current,
                              rotationVideo,
                            ];

                            if (
                              next.length > 1
                            ) {
                              setVideoRotationEnabled(
                                true
                              );
                            }

                            return next;
                          }
                        );
                      }}
                      className="rounded-xl bg-emerald-600 px-5 py-4 font-black text-white"
                    >
                      ADD TO DAILY ROTATION
                    </button>

                    {videoRotationVideos.length > 0 ? (
                      <div className="text-sm font-black text-emerald-300">
                        {videoRotationVideos.length} VIDEO
                        {videoRotationVideos.length === 1 ? "" : "S"} IN ROTATION
                      </div>
                    ) : null}

                  </div>
                ) : null}
              </>
            ) : null}

            <label className="grid w-full min-w-0 gap-2">
              <span className="text-sm font-black">
                CAPTION
              </span>

              <textarea
                rows={5}
                value={caption}
                onChange={
                  event =>
                    setCaption(
                      event.target.value
                    )
                }
                placeholder="Write the promotion caption..."
                className="block w-full min-w-0 max-w-full resize-y rounded-xl border border-white/10 bg-black px-4 py-4 outline-none"
              />
            </label>

                        {platforms.includes("facebook") ? (
              <div className="grid w-full min-w-0 gap-4 rounded-xl border border-white/10 bg-black/30 p-4">

                <label className="flex cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={facebookOptimizationEnabled}
                    onChange={event =>
                      setFacebookOptimizationEnabled(
                        event.target.checked
                      )
                    }
                  />

                  <span className="text-sm font-black">
                    AUTO FACEBOOK OPTIMIZATION
                  </span>
                </label>

                <div className="text-xs text-zinc-500">
                  Automatically builds a Facebook Reel caption
                  with a strong opening, music keywords,
                  call to action and relevant hashtags.
                </div>

                <label className="grid w-full min-w-0 gap-2">
                  <span className="text-sm font-black">
                    {mediaType === "image"
                      ? "FACEBOOK IMAGE CAPTION"
                      : "FACEBOOK REEL CAPTION"}
                  </span>

                  <textarea
                    rows={5}
                    value={facebookCaption}
                    onChange={event =>
                      setFacebookCaption(
                        event.target.value
                      )
                    }
                    placeholder="Leave blank for automatic Facebook optimization..."
                    className="block w-full min-w-0 max-w-full resize-y rounded-xl border border-white/10 bg-black px-4 py-4 outline-none"
                  />
                </label>

              </div>
            ) : null}

            {platforms.includes("instagram") ? (
              <div className="grid w-full min-w-0 gap-4 rounded-xl border border-white/10 bg-black/30 p-4">

                <label className="flex cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={instagramOptimizationEnabled}
                    onChange={event =>
                      setInstagramOptimizationEnabled(
                        event.target.checked
                      )
                    }
                  />

                  <span className="text-sm font-black">
                    AUTO INSTAGRAM OPTIMIZATION
                  </span>
                </label>

                <div className="text-xs text-zinc-500">
                  Automatically builds an Instagram Reel caption
                  with a hook, music discovery keywords,
                  call to action and targeted hashtags.
                </div>

                <label className="grid w-full min-w-0 gap-2">
                  <span className="text-sm font-black">
                    {mediaType === "image"
                      ? "INSTAGRAM IMAGE CAPTION"
                      : "INSTAGRAM REEL CAPTION"}
                  </span>

                  <textarea
                    rows={5}
                    value={instagramCaption}
                    onChange={event =>
                      setInstagramCaption(
                        event.target.value
                      )
                    }
                    placeholder="Leave blank for automatic Instagram optimization..."
                    className="block w-full min-w-0 max-w-full resize-y rounded-xl border border-white/10 bg-black px-4 py-4 outline-none"
                  />
                </label>

              </div>
            ) : null}
{mediaType === "video" ? (
              <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
                <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm font-black">
                      TIKTOK AUTO SEO
                    </div>

                    <div className="mt-1 min-w-0 break-words text-xs text-zinc-500">
                      Automatically builds a TikTok music caption with
                      track keywords, SOLO BEATS branding, website promotion
                      and targeted music hashtags.
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setTikTokOptimizationEnabled(
                        current => !current
                      )
                    }
                    className={
                      tiktokOptimizationEnabled
                        ? "w-fit max-w-full shrink-0 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-black text-black"
                        : "w-fit max-w-full shrink-0 rounded-xl bg-white/10 px-4 py-2 text-xs font-black text-white"
                    }
                  >
                    {tiktokOptimizationEnabled
                      ? "AUTO SEO ON"
                      : "AUTO SEO OFF"}
                  </button>
                </div>

                <label className="mt-4 grid gap-2">
                  <span className="text-sm font-black">
                    TIKTOK CAPTION
                  </span>

                  <textarea
                    rows={6}
                    value={tiktokCaption}
                    onChange={event => {
                      setTikTokCaption(
                        event.target.value
                      );
                      setTikTokCaptionManuallyEdited(
                        true
                      );
                    }}
                    placeholder="Leave blank for automatic TikTok optimization..."
                    className="block w-full min-w-0 max-w-full resize-y rounded-xl border border-white/10 bg-black px-4 py-4 outline-none"
                  />
                </label>

                <div className="mt-2 text-xs text-zinc-500">
                  Automatic by default. You can manually edit the caption
                  before scheduling.
                </div>
              </div>
            ) : null}

<div>
              <div className="text-sm font-black">
                PLATFORMS
              </div>

              <div className="mt-3 flex w-full min-w-0 flex-wrap gap-3">

                {platformOptions.map(
                  platform => (
                    <label
                      key={
                        platform.id
                      }
                      className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-black px-4 py-3"
                    >
                      <input
                        type="checkbox"
                        checked={
                          platforms.includes(
                            platform.id
                          )
                        }
                        disabled={
                          mediaType === "image" &&
                          platform.id === "youtube"
                        }
                        onChange={() =>
                          togglePlatform(
                            platform.id
                          )
                        }
                      />

                      <span className="font-black">
                        {
                          platform.label
                        }
                      </span>
                    </label>
                  )
                )}

              </div>
            </div>
            {mediaType === "video" &&
            platforms.includes("youtube") ? (
              <div className="rounded-2xl border border-white/10 p-4">
                <div className="text-sm font-black">
                  YOUTUBE CONTENT TYPE
                </div>

                <div className="mt-3 flex w-full min-w-0 flex-wrap gap-3">
                  <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-sm font-bold">
                    <input
                      type="radio"
                      name="youtubeContentType"
                      value="short"
                      checked={
                        youtubeContentType === "short"
                      }
                      onChange={() =>
                        setYoutubeContentType("short")
                      }
                    />

                    YouTube Short
                  </label>

                  <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-sm font-bold">
                    <input
                      type="radio"
                      name="youtubeContentType"
                      value="long"
                      checked={
                        youtubeContentType === "long"
                      }
                      onChange={() =>
                        setYoutubeContentType("long")
                      }
                    />

                    YouTube Long Video
                  </label>
                </div>
            {/* =====================================================
                SOLO_YOUTUBE_VISIBILITY_V1_UI
                ===================================================== */}

            {mediaType === "video" &&
            platforms.includes("youtube") ? (
              <div className="rounded-2xl border border-white/10 p-4">

                <div className="text-sm font-black">
                  VIDEO VISIBILITY
                </div>

                <div className="mt-3 flex w-full min-w-0 flex-wrap gap-3">

                  <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-sm font-bold">
                    <input
                      type="radio"
                      name="youtubePrivacyStatus"
                      value="public"
                      checked={
                        youtubePrivacyStatus ===
                        "public"
                      }
                      onChange={() =>
                        setYoutubePrivacyStatus(
                          "public"
                        )
                      }
                    />
                    Public
                  </label>

                  <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-sm font-bold">
                    <input
                      type="radio"
                      name="youtubePrivacyStatus"
                      value="unlisted"
                      checked={
                        youtubePrivacyStatus ===
                        "unlisted"
                      }
                      onChange={() =>
                        setYoutubePrivacyStatus(
                          "unlisted"
                        )
                      }
                    />
                    Unlisted
                  </label>

                  <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-sm font-bold">
                    <input
                      type="radio"
                      name="youtubePrivacyStatus"
                      value="private"
                      checked={
                        youtubePrivacyStatus ===
                        "private"
                      }
                      onChange={() =>
                        setYoutubePrivacyStatus(
                          "private"
                        )
                      }
                    />
                    Private
                  </label>

                </div>

                <div className="mt-3 text-xs text-zinc-500">
                  Controls how new YouTube uploads are published.
                  Public is the default.
                </div>

              </div>
            ) : null}

              </div>
            ) : null}


                                    {platforms.includes("youtube") ? (
              <div className="grid w-full min-w-0 gap-4 rounded-xl border border-white/10 bg-black/30 p-4">

                <label className="flex cursor-pointer items-center gap-3">
                  <input
                    type="checkbox"
                    checked={youtubeSeoEnabled}
                    onChange={event =>
                      setYoutubeSeoEnabled(
                        event.target.checked
                      )
                    }
                  />

                  <span className="text-sm font-black">
                    AUTO YOUTUBE SEO
                  </span>
                </label>

                <div className="text-xs text-zinc-500">
                  Automatically optimizes the YouTube title,
                  description, hashtags and search tags.
                  Manual title and description fields still override
                  the automatic version.
                </div>

                {youtubeContentType === "short" ? (
                  <label className="grid w-full min-w-0 gap-2">
                    <span className="text-sm font-black">
                      SHORT TITLE
                    </span>

                    <input
                      type="text"
                      maxLength={100}
                      value={youtubeShortTitle}
                      onChange={event =>
                        setYoutubeShortTitle(
                          event.target.value
                        )
                      }
                      placeholder="Leave blank for automatic SEO title"
                      className="block w-full min-w-0 max-w-full resize-y rounded-xl border border-white/10 bg-black px-4 py-4 outline-none"
                    />
                  </label>
                ) : (
                  <label className="grid w-full min-w-0 gap-2">
                    <span className="text-sm font-black">
                      LONG-FORM TITLE
                    </span>

                    <input
                      type="text"
                      maxLength={100}
                      value={youtubeLongTitle}
                      onChange={event =>
                        setYoutubeLongTitle(
                          event.target.value
                        )
                      }
                      placeholder="Leave blank for automatic SEO title"
                      className="block w-full min-w-0 max-w-full resize-y rounded-xl border border-white/10 bg-black px-4 py-4 outline-none"
                    />
                  </label>
                )}

              </div>
            ) : null}
{platforms.includes("youtube") &&
            youtubeContentType === "short" ? (
              <label className="grid w-full min-w-0 gap-2">
                <span className="text-sm font-black">
                  SHORT DESCRIPTION
                </span>

                <textarea
                  rows={5}
                  value={youtubeShortDescription}
                  onChange={event =>
                    setYoutubeShortDescription(
                      event.target.value
                    )
                  }
                  placeholder="Write the YouTube Short description..."
                  className="block w-full min-w-0 max-w-full resize-y rounded-xl border border-white/10 bg-black px-4 py-4 outline-none"
                />
              </label>
            ) : null}

            {platforms.includes("youtube") &&
            youtubeContentType === "long" ? (
              <label className="grid w-full min-w-0 gap-2">
                <span className="text-sm font-black">
                  LONG-FORM DESCRIPTION
                </span>

                <textarea
                  rows={8}
                  value={youtubeLongDescription}
                  onChange={event =>
                    setYoutubeLongDescription(
                      event.target.value
                    )
                  }
                  placeholder="Write the YouTube long-form video description..."
                  className="block w-full min-w-0 max-w-full resize-y rounded-xl border border-white/10 bg-black px-4 py-4 outline-none"
                />
              </label>
            ) : null}
            {/* =====================================================
                SOLO_DEVICE_UPLOAD_V1_UI
                ===================================================== */}

            {mediaType === "video" && !imageMusicMode ? (
            <div className="grid w-full min-w-0 gap-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5">

              <div>
                <div className="text-xs font-black tracking-[0.2em] text-emerald-400">
                  UPLOAD FROM DEVICE
                </div>

                <div className="mt-2 text-sm text-zinc-400">
                  Upload a video directly from this computer or phone.
                  It will be stored in Firebase and connected automatically
                  to the scheduled post.
                </div>
              </div>

              {mediaType === "video" &&
              videoSource === "manager" ? (
                <div className="rounded-xl border border-emerald-500/20 bg-black/40 p-4">

                  <label className="flex items-center gap-3 font-black">
                    <input
                      type="checkbox"
                      checked={videoRotationEnabled}
                      disabled={
                        videoRotationVideos.length < 2
                      }
                      onChange={event =>
                        setVideoRotationEnabled(
                          event.target.checked
                        )
                      }
                    />

                    DAILY VIDEO ROTATION
                  </label>

                  <div className="mt-2 text-sm text-zinc-400">
                    Upload 2 or more videos. Recurring Shorts and
                    Reels automatically use the next video and loop.
                  </div>

                  <label className="mt-4 flex cursor-pointer items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-4 font-black text-emerald-200 hover:bg-emerald-500/20">

                    {deviceUploading
                      ? `UPLOADING ${deviceUploadProgress}%`
                      : videoRotationVideos.length > 0
                        ? "ADD MORE VIDEOS"
                        : "UPLOAD VIDEOS"}

                    <input
                      type="file"
                      accept="video/*"
                      multiple
                      disabled={deviceUploading}
                      className="hidden"
                      onChange={event => {
                        const files =
                          Array.from(
                            event.target.files || []
                          );

                        for (
                          const file of files
                        ) {
                          void uploadDeviceVideo(
                            file
                          );
                        }

                        event.currentTarget.value =
                          "";
                      }}
                    />

                  </label>

                  {videoRotationVideos.length > 0 ? (
                    <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">

                      {videoRotationVideos.map(
                        (video, index) => (
                          <div
                            key={video.storagePath}
                            className="rounded-xl border border-white/10 bg-black p-3"
                          >
                            <video
                              src={video.previewUrl}
                              controls
                              playsInline
                              preload="metadata"
                              className="aspect-[9/16] max-h-[360px] w-full rounded-lg bg-black object-contain"
                            />

                            <div className="mt-2 text-center text-xs font-black text-emerald-300">
                              VIDEO {index + 1} / DAY {index + 1}
                            </div>

                            <div className="mt-1 truncate text-center text-xs text-zinc-500">
                              {video.fileName}
                            </div>

                            <button
                              type="button"
                              disabled={deviceUploading}
                              onClick={() =>
                                void removeRotationVideo(
                                  video
                                )
                              }
                              className="mt-3 w-full rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-black text-red-300 hover:bg-red-500/20 disabled:opacity-50"
                            >
                              REMOVE VIDEO
                            </button>
                          </div>
                        )
                      )}

                    </div>
                  ) : null}

                </div>
              ) : null}

              {!deviceVideo ? (
                <label className="flex cursor-pointer items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-4 font-black text-emerald-200 hover:bg-emerald-500/20">

                  {deviceUploading
                    ? `UPLOADING ${deviceUploadProgress}%`
                    : "UPLOAD VIDEO FROM DEVICE"}

                  <input
                    type="file"
                    accept="video/*" multiple
                    disabled={deviceUploading}
                    className="hidden"
                    onChange={event => {
                      const files =
                        Array.from(
                          event.target.files || []
                        );

                      for (
                        const file of files
                      ) {
                        void uploadDeviceVideo(
                          file
                        );
                      }

                      event.currentTarget.value =
                        "";
                    }}
                  />

                </label>
              ) : (
                <div className="grid gap-4">

                  <video
                    src={deviceVideo.previewUrl}
                    controls
                    playsInline
                    preload="metadata"
                    className="w-full max-h-[520px] rounded-xl bg-black"
                  />

                  <div className="rounded-xl border border-white/10 bg-black/40 p-4">

                    <div className="text-xs font-black text-emerald-400">
                      READY
                    </div>

                    <div className="mt-2 break-all text-sm font-bold">
                      {deviceVideo.fileName}
                    </div>

                    <div className="mt-2 text-xs text-zinc-500">
                      Firebase Storage media URL and permanent storage path are attached automatically.
                    </div>

                  </div>

                  <div className="flex flex-wrap gap-3">

                    <label className="cursor-pointer rounded-xl border border-white/15 px-4 py-3 text-sm font-black">

                      {deviceUploading
                        ? `UPLOADING ${deviceUploadProgress}%`
                        : "REPLACE VIDEO"}

                      <input
                        type="file"
                        accept="video/*" multiple
                        disabled={deviceUploading}
                        className="hidden"
                        onChange={event => {
                          const files =
                        Array.from(
                          event.target.files || []
                        );

                      for (
                        const file of files
                      ) {
                        void uploadDeviceVideo(
                          file
                        );
                      }

                          event.currentTarget.value =
                            "";
                        }}
                      />

                    </label>

                    <button
                      type="button"
                      disabled={deviceUploading}
                      onClick={() =>
                        void removeDeviceVideo()
                      }
                      className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-black text-red-200 disabled:opacity-50"
                    >
                      REMOVE
                    </button>

                  </div>

                  {deviceUploading ? (
                    <div className="grid w-full min-w-0 gap-2">

                      <div className="h-3 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full bg-emerald-400 transition-all"
                          style={{
                            width:
                              `${deviceUploadProgress}%`,
                          }}
                        />
                      </div>

                      <div className="text-xs font-black text-emerald-300">
                        {deviceUploadProgress}% UPLOADED
                      </div>

                    </div>
                  ) : null}

                </div>
              )}

            </div>
            ) : null}

            {mediaType === "image" ? (
              <div className="grid w-full min-w-0 gap-4 rounded-2xl border border-blue-500/20 bg-blue-500/5 p-5">

                <div>
                  <div className="text-xs font-black tracking-[0.2em] text-blue-300">
                    IMAGE FROM DEVICE
                  </div>

                  <div className="mt-2 text-sm text-zinc-400">
                    Upload the image that Facebook and Instagram will publish. Captions auto-fill and can still be edited before scheduling.
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-black/40 p-4">
                  <label className="flex items-center gap-3 font-black">
                    <input
                      type="checkbox"
                      checked={imageRotationEnabled}
                      disabled={imageRotationImages.length < 2}
                      onChange={event =>
                        setImageRotationEnabled(
                          event.target.checked
                        )
                      }
                    />

                    DAILY IMAGE ROTATION
                  </label>

                  <p className="mt-2 text-sm text-zinc-400">
                    Upload 2 or more images. Recurring posts will automatically use the next image each time and loop back to the first image.
                  </p>

                  {imageRotationImages.length > 0 ? (
                    <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                      {imageRotationImages.map(
                        (image, index) => (
                          <div
                            key={image.storagePath}
                            className="rounded-xl border border-white/10 bg-black p-2"
                          >
                            <img
                              src={image.previewUrl}
                              alt={`Rotation image ${index + 1}`}
                              className="aspect-square w-full rounded-lg object-cover"
                            />

                            <div className="mt-2 text-center text-xs font-black text-blue-300">
                              DAY {index + 1}
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  ) : null}
                </div>

                {!deviceImage ? (
                  <label className="flex cursor-pointer items-center justify-center rounded-xl border border-blue-500/30 bg-blue-500/10 px-5 py-4 font-black text-blue-200">

                    {imageUploading
                      ? `UPLOADING ${imageUploadProgress}%`
                      : "UPLOAD IMAGE FROM DEVICE"}

                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/*" multiple
                      disabled={imageUploading}
                      className="hidden"
                      onChange={event => {
                        const files =
                          Array.from(
                            event.target.files || []
                          );

                        for (
                          const file of files
                        ) {
                          void uploadDeviceImage(
                            file
                          );
                        }

                        event.currentTarget.value =
                          "";
                      }}
                    />

                  </label>
                ) : (
                  <div className="grid gap-4">

                    <img
                      src={deviceImage.previewUrl}
                      alt="Social post preview"
                      className="max-h-[620px] w-full rounded-xl object-contain bg-black"
                    />

                    <div className="rounded-xl border border-white/10 bg-black/40 p-4">

                      <div className="text-xs font-black text-blue-300">
                        IMAGE READY
                      </div>

                      <div className="mt-2 break-all text-sm font-bold">
                        {deviceImage.fileName}
                      </div>

                    </div>

                    <div className="flex flex-wrap gap-3">

                      <label className="cursor-pointer rounded-xl border border-white/15 px-4 py-3 text-sm font-black">

                        {imageUploading
                          ? `UPLOADING ${imageUploadProgress}%`
                          : "REPLACE IMAGE"}

                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/*" multiple
                          disabled={imageUploading}
                          className="hidden"
                          onChange={event => {
                            const files =
                          Array.from(
                            event.target.files || []
                          );

                        for (
                          const file of files
                        ) {
                          void uploadDeviceImage(
                            file
                          );
                        }

                            event.currentTarget.value =
                              "";
                          }}
                        />

                      </label>

                      <button
                        type="button"
                        disabled={imageUploading}
                        onClick={() =>
                          void removeDeviceImage()
                        }
                        className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-black text-red-200"
                      >
                        REMOVE IMAGE
                      </button>

                    </div>

                  </div>
                )}

              </div>
            ) : null}

            <div className="rounded-2xl border border-white/10 bg-black p-4">

              <label className="flex cursor-pointer items-center gap-3">

                <input
                  type="checkbox"
                  checked={recurringEnabled}
                  onChange={
                    event =>
                      setRecurringEnabled(
                        event.target.checked
                      )
                  }
                />

                <span className="font-black">
                  RECURRING / DAILY POSTING
                </span>

              </label>

              {recurringEnabled ? (

                <div className="mt-4 grid gap-4">

                  <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">

                    <input
                      type="checkbox"
                      checked={recurringUntilCancelled}
                      onChange={
                        event => {
                          setRecurringUntilCancelled(
                            event.target.checked
                          );

                          if (event.target.checked) {
                            setRecurringEndDate("");
                          }
                        }
                      }
                    />

                    <div>
                      <div className="font-black text-emerald-200">
                        UNTIL CANCELLED
                      </div>

                      <div className="mt-1 text-xs text-zinc-400">
                        Keep creating the next scheduled post automatically until you cancel the series.
                      </div>
                    </div>

                  </label>

                  <div className="grid gap-4 md:grid-cols-2">

                  <label className="grid w-full min-w-0 gap-2">

                    <span className="text-sm font-black">
                      FINISH DATE
                    </span>

                    <input
                      type="date"
                      value={recurringEndDate}
                      disabled={recurringUntilCancelled}
                      onChange={
                        event =>
                          setRecurringEndDate(
                            event.target.value
                          )
                      }
                      className="rounded-xl border border-white/10 bg-[#050505] px-4 py-4 disabled:cursor-not-allowed disabled:opacity-40"
                    />

                    {recurringUntilCancelled ? (
                      <span className="text-xs font-bold text-emerald-300">
                        No finish date - runs until you cancel the series.
                      </span>
                    ) : null}

                  </label>

                  <label className="grid w-full min-w-0 gap-2">

                    <span className="text-sm font-black">
                      FREQUENCY
                    </span>

                    <select
                      value={recurringFrequencyDays}
                      onChange={
                        event =>
                          setRecurringFrequencyDays(
                            Number(
                              event.target.value
                            ) as
                              1 | 2 | 3 | 7
                          )
                      }
                      className="rounded-xl border border-white/10 bg-[#050505] px-4 py-4"
                    >

                      <option value={1}>
                        DAILY
                      </option>

                      <option value={2}>
                        EVERY 2 DAYS
                      </option>

                      <option value={3}>
                        EVERY 3 DAYS
                      </option>

                      <option value={7}>
                        WEEKLY
                      </option>

                    </select>

                  </label>

                  </div>

                </div>

              ) : null}

            </div>

<label className="grid w-full min-w-0 gap-2">
              <span className="text-sm font-black">
                START DATE & TIME
              </span>

              <input
                type="datetime-local"
                value={
                  scheduleDateTime
                }
                onChange={
                  event =>
                    setScheduleDateTime(
                      event.target.value
                    )
                }
                className="w-full min-w-0 max-w-full rounded-xl border border-white/10 bg-black px-4 py-4"
              />

              <span className="text-xs text-zinc-500">
                Times are entered in your local Eastern time and stored as UTC.
              </span>
            </label>

            <div className="flex flex-wrap gap-3">

              <button
                type="button"
                disabled={saving}
                onClick={() =>
                  void createPost(
                    false
                  )
                }
                className="rounded-xl border border-white/15 px-5 py-4 font-black disabled:opacity-50"
              >
                SAVE DRAFT
              </button>

              <button
                type="button"
                disabled={saving}
                onClick={() =>
                  void createPost(
                    true
                  )
                }
                className="rounded-xl bg-white px-5 py-4 font-black text-black disabled:opacity-50"
              >
                {saving
                  ? "SAVING..."
                  : "SCHEDULE POST"}
              </button>
              {/* SOLO_SCHEDULE_INLINE_ERROR_V1 */}
              {error ? (
                <div
                  role="alert"
                  className="w-full rounded-xl border border-red-500/50 bg-red-950/50 p-4 font-bold text-red-200"
                >
                  SCHEDULING ISSUE: {error}
                </div>
              ) : null}

              <button
                type="button"
                disabled={autoPromoting || saving}
                onClick={() =>
                  void autoPromoteForMe()
                }
                className="rounded-xl bg-red-500 px-6 py-4 font-black text-white disabled:opacity-50"
              >
                {autoPromoting
                  ? "CREATING PROMO..."
                  : "AUTO PROMOTE FOR ME"}
              </button>

            </div>

          </div>

        </section>

        <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">

          <Metric
            label="TOTAL"
            value={posts.length}
          />

          <Metric
            label="SCHEDULED"
            value={
              posts.filter(
                item =>
                  item.status === "scheduled" ||
                  item.status === "draft" ||
                  item.status === "publishing"
              ).length
            }
          />

          <Metric
            label="PUBLISHED"
            value={
              posts.filter(
                item =>
                  item.status === "published" ||
                  item.status === "existing_verified"
              ).length
            }
          />

          <Metric
            label="FAILED"
            value={
              posts.filter(
                item =>
                  item.status === "failed"
              ).length
            }
          />

          <Metric
            label="CANCELLED"
            value={
              posts.filter(
                item =>
                  item.status === "cancelled"
              ).length
            }
          />

        </section>

        <section className="mt-8 w-full min-w-0 max-w-full overflow-hidden rounded-3xl border border-white/10 bg-[#0b0b0b] p-4 sm:p-6">

          <p className="text-xs font-black tracking-[0.2em] text-red-400">
            HISTORY / STATUS
          </p>

          <h2 className="mt-2 text-3xl font-black">
            Promotion History & Queue
          </h2>

          <div className="mt-5 flex flex-wrap gap-2">

            {([
              ["all", "ALL"],
              ["upcoming", "UPCOMING"],
              ["published", "PUBLISHED"],
              ["failed", "FAILED"],
              ["cancelled", "CANCELLED"],
              ["facebook", "FACEBOOK"],
              ["instagram", "INSTAGRAM"],
              ["tiktok", "TIKTOK"],
              ["youtube_short", "YOUTUBE SHORTS"],
              ["youtube_long", "YOUTUBE LONG"],
            ] as const).map(
              ([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() =>
                    setHistoryFilter(id)
                  }
                  className={
                    historyFilter === id
                      ? "rounded-xl bg-white px-4 py-3 text-sm font-black text-black"
                      : "rounded-xl border border-white/10 bg-black px-4 py-3 text-sm font-black text-white"
                  }
                >
                  {label}
                </button>
              )
            )}

          </div>

          <div className="mt-6 space-y-4">

            {filteredPosts.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-black p-8 text-zinc-500">
                No promotions found for this status.
              </div>
            ) : (
              filteredPosts.map(
                post => (
                  <article
                    key={
                      post.postId
                    }
                    className="rounded-2xl border border-white/10 bg-black p-5"
                  >

                    <div className="flex flex-wrap items-start justify-between gap-4">

                      <div>
                        <div className="mb-3 flex flex-wrap gap-2">

                          {post.recurringEnabled ? (
                            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-black text-emerald-200">
                              {
                                post.recurringFrequencyDays === 1
                                  ? "DAILY"
                                  : post.recurringFrequencyDays === 7
                                    ? "WEEKLY"
                                    : `EVERY ${post.recurringFrequencyDays} DAYS`
                              }
                              {post.recurringUntilCancelled
                                ? " - UNTIL CANCELLED"
                                : post.recurringEndDate
                                  ? ` - UNTIL ${post.recurringEndDate}`
                                  : ""}
                            </div>
                          ) : null}

                          {post.platforms.includes(
                            "facebook"
                          ) ? (
                            <PlatformStatusBadge
                              label="FACEBOOK"
                              status={
                                post.platformStatus?.facebook || "pending"
                              }
                            />
                          ) : null}

                          {post.platforms.includes(
                            "instagram"
                          ) ? (
                            <PlatformStatusBadge
                              label="INSTAGRAM"
                              status={
                                post.platformStatus?.instagram || "pending"
                              }
                            />
                          ) : null}

                          {post.platforms.includes(
                            "youtube"
                          ) ? (
                            <PlatformStatusBadge
                              label={
                                post.youtubeContentType ===
                                "long"
                                  ? "YOUTUBE LONG"
                                  : "YOUTUBE SHORTS"
                              }
                              status={
                                post.platformStatus?.youtube || "pending"
                              }
                            />
                          ) : null}

                          {post.platforms.includes(
                            "tiktok"
                          ) ? (
                            <div className="flex flex-wrap items-center gap-2">

                              <PlatformStatusBadge
                                label="TIKTOK"
                                status={
                                  post.platformStatus?.tiktok || "pending"
                                }
                              />

                              <span
                                className={`rounded-full border px-3 py-1 text-[10px] font-black ${
                                  post.tiktokPrivacyLevel ===
                                  "PUBLIC_TO_EVERYONE"
                                    ? "border-green-400/30 bg-green-500/10 text-green-200"
                                    : post.tiktokPrivacyLevel ===
                                      "SELF_ONLY"
                                      ? "border-amber-400/30 bg-amber-500/10 text-amber-200"
                                      : "border-cyan-400/30 bg-cyan-500/10 text-cyan-200"
                                }`}
                              >
                                {
                                  post.tiktokPrivacyLevel ===
                                  "PUBLIC_TO_EVERYONE"
                                    ? "PUBLIC"
                                    : post.tiktokPrivacyLevel ===
                                      "SELF_ONLY"
                                      ? "PRIVATE FALLBACK"
                                      : "AUTO: PUBLIC WHEN ALLOWED"
                                }
                              </span>

                            </div>
                          ) : null}

                        </div>

                        <div className="text-xs font-black uppercase tracking-wider text-red-400">
                          {
                            post.videoSource === "youtube" &&
                            (
                              post.status === "published" ||
                              post.status === "existing_verified"
                            )
                              ? "EXISTING VIDEO VERIFIED"
                              : post.status.toUpperCase()
                          }
                        </div>

                        <h3 className="mt-2 text-2xl font-black">
                          {
                            post.title
                          }
                        </h3>

                        {post.trackTitle ? (
                          <p className="mt-2 text-zinc-400">
                            Track:{" "}
                            <strong className="text-white">
                              {
                                post.trackTitle
                              }
                            </strong>
                          </p>
                        ) : null}

                      </div>

                      <div className="rounded-full border border-white/10 px-4 py-2 text-xs font-black">
                        {post.mediaType === "image"
                          ? "IMAGE POST"
                          : post.platforms.includes("youtube")
                          ? (
                              post.youtubeContentType === "long"
                                ? "YOUTUBE LONG VIDEO"
                                : "YOUTUBE SHORT"
                            )
                          : post.platforms
                              .join(" / ")
                              .toUpperCase()}
                      </div>

                    </div>

                    {post.mediaType !== "image" && post.videoUrl ? (
                      <div className="mt-5 overflow-hidden rounded-2xl border border-fuchsia-500/20 bg-zinc-950 p-4">

                        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">

                          <div>
                            <div className="text-xs font-black uppercase tracking-wider text-fuchsia-300">
                              GENERATED PROMO
                            </div>

                            <div className="mt-1 text-sm text-zinc-400">
                              Saved promotional video
                            </div>
                          </div>

                          <a
                            href={post.videoUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-xl border border-white/10 px-4 py-2 text-xs font-black text-white"
                          >
                            OPEN VIDEO
                          </a>

                        </div>

                        <video
                          src={post.videoUrl}
                          controls
                          playsInline
                          preload="metadata"
                          className="mx-auto max-h-[520px] w-full rounded-xl bg-black object-contain"
                        />

                      </div>
                    ) : null}

                    {post.mediaType === "image" && post.imageUrl ? (
                      <div className="mt-5 overflow-hidden rounded-2xl border border-fuchsia-500/20 bg-zinc-950 p-4">

                        <div className="mb-3 text-xs font-black uppercase tracking-wider text-fuchsia-300">
                          PROMOTION IMAGE
                        </div>

                        <img
                          src={post.imageUrl}
                          alt={post.title || "Promotion"}
                          className="mx-auto max-h-[520px] w-full rounded-xl bg-black object-contain"
                        />

                      </div>
                    ) : null}

                    <div className="mt-5 grid gap-3 md:grid-cols-3">

                      <Info
                        label="SCHEDULED"
                        value={
                          post.scheduledFor
                            ? new Date(
                                post.scheduledFor
                              ).toLocaleString()
                            : "Draft"
                        }
                      />

                      <Info
                        label="TIMEZONE"
                        value={
                          post.timezone
                        }
                      />

                      <Info
                        label="RETRIES"
                        value={`${post.retryCount} / ${post.maxRetries}`}
                      />

                      {post.recurringEnabled ? (
                        <Info
                          label="REPEAT"
                          value={
                            post.recurringUntilCancelled
                              ? (
                                  post.recurringSeriesCancelled
                                    ? "SERIES CANCELLED"
                                    : " - UNTIL CANCELLED"
                                )
                              : (
                                  post.recurringEndDate
                                    ? ` - UNTIL ${post.recurringEndDate}`
                                    : "RECURRING"
                                )
                          }
                        />
                      ) : null}

                    </div>

                    {
                      typeof post.publishedUrls?.facebook ===
                        "string" &&
                      post.publishedUrls.facebook.trim()
                        .length > 0 ? (
                        <div className="mt-4">
                          <a
                            href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
                              post.publishedUrls.facebook
                            )}`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex w-full items-center justify-center rounded-xl border border-blue-400/40 bg-blue-500/15 px-5 py-4 text-sm font-black text-blue-200 transition hover:bg-blue-500/25"
                          >
                            SHARE TO MY PERSONAL FACEBOOK
                          </a>

                          <div className="mt-2 text-center text-[11px] text-zinc-500">
                            Opens Facebook so you can confirm the share to your personal profile.
                          </div>
                        </div>
                      ) : null
                    }
                    {/* SOLO_PERSONAL_SOCIAL_SHARE_V1 */}
                    <div className="mt-4 grid gap-3">

                      {
                        typeof post.publishedUrls?.instagram ===
                          "string" &&
                        post.publishedUrls.instagram.trim()
                          .length > 0 ? (
                          <a
                            href={
                              post.publishedUrls.instagram
                            }
                            target="_blank"
                            rel="noreferrer"
                            className="flex w-full items-center justify-center rounded-xl border border-fuchsia-400/40 bg-fuchsia-500/15 px-5 py-4 text-center text-sm font-black text-fuchsia-200 transition hover:bg-fuchsia-500/25"
                          >
                            OPEN / SHARE ON INSTAGRAM
                          </a>
                        ) : null
                      }

                      {
                        typeof post.publishedUrls?.tiktok ===
                          "string" &&
                        post.publishedUrls.tiktok.trim()
                          .length > 0 ? (
                          <a
                            href={
                              post.publishedUrls.tiktok
                            }
                            target="_blank"
                            rel="noreferrer"
                            className="flex w-full items-center justify-center rounded-xl border border-cyan-400/40 bg-cyan-500/15 px-5 py-4 text-center text-sm font-black text-cyan-200 transition hover:bg-cyan-500/25"
                          >
                            OPEN / SHARE ON TIKTOK
                          </a>
                        ) : null
                      }

                      {
                        (
                          (
                            typeof post.publishedUrls?.instagram ===
                              "string" &&
                            post.publishedUrls.instagram.trim()
                              .length > 0
                          ) ||
                          (
                            typeof post.publishedUrls?.tiktok ===
                              "string" &&
                            post.publishedUrls.tiktok.trim()
                              .length > 0
                          )
                        ) ? (
                          <div className="text-center text-[11px] text-zinc-500">
                            Opens the published post so you can use that platform's sharing options.
                          </div>
                        ) : null
                      }

                    </div>
                    {Object.keys(
                      post.publishedUrls || {}
                    ).length > 0 ? (
                      <div className="mt-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">

                        <div className="text-xs font-black tracking-wider text-emerald-300">
                          PUBLISHED LINKS
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">

                          {Object.entries(
                            post.publishedUrls || {}
                          ).map(
                            ([platform, url]) => (
                              <a
                                key={platform}
                                href={url}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-xl border border-emerald-500/30 px-4 py-2 text-sm font-black text-emerald-200"
                              >
                                OPEN {platform.toUpperCase()}
                              </a>
                            )
                          )}

                        </div>
                      </div>
                    ) : null}

                    <div className="mt-5 flex flex-wrap gap-3">

                      {(
                        post.status === "scheduled" ||
                        post.status === "draft"
                      ) ? (
                        <button
                          type="button"
                          onClick={() =>
                            openReschedulePicker(
                              post.postId,
                              post.scheduledFor
                            )
                          }
                          className="rounded-xl border border-white/10 px-4 py-3 text-sm font-black"
                        >
                          RESCHEDULE
                        </button>
                      ) : null}

                      {(
                        post.status === "scheduled" ||
                        post.status === "draft"
                      ) ? (
                        <button
                          type="button"
                          onClick={() =>
                            void actionPost(
                              "cancel",
                              post.postId
                            )
                          }
                          className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-black text-red-200"
                        >
                          CANCEL
                        </button>
                      ) : null}

                      {post.recurringEnabled &&
                      post.recurringUntilCancelled &&
                      !post.recurringSeriesCancelled ? (
                        <button
                          type="button"
                          onClick={() => {
                            const confirmed =
                              window.confirm(
                                "Cancel this recurring series? No more future posts will be created."
                              );

                            if (confirmed) {
                              void actionPost(
                                "cancel_series",
                                post.postId
                              );
                            }
                          }}
                          className="rounded-xl border border-orange-500/30 bg-orange-500/10 px-4 py-3 text-sm font-black text-orange-200"
                        >
                          CANCEL DAILY SERIES
                        </button>
                      ) : null}

                      {post.recurringUntilCancelled === true &&
                      !post.platforms.includes(
                        "tiktok"
                      ) ? (
                        <button
                          type="button"
                          onClick={() =>
                            void addTikTokToSeries(
                              post.postId
                            )
                          }
                          className="rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-4 py-3 text-sm font-black text-cyan-200 transition hover:bg-cyan-500/20"
                        >
                          ADD TIKTOK TO SERIES
                        </button>
                      ) : null}
                      {post.status === "failed" &&
                      post.retryCount < post.maxRetries ? (
                        <button
                          type="button"
                          onClick={() =>
                            void actionPost(
                              "retry",
                              post.postId
                            )
                          }
                          className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm font-black text-amber-100"
                        >
                          RETRY
                        </button>
                      ) : null}

                      {post.recurringUntilCancelled === true &&
                      !post.platforms.includes(
                        "tiktok"
                      ) ? (
                        <button
                          type="button"
                          onClick={() =>
                            void addTikTokToSeries(
                              post.postId
                            )
                          }
                          className="rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-4 py-3 text-sm font-black text-cyan-200 transition hover:bg-cyan-500/20"
                        >
                          ADD TIKTOK TO SERIES
                        </button>
                      ) : null}
                      {post.status === "failed" &&
                      post.retryCount >= post.maxRetries ? (
                        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm font-black text-amber-200">
                          RETRY LIMIT REACHED
                        </div>
                      ) : null}

                      <button
                        type="button"
                        onClick={() =>
                          void deletePost(
                            post.postId
                          )
                        }
                        className="rounded-xl border border-red-600 bg-red-600 px-4 py-3 text-sm font-black text-white hover:bg-red-500"
                      >
                        DELETE
                      </button>

                    </div>

                    {post.lastError ? (
                      <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">

                        <div className="mb-2 text-xs font-black tracking-wider text-red-300">
                          LAST ERROR
                        </div>

                        {
                          post.lastError
                        }

                      </div>
                    ) : null}

                  </article>
                )
              )
            )}

          </div>

        </section>

      </div>

        {reschedulePostId ? (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4">
            <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#101010] p-6 shadow-2xl">

              <div className="text-xs font-black tracking-[0.2em] text-violet-300">
                RESCHEDULE POST
              </div>

              <h2 className="mt-2 text-2xl font-black">
                Choose a new date and time
              </h2>

              <p className="mt-2 text-sm text-zinc-400">
                Select when this promotion should publish.
              </p>

              <div className="mt-6 grid gap-4">

                <label className="grid gap-2">
                  <span className="text-sm font-black">
                    DATE
                  </span>

                  <input
                    type="date"
                    value={rescheduleDate}
                    onChange={event =>
                      setRescheduleDate(
                        event.target.value
                      )
                    }
                    className="w-full rounded-xl border border-white/10 bg-black px-4 py-4 text-white outline-none"
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-black">
                    TIME
                  </span>

                  <input
                    type="time"
                    value={rescheduleTime}
                    onChange={event =>
                      setRescheduleTime(
                        event.target.value
                      )
                    }
                    className="w-full rounded-xl border border-white/10 bg-black px-4 py-4 text-white outline-none"
                  />
                </label>

                <div className="rounded-xl border border-white/10 bg-black/40 px-4 py-3">
                  <div className="text-xs font-black text-zinc-500">
                    TIMEZONE
                  </div>

                  <div className="mt-1 font-black">
                    America/New_York
                  </div>
                </div>

              </div>

              <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">

                <button
                  type="button"
                  disabled={rescheduling}
                  onClick={() => {
                    setReschedulePostId("");
                    setRescheduleDate("");
                    setRescheduleTime("");
                  }}
                  className="rounded-xl border border-white/10 px-5 py-3 font-black disabled:opacity-50"
                >
                  CANCEL
                </button>

                <button
                  type="button"
                  disabled={
                    rescheduling ||
                    !rescheduleDate ||
                    !rescheduleTime
                  }
                  onClick={() =>
                    void saveReschedule()
                  }
                  className="rounded-xl bg-violet-500 px-5 py-3 font-black text-white disabled:opacity-50"
                >
                  {rescheduling
                    ? "SAVING..."
                    : "SAVE NEW TIME"}
                </button>

              </div>

            </div>
          </div>
        ) : null}    </main>
  );
}

function ConnectionCard({
  label,
  configured,
  connected,
  onConnect,
}: {
  label: string;
  configured: boolean;
  connected: boolean;
  onConnect?: () => void;
}) {
  const text =
    connected
      ? "CONNECTED"
      : configured
        ? "READY TO CONNECT"
        : "SETUP REQUIRED";

  return (
    <div className="rounded-2xl border border-white/10 bg-black p-5">

      <div className="font-black">
        {label}
      </div>

      <div className={
        "mt-3 text-sm font-black " +
        (
          connected
            ? "text-emerald-400"
            : configured
              ? "text-amber-300"
              : "text-red-400"
        )
      }>
        {text}
      </div>

      {onConnect && configured && !connected ? (
        <button
          type="button"
          onClick={onConnect}
          className="mt-4 rounded-xl bg-white px-4 py-3 text-sm font-black text-black"
        >
          CONNECT
        </button>
      ) : null}

    </div>
  );
}


function PlatformStatusBadge({
  label,
  status,
}: {
  label: string;
  status: string;
}) {

  const normalized =
    String(
      status || "scheduled"
    ).toLowerCase();

  const classes =
    normalized === "published" ||
    normalized === "existing_verified"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
      : normalized === "failed"
        ? "border-red-500/30 bg-red-500/10 text-red-200"
        : normalized === "publishing"
          ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
          : normalized === "waiting_connection"
            ? "border-orange-500/30 bg-orange-500/10 text-orange-200"
            : "border-white/15 bg-white/5 text-zinc-200";

  return (
    <div
      className={
        `rounded-lg border px-3 py-2 text-xs font-black ${classes}`
      }
    >
      {label}:{" "}
      {normalized
        .replaceAll("_", " ")
        .toUpperCase()}
    </div>
  );
}
function Metric({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0b0b0b] p-5">

      <div className="text-xs font-black tracking-wider text-zinc-500">
        {label}
      </div>

      <div className="mt-2 text-3xl font-black">
        {value}
      </div>

    </div>
  );
}

function Info({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-4">

      <div className="text-[10px] font-black tracking-wider text-zinc-500">
        {label}
      </div>

      <div className="mt-2 break-all font-black">
        {value}
      </div>

    </div>
  );
}





























































































