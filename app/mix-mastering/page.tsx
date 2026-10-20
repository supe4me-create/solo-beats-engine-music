/* SOLO_SEO_PHASE2_SERVER_V1 */

import type { Metadata } from "next";
import MixMasteringClient from "./MixMasteringClient";

const title =
  "Professional Mix & Mastering Services | SOLO BEATS";

const description =
  "Submit your song or stems for professional mixing and mastering from SOLO BEATS ENGINE MUSIC. Get polished, powerful, release-ready audio delivered in WAV and MP3.";

export const metadata: Metadata = {
  title,
  description,

  alternates: {
    canonical: "/mix-mastering",
  },

  robots: {
    index: true,
    follow: true,
  },

  openGraph: {
    type: "website",
    url: "/mix-mastering",
    siteName: "SOLO BEATS ENGINE MUSIC",
    title,
    description,
    images: [
      {
        url: "/covers/hero-home-final.png",
        width: 1200,
        height: 630,
        alt: "SOLO BEATS ENGINE MUSIC",
      },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/covers/hero-home-final.png"],
  },
};

const structuredData = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "Professional Mix & Mastering Services | SOLO BEATS",
  description: "Submit your song or stems for professional mixing and mastering from SOLO BEATS ENGINE MUSIC. Get polished, powerful, release-ready audio delivered in WAV and MP3.",
  url: "https://www.solobeatsenginemusic.com/mix-mastering",
  isPartOf: {
    "@type": "WebSite",
    name: "SOLO BEATS ENGINE MUSIC",
    url: "https://www.solobeatsenginemusic.com/",
  },
};

export default function SeoPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(structuredData),
        }}
      />

      <MixMasteringClient />
    </>
  );
}
