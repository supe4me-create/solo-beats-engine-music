"use client";

import {
  useState,
} from "react";

import Link from "next/link";

import {
  useAuth,
} from "../../auth/AuthContext";

const OWNER_EMAIL =
  "supe4.me@gmail.com";

export default function VisualizerCreditsManagerPage() {
  const {
    user,
    loading,
  } =
    useAuth();

  const [
    email,
    setEmail,
  ] =
    useState("");

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

  const [
    balance,
    setBalance,
  ] =
    useState<number | null>(
      null
    );

  const isOwner =
    user?.email
      ?.toLowerCase() ===
    OWNER_EMAIL;

  async function grantCredit() {
    if (
      !user ||
      !isOwner ||
      busy
    ) {
      return;
    }

    const targetEmail =
      email
        .trim()
        .toLowerCase();

    if (
      !targetEmail ||
      !targetEmail.includes(
        "@"
      )
    ) {
      setError(
        "Enter the customer's account email."
      );

      return;
    }

    setBusy(
      true
    );

    setError(
      ""
    );

    setMessage(
      ""
    );

    setBalance(
      null
    );

    try {
      const token =
        await user.getIdToken();

      const response =
        await fetch(
          "/api/owner/visualizer-credits/test-grant",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${token}`,
            },

            body:
              JSON.stringify({
                email:
                  targetEmail,
              }),
          }
        );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.error ||
          "Test credit could not be granted."
        );
      }

      setBalance(
        Number(
          data.balance ||
          0
        )
      );

      setMessage(
        data.message ||
        "1 test Visualizer Credit added."
      );
    }
    catch (grantError) {
      setError(
        grantError instanceof Error
          ? grantError.message
          : "Test credit could not be granted."
      );
    }
    finally {
      setBusy(
        false
      );
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black px-6 pb-32 pt-40 text-white">
        <div className="mx-auto max-w-3xl">
          Checking owner access...
        </div>
      </main>
    );
  }

  if (
    !user ||
    !isOwner
  ) {
    return (
      <main className="min-h-screen bg-black px-6 pb-32 pt-40 text-white">
        <div className="mx-auto max-w-xl rounded-[2rem] border border-red-400/20 bg-red-400/10 p-8 text-center">

          <h1 className="text-3xl font-black">
            Owner Access Only
          </h1>

          <p className="mt-4 text-white/60">
            Sign in with the SOLO BEATS owner account.
          </p>

          <Link
            href="/account"
            className="mt-6 inline-flex rounded-xl bg-white px-6 py-3 font-black text-black"
          >
            OPEN ACCOUNT
          </Link>

        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-5 pb-32 pt-36 text-white sm:px-8">

      <div className="mx-auto max-w-4xl">

        <section className="rounded-[2rem] border border-fuchsia-300/20 bg-gradient-to-br from-fuchsia-600/20 via-white/[0.04] to-red-500/10 p-7 sm:p-10">

          <p className="text-sm font-black uppercase tracking-[0.24em] text-fuchsia-300">
            SOLO BEATS ENGINE MUSIC
          </p>

          <h1 className="mt-3 text-4xl font-black sm:text-5xl">
            Visualizer Test Credits
          </h1>

          <p className="mt-4 max-w-2xl leading-7 text-white/60">
            Grant a verified customer account one Visualizer Credit for testing.
            No PayPal payment is required.
          </p>

        </section>

        <section className="mt-8 rounded-[2rem] border border-white/10 bg-white/[0.04] p-7">

          <label className="text-sm font-black uppercase tracking-widest text-white/50">
            Customer Account Email
          </label>

          <input
            type="email"
            value={email}
            disabled={busy}
            onChange={
              event =>
                setEmail(
                  event.target.value
                )
            }
            placeholder="customer@example.com"
            className="mt-3 w-full rounded-2xl border border-white/10 bg-black px-5 py-4 text-lg text-white outline-none focus:border-fuchsia-300/50"
          />

          <button
            type="button"
            disabled={
              busy ||
              !email.trim()
            }
            onClick={
              () =>
                void grantCredit()
            }
            className="mt-5 w-full rounded-2xl bg-fuchsia-500 px-6 py-4 text-lg font-black text-white disabled:opacity-40"
          >
            {
              busy
                ? "GRANTING..."
                : "GRANT 1 TEST CREDIT"
            }
          </button>

          {
            balance !==
            null
              ? (
                <div className="mt-6 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-6">

                  <p className="text-sm font-black uppercase tracking-widest text-emerald-200/60">
                    Customer Balance
                  </p>

                  <p className="mt-2 text-5xl font-black text-emerald-200">
                    {balance}
                  </p>

                  <p className="mt-1 text-sm text-emerald-100/60">
                    Visualizer Credits
                  </p>

                </div>
              )
              : null
          }

          {
            message
              ? (
                <p className="mt-5 rounded-xl border border-emerald-300/20 bg-emerald-300/10 p-4 text-emerald-200">
                  {message}
                </p>
              )
              : null
          }

          {
            error
              ? (
                <p className="mt-5 rounded-xl border border-red-300/20 bg-red-400/10 p-4 text-red-200">
                  {error}
                </p>
              )
              : null
          }

        </section>

        <div className="mt-7 flex flex-wrap gap-3">

          <Link
            href="/developer/music-visualizer"
            className="rounded-xl border border-white/10 px-5 py-3 font-black text-white/70"
          >
            OWNER VISUALIZER
          </Link>

          <Link
            href="/music-visualizer/credits"
            className="rounded-xl border border-white/10 px-5 py-3 font-black text-white/70"
          >
            CUSTOMER CREDIT PAGE
          </Link>

        </div>

      </div>

    </main>
  );
}