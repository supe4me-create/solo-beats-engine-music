"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type Difficulty = "Easy" | "Normal" | "Hard";

type HitResult = {
  id: number;
  text: string;
  accuracy: string;
};

const DIFFICULTIES: Record<
  Difficulty,
  {
    bpm: number;
    tolerance: number;
    points: number;
  }
> = {
  Easy: {
    bpm: 90,
    tolerance: 230,
    points: 80,
  },
  Normal: {
    bpm: 120,
    tolerance: 170,
    points: 100,
  },
  Hard: {
    bpm: 150,
    tolerance: 115,
    points: 130,
  },
};

function formatTime(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  const remainder = safe % 60;

  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

export default function PremiumGamePage() {
  const [difficulty, setDifficulty] =
    useState<Difficulty>("Normal");

  const [gameStarted, setGameStarted] =
    useState(false);

  const [paused, setPaused] =
    useState(false);

  const [score, setScore] =
    useState(0);

  const [combo, setCombo] =
    useState(0);

  const [bestCombo, setBestCombo] =
    useState(0);

  const [hits, setHits] =
    useState(0);

  const [misses, setMisses] =
    useState(0);

  const [beatPulse, setBeatPulse] =
    useState(false);

  const [hitResult, setHitResult] =
    useState<HitResult | null>(null);

  const [elapsed, setElapsed] =
    useState(0);

  const [localAudioUrl, setLocalAudioUrl] =
    useState<string | null>(null);

  const [localAudioName, setLocalAudioName] =
    useState("");

  const audioRef =
    useRef<HTMLAudioElement | null>(null);

  const beatTimerRef =
    useRef<number | null>(null);

  const elapsedTimerRef =
    useRef<number | null>(null);

  const lastBeatRef =
    useRef<number>(0);

  const resultIdRef =
    useRef(0);

  const settings =
    DIFFICULTIES[difficulty];

  const beatIntervalMs =
    60000 / settings.bpm;

  const totalAttempts =
    hits + misses;

  const accuracy =
    totalAttempts > 0
      ? Math.round(
          (hits / totalAttempts) * 100
        )
      : 100;

  const comboBoost =
    Math.min(combo, 20) / 20;

  const carLift =
    gameStarted
      ? comboBoost * 48
      : 0;

  const carScale =
    gameStarted
      ? 1 + comboBoost * 0.09
      : 1;

  const streakIntensity =
    gameStarted
      ? Math.min(
          1,
          0.45 +
            comboBoost * 0.45 +
            (beatPulse ? 0.18 : 0)
        )
      : beatPulse
        ? 0.95
        : 0.45;

  const rank =
    useMemo(() => {
      if (accuracy >= 95) return "S";
      if (accuracy >= 90) return "A";
      if (accuracy >= 80) return "B";
      if (accuracy >= 70) return "C";
      return "D";
    }, [accuracy]);

  const clearTimers =
    useCallback(() => {
      if (
        beatTimerRef.current !== null
      ) {
        window.clearInterval(
          beatTimerRef.current
        );

        beatTimerRef.current = null;
      }

      if (
        elapsedTimerRef.current !== null
      ) {
        window.clearInterval(
          elapsedTimerRef.current
        );

        elapsedTimerRef.current = null;
      }
    }, []);

  const showResult =
    useCallback(
      (
        text: string,
        accuracyText: string
      ) => {
        resultIdRef.current += 1;

        setHitResult({
          id: resultIdRef.current,
          text,
          accuracy: accuracyText,
        });

        window.setTimeout(() => {
          setHitResult((current) =>
            current?.id ===
            resultIdRef.current
              ? null
              : current
          );
        }, 450);
      },
      []
    );

  const pulseBeat =
    useCallback(() => {
      lastBeatRef.current =
        performance.now();

      setBeatPulse(true);

      window.setTimeout(() => {
        setBeatPulse(false);
      }, 120);
    }, []);

  const startTimers =
    useCallback(() => {
      clearTimers();

      lastBeatRef.current =
        performance.now();

      pulseBeat();

      beatTimerRef.current =
        window.setInterval(
          pulseBeat,
          beatIntervalMs
        );

      elapsedTimerRef.current =
        window.setInterval(() => {
          setElapsed(
            (current) => current + 1
          );
        }, 1000);
    }, [
      beatIntervalMs,
      clearTimers,
      pulseBeat,
    ]);

  const startGame =
    useCallback(() => {
      setScore(0);
      setCombo(0);
      setBestCombo(0);
      setHits(0);
      setMisses(0);
      setElapsed(0);
      setHitResult(null);
      setPaused(false);
      setGameStarted(true);

      startTimers();

      const audio =
        audioRef.current;

      if (audio) {
        audio.currentTime = 0;

        void audio.play().catch(() => {
          // Gameplay can continue without audio.
        });
      }
    }, [startTimers]);

  const togglePause =
    useCallback(() => {
      if (!gameStarted) {
        return;
      }

      if (paused) {
        setPaused(false);
        startTimers();

        void audioRef.current
          ?.play()
          .catch(() => {
            // Continue silently if autoplay is blocked.
          });

        return;
      }

      setPaused(true);
      clearTimers();
      audioRef.current?.pause();
    }, [
      clearTimers,
      gameStarted,
      paused,
      startTimers,
    ]);

  const endGame =
    useCallback(() => {
      clearTimers();

      audioRef.current?.pause();

      setPaused(false);
      setGameStarted(false);
      setBeatPulse(false);
    }, [clearTimers]);

  const registerTap =
    useCallback(() => {
      if (
        !gameStarted ||
        paused
      ) {
        return;
      }

      const now =
        performance.now();

      const sinceLast =
        now - lastBeatRef.current;

      const distanceToBeat =
        Math.min(
          sinceLast,
          Math.abs(
            beatIntervalMs - sinceLast
          )
        );

      let label = "MISS";
      let multiplier = 0;
      let accuracyText = "";

      if (
        distanceToBeat <=
        settings.tolerance * 0.32
      ) {
        label = "PERFECT";
        multiplier = 1.5;
        accuracyText =
          `${Math.round(distanceToBeat)}ms`;
      } else if (
        distanceToBeat <=
        settings.tolerance * 0.65
      ) {
        label = "GREAT";
        multiplier = 1.2;
        accuracyText =
          `${Math.round(distanceToBeat)}ms`;
      } else if (
        distanceToBeat <=
        settings.tolerance
      ) {
        label = "GOOD";
        multiplier = 1;
        accuracyText =
          `${Math.round(distanceToBeat)}ms`;
      }

      if (multiplier > 0) {
        const nextCombo =
          combo + 1;

        const comboBonus =
          Math.min(nextCombo, 20);

        const earned =
          Math.round(
            settings.points *
              multiplier +
              comboBonus * 2
          );

        setScore(
          (current) =>
            current + earned
        );

        setCombo(nextCombo);

        setBestCombo(
          (current) =>
            Math.max(
              current,
              nextCombo
            )
        );

        setHits(
          (current) => current + 1
        );

        showResult(
          label,
          `+${earned} • ${accuracyText}`
        );

        return;
      }

      setCombo(0);

      setMisses(
        (current) => current + 1
      );

      showResult(
        "MISS",
        "Find the beat"
      );
    }, [
      beatIntervalMs,
      combo,
      gameStarted,
      paused,
      settings.points,
      settings.tolerance,
      showResult,
    ]);

  useEffect(() => {
    function handleKeyDown(
      event: KeyboardEvent
    ) {
      if (
        event.code !== "Space"
      ) {
        return;
      }

      event.preventDefault();

      registerTap();
    }

    window.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [registerTap]);

  useEffect(() => {
    return () => {
      clearTimers();

      if (localAudioUrl) {
        URL.revokeObjectURL(
          localAudioUrl
        );
      }
    };
  }, [
    clearTimers,
    localAudioUrl,
  ]);

  function handleAudioFile(
    event:
      React.ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target.files?.[0];

    if (!file) {
      return;
    }

    if (
      !file.type.startsWith("audio/")
    ) {
      alert(
        "Choose an audio file such as WAV or MP3."
      );

      event.target.value = "";
      return;
    }

    if (localAudioUrl) {
      URL.revokeObjectURL(
        localAudioUrl
      );
    }

    const nextUrl =
      URL.createObjectURL(file);

    setLocalAudioUrl(nextUrl);
    setLocalAudioName(file.name);
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top, #281053 0%, #090612 45%, #040308 100%)",
        color: "#ffffff",
        padding:
          "24px 14px 80px",
        fontFamily:
          "Arial, Helvetica, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 620,
          margin: "0 auto",
        }}
      >
        <section
          style={{
            textAlign: "center",
            marginBottom: 22,
          }}
        >
          <div
            style={{
              color: "#36f1ff",
              fontWeight: 900,
              letterSpacing: 4,
              fontSize: 12,
              marginBottom: 10,
            }}
          >
            SOLO BEATS ENGINE MUSIC
          </div>

          <h1
            style={{
              margin: 0,
              fontSize:
                "clamp(30px, 9vw, 52px)",
              lineHeight: 1,
              fontWeight: 1000,
            }}
          >
            BEAT RUSH
          </h1>

          <p
            style={{
              color: "#b9afd2",
              margin:
                "12px auto 0",
              maxWidth: 480,
              lineHeight: 1.5,
            }}
          >
            Tap with the rhythm.
            Build your combo.
            Own the beat.
          </p>
        </section>

        <section
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(4, 1fr)",
            gap: 8,
            marginBottom: 14,
          }}
        >
          {[
            ["SCORE", score],
            ["COMBO", `${combo}x`],
            ["ACC", `${accuracy}%`],
            ["RANK", rank],
          ].map(
            ([label, value]) => (
              <div
                key={String(label)}
                style={{
                  background:
                    "rgba(17, 12, 31, 0.9)",
                  border:
                    "1px solid rgba(146, 91, 255, 0.32)",
                  borderRadius: 16,
                  textAlign: "center",
                  padding:
                    "13px 5px",
                }}
              >
                <div
                  style={{
                    color: "#887e9d",
                    fontSize: 10,
                    fontWeight: 900,
                    letterSpacing: 1,
                  }}
                >
                  {label}
                </div>

                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 1000,
                    marginTop: 5,
                  }}
                >
                  {value}
                </div>
              </div>
            )
          )}
        </section>

        <section
          style={{
            background:
              "rgba(13, 10, 24, 0.95)",
            border:
              "1px solid rgba(72, 229, 255, 0.22)",
            borderRadius: 24,
            overflow: "hidden",
            boxShadow:
              "0 24px 80px rgba(0,0,0,0.45)",
          }}
        >
          <div
            style={{
              padding: 18,
              borderBottom:
                "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent:
                  "space-between",
                alignItems: "center",
                gap: 12,
                flexWrap: "wrap",
              }}
            >
              <div>
                <div
                  style={{
                    color: "#36f1ff",
                    fontSize: 11,
                    fontWeight: 900,
                    letterSpacing: 2,
                  }}
                >
                  NOW PLAYING
                </div>

                <div
                  style={{
                    fontWeight: 900,
                    fontSize: 18,
                    marginTop: 5,
                  }}
                >
                  {localAudioName ||
                    "SOLO BEATS Training Beat"}
                </div>
              </div>

              <div
                style={{
                  color: "#afa5c4",
                  fontWeight: 800,
                }}
              >
                {settings.bpm} BPM
                {" • "}
                {formatTime(elapsed)}
              </div>
            </div>
          </div>

          <div
            style={{
              height: 390,
              position: "relative",
              overflow: "hidden",
              background:
                "linear-gradient(180deg, #0a0613 0%, #160b2c 55%, #090612 100%)",
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                backgroundImage:
                  "linear-gradient(rgba(104,55,194,.12) 1px, transparent 1px), linear-gradient(90deg, rgba(104,55,194,.12) 1px, transparent 1px)",
                backgroundSize:
                  "38px 38px",
                transform:
                  "perspective(300px) rotateX(54deg) scale(1.8)",
                transformOrigin:
                  "center bottom",
                opacity: 0.72,
              }}
            />

            <div
              style={{
                position: "absolute",
                left: "12%",
                right: "12%",
                bottom: 145,
                height: 70,
                pointerEvents: "none",
                opacity: streakIntensity,
                transition: "opacity 100ms ease-out",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  top: 14,
                  width: "42%",
                  height: 4,
                  borderRadius: 99,
                  background:
                    "linear-gradient(90deg, transparent, #36f1ff)",
                  boxShadow:
                    "0 0 18px rgba(54,241,255,.8)",
                }}
              />

              <div
                style={{
                  position: "absolute",
                  left: "6%",
                  top: 34,
                  width: "34%",
                  height: 3,
                  borderRadius: 99,
                  background:
                    "linear-gradient(90deg, transparent, #8d58ff)",
                  boxShadow:
                    "0 0 16px rgba(141,88,255,.7)",
                }}
              />

              <div
                style={{
                  position: "absolute",
                  right: 0,
                  top: 22,
                  width: "34%",
                  height: 4,
                  borderRadius: 99,
                  background:
                    "linear-gradient(90deg, #ff4df0, transparent)",
                  boxShadow:
                    "0 0 18px rgba(255,77,240,.75)",
                }}
              />
            </div>

            {/* BEAT_RUSH_RACING_CAR_THEME */}
            <div
              style={{
                position: "absolute",
                left: "50%",
                bottom: 92,
                transform: `translateX(-50%) translateY(${-carLift}px) scale(${carScale})`,
                width: "min(78%, 430px)",
                opacity: gameStarted ? 0.82 + comboBoost * 0.12 : 0.82,
                pointerEvents: "none",
                filter:
                  beatPulse
                    ? "drop-shadow(0 0 28px rgba(54, 241, 255, 0.95)) drop-shadow(0 0 52px rgba(141, 88, 255, 0.75))"
                    : "drop-shadow(0 0 18px rgba(54, 241, 255, 0.55)) drop-shadow(0 0 34px rgba(141, 88, 255, 0.42))",
              }}
            >
              <svg
                viewBox="0 0 900 320"
                style={{
                  display: "block",
                  width: "100%",
                  height: "auto",
                }}
              >
                <defs>
                  <linearGradient
                    id="carGlow"
                    x1="0%"
                    y1="0%"
                    x2="100%"
                    y2="0%"
                  >
                    <stop
                      offset="0%"
                      stopColor="#36f1ff"
                    />
                    <stop
                      offset="50%"
                      stopColor="#8d58ff"
                    />
                    <stop
                      offset="100%"
                      stopColor="#ff4df0"
                    />
                  </linearGradient>
                </defs>

                <path
                  d="M118 204 L188 164 C238 112 304 92 394 92 H554 C634 92 688 116 736 156 L818 170 C842 174 856 188 856 208 L856 232 H808 C800 274 764 304 718 304 C672 304 636 274 628 232 H294 C286 274 250 304 204 304 C158 304 122 274 114 232 H74 V214 C74 208 84 204 94 204 H118 Z"
                  fill="rgba(28, 18, 54, 0.35)"
                  stroke="url(#carGlow)"
                  strokeWidth="10"
                  strokeLinejoin="round"
                />

                <path
                  d="M250 160 L332 116 C354 104 388 98 425 98 H554 C612 98 652 114 689 147"
                  fill="none"
                  stroke="url(#carGlow)"
                  strokeWidth="9"
                  strokeLinecap="round"
                />

                <path
                  d="M327 118 H456"
                  fill="none"
                  stroke="url(#carGlow)"
                  strokeWidth="7"
                  strokeLinecap="round"
                  opacity="0.9"
                />

                <path
                  d="M485 118 H609"
                  fill="none"
                  stroke="url(#carGlow)"
                  strokeWidth="7"
                  strokeLinecap="round"
                  opacity="0.9"
                />

                <path
                  d="M95 195 H170"
                  fill="none"
                  stroke="#36f1ff"
                  strokeWidth="8"
                  strokeLinecap="round"
                  opacity="0.95"
                />

                <path
                  d="M770 176 H836"
                  fill="none"
                  stroke="#ff4df0"
                  strokeWidth="8"
                  strokeLinecap="round"
                  opacity="0.95"
                />

                <circle
                  cx="205"
                  cy="236"
                  r="47"
                  fill="rgba(10, 8, 22, 0.82)"
                  stroke="url(#carGlow)"
                  strokeWidth="10"
                />

                <circle
                  cx="205"
                  cy="236"
                  r="20"
                  fill="#141022"
                  stroke="#36f1ff"
                  strokeWidth="5"
                />

                <circle
                  cx="718"
                  cy="236"
                  r="47"
                  fill="rgba(10, 8, 22, 0.82)"
                  stroke="url(#carGlow)"
                  strokeWidth="10"
                />

                <circle
                  cx="718"
                  cy="236"
                  r="20"
                  fill="#141022"
                  stroke="#36f1ff"
                  strokeWidth="5"
                />

                <path
                  d="M118 218 L58 218"
                  fill="none"
                  stroke="#8d58ff"
                  strokeWidth="8"
                  strokeLinecap="round"
                  opacity="0.82"
                />

                <path
                  d="M90 240 L20 240"
                  fill="none"
                  stroke="#36f1ff"
                  strokeWidth="6"
                  strokeLinecap="round"
                  opacity="0.58"
                />

                <path
                  d="M845 206 L892 206"
                  fill="none"
                  stroke="#ff4df0"
                  strokeWidth="8"
                  strokeLinecap="round"
                  opacity="0.72"
                />
              </svg>
            </div>

            <div
              style={{
                position: "absolute",
                left: "50%",
                top: "31%",
                transform:
                  "translate(-50%, -50%)",
                width:
                  beatPulse
                    ? 150
                    : 112,
                height:
                  beatPulse
                    ? 150
                    : 112,
                borderRadius: "50%",
                background:
                  beatPulse
                    ? "rgba(54,241,255,0.3)"
                    : "rgba(140,75,255,0.12)",
                border:
                  beatPulse
                    ? "5px solid #36f1ff"
                    : "3px solid #8d58ff",
                boxShadow:
                  beatPulse
                    ? "0 0 65px #36f1ff"
                    : "0 0 35px rgba(141,88,255,.45)",
                transition:
                  "all 100ms ease-out",
              }}
            />

            {hitResult && (
              <div
                key={hitResult.id}
                style={{
                  position:
                    "absolute",
                  left: "50%",
                  top: "16%",
                  transform:
                    "translateX(-50%)",
                  textAlign:
                    "center",
                  pointerEvents:
                    "none",
                }}
              >
                <div
                  style={{
                    color:
                      hitResult.text ===
                      "MISS"
                        ? "#ff4f7b"
                        : "#36f1ff",
                    fontSize: 30,
                    fontWeight: 1000,
                    textShadow:
                      "0 0 22px currentColor",
                  }}
                >
                  {hitResult.text}
                </div>

                <div
                  style={{
                    marginTop: 4,
                    fontWeight: 800,
                    color: "#ffffff",
                  }}
                >
                  {hitResult.accuracy}
                </div>
              </div>
            )}

            <button
              type="button"
              disabled={
                !gameStarted ||
                paused
              }
              onPointerDown={
                registerTap
              }
              style={{
                position: "absolute",
                left: "50%",
                bottom: 28,
                transform:
                  "translateX(-50%)",
                width:
                  "min(78%, 390px)",
                height: 94,
                borderRadius: 28,
                border:
                  "2px solid rgba(255,255,255,.25)",
                background:
                  !gameStarted ||
                  paused
                    ? "#302b3c"
                    : "linear-gradient(135deg, #6b29ff, #d42cff)",
                color: "#ffffff",
                fontSize: 24,
                fontWeight: 1000,
                cursor:
                  gameStarted &&
                  !paused
                    ? "pointer"
                    : "not-allowed",
                boxShadow:
                  gameStarted &&
                  !paused
                    ? "0 12px 40px rgba(152,44,255,.45)"
                    : "none",
                touchAction: "none",
              }}
            >
              {!gameStarted
                ? "PRESS START"
                : paused
                  ? "PAUSED"
                  : "TAP"}
            </button>
          </div>

          <div
            style={{
              padding: 18,
              display: "grid",
              gap: 16,
            }}
          >
            <div>
              <label
                style={{
                  display: "block",
                  fontWeight: 900,
                  marginBottom: 8,
                }}
              >
                Difficulty
              </label>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(3, 1fr)",
                  gap: 8,
                }}
              >
                {(
                  [
                    "Easy",
                    "Normal",
                    "Hard",
                  ] as Difficulty[]
                ).map((item) => (
                  <button
                    type="button"
                    key={item}
                    onClick={() =>
                      setDifficulty(
                        item
                      )
                    }
                    style={{
                      border:
                        difficulty ===
                        item
                          ? "2px solid #36f1ff"
                          : "1px solid #403553",
                      background:
                        difficulty ===
                        item
                          ? "#241641"
                          : "#100c19",
                      color:
                        "#ffffff",
                      borderRadius: 13,
                      padding:
                        "12px 6px",
                      fontWeight: 900,
                      cursor: "pointer",
                    }}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label
                htmlFor="game-audio"
                style={{
                  display: "block",
                  fontWeight: 900,
                  marginBottom: 8,
                }}
              >
                Test with a SOLO BEATS song
              </label>

              <input
                id="game-audio"
                type="file"
                accept="audio/*,.wav,.mp3,.m4a,.aac"
                disabled={
                  gameStarted
                }
                onChange={
                  handleAudioFile
                }
                style={{
                  width: "100%",
                  boxSizing:
                    "border-box",
                  background:
                    "#100c19",
                  border:
                    "1px solid #403553",
                  borderRadius: 13,
                  color: "#ffffff",
                  padding: 12,
                }}
              />

              <div
                style={{
                  color: "#8f859e",
                  fontSize: 12,
                  marginTop: 7,
                }}
              >
                Prototype only:
                the selected song stays
                on this device and is not
                uploaded.
              </div>

              {localAudioUrl && (
                <audio
                  ref={audioRef}
                  src={localAudioUrl}
                  preload="metadata"
                  onEnded={endGame}
                />
              )}
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  gameStarted
                    ? "1fr 1fr"
                    : "1fr",
                gap: 10,
              }}
            >
              {!gameStarted ? (
                <button
                  type="button"
                  onClick={startGame}
                  style={{
                    border: 0,
                    borderRadius: 16,
                    padding:
                      "16px 18px",
                    background:
                      "linear-gradient(135deg, #25dce8, #8a45ff)",
                    color: "#07040d",
                    fontSize: 18,
                    fontWeight: 1000,
                    cursor: "pointer",
                  }}
                >
                  START GAME
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={
                      togglePause
                    }
                    style={{
                      border:
                        "1px solid #625675",
                      borderRadius: 16,
                      padding:
                        "15px 12px",
                      background:
                        "#171021",
                      color:
                        "#ffffff",
                      fontWeight: 900,
                      cursor:
                        "pointer",
                    }}
                  >
                    {paused
                      ? "RESUME"
                      : "PAUSE"}
                  </button>

                  <button
                    type="button"
                    onClick={endGame}
                    style={{
                      border:
                        "1px solid #ff4f7b",
                      borderRadius: 16,
                      padding:
                        "15px 12px",
                      background:
                        "#261019",
                      color:
                        "#ff8ca8",
                      fontWeight: 900,
                      cursor:
                        "pointer",
                    }}
                  >
                    END RUN
                  </button>
                </>
              )}
            </div>
          </div>
        </section>

        <section
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(3, 1fr)",
            gap: 10,
            marginTop: 14,
          }}
        >
          {[
            [
              "BEST COMBO",
              `${bestCombo}x`,
            ],
            ["HITS", hits],
            ["MISSES", misses],
          ].map(
            ([label, value]) => (
              <div
                key={String(label)}
                style={{
                  background:
                    "rgba(17,12,31,.82)",
                  border:
                    "1px solid rgba(255,255,255,.08)",
                  borderRadius: 16,
                  padding: 14,
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    color: "#8f859e",
                    fontSize: 10,
                    fontWeight: 900,
                  }}
                >
                  {label}
                </div>

                <div
                  style={{
                    marginTop: 5,
                    fontSize: 20,
                    fontWeight: 1000,
                  }}
                >
                  {value}
                </div>
              </div>
            )
          )}
        </section>

        <p
          style={{
            textAlign: "center",
            color: "#776d86",
            fontSize: 12,
            lineHeight: 1.5,
            marginTop: 18,
          }}
        >
          Mobile: tap the large button.
          Desktop: tap the button or
          press the Space bar.
        </p>
      </div>
    </main>
  );
}





