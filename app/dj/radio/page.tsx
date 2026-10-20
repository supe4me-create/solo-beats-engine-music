/* SOLO_SEO_PHASE2_SERVER_V1 */

import type { Metadata } from "next";
import DjRadioClient from "./DjRadioClient";

const title =
  "DJ Access & Radio Applications | SOLO BEATS";

const description =
  "Apply to become a SOLO BEATS radio DJ. Get approved for DJ access, live broadcasting, mixing tools, playlists, microphone controls, and the SOLO BEATS DJ workspace.";

export const metadata: Metadata = {
  title,
  description,

  alternates: {
    canonical: "/dj/radio",
  },

  robots: {
    index: true,
    follow: true,
  },

  openGraph: {
    type: "website",
    url: "/dj/radio",
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
  name: "DJ Access & Radio Applications | SOLO BEATS",
  description: "Apply to become a SOLO BEATS radio DJ. Get approved for DJ access, live broadcasting, mixing tools, playlists, microphone controls, and the SOLO BEATS DJ workspace.",
  url: "https://www.solobeatsenginemusic.com/dj/radio",
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

      <DjRadioClient />
    </>
  );
}
