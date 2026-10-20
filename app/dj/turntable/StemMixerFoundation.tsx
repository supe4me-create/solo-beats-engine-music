"use client";

import {
  ChangeEvent,
  useEffect,
  useRef,
  useState,
} from "react";

type StemName =
  | "vocals"
  | "drums"
  | "bass"
  | "other";

type StemState = {
  name: StemName;
  label: string;
  fileName: string;
  url: string;
  volume: number;
  muted: boolean;
  solo: boolean;
};

type StemEngine = {
  context: AudioContext;
  master: GainNode;
};

type Props = {
  engine: StemEngine | null;
};

const names: StemName[] = [
  "vocals",
  "drums",
  "bass",
  "other",
];

const initialStems: StemState[] = [
  {
    name: "vocals",
    label: "VOCALS",
    fileName: "",
    url: "",
    volume: 1,
    muted: false,
    solo: false,
  },
  {
    name: "drums",
    label: "DRUMS",
    fileName: "",
    url: "",
    volume: 1,
    muted: false,
    solo: false,
  },
  {
    name: "bass",
    label: "BASS",
    fileName: "",
    url: "",
    volume: 1,
    muted: false,
    solo: false,
  },
  {
    name: "other",
    label: "OTHER",
    fileName: "",
    url: "",
    volume: 1,
    muted: false,
    solo: false,
  },
];

// SOLO_STEM_WAV_EXPORT_V1
function stemAudioBufferToWavBlob(
  buffer: AudioBuffer
) {
  const channels = 2;
  const frames = buffer.length;
  const bytesPerSample = 2;
  const dataBytes =
    frames *
    channels *
    bytesPerSample;

  const wav =
    new ArrayBuffer(
      44 + dataBytes
    );

  const view =
    new DataView(wav);

  function writeText(
    offset: number,
    value: string
  ) {
    for (
      let index = 0;
      index < value.length;
      index++
    ) {
      view.setUint8(
        offset + index,
        value.charCodeAt(index)
      );
    }
  }

  writeText(0, "RIFF");
  view.setUint32(
    4,
    36 + dataBytes,
    true
  );

  writeText(8, "WAVE");
  writeText(12, "fmt ");

  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(
    22,
    channels,
    true
  );

  view.setUint32(
    24,
    buffer.sampleRate,
    true
  );

  view.setUint32(
    28,
    buffer.sampleRate *
      channels *
      bytesPerSample,
    true
  );

  view.setUint16(
    32,
    channels *
      bytesPerSample,
    true
  );

  view.setUint16(
    34,
    16,
    true
  );

  writeText(36, "data");

  view.setUint32(
    40,
    dataBytes,
    true
  );

  const left =
    buffer.getChannelData(0);

  const right =
    buffer.numberOfChannels > 1
      ? buffer.getChannelData(1)
      : left;

  let offset = 44;

  for (
    let frame = 0;
    frame < frames;
    frame++
  ) {
    const leftSample =
      Math.max(
        -1,
        Math.min(
          1,
          left[frame]
        )
      );

    const rightSample =
      Math.max(
        -1,
        Math.min(
          1,
          right[frame]
        )
      );

    view.setInt16(
      offset,
      leftSample < 0
        ? leftSample * 0x8000
        : leftSample * 0x7fff,
      true
    );

    offset += 2;

    view.setInt16(
      offset,
      rightSample < 0
        ? rightSample * 0x8000
        : rightSample * 0x7fff,
      true
    );

    offset += 2;
  }

  return new Blob(
    [wav],
    {
      type: "audio/wav",
    }
  );
}
export default function StemMixerFoundation({
  engine,
}: Props) {
  const [stems, setStems] =
    useState<StemState[]>(initialStems);

  const [playing, setPlaying] =
    useState(false);

  const [masterVolume, setMasterVolume] =
    useState(0.8);

  const [masterEnabled, setMasterEnabled] =
    useState(false);

  const [message, setMessage] =
    useState(
      "Load separated VOCALS, DRUMS, BASS and OTHER files."
    );

  // SOLO_STEM_WAV_EXPORT_V1
  const [exportingWav, setExportingWav] =
    useState(false);

  const audioRefs = useRef<
    Record<StemName, HTMLAudioElement | null>
  >({
    vocals: null,
    drums: null,
    bass: null,
    other: null,
  });

  const sourceRefs = useRef<
    Record<StemName, MediaElementAudioSourceNode | null>
  >({
    vocals: null,
    drums: null,
    bass: null,
    other: null,
  });

  const sourceElementRefs = useRef<
    Record<StemName, HTMLAudioElement | null>
  >({
    vocals: null,
    drums: null,
    bass: null,
    other: null,
  });

  const gainRefs = useRef<
    Record<StemName, GainNode | null>
  >({
    vocals: null,
    drums: null,
    bass: null,
    other: null,
  });

  const busRef =
    useRef<GainNode | null>(null);

  const previewRef =
    useRef<GainNode | null>(null);

  const urlsRef =
    useRef<string[]>([]);

  const anySolo =
    stems.some(stem => stem.solo);

  function channelLevel(
    stem: StemState
  ) {
    if (stem.muted) return 0;

    if (
      anySolo &&
      !stem.solo
    ) {
      return 0;
    }

    return Math.max(
      0,
      Math.min(1, stem.volume)
    );
  }

  function ensureBaseGraph() {
    if (!engine) return false;

    if (!busRef.current) {
      const bus =
        engine.context.createGain();

      bus.gain.value =
        masterVolume;

      busRef.current =
        bus;

      const preview =
        engine.context.createGain();

      preview.gain.value = 1;

      preview.connect(
        engine.context.destination
      );

      previewRef.current =
        preview;

      bus.connect(preview);
    }

    return true;
  }

  function attachSources() {
    if (!engine) return;

    if (!ensureBaseGraph()) return;

    const bus =
      busRef.current;

    if (!bus) return;

    for (const name of names) {
      const element =
        audioRefs.current[name];

      if (!element) continue;

      if (
        sourceElementRefs.current[name] ===
          element &&
        sourceRefs.current[name]
      ) {
        continue;
      }

      try {
        sourceRefs.current[
          name
        ]?.disconnect();

        gainRefs.current[
          name
        ]?.disconnect();
      } catch {}

      try {
        const source =
          engine.context
            .createMediaElementSource(
              element
            );

        const gain =
          engine.context.createGain();

        source.connect(gain);
        gain.connect(bus);

        sourceRefs.current[name] =
          source;

        sourceElementRefs.current[
          name
        ] = element;

        gainRefs.current[name] =
          gain;

        element.volume = 1;
      } catch (error) {
        console.error(
          "Stem source connection failed:",
          name,
          error
        );
      }
    }
  }

  function applyProgramRouting(
    enabled: boolean
  ) {
    if (!engine) return false;

    if (!ensureBaseGraph()) {
      return false;
    }

    attachSources();

    const bus =
      busRef.current;

    const preview =
      previewRef.current;

    if (!bus || !preview) {
      return false;
    }

    try {
      bus.disconnect();
    } catch {}

    if (enabled) {
      /*
       * STEM PROGRAM PATH
       *
       * STEM CHANNELS
       *   -> STEM MASTER
       *   -> EXISTING SOLO BEATS MASTER
       *   -> OUTPUT STREAM
       *   -> WAV / GO LIVE MIX
       *
       * No engine.ts changes.
       */
      bus.connect(
        engine.master
      );
    } else {
      /*
       * LOCAL PREVIEW ONLY
       */
      bus.connect(preview);
    }

    return true;
  }

  useEffect(() => {
    if (!engine) return;

    ensureBaseGraph();
    attachSources();

    applyProgramRouting(
      masterEnabled
    );
  }, [engine]);

  useEffect(() => {
    if (!engine) return;

    attachSources();

    const bus =
      busRef.current;

    if (bus) {
      bus.gain.cancelScheduledValues(
        engine.context.currentTime
      );

      bus.gain.setTargetAtTime(
        masterVolume,
        engine.context.currentTime,
        0.015
      );
    }

    for (const stem of stems) {
      const gain =
        gainRefs.current[
          stem.name
        ];

      if (!gain) continue;

      gain.gain.cancelScheduledValues(
        engine.context.currentTime
      );

      gain.gain.setTargetAtTime(
        channelLevel(stem),
        engine.context.currentTime,
        0.015
      );
    }
  }, [
    engine,
    stems,
    masterVolume,
    anySolo,
  ]);

  useEffect(() => {
    if (!engine) return;

    applyProgramRouting(
      masterEnabled
    );
  }, [
    engine,
    masterEnabled,
  ]);

  useEffect(() => {
    return () => {
      try {
        busRef.current?.disconnect();
      } catch {}

      try {
        previewRef.current?.disconnect();
      } catch {}

      for (const name of names) {
        try {
          sourceRefs.current[
            name
          ]?.disconnect();
        } catch {}

        try {
          gainRefs.current[
            name
          ]?.disconnect();
        } catch {}
      }

      for (
        const url of
        urlsRef.current
      ) {
        URL.revokeObjectURL(url);
      }
    };
  }, []);

  function updateStem(
    name: StemName,
    update: Partial<StemState>
  ) {
    setStems(current =>
      current.map(stem =>
        stem.name === name
          ? {
              ...stem,
              ...update,
            }
          : stem
      )
    );
  }

  function loadStem(
    name: StemName,
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target.files?.[0];

    if (!file) return;

    const old =
      stems.find(
        stem =>
          stem.name === name
      );

    if (old?.url) {
      URL.revokeObjectURL(
        old.url
      );

      urlsRef.current =
        urlsRef.current.filter(
          url =>
            url !== old.url
        );
    }

    const url =
      URL.createObjectURL(file);

    urlsRef.current.push(url);

    updateStem(name, {
      fileName: file.name,
      url,
    });

    setMessage(
      `${name.toUpperCase()} loaded: ${file.name}`
    );
  }

  async function playAll() {
    const loaded =
      stems.filter(
        stem => stem.url
      );

    if (!loaded.length) {
      setMessage(
        "Load at least one stem first."
      );

      return;
    }

    if (engine) {
      await engine.context.resume();

      ensureBaseGraph();
      attachSources();

      applyProgramRouting(
        masterEnabled
      );
    }

    const positions =
      loaded.map(
        stem =>
          audioRefs.current[
            stem.name
          ]?.currentTime ?? 0
      );

    const position =
      Math.min(...positions);

    for (const stem of loaded) {
      const audio =
        audioRefs.current[
          stem.name
        ];

      if (!audio) continue;

      if (
        Math.abs(
          audio.currentTime -
            position
        ) > 0.08
      ) {
        audio.currentTime =
          position;
      }
    }

    try {
      await Promise.all(
        loaded.map(async stem => {
          const audio =
            audioRefs.current[
              stem.name
            ];

          if (!audio) return;

          await audio.play();
        })
      );

      setPlaying(true);

      setMessage(
        masterEnabled
          ? "STEMS PLAYING THROUGH SOLO BEATS MASTER."
          : "STEMS PLAYING IN LOCAL PREVIEW ONLY."
      );
    } catch {
      setMessage(
        "One or more stem files could not start."
      );
    }
  }

  function pauseAll() {
    for (const stem of stems) {
      audioRefs.current[
        stem.name
      ]?.pause();
    }

    setPlaying(false);

    setMessage(
      "STEM MIXER PAUSED."
    );
  }

  function restartAll() {
    for (const stem of stems) {
      const audio =
        audioRefs.current[
          stem.name
        ];

      if (!audio) continue;

      audio.pause();
      audio.currentTime = 0;
    }

    setPlaying(false);

    setMessage(
      "STEM MIXER RETURNED TO START."
    );
  }

  // SOLO_STEM_WAV_EXPORT_V1
  async function exportStemMixWav() {
    if (exportingWav) return;

    if (!engine) {
      setMessage(
        "ENABLE AUDIO before exporting the stem mix."
      );

      return;
    }

    const loaded =
      stems.filter(
        stem => stem.url
      );

    if (!loaded.length) {
      setMessage(
        "Load at least one stem before exporting."
      );

      return;
    }

    setExportingWav(true);

    setMessage(
      "Preparing dedicated STEM MIX WAV..."
    );

    try {
      await engine.context.resume();

      const decoded =
        await Promise.all(
          loaded.map(
            async stem => {
              const response =
                await fetch(
                  stem.url
                );

              if (!response.ok) {
                throw new Error(
                  `Could not read ${stem.label}.`
                );
              }

              const bytes =
                await response.arrayBuffer();

              const buffer =
                await engine.context
                  .decodeAudioData(
                    bytes.slice(0)
                  );

              return {
                stem,
                buffer,
              };
            }
          )
        );

      const duration =
        Math.max(
          ...decoded.map(
            item =>
              item.buffer.duration
          )
        );

      if (
        !Number.isFinite(duration) ||
        duration <= 0
      ) {
        throw new Error(
          "The loaded stems have no playable duration."
        );
      }

      const sampleRate =
        engine.context.sampleRate;

      const frames =
        Math.max(
          1,
          Math.ceil(
            duration *
              sampleRate
          )
        );

      const offline =
        new OfflineAudioContext(
          2,
          frames,
          sampleRate
        );

      const exportSoloActive =
        stems.some(
          stem => stem.solo
        );

      for (
        const {
          stem,
          buffer,
        } of decoded
      ) {
        const source =
          offline.createBufferSource();

        source.buffer =
          buffer;

        const gain =
          offline.createGain();

        let channelGain =
          stem.volume;

        if (stem.muted) {
          channelGain = 0;
        }

        if (
          exportSoloActive &&
          !stem.solo
        ) {
          channelGain = 0;
        }

        gain.gain.value =
          Math.max(
            0,
            Math.min(
              1,
              channelGain
            )
          ) *
          Math.max(
            0,
            Math.min(
              1,
              masterVolume
            )
          );

        source.connect(gain);

        gain.connect(
          offline.destination
        );

        source.start(0);
      }

      const rendered =
        await offline
          .startRendering();

      const wav =
        stemAudioBufferToWavBlob(
          rendered
        );

      const url =
        URL.createObjectURL(
          wav
        );

      const link =
        document.createElement(
          "a"
        );

      const now =
        new Date();

      const date =
        [
          now.getFullYear(),
          String(
            now.getMonth() + 1
          ).padStart(2, "0"),
          String(
            now.getDate()
          ).padStart(2, "0"),
        ].join("");

      const time =
        [
          String(
            now.getHours()
          ).padStart(2, "0"),
          String(
            now.getMinutes()
          ).padStart(2, "0"),
          String(
            now.getSeconds()
          ).padStart(2, "0"),
        ].join("");

      link.href = url;

      link.download =
        `solo-beats-stem-mix-${date}-${time}.wav`;

      document.body.appendChild(
        link
      );

      link.click();
      link.remove();

      window.setTimeout(
        () => {
          URL.revokeObjectURL(
            url
          );
        },
        30000
      );

      setMessage(
        "STEM MIX WAV EXPORTED. Mute, Solo, channel levels and Stem Master were applied."
      );
    } catch (error) {
      console.error(
        "Stem WAV export failed:",
        error
      );

      setMessage(
        error instanceof Error
          ? `STEM WAV EXPORT FAILED: ${error.message}`
          : "STEM WAV EXPORT FAILED."
      );
    } finally {
      setExportingWav(false);
    }
  }
  async function toggleMaster() {
    if (!engine) {
      setMessage(
        "ENABLE AUDIO first."
      );

      return;
    }

    await engine.context.resume();

    const next =
      !masterEnabled;

    if (
      !applyProgramRouting(next)
    ) {
      setMessage(
        "Stem master routing could not start."
      );

      return;
    }

    setMasterEnabled(next);

    setMessage(
      next
        ? "STEM TO MASTER: ON. Stems now enter Solo Beats master."
        : "STEM TO MASTER: OFF. Local preview only."
    );
  }

  return (
    <section className="mt-6 rounded-3xl border border-fuchsia-300/25 bg-fuchsia-300/5 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.22em] text-fuchsia-300">
            PHASE 15B
          </p>

          <h2 className="mt-1 text-2xl font-black">
            STEM MIXER
          </h2>

          <p className="mt-2 text-sm text-white/60">
            VOCALS / DRUMS / BASS / OTHER
          </p>
        </div>

        <div
          className={
            "rounded-xl border px-4 py-3 text-xs font-black " +
            (
              masterEnabled
                ? "border-emerald-300/40 bg-emerald-300/10 text-emerald-200"
                : "border-white/15 bg-black/30 text-white/60"
            )
          }
        >
          {masterEnabled
            ? "STEM MASTER LIVE"
            : "LOCAL STEM WORKSPACE"}
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-4">
        <button
          type="button"
          onClick={() =>
            void toggleMaster()
          }
          className={
            "rounded-xl border px-5 py-3 text-sm font-black " +
            (
              masterEnabled
                ? "border-emerald-300/50 bg-emerald-300/20 text-emerald-200"
                : "border-white/15 bg-white/5"
            )
          }
        >
          STEM TO MASTER{" "}
          {masterEnabled
            ? "ON"
            : "OFF"}
        </button>
      </div>

      <div className="mt-5 grid gap-5 md:grid-cols-2 2xl:grid-cols-4">
        {stems.map(stem => (
          <div
            key={stem.name}
            className="min-w-0 rounded-2xl border border-white/10 bg-black/25 p-5"
          >
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
              <h3 className="min-w-0 text-lg font-black tracking-wide">
                {stem.label}
              </h3>

              <span className="shrink-0 rounded-md bg-white/5 px-2 py-1 text-[10px] font-black tracking-wide text-white/55">
                {stem.url
                  ? "LOADED"
                  : "EMPTY"}
              </span>
            </div>

            <label className="mt-4 block w-full cursor-pointer rounded-xl border border-white/15 bg-white/5 p-3 text-center text-xs font-bold hover:bg-white/10">
              LOAD {stem.label}

              <input
                className="sr-only"
                type="file"
                accept="audio/*,.wav,.mp3,.m4a,.flac,.ogg"
                onChange={event =>
                  loadStem(
                    stem.name,
                    event
                  )
                }
              />
            </label>

            <p className="mt-3 block min-w-0 truncate text-xs text-white/45">
              {stem.fileName ||
                "No stem loaded"}
            </p>

            {stem.url && (
              <audio
                ref={element => {
                  audioRefs.current[
                    stem.name
                  ] = element;
                }}
                src={stem.url}
                preload="metadata"
              />
            )}

            <div className="mt-5">
              <div className="flex justify-between text-xs font-bold">
                <span>LEVEL</span>

                <span>
                  {Math.round(
                    stem.volume * 100
                  )}
                  %
                </span>
              </div>

              <input
                className="mt-2 w-full"
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={stem.volume}
                onChange={event =>
                  updateStem(
                    stem.name,
                    {
                      volume:
                        Number(
                          event.target
                            .value
                        ),
                    }
                  )
                }
              />
            </div>

            <div className="mt-5 grid grid-cols-1 gap-2 2xl:grid-cols-2">
              <button
                type="button"
                onClick={() =>
                  updateStem(
                    stem.name,
                    {
                      muted:
                        !stem.muted,
                    }
                  )
                }
                className="w-full min-w-0 rounded-xl border border-white/15 px-2 py-2.5 text-xs font-black"
              >
                {stem.muted
                  ? "MUTED"
                  : "MUTE"}
              </button>

              <button
                type="button"
                onClick={() =>
                  updateStem(
                    stem.name,
                    {
                      solo:
                        !stem.solo,
                    }
                  )
                }
                className="w-full min-w-0 rounded-xl border border-white/15 px-2 py-2.5 text-xs font-black"
              >
                {stem.solo
                  ? "SOLO ON"
                  : "SOLO"}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-2xl border border-white/10 bg-black/25 p-4">
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() =>
              void playAll()
            }
            className="rounded-xl border border-emerald-300/30 px-5 py-3 text-sm font-black"
          >
            {playing
              ? "PLAYING"
              : "PLAY STEMS"}
          </button>

          <button
            type="button"
            onClick={pauseAll}
            className="rounded-xl border border-white/15 px-5 py-3 text-sm font-black"
          >
            PAUSE
          </button>

          <button
            type="button"
            onClick={restartAll}
            className="rounded-xl border border-white/15 px-5 py-3 text-sm font-black"
          >
            RESTART
          </button>
        </div>

        <div className="mt-5 max-w-xl">
          <div className="flex justify-between text-sm font-black">
            <span>STEM MASTER</span>

            <span>
              {Math.round(
                masterVolume * 100
              )}
              %
            </span>
          </div>

          <input
            className="mt-3 w-full"
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={masterVolume}
            onChange={event =>
              setMasterVolume(
                Number(
                  event.target.value
                )
              )
            }
          />
        </div>

        {/* SOLO_STEM_WAV_EXPORT_V1 */}
        <div className="mt-6 rounded-2xl border border-cyan-300/20 bg-cyan-300/5 p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-black tracking-wide text-cyan-200">
                STEM MIX EXPORT
              </p>

              <p className="mt-1 text-xs leading-5 text-white/50">
                Creates a dedicated WAV from the loaded stems only.
                Current Mute, Solo, channel levels and Stem Master
                settings are applied.
              </p>
            </div>

            <button
              type="button"
              disabled={
                exportingWav ||
                !engine ||
                !stems.some(
                  stem => stem.url
                )
              }
              onClick={() =>
                void exportStemMixWav()
              }
              className={
                "rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-5 py-3 text-sm font-black text-cyan-100 " +
                (
                  exportingWav
                    ? "cursor-wait opacity-60"
                    : ""
                )
              }
            >
              {exportingWav
                ? "EXPORTING WAV..."
                : "EXPORT STEM MIX WAV"}
            </button>
          </div>

          <p className="mt-3 text-[11px] leading-5 text-white/40">
            This is separate from FULL DJ SESSION RECORDING.
            It exports only VOCALS / DRUMS / BASS / OTHER.
          </p>
        </div>
        <p className="mt-4 text-sm font-bold text-fuchsia-200">
          {message}
        </p>
      </div>
    </section>
  );
}



