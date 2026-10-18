/* SOLO_HOMEPAGE_SEO_SERVER_V1 */

import type { Metadata } from "next";
import HomeClient from "./HomeClient";

const title =
  "SOLO BEATS ENGINE MUSIC | Electronic Music, Radio & Artist Services";

const description =
  "Discover original electronic music by Solo Beats, stream Premium Radio and TV, buy albums, access mixing and mastering, promote your music, and apply for DJ access.";

export const metadata: Metadata = {
  title,
  description,

  alternates: {
    canonical: "/",
  },

  openGraph: {
    type: "website",
    url: "/",
    siteName: "SOLO BEATS ENGINE MUSIC",
    title,
    description,
    images: [
      {
        url: "/covers/hero-home-final.png",
        width: 1200,
        height: 630,
        alt: "SOLO BEATS ENGINE MUSIC electronic music platform",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/covers/hero-home-final.png"],
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": "https://www.solobeatsenginemusic.com/#website",
      url: "https://www.solobeatsenginemusic.com/",
      name: "SOLO BEATS ENGINE MUSIC",
      description:
        "Electronic music, albums, radio, television, artist promotion, DJ access, and music production services.",
      publisher: {
        "@id": "https://www.solobeatsenginemusic.com/#organization",
      },
    },
    {
      "@type": ["Organization", "MusicGroup"],
      "@id": "https://www.solobeatsenginemusic.com/#organization",
      name: "SOLO BEATS ENGINE MUSIC",
      alternateName: "Solo Beats",
      url: "https://www.solobeatsenginemusic.com/",
      logo: "https://www.solobeatsenginemusic.com/icon-512.png",
      image:
        "https://www.solobeatsenginemusic.com/covers/hero-home-final.png",
      sameAs: [
        "https://www.youtube.com/@SOLOBEATSENGINEMUSIC",
        "https://open.spotify.com/artist/6sulBcam91bXxOqB9t1LCp",
        "https://solobeats3.bandcamp.com/",
      ],
    },
  ],
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData),
        }}
      />

      <HomeClient />
      {/* SOLO_ARTIST_MEMBERSHIP_HOMEPAGE_SEO_V1 */}
      <section className="border-t border-white/10 bg-black px-5 py-10 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="overflow-hidden rounded-[2rem] border border-violet-400/20 bg-gradient-to-br from-violet-600/20 via-white/[0.04] to-cyan-500/10 p-7 shadow-2xl sm:p-10">
            <p className="text-sm font-black uppercase tracking-[0.24em] text-violet-300">
              FOR INDEPENDENT ARTISTS
            </p>

            <div className="mt-3 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <h2 className="text-3xl font-black tracking-tight text-white sm:text-5xl">
                  Join SOLO BEATS Artist Membership
                </h2>

                <p className="mt-4 text-base leading-7 text-white/60 sm:text-lg">
                  Build your artist presence with creator benefits,
                  promotional opportunities, artist analytics, music
                  uploads, and savings on SOLO BEATS services.
                </p>

                <p className="mt-4 text-sm leading-6 text-white/45">
                  Choose the membership level that fits your music career
                  and keep your artist tools connected to one SOLO BEATS account.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <a
                  href="/artist-membership"
                  className="rounded-2xl bg-violet-500 px-6 py-4 text-sm font-black uppercase tracking-wide text-white transition hover:bg-violet-400"
                >
                  View Artist Membership
                </a>

                <a
                  href="/artist-promotion"
                  className="rounded-2xl border border-white/15 bg-white/[0.06] px-6 py-4 text-sm font-black uppercase tracking-wide text-white transition hover:bg-white/[0.12]"
                >
                  Promote Your Music
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* SOLO_PUBLIC_VISUALIZER_ENTRY_V1 */}
      <section className="border-t border-white/10 bg-black px-5 py-10 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="overflow-hidden rounded-[2rem] border border-fuchsia-400/20 bg-gradient-to-br from-fuchsia-600/20 via-white/[0.04] to-red-600/10 p-7 shadow-2xl sm:p-10">
            <p className="text-sm font-black uppercase tracking-[0.24em] text-fuchsia-300">
              SOLO BEATS CREATOR TOOLS
            </p>

            <div className="mt-3 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <h2 className="text-3xl font-black tracking-tight text-white sm:text-5xl">
                  Create Your Music Visualizer
                </h2>

                <p className="mt-4 text-base leading-7 text-white/60 sm:text-lg">
                  Turn your music and artwork into a professional beat-reactive
                  visualizer for YouTube, social media, promotion, and releases.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <a
                  href="/music-visualizer"
                  className="rounded-2xl bg-fuchsia-600 px-6 py-4 text-sm font-black uppercase tracking-wide text-white transition hover:bg-fuchsia-500"
                >
                  Create Music Visualizer
                </a>

                <a
                  href="/music-visualizer/credits"
                  className="rounded-2xl border border-white/15 bg-white/[0.06] px-6 py-4 text-sm font-black uppercase tracking-wide text-white transition hover:bg-white/[0.12]"
                >
                  Buy Visualizer Credits
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

    
      {/* SOLO_PUBLIC_CREATOR_TOOLS_SEO_V1 */}
      <section className="border-t border-white/10 bg-black px-5 py-10 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-[2rem] border border-cyan-400/20 bg-gradient-to-br from-cyan-600/15 via-white/[0.035] to-violet-600/15 p-7 shadow-2xl sm:p-10">

            <p className="text-sm font-black uppercase tracking-[0.24em] text-cyan-300">
              SOLO BEATS CREATOR SERVICES
            </p>

            <h2 className="mt-3 text-3xl font-black text-white sm:text-5xl">
              Create, Convert and Build
            </h2>

            <p className="mt-4 max-w-3xl text-base leading-7 text-white/60 sm:text-lg">
              Explore SOLO BEATS tools for audio conversion, music creation,
              video generation, and digital content production.
            </p>

            <div className="mt-8 grid gap-4 md:grid-cols-3">

              <a
                href="/audio-tools/converter"
                className="rounded-2xl border border-emerald-300/20 bg-emerald-400/10 p-6 transition hover:bg-emerald-400/15"
              >
                <span className="block text-xl font-black text-white">
                  Audio Converter
                </span>

                <span className="mt-2 block text-sm leading-6 text-white/55">
                  Convert MP3, WAV, FLAC, M4A, AAC and OGG audio files.
                </span>
              </a>

              <a
                href="/ai-music"
                className="rounded-2xl border border-fuchsia-300/20 bg-fuchsia-500/10 p-6 transition hover:bg-fuchsia-500/15"
              >
                <span className="block text-xl font-black text-white">
                  AI Music Generator
                </span>

                <span className="mt-2 block text-sm leading-6 text-white/55">
                  Generate music using genre, mood, BPM, key and creative controls.
                </span>
              </a>

              <a
                href="/ai-video"
                className="rounded-2xl border border-violet-300/20 bg-violet-500/10 p-6 transition hover:bg-violet-500/15"
              >
                <span className="block text-xl font-black text-white">
                  AI Video Generator
                </span>

                <span className="mt-2 block text-sm leading-6 text-white/55">
                  Create promotional and music video clips from text, images and music.
                </span>
              </a>

            </div>
          </div>
        </div>
      </section>
    </>
  );
}



