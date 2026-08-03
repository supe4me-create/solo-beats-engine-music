import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SOLO BEATS PREMIUM",
  description:
    "Join SOLO BEATS PREMIUM for the Premium Library, Radio, TV, monthly downloads, and exclusive music access.",
  alternates: {
    canonical: "/premium",
  },
  openGraph: {
    title: "SOLO BEATS PREMIUM",
    description:
      "Premium music, Radio, TV, monthly downloads, and exclusive member access.",
    url: "/premium",
  },
};

export default function PremiumLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
