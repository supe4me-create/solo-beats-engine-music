import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import GlobalHeader from "./components/GlobalHeader";
import { AuthProvider } from "./auth/AuthContext";
import GlobalPlayer from "./player/GlobalPlayer";
import { PlayerProvider } from "./player/PlayerContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.solobeatsenginemusic.com"),
  title: {
    default: "SOLO BEATS ENGINE MUSIC | Official Music Platform",
    template: "%s | SOLO BEATS ENGINE MUSIC",
  },
  description:
    "Discover Solo Beats albums, music previews, secure purchases, Premium Radio, Premium TV, artist promotion, and business advertising.",
  applicationName: "SOLO BEATS ENGINE MUSIC",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      {
        url: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        url: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
    apple: [
      {
        url: "/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
  appleWebApp: {
    capable: true,
    title: "SOLO BEATS",
    statusBarStyle: "black-translucent",
  },
  authors: [{ name: "Solo Beats" }],
  creator: "Solo Beats",
  publisher: "SOLO BEATS ENGINE MUSIC",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "SOLO BEATS ENGINE MUSIC",
    title: "SOLO BEATS ENGINE MUSIC | Official Music Platform",
    description:
      "Discover Solo Beats albums, previews, purchases, Premium Radio, Premium TV, artist promotion, and advertising.",
    images: [
      {
        url: "/covers/hero-home-final.png",
        width: 1200,
        height: 630,
        alt: "SOLO BEATS ENGINE MUSIC",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "SOLO BEATS ENGINE MUSIC | Official Music Platform",
    description:
      "Discover Solo Beats albums, previews, purchases, Premium Radio, Premium TV, artist promotion, and advertising.",
    images: ["/covers/hero-home-final.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};


function SocialFooter() {
  const socialLinks = [
    {
      name: "YouTube",
      href: "https://www.youtube.com/@SOLOBEATSENGINEMUSIC",
    },
    {
      name: "Spotify",
      href: "https://open.spotify.com/artist/6sulBcam91bXxOqB9t1LCp?si=zyMStYZ1ShmFYKObje9SWA",
    },
    {
      name: "Bandcamp",
      href: "https://solobeats3.bandcamp.com/album/strange-feeling",
    },
  ];

  return (
    <footer className="border-t border-white/10 bg-black/30 px-5 py-8 sm:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.2em] text-white">
            SOLO BEATS ENGINE MUSIC
          </p>
          <p className="mt-2 text-sm text-white/45">
            {"\u00A9"} 2026 Solo Beats Engine Music. All rights reserved.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          {socialLinks.map((link) => (
            <a
              key={link.name}
              href={link.href}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black transition hover:-translate-y-0.5 hover:border-fuchsia-400/40 hover:bg-white/10"
            >
              {link.name}
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body
        className="min-h-full flex flex-col"
        style={{ background: "#070711", color: "#ffffff" }}
      >
        <AuthProvider>
          <PlayerProvider>
            <GlobalHeader />
            <main className="flex-1">{children}</main>
            <SocialFooter />
            <GlobalPlayer />
          </PlayerProvider>
        </AuthProvider>
      </body>
    </html>
  );
}


