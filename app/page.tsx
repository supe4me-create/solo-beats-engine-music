import Link from "next/link";

const albums = [
  {
    title: "Dark Horse",
    image: "/covers/darkhorse.png",
    year: "2026",
    tracks: "20 Tracks",
    link: "/albums/dark-horse",
    audio: "/previews/darkhorse.wav",
    paypal: "https://www.paypal.com/ncp/payment/R734NCX6XEV92",
  },
  {
    title: "Bass King",
    image: "/covers/bassking.png",
    year: "2026",
    tracks: "20 Tracks",
    link: "/albums/bass-king",
    audio: "/previews/bassking.wav",
    paypal: "https://www.paypal.com/ncp/payment/U8B2YMEPL6JDU",
  },
  {
    title: "Zombie Bassline",
    image: "/covers/zombiebassline.png",
    year: "2026",
    tracks: "20 Tracks",
    link: "/albums/zombie-bassline",
    audio: "/previews/zombiebassline.wav",
    paypal: "https://www.paypal.com/ncp/payment/F8GSSY65ZAQA4",
  },
  {
    title: "A World Built on Sound",
    image: "/covers/aworldbuiltonsound.png",
    year: "2026",
    tracks: "20 Tracks",
    link: "/albums/aworldbuiltonsound",
    audio: "/previews/aworldbuiltonsound.wav",
    paypal: "https://www.paypal.com/ncp/payment/YMSFJAQG99YFA",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white">
      {/* Navigation */}
      <header className="fixed left-0 top-0 z-50 w-full border-b border-white/10 bg-black/90 backdrop-blur-md">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <Link href="/" className="leading-tight">
            <span className="block text-xl font-black tracking-wider">
              SOLO BEATS
            </span>

            <span className="block text-xs font-bold tracking-[0.35em] text-red-500">
              ENGINE MUSIC
            </span>
          </Link>

          <div className="hidden items-center gap-8 md:flex">
            <Link href="/" className="font-semibold text-red-500">
              Home
            </Link>

            <Link
              href="/albums"
              className="font-semibold transition hover:text-red-500"
            >
              Albums
            </Link>

            <a
              href="#releases"
              className="font-semibold transition hover:text-red-500"
            >
              Tracks
            </a>

            <a
              href="#about"
              className="font-semibold transition hover:text-red-500"
            >
              About
            </a>

            <a
              href="#contact"
              className="font-semibold transition hover:text-red-500"
            >
              Contact
            </a>
          </div>

          <a
            href="https://youtube.com"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-red-600 px-4 py-2 text-sm font-bold transition hover:bg-red-600"
          >
            YouTube
          </a>
        </nav>
      </header>

      {/* Hero */}
      <section
        className="flex min-h-screen items-center justify-center bg-cover bg-center px-5 pt-24 text-center"
        style={{
          backgroundImage: "url('/covers/hero-home-v2.png')",
        }}
      >
        <div className="w-full max-w-5xl rounded-2xl border border-white/10 bg-black/70 px-6 py-10 shadow-2xl backdrop-blur-sm sm:px-10">
          <p className="mb-4 text-sm font-bold tracking-[0.35em] text-red-500">
            OFFICIAL MUSIC PLATFORM
          </p>

          <h1 className="text-4xl font-black leading-tight sm:text-6xl lg:text-7xl">
            SOLO BEATS ENGINE MUSIC
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-300">
            Aggressive electronic music, exclusive albums, previews and
            upcoming releases.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link
              href="/albums"
              className="rounded-lg bg-red-600 px-7 py-3 font-bold transition hover:scale-105 hover:bg-red-700"
            >
              Explore Albums
            </Link>

            <a
              href="https://youtube.com"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-white px-7 py-3 font-bold transition hover:scale-105 hover:bg-white hover:text-black"
            >
              Watch on YouTube
            </a>
          </div>
        </div>
      </section>

      {/* Latest Releases */}
      <section id="releases" className="scroll-mt-24 px-5 py-20">
        <div className="mx-auto max-w-7xl">
          <div className="mb-12 text-center">
            <p className="text-sm font-bold tracking-[0.35em] text-red-500">
              LATEST RELEASES
            </p>

            <h2 className="mt-3 text-4xl font-black sm:text-5xl">
              New &amp; Upcoming Albums
            </h2>

            <p className="mx-auto mt-4 max-w-2xl text-gray-400">
              Listen to previews of the upcoming Solo Beats projects and
              explore each album.
            </p>
          </div>

          <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-4">
            {albums.map((album) => (
              <article
                key={album.title}
                className="group overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-4 transition duration-300 hover:-translate-y-2 hover:border-red-500/60 hover:bg-white/10 hover:shadow-2xl"
              >
                <div className="relative overflow-hidden rounded-xl">
                  <img
                    src={album.image}
                    alt={`${album.title} album cover`}
                    className="aspect-square w-full object-cover transition duration-500 group-hover:scale-110"
                  />

                  <span className="absolute left-3 top-3 rounded-full bg-red-600 px-3 py-1 text-xs font-bold">
                    UPCOMING
                  </span>
                </div>

                <h3 className="mt-5 text-xl font-bold">{album.title}</h3>

                <p className="mt-2 text-sm text-gray-400">
                  {album.tracks} · {album.year}
                </p>

                <div className="mt-5">
                  <p className="mb-2 text-xs font-bold uppercase tracking-wider text-red-500">
                    Listen to Preview
                  </p>

                  <audio
                    controls
                    preload="none"
                    src={album.audio}
                    className="h-11 w-full"
                  >
                    Your browser does not support audio playback.
                  </audio>
                </div>

                <div className="mt-5 grid gap-3">
                  <Link
                    href={album.link}
                    className="rounded-lg border border-white/30 px-4 py-3 text-center font-bold transition hover:border-white hover:bg-white hover:text-black"
                  >
                    View Album
                  </Link>

                  <a
                    href={album.paypal}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg bg-red-600 px-4 py-3 text-center font-bold transition hover:bg-red-700"
                  >
                    Pre-Order - $20
                  </a>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-12 text-center">
            <Link
              href="/albums"
              className="inline-block rounded-lg border border-red-600 px-8 py-3 font-bold text-red-500 transition hover:bg-red-600 hover:text-white"
            >
              View All Albums
            </Link>
          </div>
        </div>
      </section>

      {/* About */}
      <section
        id="about"
        className="scroll-mt-24 border-y border-white/10 bg-white/[0.03] px-5 py-20"
      >
        <div className="mx-auto max-w-5xl text-center">
          <p className="text-sm font-bold tracking-[0.35em] text-red-500">
            ABOUT SOLO BEATS
          </p>

          <h2 className="mt-4 text-4xl font-black sm:text-5xl">
            Built Different. Sound Unmatched.
          </h2>

          <p className="mx-auto mt-6 max-w-3xl text-lg leading-8 text-gray-400">
            Solo Beats Engine Music is an independent electronic music platform
            built for aggressive sound, high-energy production and original
            releases.
          </p>
        </div>
      </section>

      {/* Contact */}
      <section
        id="contact"
        className="scroll-mt-24 px-5 py-20 text-center"
      >
        <div className="mx-auto max-w-3xl rounded-2xl border border-white/10 bg-white/5 px-6 py-12">
          <p className="text-sm font-bold tracking-[0.35em] text-red-500">
            STAY CONNECTED
          </p>

          <h2 className="mt-4 text-4xl font-black">Follow Solo Beats</h2>

          <p className="mt-5 text-gray-400">
            Discover new music, album updates and exclusive releases.
          </p>

          <a
            href="https://youtube.com"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-8 inline-block rounded-lg bg-red-600 px-8 py-3 font-bold transition hover:bg-red-700"
          >
            Visit YouTube
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 px-5 py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 text-center text-sm text-gray-500 md:flex-row">
          <p>© 2026 Solo Beats Engine Music. All rights reserved.</p>

          <Link href="/albums" className="transition hover:text-white">
            Albums
          </Link>
        </div>
      </footer>
    </main>
  );
}
