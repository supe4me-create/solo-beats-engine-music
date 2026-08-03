import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Premium TV",
  description:
    "Watch SOLO BEATS PREMIUM TV with visual music programming, live visualizers, and a two-program public preview.",
  alternates: {
    canonical: "/premium/tv",
  },
  openGraph: {
    title: "SOLO BEATS PREMIUM TV",
    description:
      "Visual music programming, live visualizers, and a free two-program preview.",
    url: "/premium/tv",
  },
};

export default function TvLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
