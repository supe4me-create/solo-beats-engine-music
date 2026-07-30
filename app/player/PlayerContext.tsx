
"use client";

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import type {
  PlayerTrack,
  PlayTrackOptions,
  RepeatMode,
} from "./types";

type PlayerContextValue = {
  currentTrack: PlayerTrack | null;
  queue: PlayerTrack[];
  currentIndex: number;
  isPlaying: boolean;
  isShuffleOn: boolean;
  repeatMode: RepeatMode;
  volume: number;
  isMuted: boolean;
  currentTime: number;
  duration: number;

  playTrack: (
    track: PlayerTrack,
    options?: PlayTrackOptions
  ) => void;

  playQueue: (
    tracks: PlayerTrack[],
    startIndex?: number
  ) => void;

  togglePlay: () => void;
  playNext: () => void;
  playPrevious: () => void;
  toggleShuffle: () => void;
  cycleRepeatMode: () => void;
  seekTo: (time: number) => void;
  setPlayerVolume: (volume: number) => void;
  toggleMute: () => void;
  clearQueue: () => void;
};

export const PlayerContext =
  createContext<PlayerContextValue | null>(null);

type PlayerProviderProps = {
  children: ReactNode;
};

const clamp = (
  value: number,
  min: number,
  max: number
) => {
  return Math.min(Math.max(value, min), max);
};

export function PlayerProvider({
  children,
}: PlayerProviderProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [queue, setQueue] = useState<PlayerTrack[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isShuffleOn, setIsShuffleOn] = useState(false);
  const [repeatMode, setRepeatMode] =
    useState<RepeatMode>("off");
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const currentTrack =
    currentIndex >= 0 ? queue[currentIndex] ?? null : null;

  const playQueue = useCallback(
    (
      tracks: PlayerTrack[],
      startIndex = 0
    ) => {
      if (tracks.length === 0) {
        return;
      }

      const safeIndex = clamp(
        startIndex,
        0,
        tracks.length - 1
      );

      setQueue(tracks);
      setCurrentIndex(safeIndex);
      setIsPlaying(true);
    },
    []
  );

  const playTrack = useCallback(
    (
      track: PlayerTrack,
      options?: PlayTrackOptions
    ) => {
      if (
        options?.queue &&
        options.queue.length > 0
      ) {
        const foundIndex =
          options.startIndex ??
          options.queue.findIndex(
            (item) => item.id === track.id
          );

        playQueue(
          options.queue,
          foundIndex >= 0 ? foundIndex : 0
        );

        return;
      }

      setQueue([track]);
      setCurrentIndex(0);
      setIsPlaying(true);
    },
    [playQueue]
  );

  const playNext = useCallback(() => {
    if (queue.length === 0) {
      return;
    }

    if (repeatMode === "one") {
      const audio = audioRef.current;

      if (audio) {
        audio.currentTime = 0;
        void audio.play();
      }

      return;
    }

    if (isShuffleOn && queue.length > 1) {
      let nextIndex = currentIndex;

      while (nextIndex === currentIndex) {
        nextIndex = Math.floor(
          Math.random() * queue.length
        );
      }

      setCurrentIndex(nextIndex);
      setIsPlaying(true);
      return;
    }

    const nextIndex = currentIndex + 1;

    if (nextIndex < queue.length) {
      setCurrentIndex(nextIndex);
      setIsPlaying(true);
      return;
    }

    if (repeatMode === "all") {
      setCurrentIndex(0);
      setIsPlaying(true);
      return;
    }

    setIsPlaying(false);
  }, [
    currentIndex,
    isShuffleOn,
    queue,
    repeatMode,
  ]);

  const playPrevious = useCallback(() => {
    const audio = audioRef.current;

    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      setCurrentTime(0);
      return;
    }

    if (queue.length === 0) {
      return;
    }

    if (isShuffleOn && queue.length > 1) {
      let previousIndex = currentIndex;

      while (previousIndex === currentIndex) {
        previousIndex = Math.floor(
          Math.random() * queue.length
        );
      }

      setCurrentIndex(previousIndex);
      setIsPlaying(true);
      return;
    }

    const previousIndex = currentIndex - 1;

    if (previousIndex >= 0) {
      setCurrentIndex(previousIndex);
      setIsPlaying(true);
      return;
    }

    if (repeatMode === "all") {
      setCurrentIndex(queue.length - 1);
      setIsPlaying(true);
      return;
    }

    if (audio) {
      audio.currentTime = 0;
      setCurrentTime(0);
    }
  }, [
    currentIndex,
    isShuffleOn,
    queue,
    repeatMode,
  ]);

  const togglePlay = useCallback(() => {
    if (!currentTrack) {
      return;
    }

    setIsPlaying((previous) => !previous);
  }, [currentTrack]);

  const toggleShuffle = useCallback(() => {
    setIsShuffleOn((previous) => !previous);
  }, []);

  const cycleRepeatMode = useCallback(() => {
    setRepeatMode((previous) => {
      if (previous === "off") {
        return "all";
      }

      if (previous === "all") {
        return "one";
      }

      return "off";
    });
  }, []);

  const seekTo = useCallback((time: number) => {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    const safeTime = clamp(
      time,
      0,
      Number.isFinite(audio.duration)
        ? audio.duration
        : 0
    );

    audio.currentTime = safeTime;
    setCurrentTime(safeTime);
  }, []);

  const setPlayerVolume = useCallback(
    (nextVolume: number) => {
      const safeVolume = clamp(
        nextVolume,
        0,
        1
      );

      setVolume(safeVolume);

      if (safeVolume > 0) {
        setIsMuted(false);
      }
    },
    []
  );

  const toggleMute = useCallback(() => {
    setIsMuted((previous) => !previous);
  }, []);

  const clearQueue = useCallback(() => {
    const audio = audioRef.current;

    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }

    setQueue([]);
    setCurrentIndex(-1);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  }, []);

  useEffect(() => {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    audio.volume = volume;
    audio.muted = isMuted;
  }, [volume, isMuted]);

  useEffect(() => {
    const audio = audioRef.current;

    if (!audio || !currentTrack) {
      return;
    }

    audio.src = currentTrack.audio;
    audio.load();

    setCurrentTime(0);
    setDuration(0);

    if (isPlaying) {
      void audio.play().catch(() => {
        setIsPlaying(false);
      });
    }
  }, [currentTrack]);

  useEffect(() => {
    const audio = audioRef.current;

    if (!audio || !currentTrack) {
      return;
    }

    if (isPlaying) {
      void audio.play().catch(() => {
        setIsPlaying(false);
      });
    } else {
      audio.pause();
    }
  }, [isPlaying, currentTrack]);

  const value = useMemo<PlayerContextValue>(
    () => ({
      currentTrack,
      queue,
      currentIndex,
      isPlaying,
      isShuffleOn,
      repeatMode,
      volume,
      isMuted,
      currentTime,
      duration,
      playTrack,
      playQueue,
      togglePlay,
      playNext,
      playPrevious,
      toggleShuffle,
      cycleRepeatMode,
      seekTo,
      setPlayerVolume,
      toggleMute,
      clearQueue,
    }),
    [
      currentTrack,
      queue,
      currentIndex,
      isPlaying,
      isShuffleOn,
      repeatMode,
      volume,
      isMuted,
      currentTime,
      duration,
      playTrack,
      playQueue,
      togglePlay,
      playNext,
      playPrevious,
      toggleShuffle,
      cycleRepeatMode,
      seekTo,
      setPlayerVolume,
      toggleMute,
      clearQueue,
    ]
  );

  return (
    <PlayerContext.Provider value={value}>
      {children}

      <audio
        ref={audioRef}
        preload="metadata"
        onTimeUpdate={(event) => {
          setCurrentTime(
            event.currentTarget.currentTime
          );
        }}
        onLoadedMetadata={(event) => {
          const nextDuration =
            event.currentTarget.duration;

          setDuration(
            Number.isFinite(nextDuration)
              ? nextDuration
              : 0
          );
        }}
        onDurationChange={(event) => {
          const nextDuration =
            event.currentTarget.duration;

          setDuration(
            Number.isFinite(nextDuration)
              ? nextDuration
              : 0
          );
        }}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={playNext}
        onError={() => setIsPlaying(false)}
      />
    </PlayerContext.Provider>
  );
}