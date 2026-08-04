import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Solo Beats Albums and Electronic Music Releases",
  description:
    "Explore official Solo Beats albums, released music, upcoming projects, electronic genres, album artwork, full songs, and track previews.",
  keywords: [
    "Solo Beats albums",
    "Solo Beats music",
    "electronic music albums",
    "EDM albums",
    "new electronic music",
    "independent music releases",
    "music previews",
  ],
  alternates: {
    canonical: "/albums",
  },
  openGraph: {
    type: "website",
    title:
      "Solo Beats Albums and Electronic Music Releases",
    description:
      "Explore official Solo Beats albums, upcoming releases, electronic genres, artwork, full songs, and music previews.",
    url: "/albums",
    images: [
      {
        url: "/covers/hero-home-final.png",
        width: 1200,
        height: 630,
        alt: "Solo Beats albums and electronic music releases",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title:
      "Solo Beats Albums and Electronic Music Releases",
    description:
      "Explore official Solo Beats albums, upcoming releases, artwork, full songs, and music previews.",
    images: ["/covers/hero-home-final.png"],
  },
};

export default function AlbumsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}