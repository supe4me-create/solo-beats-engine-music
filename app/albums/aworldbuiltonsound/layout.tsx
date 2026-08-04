import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "A World Built on Sound Album by Solo Beats",
  description:
    "Listen to A World Built on Sound by Solo Beats, an electronic music album with official full songs and track previews.",
  keywords: [
    "A World Built on Sound Solo Beats",
    "Solo Beats A World Built on Sound album",
    "electronic music album",
    "EDM album",
    "independent electronic music",
  ],
  alternates: {
    canonical: "/albums/aworldbuiltonsound",
  },
  openGraph: {
    type: "music.album",
    title: "A World Built on Sound by Solo Beats",
    description:
      "Listen to A World Built on Sound by Solo Beats, an electronic music album with official full songs and track previews.",
    url: "/albums/aworldbuiltonsound",
    images: [
      {
        url: "/covers/aworldbuiltonsound.png",
        width: 1200,
        height: 1200,
        alt: "A World Built on Sound album cover by Solo Beats",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "A World Built on Sound by Solo Beats",
    description:
      "Listen to A World Built on Sound by Solo Beats, an electronic music album with official full songs and track previews.",
    images: ["/covers/aworldbuiltonsound.png"],
  },
};

const trackNames = [
  "A World Built on Sound",
];

const albumJsonLd = {
  "@context": "https://schema.org",
  "@type": "MusicAlbum",
  name: "A World Built on Sound",
  url: "https://www.solobeatsenginemusic.com/albums/aworldbuiltonsound",
  image: "https://www.solobeatsenginemusic.com/covers/aworldbuiltonsound.png",
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
      name: "A World Built on Sound",
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
