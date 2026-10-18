"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  useAuth,
} from "../../auth/AuthContext";

type LiveData = {
  success: boolean;

  broadcast: {
    radioOnAir: boolean;
    liveMicOnAir: boolean;
    liveMicMode: string;
    broadcasterEmail: string;
    broadcasterRole: string;
    room: string;
  };

  youtube: {
    enabled: boolean;
    playbackState: string;
    label: string;
    playlistId: string;
  };

  dj: {
    total: number;
    active: number;
    expired: number;
    suspended: number;
    revoked: number;
    scheduled: number;
    paymentRequired: number;
    pendingApplications: number;
    pendingPayments: number;
    activePaidSubscriptions: number;
  };

  premium: {
    total: number;
    active: number;
    inactive: number;
  };

  mixMastering: {
    total: number;
    open: number;
    paid: number;
  };

  platform: {
    accounts: number;
    unreadNotifications: number;
  };

  notifications: Array<{
    id: string;
    type: string;
    message: string;
    targetUrl: string;
  }>;
};

const OWNER_EMAIL =
  "supe4.me@gmail.com";

export default function ControlRoomPage() {
  const {
    user,
    loading,
  } = useAuth();

  const [
    data,
    setData,
  ] = useState<LiveData | null>(
    null
  );

  const [
    error,
    setError,
  ] = useState("");

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const isOwner =
    !!user &&
    user.email
      ?.toLowerCase() ===
      OWNER_EMAIL;

  const load = useCallback(
    async () => {
      if (
        !user ||
        !isOwner
      ) {
        return;
      }

      setRefreshing(true);
      setError("");

      try {
        const token =
          await user.getIdToken();

        const response =
          await fetch(
            "/api/owner/control-room",
            {
              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
              cache: "no-store",
            }
          );

        const result =
          await response.json();

        if (
          !response.ok ||
          !result.success
        ) {
          throw new Error(
            result.error ||
              "Control Room data could not be loaded."
          );
        }

        setData(result);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Control Room data could not be loaded."
        );
      } finally {
        setRefreshing(false);
      }
    },
    [
      user,
      isOwner,
    ]
  );

  useEffect(() => {
    if (
      !loading &&
      isOwner
    ) {
      void load();

      const timer =
        window.setInterval(
          () => {
            void load();
          },
          15000
        );

      return () =>
        window.clearInterval(
          timer
        );
    }
  }, [
    loading,
    isOwner,
    load,
  ]);

  if (loading) {
    return (
      <Shell>
        <p className="text-zinc-400">
          Loading Control Room...
        </p>
      </Shell>
    );
  }

  if (!user) {
    return (
      <Shell>
        <h1 className="text-3xl font-black">
          Owner sign-in required
        </h1>

        <Link
          href="/account"
          className="mt-6 inline-flex rounded-xl bg-white px-5 py-3 font-black text-black"
        >
          Open Account
        </Link>
      </Shell>
    );
  }

  if (!isOwner) {
    return (
      <Shell>
        <h1 className="text-3xl font-black text-red-300">
          Owner access only
        </h1>
      </Shell>
    );
  }

  return (
    <main className="min-h-screen bg-[#050505] text-white">
      <div className="mx-auto w-full max-w-[1600px] px-4 py-8 md:px-8">

        <section className="rounded-3xl border border-red-500/30 bg-gradient-to-br from-red-950/30 via-black to-black p-6 md:p-9">

          <div className="flex flex-wrap items-start justify-between gap-6">

            <div>
              <p className="text-xs font-black tracking-[0.35em] text-red-400">
                OWNER COMMAND CENTER
              </p>

              <h1 className="mt-2 text-3xl font-black md:text-5xl">
                SOLO BEATS CONTROL ROOM
              </h1>

              <p className="mt-3 max-w-3xl text-zinc-400">
                Live owner dashboard for radio, DJs, Premium,
                YouTube Radio, Mix & Mastering and platform activity.
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                void load()
              }
              disabled={refreshing}
              className="rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-black hover:bg-white/10 disabled:opacity-50"
            >
              {refreshing
                ? "REFRESHING..."
                : "REFRESH LIVE DATA"}
            </button>

          </div>
        </section>

        {error ? (
          <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-5 font-bold text-red-200">
            {error}
          </div>
        ) : null}

        <section className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

          <BigStatus
            label="RADIO"
            value={
              data?.broadcast
                .radioOnAir
                ? "ON AIR"
                : "OFF AIR"
            }
            good={
              data?.broadcast
                .radioOnAir ===
              true
            }
          />

          <BigStatus
            label="LIVE MIX"
            value={
              data?.broadcast
                .liveMicOnAir
                ? "LIVE"
                : "OFF AIR"
            }
            good={
              data?.broadcast
                .liveMicOnAir ===
              true
            }
          />

          <BigStatus
            label="YOUTUBE RADIO"
            value={
              data?.youtube.enabled
                ? "ON"
                : "OFF"
            }
            good={
              data?.youtube.enabled ===
              true
            }
          />

          <BigStatus
            label="OWNER ALERTS"
            value={String(
              data?.platform
                .unreadNotifications ??
                0
            )}
            good={
              (data?.platform
                .unreadNotifications ??
                0) === 0
            }
          />

        </section>

        <section className="mt-7 rounded-3xl border border-white/10 bg-[#0a0a0a] p-6">

          <div className="flex flex-wrap items-center justify-between gap-4">

            <div>
              <p className="text-xs font-black tracking-[0.22em] text-red-400">
                CURRENT BROADCAST
              </p>

              <h2 className="mt-2 text-2xl font-black">
                {data?.broadcast
                  .liveMicOnAir
                  ? "LIVE BROADCAST ACTIVE"
                  : "NORMAL STATION PLAYBACK"}
              </h2>
            </div>

            <span className={`rounded-full border px-4 py-2 text-xs font-black ${
              data?.broadcast
                .liveMicOnAir
                ? "border-red-400/40 bg-red-500/15 text-red-200"
                : "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
            }`}>
              {data?.broadcast
                .liveMicOnAir
                ? "● ON AIR"
                : "● STANDBY"}
            </span>

          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">

            <Info
              label="ACTIVE DJ / BROADCASTER"
              value={
                data?.broadcast
                  .broadcasterEmail ||
                "None"
              }
            />

            <Info
              label="BROADCAST ROLE"
              value={
                data?.broadcast
                  .broadcasterRole ||
                "Station"
              }
            />

            <Info
              label="LIVE MODE"
              value={
                data?.broadcast
                  .liveMicMode ||
                "duck"
              }
            />

          </div>

          <div className="mt-5 flex flex-wrap gap-3">

            <ControlLink
              href="/developer/radio"
              label="RADIO CONTROL"
            />

            <ControlLink
              href="/dj/turntable"
              label="DJ TURNTABLE"
            />

            <ControlLink
              href="/premium/radio"
              label="OPEN LIVE RADIO"
            />

          </div>

        </section>

        <SectionTitle
          title="DJ MANAGEMENT"
          subtitle="Live application, access and payment totals."
        />

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

          <Metric
            label="Pending Applications"
            value={
              data?.dj
                .pendingApplications ??
              0
            }
          />

          <Metric
            label="Active DJs"
            value={
              data?.dj.active ??
              0
            }
          />

          <Metric
            label="Expired DJs"
            value={
              data?.dj.expired ??
              0
            }
          />

          <Metric
            label="Suspended DJs"
            value={
              data?.dj.suspended ??
              0
            }
          />

          <Metric
            label="Payment Required"
            value={
              data?.dj
                .paymentRequired ??
              0
            }
          />

          <Metric
            label="Pending DJ Payments"
            value={
              data?.dj
                .pendingPayments ??
              0
            }
          />

          <Metric
            label="Paid DJ Subscriptions"
            value={
              data?.dj
                .activePaidSubscriptions ??
              0
            }
          />

          <Metric
            label="Total DJ Accounts"
            value={
              data?.dj.total ??
              0
            }
          />

        </section>

        <div className="mt-5 flex flex-wrap gap-3">
          <ControlLink
            href="/dj/radio"
            label="DJ WORKSPACE"
          />

          <ControlLink
            href="/dj/turntable"
            label="DJ TURNTABLE"
          />
        </div>

        <SectionTitle
          title="PREMIUM"
          subtitle="Live membership totals."
        />

        <section className="grid gap-4 sm:grid-cols-3">

          <Metric
            label="Premium Members"
            value={
              data?.premium.total ??
              0
            }
          />

          <Metric
            label="Active Premium"
            value={
              data?.premium.active ??
              0
            }
          />

          <Metric
            label="Inactive Premium"
            value={
              data?.premium.inactive ??
              0
            }
          />

        </section>

        <div className="mt-5">
          <ControlLink
            href="/developer/premium-members"
            label="MANAGE PREMIUM MEMBERS"
          />
        </div>

        <SectionTitle
          title="SOLO BEATS MIX & MASTERING"
          subtitle="Current production-order totals."
        />

        <section className="grid gap-4 sm:grid-cols-3">

          <Metric
            label="Total Orders"
            value={
              data?.mixMastering
                .total ??
              0
            }
          />

          <Metric
            label="Open Orders"
            value={
              data?.mixMastering
                .open ??
              0
            }
          />

          <Metric
            label="Paid Orders"
            value={
              data?.mixMastering
                .paid ??
              0
            }
          />

        </section>

        <div className="mt-5">
          <ControlLink
            href="/developer/mix-mastering"
            label="OPEN MIX & MASTERING"
          />
        </div>

        <SectionTitle
          title="YOUTUBE RADIO"
          subtitle="Live YouTube station state."
        />

        <section className="rounded-2xl border border-white/10 bg-[#0b0b0b] p-5">

          <div className="grid gap-4 md:grid-cols-3">

            <Info
              label="STATUS"
              value={
                data?.youtube.enabled
                  ? "ON"
                  : "OFF"
              }
            />

            <Info
              label="PLAYBACK"
              value={
                data?.youtube
                  .playbackState ||
                "paused"
              }
            />

            <Info
              label="CHANNEL / PLAYLIST"
              value={
                data?.youtube.label ||
                "SOLO BEATS YOUTUBE RADIO"
              }
            />

          </div>

          <div className="mt-5">
            <ControlLink
              href="/developer/radio"
              label="OPEN YOUTUBE RADIO CONTROLS"
            />
          </div>

        </section>

        <SectionTitle
          title="PLATFORM"
          subtitle="Account and system activity."
        />

        <section className="grid gap-4 sm:grid-cols-2">

          <Metric
            label="Platform Accounts"
            value={
              data?.platform
                .accounts ??
              0
            }
          />

          <Metric
            label="Owner Notifications"
            value={
              data?.platform
                .unreadNotifications ??
              0
            }
          />

        </section>

        <SectionTitle
          title="LATEST OWNER NOTIFICATIONS"
          subtitle="Newest platform events."
        />

        <section className="space-y-3">

          {data?.notifications
            ?.length ? (
            data.notifications.map(
              notification => (
                <div
                  key={notification.id}
                  className="rounded-2xl border border-white/10 bg-[#0b0b0b] p-5"
                >
                  <div className="text-xs font-black tracking-wider text-red-400">
                    {notification.type}
                  </div>

                  <div className="mt-2 text-sm text-zinc-300">
                    {notification.message ||
                      "Platform notification"}
                  </div>

                  {notification.targetUrl ? (
                    <Link
                      href={
                        notification.targetUrl
                      }
                      className="mt-3 inline-flex text-xs font-black text-red-300"
                    >
                      OPEN →
                    </Link>
                  ) : null}
                </div>
              )
            )
          ) : (
            <div className="rounded-2xl border border-white/10 bg-[#0b0b0b] p-5 text-sm text-zinc-500">
              No current owner notifications.
            </div>
          )}

        </section>


                {/* SOLO_OWNER_CONTROL_CENTER_V2 */}
        <SectionTitle
          title="OWNER QUICK ACCESS"
          subtitle="All major SOLO BEATS management systems in one place."
        />

        <section className="space-y-7">

          <div>
            <h3 className="mb-3 text-lg font-black text-cyan-300">
              VIDEO & CREATOR MANAGEMENT
            </h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Quick href="/developer/videos#creator-approval-center" title="Creator Approval Center" />
              <Quick href="/developer/videos" title="Video Management" />
              <Quick href="/developer/connect-moderation" title="Content Moderation" />
              <Quick href="/developer/auto-video-generator" title="Auto Video Generator" />
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-lg font-black text-cyan-300">
              RADIO & TELEVISION
            </h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Quick href="/developer/radio" title="Radio Management" />
              <Quick href="/developer/obs-radio" title="OBS Radio" />
              <Quick href="/developer/live-tv" title="Live TV Management" />
              <Quick href="/premium/radio" title="Premium Radio" />
              <Quick href="/premium/tv" title="Premium TV" />
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-lg font-black text-cyan-300">
              MUSIC & PRODUCTION
            </h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Quick href="/developer/albums" title="Album Management" />
              <Quick href="/developer/daw" title="SOLO BEATS DAW" />
              <Quick href="/developer/mix-mastering" title="Mix & Mastering" />
              <Quick href="/developer/stem-lab" title="Stem Lab" />
              <Quick href="/developer/music-visualizer" title="Music Visualizer" />
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-lg font-black text-cyan-300">
              CUSTOMERS & BUSINESS
            </h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Quick href="/developer/customers" title="Customer Management" />
              <Quick href="/developer/orders" title="Orders" />
              <Quick href="/developer/products" title="Products" />
              <Quick href="/developer/artist-promotions" title="Artist Promotions" />
              <Quick href="/developer/social-scheduler" title="Social Scheduler" />
              <Quick href="/developer/analytics" title="Analytics" />
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-lg font-black text-cyan-300">
              PLATFORM MANAGEMENT
            </h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Quick href="/developer/homepage" title="Homepage Management" />
              <Quick href="/developer" title="Developer Dashboard" />
              <Quick href="/developer/connect-payouts" title="Creator Payouts" />
            </div>
          </div>

        </section>
        {/* SOLO_OWNER_CONTROL_CENTER_V2_END */}
{/* SOLO_CONTROL_ROOM_EXTRA_SYSTEMS_V1 */}
        <SectionTitle
          title="PROMOTION & CREATOR SYSTEMS"
          subtitle="Artist promotion, advertising, creator tools and additional platform systems."
        />

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">

          {/* SOLO_CREATOR_APPROVAL_SHORTCUTS_V1 */}
          <Quick
            href="/developer/videos#creator-approval-center"
            title="Creator Approval Center"
          />
          <Quick
            href="/developer/videos"
            title="Video Management"
          />
          {/* SOLO_CREATOR_APPROVAL_SHORTCUTS_END_V1 */}
          <Quick
            href="/developer/artist-promotions"
            title="Artist Promotions"
          />

          <Quick
            href="/developer/social-scheduler"
            title="Social Promotion Scheduler"
          />
          <Quick
            href="/developer/business-advertising"
            title="Business Advertising"
          />
          <Quick
            href="/artist-membership"
            title="Artist Membership"
          />
          <Quick
            href="/audio-tools"
            title="Audio Tools"
          />
          <Quick
            href="/premium/tv"
            title="Premium TV"
          />
          <Quick
            href="/premium/radio"
            title="Premium Radio"
          />
        </section>
        {/* SOLO_CONTROL_ROOM_EXTRA_SYSTEMS_END_V1 */}
        {/* SOLO_SOCIAL_AUTOMATION_STATUS_V1 */}
        <SectionTitle
          title="SOCIAL AUTOMATION STATUS"
          subtitle="Verified automatic publishing systems currently live on SOLO BEATS ENGINE MUSIC."
        />

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">

          <SocialStatus
            platform="FACEBOOK"
            status="COMPLETE"
            detail="Automatic scheduled publishing confirmed."
          />

          <SocialStatus
            platform="INSTAGRAM"
            status="COMPLETE"
            detail="Automatic scheduled publishing confirmed."
          />

          <SocialStatus
            platform="YOUTUBE SHORTS"
            status="COMPLETE"
            detail="Automatic Shorts publishing confirmed."
          />

          <SocialStatus
            platform="YOUTUBE LONG"
            status="COMPLETE"
            detail="Automatic long-form publishing confirmed."
          />

          <SocialStatus
            platform="TIKTOK"
            status="COMPLETE"
            detail="Automatic Direct Post publishing confirmed."
          />

          <SocialStatus
            platform="AUTO PUBLISHER"
            status="COMPLETE"
            detail="5-minute scheduled publisher confirmed."
          />

          <SocialStatus
            platform="RETRY SYSTEM"
            status="COMPLETE"
            detail="Per-post retry tracking is active."
          />

          <SocialStatus
            platform="PLATFORM STATUS"
            status="COMPLETE"
            detail="Per-platform publish status tracking is active."
          />

          <SocialStatus
            platform="RECURRING POSTS"
            status="COMPLETE"
            detail="Recurring social scheduling is active."
          />

        </section>

        <div className="mt-5">
          <ControlLink
            href="/developer/social-scheduler"
            label="OPEN SOCIAL SCHEDULER"
          />
        </div>
        {/* SOLO_SOCIAL_AUTOMATION_STATUS_END_V1 */}
        <SectionTitle
          title="FULL PLATFORM CONTROLS"
          subtitle="Every major SOLO BEATS owner and developer system in one place."
        />

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">

          <Quick
            href="/developer/homepage"
            title="Homepage Manager"
          />

          <Quick
            href="/developer/albums"
            title="Album Manager"
          />

          <Quick
            href="/developer/products"
            title="Physical Store / Product Manager"
          />

          <Quick
            href="/developer/orders"
            title="Orders"
          />

          <Quick
            href="/developer/customers"
            title="Customers"
          />

          <Quick
            href="/developer/analytics"
            title="Analytics"
          />

          <Quick
            href="/developer/premium-members"
            title="Premium Members"
          />

          <Quick
            href="/developer/artist-promotions"
            title="Artist Promotions"
          />

          <Quick
            href="/developer/business-advertising"
            title="Business Advertising"
          />

          <Quick
            href="/developer/mix-mastering"
            title="Mix & Mastering"
          />

          <Quick
            href="/developer/music-visualizer"
            title="Music Visualizer"
          />

          <Quick
            href="/developer/visualizer-credits"
            title="Visualizer Credits"
          />

          <Quick
            href="/developer/auto-video-generator"
            title="Auto Video Generator"
          />

          <Quick
            href="/developer/ai-video"
            title="AI Video"
          />

          <Quick
            href="/developer/hum-to-beat"
            title="Hum-to-Beat"
          />

          <Quick
            href="/developer/daw"
            title="DAW"
          />

          <Quick
            href="/developer/stem-lab"
            title="Stem Lab / Bulk Audio Converter"
          />

          <Quick
            href="/developer/videos"
            title="Video Manager"
          />

          <Quick
            href="/developer/radio"
            title="Radio Control"
          />

          <Quick
            href="/developer/social-scheduler"
            title="Social Scheduler"
          />

          <Quick
            href="/developer/connect-moderation"
            title="SOLO CONNECT Moderation"
          />

          <Quick
            href="/developer/connect-payouts"
            title="SOLO CONNECT Payouts"
          />

          <Quick
            href="/developer/media"
            title="Media Manager"
          />

          <Quick
            href="/developer/catalog"
            title="Catalog"
          />

          <Quick
            href="/developer/download-testing"
            title="Download Testing"
          />

          <Quick
            href="/dj/radio"
            title="DJ Management"
          />

          <Quick
            href="/dj/turntable"
            title="DJ Turntable"
          />

          <Quick
            href="/artist-membership"
            title="Artist Membership"
          />

          <Quick
            href="/audio-tools"
            title="Audio Tools"
          />

          <Quick
            href="/premium/radio"
            title="Premium Radio"
          />

          <Quick
            href="/developer/live-tv"
            title="LIVE TV CONTROL"
          /><Quick
            href="/premium/tv"
            title="Premium TV"
          />

          <Quick
            href="/developer"
            title="Developer Dashboard"
          />

        </section>

<div className="mt-10 rounded-2xl border border-white/10 bg-[#090909] p-5 text-sm text-zinc-500">
          SOLO BEATS ENGINE MUSIC · LIVE OWNER CONTROL ROOM
        </div>

      </div>
    </main>
  );
}

function Shell({
  children,
}: {
  children:
    React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[#050505] px-5 py-20 text-white">
      <div className="mx-auto max-w-6xl">
        {children}
      </div>
    </main>
  );
}

function BigStatus({
  label,
  value,
  good,
}: {
  label: string;
  value: string;
  good: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0b0b0b] p-5">
      <div className="text-[10px] font-black tracking-[0.2em] text-zinc-500">
        {label}
      </div>

      <div className={`mt-2 text-xl font-black ${
        good
          ? "text-emerald-300"
          : "text-red-300"
      }`}>
        {value}
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0b0b0b] p-5">
      <div className="text-sm font-bold text-zinc-500">
        {label}
      </div>

      <div className="mt-2 text-3xl font-black">
        {value}
      </div>
    </div>
  );
}

function Info({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-4">
      <div className="text-[10px] font-black tracking-[0.16em] text-zinc-500">
        {label}
      </div>

      <div className="mt-2 break-all font-black text-zinc-200">
        {value}
      </div>
    </div>
  );
}

function SectionTitle({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div className="mb-4 mt-10">
      <h2 className="text-2xl font-black">
        {title}
      </h2>

      <p className="mt-1 text-sm text-zinc-500">
        {subtitle}
      </p>
    </div>
  );
}

function SocialStatus({
  platform,
  status,
  detail,
}: {
  platform: string;
  status: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-emerald-400/25 bg-emerald-400/[0.06] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-black tracking-[0.18em] text-zinc-500">
            {platform}
          </div>

          <div className="mt-2 text-lg font-black text-emerald-300">
            ● {status}
          </div>
        </div>

        <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-[10px] font-black tracking-wider text-emerald-200">
          LIVE
        </span>
      </div>

      <p className="mt-4 text-sm leading-6 text-zinc-400">
        {detail}
      </p>
    </div>
  );
}
function ControlLink({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="inline-flex rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs font-black tracking-wider text-red-200 hover:bg-red-500/20"
    >
      {label} →
    </Link>
  );
}

function Quick({
  href,
  title,
}: {
  href: string;
  title: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-white/10 bg-[#0b0b0b] p-5 transition hover:border-red-500/50 hover:bg-[#101010]"
    >
      <div className="font-black">
        {title}
      </div>

      <div className="mt-4 text-xs font-black tracking-wider text-red-400">
        OPEN CONTROL →
      </div>
    </Link>
  );
}







