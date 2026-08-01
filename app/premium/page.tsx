"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PayPalButtons, PayPalScriptProvider } from "@paypal/react-paypal-js";
import { onAuthStateChanged, type User } from "firebase/auth";
import { firebaseAuth } from "../../lib/firebaseClient";

const benefits = [
  { title: "Unlimited Premium Streaming", text: "Stream the full SOLO BEATS PREMIUM catalog without purchasing every track individually." },
  { title: "10 Monthly Downloads", text: "Premium members receive up to ten downloadable tracks each month." },
  { title: "Early Access", text: "Hear selected upcoming albums and tracks before their public release." },
  { title: "Member-Only Music", text: "Access exclusive tracks, previews, edits, and special releases." },
  { title: "Album Discounts", text: "Receive member pricing on selected full-album purchases." },
  { title: "Cancel Anytime", text: "Manage or cancel the subscription from the customer account." },
];

const paypalClientId = (process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || "").replace(/\s+/g, "");
const premiumPlanId = (process.env.NEXT_PUBLIC_PAYPAL_PREMIUM_PLAN_ID || "").replace(/\s+/g, "");

export default function PremiumPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [subscriptionComplete, setSubscriptionComplete] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
    });
    return unsubscribe;
  }, []);

  async function savePremiumSubscription(subscriptionId: string) {
    const currentUser = firebaseAuth.currentUser;
    if (!currentUser) throw new Error("Please sign in before joining SOLO BEATS PREMIUM.");

    setMessage("Confirming your Premium membership...");
    setError("");

    const idToken = await currentUser.getIdToken();
    const response = await fetch("/api/paypal/verify-subscription", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ subscriptionId }),
    });

    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || "Your PayPal subscription could not be verified.");
    }

    setSubscriptionComplete(true);
    setMessage("Welcome to SOLO BEATS PREMIUM! Your membership is active and linked to your account.");
  }

  return (
    <main className="min-h-screen px-5 pb-40 pt-52 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <section className="overflow-hidden rounded-[2.25rem] border border-white/10 bg-gradient-to-br from-violet-600/30 via-white/[0.05] to-cyan-400/15 p-7 shadow-2xl sm:p-10 lg:p-14">
          <div className="grid gap-10 lg:grid-cols-[1fr_360px] lg:items-center">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.24em] text-emerald-300">Now available</p>
              <h1 className="mt-4 text-5xl font-black leading-none sm:text-7xl">
                SOLO BEATS
                <span className="block bg-gradient-to-r from-violet-300 via-fuchsia-300 to-cyan-300 bg-clip-text text-transparent">PREMIUM</span>
              </h1>
              <p className="mt-6 max-w-3xl text-lg leading-8 text-white/65">
                Unlimited premium streaming, monthly downloads, early access, exclusive music, and member discounts.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/account" className="rounded-2xl bg-white px-6 py-4 font-black text-black">Open Account</Link>
                <Link href="/store" className="rounded-2xl border border-white/15 bg-white/5 px-6 py-4 font-black text-white transition hover:bg-white/10">Browse Music</Link>
              </div>
            </div>

            <div className="rounded-[2rem] border border-white/10 bg-black/25 p-6 shadow-xl">
              <p className="text-sm font-black uppercase tracking-[0.2em] text-violet-300">Launch plan</p>
              <h2 className="mt-3 text-3xl font-black">Premium Membership</h2>
              <p className="mt-4 text-white/55">Launch price: $9.99 per month.</p>

              <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                <p className="text-sm text-white/45">Monthly membership</p>
                <div className="mt-2 flex items-end gap-2">
                  <p className="text-5xl font-black text-white">$9.99</p>
                  <p className="pb-1 text-sm font-bold text-white/45">per month</p>
                </div>
                <p className="mt-3 text-sm text-white/50">Cancel anytime. Secure recurring billing through PayPal.</p>
              </div>

              {!authReady ? (
                <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 text-center font-bold text-white/60">Checking your account...</div>
              ) : !user ? (
                <Link href="/account" className="mt-5 flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-500 px-6 py-4 font-black text-white shadow-lg shadow-violet-500/20">Sign In to Join Premium</Link>
              ) : subscriptionComplete ? (
                <div className="mt-5 rounded-2xl border border-emerald-300/30 bg-emerald-300/10 px-5 py-4 text-center font-black text-emerald-200">Premium Membership Active</div>
              ) : !paypalClientId || !premiumPlanId ? (
                <div className="mt-5 rounded-2xl border border-red-300/30 bg-red-300/10 px-5 py-4 text-sm font-bold text-red-200">PayPal Premium configuration is missing.</div>
              ) : (
                <div className="mt-5 overflow-hidden rounded-2xl bg-white p-3">
                  <PayPalScriptProvider options={{ clientId: paypalClientId, currency: "USD", intent: "subscription", vault: true }}>
                    <PayPalButtons
                      style={{ layout: "vertical", shape: "pill", color: "gold", label: "subscribe", height: 48 }}
                      createSubscription={async (_data, actions) => {
                        setMessage("Opening secure PayPal subscription checkout...");
                        setError("");
                        return actions.subscription.create({ plan_id: premiumPlanId });
                      }}
                      onApprove={async (data) => {
                        try {
                          if (!data.subscriptionID) throw new Error("PayPal did not return a subscription ID.");
                          await savePremiumSubscription(data.subscriptionID);
                        } catch (approvalError) {
                          setMessage("");
                          setError(approvalError instanceof Error ? approvalError.message : "Your Premium membership could not be confirmed.");
                        }
                      }}
                      onCancel={() => {
                        setMessage("");
                        setError("The PayPal subscription checkout was cancelled. No membership was created.");
                      }}
                      onError={(paypalError) => {
                        console.error("PayPal subscription error:", paypalError);
                        setMessage("");
                        setError("PayPal encountered an error. Please try again.");
                      }}
                    />
                  </PayPalScriptProvider>
                </div>
              )}

              {message && <p className="mt-4 rounded-2xl border border-emerald-300/25 bg-emerald-300/10 p-4 text-sm font-bold leading-6 text-emerald-200">{message}</p>}
              {error && <p className="mt-4 rounded-2xl border border-red-300/25 bg-red-300/10 p-4 text-sm font-bold leading-6 text-red-200">{error}</p>}
            </div>
          </div>
        </section>

        <section className="mt-10">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-violet-300">Membership benefits</p>
          <h2 className="mt-2 text-4xl font-black">Built for serious listeners</h2>
          <div className="mt-7 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {benefits.map((benefit) => (
              <article key={benefit.title} className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-6">
                <h3 className="text-2xl font-black">{benefit.title}</h3>
                <p className="mt-3 leading-7 text-white/55">{benefit.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-10 rounded-[2rem] border border-white/10 bg-gradient-to-r from-white/[0.04] to-violet-500/10 p-7 sm:p-9">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-cyan-300">Development roadmap</p>
          <h2 className="mt-2 text-3xl font-black">Premium Phase 1</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {["Premium landing page â€” complete", "PayPal subscription checkout â€” complete", "Member account status â€” next", "Premium streaming access"].map((item, index) => (
              <div key={item} className="rounded-2xl border border-white/10 bg-black/20 p-5">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-white/35">Step {index + 1}</p>
                <p className="mt-2 font-black">{item}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

