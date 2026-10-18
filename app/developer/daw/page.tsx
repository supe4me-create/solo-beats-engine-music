"use client";
// SOLO_DAW_RED_END_INDEPENDENT_V5_4
// RED END changes sourceEndOffset only.
// START remains independent.
// Clip position and clip geometry remain fixed.
// SOLO_DAW_PLAYLIST_16C_V7_V5_2_COMPLETE
// SOLO_DAW_BOTTOM_RED_END_V5_3
// Bottom MP3 RED END hit target reinforced.
// START, clip geometry and top playhead preserved.
// Independent START + RED END marker architecture.
// START = sourceStartOffset.
// RED END = sourceEndOffset.
// Clip geometry stays fixed.
// SOLO_DAW_PLAYLIST_16C_V7_V4_FIXED_START_MARKER
// START adjusts internal audio source position.
// startTime remains fixed.
// Whole-clip drag remains a separate operation.
// SOLO_DAW_PLAYLIST_16C_V7_V3_FL_START
// START now displays the real trimmed source range.
// The visible waveform follows trimStart / trimEnd.
// Red playhead uses active timeline zoom.

import "../../../lib/firebaseClient";

import {
  ChangeEvent,
  PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  getAuth,
  onAuthStateChanged,
  type User,
} from "firebase/auth";

const OWNER_EMAIL = "supe4.me@gmail.com";
const MAX_TRACKS = 20;

// SOLO_DAW_TIMELINE_16B_V1
const TIMELINE_PIXELS_PER_SECOND = 28;
const TIMELINE_MIN_SECONDS = 30;
const TIMELINE_SNAP_SECONDS = 0.25;

type DawTrack = {
  id: string;
  file: File;
  name: string;
  buffer: AudioBuffer | null;
  startTime: number;

  // SOLO_DAW_PLAYLIST_16C_V3
  trimStart: number;
  trimEnd: number;

  // SOLO_DAW_PLAYLIST_16C_V7_V5_INDEPENDENT_START
  sourceStartOffset?: number;

  // SOLO_DAW_PLAYLIST_16C_V7_V5_2_INDEPENDENT_END
  // Independent internal RED / END marker.
  // Does not change clip geometry.
  sourceEndOffset?: number;

  // SOLO_DAW_PLAYLIST_16C_V6_FADES
  fadeIn: number;
  fadeOut: number;

  // SOLO_DAW_PLAYLIST_16C_V7_CROSSFADE
  crossfadeIn: number;

  volume: number;
  pan: number;
  muted: boolean;
  solo: boolean;
  loading: boolean;
  error: string;
};

function makeId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random()}`;
}

function cleanName(name: string) {
  return name.replace(/\.[^.]+$/, "");
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "0:00";
  }

  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60);

  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

function Waveform({
  buffer,
  trimStart = 0,
  trimEnd,
}: {
  buffer: AudioBuffer | null;
  trimStart?: number;
  trimEnd?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas || !buffer) {
      return;
    }

    const ctx = canvas.getContext("2d");

    if (!ctx) {
      return;
    }

    const ratio = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    canvas.width = Math.max(1, Math.floor(width * ratio));
    canvas.height = Math.max(1, Math.floor(height * ratio));

    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

    ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = "#080b13";
    ctx.fillRect(0, 0, width, height);

    const data = buffer.getChannelData(0);

    // SOLO_DAW_PLAYLIST_16C_V7_V3_REAL_TRIMMED_WAVEFORM
    // Convert the visible audio source range into sample indexes.
    // This makes START expose/remove audio instead of visually
    // squeezing the complete waveform into the clip.
    const safeTrimStart = Math.max(
      0,
      Math.min(
        buffer.duration,
        Number.isFinite(trimStart)
          ? trimStart
          : 0
      )
    );

    const requestedTrimEnd =
      Number.isFinite(trimEnd)
        ? (trimEnd as number)
        : buffer.duration;

    const safeTrimEnd = Math.max(
      safeTrimStart,
      Math.min(
        buffer.duration,
        requestedTrimEnd
      )
    );

    const sourceStartSample = Math.max(
      0,
      Math.min(
        data.length - 1,
        Math.floor(
          safeTrimStart *
          buffer.sampleRate
        )
      )
    );

    const sourceEndSample = Math.max(
      sourceStartSample + 1,
      Math.min(
        data.length,
        Math.ceil(
          safeTrimEnd *
          buffer.sampleRate
        )
      )
    );

    const visibleSampleCount = Math.max(
      1,
      sourceEndSample -
      sourceStartSample
    );

    const middle = height / 2;
    const columns = Math.max(
      1,
      Math.floor(width)
    );

    const samplesPerColumn = Math.max(
      1,
      Math.floor(
        visibleSampleCount /
        columns
      )
    );

    ctx.strokeStyle = "#22d3ee";
    ctx.lineWidth = 1;

    ctx.beginPath();

    for (let x = 0; x < columns; x += 1) {
      const start =
        sourceStartSample +
        Math.floor(
          (
            x /
            columns
          ) *
          visibleSampleCount
        );

      const nextColumn =
        sourceStartSample +
        Math.floor(
          (
            (x + 1) /
            columns
          ) *
          visibleSampleCount
        );

      const end = Math.min(
        sourceEndSample,
        Math.max(
          start + samplesPerColumn,
          nextColumn
        )
      );

      let min = 1;
      let max = -1;

      for (let i = start; i < end; i += 1) {
        const value = data[i];

        if (value < min) min = value;
        if (value > max) max = value;
      }

      if (min === 1 && max === -1) {
        min = 0;
        max = 0;
      }

      const y1 =
        middle +
        min *
        middle *
        0.88;

      const y2 =
        middle +
        max *
        middle *
        0.88;

      ctx.moveTo(
        x + 0.5,
        y1
      );

      ctx.lineTo(
        x + 0.5,
        y2
      );
    }

    ctx.stroke();

    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.beginPath();
    ctx.moveTo(0, middle);
    ctx.lineTo(width, middle);
    ctx.stroke();
  }, [
    buffer,
    trimStart,
    trimEnd,
  ]);

  return (
    <canvas
      ref={canvasRef}
      className="h-20 w-full rounded-xl border border-white/10"
    />
  );
}

export default function OwnerDawPage() {
  const [user, setUser] =
    useState<User | null>(null);

  const [authReady, setAuthReady] =
    useState(false);

  const [tracks, setTracks] =
    useState<DawTrack[]>([]);

  // SOLO_DAW_PLAYLIST_16C_V2
  const [selectedTrackId, setSelectedTrackId] =
    useState<string | null>(null);

  // SOLO_DAW_PLAYLIST_16C_V4
  const [selectedTrackIds, setSelectedTrackIds] =
    useState<string[]>([]);

  const [copiedTracks, setCopiedTracks] =
    useState<DawTrack[]>([]);

  // SOLO_DAW_PLAYLIST_16C_V5_HISTORY
  const undoHistoryRef =
    useRef<DawTrack[][]>([]);

  const redoHistoryRef =
    useRef<DawTrack[][]>([]);

  const [, setHistoryVersion] =
    useState(0);

  // SOLO_DAW_PLAYLIST_16C_V3
  const [timelineZoom, setTimelineZoom] =
    useState(1);

  const [timelineSnapSeconds, setTimelineSnapSeconds] =
    useState(0.25);

  const timelinePixelsPerSecond: number =
    TIMELINE_PIXELS_PER_SECOND *
    timelineZoom;

  function snapTimeline(
    seconds: number
  ) {
    const safe =
      Math.max(0, seconds);

    if (timelineSnapSeconds <= 0) {
      return safe;
    }

    return (
      Math.round(
        safe /
          timelineSnapSeconds
      ) *
      timelineSnapSeconds
    );
  }

  const [masterVolume, setMasterVolume] =
    useState(0.8);

  const [transport, setTransport] =
    useState<"stopped" | "playing" | "paused">(
      "stopped"
    );

  const [position, setPosition] =
    useState(0);

  const [message, setMessage] =
    useState("DAW READY.");

  const audioContextRef =
    useRef<AudioContext | null>(null);

  const sourceNodesRef =
    useRef<AudioBufferSourceNode[]>([]);

  const startedAtRef =
    useRef(0);

  const offsetRef =
    useRef(0);

  const animationRef =
    useRef<number | null>(null);

  const fileInputRef =
    useRef<HTMLInputElement | null>(null);

  const tracksRef =
    useRef<DawTrack[]>([]);

  // SOLO_DAW_PLAYHEAD_DRAG_V1_REF
  const playheadDragRef = useRef<{
    pointerId: number;
    timelineLeft: number;
    moved: boolean;
  } | null>(null);

  const clipDragRef =
    useRef<{
      id: string;
      pointerId: number;
      startX: number;
      originalStart: number;
      moved: boolean;
    } | null>(null);

  const clipTrimRef =
    useRef<{
      id: string;
      pointerId: number;
      side: "left" | "right";
      startX: number;
      originalStart: number;
      originalTrimStart: number;
      originalTrimEnd: number;
    } | null>(null);

  // SOLO_DAW_PLAYLIST_16C_V7_V5_2_END_MARKER_DRAG
  const clipEndMarkerRef =
    useRef<{
      id: string;
      pointerId: number;
      startX: number;
      originalOffset: number;
      moved: boolean;
    } | null>(null);

  const clipStartMarkerRef =
    useRef<{
      id: string;
      pointerId: number;
      startX: number;
      originalOffset: number;
      moved: boolean;
    } | null>(null);

  const masterVolumeRef =
    useRef(masterVolume);

  // SOLO_DAW_MASTER_BUS_V2
  const masterGainNodeRef =
    useRef<GainNode | null>(null);

  useEffect(() => {
    tracksRef.current = tracks;
  }, [tracks]);

  useEffect(() => {
    masterVolumeRef.current = masterVolume;
  }, [masterVolume]);

  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        getAuth(),
        currentUser => {
          setUser(currentUser);
          setAuthReady(true);
        }
      );

    return unsubscribe;
  }, []);

  const isOwner =
    user?.email?.toLowerCase() ===
    OWNER_EMAIL.toLowerCase();

  function getContext() {
    if (!audioContextRef.current) {
      audioContextRef.current =
        new AudioContext();
    }

    const ctx =
      audioContextRef.current;

    if (!masterGainNodeRef.current) {
      const master =
        ctx.createGain();

      master.gain.value =
        masterVolumeRef.current;

      master.connect(
        ctx.destination
      );

      masterGainNodeRef.current =
        master;
    }

    return ctx;
  }

  function stopSources() {
    for (const source of sourceNodesRef.current) {
      try {
        source.stop();
      }
      catch {}
    }

    sourceNodesRef.current = [];
  }

  function stopAnimation() {
    if (animationRef.current !== null) {
      cancelAnimationFrame(
        animationRef.current
      );

      animationRef.current = null;
    }
  }

  function projectDuration() {
    return tracksRef.current.reduce(
      (max, track) =>
        Math.max(
          max,
          track.startTime +
            (track.buffer?.duration || 0)
        ),
      0
    );
  }

  function updateClock() {
    const ctx =
      audioContextRef.current;

    if (!ctx) {
      return;
    }

    const elapsed =
      ctx.currentTime -
      startedAtRef.current;

    const next =
      offsetRef.current + elapsed;

    const duration =
      projectDuration();

    if (
      duration > 0 &&
      next >= duration
    ) {
      stopSources();
      stopAnimation();

      offsetRef.current = 0;
      setPosition(0);
      setTransport("stopped");
      setMessage("PLAYBACK FINISHED.");
      return;
    }

    setPosition(next);

    animationRef.current =
      requestAnimationFrame(
        updateClock
      );
  }

  async function addFiles(
    files: FileList | File[]
  ) {
    const incoming =
      Array.from(files).filter(file =>
        file.type.startsWith("audio/") ||
        /\.(wav|mp3|flac|m4a|aac|ogg)$/i.test(
          file.name
        )
      );

    if (!incoming.length) {
      setMessage(
        "NO SUPPORTED AUDIO FILES SELECTED."
      );
      return;
    }

    const available =
      MAX_TRACKS - tracksRef.current.length;

    if (available <= 0) {
      setMessage(
        `MAXIMUM ${MAX_TRACKS} TRACKS REACHED.`
      );
      return;
    }

    const accepted =
      incoming.slice(0, available);

    const newTracks: DawTrack[] =
      accepted.map(file => ({
        id: makeId(),
        file,
        name: cleanName(file.name),
        buffer: null,
        startTime: 0,
        trimStart: 0,
        trimEnd: 0,
        sourceStartOffset: 0,
        sourceEndOffset: 0,
        fadeIn: 0,
        fadeOut: 0,
        crossfadeIn: 0,
        volume: 0.8,
        pan: 0,
        muted: false,
        solo: false,
        loading: true,
        error: "",
      }));

    setTracks(current => [
      ...current,
      ...newTracks,
    ]);

    setMessage(
      `DECODING ${newTracks.length} TRACK${
        newTracks.length === 1 ? "" : "S"
      }...`
    );

    const ctx = getContext();

    for (const track of newTracks) {
      try {
        const bytes =
          await track.file.arrayBuffer();

        const decoded =
          await ctx.decodeAudioData(
            bytes.slice(0)
          );

        setTracks(current =>
          current.map(item =>
            item.id === track.id
              ? {
                  ...item,
                  buffer: decoded,
                  trimStart: 0,
                  trimEnd: decoded.duration,
                  sourceStartOffset: 0,
                  sourceEndOffset: decoded.duration,
                  loading: false,
                }
              : item
          )
        );
      }
      catch (error) {
        console.error(error);

        setTracks(current =>
          current.map(item =>
            item.id === track.id
              ? {
                  ...item,
                  loading: false,
                  error:
                    "Browser could not decode this audio file.",
                }
              : item
          )
        );
      }
    }

    setMessage("TRACKS READY.");
  }

  function seekTo(nextPosition: number) {
    const duration = projectDuration();

    const next = Math.max(
      0,
      Math.min(
        duration || 0,
        nextPosition
      )
    );

    const wasPlaying =
      transport === "playing";

    stopSources();
    stopAnimation();

    offsetRef.current = next;
    setPosition(next);

    if (wasPlaying) {
      window.setTimeout(() => {
        void play();
      }, 0);
    }
  }

  function setClipStart(
    id: string,
    startTime: number
  ) {
    const next =
      snapTimeline(startTime);

    pushUndoSnapshot();

    const wasPlaying =
      transport === "playing";

    if (wasPlaying) {
      pause();
    }

    setTracks(current =>
      current.map(track =>
        track.id === id
          ? {
              ...track,
              startTime: next,
            }
          : track
      )
    );

    setMessage(
      `CLIP MOVED TO ${formatTime(next)}.`
    );

    if (wasPlaying) {
      window.setTimeout(() => {
        void play();
      }, 0);
    }
  }

  function moveClipBy(
    id: string,
    seconds: number
  ) {
    const track =
      tracksRef.current.find(
        item => item.id === id
      );

    if (!track) return;

    setClipStart(
      id,
      track.startTime + seconds
    );
  }

  // SOLO_DAW_PLAYLIST_16C_V2_DRAG
  function beginClipDrag(
    event: ReactPointerEvent<HTMLDivElement>,
    id: string
  ) {
    event.preventDefault();
    event.stopPropagation();

    const track =
      tracksRef.current.find(
        item => item.id === id
      );

    if (!track) return;

    selectSingleTrack(id);

    pushUndoSnapshot();

    clipDragRef.current = {
      id,
      pointerId: event.pointerId,
      startX: event.clientX,
      originalStart: track.startTime,
      moved: false,
    };

    try {
      event.currentTarget.setPointerCapture(
        event.pointerId
      );
    }
    catch {}
  }

  function moveClipDrag(
    event: ReactPointerEvent<HTMLDivElement>,
    id: string
  ) {
    const drag = clipDragRef.current;

    if (
      !drag ||
      drag.id !== id ||
      drag.pointerId !== event.pointerId
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const deltaPixels =
      event.clientX - drag.startX;

    if (Math.abs(deltaPixels) >= 2) {
      drag.moved = true;
    }

    const rawStart =
      drag.originalStart +
      deltaPixels /
        timelinePixelsPerSecond;

    const snappedStart =
      snapTimeline(rawStart);

    setTracks(current =>
      current.map(track =>
        track.id === id
          ? {
              ...track,
              startTime: snappedStart,
            }
          : track
      )
    );
  }

  function endClipDrag(
    event: ReactPointerEvent<HTMLDivElement>,
    id: string
  ) {
    const drag = clipDragRef.current;

    if (
      !drag ||
      drag.id !== id ||
      drag.pointerId !== event.pointerId
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    try {
      event.currentTarget.releasePointerCapture(
        event.pointerId
      );
    }
    catch {}

    const finalTrack =
      tracksRef.current.find(
        item => item.id === id
      );

    if (drag.moved && finalTrack) {
      setMessage(
        `CLIP MOVED TO ${formatTime(
          finalTrack.startTime
        )}.`
      );
    }

    clipDragRef.current = null;
  }

  // SOLO_DAW_PLAYLIST_16C_V5_HISTORY
  function cloneTrackSnapshot(
    source: DawTrack[]
  ) {
    return source.map(track => ({
      ...track,
    }));
  }

  function refreshHistoryControls() {
    setHistoryVersion(
      current => current + 1
    );
  }

  function pushUndoSnapshot(
    snapshot?: DawTrack[]
  ) {
    const source =
      snapshot ||
      tracksRef.current;

    undoHistoryRef.current = [
      ...undoHistoryRef.current.slice(-49),
      cloneTrackSnapshot(source),
    ];

    redoHistoryRef.current = [];

    refreshHistoryControls();
  }

  function undoPlaylistEdit() {
    const history =
      undoHistoryRef.current;

    if (!history.length) {
      setMessage("NOTHING TO UNDO.");
      return;
    }

    const previous =
      history[history.length - 1];

    undoHistoryRef.current =
      history.slice(0, -1);

    redoHistoryRef.current = [
      ...redoHistoryRef.current.slice(-49),
      cloneTrackSnapshot(
        tracksRef.current
      ),
    ];

    if (transport === "playing") {
      pause();
    }

    setTracks(
      cloneTrackSnapshot(previous)
    );

    setSelectedTrackId(null);
    setSelectedTrackIds([]);

    setMessage("UNDO.");

    refreshHistoryControls();
  }

  function redoPlaylistEdit() {
    const history =
      redoHistoryRef.current;

    if (!history.length) {
      setMessage("NOTHING TO REDO.");
      return;
    }

    const next =
      history[history.length - 1];

    redoHistoryRef.current =
      history.slice(0, -1);

    undoHistoryRef.current = [
      ...undoHistoryRef.current.slice(-49),
      cloneTrackSnapshot(
        tracksRef.current
      ),
    ];

    if (transport === "playing") {
      pause();
    }

    setTracks(
      cloneTrackSnapshot(next)
    );

    setSelectedTrackId(null);
    setSelectedTrackIds([]);

    setMessage("REDO.");

    refreshHistoryControls();
  }

  function selectAllClips() {
    const ids =
      tracksRef.current.map(
        track => track.id
      );

    if (!ids.length) {
      return;
    }

    setSelectedTrackIds(ids);
    setSelectedTrackId(
      ids[0] || null
    );

    setMessage(
      `SELECTED ${ids.length} CLIP${
        ids.length === 1
          ? ""
          : "S"
      }.`
    );
  }

  // SOLO_DAW_PLAYLIST_16C_V4
  function selectSingleTrack(
    id: string
  ) {
    setSelectedTrackId(id);
    setSelectedTrackIds([id]);
  }

  function toggleClipSelection(
    id: string
  ) {
    setSelectedTrackIds(current => {
      if (current.includes(id)) {
        const next =
          current.filter(
            item => item !== id
          );

        setSelectedTrackId(
          next[0] || null
        );

        return next;
      }

      setSelectedTrackId(id);

      return [
        ...current,
        id,
      ];
    });
  }

  // SOLO_DAW_VISIBLE_UNDO_REDO_V5
  function triggerPlaylistUndo() {
    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "z",
        code: "KeyZ",
        ctrlKey: true,
        bubbles: true,
      })
    );
  }

  function triggerPlaylistRedo() {
    window.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "y",
        code: "KeyY",
        ctrlKey: true,
        bubbles: true,
      })
    );
  }

  function clearClipSelection() {
    setSelectedTrackId(null);
    setSelectedTrackIds([]);
  }

  function splitSelectedClipAtPlayhead() {
    if (!selectedTrackId) {
      setMessage(
        "SELECT A CLIP TO SPLIT."
      );
      return;
    }

    const source =
      tracksRef.current.find(
        track =>
          track.id ===
          selectedTrackId
      );

    if (
      !source ||
      !source.buffer
    ) {
      return;
    }

    const clipDuration =
      Math.max(
        0,
        source.trimEnd -
          source.trimStart
      );

    const clipStart =
      source.startTime;

    const clipEnd =
      clipStart +
      clipDuration;

    const splitPosition =
      snapTimeline(position);

    const minimumSide =
      timelineSnapSeconds > 0
        ? Math.min(
            timelineSnapSeconds,
            0.25
          )
        : 0.05;

    if (
      splitPosition <=
        clipStart + minimumSide ||
      splitPosition >=
        clipEnd - minimumSide
    ) {
      setMessage(
        "MOVE THE PLAYHEAD INSIDE THE SELECTED CLIP."
      );
      return;
    }

    if (
      tracksRef.current.length >=
      MAX_TRACKS
    ) {
      setMessage(
        `MAXIMUM ${MAX_TRACKS} TRACKS REACHED.`
      );
      return;
    }

    const wasPlaying =
      transport === "playing";

    if (wasPlaying) {
      pause();
    }

    pushUndoSnapshot();

    const rightId =
      makeId();

    const sourceSplitPoint =
      source.trimStart +
      (
        splitPosition -
        clipStart
      );

    const leftClip: DawTrack = {
      ...source,
      trimEnd:
        sourceSplitPoint,
    };

    const rightClip: DawTrack = {
      ...source,
      id: rightId,
      name:
        `${source.name} SPLIT`,
      startTime:
        splitPosition,
      trimStart:
        sourceSplitPoint,
      trimEnd:
        source.trimEnd,
      loading: false,
      error: "",
    };

    setTracks(current =>
      current.flatMap(track =>
        track.id === source.id
          ? [
              leftClip,
              rightClip,
            ]
          : [track]
      )
    );

    setSelectedTrackId(rightId);

    setSelectedTrackIds([
      source.id,
      rightId,
    ]);

    setMessage(
      `CLIP SPLIT AT ${formatTime(
        splitPosition
      )}.`
    );

    if (wasPlaying) {
      window.setTimeout(() => {
        void play();
      }, 0);
    }
  }

  function copySelectedClips() {
    const ids =
      selectedTrackIds.length
        ? selectedTrackIds
        : selectedTrackId
          ? [selectedTrackId]
          : [];

    if (!ids.length) {
      setMessage(
        "SELECT CLIPS TO COPY."
      );
      return;
    }

    const copies =
      tracksRef.current
        .filter(track =>
          ids.includes(track.id)
        )
        .map(track => ({
          ...track,
        }));

    if (!copies.length) {
      return;
    }

    setCopiedTracks(copies);

    setMessage(
      `COPIED ${copies.length} CLIP${
        copies.length === 1
          ? ""
          : "S"
      }.`
    );
  }

  function pasteCopiedClips() {
    if (!copiedTracks.length) {
      setMessage(
        "COPY CLIPS FIRST."
      );
      return;
    }

    const available =
      MAX_TRACKS -
      tracksRef.current.length;

    if (available <= 0) {
      setMessage(
        `MAXIMUM ${MAX_TRACKS} TRACKS REACHED.`
      );
      return;
    }

    const source =
      copiedTracks.slice(
        0,
        available
      );

    const earliestStart =
      Math.min(
        ...source.map(
          track => track.startTime
        )
      );

    const pasteAt =
      snapTimeline(position);

    const pasted =
      source.map(track => {
        const id =
          makeId();

        const relativeStart =
          track.startTime -
          earliestStart;

        const pastedTrack: DawTrack = {
          ...track,
          id,
          name:
            `${track.name} COPY`,
          startTime:
            Math.max(
              0,
              pasteAt +
                relativeStart
            ),
          loading: false,
          error: "",
        };

        return pastedTrack;
      });

    pushUndoSnapshot();

    setTracks(current => [
      ...current,
      ...pasted,
    ]);

    const pastedIds =
      pasted.map(
        track => track.id
      );

    setSelectedTrackIds(
      pastedIds
    );

    setSelectedTrackId(
      pastedIds[0] || null
    );

    setMessage(
      `PASTED ${pasted.length} CLIP${
        pasted.length === 1
          ? ""
          : "S"
      } AT ${formatTime(
        pasteAt
      )}.`
    );
  }

  function deleteMultiSelectedClips() {
    const ids =
      selectedTrackIds.length
        ? selectedTrackIds
        : selectedTrackId
          ? [selectedTrackId]
          : [];

    if (!ids.length) {
      setMessage(
        "SELECT CLIPS TO DELETE."
      );
      return;
    }

    pushUndoSnapshot();

    setTracks(current =>
      current.filter(
        track =>
          !ids.includes(track.id)
      )
    );

    clearClipSelection();

    setMessage(
      `DELETED ${ids.length} SELECTED CLIP${
        ids.length === 1
          ? ""
          : "S"
      }.`
    );
  }

  // SOLO_DAW_PLAYLIST_16C_V7_V5_INDEPENDENT_START_LINE

  // ==================================================
  // SOLO_DAW_PLAYLIST_16C_V7_V5_2_INDEPENDENT_END_LINE
  // RED / END marker moves independently inside clip.
  // ==================================================

  // ==================================================
  // SOLO_DAW_PLAYHEAD_DRAG_V1_FUNCTIONS
  // FL-style draggable timeline RED playhead.
  // Does not move or resize clips.
  // ==================================================

  function positionFromTimelinePointer(
    clientX: number,
    timelineLeft: number
  ) {
    const raw =
      (clientX - timelineLeft) /
      timelinePixelsPerSecond;

    const snapped =
      timelineSnapSeconds > 0
        ? Math.round(
            raw / timelineSnapSeconds
          ) * timelineSnapSeconds
        : raw;

    return Math.max(
      0,
      Math.min(
        timelineSeconds,
        snapped
      )
    );
  }

  function beginPlayheadDrag(
    event: ReactPointerEvent<HTMLDivElement>
  ) {
    event.preventDefault();
    event.stopPropagation();

    const timeline =
      event.currentTarget.parentElement;

    if (!timeline) {
      return;
    }

    const rect =
      timeline.getBoundingClientRect();

    playheadDragRef.current = {
      pointerId: event.pointerId,
      timelineLeft: rect.left,
      moved: false,
    };

    const next =
      positionFromTimelinePointer(
        event.clientX,
        rect.left
      );

    seekTo(next);

    try {
      event.currentTarget.setPointerCapture(
        event.pointerId
      );
    }
    catch {}
  }

  function movePlayheadDrag(
    event: ReactPointerEvent<HTMLDivElement>
  ) {
    const drag =
      playheadDragRef.current;

    if (
      !drag ||
      drag.pointerId !== event.pointerId
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    drag.moved = true;

    const next =
      positionFromTimelinePointer(
        event.clientX,
        drag.timelineLeft
      );

    seekTo(next);
  }

  function endPlayheadDrag(
    event: ReactPointerEvent<HTMLDivElement>
  ) {
    const drag =
      playheadDragRef.current;

    if (
      !drag ||
      drag.pointerId !== event.pointerId
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    try {
      event.currentTarget.releasePointerCapture(
        event.pointerId
      );
    }
    catch {}

    playheadDragRef.current = null;
  }
  // ==================================================
  // SOLO_DAW_END_LIKE_START_V1
  // RED END uses the same independent pointer model
  // as START. Clip geometry never changes.
  // ==================================================

  function beginClipEndMarker(
    event: ReactPointerEvent<HTMLDivElement>,
    id: string
  ) {
    event.preventDefault();
    event.stopPropagation();

    const track =
      tracksRef.current.find(
        item => item.id === id
      );

    if (!track || !track.buffer) {
      return;
    }

    selectSingleTrack(id);
    pushUndoSnapshot();

    const internalStart = Math.max(
      track.trimStart,
      Math.min(
        track.trimEnd - 0.01,
        track.sourceStartOffset ??
          track.trimStart
      )
    );

    const minimum = Math.min(
      track.trimEnd,
      internalStart + 0.01
    );

    const maximum = track.trimEnd;

    const currentOffset = Math.max(
      minimum,
      Math.min(
        maximum,
        track.sourceEndOffset ??
          track.trimEnd
      )
    );

    clipEndMarkerRef.current = {
      id,
      pointerId: event.pointerId,
      startX: event.clientX,
      originalOffset: currentOffset,
      moved: false,
    };

    try {
      event.currentTarget.setPointerCapture(
        event.pointerId
      );
    }
    catch {}
  }

  function moveClipEndMarker(
    event: ReactPointerEvent<HTMLDivElement>,
    id: string
  ) {
    const marker =
      clipEndMarkerRef.current;

    if (
      !marker ||
      marker.id !== id ||
      marker.pointerId !== event.pointerId
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const track =
      tracksRef.current.find(
        item => item.id === id
      );

    if (!track || !track.buffer) {
      return;
    }

    const deltaPixels =
      event.clientX -
      marker.startX;

    if (Math.abs(deltaPixels) >= 1) {
      marker.moved = true;
    }

    const deltaSeconds =
      deltaPixels /
      timelinePixelsPerSecond;

    const rawOffset =
      marker.originalOffset +
      deltaSeconds;

    const snappedOffset =
      timelineSnapSeconds > 0
        ? Math.round(
            rawOffset /
            timelineSnapSeconds
          ) *
          timelineSnapSeconds
        : rawOffset;

    const internalStart =
      Math.max(
        track.trimStart,
        Math.min(
          track.trimEnd - 0.01,
          track.sourceStartOffset ??
            track.trimStart
        )
      );

    const minimum =
      Math.min(
        track.trimEnd,
        internalStart + 0.01
      );

    const maximum =
      track.trimEnd;

    const nextOffset =
      Math.max(
        minimum,
        Math.min(
          maximum,
          snappedOffset
        )
      );

    setTracks(current =>
      current.map(item =>
        item.id === id
          ? {
              ...item,
              sourceEndOffset:
                nextOffset,
            }
          : item
      )
    );
  }

  function endClipEndMarker(
    event: ReactPointerEvent<HTMLDivElement>,
    id: string
  ) {
    const marker =
      clipEndMarkerRef.current;

    if (
      !marker ||
      marker.id !== id ||
      marker.pointerId !== event.pointerId
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    try {
      event.currentTarget.releasePointerCapture(
        event.pointerId
      );
    }
    catch {}

    const track =
      tracksRef.current.find(
        item => item.id === id
      );

    if (marker.moved && track) {
      const end =
        track.sourceEndOffset ??
        track.trimEnd;

      setMessage(
        `RED END: ${end.toFixed(2)}s`
      );
    }

    clipEndMarkerRef.current = null;
  }
  function beginClipStartMarker(
    event: ReactPointerEvent<HTMLDivElement>,
    id: string
  ) {
    event.preventDefault();
    event.stopPropagation();

    const track =
      tracksRef.current.find(
        item => item.id === id
      );

    if (!track || !track.buffer) return;

    selectSingleTrack(id);
    pushUndoSnapshot();

    const minimum = Math.max(
      0,
      track.trimStart
    );

    const maximum = Math.max(
      minimum,
      track.trimEnd - 0.01
    );

    const currentOffset = Math.max(
      minimum,
      Math.min(
        maximum,
        track.sourceStartOffset ??
          track.trimStart
      )
    );

    clipStartMarkerRef.current = {
      id,
      pointerId: event.pointerId,
      startX: event.clientX,
      originalOffset: currentOffset,
      moved: false,
    };

    try {
      event.currentTarget.setPointerCapture(
        event.pointerId
      );
    }
    catch {}
  }

  function moveClipStartMarker(
    event: ReactPointerEvent<HTMLDivElement>,
    id: string
  ) {
    const marker =
      clipStartMarkerRef.current;

    if (
      !marker ||
      marker.id !== id ||
      marker.pointerId !== event.pointerId
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const track =
      tracksRef.current.find(
        item => item.id === id
      );

    if (!track || !track.buffer) return;

    const deltaPixels =
      event.clientX -
      marker.startX;

    if (Math.abs(deltaPixels) >= 2) {
      marker.moved = true;
    }

    const deltaSeconds =
      deltaPixels /
      timelinePixelsPerSecond;

    const rawOffset =
      marker.originalOffset +
      deltaSeconds;

    const snappedOffset =
      timelineSnapSeconds > 0
        ? Math.round(
            rawOffset /
            timelineSnapSeconds
          ) *
          timelineSnapSeconds
        : rawOffset;

    const minimum =
      Math.max(
        0,
        track.trimStart
      );

    const maximum =
      Math.max(
        minimum,
        track.trimEnd - 0.01
      );

    const nextOffset =
      Math.max(
        minimum,
        Math.min(
          maximum,
          snappedOffset
        )
      );

    setTracks(current =>
      current.map(item =>
        item.id === id
          ? {
              ...item,
              sourceStartOffset:
                nextOffset,
            }
          : item
      )
    );
  }

  function endClipStartMarker(
    event: ReactPointerEvent<HTMLDivElement>,
    id: string
  ) {
    const marker =
      clipStartMarkerRef.current;

    if (
      !marker ||
      marker.id !== id ||
      marker.pointerId !== event.pointerId
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    try {
      event.currentTarget.releasePointerCapture(
        event.pointerId
      );
    }
    catch {}

    const track =
      tracksRef.current.find(
        item => item.id === id
      );

    if (marker.moved && track) {
      const start =
        track.sourceStartOffset ??
        track.trimStart;

      setMessage(
        `AUDIO START: ${start.toFixed(2)}s`
      );
    }

    clipStartMarkerRef.current = null;
  }

  // SOLO_DAW_PLAYLIST_16C_V3_TRIM
  function beginClipTrim(
    event: ReactPointerEvent<HTMLDivElement>,
    id: string,
    side: "left" | "right"
  ) {
    event.preventDefault();
    event.stopPropagation();

    const track =
      tracksRef.current.find(
        item => item.id === id
      );

    if (!track || !track.buffer) {
      return;
    }

    selectSingleTrack(id);

    pushUndoSnapshot();

    clipTrimRef.current = {
      id,
      pointerId: event.pointerId,
      side,
      startX: event.clientX,
      originalStart: track.startTime,
      originalTrimStart: track.trimStart,
      originalTrimEnd: track.trimEnd,
    };

    try {
      event.currentTarget.setPointerCapture(
        event.pointerId
      );
    }
    catch {}
  }

  function moveClipTrim(
    event: ReactPointerEvent<HTMLDivElement>,
    id: string
  ) {
    const trim =
      clipTrimRef.current;

    if (
      !trim ||
      trim.id !== id ||
      trim.pointerId !== event.pointerId
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const deltaSeconds =
      (
        event.clientX -
        trim.startX
      ) /
      timelinePixelsPerSecond;

    const minimumDuration =
      timelineSnapSeconds > 0
        ? Math.min(
            timelineSnapSeconds,
            0.25
          )
        : 0.05;

    if (trim.side === "left") {
      const originalDuration =
        trim.originalTrimEnd -
        trim.originalTrimStart;

      const rawStart =
        trim.originalStart +
        deltaSeconds;

      const snappedStart =
        snapTimeline(rawStart);

      let appliedDelta =
        snappedStart -
        trim.originalStart;

      // START may move back only as far as the beginning
      // of the source audio. Playlist position is irrelevant.
      const minimumDelta =
        -trim.originalTrimStart;

      const maximumDelta =
        originalDuration -
        minimumDuration;

      appliedDelta =
        Math.max(
          minimumDelta,
          Math.min(
            maximumDelta,
            appliedDelta
          )
        );

      setTracks(current =>
        current.map(track =>
          track.id === id
            ? {
                ...track,
                // SOLO_DAW_PLAYLIST_16C_V7_V4_START_MARKER_ONLY
                // START adjusts the source position only.
                // Playlist position stays completely fixed.
                startTime:
                  trim.originalStart,
                trimStart:
                  trim.originalTrimStart +
                  appliedDelta,
              }
            : track
        )
      );

      return;
    }

    const originalDuration =
      trim.originalTrimEnd -
      trim.originalTrimStart;

    const originalRightEdge =
      trim.originalStart +
      originalDuration;

    const snappedRightEdge =
      snapTimeline(
        originalRightEdge +
        deltaSeconds
      );

    let appliedDelta =
      snappedRightEdge -
      originalRightEdge;

    const minimumDelta =
      minimumDuration -
      originalDuration;

    const currentTrack =
      tracksRef.current.find(
        track => track.id === id
      );

    const maximumDelta =
      (currentTrack?.buffer?.duration || 0) -
      trim.originalTrimEnd;

    appliedDelta =
      Math.max(
        minimumDelta,
        Math.min(
          maximumDelta,
          appliedDelta
        )
      );

    setTracks(current =>
      current.map(track =>
        track.id === id
          ? {
              ...track,
              trimEnd:
                trim.originalTrimEnd +
                appliedDelta,
            }
          : track
      )
    );
  }

  function endClipTrim(
    event: ReactPointerEvent<HTMLDivElement>,
    id: string
  ) {
    const trim =
      clipTrimRef.current;

    if (
      !trim ||
      trim.id !== id ||
      trim.pointerId !== event.pointerId
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    try {
      event.currentTarget.releasePointerCapture(
        event.pointerId
      );
    }
    catch {}

    clipTrimRef.current = null;

    setMessage(
      trim.side === "left"
        ? "AUDIO START MARKER ADJUSTED."
        : "CLIP END ADJUSTED."
    );
  }

  function duplicateSelectedClip() {
    if (!selectedTrackId) {
      setMessage("SELECT A CLIP FIRST.");
      return;
    }

    const source =
      tracksRef.current.find(
        track => track.id === selectedTrackId
      );

    if (!source) return;

    if (
      tracksRef.current.length >=
      MAX_TRACKS
    ) {
      setMessage(
        `MAXIMUM ${MAX_TRACKS} TRACKS REACHED.`
      );
      return;
    }

    const id = makeId();

    const duplicate: DawTrack = {
      ...source,
      id,
      name: `${source.name} COPY`,
      startTime:
        source.startTime +
        TIMELINE_SNAP_SECONDS,
      loading: false,
      error: "",
    };

    pushUndoSnapshot();

    setTracks(current => [
      ...current,
      duplicate,
    ]);

    selectSingleTrack(id);

    setMessage(
      `DUPLICATED: ${source.name}`
    );
  }

  function deleteSelectedClip() {
    if (!selectedTrackId) {
      setMessage("SELECT A CLIP FIRST.");
      return;
    }

    const selected =
      tracksRef.current.find(
        track => track.id === selectedTrackId
      );

    if (!selected) {
      setSelectedTrackId(null);
      return;
    }

    removeTrack(selectedTrackId);

    setSelectedTrackId(null);

    setMessage(
      `DELETED: ${selected.name}`
    );
  }

  function handleFiles(
    event: ChangeEvent<HTMLInputElement>
  ) {
    if (!event.target.files) {
      return;
    }

    void addFiles(event.target.files);

    event.target.value = "";
  }

  async function play() {
    const readyTracks =
      tracksRef.current.filter(
        track => track.buffer
      );

    if (!readyTracks.length) {
      setMessage(
        "LOAD AT LEAST ONE AUDIO TRACK."
      );
      return;
    }

    stopSources();
    stopAnimation();

    const ctx = getContext();

    await ctx.resume();

    const duration =
      projectDuration();

    if (offsetRef.current >= duration) {
      offsetRef.current = 0;
    }

    const startOffset =
      offsetRef.current;

    const anySolo =
      tracksRef.current.some(
        track => track.solo
      );

    const sources:
      AudioBufferSourceNode[] = [];

    // SOLO_DAW_PLAYLIST_16C_V7_ORDERED_CROSSFADE
    const orderedReadyTracks =
      [...readyTracks].sort(
        (a, b) =>
          a.startTime - b.startTime
      );

    for (const track of orderedReadyTracks) {
      if (!track.buffer) continue;

      const clipStart =
        Math.max(0, track.startTime);

      const clipDuration =
        Math.max(
          0,
          track.trimEnd -
            track.trimStart
        );

      const clipEnd =
        clipStart +
        clipDuration;

      if (
        startOffset >= clipEnd ||
        clipDuration <= 0
      ) {
        continue;
      }

      const source =
        ctx.createBufferSource();

      const gain =
        ctx.createGain();

      // SOLO_DAW_PLAYLIST_16C_V7_CROSSFADE_GAIN
      const crossfadeGain =
        ctx.createGain();

      const pan =
        ctx.createStereoPanner();

      source.buffer =
        track.buffer;

      const audible =
        anySolo
          ? track.solo
          : !track.muted;
      // SOLO_DAW_PLAYLIST_16C_V6_REAL_FADE_AUDIO
      const baseGain =
        audible
          ? track.volume
          : 0;

      // SOLO_DAW_PLAYLIST_16C_V7_OVERLAP_MODEL
      const orderedIndex =
        orderedReadyTracks.findIndex(
          item => item.id === track.id
        );

      const previousTrack =
        orderedIndex > 0
          ? orderedReadyTracks[
              orderedIndex - 1
            ]
          : null;

      const nextTrack =
        orderedIndex >= 0 &&
        orderedIndex <
          orderedReadyTracks.length - 1
          ? orderedReadyTracks[
              orderedIndex + 1
            ]
          : null;

      const previousDuration =
        previousTrack
          ? Math.max(
              0,
              previousTrack.trimEnd -
                previousTrack.trimStart
            )
          : 0;

      const previousEnd =
        previousTrack
          ? Math.max(
              0,
              previousTrack.startTime
            ) +
            previousDuration
          : 0;

      const requestedCrossfadeIn =
        Math.max(
          0,
          track.crossfadeIn || 0
        );

      const crossfadeInDuration =
        previousTrack
          ? Math.max(
              0,
              Math.min(
                requestedCrossfadeIn,
                Math.max(
                  0,
                  previousEnd - clipStart
                ),
                clipDuration,
                previousDuration
              )
            )
          : 0;

      const nextDuration =
        nextTrack
          ? Math.max(
              0,
              nextTrack.trimEnd -
                nextTrack.trimStart
            )
          : 0;

      const nextStart =
        nextTrack
          ? Math.max(
              0,
              nextTrack.startTime
            )
          : clipEnd;

      const requestedCrossfadeOut =
        nextTrack
          ? Math.max(
              0,
              nextTrack.crossfadeIn || 0
            )
          : 0;

      const crossfadeOutDuration =
        nextTrack
          ? Math.max(
              0,
              Math.min(
                requestedCrossfadeOut,
                Math.max(
                  0,
                  clipEnd - nextStart
                ),
                clipDuration,
                nextDuration
              )
            )
          : 0;

      const safeFadeIn =
        Math.max(
          0,
          Math.min(
            track.fadeIn || 0,
            clipDuration / 2
          )
        );

      const safeFadeOut =
        Math.max(
          0,
          Math.min(
            track.fadeOut || 0,
            clipDuration / 2
          )
        );

      const playbackElapsed =
        Math.max(
          0,
          startOffset -
            clipStart
        );

      const playbackRemaining =
        Math.max(
          0,
          clipDuration -
            playbackElapsed
        );

      const audioStartTime =
        ctx.currentTime +
        Math.max(
          0,
          clipStart -
            startOffset
        );

      gain.gain.cancelScheduledValues(
        ctx.currentTime
      );

      if (!audible) {
        gain.gain.setValueAtTime(
          0,
          ctx.currentTime
        );
      }
      else {
        const initialGain =
          safeFadeIn > 0 &&
          playbackElapsed < safeFadeIn
            ? baseGain *
              (
                playbackElapsed /
                safeFadeIn
              )
            : baseGain;

        gain.gain.setValueAtTime(
          Math.max(
            0,
            initialGain
          ),
          audioStartTime
        );

        if (
          safeFadeIn > 0 &&
          playbackElapsed < safeFadeIn
        ) {
          gain.gain.linearRampToValueAtTime(
            baseGain,
            audioStartTime +
              (
                safeFadeIn -
                playbackElapsed
              )
          );
        }

        if (
          safeFadeOut > 0
        ) {
          const fadeOutStartFromClip =
            clipDuration -
            safeFadeOut;

          if (
            playbackElapsed <
            fadeOutStartFromClip
          ) {
            const fadeOutStartTime =
              audioStartTime +
              (
                fadeOutStartFromClip -
                playbackElapsed
              );

            gain.gain.setValueAtTime(
              baseGain,
              fadeOutStartTime
            );

            gain.gain.linearRampToValueAtTime(
              0,
              audioStartTime +
                playbackRemaining
            );
          }
          else {
            const remainingRatio =
              Math.max(
                0,
                playbackRemaining /
                  safeFadeOut
              );

            gain.gain.setValueAtTime(
              baseGain *
                remainingRatio,
              audioStartTime
            );

            gain.gain.linearRampToValueAtTime(
              0,
              audioStartTime +
                playbackRemaining
            );
          }
        }
      }
      // SOLO_DAW_PLAYLIST_16C_V7_REAL_EQUAL_POWER_CROSSFADE
      crossfadeGain.gain.cancelScheduledValues(
        ctx.currentTime
      );

      if (!audible) {
        crossfadeGain.gain.setValueAtTime(
          0,
          audioStartTime
        );
      }
      else {
        const playbackGlobalStart =
          Math.max(
            startOffset,
            clipStart
          );

        const crossfadePlaybackDuration =
          Math.max(
            0,
            clipEnd -
              playbackGlobalStart
          );

        const crossfadeFactorAt =
          (globalTime: number) => {
            let factor = 1;

            // Incoming clip:
            // sin(0 -> PI/2) = 0 -> 1
            if (
              crossfadeInDuration > 0
            ) {
              const crossfadeInStart =
                clipStart;

              const crossfadeInEnd =
                crossfadeInStart +
                crossfadeInDuration;

              if (
                globalTime <
                crossfadeInEnd
              ) {
                const progress =
                  Math.max(
                    0,
                    Math.min(
                      1,
                      (
                        globalTime -
                        crossfadeInStart
                      ) /
                        crossfadeInDuration
                    )
                  );

                factor *=
                  Math.sin(
                    progress *
                      Math.PI /
                      2
                  );
              }
            }

            // Outgoing clip:
            // cos(0 -> PI/2) = 1 -> 0
            if (
              crossfadeOutDuration > 0 &&
              globalTime >= nextStart
            ) {
              const crossfadeOutEnd =
                nextStart +
                crossfadeOutDuration;

              if (
                globalTime >=
                crossfadeOutEnd
              ) {
                factor *= 0;
              }
              else {
                const progress =
                  Math.max(
                    0,
                    Math.min(
                      1,
                      (
                        globalTime -
                        nextStart
                      ) /
                        crossfadeOutDuration
                    )
                  );

                factor *=
                  Math.cos(
                    progress *
                      Math.PI /
                      2
                  );
              }
            }

            return Math.max(
              0,
              Math.min(1, factor)
            );
          };

        if (
          crossfadePlaybackDuration <=
          0.001
        ) {
          crossfadeGain.gain.setValueAtTime(
            crossfadeFactorAt(
              playbackGlobalStart
            ),
            audioStartTime
          );
        }
        else {
          const sampleCount =
            Math.max(
              2,
              Math.min(
                4096,
                Math.ceil(
                  crossfadePlaybackDuration *
                    64
                ) + 1
              )
            );

          const curve =
            new Float32Array(
              sampleCount
            );

          for (
            let index = 0;
            index < sampleCount;
            index += 1
          ) {
            const ratio =
              index /
              (sampleCount - 1);

            const globalTime =
              playbackGlobalStart +
              crossfadePlaybackDuration *
                ratio;

            curve[index] =
              crossfadeFactorAt(
                globalTime
              );
          }

          crossfadeGain.gain
            .setValueCurveAtTime(
              curve,
              audioStartTime,
              crossfadePlaybackDuration
            );
        }
      }

      pan.pan.value =
        Math.max(
          -1,
          Math.min(1, track.pan)
        );

      const master =
        masterGainNodeRef.current;

      if (!master) {
        throw new Error(
          "DAW master bus unavailable."
        );
      }

      source
        .connect(gain)
        .connect(crossfadeGain)
        .connect(pan)
        .connect(master);

      // SOLO_DAW_PLAYLIST_16C_V7_V5_PLAYBACK_START_OFFSET

      const independentSourceStart =
        Math.max(
          track.trimStart,
          Math.min(
            track.trimEnd,
            track.sourceStartOffset ??
              track.trimStart
          )
        );

      // SOLO_DAW_PLAYLIST_16C_V7_V5_2_PLAYBACK_END_OFFSET
      const independentSourceEnd =
        Math.max(
          independentSourceStart,
          Math.min(
            track.trimEnd,
            track.sourceEndOffset ??
              track.trimEnd
          )
        );

      const availableSourceDuration =
        Math.max(
          0,
          independentSourceEnd -
          independentSourceStart
        );

      if (availableSourceDuration <= 0) {
        continue;
      }

      if (startOffset < clipStart) {
        source.start(
          clipStart - startOffset,
          independentSourceStart,
          availableSourceDuration
        );
      }
      else {
        const elapsedIntoClip =
          startOffset -
          clipStart;

        const sourceOffset =
          independentSourceStart +
          elapsedIntoClip;

        const remainingDuration =
          availableSourceDuration -
          elapsedIntoClip;

        if (remainingDuration <= 0) {
          continue;
        }

        source.start(
          0,
          sourceOffset,
          remainingDuration
        );
      }

      sources.push(source);
    }

    sourceNodesRef.current =
      sources;

    startedAtRef.current =
      ctx.currentTime;

    setTransport("playing");
    setMessage("PLAYING.");

    animationRef.current =
      requestAnimationFrame(
        updateClock
      );
  }

  function pause() {
    if (
      transport !== "playing"
    ) {
      return;
    }

    const ctx =
      audioContextRef.current;

    if (!ctx) return;

    const elapsed =
      ctx.currentTime -
      startedAtRef.current;

    offsetRef.current += elapsed;

    setPosition(
      offsetRef.current
    );

    stopSources();
    stopAnimation();

    setTransport("paused");
    setMessage("PAUSED.");
  }

  function stop() {
    stopSources();
    stopAnimation();

    offsetRef.current = 0;

    setPosition(0);
    setTransport("stopped");
    setMessage("STOPPED.");
  }

  // SOLO_DAW_PLAYLIST_16C_V6_FADE_CONTROLS
  function updateClipFade(
    id: string,
    side: "in" | "out",
    seconds: number
  ) {
    const track =
      tracksRef.current.find(
        item => item.id === id
      );

    if (!track) return;

    const clipDuration =
      Math.max(
        0,
        track.trimEnd -
          track.trimStart
      );

    const maximumFade =
      Math.max(
        0,
        clipDuration / 2
      );

    const next =
      Math.max(
        0,
        Math.min(
          maximumFade,
          Number(seconds)
        )
      );

    const oldValue =
      side === "in"
        ? track.fadeIn
        : track.fadeOut;

    if (
      Math.abs(
        oldValue - next
      ) < 0.0001
    ) {
      return;
    }

    pushUndoSnapshot();

    const wasPlaying =
      transport === "playing";

    if (wasPlaying) {
      pause();
    }

    setTracks(current =>
      current.map(item =>
        item.id === id
          ? {
              ...item,
              ...(side === "in"
                ? { fadeIn: next }
                : { fadeOut: next }),
            }
          : item
      )
    );

    setMessage(
      side === "in"
        ? `FADE IN: ${next.toFixed(2)}s`
        : `FADE OUT: ${next.toFixed(2)}s`
    );

    if (wasPlaying) {
      window.setTimeout(() => {
        void play();
      }, 0);
    }
  }
  // SOLO_DAW_PLAYLIST_16C_V7_CROSSFADE_CONTROL
  function updateClipCrossfadeIn(
    id: string,
    seconds: number
  ) {
    const track =
      tracksRef.current.find(
        item => item.id === id
      );

    if (!track) return;

    const clipDuration =
      Math.max(
        0,
        track.trimEnd -
          track.trimStart
      );

    const next =
      Math.max(
        0,
        Math.min(
          10,
          clipDuration,
          Number(seconds)
        )
      );

    const oldValue =
      track.crossfadeIn || 0;

    if (
      Math.abs(
        oldValue - next
      ) < 0.0001
    ) {
      return;
    }

    // Existing V5 history captures
    // the entire DawTrack object.
    pushUndoSnapshot();

    const wasPlaying =
      transport === "playing";

    if (wasPlaying) {
      pause();
    }

    setTracks(current =>
      current.map(item =>
        item.id === id
          ? {
              ...item,
              crossfadeIn: next,
            }
          : item
      )
    );

    setMessage(
      next > 0
        ? `CROSSFADE IN: ${next.toFixed(2)}s — ACTIVE WHEN CLIPS OVERLAP.`
        : "CROSSFADE OFF."
    );

    if (wasPlaying) {
      window.setTimeout(() => {
        void play();
      }, 0);
    }
  }

  function updateTrack(
    id: string,
    patch: Partial<DawTrack>
  ) {
    const wasPlaying =
      transport === "playing";

    if (wasPlaying) {
      pause();
    }

    setTracks(current =>
      current.map(track =>
        track.id === id
          ? {
              ...track,
              ...patch,
            }
          : track
      )
    );

    if (wasPlaying) {
      window.setTimeout(() => {
        void play();
      }, 0);
    }
  }

  function removeTrack(id: string) {
    stop();

    setTracks(current =>
      current.filter(
        track => track.id !== id
      )
    );

    setMessage("TRACK REMOVED.");
  }

  function clearAll() {
    if (tracksRef.current.length) {
      pushUndoSnapshot();
    }

    stop();
    setTracks([]);
    clearClipSelection();
    setMessage("DAW CLEARED.");
  }

  // SOLO_DAW_PLAYLIST_16C_V5_KEYBOARD
  useEffect(() => {
    const handleKeyDown = (
      event: KeyboardEvent
    ) => {
      const target =
        event.target as HTMLElement | null;

      const tag =
        target?.tagName?.toLowerCase();

      const editingText =
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        target?.isContentEditable;

      if (editingText) {
        return;
      }

      const modifier =
        event.ctrlKey ||
        event.metaKey;

      const key =
        event.key.toLowerCase();

      if (
        modifier &&
        key === "z" &&
        event.shiftKey
      ) {
        event.preventDefault();
        redoPlaylistEdit();
        return;
      }

      if (
        modifier &&
        key === "z"
      ) {
        event.preventDefault();
        undoPlaylistEdit();
        return;
      }

      if (
        modifier &&
        key === "y"
      ) {
        event.preventDefault();
        redoPlaylistEdit();
        return;
      }

      if (
        modifier &&
        key === "c"
      ) {
        event.preventDefault();
        copySelectedClips();
        return;
      }

      if (
        modifier &&
        key === "v"
      ) {
        event.preventDefault();
        pasteCopiedClips();
        return;
      }

      if (
        modifier &&
        key === "a"
      ) {
        event.preventDefault();
        selectAllClips();
        return;
      }

      if (
        event.key === "Delete" ||
        event.key === "Backspace"
      ) {
        if (
          selectedTrackIds.length ||
          selectedTrackId
        ) {
          event.preventDefault();
          deleteMultiSelectedClips();
        }
      }
    };

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
  });

  const duration =
    tracks.reduce(
      (max, track) =>
        Math.max(
          max,
          track.startTime +
            (track.buffer?.duration || 0)
        ),
      0
    );

  const timelineSeconds =
    Math.max(
      TIMELINE_MIN_SECONDS,
      Math.ceil(duration + 5)
    );

  const timelineWidth =
    timelineSeconds *
    TIMELINE_PIXELS_PER_SECOND;

  const rulerMarks =
    Array.from(
      {
        length:
          Math.floor(
            timelineSeconds / 5
          ) + 1,
      },
      (_, index) => index * 5
    );

  if (!authReady) {
    return (
      <main className="min-h-screen bg-[#070912] p-8 text-white">
        <p className="font-black">
          CHECKING OWNER ACCESS...
        </p>
      </main>
    );
  }

  if (!isOwner) {
    return (
      <main className="min-h-screen bg-[#070912] p-8 text-white">
        <div className="mx-auto max-w-3xl rounded-3xl border border-red-500/30 bg-red-950/20 p-8">
          <h1 className="text-3xl font-black text-red-300">
            OWNER DAW
          </h1>

          <p className="mt-4 text-white/70">
            OWNER ACCESS REQUIRED.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main
      className="min-h-screen bg-[#070912] px-5 py-8 text-white"
      onDragOver={event => {
        event.preventDefault();
      }}
      onDrop={event => {
        event.preventDefault();

        if (
          event.dataTransfer.files.length
        ) {
          void addFiles(
            event.dataTransfer.files
          );
        }
      }}
    >
      <div className="mx-auto max-w-[1500px] space-y-6">

        <section className="rounded-3xl border border-cyan-400/20 bg-[#0d101b] p-6">
          <div className="flex flex-wrap items-center justify-between gap-5">
            <div>
              <p className="text-sm font-black tracking-[0.24em] text-cyan-300">
                SOLO BEATS ENGINE MUSIC
              </p>

              <h1 className="mt-2 text-4xl font-black">
                OWNER DAW
              </h1>

              <p className="mt-2 text-white/50">
                PHASE 16A • MULTI-TRACK AUDIO WORKSPACE
              </p>
            </div>

            <div className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-5 py-2 text-sm font-black text-emerald-300">
              OWNER VERIFIED
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-[#0d101b] p-5">
          <div className="flex flex-wrap items-center gap-3">

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="audio/*,.wav,.mp3,.flac,.m4a,.aac,.ogg"
              className="hidden"
              onChange={handleFiles}
            />

            <button
              type="button"
              onClick={() =>
                fileInputRef.current?.click()
              }
              className="rounded-xl bg-cyan-400 px-5 py-3 font-black text-black"
            >
              + ADD AUDIO TRACKS
            </button>

            <button
              type="button"
              onClick={() => void play()}
              className="rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-5 py-3 font-black text-emerald-300"
            >
              ▶ PLAY
            </button>

            <button
              type="button"
              onClick={pause}
              className="rounded-xl border border-yellow-400/40 bg-yellow-500/10 px-5 py-3 font-black text-yellow-200"
            >
              ❚❚ PAUSE
            </button>

            <button
              type="button"
              onClick={stop}
              className="rounded-xl border border-red-400/40 bg-red-500/10 px-5 py-3 font-black text-red-300"
            >
              ■ STOP
            </button>

            <button
              type="button"
              onClick={clearAll}
              disabled={!tracks.length}
              className="rounded-xl border border-white/15 px-5 py-3 font-black text-white/70 disabled:opacity-30"
            >
              CLEAR ALL
            </button>

          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-[1fr_280px]">

            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-black text-white/60">
                  TRANSPORT
                </span>

                <span className="font-mono text-lg font-black text-cyan-300">
                  {formatTime(position)}
                  {" / "}
                  {formatTime(duration)}
                </span>
              </div>

              <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full bg-cyan-400"
                  style={{
                    width:
                      duration > 0
                        ? `${Math.min(
                            100,
                            (position / duration) * 100
                          )}%`
                        : "0%",
                  }}
                />
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="flex justify-between">
                <span className="text-sm font-black text-white/60">
                  MASTER
                </span>

                <span className="font-black text-cyan-300">
                  {Math.round(
                    masterVolume * 100
                  )}%
                </span>
              </div>

              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={masterVolume}
                onChange={event => {
                  const next =
                    Number(
                      event.target.value
                    );

                  setMasterVolume(next);
                  masterVolumeRef.current =
                    next;

                  const master =
                    masterGainNodeRef.current;

                  if (master) {
                    master.gain.setValueAtTime(
                      next,
                      master.context.currentTime
                    );
                  }
                }}
                className="mt-3 w-full"
              />
            </div>

          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="font-black text-cyan-200">
              {message}
            </p>

            <p className="text-sm font-bold text-white/50">
              TRACKS {tracks.length} / {MAX_TRACKS}
            </p>
          </div>
        </section>

        {!tracks.length ? (
          <section className="rounded-3xl border-2 border-dashed border-white/15 bg-[#0d101b] p-16 text-center">
            <p className="text-2xl font-black text-white/70">
              DROP AUDIO STEMS HERE
            </p>

            <p className="mt-3 text-white/40">
              WAV • MP3 • FLAC • M4A • AAC • OGG
            </p>
          </section>
        ) : null}

        {tracks.length ? (
          <section className="rounded-3xl border border-cyan-400/20 bg-[#0d101b] p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-black text-cyan-200">
                  TIMELINE
                </p>

                <p className="mt-1 text-xs font-bold text-white/40">
                  DRAG TO MOVE • EDGES TRIM • CROSSFADE • CTRL/CMD/SHIFT MULTI-SELECT • CTRL/CMD+A SELECT ALL • SPLIT • COPY/PASTE • DELETE • CTRL/CMD+Z UNDO.
                </p>
              </div>

              <div className="font-mono text-sm font-black text-cyan-300">
                PLAYHEAD {formatTime(position)}
              </div>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-white/10 bg-black/30">
              <div
                className="relative min-h-[54px]"
                style={{
                  width: `${timelineWidth}px`,
                }}
                onClick={event => {
                  const rect =
                    event.currentTarget.getBoundingClientRect();

                  const x =
                    event.clientX -
                    rect.left;

                  seekTo(
                    x /
                      TIMELINE_PIXELS_PER_SECOND
                  );
                }}
              >
                {rulerMarks.map(mark => (
                  <div
                    key={mark}
                    className="absolute top-0 h-full border-l border-white/15"
                    style={{
                      left: `${
                        mark *
                        TIMELINE_PIXELS_PER_SECOND
                      }px`,
                    }}
                  >
                    <span className="absolute left-1 top-2 whitespace-nowrap text-[10px] font-black text-white/40">
                      {formatTime(mark)}
                    </span>
                  </div>
                ))}

                {/* SOLO_DAW_PLAYHEAD_DRAG_V1_HANDLE */}
                <div
                  className="absolute bottom-0 top-0 z-30 w-5 -translate-x-1/2 cursor-ew-resize touch-none"
                  style={{
                    left: `${
                      position *
                      timelinePixelsPerSecond
                    }px`,
                  }}
                  title="RED PLAYHEAD - drag left or right"
                  onPointerDown={beginPlayheadDrag}
                  onPointerMove={movePlayheadDrag}
                  onPointerUp={endPlayheadDrag}
                  onPointerCancel={endPlayheadDrag}
                >
                  <div className="pointer-events-none absolute bottom-0 left-1/2 top-0 w-[2px] -translate-x-1/2 bg-red-400 shadow-[0_0_7px_rgba(248,113,113,0.9)]" />
                </div>
              </div>
            </div>
          </section>
        ) : null}

        <section className="rounded-2xl border border-cyan-400/20 bg-[#0b0f18] p-3">
          <div className="flex flex-wrap items-center gap-2">

            <div className="mr-3">
              <p className="text-xs font-black tracking-[0.18em] text-cyan-300">
                PLAYLIST
              </p>

              <p className="text-[10px] font-bold text-white/35">
                REAL CLIP ARRANGEMENT
              </p>
            </div>

            <button
              type="button"
              disabled={!selectedTrackId}
              onClick={duplicateSelectedClip}
              className="rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-3 py-2 text-xs font-black text-cyan-200 disabled:cursor-not-allowed disabled:opacity-30"
            >
              DUPLICATE
            </button>

            <button
              type="button"
              disabled={!selectedTrackId}
              onClick={deleteSelectedClip}
              className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs font-black text-red-200 disabled:cursor-not-allowed disabled:opacity-30"
            >
              DELETE
            </button>

            <button
              type="button"
              disabled={
                undoHistoryRef.current.length === 0
              }
              onClick={undoPlaylistEdit}
              title="Undo (Ctrl/Cmd+Z)"
              className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs font-black text-amber-200 disabled:cursor-not-allowed disabled:opacity-30"
            >
              UNDO
            </button>

            <button
              type="button"
              disabled={
                redoHistoryRef.current.length === 0
              }
              onClick={redoPlaylistEdit}
              title="Redo (Ctrl/Cmd+Y or Ctrl/Cmd+Shift+Z)"
              className="rounded-lg border border-sky-400/30 bg-sky-500/10 px-3 py-2 text-xs font-black text-sky-200 disabled:cursor-not-allowed disabled:opacity-30"
            >
              REDO
            </button>

            <button
              type="button"
              disabled={!selectedTrackId}
              onClick={splitSelectedClipAtPlayhead}
              className="rounded-lg border border-fuchsia-400/30 bg-fuchsia-500/10 px-3 py-2 text-xs font-black text-fuchsia-200 disabled:cursor-not-allowed disabled:opacity-30"
            >
              SPLIT
            </button>

            <button
              type="button"
              disabled={
                !selectedTrackId &&
                selectedTrackIds.length === 0
              }
              onClick={copySelectedClips}
              className="rounded-lg border border-violet-400/30 bg-violet-500/10 px-3 py-2 text-xs font-black text-violet-200 disabled:cursor-not-allowed disabled:opacity-30"
            >
              COPY
            </button>

            <button
              type="button"
              disabled={!copiedTracks.length}
              onClick={pasteCopiedClips}
              className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs font-black text-emerald-200 disabled:cursor-not-allowed disabled:opacity-30"
            >
              PASTE
            </button>

            <button
              type="button"
              disabled={
                selectedTrackIds.length < 2
              }
              onClick={deleteMultiSelectedClips}
              className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs font-black text-red-200 disabled:cursor-not-allowed disabled:opacity-30"
            >
              DELETE MULTI
            </button>

            <button
              type="button"
              onClick={triggerPlaylistUndo}
              title="Undo last playlist edit (Ctrl+Z)"
              className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs font-black text-amber-200"
            >
              UNDO
            </button>

            <button
              type="button"
              onClick={triggerPlaylistRedo}
              title="Redo last playlist edit (Ctrl+Y)"
              className="rounded-lg border border-sky-400/30 bg-sky-500/10 px-3 py-2 text-xs font-black text-sky-200"
            >
              REDO
            </button>

            <button
              type="button"
              disabled={
                selectedTrackIds.length === 0 &&
                !selectedTrackId
              }
              onClick={clearClipSelection}
              className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-black text-white/60 disabled:cursor-not-allowed disabled:opacity-30"
            >
              CLEAR
            </button>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() =>
                  setTimelineZoom(current =>
                    Math.max(
                      0.5,
                      Number(
                        (
                          current - 0.25
                        ).toFixed(2)
                      )
                    )
                  )
                }
                className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-black text-white/70"
              >
                ZOOM -
              </button>

              <div className="min-w-[72px] rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-center font-mono text-[10px] font-black text-cyan-200">
                {Math.round(
                  timelineZoom * 100
                )}%
              </div>

              <button
                type="button"
                onClick={() =>
                  setTimelineZoom(current =>
                    Math.min(
                      4,
                      Number(
                        (
                          current + 0.25
                        ).toFixed(2)
                      )
                    )
                  )
                }
                className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-black text-white/70"
              >
                ZOOM +
              </button>
            </div>

            <label className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[10px] font-black text-white/50">
              SNAP

              <select
                value={timelineSnapSeconds}
                onChange={event =>
                  setTimelineSnapSeconds(
                    Number(
                      event.target.value
                    )
                  )
                }
                className="rounded border border-cyan-400/25 bg-[#090d16] px-2 py-1 text-xs font-black text-cyan-200 outline-none"
              >
                <option value={0}>OFF</option>
                <option value={0.1}>0.10s</option>
                <option value={0.25}>0.25s</option>
                <option value={0.5}>0.50s</option>
                <option value={1}>1.00s</option>
              </select>
            </label>

            <div className="ml-auto rounded-lg border border-white/10 bg-black/30 px-3 py-2 font-mono text-[10px] font-black text-white/45">
              {selectedTrackIds.length > 1
                ? `${selectedTrackIds.length} CLIPS SELECTED`
                : selectedTrackId
                  ? "1 CLIP SELECTED"
                  : "SELECT A CLIP"}
            </div>

          </div>
        </section>

        <section className="space-y-4">
          {tracks.map((track, index) => (
            <article
              key={track.id}
              className="rounded-3xl border border-white/10 bg-[#0d101b] p-5"
            >
              <div className="grid gap-5 xl:grid-cols-[70px_260px_minmax(300px,1fr)_360px]">

                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 text-xl font-black text-cyan-300">
                  {String(
                    index + 1
                  ).padStart(2, "0")}
                </div>

                <div>
                  <p className="truncate text-lg font-black">
                    {track.name}
                  </p>

                  <p className="mt-1 text-xs font-bold text-white/40">
                    {track.loading
                      ? "DECODING..."
                      : track.error
                        ? "ERROR"
                        : `${formatTime(
                            track.buffer
                              ?.duration || 0
                          )} • READY`}
                  </p>

                  {track.error ? (
                    <p className="mt-2 text-xs font-bold text-red-300">
                      {track.error}
                    </p>
                  ) : null}
                </div>

                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs font-black text-white/50">
                      CLIP START
                      <span className="ml-2 text-cyan-300">
                        {formatTime(track.startTime)}
                      </span>
                    </div>

                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() =>
                          moveClipBy(
                            track.id,
                            -1
                          )
                        }
                        className="rounded-lg border border-white/15 px-2 py-1 text-[10px] font-black text-white/60"
                      >
                        -1s
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          moveClipBy(
                            track.id,
                            -0.25
                          )
                        }
                        className="rounded-lg border border-white/15 px-2 py-1 text-[10px] font-black text-white/60"
                      >
                        -0.25
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setClipStart(
                            track.id,
                            0
                          )
                        }
                        className="rounded-lg border border-cyan-400/25 px-2 py-1 text-[10px] font-black text-cyan-300"
                      >
                        ZERO
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          moveClipBy(
                            track.id,
                            0.25
                          )
                        }
                        className="rounded-lg border border-white/15 px-2 py-1 text-[10px] font-black text-white/60"
                      >
                        +0.25
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          moveClipBy(
                            track.id,
                            1
                          )
                        }
                        className="rounded-lg border border-white/15 px-2 py-1 text-[10px] font-black text-white/60"
                      >
                        +1s
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-white/10 bg-black/30">
                    <div
                      className="relative h-28"
                      style={{
                        width: `${timelineWidth}px`,
                      }}
                      onClick={event => {
                        const rect =
                          event.currentTarget.getBoundingClientRect();

                        const x =
                          event.clientX -
                          rect.left;

                        setClipStart(
                          track.id,
                          x /
                            timelinePixelsPerSecond
                        );
                      }}
                    >
                      {rulerMarks.map(mark => (
                        <div
                          key={mark}
                          className="absolute bottom-0 top-0 border-l border-white/5"
                          style={{
                            left: `${
                              mark *
                              TIMELINE_PIXELS_PER_SECOND
                            }px`,
                          }}
                        />
                      ))}

                      {track.buffer ? (
                        <div
                          className={
                            "absolute bottom-2 top-2 touch-none select-none overflow-hidden rounded-xl border active:cursor-grabbing " +
                            (
                              (
                                selectedTrackId === track.id ||
                                selectedTrackIds.includes(
                                  track.id
                                )
                              )
                                ? "z-10 cursor-grab border-cyan-200 bg-cyan-400/20 ring-2 ring-cyan-300/70 shadow-[0_0_24px_rgba(34,211,238,0.25)]"
                                : "cursor-grab border-cyan-400/40 bg-cyan-500/10 hover:border-cyan-300/70"
                            )
                          }
                          onPointerDown={event =>
                            beginClipDrag(
                              event,
                              track.id
                            )
                          }
                          onPointerMove={event =>
                            moveClipDrag(
                              event,
                              track.id
                            )
                          }
                          onPointerUp={event =>
                            endClipDrag(
                              event,
                              track.id
                            )
                          }
                          onPointerCancel={event =>
                            endClipDrag(
                              event,
                              track.id
                            )
                          }
                          onClick={event => {
                            event.stopPropagation();

                            if (
                              event.ctrlKey ||
                              event.metaKey ||
                              event.shiftKey
                            ) {
                              toggleClipSelection(
                                track.id
                              );

                              return;
                            }

                            selectSingleTrack(
                              track.id
                            );
                          }}
                          style={{
                            left: `${
                              track.startTime *
                              timelinePixelsPerSecond
                            }px`,
                            width: `${Math.max(
                              20,
                              Math.max(
                                0.05,
                                track.trimEnd -
                                  track.trimStart
                              ) *
                                timelinePixelsPerSecond
                            )}px`,
                          }}
                          title="Drag clip left or right"
                        >
                          <Waveform
                            buffer={track.buffer}
                            trimStart={track.trimStart}
                            trimEnd={track.trimEnd}
                          />

                          {/* SOLO_DAW_PLAYLIST_16C_V7_V2_START_HANDLE */}
                          <div
                            className="absolute bottom-0 top-0 z-40 w-8 cursor-ew-resize touch-none border-r-2 border-cyan-200 bg-cyan-400/20 hover:bg-cyan-300/40 active:bg-cyan-200/55"
                            style={{
                              left: `${
                                (
                                  (
                                    track.sourceStartOffset ??
                                    track.trimStart
                                  ) -
                                  track.trimStart
                                ) *
                                timelinePixelsPerSecond
                              }px`,
                              transform:
                                "translateX(-50%)",
                            }}
                            title="START - move this line only"
                            onPointerDown={event =>
                              beginClipStartMarker(
                                event,
                                track.id
                              )
                            }
                            onPointerMove={event =>
                              moveClipStartMarker(
                                event,
                                track.id
                              )
                            }
                            onPointerUp={event =>
                              endClipStartMarker(
                                event,
                                track.id
                              )
                            }
                            onPointerCancel={event =>
                              endClipStartMarker(
                                event,
                                track.id
                              )
                            }>
                            <div className="pointer-events-none absolute left-1 top-1 rounded border border-cyan-200/50 bg-black/80 px-1 py-0.5 text-[8px] font-black leading-none text-cyan-100">
                              START
                            </div>

                            <div className="pointer-events-none absolute bottom-1 left-1/2 top-5 w-[3px] -translate-x-1/2 rounded-full bg-cyan-100 shadow-[0_0_8px_rgba(165,243,252,0.95)]" />
                          </div>

                          {/* SOLO_DAW_PLAYLIST_16C_V7_V2_END_HANDLE */}
                          <div
                            className="absolute -bottom-1 -top-1 z-[120] w-12 cursor-ew-resize touch-none select-none border-r-[4px] border-red-300 bg-red-500/20 hover:bg-red-400/45 active:bg-red-300/60"
                            style={{
                              left: `${
                                Math.max(
                                  0,
                                  (
                                    (
                                      track.sourceEndOffset ??
                                      track.trimEnd
                                    ) -
                                    track.trimStart
                                  ) *
                                  timelinePixelsPerSecond
                                )
                              }px`,
                              transform:
                                "translateX(-100%)",
                            }}
                            title="RED END - drag left/right on the MP3; clip stays fixed"
                            draggable={false}
                            onDragStart={event =>
                              event.preventDefault()
                            }
                            onPointerDown={event =>
                              beginClipEndMarker(
                                event,
                                track.id
                              )
                            }
                            onPointerMove={event =>
                              moveClipEndMarker(
                                event,
                                track.id
                              )
                            }
                            onPointerUp={event =>
                              endClipEndMarker(
                                event,
                                track.id
                              )
                            }
                            onPointerCancel={event =>
                              endClipEndMarker(
                                event,
                                track.id
                              )
                            }
                          >
                            <div className="pointer-events-none absolute right-1 top-1 rounded border border-red-300/50 bg-black/80 px-1 py-0.5 text-[8px] font-black leading-none text-red-200">
                              END
                            </div>

                            <div className="pointer-events-none absolute bottom-1 right-0 top-5 w-[4px] rounded-full bg-red-300 shadow-[0_0_10px_rgba(252,165,165,1)]" />
                          </div>
                        </div>
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-xs font-black text-white/30">
                          {track.loading
                            ? "DECODING..."
                            : "NO WAVEFORM"}
                        </div>
                      )}

                      <div
                        className="pointer-events-none absolute bottom-0 top-0 z-20 w-[2px] bg-red-400/80"
                        style={{
                          left: `${
                            position *
                            timelinePixelsPerSecond
                          }px`,
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">

                  <div>
                    <div className="flex justify-between text-xs font-black text-white/50">
                      <span>FADE IN</span>
                      <span>
                        {(track.fadeIn || 0).toFixed(2)}s
                      </span>
                    </div>

                    <input
                      type="range"
                      min="0"
                      max={Math.max(
                        0,
                        (
                          track.trimEnd -
                          track.trimStart
                        ) / 2
                      )}
                      step="0.05"
                      value={Math.min(
                        track.fadeIn || 0,
                        Math.max(
                          0,
                          (
                            track.trimEnd -
                            track.trimStart
                          ) / 2
                        )
                      )}
                      onChange={event =>
                        updateClipFade(
                          track.id,
                          "in",
                          Number(
                            event.target.value
                          )
                        )
                      }
                      className="mt-2 w-full"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-black text-white/50">
                      <span>FADE OUT</span>
                      <span>
                        {(track.fadeOut || 0).toFixed(2)}s
                      </span>
                    </div>

                    <input
                      type="range"
                      min="0"
                      max={Math.max(
                        0,
                        (
                          track.trimEnd -
                          track.trimStart
                        ) / 2
                      )}
                      step="0.05"
                      value={Math.min(
                        track.fadeOut || 0,
                        Math.max(
                          0,
                          (
                            track.trimEnd -
                            track.trimStart
                          ) / 2
                        )
                      )}
                      onChange={event =>
                        updateClipFade(
                          track.id,
                          "out",
                          Number(
                            event.target.value
                          )
                        )
                      }
                      className="mt-2 w-full"
                    />
                  </div>
                  {/* SOLO_DAW_PLAYLIST_16C_V7_CROSSFADE_UI */}
                  <div>
                    <div className="flex justify-between text-xs font-black text-white/50">
                      <span>
                        CROSSFADE IN
                      </span>

                      <span>
                        {(track.crossfadeIn || 0).toFixed(2)}s
                      </span>
                    </div>

                    <input
                      type="range"
                      min="0"
                      max={Math.max(
                        0,
                        Math.min(
                          10,
                          track.trimEnd -
                            track.trimStart
                        )
                      )}
                      step="0.05"
                      value={Math.min(
                        track.crossfadeIn || 0,
                        Math.max(
                          0,
                          Math.min(
                            10,
                            track.trimEnd -
                              track.trimStart
                          )
                        )
                      )}
                      onChange={event =>
                        updateClipCrossfadeIn(
                          track.id,
                          Number(
                            event.target.value
                          )
                        )
                      }
                      className="mt-2 w-full"
                    />

                    <p className="mt-1 text-[10px] font-bold text-white/30">
                      EQUAL-POWER • ACTIVATES WHEN THIS CLIP OVERLAPS THE PREVIOUS CLIP
                    </p>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-black text-white/50">
                      <span>VOLUME</span>
                      <span>
                        {Math.round(
                          track.volume *
                            100
                        )}%
                      </span>
                    </div>

                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={track.volume}
                      onChange={event =>
                        updateTrack(
                          track.id,
                          {
                            volume:
                              Number(
                                event.target
                                  .value
                              ),
                          }
                        )
                      }
                      className="mt-2 w-full"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs font-black text-white/50">
                      <span>PAN</span>
                      <span>
                        {track.pan === 0
                          ? "C"
                          : track.pan < 0
                            ? `L${Math.round(
                                Math.abs(
                                  track.pan
                                ) * 100
                              )}`
                            : `R${Math.round(
                                track.pan *
                                  100
                              )}`}
                      </span>
                    </div>

                    <input
                      type="range"
                      min="-1"
                      max="1"
                      step="0.01"
                      value={track.pan}
                      onChange={event =>
                        updateTrack(
                          track.id,
                          {
                            pan:
                              Number(
                                event.target
                                  .value
                              ),
                          }
                        )
                      }
                      className="mt-2 w-full"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      updateTrack(
                        track.id,
                        {
                          muted:
                            !track.muted,
                        }
                      )
                    }
                    className={
                      "rounded-xl border px-3 py-2 text-sm font-black " +
                      (
                        track.muted
                          ? "border-red-400/50 bg-red-500/20 text-red-200"
                          : "border-white/15 bg-white/5 text-white/60"
                      )
                    }
                  >
                    MUTE
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      updateTrack(
                        track.id,
                        {
                          solo:
                            !track.solo,
                        }
                      )
                    }
                    className={
                      "rounded-xl border px-3 py-2 text-sm font-black " +
                      (
                        track.solo
                          ? "border-yellow-400/50 bg-yellow-500/20 text-yellow-100"
                          : "border-white/15 bg-white/5 text-white/60"
                      )
                    }
                  >
                    SOLO
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      removeTrack(
                        track.id
                      )
                    }
                    className="col-span-2 rounded-xl border border-red-400/20 px-3 py-2 text-xs font-black text-red-300"
                  >
                    REMOVE TRACK
                  </button>

                </div>

              </div>
            </article>
          ))}
        </section>

        <section className="rounded-3xl border border-cyan-400/20 bg-cyan-500/5 p-5">
          <p className="font-black text-cyan-200">
            PHASE 16B V1 TIMELINE
          </p>

          <p className="mt-2 text-sm leading-6 text-white/50">
            Real timeline positioning is now active.
            Each audio clip has its own start time,
            clips can be moved in 0.25 or 1 second
            steps, the project duration follows clip
            placement, and playback respects every
            clip position. PHASE 16A mixer controls
            and the real master gain bus are preserved.
          </p>
        </section>

      </div>
    </main>
  );
}

















