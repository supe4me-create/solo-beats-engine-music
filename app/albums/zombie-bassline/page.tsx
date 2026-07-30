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
  { number: 1, title: "Zombie Bassline", audio: "/previews/zombiebassline.wav" }
];

export default function AlbumPage() {
  const { currentTrack, isPlaying, playQueue, togglePlay } = usePlayer();

  const queue: PlayerTrack[] = tracks.map((track) => ({
    id: `zombie-bassline-${track.number}`,
    title: track.title,
    artist: "Solo Beats",
    albumTitle: "Zombie Bassline",
    audio: track.audio,
    cover: "/covers/zombiebassline.png",
    trackNumber: track.number,
  }));

  function playTrack(track: Track) {
    const trackId = `zombie-bassline-${track.number}`;
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
          <img src="/covers/zombiebassline.png" alt="Zombie Bassline" className="aspect-square w-full rounded-3xl object-cover shadow-2xl" />

          <div>
            <p className="text-sm font-black uppercase tracking-[0.3em] text-purple-300">Upcoming Album</p>
            <h1 className="mt-3 text-5xl font-black sm:text-6xl">Zombie Bassline</h1>
            <p className="mt-3 text-gray-400">Solo Beats • 2026 • 1 Tracks • Electronic</p>
            <p className="mt-6 max-w-3xl text-lg leading-8 text-gray-300">Zombie Bassline blends dark electronic atmosphere, aggressive low end, and high-impact rhythm.</p>

            <div className="mt-8 flex flex-wrap gap-4">
              <button type="button" onClick={() => playTrack(tracks[0])} className="rounded-full bg-purple-600 px-7 py-3 font-black transition hover:bg-purple-500">
                {currentTrack?.id === `zombie-bassline-1` && isPlaying ? "Pause Preview" : "Play Album Preview"}
              </button>
              <button type="button" disabled className="cursor-not-allowed rounded-full bg-white/10 px-7 py-3 font-black text-white/50">Coming Soon</button>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-16">
        <div className="mb-7">
          <p className="text-sm font-black uppercase tracking-[0.3em] text-purple-300">Official Tracklist</p>
          <h2 className="mt-2 text-3xl font-black">1 Tracks</h2>
        </div>

        <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]">
          {tracks.map((track) => {
            const active = currentTrack?.id === `zombie-bassline-${track.number}`;
            const playing = active && isPlaying;
            return (
              <div key={track.number} className={`grid gap-4 border-b border-white/10 p-4 last:border-b-0 sm:grid-cols-[55px_1fr_auto] sm:items-center ${active ? "bg-purple-500/10" : "hover:bg-white/[0.04]"}`}>
                <div className="font-black text-gray-500">{String(track.number).padStart(2, "0")}</div>
                <div>
                  <h3 className="text-lg font-bold">{track.title}</h3>
                  <p className="text-sm text-gray-500">Zombie Bassline • Solo Beats</p>
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

