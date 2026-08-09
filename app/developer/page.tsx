"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { useAuth } from "../auth/AuthContext";
import { albums } from "../store/albums";

type TestStatus = "idle" | "testing" | "passed" | "failed";

type TestResult = {
  key: string;
  itemId: string;
  itemType: "album" | "track";
  title: string;
  status: TestStatus;
  message: string;
  fileName?: string;
  downloadUrl?: string;
  expiresAt?: string;
};

type DownloadApiResponse = {
  success?: boolean;
  title?: string;
  fileName?: string;
  downloadUrl?: string;
  expiresAt?: string;
  message?: string;
  error?: string;
};

type OwnerStats = {
  completedOrders: number;
  customers: number;
  albumsSold: number;
  tracksSold: number;
  totalRevenue: number;
  currency: string;
};

type RecentOrderItem = {
  name: string;
  description: string | null;
  sku: string | null;
  itemType: "album" | "track" | null;
  itemId: string | null;
  quantity: number;
  unitAmount: string | null;
  currency: string;
};

type RecentOrder = {
  orderId: string;
  captureId: string | null;
  customer: string;
  customerEmail: string | null;
  payerId: string | null;
  amount: number;
  currency: string;
  purchasedAt: string | null;
  itemCount: number;
  items: RecentOrderItem[];
};

type PremiumMember = {
  uid: string;
  email: string | null;
  subscriberEmail: string | null;
  subscriberName: string | null;
  status: string;
  premiumActive: boolean;
  subscriptionId: string | null;
  environment: string | null;
  startTime: string | null;
  nextBillingTime: string | null;
  cycleKey: string | null;
  downloadsUsed: number;
  downloadLimit: number;
  downloadsRemaining: number;
};

type PremiumSummary = {
  totalMembers: number;
  activeMembers: number;
  cancelledMembers: number;
  totalDownloadsUsed: number;
};

const OWNER_EMAIL = "supe4.me@gmail.com";

function makeResultKey(itemType: "album" | "track", itemId: string) {
  return `${itemType}:${itemId}`;
}

export default function OwnerDashboardPage() {
  const { user, loading } = useAuth();

  const [selectedAlbumId, setSelectedAlbumId] = useState(
    albums[0]?.id ?? ""
  );
  const [results, setResults] = useState<Record<string, TestResult>>({});
  const [testingAll, setTestingAll] = useState(false);
  const [testingCatalog, setTestingCatalog] = useState(false);
  const [ownerStats, setOwnerStats] = useState<OwnerStats | null>(null);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<RecentOrder | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [statsError, setStatsError] = useState("");
  const [premiumMembers, setPremiumMembers] = useState<PremiumMember[]>([]);
  const [premiumSummary, setPremiumSummary] = useState<PremiumSummary | null>(null);
  const [loadingPremium, setLoadingPremium] = useState(false);
  const [premiumError, setPremiumError] = useState("");
  const [broadcastStatus, setBroadcastStatus] = useState<{
    radioOnAir: boolean;
    tvOnAir: boolean;
  } | null>(null);
  const [loadingBroadcast, setLoadingBroadcast] = useState(false);
  const [savingBroadcast, setSavingBroadcast] = useState<
    "radio" | "tv" | null
  >(null);
  const [broadcastError, setBroadcastError] = useState("");

  const selectedAlbum = useMemo(
    () =>
      albums.find((album) => album.id === selectedAlbumId) ??
      albums[0],
    [selectedAlbumId]
  );

  const releasedAlbums = useMemo(
    () => albums.filter((album) => album.status === "released"),
    []
  );

  const upcomingAlbums = useMemo(
    () => albums.filter((album) => album.status === "upcoming"),
    []
  );

  const totalTracks = useMemo(
    () =>
      albums.reduce(
        (total, album) => total + album.tracks.length,
        0
      ),
    []
  );

  const totalCatalogValue = useMemo(
    () =>
      albums.reduce(
        (total, album) => total + Number(album.albumPrice || 0),
        0
      ),
    []
  );

  useEffect(() => {
    if (!user || user.email?.toLowerCase() !== OWNER_EMAIL) return;

    const currentUser = user;
    let cancelled = false;

    async function loadOwnerStats() {
      setLoadingStats(true);
      setStatsError("");

      try {
        const token = await currentUser.getIdToken();
        const response = await fetch("/api/owner/stats", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || "Owner statistics could not be loaded.");
        }

        if (!cancelled) {
          setOwnerStats(data.stats || null);
          setRecentOrders(Array.isArray(data.recentOrders) ? data.recentOrders : []);
        }
      } catch (error) {
        if (!cancelled) {
          setStatsError(
            error instanceof Error
              ? error.message
              : "Owner statistics could not be loaded."
          );
        }
      } finally {
        if (!cancelled) setLoadingStats(false);
      }
    }

    void loadOwnerStats();

    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!user || user.email?.toLowerCase() !== OWNER_EMAIL) return;

    const currentUser = user;
    let cancelled = false;

    async function loadPremiumMembers() {
      setLoadingPremium(true);
      setPremiumError("");

      try {
        const token = await currentUser.getIdToken();
        const response = await fetch("/api/owner/premium-members", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(
            data.error || "Premium members could not be loaded."
          );
        }

        if (!cancelled) {
          setPremiumMembers(
            Array.isArray(data.members) ? data.members : []
          );
          setPremiumSummary(data.summary || null);
        }
      } catch (error) {
        if (!cancelled) {
          setPremiumError(
            error instanceof Error
              ? error.message
              : "Premium members could not be loaded."
          );
        }
      } finally {
        if (!cancelled) setLoadingPremium(false);
      }
    }

    void loadPremiumMembers();

    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!user || user.email?.toLowerCase() !== OWNER_EMAIL) return;

    const currentUser = user;
    let cancelled = false;

    async function loadBroadcastStatus() {
      setLoadingBroadcast(true);
      setBroadcastError("");

      try {
        const token = await currentUser.getIdToken();

        const response = await fetch("/api/owner/broadcast", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(
            data.error || "Broadcast status could not be loaded."
          );
        }

        if (!cancelled) {
          setBroadcastStatus({
            radioOnAir: Boolean(data.radioOnAir),
            tvOnAir: Boolean(data.tvOnAir),
          });
        }
      } catch (error) {
        if (!cancelled) {
          setBroadcastError(
            error instanceof Error
              ? error.message
              : "Broadcast status could not be loaded."
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingBroadcast(false);
        }
      }
    }

    void loadBroadcastStatus();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const selectedAlbumResults = useMemo(() => {
    if (!selectedAlbum) return [];

    const albumResult =
      results[makeResultKey("album", selectedAlbum.id)];

    const trackResults = selectedAlbum.tracks
      .map(
        (track) =>
          results[makeResultKey("track", track.id)]
      )
      .filter(
        (result): result is TestResult => Boolean(result)
      );

    return [
      ...(albumResult ? [albumResult] : []),
      ...trackResults,
    ];
  }, [results, selectedAlbum]);

  const passedCount = selectedAlbumResults.filter(
    (result) => result.status === "passed"
  ).length;

  const failedCount = selectedAlbumResults.filter(
    (result) => result.status === "failed"
  ).length;

  async function testDownload(
    itemType: "album" | "track",
    itemId: string,
    title: string
  ): Promise<TestResult> {
    const key = makeResultKey(itemType, itemId);

    const testingResult: TestResult = {
      key,
      itemId,
      itemType,
      title,
      status: "testing",
      message: "Checking Firebase Storage...",
    };

    setResults((current) => ({
      ...current,
      [key]: testingResult,
    }));

    try {
      const response = await fetch("/api/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          testMode: true,
          itemType,
          itemId,
        }),
      });

      const data =
        (await response.json()) as DownloadApiResponse;

      if (!response.ok || !data.success) {
        throw new Error(
          data.error || "The download test failed."
        );
      }

      const passedResult: TestResult = {
        key,
        itemId,
        itemType,
        title: data.title || title,
        status: "passed",
        message:
          data.message ||
          "Secure download link generated.",
        fileName: data.fileName,
        downloadUrl: data.downloadUrl,
        expiresAt: data.expiresAt,
      };

      setResults((current) => ({
        ...current,
        [key]: passedResult,
      }));

      return passedResult;
    } catch (error) {
      const failedResult: TestResult = {
        key,
        itemId,
        itemType,
        title,
        status: "failed",
        message:
          error instanceof Error
            ? error.message
            : "An unexpected test error occurred.",
      };

      setResults((current) => ({
        ...current,
        [key]: failedResult,
      }));

      return failedResult;
    }
  }

  async function testSelectedAlbumEverything() {
    if (!selectedAlbum || testingAll) return;

    setTestingAll(true);

    try {
      await testDownload(
        "album",
        selectedAlbum.id,
        `${selectedAlbum.title} — Full Album`
      );

      for (const track of selectedAlbum.tracks) {
        await testDownload(
          "track",
          track.id,
          track.title
        );
      }
    } finally {
      setTestingAll(false);
    }
  }

  async function testEntireCatalog() {
    if (testingCatalog) return;

    setTestingCatalog(true);

    try {
      for (const album of albums) {
        await testDownload(
          "album",
          album.id,
          `${album.title} — Full Album`
        );

        for (const track of album.tracks) {
          await testDownload(
            "track",
            track.id,
            track.title
          );
        }
      }
    } finally {
      setTestingCatalog(false);
    }
  }

  async function updateBroadcastStatus(
    service: "radio" | "tv",
    onAir: boolean
  ) {
    if (!user || !broadcastStatus || savingBroadcast) return;

    setSavingBroadcast(service);
    setBroadcastError("");

    const nextRadioOnAir =
      service === "radio"
        ? onAir
        : broadcastStatus.radioOnAir;

    const nextTvOnAir =
      service === "tv"
        ? onAir
        : broadcastStatus.tvOnAir;

    try {
      const token = await user.getIdToken();

      const response = await fetch("/api/owner/broadcast", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          radioOnAir: nextRadioOnAir,
          tvOnAir: nextTvOnAir,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error || "Broadcast status could not be updated."
        );
      }

      setBroadcastStatus({
        radioOnAir:
          typeof data.radioOnAir === "boolean"
            ? data.radioOnAir
            : nextRadioOnAir,
        tvOnAir:
          typeof data.tvOnAir === "boolean"
            ? data.tvOnAir
            : nextTvOnAir,
      });
    } catch (error) {
      setBroadcastError(
        error instanceof Error
          ? error.message
          : "Broadcast status could not be updated."
      );
    } finally {
      setSavingBroadcast(null);
    }
  }

  function clearSelectedAlbumResults() {
    if (!selectedAlbum) return;

    setResults((current) => {
      const updated = { ...current };

      delete updated[
        makeResultKey("album", selectedAlbum.id)
      ];

      for (const track of selectedAlbum.tracks) {
        delete updated[
          makeResultKey("track", track.id)
        ];
      }

      return updated;
    });
  }

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center px-6">
        <p className="text-white/70">Loading owner dashboard...</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="grid min-h-screen place-items-center px-5 pb-20 pt-52">
        <section className="w-full max-w-xl rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 text-center shadow-2xl">
          <p className="text-sm font-black uppercase tracking-[0.22em] text-emerald-300">
            Owner dashboard
          </p>
          <h1 className="mt-3 text-4xl font-black">
            Sign in required
          </h1>
          <p className="mt-4 text-white/60">
            Sign in with the owner account to open the dashboard.
          </p>
          <Link
            href="/account"
            className="mt-7 inline-flex rounded-2xl bg-white px-6 py-4 font-black text-black"
          >
            Open Account
          </Link>
        </section>
      </main>
    );
  }

  if (user.email?.toLowerCase() !== OWNER_EMAIL) {
    return (
      <main className="grid min-h-screen place-items-center px-5 pb-20 pt-52">
        <section className="w-full max-w-xl rounded-[2rem] border border-red-400/20 bg-red-400/10 p-8 text-center shadow-2xl">
          <p className="text-sm font-black uppercase tracking-[0.22em] text-red-200">
            Restricted area
          </p>
          <h1 className="mt-3 text-4xl font-black">
            Owner access only
          </h1>
          <p className="mt-4 text-white/65">
            This account does not have permission to open the owner dashboard.
          </p>
          <Link
            href="/"
            className="mt-7 inline-flex rounded-2xl bg-white px-6 py-4 font-black text-black"
          >
            Return Home
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-5 pb-40 pt-52 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <section className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-violet-500/25 via-white/[0.04] to-cyan-400/10 p-7 shadow-2xl sm:p-10">
          <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.22em] text-emerald-300">
                SOLO BEATS ENGINE MUSIC
              </p>
              <h1 className="mt-3 text-4xl font-black sm:text-6xl">
                Owner Control Center
              </h1>
              <p className="mt-4 max-w-3xl text-white/65">
                Run SOLO BEATS ENGINE MUSIC from one central control center. Manage albums, media, Store activity, Premium, Radio, TV, customers, sales, promotions, advertising, and platform operations.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/store"
                className="rounded-2xl bg-white px-5 py-4 font-black text-black"
              >
                Open Store
              </Link>
              <Link
                href="/my-music"
                className="rounded-2xl border border-white/15 bg-white/5 px-5 py-4 font-black text-white"
              >
                Open My Music
              </Link>
            </div>
          </div>
        </section>


        <section className="mt-8 rounded-[2rem] border border-amber-300/20 bg-gradient-to-br from-amber-500/15 via-white/[0.035] to-red-500/10 p-6 sm:p-8">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.2em] text-amber-300">
              Approval Center
            </p>
            <h2 className="mt-2 text-3xl font-black">
              Review every submission from one place
            </h2>
            <p className="mt-3 max-w-3xl text-white/55">
              Open artist promotions, business and video advertising, orders, Premium members, and customer accounts without searching through the site.
            </p>
          </div>

          <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <ManagementLink
              title="Artist Promotion Approvals"
              description="Review new artist submissions, approve or reject campaigns, confirm payment, and schedule placements."
              href="/developer/artist-promotions"
              action="Review Artist Submissions"
              badge="Approval"
            />
            <ManagementLink
              title="Business & Video Ads"
              description="Review business and video advertising submissions, approve pricing, confirm payment, and schedule campaigns."
              href="/developer/business-advertising"
              action="Review Ad Submissions"
              badge="Approval"
            />
            <ManagementLink
              title="Orders"
              description="Review purchases, payment details, customer items, and completed transactions."
              href="/developer/orders"
              action="Open Orders"
              badge="Sales"
            />
            <ManagementLink
              title="Premium Members"
              description="Review active, cancelled, and billing-related Premium membership activity."
              href="#premium-members"
              action="View Members"
              badge="Premium"
            />
            <ManagementLink
              title="Customers"
              description="Review customer accounts, purchases, ownership, and My Music access."
              href="/developer/customers"
              action="Open Customers"
              badge="Accounts"
            />
          </div>
        </section>

        <section className="mt-8 rounded-[2rem] border border-cyan-300/15 bg-gradient-to-br from-cyan-500/10 via-white/[0.035] to-violet-500/10 p-6 sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.2em] text-cyan-300">
                Central Management Hub
              </p>
              <h2 className="mt-2 text-3xl font-black">
                Run the entire platform from one place
              </h2>
              <p className="mt-3 max-w-3xl text-white/55">
                Music, Store, Premium, Radio, TV, sales, customers, promotions, advertising, and owner operations are grouped below for fast access.
              </p>
            </div>

            <Link
              href="/"
              className="rounded-2xl bg-white px-5 py-4 font-black text-black"
            >
              View Live Homepage
            </Link>
          </div>

          <div className="mt-8">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-violet-300">
              Music
            </p>
            <h3 className="mt-2 text-2xl font-black">Music & Media Control</h3>

            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <ManagementLink
                title="Album Manager"
                description="Create albums, upload artwork and audio, edit metadata and tracks, control Draft, Upcoming, Released and Premium status, and publish to the Store."
                href="/developer/albums"
                action="Open Album Manager"
                badge="Music Control"
              />
              <ManagementLink
                title="Media Library"
                description="Manage uploaded audio, artwork, video, promotional media, and reusable platform assets."
                href="/developer/media"
                action="Open Media Library"
                badge="Media"
              />
              <ManagementLink
                title="Video Manager"
                description="Upload MP4 videos, preview content, control publishing, Homepage Channel, Premium TV, Featured status, source type, ordering, and deletion."
                href="/developer/videos"
                action="Open Video Manager"
                badge="Video Control"
              />
              <ManagementLink
                title="Music Catalog"
                description="Review albums, tracks, prices, covers, release status, track counts, and catalog information."
                href="/developer/catalog"
                action="Manage Catalog"
                badge="Catalog"
              />
            </div>
          </div>

          <div className="mt-10 border-t border-white/10 pt-8">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-300">
              Store & Sales
            </p>
            <h3 className="mt-2 text-2xl font-black">Store, Orders & Customers</h3>

            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <ManagementLink
                title="Storefront"
                description="Review public albums, tracks, pricing, purchase controls, previews, tracklists, checkout, and shopping."
                href="/store"
                action="Open Store"
                badge="Store"
              />
              <ManagementLink
                title="Orders"
                description="Review completed PayPal purchases, payment details, purchased items, and revenue."
                href="/developer/orders"
                action="Open Orders"
                badge="Sales"
              />
              <ManagementLink
                title="Customers"
                description="Review customer accounts, purchase history, spending, ownership, and My Music access."
                href="/developer/customers"
                action="Open Customers"
                badge="Accounts"
              />
              <ManagementLink
                title="My Music"
                description="Test the customer-owned music library and secure download experience."
                href="/my-music"
                action="Open My Music"
                badge="Library"
              />
            </div>
          </div>

          <div className="mt-10 border-t border-white/10 pt-8">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-300">
              Premium
            </p>
            <h3 className="mt-2 text-2xl font-black">Premium Membership Control</h3>

            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <ManagementLink
                title="Premium Members"
                description="Review active and inactive subscriptions, billing status, subscription records, and monthly download usage."
                href="#premium-members"
                action="View Premium Members"
                badge="Premium"
              />
              <ManagementLink
                title="Premium Library"
                description="Open and test the subscriber-only Premium music library and member access."
                href="/premium/library"
                action="Open Premium Library"
                badge="Premium"
              />
              <ManagementLink
                title="Premium Signup"
                description="Review the Premium offer, benefits, subscription flow, pricing, and customer signup experience."
                href="/premium"
                action="Open Premium"
                badge="Subscription"
              />
            </div>
          </div>

          <div className="mt-10 border-t border-white/10 pt-8">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-fuchsia-300">
              Radio & TV
            </p>
            <h3 className="mt-2 text-2xl font-black">Broadcast & Programming</h3>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <ManagementLink
                title="Premium Radio"
                description="Open Premium Radio, test playback and programming, and access the station experience."
                href="/premium/radio"
                action="Open Radio"
                badge="Radio"
              />
              <ManagementLink
                title="Premium TV"
                description="Open Premium TV, visual programming, queue, visualizers, and sponsored placements."
                href="/premium/tv"
                action="Open TV"
                badge="TV"
              />
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-[1.5rem] border border-emerald-300/15 bg-black/20 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">
                      Premium Radio
                    </p>
                    <h4 className="mt-2 text-xl font-black">
                      Radio Broadcast Control
                    </h4>
                  </div>

                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-black ${
                      broadcastStatus?.radioOnAir
                        ? "border-emerald-300/30 bg-emerald-400/15 text-emerald-200"
                        : "border-red-300/30 bg-red-400/15 text-red-200"
                    }`}
                  >
                    {loadingBroadcast || !broadcastStatus
                      ? "LOADING"
                      : broadcastStatus.radioOnAir
                        ? "ON AIR"
                        : "OFF AIR"}
                  </span>
                </div>

                <p className="mt-3 text-sm text-white/50">
                  Master owner switch for Premium Radio availability.
                </p>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      void updateBroadcastStatus("radio", true)
                    }
                    disabled={
                      loadingBroadcast ||
                      !broadcastStatus ||
                      savingBroadcast !== null ||
                      broadcastStatus.radioOnAir
                    }
                    className="rounded-xl bg-emerald-400 px-4 py-3 font-black text-black disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {savingBroadcast === "radio"
                      ? "Saving..."
                      : "ON AIR"}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      void updateBroadcastStatus("radio", false)
                    }
                    disabled={
                      loadingBroadcast ||
                      !broadcastStatus ||
                      savingBroadcast !== null ||
                      !broadcastStatus.radioOnAir
                    }
                    className="rounded-xl border border-red-300/25 bg-red-400/10 px-4 py-3 font-black text-red-200 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {savingBroadcast === "radio"
                      ? "Saving..."
                      : "OFF AIR"}
                  </button>
                </div>
              </div>

              <div className="rounded-[1.5rem] border border-fuchsia-300/15 bg-black/20 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-fuchsia-300">
                      Premium TV
                    </p>
                    <h4 className="mt-2 text-xl font-black">
                      TV Broadcast Control
                    </h4>
                  </div>

                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-black ${
                      broadcastStatus?.tvOnAir
                        ? "border-emerald-300/30 bg-emerald-400/15 text-emerald-200"
                        : "border-red-300/30 bg-red-400/15 text-red-200"
                    }`}
                  >
                    {loadingBroadcast || !broadcastStatus
                      ? "LOADING"
                      : broadcastStatus.tvOnAir
                        ? "ON AIR"
                        : "OFF AIR"}
                  </span>
                </div>

                <p className="mt-3 text-sm text-white/50">
                  Master owner switch for Premium TV availability.
                </p>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      void updateBroadcastStatus("tv", true)
                    }
                    disabled={
                      loadingBroadcast ||
                      !broadcastStatus ||
                      savingBroadcast !== null ||
                      broadcastStatus.tvOnAir
                    }
                    className="rounded-xl bg-emerald-400 px-4 py-3 font-black text-black disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {savingBroadcast === "tv"
                      ? "Saving..."
                      : "ON AIR"}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      void updateBroadcastStatus("tv", false)
                    }
                    disabled={
                      loadingBroadcast ||
                      !broadcastStatus ||
                      savingBroadcast !== null ||
                      !broadcastStatus.tvOnAir
                    }
                    className="rounded-xl border border-red-300/25 bg-red-400/10 px-4 py-3 font-black text-red-200 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {savingBroadcast === "tv"
                      ? "Saving..."
                      : "OFF AIR"}
                  </button>
                </div>
              </div>
            </div>

            {broadcastError ? (
              <p className="mt-4 rounded-xl border border-red-300/20 bg-red-400/10 px-4 py-3 text-sm font-bold text-red-200">
                {broadcastError}
              </p>
            ) : null}
          </div>

          <div className="mt-10 border-t border-white/10 pt-8">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-300">
              Promotion & Advertising
            </p>
            <h3 className="mt-2 text-2xl font-black">Campaign Management</h3>

            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <ManagementLink
                title="Artist Promotions"
                description="Review artist submissions, approvals, payments, campaign status, and scheduled placements."
                href="/developer/artist-promotions"
                action="Manage Promotions"
                badge="Promotion"
              />
              <ManagementLink
                title="Business & Video Ads"
                description="Review business and video advertising submissions, approvals, pricing, payments, and schedules."
                href="/developer/business-advertising"
                action="Manage Advertising"
                badge="Advertising"
              />
              <ManagementLink
                title="Artist Submission Page"
                description="Open the public page artists use to submit paid music promotion campaigns."
                href="/artist-promotion"
                action="View Public Page"
                badge="Public"
              />
              <ManagementLink
                title="Business Submission Page"
                description="Open the public page businesses and advertisers use to submit campaigns."
                href="/business-advertising"
                action="View Public Page"
                badge="Public"
              />
            </div>
          </div>

          <div className="mt-10 border-t border-white/10 pt-8">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
              Owner Tools
            </p>
            <h3 className="mt-2 text-2xl font-black">Account & System Testing</h3>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <ManagementLink
                title="Owner Account"
                description="Review the signed-in owner account, authentication, email, and access information."
                href="/account"
                action="Open Account"
                badge="Security"
              />
              <ManagementLink
                title="Secure Download Testing"
                description="Jump directly to the Firebase album and track download tester on this Control Center."
                href="#download-tester"
                action="Open Tester"
                badge="Developer"
              />
            </div>
          </div>
        </section>
        <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <DashboardStat label="Catalog albums" value={albums.length} />
          <DashboardStat label="Released" value={releasedAlbums.length} />
          <DashboardStat label="Upcoming" value={upcomingAlbums.length} />
          <DashboardStat label="Catalog tracks" value={totalTracks} />
          <DashboardStat
            label="Album catalog value"
            value={`$${totalCatalogValue.toFixed(2)}`}
          />
        </section>

        <section className="mt-8 rounded-[2rem] border border-white/10 bg-white/[0.035] p-6 sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.2em] text-emerald-300">
                Live business activity
              </p>
              <h2 className="mt-2 text-3xl font-black">Orders & Customers</h2>
            </div>
            <p className="text-sm text-white/45">
              {loadingStats ? "Loading Firestore totals..." : "Completed PayPal purchases only"}
            </p>
          </div>

          {statsError ? (
            <p className="mt-5 rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-red-200">
              {statsError}
            </p>
          ) : null}

          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <Link href="/developer/orders" className="block">
              <DashboardStat label="Completed orders" value={loadingStats ? "..." : ownerStats?.completedOrders ?? 0} />
            </Link>
            <Link href="/developer/customers" className="block">
              <DashboardStat label="Customers" value={loadingStats ? "..." : ownerStats?.customers ?? 0} />
            </Link>
            <Link href="/developer/orders" className="block">
              <DashboardStat label="Albums sold" value={loadingStats ? "..." : ownerStats?.albumsSold ?? 0} />
            </Link>
            <Link href="/developer/orders" className="block">
              <DashboardStat label="Tracks sold" value={loadingStats ? "..." : ownerStats?.tracksSold ?? 0} />
            </Link>
            <Link href="/developer/orders" className="block">
              <DashboardStat
              label="Total revenue"
              value={
                loadingStats
                  ? "..."
                  : new Intl.NumberFormat("en-US", {
                      style: "currency",
                      currency: ownerStats?.currency || "USD",
                    }).format(ownerStats?.totalRevenue ?? 0)
              }
            />
            </Link>
          </div>

          <div className="mt-7 overflow-hidden rounded-2xl border border-white/10">
            <div className="border-b border-white/10 bg-black/20 px-5 py-4">
              <h3 className="text-xl font-black">Recent completed orders</h3>
            </div>

            {recentOrders.length === 0 ? (
              <p className="p-5 text-white/50">No completed orders found yet.</p>
            ) : (
              <div className="divide-y divide-white/10">
                {recentOrders.map((order) => (
                  <button
                    type="button"
                    key={order.orderId}
                    onClick={() => setSelectedOrder(order)}
                    className="grid w-full gap-3 p-5 text-left transition hover:bg-white/[0.04] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-violet-400 md:grid-cols-[1fr_auto_auto_auto] md:items-center"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-black">{order.customer}</p>
                      <p className="mt-1 truncate text-xs text-white/40">
                        Order {order.orderId}
                      </p>
                    </div>
                    <p className="text-sm text-white/55">
                      {order.itemCount} {order.itemCount === 1 ? "item" : "items"}
                    </p>
                    <div className="md:text-right">
                      <p className="font-black">
                        {new Intl.NumberFormat("en-US", {
                          style: "currency",
                          currency: order.currency || "USD",
                        }).format(order.amount)}
                      </p>
                      <p className="mt-1 text-xs text-white/40">
                        {order.purchasedAt
                          ? new Date(order.purchasedAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : "Completed"}
                      </p>
                    </div>
                    <span className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-center text-sm font-black text-white">
                      View details
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        <section id="premium-members" className="mt-8 scroll-mt-40 rounded-[2rem] border border-emerald-300/15 bg-gradient-to-br from-emerald-400/10 via-white/[0.035] to-violet-500/10 p-6 sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.2em] text-emerald-300">
                SOLO BEATS PREMIUM
              </p>
              <h2 className="mt-2 text-3xl font-black">
                Premium Members
              </h2>
              <p className="mt-3 text-white/55">
                Membership status, PayPal subscriptions, billing cycles, and monthly track-download usage.
              </p>
            </div>

            <p className="text-sm text-white/45">
              {loadingPremium
                ? "Loading Premium members..."
                : `${premiumMembers.length} subscription record${premiumMembers.length === 1 ? "" : "s"}`}
            </p>
          </div>

          {premiumError ? (
            <p className="mt-5 rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-red-200">
              {premiumError}
            </p>
          ) : null}

          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <DashboardStat
              label="Premium members"
              value={loadingPremium ? "..." : premiumSummary?.totalMembers ?? 0}
            />
            <DashboardStat
              label="Active"
              value={loadingPremium ? "..." : premiumSummary?.activeMembers ?? 0}
            />
            <DashboardStat
              label="Cancelled / inactive"
              value={loadingPremium ? "..." : premiumSummary?.cancelledMembers ?? 0}
            />
            <DashboardStat
              label="Downloads used"
              value={loadingPremium ? "..." : premiumSummary?.totalDownloadsUsed ?? 0}
            />
          </div>

          <div className="mt-7 overflow-x-auto rounded-2xl border border-white/10">
            <table className="min-w-[1100px] w-full text-left">
              <thead className="bg-black/25 text-xs uppercase tracking-[0.14em] text-white/45">
                <tr>
                  <th className="px-5 py-4">Member</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4">Downloads</th>
                  <th className="px-5 py-4">Billing cycle</th>
                  <th className="px-5 py-4">Next billing</th>
                  <th className="px-5 py-4">Environment</th>
                  <th className="px-5 py-4">Subscription ID</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-white/10">
                {premiumMembers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-5 py-8 text-center text-white/50"
                    >
                      {loadingPremium
                        ? "Loading Premium member records..."
                        : "No Premium subscription records found."}
                    </td>
                  </tr>
                ) : (
                  premiumMembers.map((member) => (
                    <tr key={member.uid} className="align-top">
                      <td className="px-5 py-4">
                        <p className="font-black">
                          {member.subscriberName || "Premium Member"}
                        </p>
                        <p className="mt-1 text-sm text-white/45">
                          {member.subscriberEmail || member.email || "No email"}
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full border px-3 py-1 text-xs font-black uppercase tracking-[0.12em] ${
                            member.premiumActive
                              ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-200"
                              : "border-red-300/20 bg-red-300/10 text-red-200"
                          }`}
                        >
                          {member.status || (member.premiumActive ? "ACTIVE" : "INACTIVE")}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <p className="font-black">
                          {member.downloadsUsed} used
                        </p>
                        <p className="mt-1 text-sm text-white/45">
                          {member.downloadsRemaining} of {member.downloadLimit} remaining
                        </p>
                      </td>

                      <td className="px-5 py-4 text-sm text-white/65">
                        {member.cycleKey || "Not started"}
                      </td>

                      <td className="px-5 py-4 text-sm text-white/65">
                        {member.nextBillingTime
                          ? new Date(member.nextBillingTime).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : "Not available"}
                      </td>

                      <td className="px-5 py-4 text-sm uppercase text-white/65">
                        {member.environment || "Unknown"}
                      </td>

                      <td className="max-w-[260px] break-all px-5 py-4 text-xs text-white/45">
                        {member.subscriptionId || "Not available"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {selectedOrder ? (
          <section className="mt-8 rounded-[2rem] border border-violet-400/25 bg-gradient-to-br from-violet-500/15 via-white/[0.035] to-cyan-400/10 p-6 shadow-2xl sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.2em] text-violet-300">
                  Order details
                </p>
                <h2 className="mt-2 text-3xl font-black">
                  {selectedOrder.customer}
                </h2>
                <p className="mt-2 text-sm text-white/45">
                  Order {selectedOrder.orderId}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-black text-white transition hover:bg-white/10"
              >
                Close
              </button>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <OrderDetail label="Customer email" value={selectedOrder.customerEmail || "Not available"} />
              <OrderDetail label="Capture ID" value={selectedOrder.captureId || "Not available"} />
              <OrderDetail label="Payer ID" value={selectedOrder.payerId || "Not available"} />
              <OrderDetail
                label="Purchase date"
                value={
                  selectedOrder.purchasedAt
                    ? new Date(selectedOrder.purchasedAt).toLocaleString("en-US")
                    : "Completed purchase"
                }
              />
            </div>

            <div className="mt-6 overflow-hidden rounded-2xl border border-white/10">
              <div className="grid gap-3 border-b border-white/10 bg-black/20 px-5 py-4 sm:grid-cols-[1fr_auto] sm:items-center">
                <div>
                  <h3 className="text-xl font-black">Purchased items</h3>
                  <p className="mt-1 text-sm text-white/45">
                    {selectedOrder.itemCount} {selectedOrder.itemCount === 1 ? "item" : "items"} in this order
                  </p>
                </div>

                <p className="text-2xl font-black">
                  {new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: selectedOrder.currency || "USD",
                  }).format(selectedOrder.amount)}
                </p>
              </div>

              <div className="divide-y divide-white/10">
                {selectedOrder.items.map((item, index) => (
                  <div
                    key={`${selectedOrder.orderId}-${item.itemId || item.sku || index}`}
                    className="grid gap-4 p-5 md:grid-cols-[1fr_auto] md:items-center"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-violet-300">
                          {item.itemType || "Item"}
                        </span>
                        <span className="text-xs text-white/40">
                          Quantity {item.quantity}
                        </span>
                      </div>

                      <h4 className="mt-3 truncate text-lg font-black">
                        {item.name}
                      </h4>

                      {item.description ? (
                        <p className="mt-1 text-sm text-white/45">
                          {item.description}
                        </p>
                      ) : null}

                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/35">
                        {item.itemId ? <span>Item ID: {item.itemId}</span> : null}
                        {item.sku ? <span>SKU: {item.sku}</span> : null}
                      </div>
                    </div>

                    <p className="font-black">
                      {item.unitAmount
                        ? new Intl.NumberFormat("en-US", {
                            style: "currency",
                            currency: item.currency || selectedOrder.currency || "USD",
                          }).format(Number(item.unitAmount) * item.quantity)
                        : "Paid"}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        <section className="mt-8 grid gap-6 lg:grid-cols-3">
          <DashboardLink
            title="Catalog Management"
            description="Review the album catalog, track counts, pricing, covers, status, and store pages."
            href="/developer/catalog"
            action="Open Catalog"
          />
          <DashboardLink
            title="Orders & Customers"
            description="Customer purchases are already linked to Firebase accounts and My Music libraries."
            href="/developer/orders"
            action="Open Orders"
          />
          <DashboardLink
            title="Customers"
            description="Review customer accounts, order totals, purchased albums and tracks, spending, and full purchase history."
            href="/developer/customers"
            action="Open Customers"
          />
          <DashboardLink
            title="Account & Access"
            description="Review the owner account, email status, purchase summary, and sign-in details."
            href="/account"
            action="Open Account"
          />
        </section>

        <section id="download-tester" className="mt-8 scroll-mt-40 rounded-[2rem] border border-white/10 bg-white/[0.035] p-6 sm:p-8">
          <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.2em] text-violet-300">
                Catalog health
              </p>
              <h2 className="mt-2 text-3xl font-black">
                Secure Download Tester
              </h2>
              <p className="mt-3 max-w-3xl text-white/55">
                Test Firebase album ZIPs and individual track files without making a PayPal purchase. Test mode works only during development.
              </p>
            </div>

            <div className="flex gap-3">
              <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-sm font-black text-emerald-200">
                {passedCount} passed
              </span>
              <span className="rounded-full border border-red-400/20 bg-red-400/10 px-4 py-2 text-sm font-black text-red-200">
                {failedCount} failed
              </span>
            </div>
          </div>

          <div className="mt-7 grid gap-5 lg:grid-cols-[220px_1fr]">
            <img
              src={selectedAlbum.cover}
              alt={`${selectedAlbum.title} cover`}
              className="aspect-square w-full rounded-2xl object-cover shadow-xl"
            />

            <div>
              <label
                htmlFor="dashboard-album"
                className="text-sm font-black text-white/70"
              >
                Select album
              </label>

              <select
                id="dashboard-album"
                value={selectedAlbum.id}
                onChange={(event) =>
                  setSelectedAlbumId(event.target.value)
                }
                disabled={testingAll || testingCatalog}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-4 text-white outline-none focus:border-violet-400"
              >
                {albums.map((album) => (
                  <option key={album.id} value={album.id}>
                    {album.title} — {album.tracks.length} tracks
                  </option>
                ))}
              </select>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={testSelectedAlbumEverything}
                  disabled={testingAll || testingCatalog}
                  className="rounded-2xl bg-white px-5 py-4 font-black text-black disabled:opacity-50"
                >
                  {testingAll
                    ? "Testing Album..."
                    : "Test Complete Album"}
                </button>

                <button
                  type="button"
                  onClick={testEntireCatalog}
                  disabled={testingAll || testingCatalog}
                  className="rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-500 px-5 py-4 font-black text-white disabled:opacity-50"
                >
                  {testingCatalog
                    ? "Testing Entire Catalog..."
                    : "Test Entire Catalog"}
                </button>

                <button
                  type="button"
                  onClick={clearSelectedAlbumResults}
                  disabled={testingAll || testingCatalog}
                  className="rounded-2xl border border-white/15 bg-white/5 px-5 py-4 font-black text-white disabled:opacity-50"
                >
                  Clear Results
                </button>
              </div>
            </div>
          </div>

          <div className="mt-8 grid gap-3">
            <ResultRow
              title={`${selectedAlbum.title} — Full Album`}
              result={
                results[
                  makeResultKey("album", selectedAlbum.id)
                ]
              }
              onTest={() =>
                testDownload(
                  "album",
                  selectedAlbum.id,
                  `${selectedAlbum.title} — Full Album`
                )
              }
              disabled={testingAll || testingCatalog}
            />

            {selectedAlbum.tracks.map((track) => (
              <ResultRow
                key={track.id}
                title={`${track.number}. ${track.title}`}
                result={
                  results[
                    makeResultKey("track", track.id)
                  ]
                }
                onTest={() =>
                  testDownload(
                    "track",
                    track.id,
                    track.title
                  )
                }
                disabled={testingAll || testingCatalog}
              />
            ))}
          </div>
        </section>

        <section className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          <RoadmapCard
            title="Premium"
            text="Active subscription access, early-access music, member benefits, and download tracking."
          />
          <RoadmapCard
            title="Radio"
            text="Premium Radio is active with music playback, artist promotions, and sponsored business campaigns."
          />
          <RoadmapCard
            title="TV"
            text="Premium TV is active with continuous programming, visualizers, promotions, and sponsored campaigns."
          />
          <RoadmapCard
            title="Promotion & Ads"
            text="Artist Promotion and Business Advertising are active from submission through payment and scheduling."
          />
        </section>
      </div>
    </main>
  );
}

function OrderDetail({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
      <p className="text-sm text-white/45">{label}</p>
      <p className="mt-2 break-all font-bold text-white/85">{value}</p>
    </div>
  );
}

function DashboardStat({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
      <p className="text-sm text-white/50">{label}</p>
      <p className="mt-2 text-3xl font-black">{value}</p>
    </div>
  );
}


function ManagementLink({
  title,
  description,
  href,
  action,
  badge,
}: {
  title: string;
  description: string;
  href: string;
  action: string;
  badge: string;
}) {
  return (
    <article className="flex min-h-[245px] flex-col rounded-[1.6rem] border border-white/10 bg-black/25 p-5 transition hover:-translate-y-1 hover:border-cyan-300/30 hover:bg-white/[0.05]">
      <span className="w-fit rounded-full border border-cyan-300/15 bg-cyan-300/10 px-3 py-1 text-xs font-black uppercase tracking-[0.14em] text-cyan-200">
        {badge}
      </span>
      <h3 className="mt-4 text-xl font-black">{title}</h3>
      <p className="mt-3 flex-1 text-sm leading-6 text-white/50">
        {description}
      </p>
      <Link
        href={href}
        className="mt-5 inline-flex w-fit rounded-xl bg-white px-4 py-3 text-sm font-black text-black"
      >
        {action}
      </Link>
    </article>
  );
}

function DashboardLink({
  title,
  description,
  href,
  action,
}: {
  title: string;
  description: string;
  href: string;
  action: string;
}) {
  return (
    <article className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-6">
      <h2 className="text-2xl font-black">{title}</h2>
      <p className="mt-3 min-h-[72px] text-sm leading-6 text-white/55">
        {description}
      </p>
      <Link
        href={href}
        className="mt-5 inline-flex rounded-2xl bg-white px-5 py-3 font-black text-black"
      >
        {action}
      </Link>
    </article>
  );
}

function RoadmapCard({
  title,
  text,
}: {
  title: string;
  text: string;
}) {
  return (
    <article className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/[0.05] to-violet-500/10 p-6">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-300">
        Platform system
      </p>
      <h3 className="mt-2 text-2xl font-black">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-white/55">{text}</p>
    </article>
  );
}

function ResultRow({
  title,
  result,
  onTest,
  disabled,
}: {
  title: string;
  result?: TestResult;
  onTest: () => void;
  disabled: boolean;
}) {
  const status = result?.status ?? "idle";

  return (
    <article className="grid gap-4 rounded-2xl border border-white/10 bg-black/20 p-4 md:grid-cols-[1fr_auto] md:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full border px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${
              status === "passed"
                ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
                : status === "failed"
                  ? "border-red-400/20 bg-red-400/10 text-red-200"
                  : status === "testing"
                    ? "border-amber-300/20 bg-amber-300/10 text-amber-100"
                    : "border-white/10 bg-white/5 text-white/50"
            }`}
          >
            {status === "passed"
              ? "Passed"
              : status === "failed"
                ? "Failed"
                : status === "testing"
                  ? "Testing"
                  : "Not tested"}
          </span>
        </div>

        <h3 className="mt-3 truncate text-lg font-black">
          {title}
        </h3>

        {result ? (
          <p className="mt-2 text-sm text-white/55">
            {result.message}
          </p>
        ) : null}

        {result?.fileName ? (
          <p className="mt-1 truncate text-xs text-white/40">
            {result.fileName}
          </p>
        ) : null}

        {result?.downloadUrl ? (
          <a
            href={result.downloadUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex text-sm font-black text-emerald-300"
          >
            Download Test File
          </a>
        ) : null}
      </div>

      <button
        type="button"
        onClick={onTest}
        disabled={disabled || status === "testing"}
        className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 font-black text-white disabled:opacity-50"
      >
        {status === "testing" ? "Testing..." : "Test"}
      </button>
    </article>
  );
}











