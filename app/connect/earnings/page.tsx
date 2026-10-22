"use client";

import Link from "next/link";

import {
  FormEvent,
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  useAuth,
} from "../../auth/AuthContext";

type LedgerRow = {
  id: string;
  amount: number;
  currency: string;
  supporterName: string;
  payoutStatus: string;
  paidAt: string | null;
  payoutPaidAt: string | null;
};

export default function CreatorEarningsPage() {
  const {
    user,
    loading:
      authLoading,
  } = useAuth();

  const [
    rows,
    setRows,
  ] = useState<
    LedgerRow[]
  >([]);

  const [
    totalReceived,
    setTotalReceived,
  ] = useState(0);

  const [
    pendingPayout,
    setPendingPayout,
  ] = useState(0);

  const [
    paidOut,
    setPaidOut,
  ] = useState(0);

  const [
    payoutEmail,
    setPayoutEmail,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const [
    message,
    setMessage,
  ] = useState("");

  const load =
    useCallback(
      async () => {
        if (!user) {
          setLoading(
            false
          );
          return;
        }

        setLoading(
          true
        );

        try {
          const token =
            await user.getIdToken();

          const response =
            await fetch(
              "/api/connect/support?mode=earnings",
              {
                headers: {
                  Authorization:
                    `Bearer ${token}`,
                },

                cache:
                  "no-store",
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
                "Earnings could not be loaded."
            );
          }

          setRows(
            Array.isArray(
              data.orders
            )
              ? data.orders
              : []
          );

          setTotalReceived(
            Number(
              data.totals
                ?.totalReceived ||
                0
            )
          );

          setPendingPayout(
            Number(
              data.totals
                ?.pendingPayout ||
                0
            )
          );

          setPaidOut(
            Number(
              data.totals
                ?.paidOut ||
                0
            )
          );

          setPayoutEmail(
            data.payoutEmail ||
              ""
          );
        }
        catch (loadError) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Earnings could not be loaded."
          );
        }
        finally {
          setLoading(
            false
          );
        }
      },
      [user]
    );

  useEffect(() => {
    if (
      !authLoading
    ) {
      void load();
    }
  }, [
    authLoading,
    load,
  ]);

  async function savePayoutEmail(
    event:
      FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!user) {
      return;
    }

    setError("");
    setMessage("");

    try {
      const token =
        await user.getIdToken();

      const response =
        await fetch(
          "/api/connect/support",
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
                action:
                  "save-payout-email",

                payoutEmail,
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
            "Payout email could not be saved."
        );
      }

      setPayoutEmail(
        data.payoutEmail ||
          ""
      );

      setMessage(
        "Payout email saved."
      );
    }
    catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Payout email could not be saved."
      );
    }
  }

  if (
    authLoading ||
    loading
  ) {
    return (
      <main className="grid min-h-screen place-items-center">
        Loading earnings...
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen px-5 py-16">
        <div className="mx-auto max-w-2xl rounded-3xl border border-white/10 p-8">
          <h1 className="text-3xl font-black">
            Sign in required
          </h1>

          <Link
            href="/account?mode=signin"
            className="mt-5 inline-flex rounded-xl bg-white px-5 py-3 font-black text-black"
          >
            SIGN IN
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 pb-28 pt-12 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <section className="rounded-[2rem] border border-emerald-400/20 bg-gradient-to-br from-emerald-500/15 via-black to-cyan-400/10 p-8">
          <p className="text-sm font-black uppercase tracking-[0.22em] text-emerald-300">
            SOLO CONNECT
          </p>

          <h1 className="mt-3 text-4xl font-black sm:text-6xl">
            CREATOR EARNINGS
          </h1>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/connect/monetize"
              className="rounded-xl bg-white px-5 py-3 font-black text-black"
            >
              MONETIZATION
            </Link>

            <Link
              href="/connect"
              className="rounded-xl border border-white/10 px-5 py-3 font-black"
            >
              CONNECT
            </Link>
          </div>
        </section>

        {error ? (
          <p className="mt-6 rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-red-200">
            {error}
          </p>
        ) : null}

        {message ? (
          <p className="mt-6 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-emerald-200">
            {message}
          </p>
        ) : null}

        <section className="mt-8 grid gap-4 sm:grid-cols-3">
          <article className="rounded-3xl border border-white/10 bg-white/[0.035] p-6">
            <p className="text-white/45">
              TOTAL SUPPORT
            </p>

            <p className="mt-2 text-4xl font-black">
              ${totalReceived.toFixed(
                2
              )}
            </p>
          </article>

          <article className="rounded-3xl border border-amber-300/20 bg-amber-300/[0.06] p-6">
            <p className="text-amber-200">
              PENDING PAYOUT
            </p>

            <p className="mt-2 text-4xl font-black">
              ${pendingPayout.toFixed(
                2
              )}
            </p>
          </article>

          <article className="rounded-3xl border border-emerald-300/20 bg-emerald-300/[0.06] p-6">
            <p className="text-emerald-200">
              PAID OUT
            </p>

            <p className="mt-2 text-4xl font-black">
              ${paidOut.toFixed(
                2
              )}
            </p>
          </article>
        </section>

        <form
          onSubmit={
            savePayoutEmail
          }
          className="mt-8 rounded-3xl border border-white/10 bg-white/[0.035] p-7"
        >
          <h2 className="text-2xl font-black">
            PAYPAL PAYOUT EMAIL
          </h2>

          <p className="mt-2 text-sm text-white/50">
            This tells SOLO BEATS where to send your creator payout. Saving the email does not automatically transfer money.
          </p>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <input
              type="email"
              value={
                payoutEmail
              }
              onChange={
                event =>
                  setPayoutEmail(
                    event.target.value
                  )
              }
              placeholder="creator@example.com"
              className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black px-4 py-3 outline-none focus:border-cyan-300"
            />

            <button
              type="submit"
              className="rounded-xl bg-white px-5 py-3 font-black text-black"
            >
              SAVE PAYOUT EMAIL
            </button>
          </div>
        </form>

        <section className="mt-10">
          <h2 className="text-3xl font-black">
            SUPPORT HISTORY
          </h2>

          <div className="mt-5 space-y-3">
            {rows.map(
              row => (
                <article
                  key={
                    row.id
                  }
                  className="rounded-2xl border border-white/10 bg-white/[0.035] p-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="font-black">
                        {row.supporterName ||
                          "Supporter"}
                      </p>

                      <p className="mt-1 text-sm text-white/40">
                        {row.paidAt
                          ? new Date(
                              row.paidAt
                            ).toLocaleString()
                          : ""}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="text-2xl font-black">
                        ${row.amount.toFixed(
                          2
                        )}
                      </p>

                      <p className={
                        row.payoutStatus ===
                        "unpaid"
                          ? "text-sm font-black text-amber-300"
                          : "text-sm font-black text-emerald-300"
                      }>
                        {row.payoutStatus ===
                        "owner_direct"
                          ? "OWNER DIRECT"
                          : row.payoutStatus.toUpperCase()}
                      </p>
                    </div>
                  </div>
                </article>
              )
            )}

            {rows.length ===
            0 ? (
              <div className="rounded-3xl border border-dashed border-white/15 p-10 text-center text-white/45">
                No creator support payments yet.
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}