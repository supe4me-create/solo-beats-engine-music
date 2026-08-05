"use client";

import Link from "next/link";
import { usePlayer } from "../../player/usePlayer";
import type { PlayerTrack } from "../../player/types";

type Track = {
  number: number;
  title: string;
  audio: string;
};

const tracks: Track[] = [
  { number: 1, title: "Never Broken", audio: "/previews/reckoning/1 Never Broken.mp3" },
  { number: 2, title: "Cold Resolve", audio: "/previews/reckoning/2 Cold Resolve.mp3" },
  { number: 3, title: "Last Warning", audio: "/previews/reckoning/3 Last Warning.mp3" },
  { number: 4, title: "Relentless", audio: "/previews/reckoning/4 Relentless.mp3" },
  { number: 5, title: "Silent War", audio: "/previews/reckoning/5 Silent War.mp3" },
  { number: 6, title: "Wake Up", audio: "/previews/reckoning/6 Wake Up.mp3" },
  { number: 7, title: "Born to Win", audio: "/previews/reckoning/7 Born to Win.mp3" },
  { number: 8, title: "World on Fire", audio: "/previews/reckoning/8 World on Fire.mp3" },
  { number: 9, title: "Superhuman", audio: "/previews/reckoning/9 Superhuman.mp3" },
  { number: 10, title: "Last Breath", audio: "/previews/reckoning/10 Last Breath.mp3" },
  { number: 11, title: "Defiance", audio: "/previews/reckoning/11 Defiance.mp3" },
  { number: 12, title: "Reckoning", audio: "/previews/reckoning/12 Reckoning.mp3" },
  { number: 13, title: "Dark Rainbow", audio: "/previews/reckoning/13 Dark Rainbow.mp3" },
  { number: 14, title: "Dangerous", audio: "/previews/reckoning/14 Dangerous.mp3" },
  { number: 15, title: "Ghosts Don't Sleep", audio: "/previews/reckoning/15 Ghosts Don't Sleep.mp3" },
  { number: 16, title: "Before I Fade", audio: "/previews/reckoning/16 Before I Fade.mp3" },
  { number: 17, title: "Red Moon", audio: "/previews/reckoning/17 Red Moon.mp3" },
  { number: 18, title: "Swords Play", audio: "/previews/reckoning/18 Swords Play.mp3" },
  { number: 19, title: "Last Flame", audio: "/previews/reckoning/19 Last Flame.mp3" },
  { number: 20, title: "Thunder Rise", audio: "/previews/reckoning/20 Thunder Rise.mp3" }
];

export default function AlbumPage() {
  const { currentTrack, isPlaying, playQueue, togglePlay } = usePlayer();

  const queue: PlayerTrack[] = tracks.map((track) => ({
    id: `reckoning-${track.number}`,
    title: track.title,
    artist: "Solo Beats",
    albumTitle: "Reckoning",
    audio: track.audio,
    cover: "/covers/reckoning.png",
    trackNumber: track.number,
    previewLimitSeconds:
      track.number === 4 ? 60 : undefined,
    requiresPremium: track.number > 4,
  }));

  function playTrack(track: Track) {
    const trackId = `reckoning-${track.number}`;
    if (currentTrack?.id === trackId) {
      togglePlay();
      return;
    }
    playQueue(queue, track.number - 1);
  }

  return (
    <main className="min-h-screen bg-black pb-36 text-white">
      <section className="mx-auto max-w-7xl px-5 py-12">
        <Link href="/albums" className="font-bold text-purple-300 hover:text-purple-200">
          ← Back to Albums
        </Link>

        <div className="mt-8 grid gap-10 lg:grid-cols-[380px_1fr] lg:items-center">
          <img src="/covers/reckoning.png" alt="Reckoning" className="aspect-square w-full rounded-3xl object-cover shadow-2xl" />

          <div>
            <p className="text-sm font-black uppercase tracking-[0.3em] text-purple-300">Upcoming Album</p>
            <h1 className="mt-3 text-5xl font-black sm:text-6xl">Reckoning</h1>
            <p className="mt-3 text-gray-400">Solo Beats • 2026 • 20 Tracks • Electronic</p>
            <p className="mt-6 max-w-3xl text-lg leading-8 text-gray-300">A relentless twenty-track electronic experience built around explosive bass, aggressive energy, and cinematic destruction.</p>

            <div className="mt-8 flex flex-wrap gap-4">
              <button type="button" onClick={() => playTrack(tracks[0])} className="rounded-full bg-purple-600 px-7 py-3 font-black transition hover:bg-purple-500">
                {currentTrack?.id === `reckoning-1` && isPlaying ? "Pause Preview" : "Play Album Preview"}
              </button>
              <Link href="/store" className="rounded-full bg-white px-7 py-3 font-black text-black transition hover:bg-purple-200">Open in Store</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-16">
        <div className="mb-7">
          <p className="text-sm font-black uppercase tracking-[0.3em] text-purple-300">Official Tracklist</p>
          <h2 className="mt-2 text-3xl font-black">20 Tracks</h2>
        </div>

        <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]">
          {tracks.map((track) => {
            const active = currentTrack?.id === `reckoning-${track.number}`;
            const playing = active && isPlaying;
            return (
              <div key={track.number} className={`grid gap-4 border-b border-white/10 p-4 last:border-b-0 sm:grid-cols-[55px_1fr_auto] sm:items-center ${active ? "bg-purple-500/10" : "hover:bg-white/[0.04]"}`}>
                <div className="font-black text-gray-500">{String(track.number).padStart(2, "0")}</div>
                <div>
                  <h3 className="text-lg font-bold">{track.title}</h3>
                  <p className="text-sm text-gray-500">Reckoning • Solo Beats</p>
                </div>
                <button type="button" onClick={() => playTrack(track)} className={`rounded-full px-5 py-3 text-sm font-black transition ${playing ? "bg-purple-500" : "border border-white/20 bg-white/10 hover:bg-white/20"}`}>
                  {playing ? "Pause Preview" : active ? "Resume Preview" : "Play Preview"}
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}

