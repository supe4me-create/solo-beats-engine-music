import type { Metadata } from "next";
import type { ReactNode } from "react";

const title =
  "AI Music Generator | SOLO BEATS ENGINE MUSIC";

const description =
  "Create original music from your ideas with the SOLO BEATS ENGINE MUSIC AI Music Generator, including genre, mood, BPM, key, duration, and vocal controls.";

export const metadata: Metadata = {
  title,
  description,

  alternates: {
    canonical: "/ai-music",
  },

  openGraph: {
    type: "website",
    url: "/ai-music",
    siteName: "SOLO BEATS ENGINE MUSIC",
    title,
    description,
    images: [
      {
        url: "/covers/hero-home-final.png",
        width: 1200,
        height: 630,
        alt: "AI Music Generator | SOLO BEATS ENGINE MUSIC",
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
