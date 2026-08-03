import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Music Store",
  description:
    "Buy Solo Beats albums and individual tracks securely, preview music, and access purchases through My Music.",
  alternates: {
    canonical: "/store",
  },
  openGraph: {
    title: "SOLO BEATS Music Store",
    description:
      "Buy Solo Beats albums and tracks securely and access purchases through My Music.",
    url: "/store",
  },
};

export default function StoreLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
