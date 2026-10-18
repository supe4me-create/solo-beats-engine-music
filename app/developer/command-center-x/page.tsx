"use client";

// SOLO_BEATS_COMMAND_CENTER_X_V2

import Link from "next/link";
import { useAuth } from "../../auth/AuthContext";

const OWNER_EMAIL = "supe4.me@gmail.com";

const sections = [
  {
    title: "BROADCAST HEADQUARTERS",
    tools: [
      ["RADIO", "Premium Radio", "/developer/radio"],
      ["TV", "Premium TV & Video Manager", "/developer/videos"],
      ["MEDIA", "Music & Media Library", "/developer/media"],
    ],
  },
  {
    title: "PROMOTION COMMAND",
    tools: [
      ["SOCIAL", "Social Promotion Scheduler", "/developer/social-scheduler"],
      ["ARTISTS", "Artist Promotion Approvals", "/developer/artist-promotions"],
      ["ADVERTISING", "Business & Video Advertising", "/developer/business-advertising"],
    ],
  },
  {
    title: "CREATOR STUDIO",
    tools: [
      ["AI VIDEO", "AI Video Studio", "/developer/ai-video"],
      ["ALBUMS", "Album Manager", "/developer/albums"],
      ["APPROVAL", "Creator Approval Center", "/developer/videos#creator-approval-center"],
    ],
  },
  {
    title: "BUSINESS OPERATIONS",
    tools: [
      ["CUSTOMERS", "Customer Management", "/developer/customers"],
      ["ORDERS", "Orders & Sales", "/developer/orders"],
      ["PREMIUM", "Premium Members", "/developer/premium-members"],
      ["HOME", "Homepage Manager", "/developer/homepage"],
    ],
  },
];

export default function CommandCenterX() {
  const { user, loading } = useAuth();

  const isOwner =
    !!user &&
    user.email?.toLowerCase() === OWNER_EMAIL.toLowerCase();

  if (loading) {
    return (
      <main className="min-h-screen bg-[#080611] p-10 text-white">
        Verifying owner access...
      </main>
    );
  }

  if (!isOwner) {
    return (
      <main className="min-h-screen bg-[#080611] p-10 text-center text-white">
        <h1 className="text-3xl font-black">
          OWNER ACCESS REQUIRED
        </h1>
        <p className="mt-4 text-zinc-400">
          This headquarters is restricted to the authorized platform owner.
        </p>
        <Link href="/developer"
          className="mt-8 inline-block rounded-xl border border-purple-500 px-6 py-3">
          Original Control Room
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#080611] px-5 py-10 text-white">
      <div className="mx-auto max-w-7xl">
        <header className="rounded-3xl border border-purple-500/40 bg-gradient-to-br from-[#291143] via-[#140b28] to-[#340b28] p-8 shadow-2xl md:p-12">
          <div className="text-sm font-black tracking-[0.25em] text-fuchsia-300">
            SOLO BEATS ENGINE MUSIC
          </div>

          <div className="mt-5 inline-block rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-xs font-black text-emerald-300">
            OWNER ACCESS VERIFIED
          </div>

          <h1 className="mt-6 bg-gradient-to-r from-white via-purple-200 to-fuchsia-400 bg-clip-text text-4xl font-black text-transparent md:text-6xl">
            COMMAND CENTER X
          </h1>

          <p className="mt-5 max-w-3xl text-lg text-zinc-300">
            Your private headquarters for music, broadcasting,
            video production, social promotions, advertising
            and business operations.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/developer/social-scheduler"
              className="rounded-xl bg-gradient-to-r from-purple-600 to-fuchsia-600 px-5 py-4 font-black">
              SOCIAL SCHEDULER
            </Link>
            <Link href="/developer"
              className="rounded-xl border border-white/30 px-5 py-4 font-bold">
              FULL OWNER DASHBOARD
            </Link>
            <Link href="/developer"
              className="rounded-xl border border-white/30 px-5 py-4 font-bold">
              ORIGINAL OWNER DASHBOARD
            </Link>
          </div>
        </header>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            "BROADCAST NETWORK",
            "PROMOTION ENGINE",
            "OWNER OPERATIONS",
          ].map((item) => (
            <div key={item}
              className="rounded-2xl border border-fuchsia-500/30 bg-[#1d1030] p-6 text-center text-sm font-black tracking-widest text-purple-200">
              {item}
            </div>
          ))}
        </div>

        {sections.map((section) => (
          <section key={section.title} className="mt-12">
            <h2 className="mb-6 text-xl font-black tracking-widest text-fuchsia-300">
              {section.title}
            </h2>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {section.tools.map(([label, title, href]) => (
                <Link key={label + href} href={href}
                  className="group rounded-2xl border border-purple-400/20 bg-[#171020] p-6 transition hover:border-fuchsia-400 hover:bg-[#291638]">
                  <div className="mb-4 text-xs font-black tracking-widest text-fuchsia-400">
                    {label}
                  </div>
                  <div className="text-lg font-black">
                    {title}
                  </div>
                  <div className="mt-6 text-sm font-bold text-purple-300">
                    OPEN TOOL
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))}

        <footer className="mt-16 border-t border-white/10 py-8 text-center text-xs tracking-widest text-zinc-500">
          SOLO BEATS ENGINE MUSIC - COMMAND CENTER X
        </footer>
      </div>
    </main>
  );
}