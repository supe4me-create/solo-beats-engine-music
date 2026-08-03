export type RepeatMode = "off" | "all" | "one";

export type PlayerTrack = {
  id: string;
  title: string;
  artist: string;
  albumTitle: string;
  audio: string;
  cover: string;
  trackNumber?: number;
  previewLimitSeconds?: number;
  duration?: number;
};

export type PlayerState = {
  currentTrack: PlayerTrack | null;
  queue: PlayerTrack[];
  currentIndex: number;
  isPlaying: boolean;
  isShuffleOn: boolean;
  repeatMode: RepeatMode;
  volume: number;
  isMuted: boolean;
};

export type PlayTrackOptions = {
  queue?: PlayerTrack[];
  startIndex?: number;
};
