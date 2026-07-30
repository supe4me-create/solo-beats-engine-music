"use client";

import Link from "next/link";
import { usePlayer } from "../../player/usePlayer";
import type { PlayerTrack } from "../../player/types";

type Track = {
  number: number;
  title: string;
  audio: string;
  paypal: string;
};

const NIGHT_TERROR_PAYPAL_LINK =
  "https://www.paypal.com/ncp/payment/9L3NPNY6ASNRA";

const tracks: Track[] = [
  {
    number: 1,
    title: "Vagabond Tune",
    audio: "/previews/night-terror/1 Vagabond Tune.wav",
    paypal: "https://www.paypal.com/ncp/payment/MUQHBBQSL2EDC",
  },
  {
    number: 2,
    title: "Paper Bloom",
    audio: "/previews/night-terror/2 Paper Bloom.wav",
    paypal: "https://www.paypal.com/ncp/payment/W94LE9S3YY6ZC",
  },
  {
    number: 3,
    title: "Solar Kiss",
    audio: "/previews/night-terror/3 Solar Kiss.wav",
    paypal: "https://www.paypal.com/ncp/payment/5X9CYYU75N9BY",
  },
  {
    number: 4,
    title: "Cloud Bloom",
    audio: "/previews/night-terror/4 Cloud Bloom.wav",
    paypal: "https://www.paypal.com/ncp/payment/H9CD6Z9BAXXTW",
  },
  {
    number: 5,
    title: "First Frost",
    audio: "/previews/night-terror/5 First Frost.wav",
    paypal: "https://www.paypal.com/ncp/payment/T49T837FUTKH4",
  },
  {
    number: 6,
    title: "Glowstream",
    audio: "/previews/night-terror/6 Glowstream.wav",
    paypal: "https://www.paypal.com/ncp/payment/B8JYTBP57SDAJ",
  },
  {
    number: 7,
    title: "Stillpoint",
    audio: "/previews/night-terror/7 Stillpoint.wav",
    paypal: "https://www.paypal.com/ncp/payment/ST2QAX7LQVQBE",
  },
  {
    number: 8,
    title: "Deepdrift",
    audio: "/previews/night-terror/8 Deepdrift.wav",
    paypal: "https://www.paypal.com/ncp/payment/FT7GVGZYLMT9J",
  },
  {
    number: 9,
    title: "Cloudsong",
    audio: "/previews/night-terror/9 Cloudsong.wav",
    paypal: "https://www.paypal.com/ncp/payment/8KLLYAJVSD3UG",
  },
  {
    number: 10,
    title: "Everdark",
    audio: "/previews/night-terror/10 Everdark.wav",
    paypal: "https://www.paypal.com/ncp/payment/M6PT7GWQQK9GS",
  },
  {
    number: 11,
    title: "Ghostveil",
    audio: "/previews/night-terror/11 Ghostveil.wav",
    paypal: "https://www.paypal.com/ncp/payment/R5NDND9V2YZUY",
  },
  {
    number: 12,
    title: "Dreamshard",
    audio: "/previews/night-terror/12 Dreamshard.wav",
    paypal: "https://www.paypal.com/ncp/payment/LRRPDVWQ3ZEWS",
  },
  {
    number: 13,
    title: "Raindrop Soul",
    audio: "/previews/night-terror/13 Raindrop Soul.wav",
    paypal: "https://www.paypal.com/ncp/payment/6HNEZ7ZPBG2XU",
  },
  {
    number: 14,
    title: "Glass Sea",
    audio: "/previews/night-terror/14 Glass Sea.wav",
    paypal: "https://www.paypal.com/ncp/payment/YNPWTVHMQNSD4",
  },
  {
    number: 15,
    title: "Silent Core",
    audio: "/previews/night-terror/15 Silent Core.wav",
    paypal: "https://www.paypal.com/ncp/payment/BFKUXZ4GC972J",
  },
  {
    number: 16,
    title: "Starfall",
    audio: "/previews/night-terror/16 Starfall.wav",
    paypal: "https://www.paypal.com/ncp/payment/XE637XDMDEJVA",
  },
  {
    number: 17,
    title: "Wild Scars",
    audio: "/previews/night-terror/17 Wild Scars.wav",
    paypal: "https://www.paypal.com/ncp/payment/A38TT8CJAPQ7Q",
  },
  {
    number: 18,
    title: "Fear Strike",
    audio: "/previews/night-terror/18 Fear Strike.wav",
    paypal: "https://www.paypal.com/ncp/payment/CSB3HJVBGANAC",
  },
  {
    number: 19,
    title: "Night Terror",
    audio: "/previews/night-terror/19 Night Terror.wav",
    paypal: "https://www.paypal.com/ncp/payment/UFLCZBV7FRCGC",
  },
];

export default function NightTerrorPage() {
  const {
    currentTrack,
    isPlaying,
    playQueue,
    togglePlay,
  } = usePlayer();

  const playerQueue: PlayerTrack[] = tracks.map((track) => ({
    id: `night-terror-${track.number}`,
    title: track.title,
    artist: "Solo Beats",
    albumTitle: "Night Terror",
    audio: track.audio,
    cover: "/covers/nightterror.jpg",
    trackNumber: track.number,
  }));

  function playTrack(track: Track) {
    const trackId = `night-terror-${track.number}`;

    if (currentTrack?.id === trackId) {
      togglePlay();
      return;
    }

    const startIndex = playerQueue.findIndex(
      (item) => item.id === trackId
    );

    playQueue(playerQueue, startIndex >= 0 ? startIndex : 0);
  }

  function buyAlbum() {
    window.open(
      NIGHT_TERROR_PAYPAL_LINK,
      "_blank",
      "noopener,noreferrer"
    );
  }

  function buyTrack(track: Track) {
    window.open(track.paypal, "_blank", "noopener,noreferrer");
  }

  return (
    <main className="min-h-screen bg-black pb-40 text-white">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-black/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <Link
            href="/"
            className="text-lg font-black tracking-wider text-white transition hover:text-purple-400"
          >
            SOLO BEATS ENGINE MUSIC
          </Link>

          <nav className="flex items-center gap-5 text-sm font-semibold text-gray-300">
            <Link href="/" className="transition hover:text-white">
              Home
            </Link>

            <Link href="/albums" className="transition hover:text-white">
              Albums
            </Link>
          </nav>
        </div>
      </header>

      <section className="relative overflow-hidden border-b border-white/10">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-950/70 via-black to-red-950/40" />

        <div className="relative mx-auto grid max-w-7xl gap-10 px-5 py-14 md:grid-cols-[380px_1fr] md:items-center md:py-20">
          <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/5 shadow-2xl shadow-purple-950/40">
            <img
              src="/covers/nightterror.jpg"
              alt="Night Terror by Solo Beats"
              className="aspect-square h-full w-full object-cover"
            />
          </div>

          <div>
            <Link
              href="/albums"
              className="mb-6 inline-flex items-center gap-2 text-sm font-bold text-purple-300 transition hover:text-purple-200"
            >
              ← Back to Albums
            </Link>

            <div className="mb-4 flex flex-wrap gap-3">
              <span className="rounded-full border border-purple-400/30 bg-purple-500/10 px-4 py-2 text-xs font-bold uppercase tracking-widest text-purple-200">
                Released Album
              </span>

              <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold uppercase tracking-widest text-gray-300">
                Electronic
              </span>

              <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold uppercase tracking-widest text-gray-300">
                19 Tracks
              </span>
            </div>

            <p className="mb-2 text-sm font-bold uppercase tracking-[0.3em] text-gray-400">
              Solo Beats
            </p>

            <h1 className="text-5xl font-black tracking-tight sm:text-6xl lg:text-7xl">
              Night Terror
            </h1>

            <p className="mt-6 max-w-3xl text-lg leading-8 text-gray-300">
              Enter the world of Night Terror, a nineteen-track Solo Beats
              experience filled with atmospheric melodies, powerful electronic
              production, dark energy and unforgettable sound.
            </p>

            <div className="mt-8 flex flex-wrap gap-4">
              <button
                type="button"
                onClick={buyAlbum}
                className="rounded-full bg-white px-8 py-4 font-black text-black shadow-lg transition hover:scale-105 hover:bg-purple-200 focus:outline-none focus:ring-4 focus:ring-purple-500/40"
              >
                Buy Full Album — $19.00
              </button>

              <button
                type="button"
                onClick={() => playTrack(tracks[0])}
                className="rounded-full border border-white/20 bg-white/10 px-8 py-4 font-black text-white transition hover:scale-105 hover:bg-white/20 focus:outline-none focus:ring-4 focus:ring-white/20"
              >
                {currentTrack?.id === "night-terror-1" && isPlaying
                  ? "Pause Preview"
                  : "Play Album Preview"}
              </button>
            </div>

            <p className="mt-5 text-sm text-gray-500">
              Full album: $19.00 • Individual tracks: $1.00 each
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-14">
        <div className="mb-8">
          <p className="text-sm font-bold uppercase tracking-[0.3em] text-purple-300">
            Official Tracklist
          </p>

          <h2 className="mt-3 text-3xl font-black sm:text-4xl">
            Night Terror — 19 Tracks
          </h2>

          <p className="mt-3 text-gray-400">
            Preview each track and purchase individual songs for $1.00.
          </p>
        </div>

        <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03]">
          {tracks.map((track) => {
            const isActive = currentTrack?.id === `night-terror-${track.number}`;
            const trackIsPlaying = isActive && isPlaying;

            return (
              <div
                key={track.number}
                className={`grid gap-4 border-b border-white/10 p-4 transition last:border-b-0 sm:grid-cols-[50px_1fr_auto] sm:items-center sm:p-5 ${
                  isActive ? "bg-purple-500/10" : "hover:bg-white/[0.04]"
                }`}
              >
                <div className="text-lg font-black text-gray-500">
                  {track.number.toString().padStart(2, "0")}
                </div>

                <div>
                  <h3 className="text-lg font-bold text-white">
                    {track.title}
                  </h3>

                  <p className="mt-1 text-sm text-gray-500">
                    Solo Beats • Night Terror
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => playTrack(track)}
                    className={`min-w-[125px] rounded-full px-5 py-3 text-sm font-black transition focus:outline-none focus:ring-4 focus:ring-purple-500/30 ${
                      trackIsPlaying
                        ? "bg-purple-500 text-white hover:bg-purple-400"
                        : "border border-white/20 bg-white/10 text-white hover:bg-white/20"
                    }`}
                  >
                    {trackIsPlaying ? "Pause Preview" : "Play Preview"}
                  </button>

                  <button
                    type="button"
                    onClick={() => buyTrack(track)}
                    className="min-w-[125px] rounded-full bg-white px-5 py-3 text-sm font-black text-black transition hover:scale-105 hover:bg-purple-200 focus:outline-none focus:ring-4 focus:ring-white/20"
                  >
                    Buy Track — $1
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-12 rounded-3xl border border-purple-400/20 bg-gradient-to-r from-purple-950/50 to-red-950/30 p-7 sm:p-10">
          <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.3em] text-purple-300">
                Complete Collection
              </p>

              <h2 className="mt-3 text-3xl font-black">
                Own the complete Night Terror album
              </h2>

              <p className="mt-3 max-w-2xl leading-7 text-gray-300">
                Get all nineteen original Solo Beats tracks together as one
                complete digital album.
              </p>
            </div>

            <button
              type="button"
              onClick={buyAlbum}
              className="rounded-full bg-white px-8 py-4 font-black text-black transition hover:scale-105 hover:bg-purple-200 focus:outline-none focus:ring-4 focus:ring-purple-500/40"
            >
              Buy Album — $19.00
            </button>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/10 px-5 py-10 text-center text-sm text-gray-500">
        © 2026 Solo Beats Engine Music. All rights reserved.
      </footer>

    </main>
  );
}
