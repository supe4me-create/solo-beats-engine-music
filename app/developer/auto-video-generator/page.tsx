"use client";

import Link from "next/link";

import {
  ChangeEvent,
  useState,
} from "react";

import {
  deleteObject,
  ref as storageRef,
  uploadBytes,
} from "firebase/storage";

import {
  useAuth,
} from "../../auth/AuthContext";

import {
  firebaseStorage,
} from "../../../lib/firebaseClient";

// SOLO_AUTO_VIDEO_STAGE2

type Format =
  | "vertical"
  | "landscape";

type VisualMode =
  | "auto"
  | "manual";

type VisualStyle =
  | "cinematic"
  | "fire"
  | "neon";

function makeOverlayBlob(
  format: Format,
  title: string,
  artist: string,
  lyrics: string
) {
  return new Promise<Blob | null>(
    resolve => {
      const width =
        format ===
        "landscape"
          ? 1920
          : 1080;

      const height =
        format ===
        "landscape"
          ? 1080
          : 1920;

      const canvas =
        document.createElement(
          "canvas"
        );

      canvas.width =
        width;

      canvas.height =
        height;

      const ctx =
        canvas.getContext(
          "2d"
        );

      if (!ctx) {
        resolve(null);
        return;
      }

      ctx.clearRect(
        0,
        0,
        width,
        height
      );

      const centerX =
        width / 2;

      const titleY =
        format ===
        "vertical"
          ? height * 0.72
          : height * 0.68;

      ctx.textAlign =
        "center";

      ctx.shadowColor =
        "rgba(0,0,0,0.95)";

      ctx.shadowBlur =
        22;

      ctx.fillStyle =
        "#ffffff";

      ctx.font =
        `900 ${Math.round(
          width * 0.065
        )}px Arial`;

      if (
        title.trim()
      ) {
        ctx.fillText(
          title
            .trim()
            .slice(
              0,
              60
            ),
          centerX,
          titleY
        );
      }

      ctx.shadowBlur =
        12;

      ctx.fillStyle =
        "#8ffcff";

      ctx.font =
        `700 ${Math.round(
          width * 0.032
        )}px Arial`;

      if (
        artist.trim()
      ) {
        ctx.fillText(
          artist
            .trim()
            .slice(
              0,
              60
            ),
          centerX,
          titleY +
            width *
              0.065
        );
      }

      const lyricLines =
        lyrics
          .split(/\r?\n/)
          .map(
            value =>
              value.trim()
          )
          .filter(Boolean)
          .slice(
            0,
            4
          );

      if (
        lyricLines.length
      ) {
        ctx.font =
          `700 ${Math.round(
            width * 0.025
          )}px Arial`;

        ctx.fillStyle =
          "#ffffff";

        lyricLines.forEach(
          (
            line,
            index
          ) => {
            ctx.fillText(
              line.slice(
                0,
                90
              ),
              centerX,
              titleY +
                width *
                  0.13 +
                index *
                  width *
                  0.036
            );
          }
        );
      }

      ctx.shadowBlur =
        0;

      ctx.font =
        `800 ${Math.round(
          width * 0.020
        )}px Arial`;

      ctx.fillStyle =
        "rgba(255,255,255,0.7)";

      ctx.fillText(
        "SOLO BEATS ENGINE MUSIC",
        centerX,
        height -
          width *
            0.05
      );

      canvas.toBlob(
        blob =>
          resolve(
            blob
          ),
        "image/png"
      );
    }
  );
}

export default function AutoVideoGeneratorPage() {
  const {
    user,
    loading,
  } = useAuth();

  const [
    title,
    setTitle,
  ] =
    useState("");

  const [
    artist,
    setArtist,
  ] =
    useState(
      "Solo Beats"
    );

  const [
    lyrics,
    setLyrics,
  ] =
    useState("");

  const [
    audioFile,
    setAudioFile,
  ] =
    useState<File | null>(
      null
    );

  const [
    imageFile,
    setImageFile,
  ] =
    useState<File | null>(
      null
    );

  const [
    imagePreview,
    setImagePreview,
  ] =
    useState("");

  const [
    duration,
    setDuration,
  ] =
    useState("15");

  const [
    format,
    setFormat,
  ] =
    useState<Format>(
      "vertical"
    );

  const [
    visualMode,
    setVisualMode,
  ] =
    useState<VisualMode>(
      "auto"
    );

  const [
    visualStyle,
    setVisualStyle,
  ] =
    useState<VisualStyle>(
      "cinematic"
    );

  const [
    bpm,
    setBpm,
  ] =
    useState("120");

  const [
    intensity,
    setIntensity,
  ] =
    useState("65");

  const [
    introSeconds,
    setIntroSeconds,
  ] =
    useState("0.5");

  const [
    outroSeconds,
    setOutroSeconds,
  ] =
    useState("0.75");

  const [
    generating,
    setGenerating,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    success,
    setSuccess,
  ] =
    useState("");

  const [
    videoUrl,
    setVideoUrl,
  ] =
    useState("");

  const [
    storagePath,
    setStoragePath,
  ] =
    useState("");

  const [
    mediaId,
    setMediaId,
  ] =
    useState("");

  const socialSchedulerHref =
    mediaId
      ? `/developer/social-scheduler?videoMediaId=${encodeURIComponent(
          mediaId
        )}&title=${encodeURIComponent(
          title.trim() ||
            "Solo Beats Promo"
        )}&track=${encodeURIComponent(
          audioFile?.name
            ?.replace(
              /\.[^.]+$/,
              ""
            ) ||
            title.trim() ||
            "Solo Beats"
        )}`
      : "/developer/social-scheduler";

  function chooseTrack(
    event:
      ChangeEvent<HTMLInputElement>
  ) {
    setAudioFile(
      event.target
        .files?.[0] ||
        null
    );

    setError("");
    setSuccess("");
  }

  function chooseCover(
    event:
      ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target
        .files?.[0] ||
      null;

    setImageFile(
      file
    );

    setError("");
    setSuccess("");

    if (
      imagePreview
    ) {
      URL.revokeObjectURL(
        imagePreview
      );
    }

    if (
      file
    ) {
      setImagePreview(
        URL.createObjectURL(
          file
        )
      );
    }
    else {
      setImagePreview(
        ""
      );
    }
  }

  async function generateVideo() {
    if (!user) {
      setError(
        "Owner sign-in required."
      );

      return;
    }

    if (
      !audioFile
    ) {
      setError(
        "Upload a track first."
      );

      return;
    }

    if (
      !imageFile
    ) {
      setError(
        "Upload cover art first."
      );

      return;
    }

    setGenerating(
      true
    );

    setError("");
    setSuccess("");
    setVideoUrl("");
    setStoragePath("");
    setMediaId("");

    const uploadId =
      crypto.randomUUID();

    const audioExtension =
      audioFile.name
        .split(".")
        .pop()
        ?.toLowerCase()
        .replace(
          /[^a-z0-9]/g,
          ""
        ) ||
      "wav";

    const imageExtension =
      imageFile.name
        .split(".")
        .pop()
        ?.toLowerCase()
        .replace(
          /[^a-z0-9]/g,
          ""
        ) ||
      "jpg";

    const basePath =
      `media/auto-video-source/${user.uid}/${uploadId}`;

    const audioStoragePath =
      `${basePath}/audio.${audioExtension}`;

    const imageStoragePath =
      `${basePath}/cover.${imageExtension}`;

    const overlayStoragePath =
      `${basePath}/overlay.png`;

    const audioRef =
      storageRef(
        firebaseStorage,
        audioStoragePath
      );

    const imageRef =
      storageRef(
        firebaseStorage,
        imageStoragePath
      );

    const overlayRef =
      storageRef(
        firebaseStorage,
        overlayStoragePath
      );

    let overlayUploaded =
      false;

    try {
      setSuccess(
        "UPLOADING TRACK + COVER..."
      );

      await Promise.all([
        uploadBytes(
          audioRef,
          audioFile,
          {
            contentType:
              audioFile.type ||
              "application/octet-stream",
          }
        ),

        uploadBytes(
          imageRef,
          imageFile,
          {
            contentType:
              imageFile.type ||
              "application/octet-stream",
          }
        ),
      ]);

      const overlay =
        await makeOverlayBlob(
          format,
          title,
          artist,
          lyrics
        );

      if (
        overlay
      ) {
        await uploadBytes(
          overlayRef,
          overlay,
          {
            contentType:
              "image/png",
          }
        );

        overlayUploaded =
          true;
      }

      setSuccess(
        "RENDERING STAGE 2 VIDEO..."
      );

      const token =
        await user.getIdToken();

      const response =
        await fetch(
          "/api/owner/auto-video/generate",
          {
            method:
              "POST",

            headers: {
              Authorization:
                `Bearer ${token}`,

              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                audioStoragePath,
                imageStoragePath,

                overlayStoragePath:
                  overlayUploaded
                    ? overlayStoragePath
                    : "",

                audioName:
                  audioFile.name,

                imageName:
                  imageFile.name,

                title:
                  title.trim() ||
                  "Solo Beats Promo",

                artist:
                  artist.trim(),

                duration:
                  Number(
                    duration
                  ),

                format,

                visualMode,

                visualStyle,

                bpm:
                  Number(
                    bpm
                  ),

                intensity:
                  Number(
                    intensity
                  ),

                introSeconds:
                  Number(
                    introSeconds
                  ),

                outroSeconds:
                  Number(
                    outroSeconds
                  ),
              }),
          }
        );

      const responseText =
        await response.text();

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
          `Generator returned an invalid response (${response.status}).`
        );
      }

      if (
        !response.ok ||
        !data?.success
      ) {
        throw new Error(
          data?.error ||
          "Video generation failed."
        );
      }

      setVideoUrl(
        data.video
          ?.videoUrl ||
        ""
      );

      setStoragePath(
        data.video
          ?.storagePath ||
        ""
      );

      setMediaId(
        data.video
          ?.mediaId ||
        data.video
          ?.id ||
        ""
      );

      setSuccess(
        "STAGE 2 VIDEO CREATED SUCCESSFULLY."
      );
    }
    catch (err) {
      setSuccess("");

      setError(
        err instanceof Error
          ? err.message
          : "Video generation failed."
      );
    }
    finally {
      await deleteObject(
        audioRef
      ).catch(
        () => {}
      );

      await deleteObject(
        imageRef
      ).catch(
        () => {}
      );

      if (
        overlayUploaded
      ) {
        await deleteObject(
          overlayRef
        ).catch(
          () => {}
        );
      }

      setGenerating(
        false
      );
    }
  }

  if (
    loading
  ) {
    return (
      <main className="grid min-h-screen place-items-center bg-black text-white">
        Loading...
      </main>
    );
  }

  if (
    !user
  ) {
    return (
      <main className="grid min-h-screen place-items-center bg-black px-5 text-white">
        <div className="max-w-lg rounded-3xl border border-white/10 bg-white/[0.04] p-8 text-center">
          <h1 className="text-3xl font-black">
            Owner sign-in required
          </h1>

          <Link
            href="/account?mode=signin"
            className="mt-5 inline-flex rounded-xl bg-white px-5 py-3 font-black text-black"
          >
            SIGN IN
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050509] px-4 pb-24 pt-10 text-white sm:px-8">

        {/* SOLO_AUTO_VIDEO_V3_ANIMATED_STUDIO */}
        <section
          aria-label="Animated video creation"
          className="mb-6 rounded-3xl border border-fuchsia-500/35 bg-gradient-to-br from-fuchsia-950/35 via-[#101022] to-black p-5 text-white shadow-lg md:p-7"
        >
          <p className="text-xs font-black uppercase tracking-[0.25em] text-fuchsia-300">
            SOLO BEATS VIDEO V3
          </p>
          <h2 className="mt-2 text-2xl font-black md:text-3xl">
            Animated Scene Studio
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-zinc-300">
            Create real moving scenes with the existing Runway video engine,
            then add your soundtrack with the music-video tools.
            The current Runway connection supports 5- or 10-second scenes.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <a
              href="/developer/ai-video"
              className="rounded-2xl border border-fuchsia-400/40 bg-fuchsia-600 px-5 py-4 text-center text-sm font-black text-white transition hover:bg-fuchsia-500"
            >
              CREATE ANIMATED SCENES
            </a>
            <a
              href="/developer/auto-video-generator"
              className="rounded-2xl border border-white/20 bg-white/10 px-5 py-4 text-center text-sm font-black text-white transition hover:bg-white/20"
            >
              CLASSIC MUSIC VIDEO GENERATOR
            </a>
          </div>
          <p className="mt-4 text-xs text-zinc-400">
            Multi-scene assembly and beat synchronization are the next V3
            engine stage. Existing rendering controls remain available.
          </p>
        </section>
      <div className="mx-auto max-w-7xl">

        <section className="rounded-[2rem] border border-fuchsia-400/20 bg-gradient-to-br from-fuchsia-500/15 via-black to-cyan-500/10 p-8">
          <p className="text-sm font-black tracking-[0.24em] text-cyan-300">
            SOLO BEATS
          </p>

          <h1 className="mt-3 text-4xl font-black sm:text-6xl">
            AUTO VIDEO GENERATOR
          </h1>

          <p className="mt-3 text-xl font-black text-fuchsia-300">
            STAGE 2
          </p>

          <p className="mt-4 max-w-3xl text-white/55">
            Music + artwork → animated promotional video with BPM-synchronized motion, multiple visual phases, effects and text overlays.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/developer/videos"
              className="rounded-xl border border-white/10 px-5 py-3 font-black"
            >
              VIDEO MANAGER
            </Link>

            <Link
              href={socialSchedulerHref}
              className="rounded-xl border border-white/10 px-5 py-3 font-black"
            >
              SOCIAL SCHEDULER
            </Link>
          </div>
        </section>

        {error ? (
          <div className="mt-6 rounded-2xl border border-red-400/25 bg-red-400/10 p-4 text-red-200">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="mt-6 rounded-2xl border border-emerald-400/25 bg-emerald-400/10 p-4 font-bold text-emerald-200">
            {success}
          </div>
        ) : null}

        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_1fr]">

          <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-7">

            <div className="grid gap-5 sm:grid-cols-2">

              <label>
                <span className="font-black">
                  TITLE
                </span>

                <input
                  value={title}
                  onChange={
                    event =>
                      setTitle(
                        event.target.value
                      )
                  }
                  placeholder="Track title"
                  className="mt-2 w-full rounded-xl border border-white/10 bg-black p-3"
                />
              </label>

              <label>
                <span className="font-black">
                  ARTIST
                </span>

                <input
                  value={artist}
                  onChange={
                    event =>
                      setArtist(
                        event.target.value
                      )
                  }
                  placeholder="Artist"
                  className="mt-2 w-full rounded-xl border border-white/10 bg-black p-3"
                />
              </label>

              <label>
                <span className="font-black">
                  MODE
                </span>

                <select
                  value={visualMode}
                  onChange={
                    event =>
                      setVisualMode(
                        event.target.value as VisualMode
                      )
                  }
                  className="mt-2 w-full rounded-xl border border-white/10 bg-black p-3"
                >
                  <option value="auto">
                    AUTO
                  </option>

                  <option value="manual">
                    MANUAL
                  </option>
                </select>
              </label>

              <label>
                <span className="font-black">
                  FORMAT
                </span>

                <select
                  value={format}
                  onChange={
                    event =>
                      setFormat(
                        event.target.value as Format
                      )
                  }
                  className="mt-2 w-full rounded-xl border border-white/10 bg-black p-3"
                >
                  <option value="vertical">
                    SHORTS 1080×1920
                  </option>

                  <option value="landscape">
                    LANDSCAPE 1920×1080
                  </option>
                </select>
              </label>

              <label>
                <span className="font-black">
                  STYLE
                </span>

                <select
                  value={visualStyle}
                  onChange={
                    event =>
                      setVisualStyle(
                        event.target.value as VisualStyle
                      )
                  }
                  className="mt-2 w-full rounded-xl border border-white/10 bg-black p-3"
                >
                  <option value="cinematic">
                    CINEMATIC GLOW
                  </option>

                  <option value="fire">
                    FIRE ENERGY
                  </option>

                  <option value="neon">
                    NEON SCOPE
                  </option>
                </select>
              </label>

              <label>
                <span className="font-black">
                  DURATION
                </span>

                <select
                  value={duration}
                  onChange={
                    event =>
                      setDuration(
                        event.target.value
                      )
                  }
                  className="mt-2 w-full rounded-xl border border-white/10 bg-black p-3"
                >
                  <option value="15">
                    15 seconds
                  </option>

                  <option value="30">
                    30 seconds
                  </option>
                </select>
              </label>

              <label>
                <span className="font-black">
                  BPM
                </span>

                <input
                  type="number"
                  min="60"
                  max="200"
                  value={bpm}
                  onChange={
                    event =>
                      setBpm(
                        event.target.value
                      )
                  }
                  className="mt-2 w-full rounded-xl border border-white/10 bg-black p-3"
                />
              </label>

              <label>
                <span className="font-black">
                  EFFECT INTENSITY
                </span>

                <input
                  type="range"
                  min="0"
                  max="100"
                  value={intensity}
                  onChange={
                    event =>
                      setIntensity(
                        event.target.value
                      )
                  }
                  className="mt-4 w-full"
                />

                <div className="mt-1 text-sm text-cyan-300">
                  {intensity}%
                </div>
              </label>

              <label>
                <span className="font-black">
                  INTRO FADE
                </span>

                <select
                  value={introSeconds}
                  onChange={
                    event =>
                      setIntroSeconds(
                        event.target.value
                      )
                  }
                  className="mt-2 w-full rounded-xl border border-white/10 bg-black p-3"
                >
                  <option value="0">
                    OFF
                  </option>

                  <option value="0.5">
                    0.5 sec
                  </option>

                  <option value="1">
                    1 sec
                  </option>
                </select>
              </label>

              <label>
                <span className="font-black">
                  OUTRO FADE
                </span>

                <select
                  value={outroSeconds}
                  onChange={
                    event =>
                      setOutroSeconds(
                        event.target.value
                      )
                  }
                  className="mt-2 w-full rounded-xl border border-white/10 bg-black p-3"
                >
                  <option value="0">
                    OFF
                  </option>

                  <option value="0.75">
                    0.75 sec
                  </option>

                  <option value="1">
                    1 sec
                  </option>
                </select>
              </label>

            </div>

            <label className="mt-6 block">
              <span className="font-black">
                LYRICS / TEXT
              </span>

              <textarea
                rows={4}
                value={lyrics}
                onChange={
                  event =>
                    setLyrics(
                      event.target.value
                    )
                }
                placeholder="Optional lyrics or promotional text. Up to four lines will appear."
                className="mt-2 w-full rounded-xl border border-white/10 bg-black p-3"
              />
            </label>

            <div className="mt-7 grid gap-5 sm:grid-cols-2">

              <label className="rounded-2xl border border-white/10 p-5">
                <span className="font-black">
                  UPLOAD TRACK
                </span>

                <input
                  type="file"
                  accept="audio/*"
                  onChange={chooseTrack}
                  className="mt-4 block w-full text-sm"
                />

                {audioFile ? (
                  <p className="mt-3 break-all text-sm text-cyan-300">
                    {audioFile.name}
                  </p>
                ) : null}
              </label>

              <label className="rounded-2xl border border-white/10 p-5">
                <span className="font-black">
                  UPLOAD COVER ART
                </span>

                <input
                  type="file"
                  accept="image/*"
                  onChange={chooseCover}
                  className="mt-4 block w-full text-sm"
                />

                {imageFile ? (
                  <p className="mt-3 break-all text-sm text-cyan-300">
                    {imageFile.name}
                  </p>
                ) : null}
              </label>

            </div>

            <button
              type="button"
              disabled={generating}
              onClick={() =>
                void generateVideo()
              }
              className="mt-7 w-full rounded-2xl bg-white px-6 py-4 text-lg font-black text-black disabled:opacity-50"
            >
              {generating
                ? "GENERATING..."
                : "GENERATE STAGE 2 VIDEO"}
            </button>

          </section>

          <section className="rounded-3xl border border-white/10 bg-black p-6">

            <h2 className="text-2xl font-black">
              PREVIEW
            </h2>

            {videoUrl ? (
              <>
                <video
                  src={videoUrl}
                  controls
                  className={
                    format ===
                    "vertical"
                      ? "mx-auto mt-5 max-h-[720px] rounded-2xl border border-white/10"
                      : "mt-5 w-full rounded-2xl border border-white/10"
                  }
                />

                <div className="mt-5 flex flex-wrap gap-3">
                  <a
                    href={videoUrl}
                    download
                    className="rounded-xl bg-fuchsia-500 px-5 py-3 font-black"
                  >
                    DOWNLOAD MP4
                  </a>

                  <Link
                    href="/developer/videos"
                    className="rounded-xl border border-white/10 px-5 py-3 font-black"
                  >
                    VIDEO MANAGER
                  </Link>

                  <Link
                    href={socialSchedulerHref}
                    className="rounded-xl border border-cyan-400/20 px-5 py-3 font-black text-cyan-300"
                  >
                    SEND TO SOCIAL SCHEDULER
                  </Link>
                </div>

                {storagePath ? (
                  <p className="mt-5 break-all text-xs text-white/35">
                    Firebase: {storagePath}
                  </p>
                ) : null}
              </>
            ) : imagePreview ? (
              <img
                src={imagePreview}
                alt="Cover preview"
                className={
                  format ===
                  "vertical"
                    ? "mx-auto mt-5 max-h-[720px] rounded-2xl object-contain"
                    : "mt-5 w-full rounded-2xl object-contain"
                }
              />
            ) : (
              <div className="mt-5 grid min-h-[500px] place-items-center rounded-2xl border border-dashed border-white/10 text-white/35">
                Upload a track and cover to begin.
              </div>
            )}

            <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm text-white/55">
              Stage 2 uses three visual phases, BPM-synchronized camera pulse, rhythmic flash, style presets, title/artist/lyrics overlay, intro/outro fades, Shorts or landscape export, Firebase storage, Video Manager and Social Scheduler handoff.
            </div>
          </section>

        </div>
      </div>
    </main>
  );
}