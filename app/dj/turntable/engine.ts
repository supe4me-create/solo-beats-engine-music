export type Deck = {
  audio: HTMLAudioElement; file: File | null; url: string;
  eq: BiquadFilterNode[]; level: GainNode; fade: GainNode; cue: GainNode;
  cuePoint: number; cueOn: boolean;
};
export function crossGains(position: number) {
  const x = Math.max(0, Math.min(1, position));
  return [Math.cos(x * Math.PI / 2), Math.sin(x * Math.PI / 2)];
}
// SOLO_DISK_RECORDING_V1
type StoredRecordingChunk = {
  index: number;
  blob: Blob;
};

const RECORDING_DATABASE =
  "solo-beats-dj-recording-v1";

const RECORDING_STORE = "chunks";

let recordingDatabase:
  Promise<IDBDatabase> | null = null;

function openRecordingDatabase():
  Promise<IDBDatabase> {
  if (recordingDatabase) {
    return recordingDatabase;
  }

  recordingDatabase =
    new Promise((resolve, reject) => {
      const request =
        indexedDB.open(
          RECORDING_DATABASE,
          1
        );

      request.onupgradeneeded = () => {
        const database = request.result;

        if (
          !database.objectStoreNames.contains(
            RECORDING_STORE
          )
        ) {
          database.createObjectStore(
            RECORDING_STORE,
            {
              keyPath: "index",
            }
          );
        }
      };

      request.onsuccess = () =>
        resolve(request.result);

      request.onerror = () =>
        reject(
          request.error ||
            new Error(
              "Recording storage could not open."
            )
        );
    });

  return recordingDatabase;
}

async function clearRecordingChunks() {
  const database =
    await openRecordingDatabase();

  await new Promise<void>(
    (resolve, reject) => {
      const transaction =
        database.transaction(
          RECORDING_STORE,
          "readwrite"
        );

      transaction
        .objectStore(RECORDING_STORE)
        .clear();

      transaction.oncomplete = () =>
        resolve();

      transaction.onerror = () =>
        reject(
          transaction.error ||
            new Error(
              "Recording storage could not be cleared."
            )
        );

      transaction.onabort = () =>
        reject(
          transaction.error ||
            new Error(
              "Recording storage was interrupted."
            )
        );
    }
  );
}

async function storeRecordingChunk(
  chunk: StoredRecordingChunk
) {
  const database =
    await openRecordingDatabase();

  await new Promise<void>(
    (resolve, reject) => {
      const transaction =
        database.transaction(
          RECORDING_STORE,
          "readwrite"
        );

      transaction
        .objectStore(RECORDING_STORE)
        .put(chunk);

      transaction.oncomplete = () =>
        resolve();

      transaction.onerror = () =>
        reject(
          transaction.error ||
            new Error(
              "A recording chunk could not be stored."
            )
        );

      transaction.onabort = () =>
        reject(
          transaction.error ||
            new Error(
              "Recording storage was interrupted."
            )
        );
    }
  );
}

async function readRecordingChunks():
  Promise<StoredRecordingChunk[]> {
  const database =
    await openRecordingDatabase();

  return new Promise(
    (resolve, reject) => {
      const transaction =
        database.transaction(
          RECORDING_STORE,
          "readonly"
        );

      const request =
        transaction
          .objectStore(RECORDING_STORE)
          .getAll();

      request.onsuccess = () => {
        const chunks =
          (
            request.result as
              StoredRecordingChunk[]
          ).sort(
            (left, right) =>
              left.index - right.index
          );

        resolve(chunks);
      };

      request.onerror = () =>
        reject(
          request.error ||
            new Error(
              "Recorded chunks could not be read."
            )
        );
    }
  );
}

export function wavBlob(
  chunks: Blob[],
  bytes: number,
  rate: number
) {
  const header = new ArrayBuffer(44);
  const view = new DataView(header);

  const text = (
    offset: number,
    value: string
  ) => {
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
  };

  text(0, "RIFF");
  view.setUint32(4, 36 + bytes, true);

  text(8, "WAVE");
  text(12, "fmt ");

  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 2, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 4, true);
  view.setUint16(32, 4, true);
  view.setUint16(34, 16, true);

  text(36, "data");
  view.setUint32(40, bytes, true);

  return new Blob(
    [header, ...chunks],
    {
      type: "audio/wav",
    }
  );
}
export class TurntableEngine {
  context = new AudioContext();
  master = this.context.createGain();
  monitor = this.context.createGain();

  // SOLO_OWNER_MASTER_MONITOR_V1
  // Optional post-master local listening path.
  // OFF by default to prevent double monitoring.
  ownerMasterMonitorGain = this.context.createGain();
  ownerMasterMonitorEnabled = false;

  analyser = this.context.createAnalyser();
  output = this.context.createMediaStreamDestination();
  cueBus = this.context.createGain();
  cueOutput = this.context.createMediaStreamDestination();
  headphones = new Audio();

  // SOLO_STUDIO_MIC_V1
  micGain = this.context.createGain();
  micStream: MediaStream | null = null;
  micSource: MediaStreamAudioSourceNode | null = null;
  micAnalyser = this.context.createAnalyser();

  micLive = false;
  micVolume = 0.9;

  // SOLO_SCARLETT_INSTRUMENT_INPUT_V1
  instrumentGain = this.context.createGain();
  instrumentStream: MediaStream | null = null;
  instrumentSource: MediaStreamAudioSourceNode | null = null;
  instrumentAnalyser = this.context.createAnalyser();

  instrumentLive = false;
  instrumentVolume = 0.9;
  instrumentDeviceId = "";
  instrumentDeviceLabel = "";

  // SOLO_YOUTUBE_TAB_CAPTURE_V1
  youtubeCaptureGain = this.context.createGain();

  // SOLO_YOUTUBE_DIRECT_MIXER_V1
  // DIRECT is default: YouTube bypasses mixer processing.
  // MIXER ON enables volume processing, talkover and limiter path.
  youtubeDirectGain = this.context.createGain();
  youtubeMixerGain = this.context.createGain();
  youtubeMixerEnabled = false;

  // SOLO_YOUTUBE_ISOLATED_MONITOR_V1
  // Dedicated local speaker branch for processed YouTube.
  // OFF by default to prevent double playback with Chrome.
  youtubeMonitorGain = this.context.createGain();
  youtubeMonitorEnabled = false;

  // SOLO_YOUTUBE_STUDIO_SOUND_V1
  //
  // Gentle processing for captured YouTube music.
  // Designed to add warmth, clarity, air, and peak control
  // without heavily compressing already-mastered music.
  youtubeStudioLow = this.context.createBiquadFilter();
  youtubeStudioMid = this.context.createBiquadFilter();
  youtubeStudioHigh = this.context.createBiquadFilter();

  youtubeStudioCompressor =
    this.context.createDynamicsCompressor();

  youtubeStudioLimiter =
    this.context.createDynamicsCompressor();

  // SOLO_YOUTUBE_STUDIO_SOUND_V3
  // Controlled stereo image.
  youtubeStereoSplit =
    this.context.createChannelSplitter(2);

  youtubeStereoMerge =
    this.context.createChannelMerger(2);

  // SOLO_YOUTUBE_FINAL_LEVEL_V4_3
  // Dedicated post-stereo YouTube program level.
  youtubeStudioOutputGain =
    this.context.createGain();

  youtubeLeftDirect = this.context.createGain();
  youtubeLeftCross = this.context.createGain();
  youtubeRightDirect = this.context.createGain();
  youtubeRightCross = this.context.createGain();
  youtubeCaptureStream: MediaStream | null = null;
  youtubeCaptureSource: MediaStreamAudioSourceNode | null = null;
  youtubeCaptureAnalyser = this.context.createAnalyser();

  youtubeCaptureActive = false;
  youtubeAutoStartedRecording = false;

  // SOLO_YOUTUBE_PLAYBACK_RECORDING_V1
  youtubeRecordingPaused = false;
  youtubeSilenceStarted = 0;
  youtubeSilenceDelay = 2;
  youtubePausedAt = 0;
  youtubePausedSeconds = 0;

  // Unity gain preserves the captured tab's original level.
  youtubeCaptureVolume = 1;

  // SOLO_STUDIO_PHASE2
  talkover = true;
  talkoverAmount = 0.28;

  deckMuted = [false, false];

  meterData = {
    deckA: 0,
    deckB: 0,
    mic: 0,
    instrument: 0,
    youtube: 0,
    master: 0,
  };

  deckAnalysers: AnalyserNode[] = [];
  decks: Deck[];
  files: File[] = [];
  cursor = 0;
  cross = 0;
  volume = 0.8;
  muted = false;
  cueReady = false;
  auto = false;
  active = 0;
  fadeSeconds = 6;
  transition: { from: number; to: number; started: number; duration: number } | null = null;
  starting = false;
  generation = 0;
  disposed = false;
  enabled = true;
  recording = false;
  finishing = false;
  recordStarted = 0;
  recordingUrl = "";
  recordingName = "";
  saved = true;
  recordId = 0;
  recorder: AudioWorkletNode | null = null;

  recordingChunkIndex = 0;
  recordingBytes = 0;

  recordingWrites:
    Promise<void> = Promise.resolve();

  emergencyChunks:
    StoredRecordingChunk[] = [];

  finalizeTask:
    Promise<void> | null = null;

  finishResolve:
    (() => void) | null = null;

  finishTask:
    Promise<void> | null = null;
  timer: ReturnType<typeof setInterval>;
  constructor(public report: (message: string) => void) {
    // SOLO_HIFI_MASTER_V1
    // Transparent safety limiter: preserves the original dynamics
    // and only controls peaks that approach digital clipping.
    const compressor = this.context.createDynamicsCompressor();
    compressor.threshold.value = -1;
    compressor.knee.value = 0;
    compressor.ratio.value = 20;
    compressor.attack.value = 0.001;
    compressor.release.value = 0.06;
    compressor.connect(this.master);

    // Microphone enters the same program/master bus as Deck A/B.
    // This automatically includes LIVE mic in master recording
    // and in the turntable broadcast output.
    this.micGain.gain.value = 0;

    this.micAnalyser.fftSize = 256;
    this.micAnalyser.smoothingTimeConstant = 0.72;

    this.micGain.connect(this.micAnalyser);
    this.micAnalyser.connect(compressor);

    // Scarlett, mixer, keyboard, guitar interface, or other
    // selected audio input enters the same master program bus.
    this.instrumentGain.gain.value = 0;

    this.instrumentAnalyser.fftSize = 256;
    this.instrumentAnalyser.smoothingTimeConstant = 0.72;

    this.instrumentGain.connect(this.instrumentAnalyser);
    this.instrumentAnalyser.connect(compressor);

    // Captured YouTube tab audio enters the same master program
    // as Deck A/B, MIC LIVE, and Scarlett/instrument input.
    // It is therefore included in WAV recording and broadcasting.
    this.youtubeCaptureGain.gain.value = 0;

    this.youtubeCaptureAnalyser.fftSize = 256;
    this.youtubeCaptureAnalyser.smoothingTimeConstant = 0.72;

    this.youtubeCaptureGain.connect(
      this.youtubeCaptureAnalyser
    );

    // SOLO_YOUTUBE_DIRECT_MIXER_V1
    //
    // DIRECT PATH:
    // Captured YouTube enters the master bus without passing
    // through the mixer compressor/limiter.
    //
    // MIXER PATH:
    // Captured YouTube passes through normal mixer processing.
    this.youtubeCaptureAnalyser.connect(
      this.youtubeDirectGain
    );

    this.youtubeCaptureAnalyser.connect(
      this.youtubeMixerGain
    );

    this.youtubeDirectGain.connect(
      this.master
    );

    // SOLO_YOUTUBE_STUDIO_SOUND_V1
    // SOLO_YOUTUBE_STUDIO_SOUND_V2
    // Tuned for less brightness, less bass boost,
    // and more open dynamic movement.
    //
    // Warm low shelf:
    // adds a small amount of body without booming.
    this.youtubeStudioLow.type = "lowshelf";
    this.youtubeStudioLow.frequency.value = 90;
    this.youtubeStudioLow.gain.value = 0; // SOLO_YOUTUBE_NATURAL_MIX_V4_2

    // Clean low-mid area:
    // removes a little boxiness/mud.
    this.youtubeStudioMid.type = "peaking";
    this.youtubeStudioMid.frequency.value = 300;
    this.youtubeStudioMid.Q.value = 0.8;
    this.youtubeStudioMid.gain.value = 0; // SOLO_YOUTUBE_NORMAL_MIX_V4

    // Gentle high-frequency air:
    // adds definition without excessive brightness.
    this.youtubeStudioHigh.type = "highshelf";
    this.youtubeStudioHigh.frequency.value = 9000;
    this.youtubeStudioHigh.gain.value = 0;

    // Musical compression rather than hard squashing.
    this.youtubeStudioCompressor.threshold.value = 0;
    this.youtubeStudioCompressor.knee.value = 0;
    this.youtubeStudioCompressor.ratio.value = 1;
    this.youtubeStudioCompressor.attack.value = 0.003;
    this.youtubeStudioCompressor.release.value = 0.10;

    // Final peak protection.
    this.youtubeStudioLimiter.threshold.value = 0;
    this.youtubeStudioLimiter.knee.value = 0;
    this.youtubeStudioLimiter.ratio.value = 1;
    this.youtubeStudioLimiter.attack.value = 0.003;
    this.youtubeStudioLimiter.release.value = 0.08;

    // YouTube MIXER ON processing path.
    this.youtubeMixerGain.connect(
      this.youtubeStudioLow
    );

    this.youtubeStudioLow.connect(
      this.youtubeStudioMid
    );

    this.youtubeStudioMid.connect(
      this.youtubeStudioHigh
    );

    this.youtubeStudioHigh.connect(
      this.youtubeStudioCompressor
    );

    this.youtubeStudioCompressor.connect(
      this.youtubeStudioLimiter
    );

    // SOLO_YOUTUBE_STUDIO_SOUND_V3
    //
    // Reduce excessive stereo width without collapsing to mono.
    //
    // Left output  = 90% Left + 10% Right
    // Right output = 90% Right + 10% Left
    //
    // This keeps stereo movement but produces a stronger,
    // more natural center image.

    this.youtubeLeftDirect.gain.value = 0.94;
    this.youtubeLeftCross.gain.value = 0.06;
    this.youtubeRightDirect.gain.value = 0.94;
    this.youtubeRightCross.gain.value = 0.06;

    // SOLO_YOUTUBE_FINAL_LEVEL_V4_3
    //
    // Clean post-processing level lift.
    // 1.12 is approximately +1 dB.
    this.youtubeStudioOutputGain.gain.value = 1.12;

    this.youtubeStudioLimiter.connect(
      this.youtubeStereoSplit
    );

    // LEFT -> LEFT
    this.youtubeStereoSplit.connect(
      this.youtubeLeftDirect,
      0
    );

    this.youtubeLeftDirect.connect(
      this.youtubeStereoMerge,
      0,
      0
    );

    // RIGHT -> LEFT
    this.youtubeStereoSplit.connect(
      this.youtubeRightCross,
      1
    );

    this.youtubeRightCross.connect(
      this.youtubeStereoMerge,
      0,
      0
    );

    // RIGHT -> RIGHT
    this.youtubeStereoSplit.connect(
      this.youtubeRightDirect,
      1
    );

    this.youtubeRightDirect.connect(
      this.youtubeStereoMerge,
      0,
      1
    );

    // LEFT -> RIGHT
    this.youtubeStereoSplit.connect(
      this.youtubeLeftCross,
      0
    );

    this.youtubeLeftCross.connect(
      this.youtubeStereoMerge,
      0,
      1
    );

    // SOLO_YOUTUBE_FINAL_LEVEL_V4_3
    //
    // Corrected stereo first enters its dedicated
    // YouTube program-output gain.
    this.youtubeStereoMerge.connect(
      this.youtubeStudioOutputGain
    );

    // Recording / broadcast receives the same clean lift.
    this.youtubeStudioOutputGain.connect(
      this.master
    );

    // SOLO_YOUTUBE_ISOLATED_MONITOR_V1
    // Local monitor receives identical corrected audio.
    this.youtubeStudioOutputGain.connect(
      this.youtubeMonitorGain
    );

    this.youtubeMonitorGain.connect(
      this.monitor
    );

    // OFF until explicitly enabled.
    this.youtubeMonitorGain.gain.value = 0;

    // DIRECT is the default.
    this.youtubeDirectGain.gain.value = 1;
    this.youtubeMixerGain.gain.value = 0;

    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.72;

    // SOLO_CLEAN_PROGRAM_BUS_V1
    // Recording and broadcasting remain at unity gain.
    // Speaker listening volume is controlled independently.
    this.master.gain.value = 1;
    this.monitor.gain.value = this.volume;
    this.master.connect(this.analyser);

    // SOLO_LOCAL_MIXER_BUS_V1
    // Normal mixer sources reach the local speakers here.
    // YouTube Direct/Mixer routes reach MASTER only.
    compressor.connect(this.monitor);

    this.master.connect(this.output);

    // SOLO_OWNER_MASTER_MONITOR_V1
    // Exact post-master signal can optionally be heard locally.
    this.master.connect(this.ownerMasterMonitorGain);
    this.ownerMasterMonitorGain.gain.value = 0;
    this.ownerMasterMonitorGain.connect(
      this.context.destination
    );

    this.monitor.connect(this.context.destination);
    this.cueBus.connect(this.cueOutput);
    this.cueBus.gain.value = 0.6;
    this.headphones.srcObject = this.cueOutput.stream;
    this.decks = [0, 1].map(() => {
      const audio = new Audio();
      audio.preload = "metadata";
      audio.preservesPitch = true;
      const source = this.context.createMediaElementSource(audio);
      const eq = [this.context.createBiquadFilter(), this.context.createBiquadFilter(), this.context.createBiquadFilter()];
      eq[0].type = "lowshelf"; eq[0].frequency.value = 180;
      eq[1].type = "peaking"; eq[1].frequency.value = 1000; eq[1].Q.value = 0.8;
      eq[2].type = "highshelf"; eq[2].frequency.value = 4500;
      const level = this.context.createGain(), fade = this.context.createGain(), cue = this.context.createGain();
      cue.gain.value = 0;

      const channelAnalyser =
        this.context.createAnalyser();

      channelAnalyser.fftSize = 256;
      channelAnalyser.smoothingTimeConstant = 0.72;

      source.connect(eq[0]);
      eq[0].connect(eq[1]);
      eq[1].connect(eq[2]);

      eq[2].connect(level);
      level.connect(channelAnalyser);
      channelAnalyser.connect(fade);
      fade.connect(compressor);

      eq[2].connect(cue);
      cue.connect(this.cueBus);

      this.deckAnalysers.push(channelAnalyser);
      audio.onerror = () => { this.stopAuto(); this.report("Cannot play this file. Try a browser-supported MP3 or WAV."); };
      return { audio, file: null, url: "", eq, level, fade, cue, cuePoint: 0, cueOn: false };
    });
    this.setCross(0);
    this.timer = setInterval(() => {
      this.tick();
      this.updateMeters();
    }, 100);
  }
  async resume() {
    if (this.disposed || !this.enabled) throw new Error("Turntable access is not active.");
    await this.context.resume();
  }
  // SOLO_OWNER_MASTER_MONITOR_V1
  setOwnerMasterMonitorEnabled(enabled: boolean) {
    this.ownerMasterMonitorEnabled = enabled;

    // Never allow the older processed-YouTube monitor
    // to run at the same time.
    if (enabled && this.youtubeMonitorEnabled) {
      this.youtubeMonitorEnabled = false;
      this.applyYouTubeMonitorLevel();
    }

    this.ownerMasterMonitorGain.gain.cancelScheduledValues(
      this.context.currentTime
    );

    this.ownerMasterMonitorGain.gain.setTargetAtTime(
      enabled ? 1 : 0,
      this.context.currentTime,
      0.02
    );

    // SINGLE PATH:
    // when listening to post-master, silence the normal
    // local Solo Beats monitor so MIC/decks/input are not doubled.
    this.monitor.gain.cancelScheduledValues(
      this.context.currentTime
    );

    this.monitor.gain.setTargetAtTime(
      enabled
        ? 0
        : this.muted
          ? 0
          : this.volume,
      this.context.currentTime,
      0.02
    );

    this.report(
      enabled
        ? "OWNER MASTER MONITOR ON. You are hearing the post-master broadcast mix. Mute the original YouTube tab to prevent double YouTube audio."
        : "OWNER MASTER MONITOR OFF. Normal local monitoring restored."
    );
  }

  setCross(value: number) {
    this.cross = Math.max(0, Math.min(1, value));
    crossGains(this.cross).forEach((gain, i) => {
      const param = this.decks[i].fade.gain;
      param.cancelScheduledValues(this.context.currentTime);
      param.setTargetAtTime(gain, this.context.currentTime, 0.01);
    });
  }
  load(side: number, file: File) {
    const deck = this.decks[side];
    deck.audio.pause();
    if (deck.url) URL.revokeObjectURL(deck.url);
    deck.file = file; deck.url = URL.createObjectURL(file); deck.cuePoint = 0;
    deck.audio.src = deck.url; deck.audio.load();
  }
  async play(side: number) {
    if (!this.decks[side].file) throw new Error("Load a track into this deck first.");
    const generation = this.generation;
    await this.resume();
    if (!this.enabled || generation !== this.generation) return;
    await this.decks[side].audio.play();
    if (!this.enabled || generation !== this.generation) {
      this.decks[side].audio.pause();
      throw new Error("Playback stopped because the session changed.");
    }
  }
  stopAuto() {
    this.auto = false;
    this.generation++;
    this.starting = false;
    if (this.transition) {
      const t = this.transition;
      const progress = Math.max(0, Math.min(1, (this.context.currentTime - t.started) / t.duration));
      this.cross = t.from === 0 ? progress : 1 - progress;
    }
    this.transition = null;
    this.setCross(this.cross);
  }
  // SOLO_MIXER_V2: ordered session playlist with finite/repeat playback.
  autoRecord = true; // SOLO_AUTO_RECORD_V1
  repeat = true;
  next(exclude: File | null): File | null {
    if (!this.files.length) return null;
    for (let count = 0; count < this.files.length; count++) {
      if (this.cursor >= this.files.length) {
        if (!this.repeat) return null;
        this.cursor = 0;
      }
      const file = this.files[this.cursor++];
      if (file !== exclude || this.files.length === 1) return file;
    }
    return null;
  }
  prepareNext(side: number) {
    const file = this.next(this.decks[1 - side].file);
    if (file) { this.load(side, file); return; }
    const deck = this.decks[side];
    deck.audio.pause();
    deck.file = null;
    deck.audio.removeAttribute("src");
    deck.audio.load();
    if (deck.url) URL.revokeObjectURL(deck.url);
    deck.url = "";
  }
  async startAuto() {
    if (this.autoRecord && this.finishing) {
      throw new Error("Wait for the current WAV to finish preparing.");
    }
    if (this.autoRecord && !this.recording && !this.saved) {
      throw new Error("Download the previous WAV first, or turn Auto-record off before starting AUTO.");
    }
    this.stopAuto();
    const generation = this.generation;
    this.active = !this.decks[0].audio.paused && !this.decks[1].audio.paused
      ? (this.cross >= 0.5 ? 1 : 0) : this.decks[1].audio.paused ? 0 : 1;
    const active = this.decks[this.active], spare = 1 - this.active;
    this.cursor = active.file ? this.files.indexOf(active.file) + 1 : 0;
    if (!active.file || active.audio.ended) {
      const file = this.next(active.file);
      if (!file) { this.report("Playlist finished. Load a track to restart."); return; }
      this.load(this.active, file);
    }
    this.decks[spare].audio.pause();
    this.setCross(this.active);
    let startedRecording = false;
    try {
      if (this.autoRecord && !this.recording) {
        await this.startRecording();
        if (!this.enabled || this.disposed || generation !== this.generation) return;
        startedRecording = this.recording;
        if (!this.recording) throw new Error("Recording could not start. AUTO was not started.");
      }
      await this.play(this.active);
      if (!this.enabled || this.disposed || generation !== this.generation) return;
      this.prepareNext(spare);
      this.auto = true;
      this.report(this.recording
        ? "AUTO + SESSION RECORDING active. Recording continues until you stop it. MANUAL keeps the same session recording active."
        : "AUTO enabled without recording. Keep this tab open.");
    } catch (error) {
      if (generation === this.generation) {
        this.stopAuto();
        if (startedRecording && this.recording) await this.finishRecording();
      }
      throw error;
    }
  }
  tick(force = false) {
    if (!this.auto || this.disposed || !this.enabled) return;
    if (this.transition) {
      const t = this.transition;
      const progress = Math.max(0, Math.min(1, (this.context.currentTime - t.started) / t.duration));
      this.cross = t.from === 0 ? progress : 1 - progress;
      if (progress >= 1) {
        this.decks[t.from].audio.pause();
        this.active = t.to;
        this.transition = null;
        this.setCross(t.to);
        this.prepareNext(t.from);
      }
      return;
    }
    if (this.starting) return;
    const from = this.active, to = 1 - from, audio = this.decks[from].audio;
    if (audio.paused && !audio.ended) return;
    if (!Number.isFinite(audio.duration) || audio.duration <= 0) return;
    const remaining = Math.max(0, (audio.duration - audio.currentTime) / audio.playbackRate);
    if (!this.decks[to].file) {
      if (audio.ended) {
        this.stopAuto();
        this.report("Playlist finished. Recording stays available; stop and download it when ready.");
      } else if (force) this.report("No next track. Add tracks or enable Repeat, then restart AUTO.");
      return;
    }
    if (!force && remaining > this.fadeSeconds) return;
    const generation = this.generation;
    this.starting = true;
    void this.play(to).then(() => {
      if (!this.auto || generation !== this.generation || !this.enabled) return;
      const incoming = this.decks[to].audio;
      const outgoingLeft = Math.max(0, (audio.duration - audio.currentTime) / audio.playbackRate);
      const incomingLeft = Number.isFinite(incoming.duration)
        ? Math.max(0, (incoming.duration - incoming.currentTime) / incoming.playbackRate)
        : this.fadeSeconds;
      const duration = Math.max(0.05, Math.min(this.fadeSeconds, outgoingLeft, incomingLeft / 2));
      const started = this.context.currentTime;
      this.transition = { from, to, started, duration };
      for (let side = 0; side < 2; side++) {
        const curve = new Float32Array(64);
        for (let i = 0; i < curve.length; i++) {
          curve[i] = crossGains(from === 0 ? i / 63 : 1 - i / 63)[side];
        }
        const gain = this.decks[side].fade.gain;
        gain.cancelScheduledValues(started);
        gain.setValueCurveAtTime(curve, started, duration);
      }
    }).catch(error => {
      if (generation !== this.generation) return;
      this.stopAuto();
      this.report(error instanceof Error ? error.message : "Auto mix stopped.");
    }).finally(() => {
      if (generation === this.generation) this.starting = false;
    });
  }
  async setHeadphones(id: string) {
    const audio = this.headphones as HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> };
    if (!audio.setSinkId) throw new Error("This browser does not support a separate cue output.");
    this.cueReady = false;
    this.decks.forEach(deck => { deck.cueOn = false; deck.cue.gain.value = 0; });
    if (!id) { audio.pause(); return; }
    await audio.setSinkId(id);
    await this.resume();
    await audio.play();
    this.cueReady = true;
  }
  setCue(side: number) {
    if (!this.cueReady) throw new Error("Select a headphone output first.");
    const deck = this.decks[side];
    deck.cueOn = !deck.cueOn;
    deck.cue.gain.setTargetAtTime(deck.cueOn ? 1 : 0, this.context.currentTime, 0.01);
  }
  // SOLO_STUDIO_MIC_V1
  async ensureMicrophone() {
    if (this.micStream) return;

    const stream =
      await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });

    if (this.disposed) {
      stream.getTracks().forEach(track => track.stop());
      return;
    }

    this.micStream = stream;
    this.micSource =
      this.context.createMediaStreamSource(stream);

    this.micSource.connect(this.micGain);
  }

  async ensureInstrumentInput() {
    if (!this.instrumentDeviceId) {
      throw new Error("Select a Scarlett or instrument input first.");
    }

    if (this.instrumentStream) return;

    const stream =
      await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: {
            exact: this.instrumentDeviceId,
          },
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });

    if (this.disposed) {
      stream.getTracks().forEach(track => track.stop());
      return;
    }

    this.instrumentStream = stream;
    this.instrumentSource =
      this.context.createMediaStreamSource(stream);

    this.instrumentSource.connect(
      this.instrumentGain
    );
  }

  async releaseInstrumentInput() {
    this.instrumentLive = false;

    this.instrumentGain.gain.setTargetAtTime(
      0,
      this.context.currentTime,
      0.02
    );

    if (this.instrumentStream) {
      this.instrumentStream
        .getTracks()
        .forEach(track => track.stop());

      this.instrumentStream = null;
    }

    try {
      this.instrumentSource?.disconnect();
    } catch {
      // Source may already be disconnected.
    }

    this.instrumentSource = null;
  }

  async setInstrumentDevice(
    deviceId: string,
    label = ""
  ) {
    if (
      deviceId === this.instrumentDeviceId &&
      this.instrumentStream
    ) {
      this.instrumentDeviceLabel = label;
      return;
    }

    await this.releaseInstrumentInput();

    this.instrumentDeviceId = deviceId;
    this.instrumentDeviceLabel = label;

    this.report(
      deviceId
        ? `INPUT SELECTED: ${label || "Audio input"}. Press INPUT LIVE when ready.`
        : "Instrument input selection cleared."
    );
  }

  async setInstrumentLive(live: boolean) {
    await this.resume();

    if (live) {
      await this.ensureInstrumentInput();

      this.instrumentLive = true;

      this.instrumentGain.gain.setTargetAtTime(
        this.instrumentVolume,
        this.context.currentTime,
        0.02
      );

      this.report(
        `${this.instrumentDeviceLabel || "Instrument input"} LIVE. Input is now in the master mix, recording, and broadcast output.`
      );

      return;
    }

    this.instrumentLive = false;

    this.instrumentGain.gain.setTargetAtTime(
      0,
      this.context.currentTime,
      0.02
    );

    this.report(
      "INSTRUMENT INPUT OFF."
    );
  }

  setInstrumentVolume(value: number) {
    this.instrumentVolume =
      Math.max(0, Math.min(1.5, value));

    if (this.instrumentLive) {
      this.instrumentGain.gain.setTargetAtTime(
        this.instrumentVolume,
        this.context.currentTime,
        0.01
      );
    }
  }

  async setMicLive(live: boolean) {
    await this.resume();

    if (live) {
      await this.ensureMicrophone();

      this.micLive = true;

      this.micGain.gain.setTargetAtTime(
        this.micVolume,
        this.context.currentTime,
        0.02
      );

      this.applyTalkover();

      this.report(
        this.talkover
          ? "MIC LIVE + TALKOVER. Deck music is ducked while you speak."
          : "MIC LIVE. Microphone is in the master mix without talkover."
      );

      return;
    }

    this.micLive = false;

    this.micGain.gain.setTargetAtTime(
      0,
      this.context.currentTime,
      0.02
    );

    this.restoreDeckLevels();

    this.report(
      "MIC OFF. Deck levels restored."
    );
  }

  setMicVolume(value: number) {
    this.micVolume =
      Math.max(0, Math.min(1.5, value));

    if (this.micLive) {
      this.micGain.gain.setTargetAtTime(
        this.micVolume,
        this.context.currentTime,
        0.01
      );
    }
  }
  // SOLO_YOUTUBE_TAB_CAPTURE_V1
  applyYouTubeCaptureLevel() {
    const active =
      this.youtubeCaptureActive;

    const talkoverMultiplier =
      this.micLive &&
      this.talkover
        ? this.talkoverAmount
        : 1;

    // Keep the capture input itself at unity whenever active.
    // Mode selection happens AFTER the analyser.
    this.youtubeCaptureGain.gain.setTargetAtTime(
      active ? 1 : 0,
      this.context.currentTime,
      0.02
    );

    // DIRECT:
    // clean unity path straight to master.
    const directTarget =
      active &&
      !this.youtubeMixerEnabled
        ? 1
        : 0;

    // MIXER:
    // volume + talkover processing before master.
    const mixerTarget =
      active &&
      this.youtubeMixerEnabled
        ? this.youtubeCaptureVolume *
          talkoverMultiplier
        : 0;

    this.youtubeDirectGain.gain.setTargetAtTime(
      directTarget,
      this.context.currentTime,
      0.02
    );

    this.youtubeMixerGain.gain.setTargetAtTime(
      mixerTarget,
      this.context.currentTime,
      0.02
    );
  }

  setYouTubeMixerEnabled(enabled: boolean) {
    this.youtubeMixerEnabled = enabled;

    this.applyYouTubeCaptureLevel();
    this.applyYouTubeMonitorLevel();

    // SOLO_YOUTUBE_ECHO_GUARD_V2
    // Chrome already plays the selected YouTube tab locally.
    // Never allow the turntable master-monitor copy to create
    // a second delayed speaker feed while capture is active.
    if (this.youtubeCaptureActive) {
      this.monitor.gain.cancelScheduledValues(
        this.context.currentTime
      );

      this.monitor.gain.setTargetAtTime(
        this.muted ? 0 : this.volume,
        this.context.currentTime,
        0.01
      );
    }

    this.report(
      enabled
        ? "YOUTUBE MIXER ON. Processing is active. Echo Guard remains ON."
        : "YOUTUBE DIRECT ACTIVE. Clean source path is active."
    );
  }

  // SOLO_YOUTUBE_ISOLATED_MONITOR_V1
  applyYouTubeMonitorLevel() {
    const target =
      this.youtubeMonitorEnabled &&
      this.youtubeMixerEnabled &&
      this.youtubeCaptureActive
        ? 1
        : 0;

    this.youtubeMonitorGain.gain.cancelScheduledValues(
      this.context.currentTime
    );

    this.youtubeMonitorGain.gain.setTargetAtTime(
      target,
      this.context.currentTime,
      0.02
    );
  }

  setYouTubeMonitorEnabled(enabled: boolean) {
    this.youtubeMonitorEnabled = enabled;

    this.applyYouTubeMonitorLevel();

    this.report(
      enabled
        ? "YOUTUBE MONITOR ON. Mute the original YouTube tab so only the processed mixer feed is heard."
        : "YOUTUBE MONITOR OFF. Local processed YouTube monitoring is disabled."
    );
  }

  setYouTubeCaptureVolume(value: number) {
    this.youtubeCaptureVolume =
      Math.max(0, Math.min(1.5, value));

    this.applyYouTubeCaptureLevel();
  }

  async releaseYouTubeCapture(
    showMessage = true,
    autoFinishRecording = true
  ) {
    this.youtubeCaptureActive = false;
    this.applyYouTubeMonitorLevel();
    this.youtubeRecordingPaused = false;
    this.youtubeSilenceStarted = 0;

    this.youtubeCaptureGain.gain.setTargetAtTime(
      0,
      this.context.currentTime,
      0.02
    );

    this.youtubeDirectGain.gain.setTargetAtTime(
      0,
      this.context.currentTime,
      0.02
    );

    this.youtubeMixerGain.gain.setTargetAtTime(
      0,
      this.context.currentTime,
      0.02
    );

    const stream =
      this.youtubeCaptureStream;

    this.youtubeCaptureStream = null;

    if (stream) {
      stream.getTracks().forEach(track => {
        track.onended = null;
        track.stop();
      });
    }

    try {
      this.youtubeCaptureSource?.disconnect();
    } catch {
      // Source may already be disconnected.
    }

    this.youtubeCaptureSource = null;

    // Restore normal deck/master monitoring automatically when
    // YouTube tab capture or browser sharing ends.
    if (!this.disposed) {
      this.monitor.gain.cancelScheduledValues(
        this.context.currentTime
      );

      this.monitor.gain.setTargetAtTime(
        this.muted ? 0 : this.volume,
        this.context.currentTime,
        0.02
      );
    }

    const anotherProgramSourceIsActive =
      this.auto ||
      this.micLive ||
      this.instrumentLive ||
      this.decks.some(
        deck =>
          !deck.audio.paused &&
          !deck.audio.ended
      );

    const youtubeOwnsAutomaticRecording =
      this.youtubeAutoStartedRecording;

    this.youtubeAutoStartedRecording = false;

    if (
      autoFinishRecording &&
      this.autoRecord &&
      this.recording &&
      (
        youtubeOwnsAutomaticRecording ||
        !anotherProgramSourceIsActive
      )
    ) {
      await this.finishRecording();
    }

    if (showMessage) {
      this.report(
        this.recording
          ? "YOUTUBE TAB AUDIO: OFF. Another active source remains in the current recording."
          : "YOUTUBE TAB AUDIO: OFF. Automatic recording was finalized and is ready to download."
      );
    }
  }

  async startYouTubeCapture() {
    await this.resume();
    await this.releaseYouTubeCapture(false, false);

    // SOLO_YOUTUBE_ORIGINAL_PLAYBACK_V5
    //
    // DIRECT MODE:
    //
    // Chrome keeps the ORIGINAL YouTube tab playing locally.
    //
    // Solo Beats captures the same tab audio separately for
    // recording and live broadcast.
    //
    // The captured DIRECT signal is NOT returned to the
    // local speakers, preventing double playback.
    const displayOptions = {
      video: true,
      audio: {
        suppressLocalAudioPlayback: false,
      },
    } as DisplayMediaStreamOptions & {
      audio:
        | boolean
        | (MediaTrackConstraints & {
            suppressLocalAudioPlayback?: boolean;
          });
    };

    const stream =
      await navigator.mediaDevices.getDisplayMedia(
        displayOptions
      );

    if (this.disposed) {
      stream.getTracks().forEach(track =>
        track.stop()
      );

      return;
    }

    const audioTrack =
      stream.getAudioTracks()[0];

    if (!audioTrack) {
      stream.getTracks().forEach(track =>
        track.stop()
      );

      throw new Error(
        "No tab audio was shared. Choose the YouTube tab and turn ON Share tab audio."
      );
    }

    // Chrome may return display video and tab audio in the same
    // stream. Isolate the audio track before Web Audio routing.
    audioTrack.enabled = true;

    await this.context.resume();

    const audioOnlyStream =
      new MediaStream([
        audioTrack,
      ]);

    this.youtubeCaptureStream = stream;

    // SOLO_YOUTUBE_ORIGINAL_PLAYBACK_V5
    //
    // Chrome-specific extended constraint.
    //
    // Captured audio remains available to Solo Beats while
    // Chrome keeps the original YouTube speaker playback.
    try {
      const supported =
        navigator.mediaDevices.getSupportedConstraints();

      const extendedSupported =
        supported as MediaTrackSupportedConstraints & {
          suppressLocalAudioPlayback?: boolean;
        };

      if (extendedSupported.suppressLocalAudioPlayback) {
        const audioTrack =
          stream.getAudioTracks()[0];

        if (audioTrack) {
          const constraints = {
            suppressLocalAudioPlayback: false,
          } as MediaTrackConstraints & {
            suppressLocalAudioPlayback: boolean;
          };

          await audioTrack.applyConstraints(
            constraints
          );
        }
      }
    } catch (error) {
      console.warn(
        "YouTube local playback suppression unavailable:",
        error
      );
    }

    this.youtubeCaptureSource =
      this.context.createMediaStreamSource(
        audioOnlyStream
      );

    this.youtubeCaptureSource.connect(
      this.youtubeCaptureGain
    );

    this.youtubeCaptureActive = true;
    this.applyYouTubeCaptureLevel();
    this.applyYouTubeMonitorLevel();

    // SOLO_AUTOMATIC_ECHO_GUARD_V1
    // Chrome already plays the shared YouTube tab directly.
    // Mute only the duplicate turntable speaker-monitor path.
    // Recording and live-broadcast output remain fully active.
    this.monitor.gain.cancelScheduledValues(
      this.context.currentTime
    );

    this.monitor.gain.setTargetAtTime(
      0,
      this.context.currentTime,
      0.01
    );

    // SOLO_YOUTUBE_AUTO_RECORD_V1
    if (
      this.autoRecord &&
      !this.recording &&
      !this.finishing
    ) {
      if (!this.saved) {
        await this.releaseYouTubeCapture(
          false,
          false
        );

        throw new Error(
          "Download the previous session WAV before starting another automatic recording."
        );
      }

      await this.startRecording();

      this.youtubeAutoStartedRecording =
        this.recording;

      if (!this.recording) {
        await this.releaseYouTubeCapture(
          false,
          false
        );

        throw new Error(
          "YouTube capture started, but automatic recording could not start."
        );
      }
    }

    audioTrack.onended = () => {
      if (!this.youtubeCaptureActive) {
        return;
      }

      void this.releaseYouTubeCapture(
        false
      );

      this.report(
        "YOUTUBE TAB AUDIO: OFF because browser sharing ended."
      );
    };

    const videoTrack =
      stream.getVideoTracks()[0];

    if (videoTrack) {
      videoTrack.onended = () => {
        if (!this.youtubeCaptureActive) {
          return;
        }

        void this.releaseYouTubeCapture(
          false
        );

        this.report(
          "YOUTUBE TAB AUDIO: OFF because browser sharing ended."
        );
      };
    }

    this.report(
      "YOUTUBE TAB AUDIO: LIVE. Automatic Echo Guard is active. Clean tab audio is in the master recording and broadcast."
    );
  }

  // SOLO_STUDIO_PHASE2
  setTalkover(enabled: boolean) {
    this.talkover = enabled;

    if (this.micLive) {
      this.applyTalkover();
    } else {
      this.restoreDeckLevels();
    }

    this.applyYouTubeCaptureLevel();

    this.report(
      enabled
        ? "Talkover ON. Decks and captured YouTube audio will duck while MIC is LIVE."
        : "Talkover OFF. Mic, decks, and captured YouTube audio remain at normal channel levels."
    );
  }

  setTalkoverAmount(value: number) {
    this.talkoverAmount =
      Math.max(0, Math.min(1, value));

    if (this.micLive && this.talkover) {
      this.applyTalkover();
    }

    this.applyYouTubeCaptureLevel();

    this.report(
      `Talkover deck level set to ${Math.round(this.talkoverAmount * 100)}%.`
    );
  }

  applyTalkover() {
    if (!this.micLive || !this.talkover) {
      this.restoreDeckLevels();
      return;
    }

    this.decks.forEach((deck, index) => {
      if (this.deckMuted[index]) {
        deck.level.gain.setTargetAtTime(
          0,
          this.context.currentTime,
          0.03
        );

        return;
      }

      deck.level.gain.setTargetAtTime(
        this.talkoverAmount,
        this.context.currentTime,
        0.08
      );
    });
  }

  restoreDeckLevels() {
    this.applyYouTubeCaptureLevel();

    this.decks.forEach((deck, index) => {
      const target =
        this.deckMuted[index]
          ? 0
          : 1;

      deck.level.gain.setTargetAtTime(
        target,
        this.context.currentTime,
        0.08
      );
    });
  }

  setDeckMuted(side: number, muted: boolean) {
    if (side !== 0 && side !== 1) return;

    this.deckMuted[side] = muted;

    if (muted) {
      this.decks[side].level.gain.setTargetAtTime(
        0,
        this.context.currentTime,
        0.02
      );
    } else if (this.micLive && this.talkover) {
      this.decks[side].level.gain.setTargetAtTime(
        this.talkoverAmount,
        this.context.currentTime,
        0.02
      );
    } else {
      this.decks[side].level.gain.setTargetAtTime(
        1,
        this.context.currentTime,
        0.02
      );
    }
  }

  private meterFromAnalyser(
    analyser: AnalyserNode
  ) {
    const data =
      new Uint8Array(analyser.fftSize);

    analyser.getByteTimeDomainData(data);

    let sum = 0;

    for (let i = 0; i < data.length; i++) {
      const normalized =
        (data[i] - 128) / 128;

      sum +=
        normalized * normalized;
    }

    const rms =
      Math.sqrt(sum / data.length);

    return Math.max(
      0,
      Math.min(1, rms * 3.2)
    );
  }

  updateYouTubeRecordingPlayback(
    level: number
  ) {
    const ownsRecording =
      this.youtubeCaptureActive &&
      this.youtubeAutoStartedRecording &&
      this.autoRecord &&
      this.recording &&
      !!this.recorder;

    if (!ownsRecording) {
      this.youtubeSilenceStarted = 0;
      return;
    }

    // A paused Chrome tab produces digital silence. This very
    // low threshold avoids reacting to normal quiet music.
    const hasAudioSignal = level > 0.001;

    if (hasAudioSignal) {
      this.youtubeSilenceStarted = 0;

      if (this.youtubeRecordingPaused) {
        if (this.youtubePausedAt > 0) {
          this.youtubePausedSeconds +=
            this.context.currentTime -
            this.youtubePausedAt;
        }

        this.youtubePausedAt = 0;
        this.youtubeRecordingPaused = false;

        this.recorder?.port.postMessage({
          action: "resume",
          id: this.recordId,
        });

        this.report(
          "YOUTUBE PLAYBACK RESUMED. Session recording continued automatically."
        );
      }

      return;
    }

    if (!this.youtubeSilenceStarted) {
      this.youtubeSilenceStarted =
        this.context.currentTime;

      return;
    }

    if (
      !this.youtubeRecordingPaused &&
      this.context.currentTime -
        this.youtubeSilenceStarted >=
        this.youtubeSilenceDelay
    ) {
      this.youtubeRecordingPaused = true;
      this.youtubePausedAt =
        this.context.currentTime;

      this.recorder?.port.postMessage({
        action: "pause",
        id: this.recordId,
      });

      this.report(
        "YOUTUBE VIDEO PAUSED. Session recording is automatically paused and waiting for playback."
      );
    }
  }

  recordingElapsedSeconds() {
    if (!this.recording) {
      return 0;
    }

    const currentPause =
      this.youtubeRecordingPaused &&
      this.youtubePausedAt > 0
        ? this.context.currentTime -
          this.youtubePausedAt
        : 0;

    return Math.max(
      0,
      this.context.currentTime -
        this.recordStarted -
        this.youtubePausedSeconds -
        currentPause
    );
  }

  updateMeters() {
    if (this.deckAnalysers[0]) {
      this.meterData.deckA =
        this.meterFromAnalyser(
          this.deckAnalysers[0]
        );
    }

    if (this.deckAnalysers[1]) {
      this.meterData.deckB =
        this.meterFromAnalyser(
          this.deckAnalysers[1]
        );
    }

    this.meterData.mic =
      this.micLive
        ? this.meterFromAnalyser(
            this.micAnalyser
          )
        : 0;

    this.meterData.instrument =
      this.instrumentLive
        ? this.meterFromAnalyser(
            this.instrumentAnalyser
          )
        : 0;

    this.meterData.youtube =
      this.youtubeCaptureActive
        ? this.meterFromAnalyser(
            this.youtubeCaptureAnalyser
          )
        : 0;

    this.updateYouTubeRecordingPlayback(
      this.meterData.youtube
    );

    this.meterData.master =
      this.meterFromAnalyser(
        this.analyser
      );
  }
  async startRecording() {
    if (
      this.recording ||
      this.finishing ||
      this.finalizeTask
    ) {
      return;
    }

    const generation = this.generation;

    await this.resume();
    await clearRecordingChunks();

    if (!this.recorder) {
      await this.context.audioWorklet.addModule(
        "/solo-beats/turntable-recorder.js"
      );

      if (
        this.disposed ||
        generation !== this.generation
      ) {
        return;
      }

      this.recorder =
        new AudioWorkletNode(
          this.context,
          "solo-pcm-recorder",
          {
            channelCount: 2,
            channelCountMode: "explicit",
          }
        );

      const silence =
        this.context.createGain();

      silence.gain.value = 0;

      this.master.connect(this.recorder);
      this.recorder.connect(silence);
      silence.connect(
        this.context.destination
      );

      this.recorder.port.onmessage =
        ({ data }) => {
          if (data.id !== this.recordId) {
            return;
          }

          if (data.pcm) {
            const chunk: StoredRecordingChunk = {
              index:
                this.recordingChunkIndex++,
              blob: new Blob([data.pcm]),
            };

            this.recordingBytes +=
              data.pcm.byteLength;

            this.recordingWrites =
              this.recordingWrites
                .then(() =>
                  storeRecordingChunk(
                    chunk
                  )
                )
                .catch(() => {
                  // Emergency fallback preserves the chunk
                  // if browser storage briefly fails.
                  this.emergencyChunks.push(
                    chunk
                  );

                  this.report(
                    "Recording storage warning: a chunk is temporarily being protected in memory."
                  );
                });
          }

          if (data.done) {
            void this.completeRecording(
              data.reason === "limit"
            ).catch(error => {
              this.report(
                error instanceof Error
                  ? error.message
                  : "The recording could not be finalized."
              );
            });
          }
        };
    }

    if (
      this.disposed ||
      generation !== this.generation
    ) {
      return;
    }

    if (this.recordingUrl) {
      URL.revokeObjectURL(
        this.recordingUrl
      );
    }

    this.recordingUrl = "";
    this.recordingChunkIndex = 0;
    this.recordingBytes = 0;
    this.recordingWrites =
      Promise.resolve();
    this.emergencyChunks = [];
    this.saved = false;
    this.recording = true;
    this.youtubeRecordingPaused = false;
    this.youtubeSilenceStarted = 0;
    this.youtubePausedAt = 0;
    this.youtubePausedSeconds = 0;

    this.recordStarted =
      this.context.currentTime;

    this.recordId++;

    this.recorder.port.postMessage({
      action: "start",
      id: this.recordId,
    });

    this.report(
      "SESSION RECORDING: ON. Audio chunks are being protected in browser storage."
    );
  }

  completeRecording(
    limit = false
  ): Promise<void> {
    if (this.finalizeTask) {
      return this.finalizeTask;
    }

    if (
      !this.recording &&
      !this.finishing
    ) {
      return Promise.resolve();
    }

    this.recording = false;
    this.finishing = true;

    this.finalizeTask =
      (async () => {
        try {
          await this.recordingWrites;

          const stored =
            await readRecordingChunks();

          const combined = [
            ...stored,
            ...this.emergencyChunks,
          ].sort(
            (left, right) =>
              left.index - right.index
          );

          const recording =
            wavBlob(
              combined.map(
                chunk => chunk.blob
              ),
              this.recordingBytes,
              this.context.sampleRate
            );

          this.recordingUrl =
            URL.createObjectURL(
              recording
            );

          this.recordingName =
            "SoloBeats-DJ-Session-" +
            new Date()
              .toISOString()
              .replace(/[:.]/g, "-") +
            ".wav";

          this.emergencyChunks = [];

          await clearRecordingChunks();

          this.report(
            limit
              ? "Session recording stopped by the WAV size limit and is ready to download."
              : "DJ session recording ready. Click Download Session WAV to save it."
          );
        } finally {
          this.recording = false;
          this.finishing = false;

          this.finishResolve?.();
          this.finishResolve = null;

          this.finalizeTask = null;
        }
      })();

    return this.finalizeTask;
  }

  finishRecording(): Promise<void> {
    if (this.finishTask) {
      return this.finishTask;
    }

    if (
      !this.recording &&
      !this.finishing
    ) {
      return Promise.resolve();
    }

    this.finishing = true;

    const done =
      new Promise<void>(resolve => {
        this.finishResolve = resolve;
      });

    this.recorder?.port.postMessage({
      action: "stop",
      id: this.recordId,
    });

    this.finishTask =
      (async () => {
        let timeout:
          ReturnType<typeof setTimeout> |
          undefined;

        try {
          await Promise.race([
            done,
            new Promise<void>(
              resolve => {
                timeout = setTimeout(
                  resolve,
                  10000
                );
              }
            ),
          ]);

          if (this.finishing) {
            await this.completeRecording();

            this.recordId++;

            this.report(
              "Recording recovered after an audio interruption. Download and check the WAV."
            );
          }
        } finally {
          if (timeout) {
            clearTimeout(timeout);
          }

          this.finishTask = null;
        }
      })();

    return this.finishTask;
  }
  async stopAll() {
    this.stopAuto();
    this.decks.forEach(deck => { deck.audio.pause(); deck.cueOn = false; deck.cue.gain.value = 0; });
    await this.finishRecording();
  }
  async dispose() {
    this.disposed = true; clearInterval(this.timer);
    await this.stopAll();
    this.headphones.pause(); this.headphones.srcObject = null;

    this.micLive = false;
    this.micGain.gain.value = 0;

    if (this.micStream) {
      this.micStream
        .getTracks()
        .forEach(track => track.stop());

      this.micStream = null;
    }

    try {
      this.micSource?.disconnect();
    } catch {
      // Already disconnected.
    }

    this.micSource = null;

    await this.releaseInstrumentInput();
    await this.releaseYouTubeCapture(false, false);

    this.decks.forEach(deck => {
      deck.audio.onerror = null;
      deck.audio.removeAttribute("src"); deck.audio.load();
      if (deck.url) URL.revokeObjectURL(deck.url);
    });
    if (this.recordingUrl) URL.revokeObjectURL(this.recordingUrl);
    this.output.stream.getTracks().forEach(track => track.stop());
    this.cueOutput.stream.getTracks().forEach(track => track.stop());
    await this.context.close();
  }
}











