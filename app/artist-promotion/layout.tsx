import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Music Promotion for Independent Artists",
  description:
    "Promote your song, album artwork, or music video across SOLO BEATS ENGINE MUSIC with sponsored placement and owner-reviewed campaigns.",
  keywords: [
    "music promotion",
    "artist promotion",
    "independent artist promotion",
    "promote a song",
    "music video promotion",
    "sponsored music placement",
    "electronic music promotion",
  ],
  alternates: {
    canonical: "/artist-promotion",
  },
  openGraph: {
    type: "website",
    title: "Music Promotion for Independent Artists",
    description:
      "Submit your song, artwork, or music video for sponsored promotion across SOLO BEATS ENGINE MUSIC.",
    url: "/artist-promotion",
    images: [
      {
        url: "/covers/hero-home-final.png",
        width: 1200,
        height: 630,
        alt: "Artist promotion on SOLO BEATS ENGINE MUSIC",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Music Promotion for Independent Artists",
    description:
      "Promote your song, artwork, or music video through sponsored placements.",
    images: ["/covers/hero-home-final.png"],
  },
};

export default function ArtistPromotionLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}