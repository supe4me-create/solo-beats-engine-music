import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Black Sea Album by Solo Beats",
  description:
    "Listen to Black Sea by Solo Beats, an electronic music album with official full songs and track previews.",
  keywords: [
    "Black Sea Solo Beats",
    "Solo Beats Black Sea album",
    "electronic music album",
    "EDM album",
    "independent electronic music",
  ],
  alternates: {
    canonical: "/albums/black-sea",
  },
  openGraph: {
    type: "music.album",
    title: "Black Sea by Solo Beats",
    description:
      "Listen to Black Sea by Solo Beats, an electronic music album with official full songs and track previews.",
    url: "/albums/black-sea",
    images: [
      {
        url: "/covers/black-sea.png",
        width: 1200,
        height: 1200,
        alt: "Black Sea album cover by Solo Beats",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Black Sea by Solo Beats",
    description:
      "Listen to Black Sea by Solo Beats, an electronic music album with official full songs and track previews.",
    images: ["/covers/black-sea.png"],
  },
};

const trackNames = [
  "Wishes",
  "Haunted",
  "Chalk Thunder",
  "Bluemoon",
  "Soul Taker",
  "Feel The Drums",
  "One Chance",
  "Laser",
  "Hope",
  "Supertune",
  "Crystal",
  "Cracked Neonize",
  "Roar Anthem",
  "Treasure",
  "Sweet Summer",
  "Pump It",
  "No Haters",
  "Lost",
  "Hot Mic",
];

const albumJsonLd = {
  "@context": "https://schema.org",
  "@type": "MusicAlbum",
  name: "Black Sea",
  url: "https://www.solobeatsenginemusic.com/albums/black-sea",
  image: "https://www.solobeatsenginemusic.com/covers/black-sea.png",
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
      name: "Black Sea",
    },
  })),
};

export default function AlbumSeoLayout({
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
