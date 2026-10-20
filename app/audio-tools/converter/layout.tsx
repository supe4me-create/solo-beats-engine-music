import type { Metadata } from "next";
import type { ReactNode } from "react";

const title =
  "Online Audio Converter | SOLO BEATS ENGINE MUSIC";

const description =
  "Convert audio between MP3, WAV, FLAC, M4A, AAC, and OGG formats using the SOLO BEATS ENGINE MUSIC online audio converter.";

export const metadata: Metadata = {
  title,
  description,

  alternates: {
    canonical: "/audio-tools/converter",
  },

  openGraph: {
    type: "website",
    url: "/audio-tools/converter",
    siteName: "SOLO BEATS ENGINE MUSIC",
    title,
    description,
    images: [
      {
        url: "/covers/hero-home-final.png",
        width: 1200,
        height: 630,
        alt: "Online Audio Converter | SOLO BEATS ENGINE MUSIC",
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
