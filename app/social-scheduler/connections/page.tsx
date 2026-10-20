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

type PlatformKey =
  | "facebook"
  | "instagram"
  | "youtube"
  | "tiktok";

type PlatformStatus = {
  configured: boolean;
  connected: boolean;
  pageName?: string | null;
  username?: string | null;
  displayName?: string | null;
  channelTitle?: string | null;
};

type ConnectionsResponse = {
  success: boolean;
  accessActive?: boolean;
  planName?: string | null;
  allowedPlatforms?: string[];
  facebook?: PlatformStatus;
  instagram?: PlatformStatus;
  youtube?: PlatformStatus;
  tiktok?: PlatformStatus;
  error?: string;
};

const platforms: Array<{
  key: PlatformKey;
  title: string;
  description: string;
}> = [
  {
    key: "facebook",
    title: "Facebook",
    description:
      "Connect your Facebook Page for scheduled promotions and Reels.",
  },
  {
    key: "instagram",
    title: "Instagram",
    description:
      "Connect your Instagram professional account for Reels and promotions.",
  },
  {
    key: "youtube",
    title: "YouTube",
    description:
      "Connect your YouTube channel for Shorts and video publishing.",
  },
  {
    key: "tiktok",
    title: "TikTok",
    description:
      "Connect your TikTok account for scheduled video publishing.",
  },
];

export default function SocialConnectionsPage() {
  const {
    user,
    loading,
  } = useAuth();

  const [
    data,
    setData,
  ] =
    useState<ConnectionsResponse | null>(
      null
    );

  const [
    busy,
    setBusy,
  ] =
    useState<PlatformKey | null>(
      null
    );

  const [
    refreshing,
    setRefreshing,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    success,
    setSuccess,
  ] =
    useState("");

  const refresh =
    useCallback(async () => {
      if (!user) {
        return;
      }

      setRefreshing(true);
      setError("");

      try {
        const token =
          await user.getIdToken();

        const response =
          await fetch(
            "/api/social-scheduler/connections?ts=" +
              Date.now(),
            {
              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
              cache:
                "no-store",
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
              "Connections could not be loaded."
          );
        }

        setData(result);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Connections could not be loaded."
        );
      } finally {
        setRefreshing(false);
      }
    }, [
      user,
    ]);

  useEffect(() => {
    if (
      !loading &&
      user
    ) {
      void refresh();
    }
  }, [
    loading,
    user,
    refresh,
  ]);

  useEffect(() => {
    const params =
      new URLSearchParams(
        window.location.search
      );

    let successFound =
      false;

    for (const platform of platforms) {
      if (
        params.get(
          platform.key
        ) === "connected"
      ) {
        setSuccess(
          `${platform.title} connected successfully.`
        );

        successFound =
          true;

        break;
      }
    }

    if (successFound) {
      return;
    }

    // SOLO_CUSTOMER_META_QUERY_ERRORS_V2
    for (const platform of platforms) {
      const status =
        params.get(
          platform.key
        );

      if (
        ![
          "denied",
          "invalid",
          "expired",
          "error",
        ].includes(
          status || ""
        )
      ) {
        continue;
      }

      if (status === "denied") {
        setError(
          `${platform.title} authorization was cancelled or denied.`
        );

        return;
      }

      if (status === "expired") {
        setError(
          `${platform.title} authorization expired. Please try again.`
        );

        return;
      }

      if (status === "invalid") {
        setError(
          `${platform.title} returned an invalid authorization request.`
        );

        return;
      }

      setError(
        `${platform.title} could not be connected. Please try again.`
      );

      return;
    }
  }, []);

  async function connect(
    platform: PlatformKey
  ) {
    if (!user) {
      return;
    }

    setBusy(platform);
    setError("");
    setSuccess("");

    try {
      const token =
        await user.getIdToken();

      const endpoint =
        platform === "facebook"
          ? "meta"
          : platform;

      const response =
        await fetch(
          `/api/social-scheduler/connections/${endpoint}/start`,
          {
            method:
              "POST",

            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          }
        );

      const result =
        await response.json();

      if (
        !response.ok ||
        !result.success ||
        typeof result.authUrl !==
          "string"
      ) {
        throw new Error(
          result.error ||
            "Connection could not start."
        );
      }

      window.location.href =
        result.authUrl;
    } catch (err) {
      setBusy(null);

      setError(
        err instanceof Error
          ? err.message
          : "Connection could not start."
      );
    }
  }

  async function disconnect(
    platform: PlatformKey
  ) {
    if (!user) {
      return;
    }

    const confirmed =
      window.confirm(
        `Disconnect ${platform}?`
      );

    if (!confirmed) {
      return;
    }

    setBusy(platform);
    setError("");
    setSuccess("");

    try {
      const token =
        await user.getIdToken();

      const response =
        await fetch(
          "/api/social-scheduler/connections",
          {
            method:
              "DELETE",

            headers: {
              Authorization:
                `Bearer ${token}`,

              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                platform,
              }),
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
            "Disconnect failed."
        );
      }

      setSuccess(
        `${platform.toUpperCase()} disconnected.`
      );

      await refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Disconnect failed."
      );
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black p-8 text-white">
        Loading...
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-black p-8 text-white">
        <h1 className="text-4xl font-black">
          Social Connections
        </h1>

        <Link
          href="/account?mode=signin"
          className="mt-6 inline-flex rounded-xl bg-white px-5 py-3 font-black text-black"
        >
          SIGN IN
        </Link>
      </main>
    );
  }

  const allowed =
    data?.allowedPlatforms || [];

  return (
    <main className="min-h-screen bg-black px-5 py-10 text-white">

      <div className="mx-auto max-w-7xl">

        <div className="flex flex-wrap items-start justify-between gap-5">

          <div>

            <div className="text-xs font-black uppercase tracking-[0.28em] text-cyan-300">
              SOLO BEATS ENGINE MUSIC
            </div>

            <h1 className="mt-3 text-4xl font-black md:text-6xl">
              Social Connections
            </h1>

            <p className="mt-4 text-white/60">
              Connect your own social accounts securely.
            </p>

          </div>

          <Link
            href="/social-scheduler"
            className="rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-black"
          >
            BACK TO SCHEDULER
          </Link>

        </div>

        {error ? (
          <div className="mt-6 rounded-2xl border border-red-400/30 bg-red-500/10 p-5 text-red-200">
            {error}
          </div>
        ) : null}

        {success ? (
          <div className="mt-6 rounded-2xl border border-green-400/30 bg-green-500/10 p-5 text-green-200">
            {success}
          </div>
        ) : null}

        <div className="mt-8 grid gap-4 md:grid-cols-3">

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-xs font-black text-white/45">
              ACCOUNT
            </div>

            <div className="mt-2 font-black">
              {user.email}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-xs font-black text-white/45">
              PLAN
            </div>

            <div className="mt-2 text-xl font-black">
              {data?.planName ||
                "No Plan"}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="text-xs font-black text-white/45">
              ACCESS
            </div>

            <div
              className={
                data?.accessActive
                  ? "mt-2 text-xl font-black text-green-300"
                  : "mt-2 text-xl font-black text-yellow-300"
              }
            >
              {data?.accessActive
                ? "ACTIVE"
                : "SUBSCRIPTION REQUIRED"}
            </div>
          </div>

        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-2">

          {platforms.map(
            platform => {

              const status =
                data?.[
                  platform.key
                ];

              const connected =
                status?.connected ===
                true;

              const configured =
                status?.configured ===
                true;

              const included =
                allowed.includes(
                  platform.key
                );

              const identity =
                status?.pageName ||
                status?.channelTitle ||
                status?.username ||
                status?.displayName ||
                "";

              return (
                <section
                  key={platform.key}
                  className="rounded-3xl border border-white/10 bg-white/5 p-6"
                >

                  <div className="flex items-start justify-between gap-4">

                    <div>
                      <h2 className="text-2xl font-black">
                        {platform.title}
                      </h2>

                      <p className="mt-2 text-sm text-white/50">
                        {platform.description}
                      </p>
                    </div>

                    <span
                      className={
                        connected
                          ? "rounded-full bg-green-500/15 px-3 py-2 text-xs font-black text-green-300"
                          : "rounded-full bg-white/5 px-3 py-2 text-xs font-black text-white/40"
                      }
                    >
                      {connected
                        ? "CONNECTED"
                        : "NOT CONNECTED"}
                    </span>

                  </div>

                  {identity ? (
                    <div className="mt-5 rounded-xl border border-white/10 bg-black/30 p-4 text-sm">
                      {identity}
                    </div>
                  ) : null}

                  {!included &&
                  data?.accessActive ? (
                    <div className="mt-5 text-sm font-bold text-yellow-300">
                      Not included in your current plan.
                    </div>
                  ) : null}

                  {!configured ? (
                    <div className="mt-5 text-sm font-bold text-red-300">
                      OAuth is not configured.
                    </div>
                  ) : null}

                  <div className="mt-6">

                    {connected ? (
                      <div className="space-y-3">
                        {/* SOLO_CUSTOMER_RECONNECT_CONTROLS_V1 */}
                        <button
                          type="button"
                          onClick={() =>
                            void connect(
                              platform.key
                            )
                          }
                          disabled={
                            !data?.accessActive ||
                            !included ||
                            !configured ||
                            busy !== null
                          }
                          className="w-full rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-5 py-4 text-sm font-black text-cyan-200 disabled:opacity-30"
                        >
                          {busy ===
                          platform.key
                            ? "OPENING..."
                            : `RECONNECT ${platform.title.toUpperCase()}`}
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            void disconnect(
                              platform.key
                            )
                          }
                          disabled={
                            busy ===
                            platform.key
                          }
                          className="w-full rounded-xl border border-red-400/30 bg-red-500/10 px-5 py-4 text-sm font-black text-red-200 disabled:opacity-40"
                        >
                          {busy ===
                          platform.key
                            ? "WORKING..."
                            : "DISCONNECT"}
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          void connect(
                            platform.key
                          )
                        }
                        disabled={
                          !data?.accessActive ||
                          !included ||
                          !configured ||
                          busy !== null
                        }
                        className="w-full rounded-xl bg-white px-5 py-4 text-sm font-black text-black disabled:opacity-30"
                      >
                        {busy ===
                        platform.key
                          ? "OPENING..."
                          : `CONNECT ${platform.title.toUpperCase()}`}
                      </button>
                    )}

                  </div>

                </section>
              );
            }
          )}

        </div>

        <button
          type="button"
          onClick={() =>
            void refresh()
          }
          disabled={refreshing}
          className="mt-7 rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-black disabled:opacity-40"
        >
          {refreshing
            ? "REFRESHING..."
            : "REFRESH CONNECTION STATUS"}
        </button>

      </div>

    </main>
  );
}


