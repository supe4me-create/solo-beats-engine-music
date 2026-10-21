import type { Metadata } from "next";
import type { ReactNode } from "react";

const title =
  "Artist Membership | SOLO BEATS ENGINE MUSIC";

const description =
  "Join SOLO BEATS Artist Membership for artist promotion opportunities, creator benefits, analytics, music uploads, and savings on SOLO BEATS music services.";

export const metadata: Metadata = {
  title,
  description,

  alternates: {
    canonical: "/artist-membership",
  },

  openGraph: {
    type: "website",
    url: "/artist-membership",
    siteName: "SOLO BEATS ENGINE MUSIC",
    title,
    description,
  },

  twitter: {
    card: "summary_large_image",
    title,
    description,
  },

  robots: {
    index: true,
    follow: true,
  },
};

export default function ArtistMembershipLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
