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

type Row = {
  id: string;
  creatorUid: string;
  creatorUsername: string;
  creatorDisplayName: string;
  supporterName: string;
  amount: number;
  currency: string;
  payoutStatus: string;
  payoutEmail: string;
  paidAt: string | null;
  payoutPaidAt: string | null;
  payoutNote: string;
};

export default function ConnectPayoutsPage() {
  const {
    user,
    loading:
      authLoading,
  } = useAuth();

  const [
    rows,
    setRows,
  ] = useState<Row[]>([]);

  const [
    pending,
    setPending,
  ] = useState(0);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const load =
    useCallback(
      async () => {
        if (!user) {
          setLoading(false);
          return;
        }

        try {
          const token =
            await user.getIdToken();

          const response =
            await fetch(
              "/api/owner/connect-payouts",
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
                "Payout ledger could not be loaded."
            );
          }

          setRows(
            Array.isArray(
              data.orders
            )
              ? data.orders
              : []
          );

          setPending(
            Number(
              data.pending ||
                0
            )
          );
        }
        catch (loadError) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Payout ledger could not be loaded."
          );
        }
        finally {
          setLoading(false);
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

  async function updateStatus(
    row: Row,
    payoutStatus:
      "paid" |
      "unpaid"
  ) {
    if (!user) return;

    const note =
      window.prompt(
        payoutStatus ===
        "paid"
          ? "Optional payout note / transaction reference:"
          : "Optional note:",
        row.payoutNote ||
          ""
      );

    if (
      note === null
    ) {
      return;
    }

    try {
      const token =
        await user.getIdToken();

      const response =
        await fetch(
          "/api/owner/connect-payouts",
          {
            method:
              "PATCH",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${token}`,
            },

            body:
              JSON.stringify({
                orderId:
                  row.id,

                payoutStatus,

                payoutNote:
                  note,
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
            "Payout status could not be updated."
        );
      }

      await load();
    }
    catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Payout status could not be updated."
      );
    }
  }

  if (
    authLoading ||
    loading
  ) {
    return (
      <main className="grid min-h-screen place-items-center">
        Loading creator payouts...
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 pb-28 pt-12 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <section className="rounded-[2rem] border border-amber-300/20 bg-gradient-to-br from-amber-400/15 via-black to-violet-500/15 p-8">
          <p className="text-sm font-black uppercase tracking-[0.22em] text-amber-300">
            OWNER
          </p>

          <h1 className="mt-3 text-4xl font-black sm:text-6xl">
            CREATOR PAYOUTS
          </h1>

          <p className="mt-4 text-white/55">
            Track creator support payments and mark creator payouts as sent.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/developer"
              className="rounded-xl bg-white px-5 py-3 font-black text-black"
            >
              DEVELOPER
            </Link>

            <Link
              href="/connect"
              className="rounded-xl border border-white/10 px-5 py-3 font-black"
            >
              SOLO CONNECT
            </Link>
          </div>
        </section>

        {error ? (
          <p className="mt-6 rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-red-200">
            {error}
          </p>
        ) : null}

        <section className="mt-8 rounded-3xl border border-amber-300/20 bg-amber-300/[0.06] p-7">
          <p className="text-sm font-black text-amber-200">
            TOTAL PENDING CREATOR PAYOUTS
          </p>

          <p className="mt-2 text-5xl font-black">
            ${pending.toFixed(
              2
            )}
          </p>
        </section>

        <section className="mt-10 space-y-4">
          {rows.map(
            row => (
              <article
                key={
                  row.id
                }
                className="rounded-3xl border border-white/10 bg-white/[0.035] p-6"
              >
                <div className="flex flex-col justify-between gap-5 md:flex-row">
                  <div>
                    <p className="text-xl font-black">
                      {row.creatorDisplayName ||
                        row.creatorUsername}
                    </p>

                    <p className="text-cyan-300">
                      @{row.creatorUsername}
                    </p>

                    <p className="mt-3 text-sm text-white/45">
                      PayPal payout:{" "}
                      {row.payoutEmail ||
                        "NOT SET"}
                    </p>

                    <p className="mt-1 text-sm text-white/45">
                      Supporter:{" "}
                      {row.supporterName ||
                        "Member"}
                    </p>

                    {row.paidAt ? (
                      <p className="mt-1 text-sm text-white/35">
                        Support received:{" "}
                        {new Date(
                          row.paidAt
                        ).toLocaleString()}
                      </p>
                    ) : null}
                  </div>

                  <div className="md:text-right">
                    <p className="text-3xl font-black">
                      ${row.amount.toFixed(
                        2
                      )}
                    </p>

                    <p className={
                      row.payoutStatus ===
                      "unpaid"
                        ? "mt-2 font-black text-amber-300"
                        : "mt-2 font-black text-emerald-300"
                    }>
                      {row.payoutStatus.toUpperCase()}
                    </p>

                    {row.payoutNote ? (
                      <p className="mt-2 max-w-sm text-sm text-white/45">
                        {row.payoutNote}
                      </p>
                    ) : null}
                  </div>
                </div>

                {row.payoutStatus !==
                "owner_direct" ? (
                  <div className="mt-5 flex flex-wrap gap-3 border-t border-white/10 pt-5">
                    {row.payoutStatus ===
                    "unpaid" ? (
                      <button
                        type="button"
                        onClick={() =>
                          void updateStatus(
                            row,
                            "paid"
                          )
                        }
                        className="rounded-xl bg-emerald-400 px-5 py-3 font-black text-black"
                      >
                        MARK PAID
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          void updateStatus(
                            row,
                            "unpaid"
                          )
                        }
                        className="rounded-xl border border-amber-300/20 px-5 py-3 font-black text-amber-200"
                      >
                        MARK UNPAID
                      </button>
                    )}
                  </div>
                ) : null}
              </article>
            )
          )}

          {rows.length ===
          0 ? (
            <div className="rounded-3xl border border-dashed border-white/15 p-10 text-center text-white/45">
              No creator support payments yet.
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}