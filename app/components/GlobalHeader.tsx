"use client";

import Form from "next/form";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useAuth } from "../auth/AuthContext";
import { useFavorites } from "../favorites/useFavorites";
import OwnerNotifications from "./OwnerNotifications";

const OWNER_EMAIL = "supe4.me@gmail.com";

const links = [
  { href: "/", label: "Home" },
  { href: "/albums", label: "Albums" },
  { href: "/store", label: "Store" },
  { href: "/premium", label: "Premium" },
  { href: "/premium/radio", label: "Radio" },
  { href: "/premium/tv", label: "TV" },
  { href: "/favorites", label: "Favorites" },
  { href: "/my-music", label: "My Music" },
];

export default function GlobalHeader() {
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const { count: favoriteCount } = useFavorites();

  const isOwner =
    user?.email?.toLowerCase() === OWNER_EMAIL;

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#070711]/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-8">
        <Link href="/" className="min-w-0">
          <p className="truncate text-sm font-black tracking-[0.18em] text-white">
            SOLO BEATS ENGINE MUSIC
          </p>
          <p className="mt-1 text-xs text-white/45">
            Official music platform
          </p>
        </Link>

        <nav className="order-3 flex w-full flex-wrap items-center gap-2 md:order-2 md:w-auto">
          {links.map((link) => {
            const active =
              link.href === "/"
                ? pathname === "/"
                : pathname === link.href ||
                  pathname.startsWith(`${link.href}/`);

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                  active
                    ? "bg-white text-black"
                    : "text-white/65 hover:bg-white/10 hover:text-white"
                }`}
              >
                {link.label}
                {link.href === "/favorites" && favoriteCount > 0
                  ? ` (${favoriteCount})`
                  : ""}
              </Link>
            );
          })}

          {isOwner ? (
            <Link
              href="/developer"
              className={`rounded-full px-4 py-2 text-sm font-black transition ${
                pathname.startsWith("/developer")
                  ? "bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white shadow-lg shadow-violet-500/20"
                  : "border border-violet-400/30 bg-violet-500/10 text-violet-200 hover:bg-violet-500/20 hover:text-white"
              }`}
            >
              Owner Control Center
            </Link>
          ) : null}
        </nav>

        <div className="order-2 flex items-center gap-3 md:order-3">
          <OwnerNotifications />

          {loading ? (
            <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/45">
              Loading...
            </span>
          ) : user ? (
            <Link
              href="/account"
              className={`flex max-w-[220px] items-center gap-3 rounded-full border px-3 py-2 transition ${
                pathname.startsWith("/account")
                  ? "border-white bg-white text-black"
                  : "border-white/15 bg-white/5 text-white hover:bg-white/10"
              }`}
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-violet-500 to-cyan-400 text-xs font-black text-white">
                {(user.displayName || user.email || "SB")
                  .split(/\s+/)
                  .map((part) => part[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()}
              </span>

              <span className="min-w-0 text-left">
                <span className="block truncate text-xs font-black">
                  {user.displayName || "Account"}
                </span>
                <span
                  className={`block truncate text-[11px] ${
                    pathname.startsWith("/account")
                      ? "text-black/55"
                      : "text-white/45"
                  }`}
                >
                  {user.email}
                </span>
              </span>
            </Link>
          ) : (
            <Link
              href="/account"
              className={`rounded-full px-4 py-2 text-sm font-black transition ${
                pathname.startsWith("/account")
                  ? "bg-white text-black"
                  : "border border-white/15 bg-white/5 text-white hover:bg-white/10"
              }`}
            >
              Sign in
            </Link>
          )}
        </div>

        <Form
          action="/search"
          className="order-4 flex w-full items-center gap-2"
        >
          <input
            name="q"
            type="search"
            placeholder="Search albums and tracks..."
            aria-label="Search albums and tracks"
            autoComplete="off"
            spellCheck={false}
            className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-violet-400"
          />

          <button
            type="submit"
            className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-black"
          >
            Search
          </button>
        </Form>
      </div>
    </header>
  );
}



