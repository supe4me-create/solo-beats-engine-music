import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Buy Solo Beats Albums and Tracks",
  description:
    "Buy official Solo Beats albums and individual tracks, listen to full songs and previews, and access secure purchases through My Music.",
  keywords: [
    "buy Solo Beats music",
    "buy electronic music",
    "buy EDM albums",
    "download electronic music",
    "independent music store",
    "buy individual tracks",
    "Solo Beats store",
  ],
  alternates: {
    canonical: "/store",
  },
  openGraph: {
    type: "website",
    title: "Buy Solo Beats Albums and Tracks",
    description:
      "Shop official Solo Beats albums and tracks, listen before buying, and access purchases securely through My Music.",
    url: "/store",
    images: [
      {
        url: "/covers/hero-home-final.png",
        width: 1200,
        height: 630,
        alt: "Solo Beats music store",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Buy Solo Beats Albums and Tracks",
    description:
      "Shop official Solo Beats albums and individual tracks with secure access through My Music.",
    images: ["/covers/hero-home-final.png"],
  },
};

export default function StoreLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}