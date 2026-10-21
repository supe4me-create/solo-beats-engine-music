"use client";

import Link from "next/link";

import {
  PayPalButtons,
  PayPalScriptProvider,
} from "@paypal/react-paypal-js";

import {
  useEffect,
  useState,
} from "react";

import {
  onAuthStateChanged,
  type User,
} from "firebase/auth";

import {
  firebaseAuth,
} from "../../lib/firebaseClient";

type Plan = {
  key:
    | "starter"
    | "pro"
    | "elite";

  name: string;
  price: string;
  paypalPlanId: string;
  uploads: string;
  promotion: string;
  analytics: string;
  mixMasterDiscount: string;
};

type Membership = {
  planKey: string | null;
  planName: string | null;
  price: string | null;
  status: string | null;
  subscriptionId: string | null;
  startTime: string | null;
  nextBillingTime: string | null;
};

type PayPalEnvironment =
  | "live"
  | "sandbox";


export default function ArtistMembershipPage() {
  const [
    user,
    setUser,
  ] =
    useState<User | null>(
      null
    );

  const [
    authReady,
    setAuthReady,
  ] =
    useState(false);

  const [
    plans,
    setPlans,
  ] =
    useState<Plan[]>([]);

  const [
    paypalClientId,
    setPaypalClientId,
  ] =
    useState("");

  const [
    paypalEnvironment,
    setPaypalEnvironment,
  ] =
    useState<PayPalEnvironment | null>(
      null
    );

  const [
    membership,
    setMembership,
  ] =
    useState<Membership | null>(
      null
    );

  const [
    active,
    setActive,
  ] =
    useState(false);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

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

  useEffect(() => {
    return onAuthStateChanged(
      firebaseAuth,
      currentUser => {
        setUser(currentUser);
        setAuthReady(true);
      }
    );
  }, []);

  async function loadPlans() {
    const response =
      await fetch(
        "/api/artist-membership/plans",
        {
          cache: "no-store",
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
          "Artist Membership plans could not be loaded."
      );
    }

    setPlans(
      Array.isArray(data.plans)
        ? data.plans
        : []
    );

    setPaypalClientId(
      typeof data.paypalClientId === "string"
        ? data.paypalClientId.replace(/\s+/g, "")
        : ""
    );

    setPaypalEnvironment(
      data.paypalEnvironment === "sandbox"
        ? "sandbox"
        : data.paypalEnvironment === "live"
          ? "live"
          : null
    );
  }

  async function loadStatus(
    currentUser: User
  ) {
    const idToken =
      await currentUser.getIdToken();

    const response =
      await fetch(
        "/api/artist-membership/status",
        {
          headers: {
            Authorization:
              `Bearer ${idToken}`,
          },

          cache: "no-store",
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
          "Artist Membership status could not be loaded."
      );
    }

    setActive(
      data.active === true
    );

    setMembership(
      data.membership ||
        null
    );
  }

  useEffect(() => {
    if (!authReady) return;

    let cancelled = false;

    async function run() {
      setLoading(true);
      setError("");

      try {
        await loadPlans();

        if (
          user &&
          !cancelled
        ) {
          await loadStatus(
            user
          );
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Artist Membership could not be loaded."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [
    authReady,
    user,
  ]);

  async function activateSubscription(
    subscriptionId: string
  ) {
    const currentUser =
      firebaseAuth.currentUser;

    if (!currentUser) {
      throw new Error(
        "Sign in before joining Artist Membership."
      );
    }

    setMessage(
      "Confirming your Artist Membership..."
    );

    setError("");

    const idToken =
      await currentUser.getIdToken();

    const response =
      await fetch(
        "/api/artist-membership/verify-subscription",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            Authorization:
              `Bearer ${idToken}`,
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
          "Artist Membership activation failed."
      );
    }

    await loadStatus(
      currentUser
    );

    setMessage(
      `${data.planName} is now connected to your SOLO BEATS account.`
    );
  }

  async function cancelMembership() {
    const currentUser =
      firebaseAuth.currentUser;

    if (!currentUser) {
      return;
    }

    const confirmed =
      window.confirm(
        "Cancel your SOLO BEATS Artist Membership?"
      );

    if (!confirmed) {
      return;
    }

    setError("");
    setMessage(
      "Cancelling Artist Membership..."
    );

    try {
      const idToken =
        await currentUser.getIdToken();

      const response =
        await fetch(
          "/api/artist-membership/cancel",
          {
            method: "POST",

            headers: {
              Authorization:
                `Bearer ${idToken}`,
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
            "Artist Membership cancellation failed."
        );
      }

      await loadStatus(
        currentUser
      );

      setMessage(
        "Artist Membership cancelled."
      );
    } catch (cancelError) {
      setError(
        cancelError instanceof Error
          ? cancelError.message
          : "Artist Membership cancellation failed."
      );
    }
  }

  if (
    !authReady ||
    loading
  ) {
    return (
      <main className="min-h-screen px-5 pb-32 pt-52">
        <div className="mx-auto max-w-6xl">
          <p className="text-white/60">
            Loading Artist Membership...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-5 pb-32 pt-52 sm:px-8">
      <div className="mx-auto max-w-6xl">

        <section className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-violet-500/20 via-black/30 to-cyan-400/10 p-7 sm:p-10">

          <p className="text-sm font-black uppercase tracking-[0.24em] text-violet-300">
            SOLO BEATS ENGINE MUSIC
          </p>

          <h1 className="mt-3 text-4xl font-black sm:text-6xl">
            Artist Membership
          </h1>

          <p className="mt-4 max-w-3xl text-lg leading-8 text-white/60">
            Build your artist presence, unlock creator benefits,
            receive promotional opportunities, access analytics,
            and save on SOLO BEATS services.
          </p>

          {!user ? (
            <Link
              href="/account?mode=signin"
              className="mt-7 inline-flex rounded-2xl bg-white px-6 py-3 font-black text-black"
            >
              Sign in to join
            </Link>
          ) : null}

        </section>

        {user && active && membership ? (
          <section className="mt-8 rounded-[2rem] border border-emerald-300/20 bg-emerald-300/10 p-7">

            <p className="text-sm font-black uppercase tracking-[0.2em] text-emerald-200">
              ACTIVE ARTIST MEMBERSHIP
            </p>

            <h2 className="mt-2 text-3xl font-black">
              {membership.planName}
            </h2>

            <p className="mt-2 text-white/60">
              ${membership.price} / month
            </p>

            <p className="mt-3 text-sm text-white/45">
              Status: {membership.status}
            </p>

            <button
              type="button"
              onClick={() =>
                void cancelMembership()
              }
              className="mt-6 rounded-2xl border border-red-300/25 bg-red-400/10 px-5 py-3 font-black text-red-200"
            >
              Cancel Artist Membership
            </button>

          </section>
        ) : null}

        <section className="mt-8 grid gap-5 lg:grid-cols-3">

          {plans.map(
            plan => {

              const selected =
                membership?.planKey ===
                plan.key &&
                active;

              return (
                <article
                  key={plan.key}
                  className="flex flex-col rounded-[2rem] border border-white/10 bg-white/[0.04] p-7"
                >

                  <p className="text-sm font-black uppercase tracking-[0.2em] text-violet-300">
                    {plan.name}
                  </p>

                  <p className="mt-4 text-5xl font-black">
                    ${plan.price}
                  </p>

                  <p className="mt-1 text-white/40">
                    per month
                  </p>

                  <div className="mt-7 space-y-3 text-sm leading-6 text-white/65">
                    <p>✓ {plan.uploads}</p>
                    <p>✓ {plan.promotion}</p>
                    <p>✓ {plan.analytics}</p>
                    <p>✓ {plan.mixMasterDiscount}</p>
                  </div>

                  <div className="mt-auto pt-8">

                    {selected ? (
                      <div className="rounded-2xl bg-emerald-300 px-5 py-3 text-center font-black text-black">
                        Current Plan
                      </div>
                    ) : !user ? (
                      <Link
                        href="/account?mode=signin"
                        className="block rounded-2xl bg-white px-5 py-3 text-center font-black text-black"
                      >
                        Sign in
                      </Link>
                    ) : !paypalClientId ? (
                      <div className="rounded-2xl border border-red-300/25 bg-red-400/10 px-5 py-3 text-center text-sm font-black text-red-200">
                        PayPal is not configured.
                      </div>
                    ) : (
                      <PayPalScriptProvider
                        options={{
                          clientId:
                            paypalClientId,

                          vault:
                            true,

                          intent:
                            "subscription",
                        }}
                      >
                        <PayPalButtons
                          style={{
                            layout:
                              "vertical",
                            shape:
                              "rect",
                            label:
                              "subscribe",
                          }}

                          createSubscription={(
                            _data,
                            actions
                          ) =>
                            actions.subscription.create({
                              plan_id:
                                plan.paypalPlanId,
                            })
                          }

                          onApprove={async data => {
                            try {
                              if (
                                !data.subscriptionID
                              ) {
                                throw new Error(
                                  "PayPal did not return a subscription ID."
                                );
                              }

                              await activateSubscription(
                                data.subscriptionID
                              );
                            } catch (
                              approveError
                            ) {
                              setError(
                                approveError instanceof Error
                                  ? approveError.message
                                  : "Artist Membership activation failed."
                              );
                            }
                          }}

                          onError={paypalError => {
                            console.error(
                              paypalError
                            );

                            setError(
                              "PayPal could not complete the Artist Membership subscription."
                            );
                          }}
                        />
                      </PayPalScriptProvider>
                    )}

                  </div>

                </article>
              );
            }
          )}

        </section>

        {message ? (
          <p className="mt-6 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-5 text-emerald-200">
            {message}
          </p>
        ) : null}

        {error ? (
          <p className="mt-6 rounded-2xl border border-red-300/20 bg-red-400/10 p-5 text-red-200">
            {error}
          </p>
        ) : null}

      </div>
    </main>
  );
}
