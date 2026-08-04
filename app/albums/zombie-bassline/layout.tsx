import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Zombie Bassline Album by Solo Beats",
  description:
    "Listen to Zombie Bassline by Solo Beats, an electronic music album with official full songs and track previews.",
  keywords: [
    "Zombie Bassline Solo Beats",
    "Solo Beats Zombie Bassline album",
    "electronic music album",
    "EDM album",
    "independent electronic music",
  ],
  alternates: {
    canonical: "/albums/zombie-bassline",
  },
  openGraph: {
    type: "music.album",
    title: "Zombie Bassline by Solo Beats",
    description:
      "Listen to Zombie Bassline by Solo Beats, an electronic music album with official full songs and track previews.",
    url: "/albums/zombie-bassline",
    images: [
      {
        url: "/covers/zombiebassline.png",
        width: 1200,
        height: 1200,
        alt: "Zombie Bassline album cover by Solo Beats",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Zombie Bassline by Solo Beats",
    description:
      "Listen to Zombie Bassline by Solo Beats, an electronic music album with official full songs and track previews.",
    images: ["/covers/zombiebassline.png"],
  },
};

const trackNames = [
  "Zombie Bassline",
];

const albumJsonLd = {
  "@context": "https://schema.org",
  "@type": "MusicAlbum",
  name: "Zombie Bassline",
  url: "https://www.solobeatsenginemusic.com/albums/zombie-bassline",
  image: "https://www.solobeatsenginemusic.com/covers/zombiebassline.png",
  numTracks: 1,
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
      name: "Zombie Bassline",
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
