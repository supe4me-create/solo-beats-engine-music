import type { Metadata } from "next";
import type { ReactNode } from "react";

const title =
  "AI Video Generator | SOLO BEATS ENGINE MUSIC";

const description =
  "Create music and promotional video clips with the SOLO BEATS ENGINE MUSIC AI Video Generator using text, images, and music.";

export const metadata: Metadata = {
  title,
  description,

  alternates: {
    canonical: "/ai-video",
  },

  openGraph: {
    type: "website",
    url: "/ai-video",
    siteName: "SOLO BEATS ENGINE MUSIC",
    title,
    description,
    images: [
      {
        url: "/covers/hero-home-final.png",
        width: 1200,
        height: 630,
        alt: "AI Video Generator | SOLO BEATS ENGINE MUSIC",
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
