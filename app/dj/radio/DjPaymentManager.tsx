"use client";

import {
  useEffect,
  useState,
} from "react";

import { useAuth } from "../../auth/AuthContext";

type Payment = {
  uid: string;
  customerEmail?: string | null;
  planName?: string | null;
  planPrice?: string | null;
  status?: string | null;
  paypalSubscriptionId?: string | null;
};

const button =
  "rounded-xl border border-white/20 px-4 py-2 font-bold disabled:opacity-40";

export default function DjPaymentManager() {
  const { user } = useAuth();

  const [payments, setPayments] =
    useState<Payment[]>([]);

  const [busy, setBusy] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [error, setError] =
    useState("");

  async function token() {
    if (!user) {
      throw new Error(
        "Sign in again."
      );
    }

    return user.getIdToken();
  }

  async function load() {
    if (!user) return;

    try {
      const auth =
        await token();

      const response =
        await fetch(
          "/api/owner/dj-payments",
          {
            cache: "no-store",
            headers: {
              Authorization:
                "Bearer " +
                auth,
            },
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
            "DJ payments could not be loaded."
        );
      }

      setPayments(
        Array.isArray(
          data.payments
        )
          ? data.payments
          : []
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "DJ payments could not be loaded."
      );
    }
  }

  useEffect(() => {
    void load();

    const timer =
      window.setInterval(
        () => void load(),
        15000
      );

    return () =>
      window.clearInterval(
        timer
      );
  }, [user]);

  async function initialize() {
    if (!user || busy) return;

    setBusy(true);
    setError("");
    setMessage(
      "Initializing PayPal DJ plans..."
    );

    try {
      const auth =
        await token();

      const response =
        await fetch(
          "/api/dj/paypal/plans",
          {
            method: "POST",
            headers: {
              Authorization:
                "Bearer " +
                auth,
            },
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
            "DJ PayPal plans could not be initialized."
        );
      }

      setMessage(
        "DJ PayPal plans are ready: $29.99 monthly, $74.99 for 3 months, $199.99 annually."
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "DJ PayPal initialization failed."
      );
    } finally {
      setBusy(false);
    }
  }

  async function decide(
    payment: Payment,
    action:
      | "approve"
      | "decline"
  ) {
    if (
      !user ||
      busy
    ) {
      return;
    }

    const verb =
      action === "approve"
        ? "APPROVE"
        : "DECLINE";

    if (
      !window.confirm(
        `${verb} ${payment.planName || "DJ plan"} for ${payment.customerEmail || payment.uid}?`
      )
    ) {
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");

    try {
      const auth =
        await token();

      const response =
        await fetch(
          "/api/owner/dj-payments",
          {
            method: "POST",

            headers: {
              Authorization:
                "Bearer " +
                auth,

              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                uid:
                  payment.uid,
                action,
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
            "DJ payment decision failed."
        );
      }

      setMessage(
        data.message ||
          "DJ payment updated."
      );

      await load();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "DJ payment decision failed."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-purple-300/25 bg-purple-300/5 p-5">
      <h3 className="text-xl font-black">
        DJ Payment System
      </h3>

      <p className="mt-2 text-sm text-white/65">
        Approved DJs activate automatically after verified payment. Any items listed below are legacy payments that still require manual review.
      </p>

      <button
        type="button"
        disabled={busy}
        onClick={() =>
          void initialize()
        }
        className={
          button + " mt-4"
        }
      >
        Initialize / Verify DJ PayPal Plans
      </button>

      <div className="mt-5 space-y-3">
        {payments.length === 0 ? (
          <p className="text-white/60">
            No legacy DJ payments are waiting for review.
          </p>
        ) : (
          payments.map(
            payment => (
              <div
                key={
                  payment.uid
                }
                className="rounded-xl border border-white/15 bg-black/30 p-4"
              >
                <div className="font-black">
                  {payment.customerEmail ||
                    payment.uid}
                </div>

                <div className="mt-1 text-sm text-white/65">
                  {payment.planName ||
                    "DJ plan"}{" "}
                  {payment.planPrice
                    ? `• $${payment.planPrice}`
                    : ""}
                </div>

                <div className="mt-1 text-xs uppercase tracking-wider text-cyan-200">
                  PayPal:{" "}
                  {payment.status ||
                    "UNKNOWN"}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={
                      busy
                    }
                    onClick={() =>
                      void decide(
                        payment,
                        "approve"
                      )
                    }
                    className={
                      button
                    }
                  >
                    Approve Paid Access
                  </button>

                  <button
                    type="button"
                    disabled={
                      busy
                    }
                    onClick={() =>
                      void decide(
                        payment,
                        "decline"
                      )
                    }
                    className={
                      button
                    }
                  >
                    Decline
                  </button>
                </div>
              </div>
            )
          )
        )}
      </div>

      {message && (
        <p className="mt-4 text-emerald-200">
          {message}
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="mt-4 text-red-200"
        >
          {error}
        </p>
      )}
    </section>
  );
}
