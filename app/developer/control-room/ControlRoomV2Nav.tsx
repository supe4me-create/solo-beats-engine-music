"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type Tool = {
  title: string;
  href: string;
};

type Group = {
  title: string;
  tools: Tool[];
};

const groups: Group[] = [
  {
    title: "Radio & Television",
    tools: [
      { title: "Radio Management", href: "/developer/radio" },
      { title: "OBS Radio", href: "/developer/obs-radio" },
      { title: "Live TV Management", href: "/developer/live-tv" },
      { title: "Premium Radio", href: "/premium/radio" },
      { title: "Premium TV", href: "/premium/tv" },
    ],
  },
  {
    title: "Music & Production",
    tools: [
      { title: "Album Management", href: "/developer/albums" },
      { title: "SOLO BEATS DAW", href: "/developer/daw" },
      { title: "Mix & Mastering", href: "/developer/mix-mastering" },
      { title: "Stem Lab", href: "/developer/stem-lab" },
      { title: "Music Visualizer", href: "/developer/music-visualizer" },
      { title: "Hum to Beat", href: "/developer/hum-to-beat" },
    ],
  },
  {
    title: "Video & Creators",
    tools: [
      { title: "Video Management", href: "/developer/videos" },
      {
        title: "Creator Approval Center",
        href: "/developer/videos#creator-approval-center",
      },
      {
        title: "Auto Video Generator",
        href: "/developer/auto-video-generator",
      },
      { title: "AI Video", href: "/developer/ai-video" },
      {
        title: "Content Moderation",
        href: "/developer/connect-moderation",
      },
    ],
  },
  {
    title: "Customers & Business",
    tools: [
      { title: "Customer Management", href: "/developer/customers" },
      { title: "Premium Members", href: "/developer/premium-members" },
      { title: "Orders", href: "/developer/orders" },
      { title: "Products", href: "/developer/products" },
      { title: "Catalog", href: "/developer/catalog" },
      { title: "Creator Payouts", href: "/developer/connect-payouts" },
    ],
  },
  {
    title: "Marketing & Promotion",
    tools: [
      { title: "Artist Promotions", href: "/developer/artist-promotions" },
      {
        title: "Business Advertising",
        href: "/developer/business-advertising",
      },
      { title: "Social Scheduler", href: "/developer/social-scheduler" },
      { title: "Analytics", href: "/developer/analytics" },
    ],
  },
  {
    title: "Owner & Platform Tools",
    tools: [
      { title: "Owner Tools Hub", href: "/developer/owner-tools" },
      { title: "Homepage Management", href: "/developer/homepage" },
      { title: "Media Library", href: "/developer/media" },
      { title: "Download Testing", href: "/developer/download-testing" },
      { title: "Visualizer Credits", href: "/developer/visualizer-credits" },
      { title: "DJ Workspace", href: "/dj/radio" },
      { title: "DJ Turntable", href: "/dj/turntable" },
    ],
  },
];

const defaultFavorites = [
  "/developer/radio",
  "/developer/obs-radio",
  "/developer/albums",
  "/developer/social-scheduler",
];

export default function ControlRoomV2Nav() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const [favorites, setFavorites] = useState(defaultFavorites);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (!q) return groups;

    return groups
      .map((group) => ({
        ...group,
        tools: group.tools.filter(
          (tool) =>
            tool.title.toLowerCase().includes(q) ||
            group.title.toLowerCase().includes(q)
        ),
      }))
      .filter((group) => group.tools.length > 0);
  }, [search]);

  const allTools = groups.flatMap((group) => group.tools);

  const favoriteTools = allTools.filter((tool) =>
    favorites.includes(tool.href)
  );

  function toggleFavorite(href: string) {
    setFavorites((current) =>
      current.includes(href)
        ? current.filter((value) => value !== href)
        : [...current, href]
    );
  }

  function toggleGroup(title: string) {
    setCollapsed((current) =>
      current.includes(title)
        ? current.filter((value) => value !== title)
        : [...current, title]
    );
  }

  return (
    <>
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-red-500/25 bg-black px-4 py-3 text-white lg:hidden">
        <span className="text-sm font-black tracking-widest text-red-400">
          SOLO BEATS CONTROL ROOM
        </span>
        <button
          type="button"
          aria-label={mobileOpen ? "Close owner navigation" : "Open owner navigation"}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen(!mobileOpen)}
          className="rounded-lg border border-white/20 px-3 py-2"
        >
          {mobileOpen ? "CLOSE" : "MENU"}
        </button>
      </div>

      <aside
        aria-label="Owner Control Room navigation"
        className={`border-r border-red-500/20 bg-[#080808] text-white ${
          mobileOpen ? "block" : "hidden"
        } lg:sticky lg:top-0 lg:block lg:h-screen lg:w-72 lg:shrink-0 lg:overflow-y-auto`}
      >
        <div className="p-4">
          <div className="mb-5 hidden lg:block">
            <p className="text-xs font-black tracking-widest text-red-400">
              SOLO BEATS ENGINE MUSIC
            </p>
            <h2 className="mt-2 text-xl font-black">OWNER CONTROL ROOM</h2>
          </div>

          <nav className="mb-4 grid grid-cols-2 gap-2 text-xs font-bold">
            <Link href="/developer/control-room" onClick={() => setMobileOpen(false)}
              className="rounded-lg bg-red-600 px-3 py-3 text-center">
              OVERVIEW
            </Link>
            <Link href="/developer/owner-tools" onClick={() => setMobileOpen(false)}
              className="rounded-lg border border-white/20 px-3 py-3 text-center">
              OWNER TOOLS
            </Link>
            <Link href="/" onClick={() => setMobileOpen(false)}
              className="col-span-2 rounded-lg border border-white/20 px-3 py-2 text-center">
              PLATFORM HOME
            </Link>
          </nav>

          <label htmlFor="solo-v2-search" className="mb-2 block text-xs font-bold text-zinc-400">
            FIND A MANAGEMENT TOOL
          </label>
          <input
            id="solo-v2-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search tools..."
            className="mb-5 w-full rounded-xl border border-white/20 bg-zinc-950 px-3 py-3 text-sm text-white outline-none focus:border-red-500"
          />

          {!search && favoriteTools.length > 0 && (
            <section className="mb-5">
              <h3 className="mb-2 text-xs font-black tracking-widest text-red-400">
                QUICK ACCESS
              </h3>
              {favoriteTools.map((tool) => (
                <Link key={tool.href} href={tool.href}
                  onClick={() => setMobileOpen(false)}
                  className="block rounded-lg px-3 py-2 text-sm hover:bg-white/10">
                  {tool.title}
                </Link>
              ))}
            </section>
          )}

          {filtered.map((group) => {
            const isCollapsed = !search && collapsed.includes(group.title);

            return (
              <section key={group.title} className="mb-3 border-t border-white/10 pt-3">
                <button
                  type="button"
                  onClick={() => toggleGroup(group.title)}
                  aria-expanded={!isCollapsed}
                  className="flex w-full items-center justify-between text-left text-xs font-black tracking-wide text-cyan-300"
                >
                  {group.title.toUpperCase()}
                  <span>{isCollapsed ? "+" : "-"}</span>
                </button>

                {!isCollapsed && (
                  <div className="mt-2 space-y-1">
                    {group.tools.map((tool) => (
                      <div key={tool.href} className="flex items-center rounded-lg hover:bg-white/10">
                        <Link href={tool.href} onClick={() => setMobileOpen(false)}
                          className="min-w-0 flex-1 px-3 py-2 text-sm text-zinc-200">
                          {tool.title}
                        </Link>
                        <button
                          type="button"
                          aria-label={`Toggle favorite for ${tool.title}`}
                          aria-pressed={favorites.includes(tool.href)}
                          onClick={() => toggleFavorite(tool.href)}
                          className="px-3 py-2 text-yellow-400"
                        >
                          {favorites.includes(tool.href) ? "★" : "☆"}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            );
          })}

          {filtered.length === 0 && (
            <p className="text-sm text-zinc-400">No matching tools.</p>
          )}
        </div>
      </aside>
    </>
  );
}