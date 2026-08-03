import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Strange Feeling Album by Solo Beats",
  description:
    "Listen to previews from Strange Feeling, a 20-track Solo Beats electronic album featuring Steel Venom, Meltdown, Maximum Damage, and more.",
  alternates: {
    canonical: "/albums/strange-feeling",
  },
  openGraph: {
    type: "music.album",
    title: "Strange Feeling by Solo Beats",
    description:
      "A 20-track electronic album by Solo Beats with official previews.",
    url: "/albums/strange-feeling",
    images: [
      {
        url: "/covers/strangefeeling.png",
        width: 1200,
        height: 1200,
        alt: "Strange Feeling album cover by Solo Beats",
      },
    ],
  },
};

const trackNames = [
  "Steel Venom",
  "Meltdown",
  "Nickel Tempest",
  "Blade Runner",
  "Wrong Turn",
  "Cold Exit",
  "Empty Throne",
  "Grey Ticket",
  "Silent Empire",
  "Bad Intentions",
  "Maximum Damage",
  "Nothing to Lose",
  "Too Late",
  "Out of Time",
  "Not Today",
  "Bad Memory",
  "Last Mistake",
  "Into the Dark",
  "Between Worlds",
  "Strange Feeling",
];

const albumJsonLd = {
  "@context": "https://schema.org",
  "@type": "MusicAlbum",
  name: "Strange Feeling",
  url: "https://www.solobeatsenginemusic.com/albums/strange-feeling",
  image:
    "https://www.solobeatsenginemusic.com/covers/strangefeeling.png",
  numTracks: 20,
  byArtist: {
    "@type": "MusicGroup",
    name: "Solo Beats",
    url: "https://www.solobeatsenginemusic.com",
  },
  genre: ["Electronic", "Complextro"],
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
      name: "Strange Feeling",
    },
  })),
};

export default function StrangeFeelingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
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
