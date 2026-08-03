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
  { number: 1, title: "Steel Venom", audio: "/previews/strange-feeling/01-steel-venom.mp3" },
  { number: 2, title: "Meltdown", audio: "/previews/strange-feeling/02-meltdown.mp3" },
  { number: 3, title: "Nickel Tempest", audio: "/previews/strange-feeling/03-nickel-tempest.mp3" },
  { number: 4, title: "Blade Runner", audio: "/previews/strange-feeling/04-blade-runner.mp3" },
  { number: 5, title: "Wrong Turn", audio: "/previews/strange-feeling/05-wrong-turn.mp3" },
  { number: 6, title: "Cold Exit", audio: "/previews/strange-feeling/06-cold-exit.mp3" },
  { number: 7, title: "Empty Throne", audio: "/previews/strange-feeling/07-empty-throne.mp3" },
  { number: 8, title: "Grey Ticket", audio: "/previews/strange-feeling/08-grey-ticket.mp3" },
  { number: 9, title: "Silent Empire", audio: "/previews/strange-feeling/09-silent-empire.mp3" },
  { number: 10, title: "Bad Intentions", audio: "/previews/strange-feeling/10-bad-intentions.mp3" },
  { number: 11, title: "Maximum Damage", audio: "/previews/strange-feeling/11-maximum-damage.mp3" },
  { number: 12, title: "Nothing to Lose", audio: "/previews/strange-feeling/12-nothing-to-lose.mp3" },
  { number: 13, title: "Too Late", audio: "/previews/strange-feeling/13-too-late.mp3" },
  { number: 14, title: "Out of Time", audio: "/previews/strange-feeling/14-out-of-time.mp3" },
  { number: 15, title: "Not Today", audio: "/previews/strange-feeling/15-not-today.mp3" },
  { number: 16, title: "Bad Memory", audio: "/previews/strange-feeling/16-bad-memory.mp3" },
  { number: 17, title: "Last Mistake", audio: "/previews/strange-feeling/17-last-mistake.mp3" },
  { number: 18, title: "Into the Dark", audio: "/previews/strange-feeling/18-into-the-dark.mp3" },
  { number: 19, title: "Between Worlds", audio: "/previews/strange-feeling/19-between-worlds.mp3" },
  { number: 20, title: "Strange Feeling", audio: "/previews/strange-feeling/20-strange-feeling.mp3" }
];

export default function AlbumPage() {
  const { currentTrack, isPlaying, playQueue, togglePlay } = usePlayer();

  const queue: PlayerTrack[] = tracks.map((track) => ({
    id: `strange-feeling-${track.number}`,
    title: track.title,
    artist: "Solo Beats",
    albumTitle: "Strange Feeling",
    audio: track.audio,
    cover: "/covers/strangefeeling.png",
    trackNumber: track.number,
  }));

  function playTrack(track: Track) {
    const trackId = `strange-feeling-${track.number}`;
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
          {"\u2190"} Back to Albums
        </Link>

        <div className="mt-8 grid gap-10 lg:grid-cols-[380px_1fr] lg:items-center">
          <img src="/covers/strangefeeling.png" alt="Strange Feeling" className="aspect-square w-full rounded-3xl object-cover shadow-2xl" />

          <div>
            <p className="text-sm font-black uppercase tracking-[0.3em] text-purple-300">Released Album</p>
            <h1 className="mt-3 text-5xl font-black sm:text-6xl">Strange Feeling</h1>
            <p className="mt-3 text-gray-400">Solo Beats {"\u2022"} 2026 {"\u2022"} 20 Tracks {"\u2022"} Electronic</p>
            <p className="mt-6 max-w-3xl text-lg leading-8 text-gray-300">Experience Strange Feeling {"\u2022"} Solo Beats album packed with electronic energy, atmospheric melodies, and unforgettable sound.</p>

            <div className="mt-8 flex flex-wrap gap-4">
              <button type="button" onClick={() => playTrack(tracks[0])} className="rounded-full bg-purple-600 px-7 py-3 font-black transition hover:bg-purple-500">
                {currentTrack?.id === `strange-feeling-1` && isPlaying ? "Pause Preview" : "Play Album Preview"}
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
            const active = currentTrack?.id === `strange-feeling-${track.number}`;
            const playing = active && isPlaying;
            return (
              <div key={track.number} className={`grid gap-4 border-b border-white/10 p-4 last:border-b-0 sm:grid-cols-[55px_1fr_auto] sm:items-center ${active ? "bg-purple-500/10" : "hover:bg-white/[0.04]"}`}>
                <div className="font-black text-gray-500">{String(track.number).padStart(2, "0")}</div>
                <div>
                  <h3 className="text-lg font-bold">{track.title}</h3>
                  <p className="text-sm text-gray-500">Strange Feeling {"\u2022"} Solo Beats</p>
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




