import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Solo Beats Albums",
  description:
    "Explore official Solo Beats albums, upcoming releases, genres, artwork, and music previews.",
  alternates: {
    canonical: "/albums",
  },
  openGraph: {
    title: "Solo Beats Albums",
    description:
      "Explore official Solo Beats albums, upcoming releases, genres, artwork, and music previews.",
    url: "/albums",
  },
};

export default function AlbumsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
