"use client";

import Link from "next/link";
import {
  FormEvent,
  useCallback,
  useEffect,
  useState,
} from "react";

import { useAuth } from "../../../auth/AuthContext";

type CreditAccount = {
  uid: string;
  balance: number;
  updatedAt: string | null;
};

type CreditPack = {
  id: string;
  credits: number;
  price: number;
};

type ApiData = {
  success?: boolean;
  accounts?: CreditAccount[];
  packs?: CreditPack[];
  summary?: {
    accounts: number;
    totalCredits: number;
  };
  error?: string;
};

export default function CreditsManagerPage() {
  const { user, loading } = useAuth();

  const [accounts, setAccounts] =
    useState<CreditAccount[]>([]);

  const [packs, setPacks] =
    useState<CreditPack[]>([]);

  const [totalCredits, setTotalCredits] =
    useState(0);

  const [loadingCredits, setLoadingCredits] =
    useState(false);

  const [uid, setUid] =
    useState("");

  const [amount, setAmount] =
    useState("10");

  const [saving, setSaving] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [error, setError] =
    useState("");

  const loadCredits =
    useCallback(async () => {
      if (!user) {
        return;
      }

      setLoadingCredits(true);
      setError("");

      try {
        const token =
          await user.getIdToken();

        const response =
          await fetch(
            "/api/owner/ai-video/credits",
            {
              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
              cache: "no-store",
            }
          );

        const data =
          (await response.json()) as ApiData;

        if (!response.ok || !data.success) {
          throw new Error(
            data.error ||
              "Credits could not be loaded."
          );
        }

        setAccounts(
          Array.isArray(data.accounts)
            ? data.accounts
            : []
        );

        setPacks(
          Array.isArray(data.packs)
            ? data.packs
            : []
        );

        setTotalCredits(
          data.summary?.totalCredits ?? 0
        );
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Credits could not be loaded."
        );
      } finally {
        setLoadingCredits(false);
      }
    }, [user]);

  useEffect(() => {
    void loadCredits();
  }, [loadCredits]);

  async function addCredits(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!user || saving) {
      return;
    }

    setSaving(true);
    setMessage("");
    setError("");

    try {
      const token =
        await user.getIdToken();

      const response =
        await fetch(
          "/api/owner/ai-video/credits",
          {
            method: "POST",
            headers: {
              Authorization:
                `Bearer ${token}`,
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              uid,
              amount: Number(amount),
            }),
          }
        );

      const data =
        (await response.json()) as {
          success?: boolean;
          added?: number;
          balance?: number;
          error?: string;
        };

      if (!response.ok || !data.success) {
        throw new Error(
          data.error ||
            "Credits could not be added."
        );
      }

      setMessage(
        `Added ${data.added ?? amount} credits. New balance: ${data.balance ?? 0}.`
      );

      await loadCredits();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Credits could not be added."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#050816] p-8 text-white">
        Loading...
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-[#050816] p-8 text-white">
        Sign in to continue.
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050816] px-5 py-10 text-white">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
              Owner Control
            </p>

            <h1 className="mt-2 text-4xl font-black">
              AI Video Payments & Credits
            </h1>

            <p className="mt-3 max-w-3xl text-white/55">
              Review subscriber balances, credit packs, and manually add AI Video credits.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/developer"
              className="rounded-2xl border border-white/15 bg-white/5 px-5 py-3 font-black"
            >
              Owner Dashboard
            </Link>

            <Link
              href="/developer/ai-video"
              className="rounded-2xl bg-white px-5 py-3 font-black text-black"
            >
              AI Video Generator
            </Link>
          </div>
        </div>

        <section className="mt-8 grid gap-4 sm:grid-cols-3">
          <StatCard
            label="Credit Accounts"
            value={
              loadingCredits
                ? "..."
                : accounts.length
            }
          />

          <StatCard
            label="Credits Outstanding"
            value={
              loadingCredits
                ? "..."
                : totalCredits
            }
          />

          <StatCard
            label="Owner Generation Cost"
            value="0"
          />
        </section>

        <section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="text-2xl font-black">
            Current Credit Packs
          </h2>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {packs.map((pack) => (
              <div
                key={pack.id}
                className="rounded-2xl border border-cyan-300/15 bg-cyan-400/[0.04] p-5"
              >
                <p className="text-3xl font-black">
                  {pack.credits}
                </p>

                <p className="mt-1 text-sm text-white/50">
                  AI Video Credits
                </p>

                <p className="mt-4 text-xl font-black">
                  ${pack.price.toFixed(2)}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <h2 className="text-2xl font-black">
            Add Subscriber Credits
          </h2>

          <form
            onSubmit={addCredits}
            className="mt-5 grid gap-4 md:grid-cols-[1fr_180px_auto]"
          >
            <input
              value={uid}
              onChange={(event) =>
                setUid(event.target.value)
              }
              placeholder="Subscriber Firebase UID"
              className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none"
              required
            />

            <input
              value={amount}
              onChange={(event) =>
                setAmount(event.target.value)
              }
              type="number"
              min="1"
              max="10000"
              className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3 outline-none"
              required
            />

            <button
              type="submit"
              disabled={saving}
              className="rounded-2xl bg-white px-6 py-3 font-black text-black disabled:opacity-50"
            >
              {saving
                ? "Adding..."
                : "Add Credits"}
            </button>
          </form>

          {message ? (
            <p className="mt-4 rounded-2xl border border-emerald-300/20 bg-emerald-400/10 p-4 text-sm font-bold text-emerald-200">
              {message}
            </p>
          ) : null}

          {error ? (
            <p className="mt-4 rounded-2xl border border-red-300/20 bg-red-400/10 p-4 text-sm font-bold text-red-200">
              {error}
            </p>
          ) : null}
        </section>

        <section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-2xl font-black">
              Subscriber Credit Accounts
            </h2>

            <button
              type="button"
              onClick={() => void loadCredits()}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-black"
            >
              Refresh
            </button>
          </div>

          <div className="mt-5 space-y-3">
            {!loadingCredits &&
            accounts.length === 0 ? (
              <p className="text-white/45">
                No AI Video credit accounts found.
              </p>
            ) : null}

            {accounts.map((account) => (
              <div
                key={account.uid}
                className="grid gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 md:grid-cols-[1fr_150px_220px]"
              >
                <div>
                  <p className="text-xs uppercase tracking-[0.15em] text-white/35">
                    Subscriber UID
                  </p>

                  <p className="mt-1 break-all font-bold">
                    {account.uid}
                  </p>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-[0.15em] text-white/35">
                    Balance
                  </p>

                  <p className="mt-1 text-2xl font-black">
                    {account.balance}
                  </p>
                </div>

                <div>
                  <p className="text-xs uppercase tracking-[0.15em] text-white/35">
                    Updated
                  </p>

                  <p className="mt-1 text-sm text-white/60">
                    {account.updatedAt
                      ? new Date(
                          account.updatedAt
                        ).toLocaleString()
                      : "—"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
      <p className="text-sm text-white/50">
        {label}
      </p>

      <p className="mt-2 text-4xl font-black">
        {value}
      </p>
    </div>
  );
}
