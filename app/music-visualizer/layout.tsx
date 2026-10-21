import type { Metadata } from "next";
import type { ReactNode } from "react";

const title =
  "Music Visualizer | SOLO BEATS ENGINE MUSIC";

const description =
  "Create professional beat-reactive music visualizers from your music and artwork for YouTube, social media, promotion, and releases with SOLO BEATS ENGINE MUSIC.";

export const metadata: Metadata = {
  title,
  description,

  alternates: {
    canonical: "/music-visualizer",
  },

  openGraph: {
    type: "website",
    url: "/music-visualizer",
    siteName: "SOLO BEATS ENGINE MUSIC",
    title,
    description,
    images: [
      {
        url: "/covers/hero-home-final.png",
        width: 1200,
        height: 630,
        alt: "Music Visualizer | SOLO BEATS ENGINE MUSIC",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/covers/hero-home-final.png"],
  },

  robots: {
    index: true,
    follow: true,
  },
};

export default function SeoLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
