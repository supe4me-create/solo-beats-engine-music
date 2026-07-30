"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { useAuth } from "../auth/AuthContext";
import { albums } from "../store/albums";

type OwnedItem = {
  name: string;
  description: string | null;
  sku: string | null;
  itemType: "album" | "track";
  itemId: string;
  quantity: number;
  unitAmount: string | null;
  currency: string;
};

type Purchase = {
  orderId: string;
  captureId: string;
  amount: string | null;
  currency: string;
  purchasedAt: string | null;
  items: OwnedItem[];
};

type LibraryEntry = {
  key: string;
  orderId: string;
  captureId: string;
  purchasedAt: string | null;
  amount: string | null;
  currency: string;
  item: OwnedItem;
  albumId: string;
  albumTitle: string;
  albumCover: string;
  trackNumber: number | null;
};

type AlbumGroup = {
  id: string;
  title: string;
  cover: string;
  ownsFullAlbum: boolean;
  entries: LibraryEntry[];
  latestPurchaseAt: string | null;
};

type DownloadState = {
  loading: boolean;
  error: string;
};

function findAlbum(item: OwnedItem) {
  if (item.itemType === "album") {
    return albums.find((album) => album.id === item.itemId) || null;
  }

  return (
    albums.find((album) =>
      album.tracks.some((track) => track.id === item.itemId)
    ) || null
  );
}

function formatDate(value: string | null) {
  if (!value) return "Completed purchase";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Completed purchase";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatMoney(amount: string | null, currency: string) {
  if (!amount) return "Paid";

  const value = Number(amount);
  if (Number.isNaN(value)) return `${currency} ${amount}`;

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
  }).format(value);
}

export default function MyMusicPage() {
  const { user, loading } = useAuth();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loadingLibrary, setLoadingLibrary] = useState(false);
  const [libraryError, setLibraryError] = useState("");
  const [librarySearch, setLibrarySearch] = useState("");
  const [downloadStates, setDownloadStates] = useState<
    Record<string, DownloadState>
  >({});

  useEffect(() => {
    if (!user) {
      setPurchases([]);
      return;
    }

    const currentUser = user;
    let cancelled = false;

    async function loadLibrary() {
      setLoadingLibrary(true);
      setLibraryError("");

      try {
        const token = await currentUser.getIdToken();
        const response = await fetch("/api/my-music", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || "Your music library could not be loaded.");
        }

        if (!cancelled) {
          setPurchases(Array.isArray(data.purchases) ? data.purchases : []);
        }
      } catch (error) {
        if (!cancelled) {
          setLibraryError(
            error instanceof Error
              ? error.message
              : "Your music library could not be loaded."
          );
        }
      } finally {
        if (!cancelled) setLoadingLibrary(false);
      }
    }

    void loadLibrary();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const entries = useMemo<LibraryEntry[]>(
    () =>
      purchases.flatMap((purchase) =>
        purchase.items.map((item) => {
          const album = findAlbum(item);
          const track =
            item.itemType === "track"
              ? album?.tracks.find((candidate) => candidate.id === item.itemId)
              : null;

          return {
            key: `${purchase.orderId}-${item.itemType}-${item.itemId}`,
            orderId: purchase.orderId,
            captureId: purchase.captureId,
            purchasedAt: purchase.purchasedAt,
            amount: purchase.amount,
            currency: purchase.currency,
            item,
            albumId: album?.id || item.itemId,
            albumTitle: album?.title || item.name,
            albumCover: album?.cover || "/covers/reckoning.png",
            trackNumber: typeof track?.number === "number" ? track.number : null,
          };
        })
      ),
    [purchases]
  );

  const groups = useMemo<AlbumGroup[]>(() => {
    const map = new Map<string, AlbumGroup>();

    for (const entry of entries) {
      const current = map.get(entry.albumId);

      if (current) {
        current.entries.push(entry);
        current.ownsFullAlbum =
          current.ownsFullAlbum || entry.item.itemType === "album";

        const currentTime = current.latestPurchaseAt
          ? new Date(current.latestPurchaseAt).getTime()
          : 0;
        const entryTime = entry.purchasedAt
          ? new Date(entry.purchasedAt).getTime()
          : 0;

        if (entryTime > currentTime) {
          current.latestPurchaseAt = entry.purchasedAt;
        }
      } else {
        map.set(entry.albumId, {
          id: entry.albumId,
          title: entry.albumTitle,
          cover: entry.albumCover,
          ownsFullAlbum: entry.item.itemType === "album",
          entries: [entry],
          latestPurchaseAt: entry.purchasedAt,
        });
      }
    }

    return Array.from(map.values())
      .map((group) => ({
        ...group,
        entries: [...group.entries].sort((a, b) => {
          if (a.item.itemType === "album") return -1;
          if (b.item.itemType === "album") return 1;
          return (a.trackNumber || 999) - (b.trackNumber || 999);
        }),
      }))
      .sort((a, b) => {
        const aTime = a.latestPurchaseAt
          ? new Date(a.latestPurchaseAt).getTime()
          : 0;
        const bTime = b.latestPurchaseAt
          ? new Date(b.latestPurchaseAt).getTime()
          : 0;

        if (aTime !== bTime) return bTime - aTime;
        return a.title.localeCompare(b.title);
      });
  }, [entries]);

  const albumCount = groups.filter((group) => group.ownsFullAlbum).length;
  const trackCount = entries.filter((entry) => entry.item.itemType === "track").length;
  const albumGroupCount = groups.length;

  const filteredGroups = useMemo(() => {
    const query = librarySearch.trim().toLowerCase();

    if (!query) return groups;

    return groups.filter((group) => {
      if (group.title.toLowerCase().includes(query)) return true;

      return group.entries.some((entry) =>
        entry.item.name.toLowerCase().includes(query)
      );
    });
  }, [groups, librarySearch]);

  async function downloadItem(entry: LibraryEntry) {
    setDownloadStates((current) => ({
      ...current,
      [entry.key]: { loading: true, error: "" },
    }));

    try {
      const response = await fetch("/api/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: entry.orderId,
          captureId: entry.captureId,
          itemId: entry.item.itemId,
        }),
      });
      const data = await response.json();

      if (!response.ok || !data.success || typeof data.downloadUrl !== "string") {
        throw new Error(data.error || "The secure download could not be generated.");
      }

      window.open(data.downloadUrl, "_blank", "noopener,noreferrer");
      setDownloadStates((current) => ({
        ...current,
        [entry.key]: { loading: false, error: "" },
      }));
    } catch (error) {
      setDownloadStates((current) => ({
        ...current,
        [entry.key]: {
          loading: false,
          error:
            error instanceof Error
              ? error.message
              : "The secure download could not be generated.",
        },
      }));
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen grid place-items-center px-6">
        <p className="text-white/70">Loading My Music...</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen grid place-items-center px-5 py-10">
        <section className="w-full max-w-xl rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 text-center shadow-2xl sm:p-12">
          <p className="text-sm font-bold uppercase tracking-[0.22em] text-emerald-300">
            My Music
          </p>
          <h1 className="mt-3 text-4xl font-black">Sign in to open your library</h1>
          <p className="mt-4 text-white/65">
            Your purchased albums and tracks will appear here.
          </p>
          <Link
            href="/account"
            className="mt-8 inline-flex rounded-2xl bg-white px-6 py-4 font-black text-black"
          >
            Sign in or create account
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-5 pb-40 pt-52 sm:px-8">
      <div className="mx-auto max-w-7xl">

        <section className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-violet-500/20 via-white/[0.04] to-cyan-400/10 p-7 shadow-2xl sm:p-10">
          <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.22em] text-emerald-300">
                Personal library
              </p>
              <h1 className="mt-3 text-4xl font-black sm:text-6xl">My Music</h1>
              <p className="mt-4 max-w-2xl text-white/65">
                Signed in as {user.email}. Your completed purchases and fresh secure download access appear below.
              </p>
            </div>
            <Link
              href="/store"
              className="inline-flex w-fit rounded-2xl bg-white px-6 py-4 font-black text-black"
            >
              Browse More Music
            </Link>
          </div>
        </section>

        {loadingLibrary ? (
          <section className="mt-8 rounded-[2rem] border border-white/10 bg-white/[0.03] p-10 text-center">
            <p className="text-white/70">Loading your purchases...</p>
          </section>
        ) : libraryError ? (
          <section className="mt-8 rounded-[2rem] border border-red-400/20 bg-red-400/10 p-6 text-red-200">
            {libraryError}
          </section>
        ) : entries.length === 0 ? (
          <section className="mt-8 rounded-[2rem] border border-dashed border-white/15 bg-white/[0.025] p-8 text-center sm:p-12">
            <h2 className="text-2xl font-black">No linked purchases yet</h2>
            <p className="mx-auto mt-3 max-w-xl text-white/60">
              Stay signed in while completing your next PayPal purchase. The purchased album or track will appear here automatically.
            </p>
          </section>
        ) : (
          <>
            <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
                <p className="text-sm text-white/50">Owned items</p>
                <p className="mt-2 text-3xl font-black">{entries.length}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
                <p className="text-sm text-white/50">Album groups</p>
                <p className="mt-2 text-3xl font-black">{albumGroupCount}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
                <p className="text-sm text-white/50">Full albums</p>
                <p className="mt-2 text-3xl font-black">{albumCount}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
                <p className="text-sm text-white/50">Individual tracks</p>
                <p className="mt-2 text-3xl font-black">{trackCount}</p>
              </div>
            </section>

            <section className="mt-8 rounded-[2rem] border border-white/10 bg-white/[0.025] p-4 sm:p-5">
              <label
                htmlFor="library-search"
                className="sr-only"
              >
                Search your music library
              </label>
              <input
                id="library-search"
                value={librarySearch}
                onChange={(event) => setLibrarySearch(event.target.value)}
                placeholder="Search your albums and purchased tracks..."
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-5 py-4 text-white outline-none transition placeholder:text-white/35 focus:border-violet-400/60 focus:ring-4 focus:ring-violet-500/10"
              />
            </section>

            <section className="mt-8">
              <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-sm font-bold uppercase tracking-[0.2em] text-violet-300">
                    Your collection
                  </p>
                  <h2 className="mt-2 text-3xl font-black">Your album library</h2>
                </div>
                <p className="text-sm text-white/45">Secure links expire after 60 minutes.</p>
              </div>

              <div className="grid gap-6">
                {filteredGroups.length === 0 ? (
                  <div className="rounded-[2rem] border border-dashed border-white/15 bg-white/[0.025] p-8 text-center">
                    <h3 className="text-2xl font-black">No matches found</h3>
                    <p className="mt-3 text-white/55">
                      Try searching by album title or purchased track name.
                    </p>
                  </div>
                ) : null}

                {filteredGroups.map((group) => (
                  <article
                    key={group.id}
                    className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.035]"
                  >
                    <div className="grid gap-6 border-b border-white/10 p-5 sm:grid-cols-[140px_1fr] sm:p-7">
                      <img
                        src={group.cover}
                        alt={`${group.title} cover`}
                        className="aspect-square w-full max-w-[140px] rounded-2xl object-cover shadow-xl"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">
                          {group.ownsFullAlbum ? "Full album owned" : "Purchased tracks"}
                        </p>
                        <h3 className="mt-2 truncate text-3xl font-black">{group.title}</h3>
                        <div className="mt-4 flex flex-wrap items-center gap-3">
                          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm font-bold text-white/70">
                            {group.entries.length} {group.entries.length === 1 ? "owned item" : "owned items"}
                          </span>
                          <span className="text-sm text-white/45">
                            Latest purchase: {formatDate(group.latestPurchaseAt)}
                          </span>
                        </div>
                        <Link
                          href={`/store?album=${group.id}`}
                          className="mt-5 inline-flex rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-white transition hover:bg-white/10"
                        >
                          Open in Store
                        </Link>
                      </div>
                    </div>

                    <div className="grid gap-3 p-4 sm:p-5">
                      {group.entries.map((entry) => {
                        const state = downloadStates[entry.key];

                        return (
                          <div
                            key={entry.key}
                            className="grid gap-4 rounded-2xl border border-white/10 bg-black/20 p-4 md:grid-cols-[1fr_auto] md:items-center"
                          >
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-violet-300">
                                  {entry.item.itemType === "album"
                                    ? "Full album"
                                    : entry.trackNumber
                                      ? `Track ${entry.trackNumber}`
                                      : "Track"}
                                </span>
                                <span className="text-xs text-white/35">{formatDate(entry.purchasedAt)}</span>
                              </div>
                              <h4 className="mt-3 truncate text-xl font-black">{entry.item.name}</h4>
                              <p className="mt-1 text-sm text-white/45">
                                {entry.item.itemType === "album"
                                  ? "Complete album download"
                                  : `${group.title}${entry.trackNumber ? ` · Track ${entry.trackNumber}` : ""}`}
                              </p>
                              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-white/45">
                                <span>{formatMoney(entry.amount, entry.currency)}</span>
                                <span className="max-w-[280px] truncate">Order {entry.orderId}</span>
                              </div>
                              {state?.error ? (
                                <p className="mt-3 text-sm text-red-300">{state.error}</p>
                              ) : null}
                            </div>

                            <button
                              type="button"
                              disabled={state?.loading}
                              onClick={() => downloadItem(entry)}
                              className="rounded-2xl bg-white px-5 py-4 font-black text-black transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {state?.loading
                                ? "Generating..."
                                : entry.item.itemType === "album"
                                  ? "Download Album"
                                  : "Download Track"}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}


