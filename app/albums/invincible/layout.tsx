import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Invincible Album by Solo Beats",
  description:
    "Listen to Invincible, a 10-track electronic album by Solo Beats featuring Courageous Time, Free Hugs, No Mercy, Powerful Swag, and more.",
  alternates: {
    canonical: "/albums/invincible",
  },
  openGraph: {
    type: "music.album",
    title: "Invincible by Solo Beats",
    description:
      "A 10-track electronic album by Solo Beats with full songs and official previews.",
    url: "/albums/invincible",
    images: [
      {
        url: "/covers/Invincible-cover.jpg",
        width: 1200,
        height: 1200,
        alt: "Invincible album cover by Solo Beats",
      },
    ],
  },
};

const trackNames = [
  "Courageous Time",
  "Free Hugs",
  "No Mercy",
  "Bad Option",
  "Open Light",
  "Powerful Swag",
  "Time Of Power",
  "Green Feelings",
  "Silver Madness",
  "Attractive Touch",
];

const albumJsonLd = {
  "@context": "https://schema.org",
  "@type": "MusicAlbum",
  name: "Invincible",
  url: "https://www.solobeatsenginemusic.com/albums/invincible",
  image:
    "https://www.solobeatsenginemusic.com/covers/Invincible-cover.jpg",
  numTracks: 10,
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
      name: "Invincible",
    },
  })),
};

export default function InvincibleLayout({
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

