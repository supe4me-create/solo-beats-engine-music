import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Premium Radio",
  description:
    "Listen to SOLO BEATS PREMIUM RADIO with continuous electronic music programming and a two-song public preview.",
  alternates: {
    canonical: "/premium/radio",
  },
  openGraph: {
    title: "SOLO BEATS PREMIUM RADIO",
    description:
      "Continuous Solo Beats music programming with a free two-song preview.",
    url: "/premium/radio",
  },
};

export default function RadioLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
