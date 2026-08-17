"use client";

import { useEffect, useRef, useState } from "react";

type Difficulty = "easy" | "normal" | "hard";

export default function PremiumRacingPage() {
  const [started, setStarted] = useState(false);
  const [difficulty, setDifficulty] =
    useState<Difficulty>("normal");
  const [speed, setSpeed] = useState(0);
  const [carX, setCarX] = useState(50);
  const keysRef = useRef<Record<string, boolean>>({});

  const difficultyConfig = {
    easy: {
      acceleration: 4,
      coastDrag: 0.7,
      brake: 6,
      steering: 3.2,
      label: "EASY",
    },
    normal: {
      acceleration: 3,
      coastDrag: 1,
      brake: 5,
      steering: 2.5,
      label: "NORMAL",
    },
    hard: {
      acceleration: 2.2,
      coastDrag: 1.4,
      brake: 4.5,
      steering: 1.9,
      label: "HARD",
    },
  } as const;

  const racePhysics =
    difficultyConfig[difficulty];

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      keysRef.current[event.key.toLowerCase()] = true;
    };

    const up = (event: KeyboardEvent) => {
      keysRef.current[event.key.toLowerCase()] = false;
    };

    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);

    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  useEffect(() => {
    if (!started) return;

    const timer = window.setInterval(() => {
      const keys = keysRef.current;

      setSpeed((current) => {
        let next = current;

        if (keys["arrowup"] || keys["w"]) {
          next += racePhysics.acceleration;
        } else {
          next -= racePhysics.coastDrag;
        }

        if (keys["arrowdown"] || keys["s"]) {
          next -= racePhysics.brake;
        }

        return Math.max(0, Math.min(220, next));
      });

      setCarX((current) => {
        let next = current;

        if (keys["arrowleft"] || keys["a"]) {
          next -= racePhysics.steering;
        }

        if (keys["arrowright"] || keys["d"]) {
          next += racePhysics.steering;
        }

        return Math.max(20, Math.min(80, next));
      });
    }, 40);

    return () => window.clearInterval(timer);
  }, [started, racePhysics]);

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top, #23133f 0%, #0b0712 45%, #050308 100%)",
        color: "#fff",
        padding: 24,
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ marginBottom: 18 }}>
          <div
            style={{
              color: "#36f1ff",
              fontSize: 13,
              fontWeight: 900,
              letterSpacing: 2,
            }}
          >
            SOLO BEATS ENGINE MUSIC
          </div>

          <h1 style={{ margin: "6px 0 4px", fontSize: 42 }}>
            NEON BEAT RACER
          </h1>

          <p style={{ margin: 0, color: "#a89db7" }}>
            Arrow keys or WASD to drive. Hold Up/W to accelerate.
          </p>
        </div>

        <section
          style={{
            position: "relative",
            height: 620,
            overflow: "hidden",
            borderRadius: 28,
            border: "1px solid rgba(255,255,255,.12)",
            background:
              "linear-gradient(180deg, #180d2b 0%, #130b20 22%, #09070d 100%)",
            boxShadow: "0 30px 80px rgba(0,0,0,.45)",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: "0 18%",
              background:
                "linear-gradient(90deg, #15121b 0%, #29232f 8%, #29232f 92%, #15121b 100%)",
              borderLeft: "4px solid #8a45ff",
              borderRight: "4px solid #36f1ff",
            }}
          />

          {[0, 1, 2, 3, 4, 5].map((lane) => (
            <div
              key={lane}
              style={{
                position: "absolute",
                left: "50%",
                top: `${lane * 120 - (speed % 120)}px`,
                width: 8,
                height: 70,
                transform: "translateX(-50%)",
                borderRadius: 99,
                background: "rgba(255,255,255,.75)",
              }}
            />
          ))}

          <div
            style={{
              position: "absolute",
              left: `${carX}%`,
              bottom: 56,
              transform: "translateX(-50%)",
              width: 82,
              height: 142,
              borderRadius: "34px 34px 20px 20px",
              background:
                "linear-gradient(180deg, #36f1ff 0%, #6d56ff 55%, #241641 100%)",
              boxShadow:
                speed > 120
                  ? "0 0 35px #36f1ff, 0 22px 50px rgba(138,69,255,.8)"
                  : "0 0 22px rgba(54,241,255,.7)",
              transition: "left 40ms linear",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: 16,
                right: 16,
                top: 20,
                height: 38,
                borderRadius: 12,
                background: "#0a1520",
                border: "2px solid rgba(255,255,255,.35)",
              }}
            />
          </div>

          <div
            style={{
              position: "absolute",
              top: 20,
              left: 20,
              padding: "12px 16px",
              borderRadius: 16,
              background: "rgba(8,5,13,.78)",
              border: "1px solid rgba(255,255,255,.12)",
              backdropFilter: "blur(12px)",
            }}
          >
            <div style={{ color: "#92879f", fontSize: 11, fontWeight: 900 }}>
              SPEED
            </div>
            <div style={{ fontSize: 30, fontWeight: 1000 }}>
              {Math.round(speed)} MPH
            </div>
          </div>

          <div
            style={{
              position: "absolute",
              right: 22,
              top: 22,
              zIndex: 20,
              display: "flex",
              gap: 8,
              padding: 8,
              borderRadius: 14,
              background: "rgba(8,5,13,.82)",
              border:
                "1px solid rgba(255,255,255,.12)",
              backdropFilter: "blur(12px)",
            }}
          >
            {(
              [
                ["easy", "EASY"],
                ["normal", "NORMAL"],
                ["hard", "HARD"],
              ] as const
            ).map(([value, label]) => {
              const active =
                difficulty === value;

              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setDifficulty(value);
                    setSpeed(0);
                    setCarX(50);
                  }}
                  style={{
                    border: active
                      ? "1px solid #36f1ff"
                      : "1px solid rgba(255,255,255,.16)",
                    borderRadius: 10,
                    padding: "9px 12px",
                    cursor: "pointer",
                    fontWeight: 900,
                    fontSize: 11,
                    letterSpacing: 1,
                    color: active
                      ? "#08050d"
                      : "#ffffff",
                    background: active
                      ? "linear-gradient(135deg, #36f1ff, #8a45ff)"
                      : "rgba(255,255,255,.06)",
                    boxShadow: active
                      ? "0 0 18px rgba(54,241,255,.4)"
                      : "none",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
          {!started && (
            <button
              type="button"
              onClick={() => {
                setSpeed(0);
                setCarX(50);
                setStarted(true);
              }}
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                transform: "translate(-50%, -50%)",
                border: 0,
                borderRadius: 18,
                padding: "18px 28px",
                background:
                  "linear-gradient(135deg, #36f1ff, #8a45ff)",
                color: "#08050d",
                fontSize: 18,
                fontWeight: 1000,
                cursor: "pointer",
              }}
            >
              START RACE
            </button>
          )}
        </section>
      </div>
    </main>
  );
}

