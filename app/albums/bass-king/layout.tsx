import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Bass King Album by Solo Beats",
  description:
    "Listen to Bass King by Solo Beats, an electronic music album with official full songs and track previews.",
  keywords: [
    "Bass King Solo Beats",
    "Solo Beats Bass King album",
    "electronic music album",
    "EDM album",
    "independent electronic music",
  ],
  alternates: {
    canonical: "/albums/bass-king",
  },
  openGraph: {
    type: "music.album",
    title: "Bass King by Solo Beats",
    description:
      "Listen to Bass King by Solo Beats, an electronic music album with official full songs and track previews.",
    url: "/albums/bass-king",
    images: [
      {
        url: "/covers/bassking.png",
        width: 1200,
        height: 1200,
        alt: "Bass King album cover by Solo Beats",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Bass King by Solo Beats",
    description:
      "Listen to Bass King by Solo Beats, an electronic music album with official full songs and track previews.",
    images: ["/covers/bassking.png"],
  },
};

const trackNames = [
  "Bass King",
];

const albumJsonLd = {
  "@context": "https://schema.org",
  "@type": "MusicAlbum",
  name: "Bass King",
  url: "https://www.solobeatsenginemusic.com/albums/bass-king",
  image: "https://www.solobeatsenginemusic.com/covers/bassking.png",
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
      name: "Bass King",
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
