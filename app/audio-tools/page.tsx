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

type CreditPack = {
  id:
    | "audio_1"
    | "audio_5"
    | "audio_20";

  credits:
    number;

  price:
    number;

  label:
    string;
};

export default function AudioToolsPage() {
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
    clientId,
    setClientId,
  ] =
    useState("");

  const [
    packs,
    setPacks,
  ] =
    useState<CreditPack[]>([]);

  const [
    balance,
    setBalance,
  ] =
    useState(0);

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
        setUser(
          currentUser
        );

        setAuthReady(
          true
        );
      }
    );
  }, []);

  async function loadPaymentConfig() {
    const response =
      await fetch(
        "/api/audio-credits/payment",
        {
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
        "Audio Credit payment setup could not be loaded."
      );
    }

    setClientId(
      data.clientId ||
      ""
    );

    setPacks(
      Array.isArray(
        data.packs
      )
        ? data.packs
        : []
    );
  }

  async function loadBalance(
    currentUser: User
  ) {
    const token =
      await currentUser.getIdToken();

    const response =
      await fetch(
        "/api/audio-credits/status",
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
        "Audio Credit balance could not be loaded."
      );
    }

    setBalance(
      Number(
        data.balance ||
        0
      )
    );
  }

  useEffect(() => {
    if (!authReady) {
      return;
    }

    let cancelled =
      false;

    async function run() {
      setLoading(
        true
      );

      setError("");

      try {
        await loadPaymentConfig();

        if (
          user &&
          !cancelled
        ) {
          await loadBalance(
            user
          );
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Audio Tools could not be loaded."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(
            false
          );
        }
      }
    }

    void run();

    return () => {
      cancelled =
        true;
    };
  }, [
    authReady,
    user,
  ]);

  async function createOrder(
    packId:
      CreditPack["id"]
  ) {
    const currentUser =
      firebaseAuth.currentUser;

    if (!currentUser) {
      throw new Error(
        "Sign in before buying Audio Credits."
      );
    }

    if (
      !currentUser.emailVerified
    ) {
      throw new Error(
        "Verify your email before buying Audio Credits."
      );
    }

    const token =
      await currentUser.getIdToken();

    const response =
      await fetch(
        "/api/audio-credits/payment",
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
                "create",

              packId,
            }),
        }
      );

    const data =
      await response.json();

    if (
      !response.ok ||
      !data.success ||
      !data.orderId
    ) {
      throw new Error(
        data.error ||
        "Audio Credit order could not be created."
      );
    }

    return String(
      data.orderId
    );
  }

  async function captureOrder(
    orderId: string
  ) {
    const currentUser =
      firebaseAuth.currentUser;

    if (!currentUser) {
      throw new Error(
        "Sign in again before completing payment."
      );
    }

    const token =
      await currentUser.getIdToken();

    const response =
      await fetch(
        "/api/audio-credits/payment",
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
                "capture",

              orderId,
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
        "Audio Credit payment could not be completed."
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
      "Audio Credits added."
    );

    window.location.href =
      "/audio-tools/converter";
  }

  if (
    !authReady ||
    loading
  ) {
    return (
      <main className="min-h-screen px-5 pb-32 pt-52 text-white">
        <div className="mx-auto max-w-6xl">
          Loading Audio Tools...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-5 pb-32 pt-52 text-white sm:px-8">
      <div className="mx-auto max-w-6xl">

        <section className="rounded-[2rem] border border-cyan-300/15 bg-gradient-to-br from-cyan-500/15 via-white/[0.03] to-violet-500/15 p-7 sm:p-10">

          <p className="text-sm font-black uppercase tracking-[0.24em] text-cyan-300">
            SOLO BEATS ENGINE MUSIC
          </p>

          <h1 className="mt-3 text-4xl font-black sm:text-6xl">
            Audio Tools
          </h1>

          <p className="mt-4 max-w-3xl text-lg leading-8 text-white/60">
            Purchase Audio Credits and use them across eligible SOLO BEATS creator tools.
          </p>

          {user ? (
            <div className="mt-7 inline-flex rounded-2xl border border-emerald-300/20 bg-emerald-300/10 px-6 py-4">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-emerald-200/60">
                  Your Balance
                </p>

                <p className="mt-1 text-4xl font-black text-emerald-200">
                  {balance}
                </p>

                <p className="text-sm text-white/45">
                  Audio Credits
                </p>
              </div>
            </div>
          ) : (
            <Link
              href="/account?mode=signin"
              className="mt-7 inline-flex rounded-2xl bg-white px-6 py-3 font-black text-black"
            >
              Sign in to purchase credits
            </Link>
          )}

        </section>

        <section className="mt-8">

          <p className="text-sm font-black uppercase tracking-[0.2em] text-violet-300">
            Audio Credit Packs
          </p>

          <div className="mt-4 grid gap-5 md:grid-cols-3">

            {packs.map(
              pack => (
                <article
                  key={
                    pack.id
                  }
                  className="flex flex-col rounded-[2rem] border border-white/10 bg-white/[0.04] p-7"
                >

                  <h2 className="text-2xl font-black">
                    {pack.label}
                  </h2>

                  <p className="mt-5 text-5xl font-black">
                    ${pack.price.toFixed(2)}
                  </p>

                  <p className="mt-2 text-sm text-white/45">
                    {pack.credits === 1
                      ? "$5.00 per credit"
                      : `$${(
                          pack.price /
                          pack.credits
                        ).toFixed(
                          2
                        )} per credit`}
                  </p>

                  <div className="mt-7 text-sm leading-7 text-white/60">
                    <p>✓ Stored in your account wallet</p>
                    <p>✓ Use on eligible audio tools</p>
                    <p>✓ Credits remain until used</p>
                    <p>✓ Secure payment verification</p>
                  </div>

                  <div className="mt-auto pt-8">

                    {!user ? (
                      <Link
                        href="/account?mode=signin"
                        className="block rounded-2xl bg-white px-5 py-3 text-center font-black text-black"
                      >
                        Sign in
                      </Link>
                    ) : !clientId ? (
                      <div className="rounded-xl border border-red-300/20 bg-red-400/10 p-4 text-sm text-red-200">
                        PayPal setup unavailable.
                      </div>
                    ) : (
                      <PayPalScriptProvider
                        options={{
                          clientId,

                          currency:
                            "USD",

                          intent:
                            "capture",
                        }}
                      >
                        <PayPalButtons
                          style={{
                            layout:
                              "vertical",

                            shape:
                              "rect",

                            label:
                              "paypal",
                          }}

                          createOrder={
                            async () => {
                              setError(
                                ""
                              );

                              setMessage(
                                ""
                              );

                              return createOrder(
                                pack.id
                              );
                            }
                          }

                          onApprove={
                            async data => {
                              try {
                                if (
                                  !data.orderID
                                ) {
                                  throw new Error(
                                    "PayPal did not return an order ID."
                                  );
                                }

                                await captureOrder(
                                  data.orderID
                                );
                              } catch (
                                approveError
                              ) {
                                setError(
                                  approveError instanceof Error
                                    ? approveError.message
                                    : "Audio Credit payment failed."
                                );
                              }
                            }
                          }

                          onError={
                            paypalError => {
                              console.error(
                                paypalError
                              );

                              setError(
                                "PayPal could not complete the Audio Credit purchase."
                              );
                            }
                          }
                        />
                      </PayPalScriptProvider>
                    )}

                  </div>

                </article>
              )
            )}

          </div>

        </section>

        <section className="mt-8 rounded-[2rem] border border-white/10 bg-white/[0.035] p-7">

          <h2 className="text-2xl font-black">
            Coming Into The Credit System
          </h2>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">

            {[
              [
                "Audio Conversion",
                "Convert WAV, MP3, FLAC, M4A, AAC and OGG."
              ],

              [
                "Quick Master",
                "Fast track mastering using Audio Credits."
              ],

              [
                "Stem Tools",
                "Creator-focused stem processing tools."
              ],

              [
                "Creator Utilities",
                "Additional paid audio processing tools."
              ],
            ].map(
              ([title, description]) => (
                <div
                  key={
                    title
                  }
                  className="rounded-2xl border border-white/10 bg-black/20 p-5"
                >
                  <p className="font-black">
                    {title}
                  </p>

                  <p className="mt-2 text-sm leading-6 text-white/45">
                    {description}
                  </p>
                </div>
              )
            )}

          </div>

          <p className="mt-5 text-sm text-white/40">
            SOLO BEATS professional Mix & Mastering remains a separate premium service.
          </p>

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

