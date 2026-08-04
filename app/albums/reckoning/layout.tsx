import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Reckoning Album by Solo Beats",
  description:
    "Listen to Reckoning by Solo Beats, an electronic music album with official full songs and track previews.",
  keywords: [
    "Reckoning Solo Beats",
    "Solo Beats Reckoning album",
    "electronic music album",
    "EDM album",
    "independent electronic music",
  ],
  alternates: {
    canonical: "/albums/reckoning",
  },
  openGraph: {
    type: "music.album",
    title: "Reckoning by Solo Beats",
    description:
      "Listen to Reckoning by Solo Beats, an electronic music album with official full songs and track previews.",
    url: "/albums/reckoning",
    images: [
      {
        url: "/covers/reckoning.png",
        width: 1200,
        height: 1200,
        alt: "Reckoning album cover by Solo Beats",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Reckoning by Solo Beats",
    description:
      "Listen to Reckoning by Solo Beats, an electronic music album with official full songs and track previews.",
    images: ["/covers/reckoning.png"],
  },
};

const trackNames = [
  "Never Broken",
  "Cold Resolve",
  "Last Warning",
  "Relentless",
  "Silent War",
  "Wake Up",
  "Born to Win",
  "World on Fire",
  "Superhuman",
  "Last Breath",
  "Defiance",
  "Dark Rainbow",
  "Dangerous",
  "Ghosts Don't Sleep",
  "Before I Fade",
  "Red Moon",
  "Swords Play",
  "Last Flame",
  "Thunder Rise",
];

const albumJsonLd = {
  "@context": "https://schema.org",
  "@type": "MusicAlbum",
  name: "Reckoning",
  url: "https://www.solobeatsenginemusic.com/albums/reckoning",
  image: "https://www.solobeatsenginemusic.com/covers/reckoning.png",
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
      name: "Reckoning",
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
