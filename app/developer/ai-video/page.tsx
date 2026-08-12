"use client";

import Link from "next/link";
import {
  ChangeEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useAuth } from "../../auth/AuthContext";

const OWNER_EMAIL = "supe4.me@gmail.com";

type GenerationMode = "text" | "image" | "music";
type AspectRatio = "16:9" | "9:16" | "1:1";
type Duration = "5" | "10" | "15" | "30" | "60";

type AudioLibraryItem = {
  mediaId: string;
  title: string;
  kind: string | null;
  mimeType: string | null;
  originalName: string | null;
  extension: string | null;
  storagePath: string | null;
  previewUrl: string | null;
};

const promptPresets = [
  {
    label: "Cinematic",
    prompt:
      "Cinematic music video with dramatic lighting, sweeping camera motion, atmospheric depth, polished film look, high detail.",
  },
  {
    label: "Neon",
    prompt:
      "Futuristic neon city visuals, glowing lights, energetic motion, cyberpunk atmosphere, music-driven cuts, premium cinematic quality.",
  },
  {
    label: "Dark",
    prompt:
      "Dark aggressive music visual with deep shadows, metallic textures, smoke, high contrast, dramatic movement, intense cinematic energy.",
  },
  {
    label: "Visualizer",
    prompt:
      "Audio-reactive looping music visualizer with clean motion graphics, pulsing energy, dynamic waveform movement, seamless loop.",
  },
  {
    label: "Album Trailer",
    prompt:
      "Premium album trailer with dramatic reveal, cinematic motion, album artwork focus, atmospheric transitions, release-promo energy.",
  },
  {
    label: "Social Promo",
    prompt:
      "Fast-paced social media promo clip with a strong opening hook, energetic transitions, bold motion, and vertical-ready composition.",
  },
];

function fileLabel(file: File | null) {
  return file ? file.name : "No file selected";
}

export default function AiVideoGeneratorPage() {
  const { user, loading } = useAuth();

  const [mode, setMode] = useState<GenerationMode>("text");
  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] =
    useState<AspectRatio>("16:9");
  const [duration, setDuration] =
    useState<Duration>("10");
  const [imageFile, setImageFile] =
    useState<File | null>(null);
  const [audioFile, setAudioFile] =
    useState<File | null>(null);
  const [selectedPreset, setSelectedPreset] =
    useState<string | null>(null);
  const [statusMessage, setStatusMessage] =
    useState(
      "Generator engine is not connected yet."
    );

  // AI_VIDEO_STEP_3A_JOB_API
  const [currentJobId, setCurrentJobId] =
    useState<string | null>(null);
  const [creatingJob, setCreatingJob] =
    useState(false);
  const [jobError, setJobError] =
    useState<string | null>(null);

  const [outputUrl, setOutputUrl] =
    useState<string | null>(null);

  const [savingToVideoManager, setSavingToVideoManager] =
    useState(false);

  const [savedVideoMediaId, setSavedVideoMediaId] =
    useState<string | null>(null);

  const [saveVideoMessage, setSaveVideoMessage] =
    useState<string | null>(null);

  const [audioLibraryItems, setAudioLibraryItems] =
    useState<AudioLibraryItem[]>([]);

  const [selectedAudioMediaId, setSelectedAudioMediaId] =
    useState("");

  const [musicVolume, setMusicVolume] =
    useState(1);

  const [musicStart, setMusicStart] =
    useState(0);

  const [loopMusic, setLoopMusic] =
    useState(true);

  const [addingMusic, setAddingMusic] =
    useState(false);

  const [musicVideoUrl, setMusicVideoUrl] =
    useState<string | null>(null);

  const [musicVideoMediaId, setMusicVideoMediaId] =
    useState<string | null>(null);

  const [musicVideoPublished, setMusicVideoPublished] =
    useState(false);

  const [musicVideoHomepage, setMusicVideoHomepage] =
    useState(false);

  const [musicVideoPremiumTv, setMusicVideoPremiumTv] =
    useState(false);

  const [updatingMusicVideoDistribution, setUpdatingMusicVideoDistribution] =
    useState<string | null>(null);

  const [musicVideoDistributionMessage, setMusicVideoDistributionMessage] =
    useState<string | null>(null);

  const [musicMessage, setMusicMessage] =
    useState<string | null>(null);

  const [desktopMusicFile, setDesktopMusicFile] =
    useState<File | null>(null);

  const [uploadingDesktopMusic, setUploadingDesktopMusic] =
    useState(false);

  const [desktopMusicMessage, setDesktopMusicMessage] =
    useState<string | null>(null);

  const [desktopMusicProgress, setDesktopMusicProgress] =
    useState(0);
  const isOwner =
    user?.email?.toLowerCase() === OWNER_EMAIL;

    // AI_VIDEO_LOAD_AUDIO_LIBRARY
  useEffect(() => {
    if (!user || !isOwner) {
      return;
    }

    const currentUser = user;
    let cancelled = false;

    async function loadAudioLibrary() {
      try {
        const idToken =
          await currentUser.getIdToken();

        const response =
          await fetch(
            "/api/owner/media",
            {
              headers: {
                Authorization:
                  `Bearer ${idToken}`,
              },
              cache: "no-store",
            }
          );

        const data =
          (await response.json()) as {
            success?: boolean;
            media?: AudioLibraryItem[];
          };

        if (
          cancelled ||
          !response.ok ||
          !data.success ||
          !Array.isArray(data.media)
        ) {
          return;
        }

        const audioItems =
          data.media.filter(
            (item) =>
              item.kind === "audio" &&
              Boolean(item.storagePath)
          );

        setAudioLibraryItems(audioItems);
      } catch (error) {
        console.error(
          "AI Video audio library load error:",
          error
        );
      }
    }

    void loadAudioLibrary();

    return () => {
      cancelled = true;
    };
  }, [user, isOwner]);
  // AI_VIDEO_LOAD_LATEST_COMPLETED_JOB
  useEffect(() => {
    if (!user || !isOwner) {
      return;
    }

    const currentUser = user;
    let cancelled = false;

    async function loadLatestCompletedVideo() {
      try {
        const idToken =
          await currentUser.getIdToken();

        const response =
          await fetch(
            "/api/owner/ai-video/jobs",
            {
              method: "GET",
              headers: {
                Authorization:
                  `Bearer ${idToken}`,
              },
              cache: "no-store",
            }
          );

        const data =
          (await response.json()) as {
            success?: boolean;
            jobs?: Array<{
              id?: string;
              outputUrl?: string | null;
            }>;
            error?: string;
          };

        if (
          !response.ok ||
          !data.success
        ) {
          throw new Error(
            data.error ||
              "Saved AI video jobs could not be loaded."
          );
        }

        const latestCompleted =
          data.jobs?.find(
            (job) =>
              typeof job.outputUrl === "string" &&
              job.outputUrl.trim().length > 0
          );

        if (
          cancelled ||
          !latestCompleted?.outputUrl
        ) {
          return;
        }

        setOutputUrl(
          latestCompleted.outputUrl
        );

        if (latestCompleted.id) {
          setCurrentJobId(
            latestCompleted.id
          );
        }

        setStatusMessage(
          "Latest completed AI video loaded."
        );
      } catch (error) {
        if (!cancelled) {
          console.error(
            "Latest AI video load error:",
            error
          );
        }
      }
    }

    void loadLatestCompletedVideo();

    return () => {
      cancelled = true;
    };
  }, [user, isOwner]);
  const modeHelp = useMemo(() => {
    if (mode === "image") {
      return "Animate an uploaded image or album cover into a video.";
    }

    if (mode === "music") {
      return "Combine a song and cover image into an AI music-video workflow.";
    }

    return "Create a video directly from a written visual description.";
  }, [mode]);

  function applyPreset(
    label: string,
    value: string
  ) {
    setSelectedPreset(label);
    setPrompt(value);
  }

  function handleImage(
    event: ChangeEvent<HTMLInputElement>
  ) {
    setImageFile(
      event.target.files?.[0] || null
    );
  }

  function handleAudio(
    event: ChangeEvent<HTMLInputElement>
  ) {
    setAudioFile(
      event.target.files?.[0] || null
    );
  }

  async function handleGenerate() {
    if (!user || creatingJob) {
      return;
    }

    setCreatingJob(true);
    setJobError(null);
    setOutputUrl(null);
    setStatusMessage(
      "Creating generation job..."
    );

    try {
      if (mode !== "text") {
        throw new Error(
          "Runway Step 3B-2 currently supports Text to Video only."
        );
      }

      if (
        aspectRatio !== "16:9" &&
        aspectRatio !== "9:16"
      ) {
        throw new Error(
          "Choose 16:9 or 9:16 for this Runway test."
        );
      }

      const selectedDuration =
        Number(duration);

      if (
        selectedDuration !== 5 &&
        selectedDuration !== 10
      ) {
        throw new Error(
          "Choose 5 or 10 seconds for this Runway test."
        );
      }

      const idToken =
        await user.getIdToken();

      const response =
        await fetch(
          "/api/owner/ai-video/jobs",
          {
            method: "POST",
            headers: {
              Authorization:
                `Bearer ${idToken}`,
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              mode,
              prompt,
              aspectRatio,
              duration:
                selectedDuration,
              imageName:
                imageFile?.name ||
                null,
              audioName:
                audioFile?.name ||
                null,
            }),
          }
        );

      const data =
        (await response.json()) as {
          success?: boolean;
          job?: {
            id?: string;
            status?: string;
          };
          message?: string;
          error?: string;
        };

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.error ||
            "AI video job could not be created."
        );
      }

      const jobId =
        data.job?.id;

      if (!jobId) {
        throw new Error(
          "AI video job ID was not returned."
        );
      }

      setCurrentJobId(jobId);

      setStatusMessage(
        "Sending job to Runway..."
      );

      const runwayResponse =
        await fetch(
          "/api/owner/ai-video/runway",
          {
            method: "POST",
            headers: {
              Authorization:
                `Bearer ${idToken}`,
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              jobId,
            }),
          }
        );

      const runwayData =
        (await runwayResponse.json()) as {
          success?: boolean;
          providerJobId?: string;
          status?: string;
          message?: string;
          error?: string;
        };

      if (
        !runwayResponse.ok ||
        !runwayData.success
      ) {
        throw new Error(
          runwayData.error ||
            "Runway generation could not be started."
        );
      }

      setStatusMessage(
        "Runway generation started. Waiting for video..."
      );

      let completed = false;
      let attempts = 0;

      while (
        !completed &&
        attempts < 120
      ) {
        await new Promise(
          (resolve) =>
            window.setTimeout(
              resolve,
              5000
            )
        );

        attempts += 1;

        const statusResponse =
          await fetch(
            `/api/owner/ai-video/runway?jobId=${encodeURIComponent(
              jobId
            )}`,
            {
              headers: {
                Authorization:
                  `Bearer ${idToken}`,
              },
              cache: "no-store",
            }
          );

        const statusData =
          (await statusResponse.json()) as {
            success?: boolean;
            status?: string;
            providerStatus?: string;
            progress?: number;
            outputUrl?: string | null;
            message?: string;
            error?: string;
          };

        if (
          !statusResponse.ok ||
          !statusData.success
        ) {
          throw new Error(
            statusData.error ||
              "Runway status check failed."
          );
        }

        if (
          statusData.status ===
          "completed"
        ) {
          completed = true;

          if (statusData.outputUrl) {
            setOutputUrl(statusData.outputUrl);
          }

          setStatusMessage(
            statusData.outputUrl
              ? "Runway video generation completed."
              : "Runway video generation completed."
          );

          break;
        }

        setStatusMessage(
          statusData.message ||
            `Runway is generating: ${
              statusData.providerStatus ||
              "processing"
            }`
        );
      }

      if (!completed) {
        throw new Error(
          "Runway generation is still processing. Status polling timed out."
        );
      }
    } catch (createError) {
      const message =
        createError instanceof Error
          ? createError.message
          : "AI video generation failed.";

      setJobError(message);

      setStatusMessage(
        "AI video generation failed."
      );
    } finally {
      setCreatingJob(false);
    }
  }

  function handleDesktopMusicFile(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target.files?.[0] || null;

    setDesktopMusicFile(file);
    setDesktopMusicMessage(null);
    setDesktopMusicProgress(0);
  }

  async function handleUploadDesktopMusic() {
    if (
      !user ||
      !desktopMusicFile ||
      uploadingDesktopMusic
    ) {
      return;
    }

    const lowerName =
      desktopMusicFile.name.toLowerCase();

    const validAudio =
      desktopMusicFile.type === "audio/mpeg" ||
      desktopMusicFile.type === "audio/mp3" ||
      desktopMusicFile.type === "audio/wav" ||
      desktopMusicFile.type === "audio/x-wav" ||
      desktopMusicFile.type === "audio/wave" ||
      lowerName.endsWith(".mp3") ||
      lowerName.endsWith(".wav");

    if (!validAudio) {
      setDesktopMusicMessage(
        "Choose an MP3 or WAV audio file."
      );
      return;
    }

    setUploadingDesktopMusic(true);
    setDesktopMusicMessage(
      "Preparing desktop music upload..."
    );
    setDesktopMusicProgress(5);

    try {
      const idToken =
        await user.getIdToken();

      const prepareResponse =
        await fetch(
          "/api/owner/media",
          {
            method: "POST",
            headers: {
              Authorization:
                `Bearer ${idToken}`,
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              action: "prepare",
              file: {
                name:
                  desktopMusicFile.name,
                type:
                  desktopMusicFile.type ||
                  (
                    lowerName.endsWith(".wav")
                      ? "audio/wav"
                      : "audio/mpeg"
                  ),
                size:
                  desktopMusicFile.size,
              },
            }),
          }
        );

      const prepareData =
        (await prepareResponse.json()) as {
          success?: boolean;
          mediaId?: string;
          kind?: string;
          storagePath?: string;
          uploadUrl?: string;
          error?: string;
        };

      if (
        !prepareResponse.ok ||
        !prepareData.success ||
        !prepareData.mediaId ||
        !prepareData.storagePath ||
        !prepareData.uploadUrl
      ) {
        throw new Error(
          prepareData.error ||
            "Desktop music upload could not be prepared."
        );
      }

      setDesktopMusicMessage(
        "Uploading MP3/WAV from desktop..."
      );
      setDesktopMusicProgress(25);

      await new Promise<void>(
        (resolve, reject) => {
          const xhr =
            new XMLHttpRequest();

          xhr.open(
            "PUT",
            prepareData.uploadUrl!,
            true
          );

          xhr.setRequestHeader(
            "Content-Type",
            desktopMusicFile.type ||
              (
                lowerName.endsWith(".wav")
                  ? "audio/wav"
                  : "audio/mpeg"
              )
          );

          xhr.upload.onprogress =
            (event) => {
              if (
                event.lengthComputable
              ) {
                const percent =
                  Math.round(
                    (
                      event.loaded /
                      event.total
                    ) *
                      65
                  ) + 25;

                setDesktopMusicProgress(
                  Math.min(
                    90,
                    percent
                  )
                );
              }
            };

          xhr.onerror = () => {
            reject(
              new Error(
                "Desktop music upload failed."
              )
            );
          };

          xhr.onload = () => {
            if (
              xhr.status >= 200 &&
              xhr.status < 300
            ) {
              resolve();
              return;
            }

            reject(
              new Error(
                `Desktop music upload failed with status ${xhr.status}.`
              )
            );
          };

          xhr.send(
            desktopMusicFile
          );
        }
      );

      setDesktopMusicMessage(
        "Finalizing music in Central Media Library..."
      );
      setDesktopMusicProgress(92);

      const finalizeResponse =
        await fetch(
          "/api/owner/media",
          {
            method: "POST",
            headers: {
              Authorization:
                `Bearer ${idToken}`,
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              action: "finalize",
              mediaId:
                prepareData.mediaId,
              storagePath:
                prepareData.storagePath,
              title:
                desktopMusicFile.name.replace(
                  /\.[^.]+$/,
                  ""
                ),
              file: {
                name:
                  desktopMusicFile.name,
                type:
                  desktopMusicFile.type ||
                  (
                    lowerName.endsWith(".wav")
                      ? "audio/wav"
                      : "audio/mpeg"
                  ),
                size:
                  desktopMusicFile.size,
              },
            }),
          }
        );

      const finalizeData =
        (await finalizeResponse.json()) as {
          success?: boolean;
          mediaId?: string;
          kind?: string;
          error?: string;
          message?: string;
        };

      if (
        !finalizeResponse.ok ||
        !finalizeData.success ||
        !finalizeData.mediaId
      ) {
        throw new Error(
          finalizeData.error ||
            "Desktop music upload could not be finalized."
        );
      }

      const libraryResponse =
        await fetch(
          "/api/owner/media",
          {
            headers: {
              Authorization:
                `Bearer ${idToken}`,
            },
            cache: "no-store",
          }
        );

      const libraryData =
        (await libraryResponse.json()) as {
          success?: boolean;
          media?: AudioLibraryItem[];
        };

      if (
        libraryResponse.ok &&
        libraryData.success &&
        Array.isArray(
          libraryData.media
        )
      ) {
        const audioItems =
          libraryData.media.filter(
            (item) =>
              item.kind === "audio" &&
              Boolean(
                item.storagePath
              )
          );

        setAudioLibraryItems(
          audioItems
        );
      }

      setSelectedAudioMediaId(
        finalizeData.mediaId
      );

      setDesktopMusicProgress(100);

      setDesktopMusicMessage(
        "Desktop music uploaded and selected successfully."
      );
    } catch (error) {
      setDesktopMusicProgress(0);

      setDesktopMusicMessage(
        error instanceof Error
          ? error.message
          : "Desktop music upload failed."
      );
    } finally {
      setUploadingDesktopMusic(false);
    }
  }
  useEffect(() => {
    try {
      const storedSavedVideoMediaId =
        window.localStorage.getItem(
          "soloBeatsAiVideoSavedMediaId"
        );

      const storedMusicVideoMediaId =
        window.localStorage.getItem(
          "soloBeatsAiMusicVideoMediaId"
        );

      if (storedSavedVideoMediaId) {
        setSavedVideoMediaId(
          storedSavedVideoMediaId
        );
      }

      if (storedMusicVideoMediaId) {
        setMusicVideoMediaId(
          storedMusicVideoMediaId
        );
      }
    } catch {
      // Storage restore is optional.
    }
  }, []);

  async function handleAddMusicToVideo() {
    if (
      !user ||
      !currentJobId ||
      !outputUrl ||
      !selectedAudioMediaId ||
      addingMusic
    ) {
      return;
    }

    setAddingMusic(true);
    setMusicMessage(null);
    setMusicVideoUrl(null);
    setMusicVideoMediaId(null);

    try {
      window.localStorage.removeItem(
        "soloBeatsAiMusicVideoMediaId"
      );
    } catch {
      // Storage cleanup is optional.
    }

    try {
      const idToken =
        await user.getIdToken();

      const response =
        await fetch(
          "/api/owner/ai-video/add-music",
          {
            method: "POST",
            headers: {
              Authorization:
                `Bearer ${idToken}`,
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              jobId: currentJobId,
              audioMediaId:
                selectedAudioMediaId,
              volume:
                musicVolume,
              musicStart,
              loopMusic,
            }),
          }
        );

      const data =
        (await response.json()) as {
          success?: boolean;
          mediaId?: string;
          previewUrl?: string;
          audioTitle?: string;
          message?: string;
          error?: string;
        };

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.error ||
            "Music could not be added to this video."
        );
      }

      if (data.previewUrl) {
        setMusicVideoUrl(
          data.previewUrl
        );
      }

      if (data.mediaId) {
        setMusicVideoMediaId(
          data.mediaId
        );

        try {
          window.localStorage.setItem(
            "soloBeatsAiMusicVideoMediaId",
            data.mediaId
          );
        } catch {
          // Storage persistence is optional.
        }

        setMusicVideoPublished(false);
        setMusicVideoHomepage(false);
        setMusicVideoPremiumTv(false);
        setMusicVideoDistributionMessage(null);
      }

      setMusicMessage(
        data.audioTitle
          ? `Music added successfully: ${data.audioTitle}`
          : "Music added to the AI video successfully."
      );
    } catch (error) {
      setMusicMessage(
        error instanceof Error
          ? error.message
          : "Music could not be added to this video."
      );
    } finally {
      setAddingMusic(false);
    }
  }
  async function handleMusicVideoDistribution(
    action:
      | "publish"
      | "homepage"
      | "premium-tv"
  ) {
    if (
      !user ||
      !musicVideoMediaId ||
      updatingMusicVideoDistribution
    ) {
      return;
    }

    setUpdatingMusicVideoDistribution(
      action
    );

    setMusicVideoDistributionMessage(
      null
    );

    try {
      const idToken =
        await user.getIdToken();

      const payload:
        Record<string, unknown> = {
          mediaId:
            musicVideoMediaId,
        };

      if (
        action === "publish"
      ) {
        payload.published =
          true;
      }

      if (
        action === "homepage"
      ) {
        payload.published =
          true;

        payload.homepageEnabled =
          true;
      }

      if (
        action === "premium-tv"
      ) {
        payload.published =
          true;

        payload.premiumTvEnabled =
          true;
      }

      const response =
        await fetch(
          "/api/owner/videos",
          {
            method: "PATCH",
            headers: {
              Authorization:
                `Bearer ${idToken}`,
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify(
                payload
              ),
          }
        );

      const data =
        (await response.json()) as {
          success?: boolean;
          mediaId?: string;
          message?: string;
          error?: string;
        };

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.error ||
            "Music video distribution could not be updated."
        );
      }

      if (
        action === "publish"
      ) {
        setMusicVideoPublished(
          true
        );

        setMusicVideoDistributionMessage(
          "Music video published successfully."
        );
      }

      if (
        action === "homepage"
      ) {
        setMusicVideoPublished(
          true
        );

        setMusicVideoHomepage(
          true
        );

        setMusicVideoDistributionMessage(
          "Music video published and sent to Homepage Channel."
        );
      }

      if (
        action === "premium-tv"
      ) {
        setMusicVideoPublished(
          true
        );

        setMusicVideoPremiumTv(
          true
        );

        setMusicVideoDistributionMessage(
          "Music video published and sent to Premium TV."
        );
      }
    } catch (error) {
      setMusicVideoDistributionMessage(
        error instanceof Error
          ? error.message
          : "Music video distribution failed."
      );
    } finally {
      setUpdatingMusicVideoDistribution(
        null
      );
    }
  }
  // AI_VIDEO_ONE_CLICK_DISTRIBUTION
  async function handleGeneratedVideoDistribution(
    action:
      | "publish"
      | "homepage"
      | "premium-tv"
  ) {
    if (
      !user ||
      updatingMusicVideoDistribution
    ) {
      return;
    }

    let mediaId =
      musicVideoMediaId ||
      savedVideoMediaId;

    if (
      !mediaId &&
      (!currentJobId || !outputUrl)
    ) {
      setMusicVideoDistributionMessage(
        "Generate a video before distributing it."
      );
      return;
    }

    setUpdatingMusicVideoDistribution(
      action
    );

    setMusicVideoDistributionMessage(
      null
    );

    try {
      const idToken =
        await user.getIdToken();

      /*
       * If the finished video is not already registered
       * in Video Manager, save it automatically first.
       */
      if (!mediaId) {
        const saveResponse =
          await fetch(
            "/api/owner/ai-video/save-to-video-manager",
            {
              method: "POST",
              headers: {
                Authorization:
                  `Bearer ${idToken}`,
                "Content-Type":
                  "application/json",
              },
              body: JSON.stringify({
                jobId:
                  currentJobId,
              }),
            }
          );

        const saveData =
          (await saveResponse.json()) as {
            success?: boolean;
            alreadySaved?: boolean;
            mediaId?: string;
            error?: string;
            message?: string;
          };

        if (
          !saveResponse.ok ||
          !saveData.success ||
          !saveData.mediaId
        ) {
          throw new Error(
            saveData.error ||
              "Video could not be saved to Video Manager."
          );
        }

        mediaId =
          saveData.mediaId;

        setSavedVideoMediaId(
          saveData.mediaId
        );

        try {
          window.localStorage.setItem(
            "soloBeatsAiVideoSavedMediaId",
            saveData.mediaId
          );
        } catch {
          // Storage persistence is optional.
        }

        setSaveVideoMessage(
          saveData.alreadySaved
            ? "This AI video is already saved in Video Manager."
            : "AI video saved to Video Manager successfully."
        );
      }

      const payload:
        Record<string, unknown> = {
          mediaId,
        };

      if (
        action === "publish"
      ) {
        payload.published =
          true;
      }

      if (
        action === "homepage"
      ) {
        payload.published =
          true;

        payload.homepageEnabled =
          true;
      }

      if (
        action === "premium-tv"
      ) {
        payload.published =
          true;

        payload.premiumTvEnabled =
          true;
      }

      const response =
        await fetch(
          "/api/owner/videos",
          {
            method: "PATCH",
            headers: {
              Authorization:
                `Bearer ${idToken}`,
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify(
                payload
              ),
          }
        );

      const data =
        (await response.json()) as {
          success?: boolean;
          mediaId?: string;
          message?: string;
          error?: string;
        };

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.error ||
            "Video distribution could not be updated."
        );
      }

      if (
        action === "publish"
      ) {
        setMusicVideoPublished(
          true
        );

        setMusicVideoDistributionMessage(
          "Video published successfully."
        );
      }

      if (
        action === "homepage"
      ) {
        setMusicVideoPublished(
          true
        );

        setMusicVideoHomepage(
          true
        );

        setMusicVideoDistributionMessage(
          "Video published and sent to Homepage Channel."
        );
      }

      if (
        action === "premium-tv"
      ) {
        setMusicVideoPublished(
          true
        );

        setMusicVideoPremiumTv(
          true
        );

        setMusicVideoDistributionMessage(
          "Video published and sent to Premium TV."
        );
      }
    } catch (error) {
      setMusicVideoDistributionMessage(
        error instanceof Error
          ? error.message
          : "Video distribution failed."
      );
    } finally {
      setUpdatingMusicVideoDistribution(
        null
      );
    }
  }
  async function handleSaveToVideoManager() {
    if (
      !user ||
      !currentJobId ||
      !outputUrl ||
      savingToVideoManager
    ) {
      return;
    }

    setSavingToVideoManager(true);
    setSaveVideoMessage(null);

    try {
      const idToken =
        await user.getIdToken();

      const response =
        await fetch(
          "/api/owner/ai-video/save-to-video-manager",
          {
            method: "POST",
            headers: {
              Authorization:
                `Bearer ${idToken}`,
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              jobId: currentJobId,
            }),
          }
        );

      const data =
        (await response.json()) as {
          success?: boolean;
          alreadySaved?: boolean;
          mediaId?: string;
          error?: string;
          message?: string;
        };

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.error ||
            "Video could not be saved to Video Manager."
        );
      }

      if (data.mediaId) {
        setSavedVideoMediaId(
          data.mediaId
        );

        try {
          window.localStorage.setItem(
            "soloBeatsAiVideoSavedMediaId",
            data.mediaId
          );
        } catch {
          // Storage persistence is optional.
        }
      }

      setSaveVideoMessage(
        data.alreadySaved
          ? "This AI video is already saved in Video Manager."
          : "AI video saved to Video Manager successfully."
      );
    } catch (saveError) {
      setSaveVideoMessage(
        saveError instanceof Error
          ? saveError.message
          : "Video could not be saved to Video Manager."
      );
    } finally {
      setSavingToVideoManager(false);
    }
  }
  if (loading) {
    return (
      <main className="min-h-screen bg-[#070710] px-6 py-16 text-white">
        <div className="mx-auto max-w-7xl">
          <p className="text-sm text-white/60">
            Loading AI Video Generator...
          </p>
        </div>
      </main>
    );
  }

  if (!user || !isOwner) {
    return (
      <main className="min-h-screen bg-[#070710] px-6 py-16 text-white">
        <div className="mx-auto max-w-3xl rounded-3xl border border-red-400/20 bg-red-500/5 p-8">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-red-300">
            Owner Access Only
          </p>
          <h1 className="mt-3 text-3xl font-black">
            AI Video Generator
          </h1>
          <p className="mt-4 text-white/60">
            This workspace is restricted to the SOLO BEATS ENGINE MUSIC owner account.
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex rounded-xl bg-white px-5 py-3 text-sm font-black text-black"
          >
            Return Home
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#070710] px-6 py-10 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-cyan-300">
              SOLO BEATS AI STUDIO
            </p>
            <h1 className="mt-3 text-4xl font-black sm:text-5xl">
              AI Video Generator
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-white/60 sm:text-base">
              Build music videos, visualizers, album trailers, and social promo clips from one owner-controlled workspace.
            </p>
          </div>

          <Link
            href="/developer"
            className="rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-black hover:bg-white/10"
          >
            Back to Control Center
          </Link>
        </div>

        <section className="mt-8 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-3xl border border-white/10 bg-[#10101b] p-6 sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-violet-300">
                  Generator Workspace
                </p>
                <h2 className="mt-2 text-2xl font-black">
                  Create New Video
                </h2>
              </div>

              <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-4 py-2 text-xs font-black uppercase tracking-wider text-amber-200">
                Provider not connected
              </span>
            </div>

            <div className="mt-7">
              <p className="text-sm font-black">
                Generation mode
              </p>

              <div className="mt-3 grid gap-3 md:grid-cols-3">
                {[
                  ["text", "Text to Video"],
                  ["image", "Image to Video"],
                  ["music", "Song + Cover"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() =>
                      setMode(value as GenerationMode)
                    }
                    className={`rounded-2xl border px-4 py-4 text-left transition ${
                      mode === value
                        ? "border-violet-400/60 bg-violet-500/15"
                        : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
                    }`}
                  >
                    <span className="text-sm font-black">
                      {label}
                    </span>
                  </button>
                ))}
              </div>

              <p className="mt-3 text-sm text-white/50">
                {modeHelp}
              </p>
            </div>

            <div className="mt-7">
              <div className="flex items-center justify-between gap-3">
                <label
                  htmlFor="ai-video-prompt"
                  className="text-sm font-black"
                >
                  Prompt
                </label>
                <span className="text-xs text-white/35">
                  {prompt.length} characters
                </span>
              </div>

              <textarea
                id="ai-video-prompt"
                value={prompt}
                onChange={(event) => {
                  setPrompt(event.target.value);
                  setSelectedPreset(null);
                }}
                placeholder="Describe the video you want to create..."
                rows={7}
                className="mt-3 w-full resize-y rounded-2xl border border-white/10 bg-[#080812] px-4 py-4 text-sm leading-7 text-white outline-none placeholder:text-white/25 focus:border-violet-400/50"
              />
            </div>

            <div className="mt-6">
              <p className="text-sm font-black">
                Prompt presets
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                {promptPresets.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() =>
                      applyPreset(
                        preset.label,
                        preset.prompt
                      )
                    }
                    className={`rounded-full border px-4 py-2 text-xs font-black transition ${
                      selectedPreset === preset.label
                        ? "border-cyan-300/60 bg-cyan-400/15 text-cyan-100"
                        : "border-white/10 bg-white/[0.03] text-white/70 hover:bg-white/[0.07]"
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {mode !== "text" ? (
              <div className="mt-7 rounded-2xl border border-white/10 bg-white/[0.025] p-5">
                <label
                  htmlFor="ai-video-image"
                  className="text-sm font-black"
                >
                  Cover / source image
                </label>

                <input
                  id="ai-video-image"
                  type="file"
                  accept="image/*"
                  onChange={handleImage}
                  className="mt-3 block w-full text-sm text-white/60 file:mr-4 file:rounded-xl file:border-0 file:bg-white file:px-4 file:py-2 file:text-sm file:font-black file:text-black"
                />

                <p className="mt-2 text-xs text-white/40">
                  {fileLabel(imageFile)}
                </p>
              </div>
            ) : null}

            {mode === "music" ? (
              <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.025] p-5">
                <label
                  htmlFor="ai-video-audio"
                  className="text-sm font-black"
                >
                  Song / audio
                </label>

                <input
                  id="ai-video-audio"
                  type="file"
                  accept="audio/mpeg,audio/wav,audio/x-wav,audio/*"
                  onChange={handleAudio}
                  className="mt-3 block w-full text-sm text-white/60 file:mr-4 file:rounded-xl file:border-0 file:bg-white file:px-4 file:py-2 file:text-sm file:font-black file:text-black"
                />

                <p className="mt-2 text-xs text-white/40">
                  {fileLabel(audioFile)}
                </p>
              </div>
            ) : null}

            <div className="mt-7 grid gap-5 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="ai-video-ratio"
                  className="text-sm font-black"
                >
                  Aspect ratio
                </label>

                <select
                  id="ai-video-ratio"
                  value={aspectRatio}
                  onChange={(event) =>
                    setAspectRatio(
                      event.target.value as AspectRatio
                    )
                  }
                  className="mt-3 w-full rounded-xl border border-white/10 bg-[#080812] px-4 py-3 text-sm text-white outline-none"
                >
                  <option value="16:9">
                16:9 - YouTube / TV
              </option>
                  <option value="9:16">
                9:16 - Shorts / Reels
              </option>
                  <option value="1:1">
                1:1 - Square Social
              </option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="ai-video-duration"
                  className="text-sm font-black"
                >
                  Duration
                </label>

                <select
                  id="ai-video-duration"
                  value={duration}
                  onChange={(event) =>
                    setDuration(
                      event.target.value as Duration
                    )
                  }
                  className="mt-3 w-full rounded-xl border border-white/10 bg-[#080812] px-4 py-3 text-sm text-white outline-none"
                >
                  <option value="5">5 seconds</option>
                  <option value="10">10 seconds</option>
                  <option value="15">15 seconds</option>
                  <option value="30">30 seconds</option>
                  <option value="60">60 seconds</option>
                </select>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGenerate}
              disabled={creatingJob}
              className="mt-7 w-full rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-5 py-4 text-sm font-black text-white shadow-lg shadow-violet-950/30 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {creatingJob
                ? "Creating Job..."
                : "Create Generation Job"}
            </button>

            <p className="mt-3 text-center text-xs text-white/40">
              Text to Video is connected to Runway. A live generation may consume Runway credits.
            </p>

            {jobError ? (
              <p className="mt-3 text-center text-sm font-bold text-red-300">
                {jobError}
              </p>
            ) : null}
          </div>

          <div className="space-y-6">
            <section className="rounded-3xl border border-cyan-400/20 bg-cyan-500/5 p-6">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">
                Current Job
              </p>

              <h2 className="mt-2 text-xl font-black">
                Generation Status
              </h2>

              <div className="mt-5 rounded-2xl border border-white/10 bg-[#080812] p-5">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-bold text-white/75">
                    Status
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-black text-white/60">
                    READY
                  </span>
                </div>

                <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full w-0 rounded-full bg-white/60" />
                </div>

                <p className="mt-4 text-sm leading-6 text-white/50">
                  {statusMessage}
                </p>

                {currentJobId ? (
                  <div className="mt-4 rounded-xl border border-violet-400/20 bg-violet-500/10 px-4 py-3">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-300">
                      Job ID
                    </p>
                    <p className="mt-1 break-all text-sm font-bold text-white/75">
                      {currentJobId}
                    </p>
                  </div>
                ) : null}
              </div>
            </section>

        {/* AI_MUSIC_VIDEO_DISTRIBUTION */}
        <section className="rounded-3xl border border-violet-400/20 bg-[#10101b] p-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-violet-300">
                Music Video Distribution
              </p>

              <h2 className="mt-2 text-xl font-black text-white">
                Send your finished AI video across SOLO BEATS
              </h2>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/50">
                Publish directly to Video Manager, Homepage Channel,
                or Premium TV without leaving AI Studio.
              </p>
            </div>

            <span className="w-fit rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-black text-white/50">
              {musicVideoUrl || outputUrl
                ? "VIDEO READY"
                : "WAITING FOR VIDEO"}
            </span>
          </div>

          {musicVideoUrl || outputUrl ? (
            <div className="mt-5 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">
                Generated Video Ready
              </p>

              <p className="mt-1 break-all text-sm text-white/65">
                {musicVideoUrl || outputUrl}
              </p>
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
              <p className="text-sm text-white/45">
                Generate a video first to unlock distribution.
              </p>
            </div>
          )}

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              disabled={
                (!musicVideoUrl && !outputUrl) ||
                Boolean(
                  updatingMusicVideoDistribution
                )
              }
              onClick={() =>
                handleGeneratedVideoDistribution(
                  "publish"
                )
              }
              className="rounded-2xl border border-violet-400/30 bg-violet-500/15 px-4 py-4 text-left transition hover:bg-violet-500/25 disabled:cursor-not-allowed disabled:opacity-35"
            >
              <span className="block text-sm font-black text-white">
                {updatingMusicVideoDistribution ===
                "publish"
                  ? "Publishing..."
                  : musicVideoPublished
                    ? "Published ✓"
                    : "Publish Video"}
              </span>

              <span className="mt-1 block text-xs leading-5 text-white/45">
                Save automatically to Video Manager and publish it.
              </span>
            </button>

            <button
              type="button"
              disabled={
                (!musicVideoUrl && !outputUrl) ||
                Boolean(
                  updatingMusicVideoDistribution
                )
              }
              onClick={() =>
                handleGeneratedVideoDistribution(
                  "homepage"
                )
              }
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-left transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-35"
            >
              <span className="block text-sm font-black text-white">
                {updatingMusicVideoDistribution ===
                "homepage"
                  ? "Sending to Homepage..."
                  : musicVideoHomepage
                    ? "Sent to Homepage ✓"
                    : "Send to Homepage"}
              </span>

              <span className="mt-1 block text-xs leading-5 text-white/45">
                Publish and place this video on the Homepage Channel.
              </span>
            </button>

            <button
              type="button"
              disabled={
                (!musicVideoUrl && !outputUrl) ||
                Boolean(
                  updatingMusicVideoDistribution
                )
              }
              onClick={() =>
                handleGeneratedVideoDistribution(
                  "premium-tv"
                )
              }
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-left transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-35"
            >
              <span className="block text-sm font-black text-white">
                {updatingMusicVideoDistribution ===
                "premium-tv"
                  ? "Sending to Premium TV..."
                  : musicVideoPremiumTv
                    ? "Sent to Premium TV ✓"
                    : "Send to Premium TV"}
              </span>

              <span className="mt-1 block text-xs leading-5 text-white/45">
                Publish and place this video into Premium TV programming.
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                const advertisingMediaId =
                  musicVideoMediaId ||
                  savedVideoMediaId;

                const advertisingUrl =
                  advertisingMediaId
                    ? `/developer/business-advertising?videoMediaId=${encodeURIComponent(
                        advertisingMediaId
                      )}`
                    : "/developer/business-advertising";

                window.location.href =
                  advertisingUrl;
              }}
              className="rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-4 text-left transition hover:bg-amber-500/15"
            >
              <span className="block text-sm font-black text-white">
                Open Advertising Manager
              </span>

              <span className="mt-1 block text-xs leading-5 text-white/45">
                Use the generated video for SOLO BEATS promotional campaigns.
              </span>
            </button>
          </div>

          {musicVideoDistributionMessage ? (
            <div className="mt-4 rounded-xl border border-white/10 bg-black/20 px-4 py-3">
              <p className="text-sm font-bold text-white/70">
                {musicVideoDistributionMessage}
              </p>
            </div>
          ) : null}

          {savedVideoMediaId ||
          musicVideoMediaId ? (
            <div className="mt-3 rounded-xl border border-cyan-400/15 bg-cyan-500/5 px-4 py-3">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">
                Video Manager Media ID
              </p>

              <p className="mt-1 break-all text-xs text-white/50">
                {musicVideoMediaId ||
                  savedVideoMediaId}
              </p>
            </div>
          ) : null}
        </section>
            <section className="rounded-3xl border border-white/10 bg-[#10101b] p-6">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-violet-300">
                Preview
              </p>

              <div
                className="mt-4 grid min-h-[280px] place-items-center rounded-2xl border border-dashed border-white/15 bg-[#080812] p-6 text-center"
                style={{
                  aspectRatio:
                    aspectRatio === "9:16"
                      ? "9 / 16"
                      : aspectRatio === "1:1"
                        ? "1 / 1"
                        : "16 / 9",
                  maxHeight: 430,
                }}
              >
                <div>
                  <p className="text-lg font-black text-white/70">
                    Video Preview
                  </p>
                  <p className="mt-2 text-sm text-white/35">
                    {outputUrl ? (
                      <video
                        src={outputUrl}
                        controls
                        playsInline
                        preload="metadata"
                        className="mt-4 max-h-[520px] w-full rounded-2xl bg-black object-contain"
                      >
                        Your browser does not support HTML video.
                      </video>
                    ) : (
                      "Generated video will appear here."
                    )}
                  </p>
                </div>
              </div>
            </section>

        {/* AI_VIDEO_MUSIC_EDITOR */}
        <section className="rounded-3xl border border-cyan-400/20 bg-cyan-500/5 p-6">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">
            Music Editor
          </p>

          <h2 className="mt-2 text-xl font-black">
            Add Music to Video
          </h2>

          <p className="mt-3 text-sm leading-6 text-white/50">
            Choose an MP3 or WAV from the Central Media Library and merge it
            with the completed AI video.
          </p>

          {/* AI_VIDEO_DESKTOP_MUSIC_UPLOAD */}
          <div className="mt-5 rounded-2xl border border-white/10 bg-[#080812] p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-black">
                  Upload from Desktop
                </p>

                <p className="mt-1 text-xs text-white/40">
                  Upload an MP3 or WAV. It will also be saved to your Central Media Library.
                </p>
              </div>

              <span className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-xs font-black text-cyan-200">
                MP3 / WAV
              </span>
            </div>

            <input
              id="ai-video-desktop-music"
              type="file"
              accept=".mp3,.wav,audio/mpeg,audio/wav,audio/x-wav"
              onChange={handleDesktopMusicFile}
              disabled={uploadingDesktopMusic}
              className="mt-4 block w-full text-sm text-white/60 file:mr-4 file:rounded-xl file:border-0 file:bg-white file:px-4 file:py-2 file:text-sm file:font-black file:text-black disabled:opacity-50"
            />

            {desktopMusicFile ? (
              <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <p className="text-xs font-black uppercase tracking-[0.15em] text-white/40">
                  Selected Desktop File
                </p>

                <p className="mt-1 break-all text-sm font-bold text-white/75">
                  {desktopMusicFile.name}
                </p>

                <p className="mt-1 text-xs text-white/35">
                  {(desktopMusicFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            ) : null}

            <button
              type="button"
              onClick={handleUploadDesktopMusic}
              disabled={
                !desktopMusicFile ||
                uploadingDesktopMusic
              }
              className="mt-4 w-full rounded-2xl border border-cyan-400/30 bg-cyan-500/10 px-5 py-3 text-sm font-black text-cyan-100 transition hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {uploadingDesktopMusic
                ? "Uploading Music..."
                : "Upload Music from Desktop"}
            </button>

            {uploadingDesktopMusic ||
            desktopMusicProgress > 0 ? (
              <div className="mt-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-bold text-white/50">
                    Upload progress
                  </span>

                  <span className="text-xs font-black text-cyan-200">
                    {desktopMusicProgress}%
                  </span>
                </div>

                <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-cyan-400 transition-all"
                    style={{
                      width:
                        `${desktopMusicProgress}%`,
                    }}
                  />
                </div>
              </div>
            ) : null}

            {desktopMusicMessage ? (
              <p className="mt-4 text-sm font-bold text-white/70">
                {desktopMusicMessage}
              </p>
            ) : null}
          </div>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-xs font-black uppercase tracking-[0.18em] text-white/35">
              OR
            </span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          <div className="mt-5">
            <label
              htmlFor="ai-video-library-track"
              className="text-sm font-black"
            >
              Music track
            </label>

            <select
              id="ai-video-library-track"
              value={selectedAudioMediaId}
              onChange={(event) =>
                setSelectedAudioMediaId(
                  event.target.value
                )
              }
              className="mt-3 w-full rounded-xl border border-white/10 bg-[#080812] px-4 py-3 text-sm text-white outline-none"
            >
              <option value="">
                Choose music from Central Media Library
              </option>

              {audioLibraryItems.map((item) => (
                <option
                  key={item.mediaId}
                  value={item.mediaId}
                >
                  {item.title}
                </option>
              ))}
            </select>

            <p className="mt-2 text-xs text-white/35">
              {audioLibraryItems.length} audio tracks available
            </p>
          </div>

          {selectedAudioMediaId ? (
            <div className="mt-5">
              {audioLibraryItems
                .filter(
                  (item) =>
                    item.mediaId ===
                    selectedAudioMediaId
                )
                .map((item) => (
                  <div key={item.mediaId}>
                    <p className="text-sm font-black text-white/75">
                      {item.title}
                    </p>

                    {item.previewUrl ? (
                      <audio
                        src={item.previewUrl}
                        controls
                        preload="metadata"
                        className="mt-3 w-full"
                      />
                    ) : null}
                  </div>
                ))}
            </div>
          ) : null}

          <div className="mt-6">
            <div className="flex items-center justify-between gap-4">
              <label
                htmlFor="ai-video-music-volume"
                className="text-sm font-black"
              >
                Music volume
              </label>

              <span className="text-xs font-black text-cyan-200">
                {Math.round(musicVolume * 100)}%
              </span>
            </div>

            <input
              id="ai-video-music-volume"
              type="range"
              min="0"
              max="2"
              step="0.05"
              value={musicVolume}
              onChange={(event) =>
                setMusicVolume(
                  Number(event.target.value)
                )
              }
              className="mt-3 w-full"
            />
          </div>

          <div className="mt-5">
            <label
              htmlFor="ai-video-music-start"
              className="text-sm font-black"
            >
              Start music at
            </label>

            <div className="mt-3 flex items-center gap-3">
              <input
                id="ai-video-music-start"
                type="number"
                min="0"
                step="0.1"
                value={musicStart}
                onChange={(event) =>
                  setMusicStart(
                    Math.max(
                      0,
                      Number(event.target.value) ||
                        0
                    )
                  )
                }
                className="w-32 rounded-xl border border-white/10 bg-[#080812] px-4 py-3 text-sm text-white outline-none"
              />

              <span className="text-sm text-white/40">
                seconds into the song
              </span>
            </div>
          </div>

          <label className="mt-5 flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={loopMusic}
              onChange={(event) =>
                setLoopMusic(
                  event.target.checked
                )
              }
              className="h-4 w-4"
            />

            <span className="text-sm font-bold text-white/70">
              Loop music if it is shorter than the video
            </span>
          </label>

          <button
            type="button"
            onClick={handleAddMusicToVideo}
            disabled={
              !outputUrl ||
              !currentJobId ||
              !selectedAudioMediaId ||
              addingMusic
            }
            className="mt-6 w-full rounded-2xl bg-gradient-to-r from-cyan-500 to-violet-500 px-5 py-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {addingMusic
              ? "Adding Music..."
              : "Add Music to Video"}
          </button>

          {musicMessage ? (
            <p className="mt-4 text-sm font-bold text-white/70">
              {musicMessage}
            </p>
          ) : null}

          {musicVideoUrl ? (
            <div className="mt-6">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">
                Finished Music Video
              </p>

              <video
                src={musicVideoUrl}
                controls
                playsInline
                preload="metadata"
                className="mt-3 max-h-[520px] w-full rounded-2xl bg-black object-contain"
              >
                Your browser does not support HTML video.
              </video>

              {musicVideoMediaId ? (
                <div className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">
                    Music Video Media ID
                  </p>

                  <p className="mt-1 break-all text-sm font-bold text-white/75">
                    {musicVideoMediaId}
                  </p>

                  <Link
                    href="/developer/videos"
                    className="mt-3 inline-flex rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-xs font-black text-white hover:bg-white/10"
                  >
                    Open Music Video in Video Manager
                  </Link>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
        {/* SAVE_TO_VIDEO_MANAGER_BUTTON */}
        <section className="rounded-3xl border border-violet-400/20 bg-violet-500/5 p-6">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-violet-300">
            AI Video Storage
          </p>

          <h2 className="mt-2 text-xl font-black">
            Save Generated Video
          </h2>

          <p className="mt-3 text-sm leading-6 text-white/50">
            Copy this completed Runway video into SOLO BEATS Firebase Storage
            and register it in the central Video Manager.
          </p>

          <button
            type="button"
            onClick={handleSaveToVideoManager}
            disabled={
              !outputUrl ||
              !currentJobId ||
              savingToVideoManager ||
              Boolean(savedVideoMediaId)
            }
            className="mt-5 w-full rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-5 py-4 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {savingToVideoManager
              ? "Saving to Video Manager..."
              : savedVideoMediaId
                ? "Saved to Video Manager"
                : "Save to Video Manager"}
          </button>

          {saveVideoMessage ? (
            <p className="mt-4 text-sm font-bold text-white/70">
              {saveVideoMessage}
            </p>
          ) : null}

          {savedVideoMediaId ? (
            <div className="mt-4 rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">
                Video Manager Media ID
              </p>
              <p className="mt-1 break-all text-sm font-bold text-white/75">
                {savedVideoMediaId}
              </p>

              <Link
                href="/developer/videos"
                className="mt-3 inline-flex rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-xs font-black text-white hover:bg-white/10"
              >
                Open Video Manager
              </Link>
            </div>
          ) : null}
        </section>

        <section className="rounded-3xl border border-emerald-400/20 bg-emerald-500/5 p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-300">
                    Usage
                  </p>
                  <h2 className="mt-2 text-xl font-black">
                    Owner Credits
                  </h2>
                </div>

                <span className="text-2xl font-black">
                  ∞
                </span>
              </div>

              <p className="mt-3 text-sm leading-6 text-white/50">
                Owner generation is unrestricted in the UI. Subscriber credits and plan limits will be enforced when the backend is connected.
              </p>
            </section>
          </div>
        </section>

        <section className="mt-8 rounded-3xl border border-white/10 bg-[#10101b] p-6 sm:p-7">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-fuchsia-300">
            Distribution
          </p>

          <h2 className="mt-2 text-2xl font-black">
            Send Finished Video
          </h2>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <button
            type="button"
            onClick={handleSaveToVideoManager}
            disabled={
              !outputUrl ||
              !currentJobId ||
              savingToVideoManager ||
              Boolean(savedVideoMediaId)
            }
            className="rounded-2xl border border-violet-400/30 bg-violet-500/10 px-4 py-4 text-sm font-black text-violet-100 transition hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {savingToVideoManager
              ? "Saving..."
              : savedVideoMediaId
                ? "Saved to Video Manager"
                : "Video Manager"}
          </button>

          {[
            "Homepage Channel",
            "Premium TV",
            "Advertising",
          ].map((destination) => (
            <button
              key={destination}
              type="button"
              disabled
              className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 text-sm font-black text-white/35"
            >
              {destination}
            </button>
          ))}
        </div>

          <p className="mt-4 text-xs text-white/35">
            Save completed AI videos to Video Manager first. Homepage Channel, Premium TV, and Advertising controls will activate in the next integration step.
          </p>
        </section>
      </div>
    </main>
  );
}










