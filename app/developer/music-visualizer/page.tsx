"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

import "../../../lib/firebaseClient";

import { getAuth, onAuthStateChanged } from "firebase/auth";
import { getStorage, ref, uploadBytesResumable } from "firebase/storage";

type FormatType = "vertical" | "horizontal";
type VisualStyle = "cinematic" | "fire" | "neon";
type VisualMode = "auto" | "manual";
type SourceMode = "image" | "video";
type BounceDirection = "auto" | "zoom" | "x" | "y";

function safeFilePart(value: string) {
  return (
    value
      .replace(/[^a-zA-Z0-9-_ ]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 80) || "solo-beats"
  );
}

async function uploadFileSecure(
  file: File,
  kind: "audio" | "image",
  idToken: string,
  reservationId: string,
  onProgress?: (
    percent: number
  ) => void
): Promise<string> {
  const prepareResponse =
    await fetch(
      "/api/visualizer-credits/upload",
      {
        method:
          "POST",

        headers: {
          "Content-Type":
            "application/json",

          Authorization:
            `Bearer ${idToken}`,
        },

        body:
          JSON.stringify({
            name:
              file.name,

            contentType:
              file.type ||
              "application/octet-stream",

            size:
              file.size,

            kind,

            reservationId,
          }),
      }
    );

  const prepareData =
    await prepareResponse.json() as {
      success?: boolean;
      uploadUrl?: string;
      storagePath?: string;
      error?: string;
    };

  if (
    !prepareResponse.ok ||
    !prepareData.success ||
    !prepareData.uploadUrl ||
    !prepareData.storagePath
  ) {
    throw new Error(
      prepareData.error ||
      "Visualizer upload could not be prepared."
    );
  }

  await new Promise<void>(
    (
      resolve,
      reject
    ) => {
      const xhr =
        new XMLHttpRequest();

      xhr.open(
        "PUT",
        prepareData.uploadUrl!,
        true
      );

      xhr.setRequestHeader(
        "Content-Type",
        file.type ||
        "application/octet-stream"
      );

      xhr.upload.onprogress =
        event => {
          if (
            event.lengthComputable
          ) {
            onProgress?.(
              Math.round(
                (
                  event.loaded /
                  event.total
                ) *
                100
              )
            );
          }
        };

      xhr.onerror =
        () =>
          reject(
            new Error(
              "Visualizer file upload failed."
            )
          );

      xhr.onload =
        () => {
          if (
            xhr.status >=
              200 &&
            xhr.status <
              300
          ) {
            onProgress?.(
              100
            );

            resolve();

            return;
          }

          reject(
            new Error(
              `Visualizer upload failed with status ${xhr.status}.`
            )
          );
        };

      xhr.send(
        file
      );
    }
  );

  return prepareData.storagePath;
}

async function uploadVisualizerVideoSigned(
  file: File,
  idToken: string,
  onProgress?: (percent: number) => void
): Promise<string> {
  const mimeType =
    file.type || "video/mp4";

  const fileInfo = {
    name: file.name,
    type: mimeType,
    size: file.size,
  };

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
          file: fileInfo,
        }),
      }
    );

  const prepareData =
    await prepareResponse.json() as {
      success?: boolean;
      mediaId?: string;
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
        "Video upload could not be prepared."
    );
  }

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
        mimeType
      );

      xhr.upload.onprogress =
        event => {
          if (
            event.lengthComputable
          ) {
            const percent =
              Math.round(
                (
                  event.loaded /
                  event.total
                ) *
                  100
              );

            onProgress?.(
              Math.min(
                100,
                Math.max(
                  0,
                  percent
                )
              )
            );
          }
        };

      xhr.onerror = () => {
        reject(
          new Error(
            "Video upload failed."
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
            `Video upload failed with status ${xhr.status}.`
          )
        );
      };

      xhr.send(file);
    }
  );

  // Visualizer source video is temporary render input.
  // The signed PUT already stored the file successfully.
  // Do not finalize it into the Central Media Library.
  onProgress?.(100);
  return prepareData.storagePath;
}
async function createVisualizerTextOverlay(
  title: string,
  artist: string,
  format: "vertical" | "horizontal"
): Promise<string> {
  const width =
    format === "horizontal"
      ? 1920
      : 1080;

  const height =
    format === "horizontal"
      ? 1080
      : 1920;

  const canvas =
    document.createElement("canvas");

  canvas.width = width;
  canvas.height = height;

  const ctx =
    canvas.getContext("2d");

  if (!ctx) {
    throw new Error(
      "Could not create title overlay."
    );
  }

  ctx.clearRect(
    0,
    0,
    width,
    height
  );

  const panelWidth =
    format === "horizontal"
      ? 900
      : 880;

  const panelHeight =
    format === "horizontal"
      ? 150
      : 190;

  const panelX =
    Math.round(
      (width - panelWidth) / 2
    );

  const panelY =
    format === "horizontal"
      ? 735
      : 1430;

  const radius = 28;

  ctx.save();

  ctx.fillStyle =
    "rgba(0,0,0,0.62)";

  ctx.beginPath();

  ctx.roundRect(
    panelX,
    panelY,
    panelWidth,
    panelHeight,
    radius
  );

  ctx.fill();

  ctx.strokeStyle =
    "rgba(255,255,255,0.15)";

  ctx.lineWidth = 2;

  ctx.stroke();

  const safeTitle =
    (
      title.trim() ||
      "UNTITLED"
    ).toUpperCase();

  const safeArtist =
    (
      artist.trim() ||
      "SOLO BEATS"
    ).toUpperCase();

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.shadowColor =
    "rgba(0,0,0,0.95)";

  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 3;

  ctx.fillStyle = "#ffffff";

  ctx.font =
    format === "horizontal"
      ? "700 60px Arial, Helvetica, sans-serif"
      : "700 72px Arial, Helvetica, sans-serif";

  ctx.fillText(
    safeTitle,
    width / 2,
    panelY +
      (
        format === "horizontal"
          ? 54
          : 68
      ),
    panelWidth - 80
  );

  ctx.shadowBlur = 8;

  ctx.fillStyle = "#ff3355";

  ctx.font =
    format === "horizontal"
      ? "700 34px Arial, Helvetica, sans-serif"
      : "700 42px Arial, Helvetica, sans-serif";

  ctx.fillText(
    safeArtist,
    width / 2,
    panelY +
      (
        format === "horizontal"
          ? 112
          : 140
      ),
    panelWidth - 80
  );

  ctx.restore();

  return canvas.toDataURL(
    "image/png"
  );
}
export default function MusicVisualizerPage() {
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");

  const [format, setFormat] = useState<FormatType>("vertical");
  const [visualStyle, setVisualStyle] = useState<VisualStyle>("cinematic");
  const [visualMode, setVisualMode] = useState<VisualMode>("auto");
  const [manualEnergy, setManualEnergy] = useState(100);

  const [sourceMode, setSourceMode] = useState<SourceMode>("image");
  const [bounceStrength, setBounceStrength] = useState(100);
  const [beatSensitivity, setBeatSensitivity] = useState(65);
  const [bounceDirection, setBounceDirection] =
    useState<BounceDirection>("auto");

  const [clipStart, setClipStart] = useState("0");
  const [
    clipDuration,
    setClipDuration,
  ] =
    useState("120");

  const [audio, setAudio] = useState<File | null>(null);
  const [image, setImage] = useState<File | null>(null);
  const [sourceVideo, setSourceVideo] = useState<File | null>(null);

  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [videoUrl, setVideoUrl] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const [
    visualizerBalance,
    setVisualizerBalance,
  ] = useState<number | null>(null);

  async function refreshVisualizerBalance() {
    try {
      const auth =
        getAuth();

      const currentUser =
        auth.currentUser;

      if (!currentUser) {
        setVisualizerBalance(
          null
        );

        return;
      }

      const token =
        await currentUser.getIdToken();

      const response =
        await fetch(
          "/api/visualizer-credits/status",
          {
            headers: {
              Authorization:
                `Bearer ${token}`,
            },

            cache:
              "no-store",
          }
        );

      const data =
        await response.json();

      if (
        response.ok &&
        data.success
      ) {
        setVisualizerBalance(
          Number(
            data.balance ||
            0
          )
        );
      }
    }
    catch {
      // Keep the visualizer usable if balance refresh fails.
    }
  }

  useEffect(() => {
    const auth =
      getAuth();

    return onAuthStateChanged(
      auth,
      currentUser => {
        if (!currentUser) {
          setVisualizerBalance(
            null
          );

          return;
        }

        void refreshVisualizerBalance();
      }
    );
  }, []);

  const formatLabel = useMemo(() => {
    return format === "horizontal"
      ? "Horizontal 1920x1080"
      : "Vertical 1080x1920";
  }, [format]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    setError("");
    setStatus("");
    setVideoUrl("");
    setUploadProgress(0);

    if (sourceMode === "image" && !audio) {
      setError("Please upload an audio file.");
      return;
    }

    if (sourceMode === "image" && !image) {
      setError("Please upload cover art / visual image.");
      return;
    }

    if (sourceMode === "video" && !sourceVideo) {
      setError("Please upload a source video.");
      return;
    }

    const auth = getAuth();
    const user = auth.currentUser;

    if (!user) {
      setError("You must be signed in before generating a visualizer.");
      return;
    }

    setIsGenerating(true);

    let reservationId = "";
    let idToken = "";

    try {
      idToken =
        await user.getIdToken();

      setStatus(
        "Checking Visualizer Credits..."
      );

      const reservationResponse =
        await fetch(
          "/api/visualizer-credits/render-session",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${idToken}`,
            },

            body:
              JSON.stringify({
                action:
                  "reserve",
              }),
          }
        );

      const reservationData =
        await reservationResponse.json() as {
          success?: boolean;
          reservationId?: string | null;
          ownerBypass?: boolean;
          balance?: number;
          error?: string;
        };

      if (
        !reservationResponse.ok ||
        !reservationData.success
      ) {
        if (
          reservationData.error ===
          "NO_VISUALIZER_CREDITS"
        ) {
          window.location.href =
            "/music-visualizer/credits";
          return;
        }

        throw new Error(
          reservationData.error ||
          "Visualizer Credit reservation failed."
        );
      }

      reservationId =
        reservationData.reservationId ||
        "";

      setStatus(
        reservationData.ownerBypass
          ? "Owner access confirmed..."
          : "1 Visualizer Credit reserved..."
      );

      const stamp = Date.now();
      const basePath = `owner/music-visualizer/${user.uid}/${stamp}`;

      let audioStoragePath = "";
      let imageStoragePath = "";
      let videoStoragePath = "";

      if (
        sourceMode === "image" &&
        audio
      ) {
        setStatus(
          "Uploading audio securely..."
        );

        audioStoragePath =
          await uploadFileSecure(
            audio,
            "audio",
            idToken,
            reservationId,
            percent => {
              setUploadProgress(
                Math.round(
                  percent *
                  0.45
                )
              );
            }
          );
      }

      if (
        sourceMode === "image" &&
        image
      ) {
        setStatus(
          "Uploading cover art securely..."
        );

        imageStoragePath =
          await uploadFileSecure(
            image,
            "image",
            idToken,
            reservationId,
            percent => {
              setUploadProgress(
                45 +
                Math.round(
                  percent *
                  0.25
                )
              );
            }
          );
      }

      if (
        sourceMode === "video" &&
        sourceVideo
      ) {
        setStatus(
          "Preparing secure video upload..."
        );

        videoStoragePath =
          await uploadVisualizerVideoSigned(
            sourceVideo,
            idToken,
            percent => {
              setStatus(
                "Uploading source video..."
              );

              setUploadProgress(
                Math.round(
                  percent * 0.70
                )
              );
            }
          );
      }

      setStatus(
        "Creating title / artist overlay..."
      );

      const textOverlayDataUrl =
        await createVisualizerTextOverlay(
          title,
          artist,
          format
        );

      const totalDuration =
        Number(
          clipDuration ||
          120
        );

      const requestedStart =
        Number(
          clipStart ||
          0
        );

      const chunkSeconds =
        30;

      const totalChunks =
        Math.ceil(
          totalDuration /
          chunkSeconds
        );

      const renderSessionId =
        crypto
          .randomUUID()
          .replace(
            /[^a-zA-Z0-9_-]/g,
            ""
          );

      const chunkPaths:
        string[] = [];

      for (
        let chunkIndex = 0;
        chunkIndex < totalChunks;
        chunkIndex += 1
      ) {
        const chunkStart =
          requestedStart +
          chunkIndex *
            chunkSeconds;

        const remaining =
          totalDuration -
          chunkIndex *
            chunkSeconds;

        const currentDuration =
          Math.min(
            chunkSeconds,
            remaining
          );

        setStatus(
          `Rendering part ${chunkIndex + 1} of ${totalChunks}...`
        );

        setUploadProgress(
          70 +
          Math.round(
            (
              chunkIndex /
              totalChunks
            ) *
            20
          )
        );

        const chunkResponse =
          await fetch(
            "/api/owner/music-visualizer/generate",
            {
              method: "POST",

              headers: {
                "Content-Type":
                  "application/json",

                Authorization:
                  `Bearer ${idToken}`,
              },

              body:
                JSON.stringify({
                  title,
                  artist,
                  format,
                  visualStyle,
                  visualMode,
                  manualEnergy,

                  clipStart:
                    chunkStart,

                  clipDuration:
                    currentDuration,

                  audioStoragePath,
                  imageStoragePath,
                  sourceMode,
                  videoStoragePath,

                  bounceStrength,
                  beatSensitivity,
                  bounceDirection,
                  textOverlayDataUrl,

                  chunkMode:
                    true,

                  chunkSessionId:
                    renderSessionId,

                  chunkIndex,

                  reservationId,
                }),
            }
          );

        if (!chunkResponse.ok) {
          const raw =
            await chunkResponse.text();

          let message =
            `CHUNK_${chunkIndex + 1}_FAILED - HTTP ${chunkResponse.status}`;

          if (raw) {
            try {
              const data =
                JSON.parse(
                  raw
                ) as {
                  error?: string;
                };

              if (data?.error) {
                message =
                  `${message}

${data.error}`;
              }
            }
            catch {
              message =
                `${message}

${raw.slice(
  0,
  1800
)}`;
            }
          }

          throw new Error(
            message
          );
        }

        const chunkData =
          await chunkResponse.json() as {
            success?: boolean;
            storagePath?: string;
            error?: string;
          };

        if (
          !chunkData.success ||
          !chunkData.storagePath
        ) {
          throw new Error(
            chunkData.error ||
              `Part ${chunkIndex + 1} did not save correctly.`
          );
        }

        chunkPaths.push(
          chunkData.storagePath
        );

        setUploadProgress(
          70 +
          Math.round(
            (
              (
                chunkIndex +
                1
              ) /
              totalChunks
            ) *
            20
          )
        );
      }

      setStatus(
        "Joining rendered parts..."
      );

      setUploadProgress(
        93
      );

      const joinResponse =
        await fetch(
          "/api/owner/music-visualizer/concat",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${idToken}`,
            },

            body:
              JSON.stringify({
                sessionId:
                  renderSessionId,

                chunkPaths,

                title,

                reservationId,
              }),
          }
        );

      if (!joinResponse.ok) {
        const raw =
          await joinResponse.text();

        let message =
          `VISUALIZER_JOIN_FAILED - HTTP ${joinResponse.status}`;

        if (raw) {
          try {
            const data =
              JSON.parse(
                raw
              ) as {
                error?: string;
              };

            if (data?.error) {
              message =
                `${message}

${data.error}`;
            }
          }
          catch {
            message =
              `${message}

${raw.slice(
  0,
  1800
)}`;
          }
        }

        throw new Error(
          message
        );
      }

      const joinData =
        await joinResponse.json() as {
          success?: boolean;
          downloadUrl?: string;
          storagePath?: string;
          error?: string;
        };

      if (
        !joinData.success ||
        !joinData.downloadUrl
      ) {
        throw new Error(
          joinData.error ||
            "Final visualizer could not be assembled."
        );
      }

      setVideoUrl(
        joinData.downloadUrl
      );

      setUploadProgress(
        100
      );

      setStatus(
        "Visualizer ready."
      );
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "VISUALIZER_GENERATION_FAILED";

      if (
        reservationId &&
        idToken
      ) {
        await fetch(
          "/api/visualizer-credits/render-session",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${idToken}`,
            },

            body:
              JSON.stringify({
                action:
                  "refund",

                reservationId,

                reason:
                  message,
              }),
          }
        ).catch(
          () => {}
        );
      }

      setError(message);
      setStatus("");
    } finally {
      await refreshVisualizerBalance();

      setIsGenerating(false);
    }
  }

  return (
    <div className="min-h-screen bg-black px-4 py-8 text-white">
      <div className="mx-auto max-w-6xl">
        <h1 className="mb-2 text-4xl font-black tracking-tight">
          Music Visualizer V8
        </h1>

        <p className="mb-4 text-zinc-400">
          Image mode keeps the classic visualizer. Video mode uploads your own
          MP4/MOV and adds stronger bounce-style beat motion.
        </p>

        <div className="mb-8 flex flex-wrap items-center gap-3">
          <div className="rounded-2xl border border-fuchsia-300/20 bg-fuchsia-300/10 px-5 py-3">
            <div className="text-xs font-black uppercase tracking-widest text-fuchsia-200/60">
              Your Balance
            </div>

            <div className="mt-1 text-2xl font-black text-fuchsia-200">
              {visualizerBalance === null
                ? "..."
                : visualizerBalance}
              <span className="ml-2 text-sm font-bold text-white/50">
                Visualizer Credits
              </span>
            </div>
          </div>

          <a
            href="/music-visualizer/credits"
            className="rounded-2xl border border-white/15 bg-white/[0.06] px-5 py-3 font-black text-white transition hover:bg-white/[0.12]"
          >
            BUY CREDITS
          </a>

          <button
            type="button"
            onClick={() =>
              void refreshVisualizerBalance()
            }
            className="rounded-2xl border border-white/10 bg-black px-5 py-3 font-bold text-zinc-300 transition hover:border-white/25 hover:text-white"
          >
            REFRESH BALANCE
          </button>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
          <form
            onSubmit={handleSubmit}
            className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl"
          >
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <label className="mb-2 block font-bold">Title</label>
                <input
                  value={title}
                  onChange={event => setTitle(event.target.value)}
                  className="w-full rounded-xl border border-zinc-700 bg-black p-3 outline-none"
                  placeholder="Track title"
                />
              </div>

              <div>
                <label className="mb-2 block font-bold">Artist</label>
                <input
                  value={artist}
                  onChange={event => setArtist(event.target.value)}
                  className="w-full rounded-xl border border-zinc-700 bg-black p-3 outline-none"
                  placeholder="Artist name"
                />
              </div>
            </div>

            <div className="mt-6 grid gap-6 md:grid-cols-2">
              <div>
                <label className="mb-2 block font-bold">Output Format</label>
                <select
                  value={format}
                  onChange={event => setFormat(event.target.value as FormatType)}
                  className="w-full rounded-xl border border-zinc-700 bg-black p-3 outline-none"
                >
                  <option value="vertical">Vertical 1080x1920</option>
                  <option value="horizontal">Horizontal 1920x1080</option>
                </select>
                <p className="mt-2 text-sm text-zinc-500">{formatLabel}</p>
              </div>

              <div>
                <label className="mb-2 block font-bold">Visual Style</label>
                <select
                  value={visualStyle}
                  onChange={event =>
                    setVisualStyle(event.target.value as VisualStyle)
                  }
                  className="w-full rounded-xl border border-zinc-700 bg-black p-3 outline-none"
                >
                  <option value="cinematic">Cinematic Glow</option>
                  <option value="fire">Fire Energy</option>
                  <option value="neon">Neon Scope</option>
                </select>
              </div>
            </div>

            <div className="mt-6 grid gap-6 md:grid-cols-2">
              <div>
                <label className="mb-2 block font-bold">Visual Control</label>
                <select
                  value={visualMode}
                  onChange={event =>
                    setVisualMode(event.target.value as VisualMode)
                  }
                  className="w-full rounded-xl border border-zinc-700 bg-black p-3 outline-none"
                >
                  <option value="auto">AUTO</option>
                  <option value="manual">MANUAL</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block font-bold">Source Type</label>
                <select
                  value={sourceMode}
                  onChange={event =>
                    setSourceMode(event.target.value as SourceMode)
                  }
                  className="w-full rounded-xl border border-zinc-700 bg-black p-3 outline-none"
                >
                  <option value="image">Image Visualizer</option>
                  <option value="video">Video Beat Sync</option>
                </select>
              </div>
            </div>

            {visualMode === "manual" && (
              <div className="mt-6 rounded-2xl border border-zinc-800 bg-black/60 p-4">
                <label className="mb-2 block font-bold">
                  Manual Energy: {manualEnergy}%
                </label>
                <input
                  type="range"
                  min="50"
                  max="200"
                  step="1"
                  value={manualEnergy}
                  onChange={event => setManualEnergy(Number(event.target.value))}
                  className="w-full"
                />
                <p className="mt-2 text-sm text-zinc-500">
                  Controls overall visual intensity in manual mode.
                </p>
              </div>
            )}

            <div className="mt-6">
              <label className="mb-2 block font-bold">Clip Settings</label>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="number"
                  min="0"
                  value={clipStart}
                  onChange={event => setClipStart(event.target.value)}
                  className="rounded-xl border border-zinc-700 bg-black p-3 outline-none"
                  placeholder="Start second"
                />
                <select
                  value={clipDuration}
                  onChange={event =>
                    setClipDuration(
                      event.target.value
                    )
                  }
                  className="rounded-xl border border-zinc-700 bg-black p-3 outline-none"
                >
                  <option value="120">
                    2 Minutes
                  </option>

                  <option value="180">
                    3 Minutes
                  </option>

                  <option value="240">
                    4 Minutes
                  </option>

                  <option value="300">
                    5 Minutes
                  </option>
                </select>
              </div>
              <p className="mt-2 text-sm text-zinc-500">
                Choose a visualizer length from 2 to 5 minutes.
              </p>
            </div>

            <div className="mt-6">
              {sourceMode === "image" ? (
                <div className="grid gap-6 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block font-bold">
                      Audio File
                    </label>

                    <input
                      type="file"
                      accept="audio/*"
                      onChange={event =>
                        setAudio(
                          event.target.files?.[0] ||
                          null
                        )
                      }
                      className="w-full rounded-xl border border-zinc-700 bg-black p-3"
                    />

                    <p className="mt-2 text-sm text-zinc-500">
                      Required audio source for Image Visualizer.
                    </p>
                  </div>

                  <div>
                    <label className="mb-2 block font-bold">
                      Cover Art / Visual Image
                    </label>

                    <input
                      type="file"
                      accept="image/*"
                      onChange={event =>
                        setImage(
                          event.target.files?.[0] ||
                          null
                        )
                      }
                      className="w-full rounded-xl border border-zinc-700 bg-black p-3"
                    />

                    <p className="mt-2 text-sm text-zinc-500">
                      Used as the main artwork in Image Visualizer mode.
                    </p>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="mb-2 block font-bold">
                    Source Video With Audio
                  </label>

                  <input
                    type="file"
                    accept="video/mp4,video/quicktime,video/*"
                    onChange={event =>
                      setSourceVideo(
                        event.target.files?.[0] ||
                        null
                      )
                    }
                    className="w-full rounded-xl border border-zinc-700 bg-black p-3"
                  />

                  <p className="mt-2 text-sm text-zinc-500">
                    Upload an MP4/MOV that already contains its music.
                    Video Beat Sync uses that embedded audio automatically.
                  </p>
                </div>
              )}
            </div>

            {sourceMode === "video" && (
              <div className="mt-6 rounded-2xl border border-zinc-800 bg-black/60 p-4">
                <div className="grid gap-6 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block font-bold">
                      Bounce Strength: {bounceStrength}%
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="200"
                      step="1"
                      value={bounceStrength}
                      onChange={event =>
                        setBounceStrength(Number(event.target.value))
                      }
                      className="w-full"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block font-bold">
                      Beat Sensitivity: {beatSensitivity}%
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="1"
                      value={beatSensitivity}
                      onChange={event =>
                        setBeatSensitivity(Number(event.target.value))
                      }
                      className="w-full"
                    />
                  </div>
                </div>

                <div className="mt-4">
                  <label className="mb-2 block font-bold">
                    Bounce Direction
                  </label>
                  <select
                    value={bounceDirection}
                    onChange={event =>
                      setBounceDirection(
                        event.target.value as BounceDirection
                      )
                    }
                    className="w-full rounded-xl border border-zinc-700 bg-black p-3 outline-none"
                  >
                    <option value="auto">AUTO</option>
                    <option value="zoom">Zoom</option>
                    <option value="x">Left / Right</option>
                    <option value="y">Up / Down</option>
                  </select>
                </div>

                <p className="mt-3 text-sm text-zinc-500">
                  Video mode adds stronger motion to the uploaded video while
                  keeping the waveform and spectrum on top.
                </p>
              </div>
            )}

            {uploadProgress > 0 && (
              <div className="mt-6">
                <div className="mb-2 flex items-center justify-between text-sm text-zinc-400">
                  <span>{status || "Working..."}</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className="h-full rounded-full bg-red-600 transition-all"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {error && (
              <div className="mt-6 rounded-2xl border border-red-800 bg-red-950/70 p-4 text-red-200">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isGenerating}
              className="mt-6 rounded-2xl bg-red-600 px-8 py-4 text-xl font-black uppercase tracking-wide text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isGenerating ? "Generating..." : "Generate Visualizer"}
            </button>
          </form>

          <div className="rounded-3xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl">
            <h2 className="mb-4 text-3xl font-black">Visualizer Preview</h2>

            {!videoUrl ? (
              <div className="flex min-h-[520px] items-center justify-center rounded-2xl border border-dashed border-zinc-700 bg-black/50 p-8 text-center text-zinc-500">
                Generate a visualizer to preview it here.
              </div>
            ) : (
              <>
                <video
                  src={videoUrl}
                  controls
                  className="w-full rounded-2xl border border-zinc-800 bg-black"
                />

                <a
                  href={videoUrl}
                  download={`${safeFilePart(title)}-visualizer.mp4`}
                  className="mt-6 inline-block rounded-2xl bg-fuchsia-600 px-8 py-4 text-xl font-black text-white transition hover:bg-fuchsia-500"
                >
                  DOWNLOAD MP4
                </a>
              </>
            )}

            <div className="mt-6 rounded-2xl border border-zinc-800 bg-black/50 p-4 text-sm text-zinc-400">
              <div className="mb-2 font-bold text-white">V8 includes:</div>
              <ul className="list-disc space-y-1 pl-5">
                <li>AUTO / MANUAL visual control</li>
                <li>Image Visualizer mode</li>
                <li>Video Beat Sync mode</li>
                <li>Real kick / bass peak detection</li>
                <li>Beat-reactive flash</li>
                <li>Glow / color burst on stronger beats</li>
                <li>AUTO micro camera shake</li>
                <li>Beat-reactive spectrum energy</li>
                <li>Manual Bounce Strength</li>
                <li>Beat Sensitivity control</li>
                <li>Direction control: Auto / Zoom / X / Y</li>
                <li>Cinematic Glow / Fire Energy / Neon Scope</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


