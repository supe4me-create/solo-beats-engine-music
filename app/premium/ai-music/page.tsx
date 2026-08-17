"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import { useAuth } from "../../auth/AuthContext";

type VocalMode =
  | "instrumental"
  | "vocals";

type AccessInfo = {
  isOwner: boolean;
  premiumActive: boolean;
  premiumCreditsRemaining: number;
  premiumCreditsLimit: number;
  premiumCreditPeriodEnd: string;
  premiumGenerationCost: number;
  freeRemaining: number;
  freeTrialLimit: number;
  canGenerate: boolean;
  accessMode:
    | "owner"
    | "premium"
    | "trial"
    | "locked";
};

export default function AiMusicPage() {
  const {
    user,
    loading: authLoading,
  } = useAuth();

  const [prompt, setPrompt] =
    useState("");

  const [genre, setGenre] =
    useState("Electronic");

  const [mood, setMood] =
    useState("Energetic");

  const [bpm, setBpm] =
    useState(128);

  const [musicKey, setMusicKey] =
    useState("C Minor");

  const [duration, setDuration] =
    useState(30);

  const [vocalMode, setVocalMode] =
    useState<VocalMode>(
      "instrumental"
    );

  const [creating, setCreating] =
    useState(false);

  const [status, setStatus] =
    useState(
      "Ready to generate."
    );

  const [audioUrl, setAudioUrl] =
    useState<string | null>(null);

  const [
    generationId,
    setGenerationId,
  ] =
    useState<string | null>(
      null
    );

  const [
    recentGenerations,
    setRecentGenerations,
  ] =
    useState<
      Array<{
        generationId: string;
        prompt: string;
        genre: string;
        duration: number;
        audioUrl: string | null;
        savedToMediaLibrary: boolean;
        createdAt: string;
      }>
    >([]);

  const [
    historyLoading,
    setHistoryLoading,
  ] =
    useState(false);

  const [
    savingToMedia,
    setSavingToMedia,
  ] =
    useState(false);

  const [
    mediaMessage,
    setMediaMessage,
  ] =
    useState<string | null>(
      null
    );

  const [error, setError] =
    useState<string | null>(null);

  const [access, setAccess] =
    useState<AccessInfo | null>(
      null
    );

  const [accessLoading, setAccessLoading] =
    useState(false);

  const loadAccess =
    useCallback(async () => {
      if (!user) {
        setAccess(null);
        return;
      }

      setAccessLoading(true);

      try {
        const token =
          await user.getIdToken();

        const response =
          await fetch(
            "/api/ai-music/generate",
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
              "AI Music access could not be loaded."
          );
        }

        setAccess({
          isOwner:
            data.isOwner === true,
          premiumActive:
            data.premiumActive ===
            true,
          premiumCreditsRemaining:
            Number(
              data.premiumCreditsRemaining
            ) || 0,
          premiumCreditsLimit:
            Number(
              data.premiumCreditsLimit
            ) || 10,
          premiumCreditPeriodEnd:
            typeof data.premiumCreditPeriodEnd ===
            "string"
              ? data.premiumCreditPeriodEnd
              : "",
          premiumGenerationCost:
            Number(
              data.premiumGenerationCost
            ) || 1,
          freeRemaining:
            Number(
              data.freeRemaining
            ) || 0,
          freeTrialLimit:
            Number(
              data.freeTrialLimit
            ) || 2,
          canGenerate:
            data.canGenerate ===
            true,
          accessMode:
            data.accessMode,
        });
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "AI Music access could not be loaded."
        );
      } finally {
        setAccessLoading(false);
      }
    }, [user]);

  useEffect(() => {
    void loadAccess();
  }, [loadAccess]);

  const loadHistory =
    useCallback(
      async () => {
        if (!user) {
          setRecentGenerations(
            []
          );
          return;
        }

        setHistoryLoading(
          true
        );

        try {
          const token =
            await user
              .getIdToken();

          const response =
            await fetch(
              "/api/ai-music/history",
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
            await response
              .json();

          if (
            response.ok &&
            data.success
          ) {
            setRecentGenerations(
              Array.isArray(
                data.generations
              )
                ? data.generations
                : []
            );
          }
        } catch (error) {
          console.error(
            "AI MUSIC HISTORY",
            error
          );
        } finally {
          setHistoryLoading(
            false
          );
        }
      },
      [user]
    );

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  async function handleGenerate() {
    if (
      !user ||
      !prompt.trim() ||
      creating
    ) {
      return;
    }

    if (
      access &&
      !access.canGenerate
    ) {
      setError(
        access.premiumActive
          ? "Your monthly AI Music credits have been used. Please wait for your next monthly credit reset."
          : "Your free trial is complete. Subscribe to SOLO BEATS PREMIUM to continue generating music."
      );
      return;
    }

    setCreating(true);
    setError(null);
    setAudioUrl(null);
    setGenerationId(null);
    setMediaMessage(null);

    setStatus(
      "Creating your AI song..."
    );

    try {
      const token =
        await user.getIdToken();

      const response =
        await fetch(
          "/api/ai-music/generate",
          {
            method: "POST",
            headers: {
              Authorization:
                `Bearer ${token}`,
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              prompt,
              genre,
              mood,
              bpm,
              musicKey,
              duration,
              vocalMode,
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
            "AI music generation failed."
        );
      }

      setAudioUrl(
        data.audioUrl ||
        null
      );

      setGenerationId(
        typeof data.generationId ===
          "string"
          ? data.generationId
          : null
      );

      setStatus(
        "Generation complete."
      );

      await Promise.all([
        loadAccess(),
        loadHistory(),
      ]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "AI music generation failed."
      );

      setStatus(
        "Generation failed."
      );

      await loadAccess();
    } finally {
      setCreating(false);
    }
  }

  async function handleSaveToMediaLibrary(
    targetGenerationId?: string
  ) {
    const selectedGenerationId =
      targetGenerationId ||
      generationId;

    if (
      !user ||
      !selectedGenerationId ||
      savingToMedia
    ) {
      return;
    }

    setSavingToMedia(true);
    setMediaMessage(null);

    try {
      const token =
        await user
          .getIdToken();

      const response =
        await fetch(
          "/api/ai-music/save-to-media",
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
                generationId:
                  selectedGenerationId,
              }),
          }
        );

      const data =
        await response
          .json();

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.error ||
            "Song could not be saved."
        );
      }

      setMediaMessage(
        data.message ||
          "Song saved to Media Library."
      );

      await loadHistory();
    } catch (error) {
      setMediaMessage(
        error instanceof Error
          ? error.message
          : "Song could not be saved."
      );
    } finally {
      setSavingToMedia(false);
    }
  }

  const fieldClass =
    "mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white outline-none";

  const buttonText =
    creating
      ? "Generating..."
      : access?.isOwner
        ? "Generate AI Music — 0 Credits"
        : access?.premiumActive
          ? access.canGenerate
            ? `Generate AI Music — ${access.premiumGenerationCost} Credit`
            : "Monthly AI Music Credits Used"
          : access
            ? `Generate Free Song — ${access.freeRemaining} Left`
            : "Generate AI Music";

  return (
    <main className="min-h-screen bg-[#07070d] px-6 py-10 text-white">
      <div className="mx-auto max-w-6xl">
        <p className="text-xs font-black uppercase tracking-[0.25em] text-cyan-300">
          SOLO BEATS ENGINE MUSIC
        </p>

        <h1 className="mt-3 text-4xl font-black">
          AI Music Generator
        </h1>

        <p className="mt-3 max-w-3xl text-white/55">
          Create original beats and songs
          from a prompt.
        </p>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          {authLoading ? (
            <p className="font-bold text-white/60">
              Checking account...
            </p>
          ) : !user ? (
            <div>
              <p className="font-black text-amber-200">
                Sign in required
              </p>
              <p className="mt-1 text-sm text-white/55">
                Sign in to receive your
                2 free AI song generations.
              </p>
            </div>
          ) : accessLoading ? (
            <p className="font-bold text-white/60">
              Checking AI Music access...
            </p>
          ) : access?.isOwner ? (
            <div>
              <p className="font-black text-cyan-200">
                OWNER ACCESS — UNLIMITED
              </p>
              <p className="mt-1 text-sm text-white/55">
                Generation cost: 0 credits.
              </p>
            </div>
          ) : access?.premiumActive ? (
            <div>
              <p className="font-black text-emerald-300">
                SOLO BEATS PREMIUM ACTIVE
              </p>

              <p className="mt-1 text-sm text-white/55">
                {access.premiumCreditsRemaining} of{" "}
                {access.premiumCreditsLimit} AI Music
                credits remaining this monthly cycle.
              </p>

              <p className="mt-1 text-xs text-white/40">
                Each AI Music generation uses{" "}
                {access.premiumGenerationCost} credit.
              </p>

              {!access.canGenerate ? (
                <p className="mt-3 text-sm font-bold text-fuchsia-300">
                  Monthly AI Music credits used.
                  Generation is locked until your
                  next automatic reset.
                </p>
              ) : null}
            </div>
          ) : access?.freeRemaining ? (
            <div>
              <p className="font-black text-cyan-200">
                FREE TRIAL
              </p>
              <p className="mt-1 text-sm text-white/55">
                {access.freeRemaining} of{" "}
                {access.freeTrialLimit} free
                song generations remaining.
              </p>
            </div>
          ) : (
            <div>
              <p className="font-black text-fuchsia-300">
                FREE TRIAL COMPLETE
              </p>

              <p className="mt-1 text-sm text-white/55">
                Subscribe to SOLO BEATS
                PREMIUM to continue generating
                AI music.
              </p>

              <a
                href="/premium"
                className="mt-3 inline-flex rounded-xl bg-white px-4 py-2 text-sm font-black text-black"
              >
                Subscribe to Premium
              </a>
            </div>
          )}
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
          <section className="rounded-3xl border border-white/10 bg-[#10101b] p-6">
            <h2 className="text-2xl font-black">
              Create Music
            </h2>

            <label className="mt-6 block text-sm font-bold">
              Describe your song

              <textarea
                value={prompt}
                onChange={(event) =>
                  setPrompt(
                    event.target.value
                  )
                }
                rows={6}
                placeholder="Describe the music you want..."
                className={`${fieldClass} resize-none`}
              />
            </label>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <label className="text-sm font-bold">
                Genre
                <select
                  value={genre}
                  onChange={(event) =>
                    setGenre(
                      event.target.value
                    )
                  }
                  className={fieldClass}
                >
                  <option>
                    Electronic
                  </option>
                  <option>
                    Hip Hop
                  </option>
                  <option>Trap</option>
                  <option>R&B</option>
                  <option>Pop</option>
                  <option>Rock</option>
                  <option>
                    Afrobeats
                  </option>
                  <option>Dance</option>
                  <option>
                    Cinematic
                  </option>
                  <option>
                    Ambient
                  </option>
                </select>
              </label>

              <label className="text-sm font-bold">
                Mood
                <select
                  value={mood}
                  onChange={(event) =>
                    setMood(
                      event.target.value
                    )
                  }
                  className={fieldClass}
                >
                  <option>
                    Energetic
                  </option>
                  <option>Dark</option>
                  <option>Happy</option>
                  <option>
                    Emotional
                  </option>
                  <option>
                    Aggressive
                  </option>
                  <option>Epic</option>
                  <option>Chill</option>
                  <option>
                    Mysterious
                  </option>
                </select>
              </label>

              <label className="text-sm font-bold">
                BPM
                <input
                  type="number"
                  min={60}
                  max={200}
                  value={bpm}
                  onChange={(event) =>
                    setBpm(
                      Number(
                        event.target.value
                      )
                    )
                  }
                  className={fieldClass}
                />
              </label>

              <label className="text-sm font-bold">
                Key
                <select
                  value={musicKey}
                  onChange={(event) =>
                    setMusicKey(
                      event.target.value
                    )
                  }
                  className={fieldClass}
                >
                  <option>C Major</option>
                  <option>C Minor</option>
                  <option>D Major</option>
                  <option>D Minor</option>
                  <option>E Major</option>
                  <option>E Minor</option>
                  <option>F Major</option>
                  <option>F Minor</option>
                  <option>G Major</option>
                  <option>G Minor</option>
                  <option>A Major</option>
                  <option>A Minor</option>
                </select>
              </label>

              <label className="text-sm font-bold">
                Duration
                <select
                  value={duration}
                  onChange={(event) =>
                    setDuration(
                      Number(
                        event.target.value
                      )
                    )
                  }
                  className={fieldClass}
                >
                  <option value={15}>
                    15 seconds
                  </option>

                  <option value={30}>
                    30 seconds
                  </option>

                  <option value={60}>
                    1 minute
                  </option>

                  <option value={120}>
                    2 minutes
                  </option>
                </select>
              </label>

              <label className="text-sm font-bold">
                Type

                <select
                  value={vocalMode}
                  onChange={(event) =>
                    setVocalMode(
                      event.target
                        .value as VocalMode
                    )
                  }
                  className={fieldClass}
                >
                  <option value="instrumental">
                    Instrumental
                  </option>

                  <option value="vocals">
                    Vocals
                  </option>
                </select>
              </label>
            </div>

            <button
              type="button"
              onClick={handleGenerate}
              disabled={
                authLoading ||
                accessLoading ||
                creating ||
                !user ||
                !prompt.trim() ||
                access?.canGenerate ===
                  false
              }
              className="mt-6 w-full rounded-2xl bg-gradient-to-r from-cyan-300 to-fuchsia-500 px-6 py-4 text-lg font-black text-black disabled:cursor-not-allowed disabled:opacity-40"
            >
              {buttonText}
            </button>

            {error ? (
              <p className="mt-4 rounded-xl border border-red-400/20 bg-red-500/10 p-4 text-sm font-bold text-red-200">
                {error}
              </p>
            ) : null}
          </section>

          <section className="rounded-3xl border border-white/10 bg-[#10101b] p-6">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-fuchsia-300">
              Generation Output
            </p>

            <h2 className="mt-2 text-2xl font-black">
              Your Song
            </h2>

            <div className="mt-6 rounded-2xl border border-white/10 bg-black/25 p-5">
              <p className="text-sm font-bold text-white/50">
                STATUS
              </p>

              <p className="mt-2 font-black">
                {status}
              </p>
            </div>

            {audioUrl ? (
              <div className="mt-6">
                <audio
                  controls
                  src={audioUrl}
                  className="w-full"
                />

                <div className="mt-4 flex flex-wrap gap-3">
                  <a
                    href={audioUrl}
                    download
                    className="inline-flex rounded-xl border border-white/15 px-5 py-3 font-black hover:bg-white/10"
                  >
                    Download Song
                  </a>

                  {generationId ? (
                    <button
                      type="button"
                      onClick={() =>
                        void handleSaveToMediaLibrary()
                      }
                      disabled={
                        savingToMedia
                      }
                      className="inline-flex rounded-xl bg-fuchsia-600 px-5 py-3 font-black text-white hover:bg-fuchsia-500 disabled:opacity-50"
                    >
                      {savingToMedia
                        ? "Saving..."
                        : "Save to Media Library"}
                    </button>
                  ) : null}
                </div>

                {mediaMessage ? (
                  <p className="mt-3 text-sm font-bold text-fuchsia-200">
                    {mediaMessage}
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="mt-6 grid min-h-64 place-items-center rounded-2xl border border-dashed border-white/15 bg-black/20 p-8 text-center">
                <div>
                  <p className="text-xl font-black text-white/60">
                    Generated music will
                    appear here
                  </p>

                  <p className="mt-2 text-sm text-white/35">
                    Enter a prompt and create
                    an AI song.
                  </p>
                </div>
              </div>
            )}

            <div className="mt-6 rounded-2xl border border-white/10 p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-black">
                    Recent Generations
                  </p>

                  <p className="mt-1 text-sm text-white/40">
                    Your generated songs are stored privately.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    void loadHistory()
                  }
                  disabled={
                    historyLoading
                  }
                  className="rounded-xl border border-white/15 px-4 py-2 text-sm font-black hover:bg-white/10 disabled:opacity-50"
                >
                  {historyLoading
                    ? "Loading..."
                    : "Refresh"}
                </button>
              </div>

              {recentGenerations.length ? (
                <div className="mt-5 space-y-4">
                  {recentGenerations
                    .slice(0, 10)
                    .map((item) => (
                      <div
                        key={
                          item.generationId
                        }
                        className="rounded-xl border border-white/10 bg-black/25 p-4"
                      >
                        <p className="font-black">
                          {item.genre ||
                            "AI Music Generation"}
                        </p>

                        <p className="mt-1 text-sm text-white/45">
                          {item.prompt}
                        </p>

                        {item.duration ? (
                          <p className="mt-2 text-xs text-white/30">
                            {item.duration} seconds
                          </p>
                        ) : null}

                        <p className="mt-2 text-xs font-black text-white/40">
                          {item.savedToMediaLibrary
                            ? "IN MEDIA LIBRARY"
                            : "PRIVATE"}
                        </p>

                        {item.audioUrl ? (
                          <div className="mt-4">
                            <audio
                              controls
                              src={
                                item.audioUrl
                              }
                              className="w-full"
                            />

                            <div className="mt-3 flex flex-wrap gap-3">
                              <a
                                href={
                                  item.audioUrl
                                }
                                download
                                className="inline-flex rounded-xl border border-white/15 px-4 py-2 text-sm font-black hover:bg-white/10"
                              >
                                Download Song
                              </a>

                              <button
                                type="button"
                                onClick={() =>
                                  void handleSaveToMediaLibrary(
                                    item.generationId
                                  )
                                }
                                disabled={
                                  savingToMedia ||
                                  item.savedToMediaLibrary
                                }
                                className="inline-flex rounded-xl bg-fuchsia-600 px-4 py-2 text-sm font-black text-white hover:bg-fuchsia-500 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {item.savedToMediaLibrary
                                  ? "Saved to Media Library"
                                  : savingToMedia
                                    ? "Saving..."
                                    : "Save to Media Library"}
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ))}
                </div>
              ) : (
                <p className="mt-5 text-sm text-white/40">
                  {historyLoading
                    ? "Loading history..."
                    : "No stored generations yet."}
                </p>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

