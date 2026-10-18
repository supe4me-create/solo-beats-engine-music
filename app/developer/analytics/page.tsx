"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import { firebaseAuth } from "../../../lib/firebaseClient";

type AnalyticsData = {
  success: boolean;

  totals: {
    recordedPageViews: number;
    uniqueVisitors: number;
    todayViews: number;
    todayUniqueVisitors: number;
    sevenDayViews: number;
    thirtyDayViews: number;
    thirtyDayUniqueVisitors: number;
    thirtyDaySessions: number;
    albumViews30d: number;
  };

  topPages: Array<{
    path: string;
    views: number;
  }>;

  topAlbums: Array<{
    path: string;
    views: number;
  }>;

  dailyViews: Array<{
    date: string;
    views: number;
  }>;

  previewFunnel: {
    radioPublicStarted: number;
    radioPublicLimit: number;
    radioFreeStarted: number;
    radioFreeLimit: number;

    tvPublicStarted: number;
    tvPublicLimit: number;
    tvFreeStarted: number;
    tvFreeLimit: number;
  };

  note?: string | null;
};

function prettyPath(path: string) {
  if (path === "/") {
    return "Homepage";
  }

  return path
    .replace(/^\/+/, "")
    .replaceAll("-", " ")
    .replaceAll("/", " / ");
}

export default function AnalyticsPage() {
  const [user, setUser] =
    useState<User | null>(null);

  const [authReady, setAuthReady] =
    useState(false);

  const [data, setData] =
    useState<AnalyticsData | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    return onAuthStateChanged(
      firebaseAuth,
      (currentUser) => {
        setUser(currentUser);
        setAuthReady(true);
      }
    );
  }, []);

  useEffect(() => {
    if (!authReady) {
      return;
    }

    if (!user) {
      setLoading(false);
      setData(null);
      return;
    }

    const currentUser = user;
    let cancelled = false;

    async function loadAnalytics() {
      setLoading(true);
      setError("");

      try {
        const idToken =
          await currentUser.getIdToken();

        const response = await fetch(
          "/api/owner/analytics",
          {
            headers: {
              Authorization:
                `Bearer ${idToken}`,
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
              "Analytics could not be loaded."
          );
        }

        if (!cancelled) {
          setData(
            result as AnalyticsData
          );
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Analytics could not be loaded."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadAnalytics();

    return () => {
      cancelled = true;
    };
  }, [authReady, user]);

  if (!authReady || loading) {
    return (
      <main className="min-h-screen bg-black px-6 py-16 text-white">
        <div className="mx-auto max-w-7xl">
          <p className="text-white/60">
            Loading Solo Beats analytics...
          </p>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-black px-6 py-16 text-white">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-4xl font-black">
            Owner Analytics
          </h1>

          <p className="mt-4 text-white/55">
            Sign in with the owner account
            to view platform analytics.
          </p>

          <Link
            href="/account"
            className="mt-8 inline-flex rounded-2xl bg-white px-6 py-4 font-black text-black"
          >
            Sign In
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-4 py-10 text-white sm:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.25em] text-violet-300">
              SOLO BEATS ENGINE MUSIC
            </p>

            <h1 className="mt-2 text-4xl font-black sm:text-5xl">
              Customer Analytics
            </h1>

            <p className="mt-3 max-w-3xl text-white/50">
              Understand who is visiting,
              what they are viewing, and
              which parts of the platform
              attract the most attention.
            </p>
          </div>

          <Link
            href="/developer"
            className="inline-flex w-fit rounded-2xl border border-white/10 bg-white/[0.05] px-5 py-3 font-bold"
          >
            Developer Dashboard
          </Link>
        </div>

        {error ? (
          <div className="mt-8 rounded-2xl border border-red-400/25 bg-red-400/10 p-5 text-red-200">
            {error}
          </div>
        ) : null}

        {data ? (
          <>
            <section className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                [
                  "Visitors Today",
                  data.totals.todayUniqueVisitors,
                ],
                [
                  "Views Today",
                  data.totals.todayViews,
                ],
                [
                  "7-Day Views",
                  data.totals.sevenDayViews,
                ],
                [
                  "30-Day Visitors",
                  data.totals
                    .thirtyDayUniqueVisitors,
                ],
                [
                  "30-Day Views",
                  data.totals.thirtyDayViews,
                ],
                [
                  "30-Day Sessions",
                  data.totals.thirtyDaySessions,
                ],
                [
                  "Album Views",
                  data.totals.albumViews30d,
                ],
                [
                  "Recorded Visitors",
                  data.totals.uniqueVisitors,
                ],
              ].map(([label, value]) => (
                <div
                  key={String(label)}
                  className="rounded-[1.6rem] border border-white/10 bg-white/[0.04] p-6"
                >
                  <p className="text-sm font-bold uppercase tracking-[0.12em] text-white/40">
                    {label}
                  </p>

                  <p className="mt-3 text-4xl font-black">
                    {value}
                  </p>
                </div>
              ))}
            </section>

            <section className="mt-8 rounded-[2rem] border border-emerald-300/15 bg-emerald-300/[0.04] p-6">
              <p className="text-sm font-black uppercase tracking-[0.2em] text-emerald-300">
                Preview Conversion
              </p>

              <h2 className="mt-2 text-2xl font-black">
                Radio + TV preview activity  last 30 days
              </h2>

              <p className="mt-2 text-sm text-white/45">
                Tracks public previews and free-account previews as listeners and viewers move toward Premium.
              </p>

              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  [
                    "Radio Public Starts",
                    data.previewFunnel.radioPublicStarted,
                  ],
                  [
                    "Radio 2-Song Limits",
                    data.previewFunnel.radioPublicLimit,
                  ],
                  [
                    "Radio Free Starts",
                    data.previewFunnel.radioFreeStarted,
                  ],
                  [
                    "Radio 5-Song Limits",
                    data.previewFunnel.radioFreeLimit,
                  ],
                  [
                    "TV Public Starts",
                    data.previewFunnel.tvPublicStarted,
                  ],
                  [
                    "TV 2-Video Limits",
                    data.previewFunnel.tvPublicLimit,
                  ],
                  [
                    "TV Free Starts",
                    data.previewFunnel.tvFreeStarted,
                  ],
                  [
                    "TV 5-Video Limits",
                    data.previewFunnel.tvFreeLimit,
                  ],
                ].map(([label, value]) => (
                  <div
                    key={String(label)}
                    className="rounded-[1.5rem] border border-white/10 bg-black/25 p-5"
                  >
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-white/40">
                      {label}
                    </p>

                    <p className="mt-3 text-4xl font-black text-emerald-200">
                      {value}
                    </p>
                  </div>
                ))}
              </div>
            </section>
            <section className="mt-8 grid gap-6 lg:grid-cols-2">
              <div className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-6">
                <p className="text-sm font-black uppercase tracking-[0.2em] text-violet-300">
                  Top Pages
                </p>

                <h2 className="mt-2 text-2xl font-black">
                  Most visited  last 30 days
                </h2>

                <div className="mt-6 space-y-3">
                  {data.topPages.length ? (
                    data.topPages.map(
                      (page, index) => (
                        <div
                          key={page.path}
                          className="flex items-center justify-between gap-4 rounded-2xl bg-black/25 p-4"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-black text-white/30">
                              #{index + 1}
                            </p>

                            <p className="mt-1 truncate font-bold capitalize">
                              {prettyPath(
                                page.path
                              )}
                            </p>

                            <p className="mt-1 truncate text-xs text-white/35">
                              {page.path}
                            </p>
                          </div>

                          <div className="text-right">
                            <p className="text-2xl font-black">
                              {page.views}
                            </p>
                            <p className="text-xs text-white/35">
                              views
                            </p>
                          </div>
                        </div>
                      )
                    )
                  ) : (
                    <p className="text-white/45">
                      No page views recorded yet.
                    </p>
                  )}
                </div>
              </div>

              <div className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-6">
                <p className="text-sm font-black uppercase tracking-[0.2em] text-emerald-300">
                  Albums
                </p>

                <h2 className="mt-2 text-2xl font-black">
                  Most viewed albums
                </h2>

                <div className="mt-6 space-y-3">
                  {data.topAlbums.length ? (
                    data.topAlbums.map(
                      (album, index) => (
                        <div
                          key={album.path}
                          className="flex items-center justify-between gap-4 rounded-2xl bg-black/25 p-4"
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-black text-white/30">
                              #{index + 1}
                            </p>

                            <p className="mt-1 truncate font-bold capitalize">
                              {prettyPath(
                                album.path
                              )}
                            </p>
                          </div>

                          <div className="text-right">
                            <p className="text-2xl font-black text-emerald-200">
                              {album.views}
                            </p>

                            <p className="text-xs text-white/35">
                              views
                            </p>
                          </div>
                        </div>
                      )
                    )
                  ) : (
                    <p className="text-white/45">
                      No album views recorded yet.
                    </p>
                  )}
                </div>
              </div>
            </section>

            <section className="mt-8 rounded-[2rem] border border-white/10 bg-white/[0.035] p-6">
              <p className="text-sm font-black uppercase tracking-[0.2em] text-cyan-300">
                30-Day Traffic
              </p>

              <h2 className="mt-2 text-2xl font-black">
                Daily page views
              </h2>

              <div className="mt-6 overflow-x-auto">
                <div className="flex min-w-[900px] items-end gap-2">
                  {data.dailyViews.map(
                    (day) => {
                      const max = Math.max(
                        1,
                        ...data.dailyViews.map(
                          (item) =>
                            item.views
                        )
                      );

                      const height =
                        Math.max(
                          4,
                          (day.views / max) *
                            180
                        );

                      return (
                        <div
                          key={day.date}
                          className="flex min-w-[24px] flex-1 flex-col items-center"
                          title={`${day.date}: ${day.views} views`}
                        >
                          <p className="mb-2 text-xs font-black text-white/45">
                            {day.views}
                          </p>

                          <div
                            className="w-full rounded-t-lg bg-violet-400/70"
                            style={{
                              height,
                            }}
                          />

                          <p className="mt-2 rotate-[-55deg] whitespace-nowrap text-[10px] text-white/30">
                            {day.date.slice(5)}
                          </p>
                        </div>
                      );
                    }
                  )}
                </div>
              </div>
            </section>

            {data.note ? (
              <p className="mt-6 text-sm text-amber-200/70">
                {data.note}
              </p>
            ) : null}
          </>
        ) : null}
      </div>
    </main>
  );
}
