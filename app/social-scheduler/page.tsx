"use client";

import Link from "next/link";

import {
  useEffect,
  useState,
} from "react";

import {
  PayPalButtons,
  PayPalScriptProvider,
} from "@paypal/react-paypal-js";

import {
  useAuth,
} from "../auth/AuthContext";

type SchedulerStatus = {
  success: boolean;

  customer?: {
    uid: string;
    email: string | null;
  };

  scheduler?: {
    accessActive: boolean;
    status: string;
    planId: string | null;
    planName: string | null;
    subscriptionId: string | null;
    subscriptionProvider: string | null;
    currentPeriodEnd: string | null;
  };

  error?: string;
};

type SchedulerPlan = {
  key:
    | "starter"
    | "pro"
    | "business";

  name: string;
  price: string;
  monthlyPostLimit: number;
  maxConnectedAccounts: number;
  platforms: string[];
  recurringEnabled: boolean;
  description: string;
  paypalPlanId: string;
};

type PlansResponse = {
  success: boolean;
  paypalClientId?: string;
  paypalEnvironment?: string;
  plans?: SchedulerPlan[];
  error?: string;
};

export default function SocialSchedulerPage() {
  const {
    user,
    loading,
  } = useAuth();

  const [
    status,
    setStatus,
  ] =
    useState<SchedulerStatus | null>(
      null
    );

  const [
    plans,
    setPlans,
  ] =
    useState<SchedulerPlan[]>([]);

  const [
    paypalClientId,
    setPaypalClientId,
  ] =
    useState("");

  const [
    loadingStatus,
    setLoadingStatus,
  ] =
    useState(false);

  const [
    loadingPlans,
    setLoadingPlans,
  ] =
    useState(true);

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

  async function loadStatus() {
    if (!user) {
      return;
    }

    setLoadingStatus(true);

    try {
      const token =
        await user.getIdToken();

      const response =
        await fetch(
          "/api/social-scheduler/status",
          {
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
            cache:
              "no-store",
          }
        );

      const data:
        SchedulerStatus =
        await response.json();

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.error ||
            "Scheduler status could not be loaded."
        );
      }

      setStatus(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Scheduler status could not be loaded."
      );
    } finally {
      setLoadingStatus(false);
    }
  }

  useEffect(() => {
    if (
      loading ||
      !user
    ) {
      return;
    }

    void loadStatus();
  }, [
    user,
    loading,
  ]);

  useEffect(() => {
    let cancelled =
      false;

    async function loadPlans() {
      setLoadingPlans(true);

      try {
        const response =
          await fetch(
            "/api/social-scheduler/plans",
            {
              cache:
                "no-store",
            }
          );

        const data:
          PlansResponse =
          await response.json();

        if (
          !response.ok ||
          !data.success
        ) {
          throw new Error(
            data.error ||
              "Scheduler plans could not be loaded."
          );
        }

        if (!cancelled) {
          setPlans(
            Array.isArray(data.plans)
              ? data.plans
              : []
          );

          setPaypalClientId(
            typeof data.paypalClientId ===
              "string"
              ? data.paypalClientId
              : ""
          );
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Scheduler plans could not be loaded."
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingPlans(false);
        }
      }
    }

    void loadPlans();

    return () => {
      cancelled =
        true;
    };
  }, []);

  async function verifySubscription(
    subscriptionId: string
  ) {
    if (!user) {
      throw new Error(
        "Sign in before purchasing a plan."
      );
    }

    setError("");
    setSuccess(
      "Confirming your Social Scheduler subscription..."
    );

    const token =
      await user.getIdToken();

    const response =
      await fetch(
        "/api/social-scheduler/verify-subscription",
        {
          method:
            "POST",

          headers: {
            Authorization:
              `Bearer ${token}`,

            "Content-Type":
              "application/json",
          },

          body:
            JSON.stringify({
              subscriptionId,
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
          "Your subscription could not be confirmed."
      );
    }

    setSuccess(
      `${data.plan?.name || "Social Scheduler"} is now active.`
    );

    await loadStatus();
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-black px-5 py-16 text-white">
        <div className="mx-auto max-w-6xl">
          Loading account...
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-black px-5 py-16 text-white">
        <div className="mx-auto max-w-5xl rounded-3xl border border-white/10 bg-white/5 p-8 md:p-12">

          <div className="text-sm font-black uppercase tracking-[0.25em] text-cyan-300">
            SOLO BEATS ENGINE MUSIC
          </div>

          <h1 className="mt-4 text-4xl font-black md:text-6xl">
            Social Scheduler
          </h1>

          <p className="mt-5 text-white/70">
            Sign in to purchase and manage your Social Scheduler subscription.
          </p>

          <Link
            href="/account?mode=signin"
            className="mt-8 inline-flex rounded-xl bg-white px-6 py-4 font-black text-black"
          >
            SIGN IN
          </Link>

        </div>
      </main>
    );
  }

  const scheduler =
    status?.scheduler;

  const accessActive =
    scheduler?.accessActive ===
    true;

  const subscriptionContent = (
    <div className="grid gap-5 lg:grid-cols-3">

      {plans.map(plan => (
        <section
          key={plan.key}
          className="rounded-3xl border border-white/10 bg-white/5 p-6"
        >
          <div className="text-sm font-black uppercase tracking-widest text-cyan-300">
            {plan.name}
          </div>

          <div className="mt-4 text-4xl font-black">
            ${plan.price}
            <span className="text-base font-semibold text-white/45">
              /month
            </span>
          </div>

          <p className="mt-4 min-h-12 text-sm text-white/60">
            {plan.description}
          </p>

          <div className="mt-5 space-y-2 text-sm text-white/70">
            <div>
              {plan.monthlyPostLimit.toLocaleString()} posts / month
            </div>

            <div>
              Up to {plan.maxConnectedAccounts} connected social accounts
            </div>

            <div>
              Facebook + Instagram images and videos
            </div>

            <div>
              {plan.platforms.join(
                " • "
              )}
            </div>

            <div>
              Recurring campaigns:{" "}
              {plan.recurringEnabled
                ? "Included"
                : "Not included"}
            </div>
          </div>

          <div className="mt-6 rounded-2xl bg-white p-2">

            <PayPalButtons
              style={{
                layout:
                  "vertical",
                shape:
                  "pill",
                label:
                  "subscribe",
                height:
                  45,
              }}

              createSubscription={async (
                _data,
                actions
              ) => {
                setError("");
                setSuccess(
                  "Opening secure PayPal subscription checkout..."
                );

                return actions
                  .subscription
                  .create({
                    plan_id:
                      plan.paypalPlanId,
                  });
              }}

              onApprove={async data => {
                try {
                  if (
                    !data.subscriptionID
                  ) {
                    throw new Error(
                      "PayPal did not return a subscription ID."
                    );
                  }

                  await verifySubscription(
                    data.subscriptionID
                  );
                } catch (err) {
                  setSuccess("");

                  setError(
                    err instanceof Error
                      ? err.message
                      : "Subscription activation failed."
                  );
                }
              }}

              onError={() => {
                setSuccess("");

                setError(
                  "PayPal checkout could not be completed."
                );
              }}
            />

          </div>
        </section>
      ))}

    </div>
  );

  return (
    <main className="min-h-screen bg-black px-5 py-10 text-white">

      <div className="mx-auto max-w-7xl">

        <div className="rounded-3xl border border-cyan-400/20 bg-gradient-to-br from-cyan-500/10 via-black to-fuchsia-500/10 p-7 md:p-10">

          <div className="text-xs font-black uppercase tracking-[0.28em] text-cyan-300">
            SOLO BEATS ENGINE MUSIC
          </div>

          <h1 className="mt-3 text-4xl font-black md:text-6xl">
            Social Scheduler
          </h1>

          <p className="mt-4 max-w-3xl text-white/65">
            Schedule and manage promotions across your connected social platforms.
          </p>

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

        <div className="mt-8 grid gap-5 md:grid-cols-3">

          <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="text-xs font-black uppercase tracking-widest text-white/50">
              Account
            </div>

            <div className="mt-3 break-all font-black">
              {user.email}
            </div>
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-6">

            <div className="text-xs font-black uppercase tracking-widest text-white/50">
              Scheduler Access
            </div>

            <div
              className={
                accessActive
                  ? "mt-3 text-2xl font-black text-green-300"
                  : "mt-3 text-2xl font-black text-yellow-300"
              }
            >
              {loadingStatus
                ? "CHECKING..."
                : accessActive
                  ? "ACTIVE"
                  : "NOT ACTIVE"}
            </div>

          </section>

          <section className="rounded-2xl border border-white/10 bg-white/5 p-6">

            <div className="text-xs font-black uppercase tracking-widest text-white/50">
              Current Plan
            </div>

            <div className="mt-3 text-2xl font-black">
              {scheduler?.planName ||
                "No Plan"}
            </div>

          </section>

        </div>

        {!accessActive ? (
          <section className="mt-10">

            <h2 className="text-3xl font-black">
              Choose Your Plan
            </h2>

            <p className="mt-2 text-white/55">
              Cancel anytime. Your subscription activates automatically after PayPal confirms payment.
            </p>

            <div className="mt-7">

              {loadingPlans ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                  Loading subscription plans...
                </div>
              ) : !paypalClientId ? (
                <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-6 text-red-200">
                  PayPal Client ID is missing.
                </div>
              ) : (
                <PayPalScriptProvider
                  options={{
                    clientId:
                      paypalClientId,

                    currency:
                      "USD",

                    intent:
                      "subscription",

                    vault:
                      true,
                  }}
                >
                  {subscriptionContent}
                </PayPalScriptProvider>
              )}

            </div>
          </section>
        ) : (
          <section className="mt-10 rounded-3xl border border-green-400/20 bg-green-500/10 p-7">

            <div className="text-sm font-black uppercase tracking-widest text-green-300">
              SUBSCRIPTION ACTIVE
            </div>

            <h2 className="mt-3 text-3xl font-black">
              Your Social Scheduler workspace is unlocked.
            </h2>

            <p className="mt-3 text-white/65">
              Next we will connect your private social accounts, posting limits, scheduled posts and recurring campaigns.
            </p>

          </section>
        )}

      </div>
    </main>
  );
}

