import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Dark Horse Album by Solo Beats",
  description:
    "Listen to Dark Horse by Solo Beats, an electronic music album with official full songs and track previews.",
  keywords: [
    "Dark Horse Solo Beats",
    "Solo Beats Dark Horse album",
    "electronic music album",
    "EDM album",
    "independent electronic music",
  ],
  alternates: {
    canonical: "/albums/dark-horse",
  },
  openGraph: {
    type: "music.album",
    title: "Dark Horse by Solo Beats",
    description:
      "Listen to Dark Horse by Solo Beats, an electronic music album with official full songs and track previews.",
    url: "/albums/dark-horse",
    images: [
      {
        url: "/covers/darkhorse.png",
        width: 1200,
        height: 1200,
        alt: "Dark Horse album cover by Solo Beats",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Dark Horse by Solo Beats",
    description:
      "Listen to Dark Horse by Solo Beats, an electronic music album with official full songs and track previews.",
    images: ["/covers/darkhorse.png"],
  },
};

const trackNames = [
  "Dark Horse",
];

const albumJsonLd = {
  "@context": "https://schema.org",
  "@type": "MusicAlbum",
  name: "Dark Horse",
  url: "https://www.solobeatsenginemusic.com/albums/dark-horse",
  image: "https://www.solobeatsenginemusic.com/covers/darkhorse.png",
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
      name: "Dark Horse",
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
