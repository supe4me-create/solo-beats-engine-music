"use client";

import Link from "next/link";

import {
  useState,
} from "react";

import {
  useAuth,
} from "../../auth/AuthContext";

export default function SchedulerTestAccessPage() {
  const {
    user,
    loading,
  } = useAuth();

  const [
    busy,
    setBusy,
  ] =
    useState(false);

  const [
    message,
    setMessage,
  ] =
    useState("");

  const [
    error,
    setError,
  ] =
    useState("");

  async function activate() {
    if (!user) {
      return;
    }

    setBusy(true);
    setMessage("");
    setError("");

    try {
      const token =
        await user.getIdToken();

      const response =
        await fetch(
          "/api/social-scheduler/test-access",
          {
            method: "POST",

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
        !result.success
      ) {
        throw new Error(
          result.error ||
            "Test access could not be activated."
        );
      }

      setMessage(
        "PRO TEST ACCESS ACTIVATED."
      );

    } catch (err) {

      setError(
        err instanceof Error
          ? err.message
          : "Test access could not be activated."
      );

    } finally {

      setBusy(false);

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
          Social Scheduler Test Access
        </h1>

        <p className="mt-4 text-white/60">
          Sign in first.
        </p>

        <Link
          href="/account?mode=signin"
          className="mt-6 inline-flex rounded-xl bg-white px-5 py-3 font-black text-black"
        >
          SIGN IN
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-5 py-16 text-white">

      <div className="mx-auto max-w-2xl">

        <div className="rounded-3xl border border-cyan-400/20 bg-white/5 p-8">

          <div className="text-xs font-black uppercase tracking-[0.28em] text-cyan-300">
            SOLO BEATS ENGINE MUSIC
          </div>

          <h1 className="mt-4 text-4xl font-black">
            Scheduler Test Access
          </h1>

          <p className="mt-4 text-white/60">
            Temporarily activate Pro Social Scheduler access for this signed-in owner account.
          </p>

          <div className="mt-6 rounded-xl border border-white/10 bg-black/40 p-4">

            <div className="text-xs font-black text-white/40">
              SIGNED IN AS
            </div>

            <div className="mt-2 break-all font-black">
              {user.email}
            </div>

          </div>

          {message ? (
            <div className="mt-6 rounded-xl border border-green-400/30 bg-green-500/10 p-4 font-black text-green-200">
              {message}
            </div>
          ) : null}

          {error ? (
            <div className="mt-6 rounded-xl border border-red-400/30 bg-red-500/10 p-4 font-black text-red-200">
              {error}
            </div>
          ) : null}

          <button
            type="button"
            onClick={() =>
              void activate()
            }
            disabled={busy}
            className="mt-7 w-full rounded-xl bg-cyan-300 px-5 py-4 font-black text-black disabled:opacity-40"
          >
            {busy
              ? "ACTIVATING..."
              : "ACTIVATE PRO TEST ACCESS"}
          </button>

          <Link
            href="/social-scheduler/connections"
            className="mt-4 flex w-full items-center justify-center rounded-xl border border-white/15 bg-white/5 px-5 py-4 font-black"
          >
            OPEN SOCIAL CONNECTIONS
          </Link>

        </div>

      </div>

    </main>
  );
}
