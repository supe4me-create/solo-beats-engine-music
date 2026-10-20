"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { TurntableEngine } from "./engine";
import OwnerMixBroadcast from "./OwnerMixBroadcast";

import StemMixerFoundation from "./StemMixerFoundation";
type Access = { allowed: boolean; owner: boolean; email?: string };
const time = (seconds: number) => {
  const value = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  return Math.floor(value / 60) + ":" + String(value % 60).padStart(2, "0");
};
const button = "rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-sm font-bold hover:bg-white/10 disabled:opacity-40";
const panel = "rounded-3xl border border-white/15 bg-[#101425] p-5";

// SOLO_MIXER_MEMORY_V1
const MIXER_MEMORY_KEY =
  "solo-beats-turntable-mixer-v1";

type MixerMemory = {
  deckA?: number;
  deckB?: number;
  mic?: number;
  input?: number;
  master?: number;
  talkover?: number;
};

function readMixerMemory(): MixerMemory {
  try {
    const raw =
      window.localStorage.getItem(
        MIXER_MEMORY_KEY
      );

    if (!raw) return {};

    const parsed =
      JSON.parse(raw) as MixerMemory;

    return parsed &&
      typeof parsed === "object"
      ? parsed
      : {};
  } catch {
    return {};
  }
}

function saveMixerMemory(
  update: MixerMemory
) {
  try {
    window.localStorage.setItem(
      MIXER_MEMORY_KEY,
      JSON.stringify({
        ...readMixerMemory(),
        ...update,
      })
    );
  } catch {
    // The mixer continues working if browser storage is unavailable.
  }
}

function restoreMixerMemory(
  engine: TurntableEngine
) {
  const saved = readMixerMemory();

  const clamp = (
    value: unknown,
    minimum: number,
    maximum: number,
    fallback: number
  ) =>
    typeof value === "number" &&
    Number.isFinite(value)
      ? Math.max(
          minimum,
          Math.min(maximum, value)
        )
      : fallback;

  const deckA = clamp(
    saved.deckA,
    0,
    1.2,
    1
  );

  const deckB = clamp(
    saved.deckB,
    0,
    1.2,
    1
  );

  engine.decks[0].level.gain.value =
    deckA;

  engine.decks[1].level.gain.value =
    deckB;

  engine.micVolume = clamp(
    saved.mic,
    0,
    1.5,
    engine.micVolume
  );

  engine.instrumentVolume = clamp(
    saved.input,
    0,
    1.5,
    engine.instrumentVolume
  );

  engine.volume = clamp(
    saved.master,
    0,
    1,
    engine.volume
  );

  engine.monitor.gain.value =
    engine.muted
      ? 0
      : engine.volume;

  // SOLO_REAL_MASTER_V6
  // MASTER now controls recording / GO LIVE MIX level too.
  engine.master.gain.value = engine.volume;

  engine.talkoverAmount = clamp(
    saved.talkover,
    0,
    1,
    engine.talkoverAmount
  );
}

export default function TurntablePage() {
  const { user, loading } = useAuth();
  const engineRef = useRef<TurntableEngine | null>(null);
  const alive = useRef(true);
  const [access, setAccess] = useState<Access | null>(null);
  const [accessMessage, setAccessMessage] = useState("Checking DJ access...");
  const [message, setMessage] = useState("Enable audio, then add MP3 or WAV files.");
  const [busy, setBusy] = useState(false);
  const [outputs, setOutputs] = useState<MediaDeviceInfo[]>([]);
  const [headphoneId, setHeadphoneId] = useState("");
  const [inputs, setInputs] = useState<MediaDeviceInfo[]>([]);
  const [instrumentInputId, setInstrumentInputId] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [, redraw] = useState(0);

  useEffect(() => {
    alive.current = true;
    const timer = window.setInterval(() => redraw(value => value + 1), 250);
    const warn = (event: BeforeUnloadEvent) => {
      async function findInstrumentInputs() {
    await run(async () => {
      const permissionStream =
        await navigator.mediaDevices.getUserMedia({
          audio: true,
        });

      permissionStream
        .getTracks()
        .forEach(track => track.stop());

      const devices =
        await navigator.mediaDevices.enumerateDevices();

      const audioInputs =
        devices.filter(device =>
          device.kind === "audioinput" &&
          Boolean(device.deviceId)
        );

      setInputs(audioInputs);

      setMessage(
        audioInputs.length
          ? "Audio inputs found. Select your Scarlett or instrument interface."
          : "No audio inputs were found. Connect the interface and try again."
      );
    });
  }

  const engine = engineRef.current;
      if (engine && (!engine.saved || engine.recording)) event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => {
      alive.current = false;
      window.clearInterval(timer);
      window.removeEventListener("beforeunload", warn);
      void engineRef.current?.dispose();
    };
  }, []);

  useEffect(() => {
    let cancelled = false, running = false;
    setAccess(null);
    if (engineRef.current) {
      engineRef.current.enabled = false;
      void engineRef.current.stopAll();
    }
    async function check() {
      if (loading || running) return;
      if (!user) { setAccessMessage("Sign in with your approved DJ or owner account."); return; }
      running = true;
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 10000);
      try {
        const token = await user.getIdToken();
        const response = await fetch("/api/dj/access", {
          headers: { Authorization: "Bearer " + token },
          cache: "no-store", signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error || "Could not verify DJ access.");
        if (cancelled) return;
        setAccess(data);
        setAccessMessage(data.allowed ? "" : (data.reason || "DJ access is not active. Request approval in the DJ Workspace."));
        if (engineRef.current) {
          engineRef.current.enabled = data.allowed === true;
          if (!data.allowed) void engineRef.current.stopAll();
        }
      } catch (error) {
        if (!cancelled) {
          setAccess(null);
          setAccessMessage(error instanceof Error ? error.message : "Access check failed.");
          if (engineRef.current) {
            engineRef.current.enabled = false;
            void engineRef.current.stopAll();
          }
        }
      } finally { window.clearTimeout(timeout); running = false; }
    }
    void check();
    const timer = window.setInterval(() => { void check(); }, 10000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [user, loading, refresh]);

  async function run(action: (engine: TurntableEngine) => void | Promise<void>) {
    if (busy || !access?.allowed) return;
    setBusy(true);
    try {
      if (!engineRef.current) {
        engineRef.current = new TurntableEngine(value => { if (alive.current) setMessage(value); });
        restoreMixerMemory(engineRef.current);
      }
      await engineRef.current.resume();
      await action(engineRef.current);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Audio operation failed.");
    } finally { setBusy(false); redraw(value => value + 1); }
  }

  async function findOutputs() {
    await run(async () => {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      const devices = await navigator.mediaDevices.enumerateDevices();
      setOutputs(devices.filter(device =>
        device.kind === "audiooutput" && device.deviceId &&
        device.deviceId !== "default" && device.deviceId !== "communications"
      ));
      setMessage("Select your headphone device. Verify it is separate from the master speakers.");
    });
  }

  async function findInstrumentInputs() {
    await run(async () => {
      const permissionStream =
        await navigator.mediaDevices.getUserMedia({
          audio: true,
        });

      permissionStream
        .getTracks()
        .forEach(track => track.stop());

      const devices =
        await navigator.mediaDevices.enumerateDevices();

      const audioInputs =
        devices.filter(device =>
          device.kind === "audioinput" &&
          Boolean(device.deviceId)
        );

      setInputs(audioInputs);

      setMessage(
        audioInputs.length
          ? "Audio inputs found. Select your Scarlett or instrument interface."
          : "No audio inputs were found. Connect the interface and try again."
      );
    });
  }

  const engine = engineRef.current;
  const files = engine?.files || [];
  const locked = !access?.allowed || busy || !engine;

  return (
    <main className="mx-auto max-w-7xl px-5 pb-24 pt-52 text-white">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black tracking-[0.25em] text-cyan-300">SOLO BEATS ENGINE MUSIC</p>
          <h1 className="mt-3 text-4xl font-black sm:text-5xl">Digital Turntable</h1>
          <p className="mt-3 text-white/60">{access?.owner ? "Owner console" : "DJ console"}  - Two decks  - Stereo WAV recording</p>
        </div>
        <Link className={button} href="/dj/radio">DJ Workspace / Access</Link>
      </div>

      <div className="my-6 rounded-2xl border border-cyan-300/30 bg-cyan-300/10 p-4">
        <p className="font-black text-cyan-200">
          SOLO BEATS DJ TURNTABLE
        </p>

        <p className="mt-2 text-sm text-white/75">
          Load your tracks, enable turntable audio, and mix with Deck A and Deck B.
          Your DJ access remains active only while your approved access period is valid.
          Recording and DJ tools are available according to your account permissions.
        </p>

        {access?.allowed && (
          <p
            className={
              "mt-2 text-sm " +
              (access?.owner
                ? "text-amber-200"
                : "text-emerald-200")
            }
          >
            {access?.owner
              ? "Owner broadcast controls are enabled below. End any active broadcast before leaving this page."
              : "Your active DJ access includes SOLO BEATS Radio live broadcast controls below. Only one broadcaster can be live at a time."}
          </p>
        )}
      </div>

      {access?.allowed && (
        <OwnerMixBroadcast
          owner={access?.owner === true}
          getAuthToken={async () => {
            if (!user) {
              throw new Error("Sign in is required.");
            }

            return await user.getIdToken(true);
          }}
          micLive={engine?.micLive === true}
          onToggleMic={async () => {
            const current = engineRef.current;

            if (!current || !current.enabled) {
              throw new Error(
                "Press Resume audio before activating the microphone."
              );
            }

            await current.setMicLive(!current.micLive);
          }}
          getMixTrack={async () => {
            const current = engineRef.current;
            if (!current || !current.enabled) {
              throw new Error("Enable audio and load a deck first.");
            }
            const deckPlaying =
              current.decks.some(deck =>
                !deck.audio.paused &&
                !deck.audio.ended
              );

            if (
              !deckPlaying &&
              !current.micLive &&
              !current.instrumentLive &&
              !current.youtubeCaptureActive
            ) {
              throw new Error(
                "Play a deck, activate MIC LIVE, activate INPUT LIVE, or capture YouTube tab audio first."
              );
            }

            await current.resume();

            const track = current.output.stream.getAudioTracks()[0];
            if (!track || track.readyState !== "live") {
              throw new Error("The mixer audio output is not ready.");
            }

            return track.clone();
          }}
          onLiveStarted={async () => {
            const current = engineRef.current;

            if (
              current?.autoRecord &&
              !current.recording &&
              !current.finishing
            ) {
              if (!current.saved) {
                throw new Error(
                  "Download the previous session WAV before starting another recorded live session."
                );
              }

              await current.startRecording();

              setMessage(
                "SESSION RECORDING: ON. Your live master mix is being recorded."
              );
            }
          }}
          onLiveEnded={async () => {
            const current = engineRef.current;

            if (current?.recording || current?.finishing) {
              await current.finishRecording();

              setMessage(
                "Live mix ended. The recorded session has been finalized and is ready to download."
              );
            }
          }}
        />
      )}

      {accessMessage && (
        <div role="alert" className="mb-6 rounded-2xl border border-red-300/30 p-4">
          <p>{accessMessage}</p>
          <button className={button + " mt-3"} onClick={() => setRefresh(value => value + 1)}>Check access again</button>
          {!user && <Link href="/account" className="ml-4 text-cyan-300 underline">Sign in</Link>}
        </div>
      )}

      <section className={panel + " mb-6"}>
        <div className="flex flex-wrap items-center gap-3">
          <button className={button + " bg-cyan-300/20"} disabled={!access?.allowed || busy}
            onClick={() => void run(() => setMessage("Audio enabled. Add tracks to begin."))}>
            {engine ? "Resume audio" : "Enable turntable audio"}
          </button>
          <label className={button + (locked ? " opacity-40" : " cursor-pointer")}>
            Add local tracks
            <input className="sr-only" type="file" accept="audio/*,.mp3,.wav,.m4a,.ogg,.flac" multiple disabled={locked}
              onChange={event => {
                const selected = Array.from(event.target.files || []);
                if (!engine || !selected.length) return;
                engine.stopAuto();
                engine.files = [...engine.files, ...selected].slice(0, 100);
                setMessage(engine.files.length + " tracks in this session. Files are not uploaded.");
                event.target.value = "";
                redraw(value => value + 1);
              }} />
          </label>
          <button className={button} disabled={locked || files.length < 2} onClick={() => {
            if (!engine) return;
            engine.stopAuto();
            for (let i = files.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [files[i], files[j]] = [files[j], files[i]];
            }
            engine.cursor = 0; redraw(value => value + 1);
          }}>Shuffle session</button>
          <span className="text-sm text-white/60">{files.length}/100 tracks  - Session resets when you leave</span>
        </div>
      </section>

      <fieldset disabled={locked} className="grid gap-5 lg:grid-cols-2">
        {[0, 1].map(side => {
          const deck = engine?.decks[side];
          const playing = deck && !deck.audio.paused;
          const duration = Number.isFinite(deck?.audio.duration) ? deck!.audio.duration : 0;
          return (
            <section key={side} className={panel}>
              <div className="flex items-center justify-between">
                <h2 className={"text-2xl font-black " + (side ? "text-violet-300" : "text-cyan-300")}>DECK {side ? "B" : "A"}</h2>
                <span className="text-xs font-bold text-white/60">{playing ? "PLAYING" : "STOPPED"}</span>
              </div>
              <select aria-label={"Track for deck " + (side ? "B" : "A")}
                className="mt-4 w-full rounded-xl border border-white/20 bg-[#080b16] p-3"
                value={deck?.file ? files.indexOf(deck.file) : -1}
                onChange={event => {
                  const file = files[Number(event.target.value)];
                  if (!engine || !file) return;
                  if (playing && !window.confirm("Replace the playing track on this deck?")) return;
                  engine.stopAuto(); engine.load(side, file); redraw(value => value + 1);
                }}>
                <option value={-1}>Choose a track</option>
                {files.map((file, index) => <option key={index} value={index}>{index + 1}. {file.name}</option>)}
              </select>

              <div className="my-5 flex items-center justify-center gap-6">
                <div className="solo-platter" style={{ animationPlayState: playing ? "running" : "paused" }}>
                  <div className={"grid h-20 w-20 place-items-center rounded-full border-4 border-black/50 font-black text-black " +
                    (side ? "bg-violet-300" : "bg-cyan-300")}>SOLO<br />{side ? "B" : "A"}</div>
                </div>
                <div className="font-mono">
                  <p className="text-3xl font-bold">{time(deck?.audio.currentTime || 0)}</p>
                  <p className="mt-2 text-white/45">/ {time(duration)}</p>
                  <p className="mt-3 text-xs text-white/50">CUE {time(deck?.cuePoint || 0)}</p>
                </div>
              </div>

              <input aria-label={"Seek deck " + side} className="w-full accent-cyan-300" type="range"
                min={0} max={Math.max(1, duration)} step={0.1} value={Math.min(duration, deck?.audio.currentTime || 0)}
                disabled={locked || !duration}
                onChange={event => { if (engine && deck) { engine.stopAuto(); deck.audio.currentTime = Number(event.target.value); } }} />

              <div className="mt-4 flex flex-wrap gap-2">
                <button className={button + " bg-cyan-300/15"} onClick={() => void run(async e => {
                  e.stopAuto();
                  if (playing) e.decks[side].audio.pause(); else await e.play(side);
                })}>{playing ? "Pause" : "Play"}</button>
                <button className={button} onClick={() => { if (deck) deck.cuePoint = deck.audio.currentTime; }}>Set cue</button>
                <button className={button} onClick={() => {
                  if (engine && deck && duration) { engine.stopAuto(); deck.audio.pause(); deck.audio.currentTime = Math.min(deck.cuePoint, duration); }
                }}>Return cue</button>
                {[-0.25, 0.25].map(offset => (
                  <button key={offset} className={button} onClick={() => {
                    if (engine && deck && duration) {
                      engine.stopAuto(); deck.audio.currentTime = Math.max(0, Math.min(duration, deck.audio.currentTime + offset));
                    }
                  }}>{offset < 0 ? "Jog -" : "Jog +"}</button>
                ))}
                <button className={button + (deck?.cueOn ? " bg-amber-300/25" : "")}
                  disabled={locked || !engine?.cueReady}
                  onClick={() => { try { engine?.setCue(side); } catch (e) { setMessage(String(e)); } }}>
                  {deck?.cueOn ? "Headphone cue ON" : "Headphone cue"}
                </button>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="text-sm">Tempo: {((deck?.audio.playbackRate || 1) * 100).toFixed(1)}%
                  <input className="mt-2 w-full" type="range" min={80} max={120} step={0.1}
                    value={(deck?.audio.playbackRate || 1) * 100}
                    onChange={event => { if (deck) deck.audio.playbackRate = Number(event.target.value) / 100; }} />
                </label>
                <label className="text-sm">Channel level
                  <input className="mt-2 w-full" type="range" min={0} max={1.2} step={0.01}
                    value={deck?.level.gain.value ?? 1}
                    onChange={event => {
                      if (!deck) return;
                      const value = Number(event.target.value);
                      deck.level.gain.value = value;
                      saveMixerMemory(
                        side === 0
                          ? { deckA: value }
                          : { deckB: value }
                      );
                    }} />
                </label>
              </div>
              <label className="mt-3 flex items-center gap-2 text-sm text-white/70">
                <input type="checkbox" checked={deck?.audio.preservesPitch ?? true}
                  onChange={event => { if (deck) deck.audio.preservesPitch = event.target.checked; }} />
                Keep pitch when changing tempo
              </label>
              <div className="mt-5 grid grid-cols-3 gap-4">
                {["Low", "Mid", "High"].map((name, band) => (
                  <label key={name} className="text-sm text-white/70">{name} EQ  - {deck?.eq[band].gain.value.toFixed(0) || 0} dB
                    <input className="mt-2 w-full" type="range" min={-12} max={12} step={1}
                      value={deck?.eq[band].gain.value || 0}
                      onChange={event => { if (deck) deck.eq[band].gain.value = Number(event.target.value); }} />
                  </label>
                ))}
              </div>
            </section>
          );
        })}
      </fieldset>

      {/* SOLO_STUDIO_CONSOLE_V1 */}
      <section className="mt-6 overflow-hidden rounded-3xl border border-white/15 bg-[#090d17] shadow-2xl">
        <div className="border-b border-white/10 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 px-6 py-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black tracking-[0.35em] text-cyan-300">
                SOLO BEATS ENGINE MUSIC
              </p>

              <h2 className="mt-2 text-3xl font-black">
                STUDIO MIXER CONSOLE
              </h2>

              <p className="mt-1 text-sm text-white/50">
                Deck A  - Deck B  - Microphone  - Instrument Input  - Master Program
              </p>

              <p className="mt-2 text-xs text-emerald-300/70">
                Live VU metering  - microphone talkover  - Scarlett/instrument input  - master monitoring
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/30 px-4 py-2 font-mono text-xs text-emerald-300">
              DIGITAL PROGRAM BUS
            </div>
          </div>
        </div>

        <div className="grid gap-px bg-white/10 md:grid-cols-2 xl:grid-cols-5">

          {/* ================= DECK A ================= */}
          <div className="bg-[#0d1220] p-5">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-black tracking-[0.25em] text-cyan-300">
                  CHANNEL 1
                </p>
                <h3 className="text-xl font-black">DECK A</h3>
              </div>

              <span className={
                "rounded-full px-3 py-1 text-xs font-black " +
                (engine && !engine.decks[0].audio.paused
                  ? "bg-emerald-400/20 text-emerald-300"
                  : "bg-white/5 text-white/40")
              }>
                {engine && !engine.decks[0].audio.paused ? "ACTIVE" : "IDLE"}
              </span>
            </div>

            <div className="mb-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={locked}
                onClick={() => {
                  if (!engine) return;
                  engine.setDeckMuted(
                    0,
                    !engine.deckMuted[0]
                  );
                }}
                className={
                  button +
                  (engine?.deckMuted[0]
                    ? " bg-red-500/20 text-red-200"
                    : "")
                }
              >
                {engine?.deckMuted[0]
                  ? "UNMUTE"
                  : "MUTE"}
              </button>

              <button
                type="button"
                disabled={locked || !engine?.cueReady}
                onClick={() => {
                  try {
                    engine?.setCue(0);
                  } catch (error) {
                    setMessage(String(error));
                  }
                }}
                className={
                  button +
                  (engine?.decks[0].cueOn
                    ? " bg-amber-300/20"
                    : "")
                }
              >
                CUE
              </button>
            </div>

            <div className="mb-5 flex h-28 items-end gap-1 rounded-xl border border-white/10 bg-black/25 p-3">
              {Array.from({ length: 18 }).map((_, index) => {
                const level =
                  engine?.meterData.deckA || 0;

                const active =
                  index <
                  Math.round(level * 18);

                return (
                  <div
                    key={index}
                    className={
                      "flex-1 rounded-sm transition-all " +
                      (active
                        ? index > 15
                          ? "bg-red-400"
                          : index > 11
                            ? "bg-amber-300"
                            : "bg-emerald-400"
                        : "bg-white/10")
                    }
                    style={{
                      height:
                        10 +
                        index * 4,
                    }}
                  />
                );
              })}
            </div>
            <div className="space-y-4">
              {["LOW", "MID", "HIGH"].map((label, band) => (
                <label key={label} className="block">
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="font-black text-white/60">{label}</span>
                    <span className="font-mono text-cyan-200">
                      {engine?.decks[0].eq[band].gain.value.toFixed(0) || 0} dB
                    </span>
                  </div>

                  <input
                    className="w-full"
                    type="range"
                    min={-12}
                    max={12}
                    step={1}
                    disabled={locked}
                    value={engine?.decks[0].eq[band].gain.value || 0}
                    onChange={event => {
                      if (engine) {
                        engine.decks[0].eq[band].gain.value =
                          Number(event.target.value);
                      }
                    }}
                  />
                </label>
              ))}
            </div>

            <div className="mt-6 rounded-2xl border border-white/10 bg-black/25 p-4">
              <div className="flex h-56 items-center justify-center gap-6">
                <div className="flex h-full flex-col justify-between text-[10px] text-white/35">
                  <span>+6</span>
                  <span>0</span>
                  <span>-12</span>
                  <span>-Ã¢Ë†Å¾</span>
                </div>

                <input
                  aria-label="Deck A studio fader"
                  type="range"
                  min={0}
                  max={1.2}
                  step={0.01}
                  disabled={locked}
                  value={engine?.decks[0].level.gain.value ?? 1}
                  onChange={event => {
                    if (engine) {
                      const value =
                        Number(event.target.value);

                      engine.decks[0].level.gain.value =
                        value;

                      saveMixerMemory({
                        deckA: value,
                      });
                    }
                  }}
                  style={{
                    writingMode: "vertical-lr",
                    direction: "rtl",
                    height: 210,
                  }}
                />
              </div>

              <p className="mt-3 text-center text-xs font-black tracking-wider text-cyan-300">
                DECK A VOLUME: {Math.round(
                  (engine?.decks[0].level.gain.value ?? 1) * 100
                )}%
              </p>
            </div>
          </div>

          {/* ================= DECK B ================= */}
          <div className="bg-[#0d1220] p-5">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-black tracking-[0.25em] text-violet-300">
                  CHANNEL 2
                </p>
                <h3 className="text-xl font-black">DECK B</h3>
              </div>

              <span className={
                "rounded-full px-3 py-1 text-xs font-black " +
                (engine && !engine.decks[1].audio.paused
                  ? "bg-emerald-400/20 text-emerald-300"
                  : "bg-white/5 text-white/40")
              }>
                {engine && !engine.decks[1].audio.paused ? "ACTIVE" : "IDLE"}
              </span>
            </div>

            <div className="mb-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={locked}
                onClick={() => {
                  if (!engine) return;
                  engine.setDeckMuted(
                    0,
                    !engine.deckMuted[0]
                  );
                }}
                className={
                  button +
                  (engine?.deckMuted[0]
                    ? " bg-red-500/20 text-red-200"
                    : "")
                }
              >
                {engine?.deckMuted[0]
                  ? "UNMUTE"
                  : "MUTE"}
              </button>

              <button
                type="button"
                disabled={locked || !engine?.cueReady}
                onClick={() => {
                  try {
                    engine?.setCue(0);
                  } catch (error) {
                    setMessage(String(error));
                  }
                }}
                className={
                  button +
                  (engine?.decks[0].cueOn
                    ? " bg-amber-300/20"
                    : "")
                }
              >
                CUE
              </button>
            </div>

            <div className="mb-5 flex h-28 items-end gap-1 rounded-xl border border-white/10 bg-black/25 p-3">
              {Array.from({ length: 18 }).map((_, index) => {
                const level =
                  engine?.meterData.deckA || 0;

                const active =
                  index <
                  Math.round(level * 18);

                return (
                  <div
                    key={index}
                    className={
                      "flex-1 rounded-sm transition-all " +
                      (active
                        ? index > 15
                          ? "bg-red-400"
                          : index > 11
                            ? "bg-amber-300"
                            : "bg-emerald-400"
                        : "bg-white/10")
                    }
                    style={{
                      height:
                        10 +
                        index * 4,
                    }}
                  />
                );
              })}
            </div>
            <div className="mb-5 grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={locked}
                onClick={() => {
                  if (!engine) return;
                  engine.setDeckMuted(
                    1,
                    !engine.deckMuted[1]
                  );
                }}
                className={
                  button +
                  (engine?.deckMuted[1]
                    ? " bg-red-500/20 text-red-200"
                    : "")
                }
              >
                {engine?.deckMuted[1]
                  ? "UNMUTE"
                  : "MUTE"}
              </button>

              <button
                type="button"
                disabled={locked || !engine?.cueReady}
                onClick={() => {
                  try {
                    engine?.setCue(1);
                  } catch (error) {
                    setMessage(String(error));
                  }
                }}
                className={
                  button +
                  (engine?.decks[1].cueOn
                    ? " bg-amber-300/20"
                    : "")
                }
              >
                CUE
              </button>
            </div>

            <div className="mb-5 flex h-28 items-end gap-1 rounded-xl border border-white/10 bg-black/25 p-3">
              {Array.from({ length: 18 }).map((_, index) => {
                const level =
                  engine?.meterData.deckB || 0;

                const active =
                  index <
                  Math.round(level * 18);

                return (
                  <div
                    key={index}
                    className={
                      "flex-1 rounded-sm transition-all " +
                      (active
                        ? index > 15
                          ? "bg-red-400"
                          : index > 11
                            ? "bg-amber-300"
                            : "bg-violet-400"
                        : "bg-white/10")
                    }
                    style={{
                      height:
                        10 +
                        index * 4,
                    }}
                  />
                );
              })}
            </div>
            <div className="space-y-4">
              {["LOW", "MID", "HIGH"].map((label, band) => (
                <label key={label} className="block">
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="font-black text-white/60">{label}</span>
                    <span className="font-mono text-violet-200">
                      {engine?.decks[1].eq[band].gain.value.toFixed(0) || 0} dB
                    </span>
                  </div>

                  <input
                    className="w-full"
                    type="range"
                    min={-12}
                    max={12}
                    step={1}
                    disabled={locked}
                    value={engine?.decks[1].eq[band].gain.value || 0}
                    onChange={event => {
                      if (engine) {
                        engine.decks[1].eq[band].gain.value =
                          Number(event.target.value);
                      }
                    }}
                  />
                </label>
              ))}
            </div>

            <div className="mt-6 rounded-2xl border border-white/10 bg-black/25 p-4">
              <div className="flex h-56 items-center justify-center gap-6">
                <div className="flex h-full flex-col justify-between text-[10px] text-white/35">
                  <span>+6</span>
                  <span>0</span>
                  <span>-12</span>
                  <span>-Ã¢Ë†Å¾</span>
                </div>

                <input
                  aria-label="Deck B studio fader"
                  type="range"
                  min={0}
                  max={1.2}
                  step={0.01}
                  disabled={locked}
                  value={engine?.decks[1].level.gain.value ?? 1}
                  onChange={event => {
                    if (engine) {
                      const value =
                        Number(event.target.value);

                      engine.decks[1].level.gain.value =
                        value;

                      saveMixerMemory({
                        deckB: value,
                      });
                    }
                  }}
                  style={{
                    writingMode: "vertical-lr",
                    direction: "rtl",
                    height: 210,
                  }}
                />
              </div>

              <p className="mt-3 text-center text-xs font-black tracking-wider text-violet-300">
                DECK B VOLUME: {Math.round(
                  (engine?.decks[1].level.gain.value ?? 1) * 100
                )}%
              </p>
            </div>
          </div>

          {/* ================= MICROPHONE ================= */}
          <div className="bg-[#10120d] p-5">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-black tracking-[0.25em] text-amber-300">
                  CHANNEL 3
                </p>
                <h3 className="text-xl font-black">MIC</h3>
              </div>

              <span className={
                "rounded-full px-3 py-1 text-xs font-black " +
                (engine?.micLive
                  ? "bg-red-500/25 text-red-300"
                  : "bg-white/5 text-white/40")
              }>
                {engine?.micLive ? "LIVE" : "OFF"}
              </span>
            </div>

            <p className="min-h-12 text-sm text-white/55">
              Live microphone enters the same program bus as the decks.
            </p>

            <div className="mb-4 flex h-28 items-end gap-1 rounded-xl border border-white/10 bg-black/25 p-3">
              {Array.from({ length: 18 }).map((_, index) => {
                const level =
                  engine?.meterData.mic || 0;

                const active =
                  index <
                  Math.round(level * 18);

                return (
                  <div
                    key={index}
                    className={
                      "flex-1 rounded-sm transition-all " +
                      (active
                        ? index > 15
                          ? "bg-red-400"
                          : index > 11
                            ? "bg-amber-300"
                            : "bg-emerald-400"
                        : "bg-white/10")
                    }
                    style={{
                      height:
                        10 +
                        index * 4,
                    }}
                  />
                );
              })}
            </div>

            <div className="mb-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={locked}
                className={
                  button +
                  (engine?.talkover
                    ? " bg-amber-300/20 text-amber-200"
                    : "")
                }
                onClick={() => {
                  engine?.setTalkover(
                    !engine.talkover
                  );
                }}
              >
                {engine?.talkover
                  ? "TALKOVER ON"
                  : "TALKOVER OFF"}
              </button>

              <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-center text-xs font-black text-white/50">
                DECK LEVEL {Math.round(
                  (engine?.talkoverAmount ?? 0.28) * 100
                )}%
              </div>
            </div>

            <label className="mb-4 block rounded-xl border border-amber-300/15 bg-black/20 p-3 text-xs font-black text-amber-200">
              TALKOVER MUSIC LEVEL: {Math.round(
                (engine?.talkoverAmount ?? 0.28) * 100
              )}%

              <input
                aria-label="Talkover music level"
                className="mt-3 w-full accent-amber-300"
                type="range"
                min={0}
                max={1}
                step={0.01}
                disabled={locked}
                value={
                  engine?.talkoverAmount ??
                  0.28
                }
                onChange={event => {
                  const value =
                    Number(event.target.value);

                  engine?.setTalkoverAmount(
                    value
                  );

                  saveMixerMemory({
                    talkover: value,
                  });
                }}
              />
            </label>

            <button
              type="button"
              disabled={locked}
              onClick={() =>
                void run(async e => {
                  await e.setMicLive(!e.micLive);
                })
              }
              className={
                button +
                " mt-5 w-full " +
                (engine?.micLive
                  ? " border-red-400/60 bg-red-500/25 text-red-200"
                  : " border-amber-300/40 bg-amber-300/10 text-amber-200")
              }
            >
              {engine?.micLive
                ? "MIC ON - TURN OFF"
                : "MIC OFF - TURN ON"}
            </button>

            <div className="mt-6 rounded-2xl border border-white/10 bg-black/25 p-4">
              <div className="flex h-56 items-center justify-center gap-6">
                <div className="flex h-full flex-col justify-between text-[10px] text-white/35">
                  <span>+6</span>
                  <span>0</span>
                  <span>-12</span>
                  <span>-Ã¢Ë†Å¾</span>
                </div>

                <input
                  aria-label="Microphone studio fader"
                  type="range"
                  min={0}
                  max={1.5}
                  step={0.01}
                  disabled={locked}
                  value={engine?.micVolume ?? 0.9}
                  onChange={event => {
                    const value =
                      Number(event.target.value);

                    engine?.setMicVolume(
                      value
                    );

                    saveMixerMemory({
                      mic: value,
                    });
                  }}
                  style={{
                    writingMode: "vertical-lr",
                    direction: "rtl",
                    height: 210,
                  }}
                />
              </div>

              <p className="mt-3 text-center text-xs font-black tracking-wider text-amber-300">
                MIC VOLUME: {Math.round(
                  (engine?.micVolume ?? 0.9) * 100
                )}%
              </p>
            </div>

            <div className="mt-4 rounded-xl border border-red-400/20 bg-red-500/5 p-3 text-xs text-white/55">
              MIC LIVE is included in the master WAV and GO LIVE MIX output.
            </div>
          </div>

          {/* ================= INSTRUMENT INPUT ================= */}
          <div className="bg-[#12100d] p-5">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-black tracking-[0.25em] text-orange-300">
                  CHANNEL 4
                </p>
                <h3 className="text-xl font-black">
                  LIVE INPUT
                </h3>
              </div>

              <span className={
                "rounded-full px-3 py-1 text-xs font-black " +
                (engine?.instrumentLive
                  ? "bg-red-500/25 text-red-300"
                  : "bg-white/5 text-white/40")
              }>
                {engine?.instrumentLive ? "LIVE" : "OFF"}
              </span>
            </div>

            <p className="min-h-12 text-sm text-white/55">
              Connect Scarlett, a mixer, keyboard, guitar interface, or another audio input.
            </p>

            <button
              type="button"
              disabled={locked}
              className={button + " mt-4 w-full"}
              onClick={() =>
                void findInstrumentInputs()
              }
            >
              FIND AUDIO INPUTS
            </button>

            <select
              aria-label="Scarlett or instrument input"
              disabled={locked || inputs.length === 0}
              className="mt-3 w-full rounded-xl border border-white/10 bg-[#080b16] p-3 text-sm"
              value={instrumentInputId}
              onChange={event => {
                const deviceId =
                  event.target.value;

                const selected =
                  inputs.find(
                    input =>
                      input.deviceId === deviceId
                  );

                setInstrumentInputId(deviceId);

                void run(async current => {
                  await current.setInstrumentDevice(
                    deviceId,
                    selected?.label ||
                      "Audio input"
                  );
                });
              }}
            >
              <option value="">
                Select Scarlett / instrument
              </option>

              {inputs.map((input, index) => (
                <option
                  key={input.deviceId}
                  value={input.deviceId}
                >
                  {input.label ||
                    `Audio input ${index + 1}`}
                </option>
              ))}
            </select>

            <div className="mb-4 mt-4 flex h-28 items-end gap-1 rounded-xl border border-white/10 bg-black/25 p-3">
              {Array.from({ length: 18 }).map((_, index) => {
                const level =
                  engine?.meterData.instrument || 0;

                const active =
                  index <
                  Math.round(level * 18);

                return (
                  <div
                    key={index}
                    className={
                      "flex-1 rounded-sm transition-all " +
                      (active
                        ? index > 15
                          ? "bg-red-400"
                          : index > 11
                            ? "bg-amber-300"
                            : "bg-orange-400"
                        : "bg-white/10")
                    }
                    style={{
                      height: 10 + index * 4,
                    }}
                  />
                );
              })}
            </div>

            <button
              type="button"
              disabled={
                locked ||
                !instrumentInputId
              }
              onClick={() =>
                void run(async current => {
                  await current.setInstrumentLive(
                    !current.instrumentLive
                  );
                })
              }
              className={
                button +
                " w-full " +
                (engine?.instrumentLive
                  ? " border-red-400/60 bg-red-500/25 text-red-200"
                  : " border-orange-300/40 bg-orange-300/10 text-orange-200")
              }
            >
              {engine?.instrumentLive
                ? "INPUT ON - TURN OFF"
                : "INPUT OFF - TURN ON"}
            </button>

            <div className="mt-6 rounded-2xl border border-white/10 bg-black/25 p-4">
              <div className="flex h-56 items-center justify-center gap-6">
                <div className="flex h-full flex-col justify-between text-[10px] text-white/35">
                  <span>+6</span>
                  <span>0</span>
                  <span>-12</span>
                  <span>-Ã¢Ë†Å¾</span>
                </div>

                <input
                  aria-label="Instrument input studio fader"
                  type="range"
                  min={0}
                  max={1.5}
                  step={0.01}
                  disabled={locked}
                  value={
                    engine?.instrumentVolume ??
                    0.9
                  }
                  onChange={event => {
                    const value =
                      Number(event.target.value);

                    engine?.setInstrumentVolume(
                      value
                    );

                    saveMixerMemory({
                      input: value,
                    });
                  }}
                  style={{
                    writingMode: "vertical-lr",
                    direction: "rtl",
                    height: 210,
                  }}
                />
              </div>

              <p className="mt-3 text-center text-xs font-black tracking-wider text-orange-300">
                INPUT VOLUME: {Math.round(
                  (engine?.instrumentVolume ?? 0.9) * 100
                )}%
              </p>
            </div>

            <div className="mt-4 rounded-xl border border-orange-400/20 bg-orange-500/5 p-3 text-xs text-white/55">
              INPUT LIVE is included in the master WAV and GO LIVE MIX output.
            </div>
          </div>

          {/* ================= MASTER ================= */}
          <div className="bg-[#0b1110] p-5">
            <div className="mb-5">
              <p className="text-xs font-black tracking-[0.25em] text-emerald-300">
                PROGRAM
              </p>
              <h3 className="text-xl font-black">MASTER</h3>
            </div>

            <div className="mb-5 flex h-32 items-end gap-1 rounded-xl border border-emerald-300/10 bg-black/25 p-3">
              {Array.from({ length: 20 }).map((_, index) => {
                const level =
                  engine?.meterData.master || 0;

                const active =
                  index <
                  Math.round(level * 20);

                return (
                  <div
                    key={index}
                    className={
                      "flex-1 rounded-sm transition-all " +
                      (active
                        ? index > 17
                          ? "bg-red-400"
                          : index > 13
                            ? "bg-amber-300"
                            : "bg-emerald-400"
                        : "bg-white/10")
                    }
                    style={{
                      height:
                        10 +
                        index * 4,
                    }}
                  />
                );
              })}
            </div>
            <div className="rounded-2xl border border-emerald-300/10 bg-black/25 p-4">
              <p className="text-xs font-black tracking-wider text-white/50">
                MASTER OUTPUT
              </p>

              <div className="mt-4 flex h-56 items-center justify-center gap-6">
                <div className="flex h-full flex-col justify-between text-[10px] text-white/35">
                  <span>0 dB</span>
                  <span>-6</span>
                  <span>-18</span>
                  <span>-Ã¢Ë†Å¾</span>
                </div>

                <input
                  aria-label="Master studio fader"
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  disabled={locked}
                  value={engine?.volume ?? 0.8}
                  onChange={event => {
                    if (engine) {
                      engine.volume =
                        Number(event.target.value);

                      engine.monitor.gain.value =
                        engine.muted
                          ? 0
                          : engine.volume;

                      // SOLO_REAL_MASTER_V6
                      // Broadcast + WAV master level.
                      engine.master.gain.value =
                        engine.volume;

                      saveMixerMemory({
                        master: engine.volume,
                      });
                    }
                  }}
                  style={{
                    writingMode: "vertical-lr",
                    direction: "rtl",
                    height: 210,
                  }}
                />
              </div><p className="mt-3 text-center text-xs font-black tracking-wider text-emerald-300">
                MASTER VOLUME: {Math.round(
                  (engine?.volume ?? 0.8) * 100
                )}%
              </p>
            </div>

            <button
              className={button + " mt-4 w-full"}
              disabled={locked}
              onClick={() => {
                if (!engine) return;

                engine.muted = !engine.muted;

                engine.monitor.gain.value =
                  engine.youtubeCaptureActive
                    ? 0
                    : (engine.muted ? 0 : engine.volume);
              }}
            >
              {engine?.muted
                ? "UNMUTE MONITORS"
                : "MUTE MONITORS"}
            </button>

            <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="flex justify-between text-xs">
                <span className="text-white/45">PROGRAM</span>
                <span className="font-black text-emerald-300">
                  {engine?.recording ? "RECORDING ON" : "RECORDING OFF"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* MASTER CONSOLE CROSSFADE */}
        <div className="border-t border-white/10 bg-[#070a11] p-6">
          <div className="flex items-center justify-between text-xs font-black tracking-[0.2em]">
            <span className="text-cyan-300">DECK A</span>
            <span className="text-white/60">MASTER CROSSFADE</span>
            <span className="text-violet-300">DECK B</span>
          </div>

          <input
            aria-label="Studio master crossfader"
            type="range"
            min={0}
            max={1}
            step={0.001}
            disabled={locked}
            className="mt-5 w-full accent-cyan-300"
            value={engine?.cross || 0}
            onChange={event => {
              engine?.stopAuto();
              engine?.setCross(
                Number(event.target.value)
              );
            }}
          />

          {/* SOLO_MIXER_RESET_BUTTONS_V2 */}
          <div className="mt-5 rounded-2xl border border-white/10 bg-black/25 p-4">
            <p className="mb-4 text-center text-xs font-black tracking-[0.2em] text-white/60">
              RESET CONTROLS
            </p>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <button
                type="button"
                disabled={locked}
                className={button + " text-cyan-200"}
                onClick={() => {
                  if (!engine) return;

                  const deck = engine.decks[0];

                  deck.level.gain.value = 1;
                  deck.audio.playbackRate = 1;
                  deck.audio.preservesPitch = true;

                  deck.eq.forEach(filter => {
                    filter.gain.value = 0;
                  });

                  saveMixerMemory({
                    deckA: 1,
                  });

                  setMessage(
                    "Deck A volume, EQ, and tempo reset."
                  );

                  redraw(value => value + 1);
                }}
              >
                RESET DECK A
              </button>

              <button
                type="button"
                disabled={locked}
                className={button + " text-violet-200"}
                onClick={() => {
                  if (!engine) return;

                  const deck = engine.decks[1];

                  deck.level.gain.value = 1;
                  deck.audio.playbackRate = 1;
                  deck.audio.preservesPitch = true;

                  deck.eq.forEach(filter => {
                    filter.gain.value = 0;
                  });

                  saveMixerMemory({
                    deckB: 1,
                  });

                  setMessage(
                    "Deck B volume, EQ, and tempo reset."
                  );

                  redraw(value => value + 1);
                }}
              >
                RESET DECK B
              </button>

              <button
                type="button"
                disabled={locked}
                className={button + " text-amber-200"}
                onClick={() => {
                  if (!engine) return;

                  engine.setMicVolume(0.9);

                  saveMixerMemory({
                    mic: 0.9,
                  });

                  setMessage(
                    "Microphone volume reset to 90%."
                  );

                  redraw(value => value + 1);
                }}
              >
                RESET MIC
              </button>

              <button
                type="button"
                disabled={locked}
                className={button + " text-orange-200"}
                onClick={() => {
                  if (!engine) return;

                  engine.setInstrumentVolume(0.9);

                  saveMixerMemory({
                    input: 0.9,
                  });

                  setMessage(
                    "Live Input volume reset to 90%."
                  );

                  redraw(value => value + 1);
                }}
              >
                RESET LIVE INPUT
              </button>

              <button
                type="button"
                disabled={locked}
                className={button + " text-emerald-200"}
                onClick={() => {
                  if (!engine) return;

                  engine.volume = 0.8;
                  engine.monitor.gain.value = engine.muted ? 0 : 0.8;

                  // SOLO_REAL_MASTER_V6
                  engine.master.gain.value = 0.8;

                  saveMixerMemory({
                    master: 0.8,
                  });

                  setMessage(
                    "Master volume reset to 80%."
                  );

                  redraw(value => value + 1);
                }}
              >
                RESET MASTER
              </button>

              <button
                type="button"
                disabled={locked}
                className={button + " text-amber-200"}
                onClick={() => {
                  if (!engine) return;

                  engine.setTalkoverAmount(0.28);

                  saveMixerMemory({
                    talkover: 0.28,
                  });

                  setMessage(
                    "Talkover music level reset to 28%."
                  );

                  redraw(value => value + 1);
                }}
              >
                RESET TALKOVER
              </button>

              <button
                type="button"
                disabled={locked}
                className={button}
                onClick={() => {
                  if (!engine) return;

                  engine.stopAuto();
                  engine.setCross(0);

                  setMessage(
                    "Crossfader reset to Deck A."
                  );

                  redraw(value => value + 1);
                }}
              >
                RESET CROSSFADER
              </button>

              <button
                type="button"
                disabled={locked}
                className={
                  button +
                  " border-red-400/40 bg-red-500/10 text-red-200"
                }
                onClick={() => {
                  if (
                    !engine ||
                    !window.confirm(
                      "Reset every mixer control to safe studio defaults?"
                    )
                  ) {
                    return;
                  }

                  engine.stopAuto();

                  engine.decks.forEach(deck => {
                    deck.level.gain.value = 1;
                    deck.audio.playbackRate = 1;
                    deck.audio.preservesPitch = true;

                    deck.eq.forEach(filter => {
                      filter.gain.value = 0;
                    });
                  });

                  engine.setMicVolume(0.9);
                  engine.setInstrumentVolume(0.9);

                  engine.volume = 0.8;
                  engine.monitor.gain.value = engine.muted ? 0 : 0.8;

                  // SOLO_REAL_MASTER_V6
                  engine.master.gain.value = 0.8;

                  engine.setTalkoverAmount(0.28);
                  engine.setCross(0);

                  saveMixerMemory({
                    deckA: 1,
                    deckB: 1,
                    mic: 0.9,
                    input: 0.9,
                    master: 0.8,
                    talkover: 0.28,
                  });

                  setMessage(
                    "All mixer controls reset to safe studio defaults."
                  );

                  redraw(value => value + 1);
                }}
              >
                RESET ALL
              </button>
            </div>

            <p className="mt-3 text-center text-xs text-white/40">
              Reset does not delete tracks, recordings, or broadcasts.
            </p>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            <button
              className={
                button +
                (!engine?.auto
                  ? " bg-cyan-300/20"
                  : "")
              }
              disabled={locked}
              onClick={() => {
                engine?.stopAuto();
                setMessage(
                  "MANUAL studio mixing enabled."
                );
              }}
            >
              MANUAL
            </button>

            <button
              className={
                button +
                (engine?.auto
                  ? " bg-emerald-300/20"
                  : "")
              }
              disabled={
                locked ||
                !files.length ||
                !!engine?.auto
              }
              onClick={() =>
                void run(e => e.startAuto())
              }
            >
              AUTO MIX
            </button>

            <button
              className={button}
              disabled={
                locked ||
                !engine?.auto ||
                !!engine?.transition ||
                !!engine?.starting
              }
              onClick={() =>
                engine?.tick(true)
              }
            >
              MIX NEXT
            </button>
          </div>
        </div>
      </section>
      <section className={panel + " mt-5"}>
        <fieldset disabled={locked}>
          <div className="flex items-center justify-between text-sm font-bold">
            <span className="text-cyan-300">DECK A</span><span>CROSSFADER</span><span className="text-violet-300">DECK B</span>
          </div>
          <input aria-label="Crossfader" type="range" min={0} max={1} step={0.001}
            className="my-5 w-full accent-cyan-300" value={engine?.cross || 0}
            onChange={event => { engine?.stopAuto(); engine?.setCross(Number(event.target.value)); }} />
          <div className="flex flex-wrap items-center gap-4">
            <button className={button + (!engine?.auto ? " bg-cyan-300/25" : "")}
              aria-pressed={!engine?.auto} disabled={locked}
              onClick={() => { engine?.stopAuto(); setMessage("MANUAL enabled. Both decks stay under your control."); }}>
              MANUAL
            </button>
            <button className={button + (engine?.auto ? " bg-emerald-300/25" : "")}
              aria-pressed={!!engine?.auto} disabled={locked || !files.length || !!engine?.auto}
              onClick={() => void run(e => e.startAuto())}>AUTO</button>
            <button className={button}
              disabled={locked || !engine?.auto || !!engine?.transition || !!engine?.starting}
              onClick={() => engine?.tick(true)}>Mix next now</button>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={engine?.autoRecord ?? true}
                disabled={locked || engine?.finishing}
                onChange={event => {
                  if (!engine) return;

                  const turnOn = event.target.checked;

                  void run(async current => {
                    if (!turnOn) {
                      current.autoRecord = false;

                      if (current.recording) {
                        await current.finishRecording();
                      }

                      setMessage(
                        "SESSION RECORDING: OFF. Music, mixer, microphone, and live broadcasting continue normally."
                      );

                      return;
                    }

                    if (
                      !current.saved &&
                      !window.confirm(
                        "The previous recording has not been downloaded. Replace it with a new recording?"
                      )
                    ) {
                      return;
                    }

                    current.autoRecord = true;

                    const sessionActive =
                      current.auto ||
                      current.decks.some(
                        deck =>
                          !deck.audio.paused &&
                          !deck.audio.ended
                      );

                    if (
                      sessionActive &&
                      !current.recording &&
                      !current.finishing
                    ) {
                      await current.startRecording();
                    }

                    setMessage(
                      sessionActive
                        ? "SESSION RECORDING: ON. A new recording portion has started."
                        : "SESSION RECORDING: ON. Recording will start automatically when the session begins."
                    );
                  });
                }}
              /> Recording ON
            </label>
            <span className="text-xs text-white/60">SESSION RECORDER: continues until Stop Session Recording. MANUAL and AUTO remain in the same recording.</span>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={engine?.repeat ?? true} disabled={locked}
                onChange={event => {
                  if (engine) { engine.stopAuto(); engine.repeat = event.target.checked; }
                  setMessage("Repeat changed. Press AUTO to continue with the new setting.");
                }} /> Repeat playlist
            </label>
            <label className="text-sm">Transition
              <select className="ml-2 rounded-lg bg-[#080b16] p-2" value={engine?.fadeSeconds || 6}
                onChange={event => { if (engine) engine.fadeSeconds = Number(event.target.value); }}>
                {[2, 4, 6, 8, 12].map(value => <option key={value} value={value}>{value}s</option>)}
              </select>
            </label>
            <label className="text-sm">Monitor
              <input className="ml-3 align-middle" type="range" min={0} max={1} step={0.01}
                value={engine?.volume ?? 0.8} onChange={event => {
                  if (engine) {
                    engine.volume =
                      Number(event.target.value);

                    engine.monitor.gain.value =
                      engine.volume;

                    // SOLO_REAL_MASTER_V6
                    engine.master.gain.value =
                      engine.volume;

                    saveMixerMemory({
                      master: engine.volume,
                    });
                  }
                }} />
            </label>
            <button className={button} onClick={() => {
              if (engine) { engine.muted = !engine.muted; engine.monitor.gain.value = engine.muted ? 0 : engine.volume; }
            }}>{engine?.muted ? "Unmute local speakers" : "Mute local speakers"}</button>
          </div>
          <p className="mt-3 text-xs text-white/50">Auto mix uses timed crossfades, not beat sync. Speaker mute does not mute the recording.</p>
        </fieldset>
        <button className={button + " mt-4 border-red-300/40 text-red-200"} disabled={!engine}
          onClick={() => { void engine?.stopAll(); setMessage("Decks stopped. Any recording is being finalized."); }}>
          STOP BOTH DECKS + RECORDING
        </button>
      </section>

      <section className={panel + " mt-5"}>
        <h2 className="text-xl font-bold">Mixer playlist - {engine?.auto ? "AUTO" : "MANUAL"}</h2>
        <p className="mt-2 text-sm text-white/60">
          AUTO follows this order from the active track. Editing switches to MANUAL without stopping playback.
          Press AUTO again to follow the new order. Loaded tracks cannot be removed.
        </p>
        <p className="mt-2 text-sm text-cyan-200">
          {engine?.auto ? (engine.transition ? "Crossfading..." : "Next: " + (engine.decks[1 - engine.active].file?.name || "End of playlist"))
            : "MANUAL: choose tracks on the decks and use the crossfader."}
        </p>
        <ol className="mt-4 max-h-80 space-y-2 overflow-y-auto">
          {files.map((file, index) => (
            <li key={index} className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 p-3">
              <span className="min-w-0 flex-1 break-words text-sm">{index + 1}. {file.name}</span>
              {[-1, 1].map(direction => (
                <button key={direction} className={button}
                  aria-label={(direction < 0 ? "Move up: " : "Move down: ") + file.name}
                  disabled={locked || index + direction < 0 || index + direction >= files.length}
                  onClick={() => {
                    if (!engine) return;
                    engine.stopAuto();
                    const next = [...engine.files], target = index + direction;
                    [next[index], next[target]] = [next[target], next[index]];
                    engine.files = next;
                    redraw(value => value + 1);
                  }}>{direction < 0 ? "Up" : "Down"}</button>
              ))}
              <button className={button + " text-red-200"}
                aria-label={"Remove: " + file.name}
                disabled={locked || !!engine?.decks.some(deck => deck.file === file)}
                onClick={() => {
                  if (!engine) return;
                  engine.stopAuto();
                  engine.files = engine.files.filter((_, item) => item !== index);
                  redraw(value => value + 1);
                }}>Remove</button>
            </li>
          ))}
        </ol>
        {!files.length && <p className="mt-3 text-white/50">Enable audio, then add local tracks above.</p>}
      </section>
      <section className={panel + " mt-5"}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-red-300">
              YouTube Live Source
            </p>

            <h2 className="mt-2 text-xl font-black">
              YouTube Tab Audio Capture
            </h2>

            <p className="mt-3 max-w-3xl text-sm leading-6 text-white/60">
              Open permitted YouTube music in another browser tab. Press CAPTURE YOUTUBE TAB AUDIO, select that tab, and enable Share tab audio. The captured audio enters the master recording and live broadcast. YouTube Direct is the default clean path; enable Mixer only when you need processing or talkover.
            </p>
          </div>

          <span
            className={
              engine?.youtubeCaptureActive
                ? "rounded-full border border-emerald-300/30 bg-emerald-400/15 px-4 py-2 text-sm font-black text-emerald-200"
                : "rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-white/60"
            }
          >
            {engine?.youtubeCaptureActive
              ? "YOUTUBE AUDIO LIVE"
              : "YOUTUBE AUDIO OFF"}
          </span>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={locked || engine?.youtubeCaptureActive}
            className={button + " border-emerald-300/40 text-emerald-200"}
            onClick={() =>
              void run(async current => {
                await current.startYouTubeCapture();
              })
            }
          >
            CAPTURE YOUTUBE TAB AUDIO
          </button>

          <button
            type="button"
            disabled={!engine?.youtubeCaptureActive}
            className={button + " border-red-300/40 text-red-200"}
            onClick={() => {
              const current = engineRef.current;

              if (!current) {
                return;
              }

              void current
                .releaseYouTubeCapture()
                .finally(() => {
                  redraw(value => value + 1);
                });
            }}
          >
            STOP YOUTUBE CAPTURE
          </button>
        </div>

        {/* SOLO_YOUTUBE_DIRECT_MIXER_V1 */}
        <div className="mt-5 rounded-2xl border border-white/10 bg-black/25 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-white/50">
                YouTube Audio Route
              </p>

              <p className="mt-1 text-sm font-black">
                {engine?.youtubeMixerEnabled
                  ? "MIXER ON"
                  : "YOUTUBE DIRECT"}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={locked}
                className={
                  button +
                  (!engine?.youtubeMixerEnabled
                    ? " border-emerald-300/50 bg-emerald-400/15 text-emerald-200"
                    : "")
                }
                onClick={() => {
                  const current =
                    engineRef.current;

                  if (!current) {
                    return;
                  }

                  current.setYouTubeMixerEnabled(
                    false
                  );

                  if (!current.youtubeCaptureActive) {
                    void current
                      .startYouTubeCapture()
                      .finally(() => {
                        redraw(value => value + 1);
                      });

                    return;
                  }

                  redraw(value => value + 1);
                }}
              >
                YOUTUBE DIRECT
              </button>

              <button
                type="button"
                disabled={locked}
                className={
                  button +
                  (engine?.youtubeMixerEnabled
                    ? " border-amber-300/50 bg-amber-400/15 text-amber-100"
                    : "")
                }
                onClick={() => {
                  const current =
                    engineRef.current;

                  if (!current) {
                    return;
                  }

                  current.setYouTubeMixerEnabled(
                    true
                  );

                  if (!current.youtubeCaptureActive) {
                    void current
                      .startYouTubeCapture()
                      .finally(() => {
                        redraw(value => value + 1);
                      });

                    return;
                  }

                  redraw(value => value + 1);
                }}
              >
                MIXER ON
              </button>
            </div>
          </div>

          <p className="mt-3 text-xs leading-5 text-white/50">
            DIRECT is the default clean source path. MIXER ON applies YouTube volume and talkover to the program. Use the isolated monitor below only when you want to hear that processed signal locally.
          </p>

          {/* SOLO_YOUTUBE_ISOLATED_MONITOR_V1 */}
          <div className="mt-4 rounded-xl border border-cyan-300/20 bg-black/25 p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-200">
                  YouTube Isolated Monitor
                </p>

                <p className="mt-1 text-xs text-white/50">
                  {engine?.youtubeMonitorEnabled
                    ? "ON - processed YouTube is routed through the mixer to your speakers."
                    : "OFF - Chrome remains the normal local YouTube playback source."}
                </p>
              </div>

              <button
                type="button"
                disabled={
                  locked ||
                  !engine?.youtubeCaptureActive ||
                  !engine?.youtubeMixerEnabled
                }
                className={
                  button +
                  (engine?.youtubeMonitorEnabled
                    ? " border-cyan-300/50 bg-cyan-400/15 text-cyan-100"
                    : "")
                }
                onClick={() => {
                  const current = engineRef.current;

                  if (!current) {
                    return;
                  }

                  current.setYouTubeMonitorEnabled(
                    !current.youtubeMonitorEnabled
                  );

                  setMessage(
                    current.youtubeMonitorEnabled
                      ? "YOUTUBE MONITOR ON - mute the original YouTube tab now to avoid double audio."
                      : "YOUTUBE MONITOR OFF - processed YouTube local monitoring stopped."
                  );

                  redraw(value => value + 1);
                }}
              >
                {engine?.youtubeMonitorEnabled
                  ? "YOUTUBE MONITOR ON"
                  : "YOUTUBE MONITOR OFF"}
              </button>
            </div>

            <p className="mt-3 text-xs leading-5 text-amber-200/80">
              IMPORTANT: When this is ON, mute the original YouTube tab.
              The mixer will then control the YouTube sound you hear.
            </p>
          </div>
        </div>

        <label className="mt-5 block max-w-xl text-sm">
          YouTube mixer input:{" "}
          {Math.round(
            (engine?.youtubeCaptureVolume ?? 0.9) *
              100
          )}%

          <input
            aria-label="YouTube captured audio volume"
            className="mt-3 w-full accent-red-400"
            type="range"
            min={0}
            max={1.5}
            step={0.01}
            disabled={locked || !engine?.youtubeMixerEnabled}
            value={
              engine?.youtubeCaptureVolume ??
              0.9
            }
            onChange={event => {
              if (!engine) {
                return;
              }

              engine.setYouTubeCaptureVolume(
                Number(event.target.value)
              );
            }}
          />
        </label>

        <div className="mt-5">
          <div className="mb-2 flex justify-between text-xs font-black uppercase tracking-[0.16em] text-white/50">
            <span>YouTube Input</span>
            <span>
              {Math.round(
                (engine?.meterData.youtube ?? 0) *
                  100
              )}%
            </span>
          </div>

          <div className="h-3 overflow-hidden rounded-full bg-black/50">
            <div
              className="h-full rounded-full bg-gradient-to-r from-red-500 via-orange-300 to-emerald-300 transition-[width] duration-100"
              style={{
                width:
                  Math.round(
                    (engine?.meterData.youtube ?? 0) *
                      100
                  ) + "%",
              }}
            />
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-amber-300/25 bg-amber-300/10 p-4 text-sm text-amber-100">
          Browser requirement: choose a browser tab - not Entire Screen - and make sure Share tab audio is ON. Keep sharing active while recording or broadcasting.
        </div>
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section className={panel}>
          <h2 className="text-xl font-bold">Headphone cue</h2>
          <p className="mt-3 text-sm text-white/60">
            Cue is separate from the recorded master. Choose a separate headphone output, then play the cued deck with its master fader closed.
          </p>
          <button className={button + " mt-4"} disabled={locked} onClick={() => void findOutputs()}>Find audio outputs</button>
          <p className="mt-2 text-xs text-white/45">This briefly requests microphone permission to reveal device names. The microphone is immediately stopped and is never connected to this mix.</p>
          <select aria-label="Headphone output" className="mt-4 w-full rounded-xl bg-[#080b16] p-3"
            disabled={locked} value={headphoneId} onChange={event => {
              const id = event.target.value;
              void run(async e => { await e.setHeadphones(id); setHeadphoneId(id); });
            }}>
            <option value="">Cue output disabled</option>
            {outputs.map(output => <option key={output.deviceId} value={output.deviceId}>{output.label || "Audio output"}</option>)}
          </select>
        </section>

        <section className={panel}>
                    {/* SOLO_OWNER_MASTER_MONITOR_MOVED_V2 */}
{/* SOLO_OWNER_MASTER_MONITOR_V1 */}
              <div className="mt-5 rounded-xl border border-emerald-300/20 bg-black/30 p-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-black tracking-[0.18em] text-emerald-300">
                      OWNER MASTER MONITOR
                    </p>

                    <p className="mt-1 text-xs text-white/55">
                      {engine?.ownerMasterMonitorEnabled
                        ? "ON - hearing the exact post-master broadcast mix."
                        : "OFF - normal local listening."}
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={locked || !engine}
                    className={
                      button +
                      (engine?.ownerMasterMonitorEnabled
                        ? " border-emerald-300/50 bg-emerald-400/15 text-emerald-100"
                        : "")
                    }
                    onClick={() => {
                      const current = engineRef.current;

                      if (!current) return;

                      current.setOwnerMasterMonitorEnabled(
                        !current.ownerMasterMonitorEnabled
                      );

                      setMessage(
                        current.ownerMasterMonitorEnabled
                          ? "MASTER MONITOR ON - mute the original YouTube tab now. You are hearing the level being delivered to listeners."
                          : "MASTER MONITOR OFF - normal local monitoring restored."
                      );

                      redraw(value => value + 1);
                    }}
                  >
                    {engine?.ownerMasterMonitorEnabled
                      ? "MASTER MONITOR ON"
                      : "MASTER MONITOR OFF"}
                  </button>
                </div>

                <p className="mt-3 text-xs leading-5 text-amber-200/80">
                  IMPORTANT: With YouTube playing, mute the original Chrome
                  YouTube tab while MASTER MONITOR is ON. This prevents
                  double audio.
                </p>
              </div>

          <StemMixerFoundation engine={engine} />

          <h2 className="text-xl font-bold">FULL DJ SESSION RECORDING</h2>
          <p className="mt-3 text-sm text-white/60">
  Records the complete master program until you stop it: Deck A/B, captured YouTube tab audio, crossfades, EQ, channel levels, AUTO or MANUAL mixing, MIC whenever MIC LIVE is enabled, and Scarlett/instrument input whenever INPUT LIVE is enabled.
</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              className={button + " border-emerald-300/40 text-emerald-200"}
              disabled={locked || engine?.recording || engine?.finishing}
              onClick={() => void run(async e => {
                if (
                  !e.saved &&
                  !window.confirm(
                    "The previous recording has not been downloaded. Replace it?"
                  )
                ) {
                  return;
                }

                e.autoRecord = true;
                await e.startRecording();

                if (e.recording) {
                  setMessage(
                    "SESSION RECORDING: ON. Decks, captured YouTube tab audio, mixer changes, MIC LIVE, Scarlett/instrument input, and the live master output are being captured."
                  );
                }
              })}
            >
              Recording ON
            </button>

            <button
              className={button + " border-red-300/40 text-red-200"}
              disabled={!engine?.recording || engine.finishing}
              onClick={() => {
                if (!engine) return;

                engine.autoRecord = false;

                void engine.finishRecording().then(() => {
                  setMessage(
                    "SESSION RECORDING: OFF. Music, mixer, microphone, and live broadcasting continue normally."
                  );
                });
              }}
            >
              Recording OFF
            </button>
          </div>
          <div className="mt-4 rounded-xl border border-amber-300/25 bg-amber-300/10 p-3 text-sm text-amber-100">
            Recording is ON by default for real DJ sessions. Recorded portions may be retained for owner review. Turning recording OFF does not stop playback, the mixer, microphone, instruments, or the live broadcast.
          </div>

          <p
            role="status"
            className={
              "mt-4 font-mono font-black " +
              (engine?.recording
                ? "text-red-300"
                : "text-white/60")
            }
          >
            {engine?.recording
              ? engine.youtubeRecordingPaused
                ? "SESSION RECORDING: AUTO-PAUSED - " +
                  time(
                    engine.recordingElapsedSeconds()
                  )
                : "SESSION RECORDING: ON - " +
                  time(
                    engine.recordingElapsedSeconds()
                  )
              : "SESSION RECORDING: OFF"}
          </p>
          {engine?.finishing && <p className="mt-4">Finalizing DJ session WAV...</p>}
          {engine?.recordingUrl && (
            <a className={button + " mt-4 inline-block bg-emerald-300/20"} href={engine.recordingUrl}
              download={engine.recordingName} onClick={() => { engine.saved = true; }}>
              Download Session WAV
            </a>
          )}
        </section>
      </div>

      <p role="status" aria-live="polite" className="mt-5 rounded-2xl border border-white/10 p-4 text-cyan-200">{busy ? "Working..." : message}</p>
      <style jsx>{`
        .solo-platter {
          display: grid; place-items: center; width: 170px; height: 170px; flex-shrink: 0;
          border: 5px solid #252d43; border-radius: 50%;
          background: repeating-radial-gradient(circle, #080b12 0px, #080b12 3px, #1b2030 4px, #080b12 5px);
          box-shadow: 0 12px 30px #0008;
          animation: solo-spin 2s linear infinite;
        }
        @keyframes solo-spin { to { transform: rotate(360deg); } }
        @media (prefers-reduced-motion: reduce) { .solo-platter { animation: none; } }
      `}</style>
    </main>
  );
}

















