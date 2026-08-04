import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Business and Video Advertising",
  description:
    "Advertise your business, brand, product, or promotional video across the SOLO BEATS homepage, Store, Premium Radio, and Premium TV.",
  keywords: [
    "business advertising",
    "video advertising",
    "brand promotion",
    "music platform advertising",
    "sponsored business campaign",
    "homepage advertising",
    "radio and TV advertising",
  ],
  alternates: {
    canonical: "/business-advertising",
  },
  openGraph: {
    type: "website",
    title: "Business and Video Advertising",
    description:
      "Run sponsored business and video campaigns across SOLO BEATS ENGINE MUSIC.",
    url: "/business-advertising",
    images: [
      {
        url: "/covers/hero-home-final.png",
        width: 1200,
        height: 630,
        alt: "Business and video advertising on SOLO BEATS ENGINE MUSIC",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Business and Video Advertising",
    description:
      "Promote your business or video across the SOLO BEATS platform.",
    images: ["/covers/hero-home-final.png"],
  },
};

export default function BusinessAdvertisingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}