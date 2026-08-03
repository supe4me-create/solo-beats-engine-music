import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Business Advertising",
  description:
    "Advertise your business or brand across the SOLO BEATS homepage, Premium Radio, and Premium TV.",
  alternates: {
    canonical: "/business-advertising",
  },
  openGraph: {
    title: "Business Advertising | SOLO BEATS ENGINE MUSIC",
    description:
      "Run sponsored business and video campaigns across SOLO BEATS ENGINE MUSIC.",
    url: "/business-advertising",
  },
};

export default function BusinessAdvertisingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
