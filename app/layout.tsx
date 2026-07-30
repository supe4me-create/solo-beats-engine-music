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
  title: "SOLO BEATS ENGINE MUSIC",
  description:
    "The official SOLO BEATS ENGINE MUSIC platform for music, albums, previews, purchases, and premium listening.",
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
            © 2026 Solo Beats Engine Music. All rights reserved.
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
