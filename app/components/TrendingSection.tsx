"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type TrendingAlbum = {
  albumId: string;
  purchaseCount: number;
  albumPurchaseCount: number;
  trackPurchaseCount: number;
  latestPurchaseAt: string | null;
  title: string;
  genre: string;
  cover: string;
  href: string;
};

const fallbackItems: TrendingAlbum[] = [
  {
    albumId: "neon-overdrive",
    purchaseCount: 0,
    albumPurchaseCount: 0,
    trackPurchaseCount: 0,
    latestPurchaseAt: null,
    title: "Neon Overdrive",
    genre: "Complextro",
    cover: "/covers/neon-overdrive.jpg",
    href: "/store?album=neon-overdrive",
  },
  {
    albumId: "unchained-energy",
    purchaseCount: 0,
    albumPurchaseCount: 0,
    trackPurchaseCount: 0,
    latestPurchaseAt: null,
    title: "Unchained Energy",
    genre: "Electronic",
    cover: "/covers/unchained-energy.png",
    href: "/store?album=unchained-energy",
  },
  {
    albumId: "cygnus-x",
    purchaseCount: 0,
    albumPurchaseCount: 0,
    trackPurchaseCount: 0,
    latestPurchaseAt: null,
    title: "Cygnus X",
    genre: "Electronic",
    cover: "/covers/cygnus-x.jpg",
    href: "/store?album=cygnus-x",
  },
  {
    albumId: "tasty-smile",
    purchaseCount: 0,
    albumPurchaseCount: 0,
    trackPurchaseCount: 0,
    latestPurchaseAt: null,
    title: "Tasty Smile",
    genre: "Electronic",
    cover: "/covers/tasty-smile.jpg",
    href: "/store?album=tasty-smile",
  },
];

function getActivityLabel(item: TrendingAlbum) {
  if (item.albumPurchaseCount > 0 && item.trackPurchaseCount > 0) {
    return "Album + tracks";
  }

  if (item.albumPurchaseCount > 0) {
    return "Album sales";
  }

  return "Track sales";
}

function formatRefreshTime(value: string | null) {
  if (!value) {
    return "Just now";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Just now";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export default function TrendingSection() {
  const [items, setItems] = useState<TrendingAlbum[]>(fallbackItems);
  const [usingLiveData, setUsingLiveData] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function loadTrending() {
    setRefreshing(true);

    try {
      const response = await fetch("/api/trending", {
        cache: "no-store",
      });

      const data = await response.json();

      if (
        response.ok &&
        data.success &&
        Array.isArray(data.trending) &&
        data.trending.length > 0
      ) {
        setItems(data.trending.slice(0, 4));
        setUsingLiveData(true);
        setLastUpdated(new Date().toISOString());
      }
    } catch (error) {
      console.error("Trending music could not be loaded:", error);
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void loadTrending();
  }, []);

  return (
    <section className="border-t border-white/10 px-5 py-20">
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-sm font-bold tracking-[0.35em] text-violet-400">
              TRENDING
            </p>

            <h2 className="mt-3 text-4xl font-black sm:text-5xl">
              Popular right now
            </h2>

            <p className="mt-4 max-w-2xl text-gray-400">
              {usingLiveData
                ? "Ranked automatically from completed customer purchases."
                : "Popular selections from the Solo Beats catalog."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-200">
              <span className="font-bold">Live data</span>
              <span className="mx-2 text-emerald-300/50">•</span>
              Updated {formatRefreshTime(lastUpdated)}
            </div>

            <button
              type="button"
              onClick={() => void loadTrending()}
              disabled={refreshing}
              className="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item, index) => (
            <Link
              key={item.albumId}
              href={item.href}
              className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:-translate-y-2 hover:border-violet-400/50 hover:bg-white/10"
            >
              <span className="absolute left-6 top-6 z-10 grid h-10 w-10 place-items-center rounded-full bg-violet-500 text-sm font-black shadow-lg">
                {index + 1}
              </span>

              <img
                src={item.cover}
                alt={`${item.title} cover`}
                className="aspect-square w-full rounded-xl object-cover transition duration-500 group-hover:scale-105"
              />

              <div className="mt-5 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-black uppercase tracking-[0.13em] text-violet-300">
                  {usingLiveData ? getActivityLabel(item) : "Album"}
                </span>

                {usingLiveData ? (
                  <span className="text-xs text-white/40">
                    {item.purchaseCount}{" "}
                    {item.purchaseCount === 1 ? "purchase" : "purchases"}
                  </span>
                ) : null}
              </div>

              <h3 className="mt-3 text-xl font-black">{item.title}</h3>
              <p className="mt-2 text-sm text-gray-400">{item.genre}</p>
            </Link>
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link
            href="/store"
            className="inline-flex rounded-lg border border-violet-400 px-7 py-3 font-black text-violet-300 transition hover:bg-violet-500 hover:text-white"
          >
            Shop Trending Music
          </Link>
        </div>
      </div>
    </section>
  );
}
