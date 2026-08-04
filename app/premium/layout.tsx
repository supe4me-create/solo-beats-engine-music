import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SOLO BEATS PREMIUM Music, Radio and TV",
  description:
    "Join SOLO BEATS PREMIUM for exclusive music, Premium Radio, Premium TV, monthly track downloads, early access, and full member playback.",
  keywords: [
    "Solo Beats Premium",
    "premium electronic music",
    "music subscription",
    "electronic music radio",
    "music TV",
    "exclusive music access",
    "monthly music downloads",
  ],
  alternates: {
    canonical: "/premium",
  },
  openGraph: {
    type: "website",
    title: "SOLO BEATS PREMIUM Music, Radio and TV",
    description:
      "Get exclusive music, Premium Radio, Premium TV, monthly downloads, and full member access.",
    url: "/premium",
    images: [
      {
        url: "/covers/hero-home-final.png",
        width: 1200,
        height: 630,
        alt: "SOLO BEATS PREMIUM",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "SOLO BEATS PREMIUM Music, Radio and TV",
    description:
      "Exclusive music, Premium Radio, Premium TV, monthly downloads, and member-only access.",
    images: ["/covers/hero-home-final.png"],
  },
};

export default function PremiumLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}