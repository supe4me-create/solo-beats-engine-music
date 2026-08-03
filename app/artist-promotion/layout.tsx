import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Artist Promotion",
  description:
    "Promote your song, artwork, or music video across SOLO BEATS ENGINE MUSIC with sponsored artist placement.",
  alternates: {
    canonical: "/artist-promotion",
  },
  openGraph: {
    title: "Artist Promotion | SOLO BEATS ENGINE MUSIC",
    description:
      "Submit your song, artwork, or promotional video for sponsored placement.",
    url: "/artist-promotion",
  },
};

export default function ArtistPromotionLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
