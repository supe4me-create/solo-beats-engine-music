import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Night Terror Album by Solo Beats",
  description:
    "Listen to Night Terror, a 19-track electronic album by Solo Beats featuring Vagabond Tune, Paper Bloom, Solar Kiss, Ghostveil, Fear Strike, and more.",
  keywords: [
    "Night Terror Solo Beats",
    "Solo Beats Night Terror album",
    "electronic music album",
    "dark electronic music",
    "Vagabond Tune",
    "Fear Strike",
  ],
  alternates: {
    canonical: "/albums/night-terror",
  },
  openGraph: {
    type: "music.album",
    title: "Night Terror by Solo Beats",
    description:
      "A 19-track electronic album by Solo Beats with full songs and official previews.",
    url: "/albums/night-terror",
    images: [
      {
        url: "/covers/nightterror.jpg",
        width: 1200,
        height: 1200,
        alt: "Night Terror album cover by Solo Beats",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Night Terror by Solo Beats",
    description:
      "Listen to the 19-track electronic album Night Terror by Solo Beats.",
    images: ["/covers/nightterror.jpg"],
  },
};

const trackNames = [
  "Vagabond Tune",
  "Paper Bloom",
  "Solar Kiss",
  "Cloud Bloom",
  "First Frost",
  "Glowstream",
  "Stillpoint",
  "Deepdrift",
  "Cloudsong",
  "Everdark",
  "Ghostveil",
  "Dreamshard",
  "Raindrop Soul",
  "Glass Sea",
  "Silent Core",
  "Starfall",
  "Wild Scars",
  "Fear Strike",
  "Night Terror",
];

const albumJsonLd = {
  "@context": "https://schema.org",
  "@type": "MusicAlbum",
  name: "Night Terror",
  url: "https://www.solobeatsenginemusic.com/albums/night-terror",
  image:
    "https://www.solobeatsenginemusic.com/covers/nightterror.jpg",
  numTracks: 19,
  byArtist: {
    "@type": "MusicGroup",
    name: "Solo Beats",
    url: "https://www.solobeatsenginemusic.com",
  },
  genre: "Electronic",
  track: trackNames.map((name, index) => ({
    "@type": "MusicRecording",
    position: index + 1,
    name,
    byArtist: {
      "@type": "MusicGroup",
      name: "Solo Beats",
    },
    inAlbum: {
      "@type": "MusicAlbum",
      name: "Night Terror",
    },
  })),
};

export default function NightTerrorLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(albumJsonLd),
        }}
      />
      {children}
    </>
  );
}