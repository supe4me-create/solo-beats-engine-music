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
  onAuthStateChanged,
  type User,
} from "firebase/auth";

import {
  firebaseAuth,
} from "../../../lib/firebaseClient";

type CreditPack = {
  id:
    | "credits_1"
    | "credits_5"
    | "credits_10";

  credits: number;
  price: number;
  label: string;
};

type PaymentConfig = {
  clientId: string;
  currency: string;
  packs: CreditPack[];
};

export default function VisualizerCreditsPage() {
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
    balance,
    setBalance,
  ] =
    useState(0);

  const [
    config,
    setConfig,
  ] =
    useState<PaymentConfig | null>(
      null
    );

  const [
    selectedPack,
    setSelectedPack,
  ] =
    useState<
      CreditPack["id"]
    >(
      "credits_5"
    );

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

  useEffect(
    () =>
      onAuthStateChanged(
        firebaseAuth,
        currentUser => {
          setUser(
            currentUser
          );

          setAuthReady(
            true
          );
        }
      ),
    []
  );

  useEffect(() => {
    void loadPaymentConfig();
  }, []);

  useEffect(() => {
    if (user) {
      void loadBalance(
        user
      );
    }
    else {
      setBalance(
        0
      );
    }
  }, [
    user,
  ]);

  async function loadPaymentConfig() {
    try {
      const response =
        await fetch(
          "/api/visualizer-credits/payment",
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
          "Visualizer Credit payment setup could not be loaded."
        );
      }

      setConfig({
        clientId:
          data.clientId,

        currency:
          data.currency ||
          "USD",

        packs:
          Array.isArray(
            data.packs
          )
            ? data.packs
            : [],
      });
    }
    catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load Visualizer Credit payment setup."
      );
    }
  }

  async function loadBalance(
    currentUser: User
  ) {
    try {
      const token =
        await currentUser.getIdToken();

      const response =
        await fetch(
          "/api/visualizer-credits/status",
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
        response.ok &&
        data.success
      ) {
        setBalance(
          Number(
            data.balance ||
            0
          )
        );
      }
    }
    catch {}
  }

  const chosenPack =
    config?.packs.find(
      pack =>
        pack.id ===
        selectedPack
    ) ||
    null;

  if (
    !authReady
  ) {
    return (
      <main className="min-h-screen bg-black px-5 pb-32 pt-40 text-white">
        <div className="mx-auto max-w-5xl">
          Loading Visualizer Credits...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black px-5 pb-32 pt-32 text-white sm:px-8">
      <div className="mx-auto max-w-5xl">

        <section className="rounded-[2rem] border border-fuchsia-300/15 bg-gradient-to-br from-fuchsia-600/20 via-white/[0.03] to-red-500/10 p-7 sm:p-10">

          <p className="text-sm font-black uppercase tracking-[0.24em] text-fuchsia-300">
            SOLO BEATS ENGINE MUSIC
          </p>

          <h1 className="mt-3 text-4xl font-black sm:text-6xl">
            Visualizer Credits
          </h1>

          <p className="mt-4 max-w-3xl text-lg leading-8 text-white/60">
            Purchase credits for professional 2-5 minute music visualizers.
            One completed visualizer uses one Visualizer Credit.
          </p>

          <div className="mt-7 inline-flex rounded-2xl border border-fuchsia-300/20 bg-fuchsia-300/10 px-6 py-4">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-fuchsia-200/60">
                Your Balance
              </p>

              <p className="mt-1 text-4xl font-black text-fuchsia-200">
                {balance}
              </p>

              <p className="text-sm text-white/45">
                Visualizer Credits
              </p>
            </div>
          </div>

          <Link
            href="/music-visualizer"
            className="mt-6 inline-flex rounded-2xl border border-white/15 bg-white/[0.06] px-6 py-3 font-black text-white transition hover:bg-white/[0.12]"
          >
            BACK TO VISUALIZER
          </Link>

        </section>

        {!user ? (
          <section className="mt-8 rounded-[2rem] border border-white/10 bg-white/[0.04] p-7">

            <h2 className="text-2xl font-black">
              Sign in required
            </h2>

            <p className="mt-3 text-white/60">
              Sign in to purchase and use Visualizer Credits.
            </p>

            <Link
              href="/account?mode=signin"
              className="mt-5 inline-flex rounded-2xl bg-white px-6 py-3 font-black text-black"
            >
              Sign In
            </Link>

          </section>
        ) : !user.emailVerified ? (
          <section className="mt-8 rounded-[2rem] border border-amber-300/20 bg-amber-300/10 p-7 text-amber-100">

            <h2 className="text-2xl font-black">
              Verify your email
            </h2>

            <p className="mt-3">
              Your email must be verified before purchasing Visualizer Credits.
            </p>

          </section>
        ) : (
          <>

            <section className="mt-8 rounded-[2rem] border border-white/10 bg-white/[0.04] p-7">

              <p className="text-sm font-black uppercase tracking-[0.2em] text-fuchsia-300">
                Choose a Credit Pack
              </p>

              <div className="mt-6 grid gap-4 md:grid-cols-3">

                {config?.packs.map(
                  pack => {
                    const selected =
                      selectedPack ===
                      pack.id;

                    return (
                      <button
                        key={pack.id}
                        type="button"
                        onClick={() =>
                          setSelectedPack(
                            pack.id
                          )
                        }
                        className={
                          selected
                            ? "rounded-2xl border border-fuchsia-300 bg-fuchsia-500/20 p-6 text-left"
                            : "rounded-2xl border border-white/10 bg-black/30 p-6 text-left hover:border-white/25"
                        }
                      >
                        <div className="text-3xl font-black">
                          {pack.credits}
                        </div>

                        <div className="mt-1 font-black text-white/80">
                          Visualizer Credit{pack.credits === 1 ? "" : "s"}
                        </div>

                        <div className="mt-4 text-2xl font-black text-fuchsia-300">
                          ${pack.price.toFixed(2)}
                        </div>

                        {pack.credits > 1 ? (
                          <div className="mt-2 text-sm text-white/45">
                            ${(pack.price / pack.credits).toFixed(2)} per visualizer
                          </div>
                        ) : null}
                      </button>
                    );
                  }
                )}

              </div>

            </section>

            {config &&
            chosenPack ? (
              <section className="mt-8 rounded-[2rem] border border-white/10 bg-white/[0.04] p-7">

                <h2 className="text-2xl font-black">
                  Pay with PayPal
                </h2>

                <p className="mt-2 text-white/55">
                  {chosenPack.label} - ${chosenPack.price.toFixed(2)}
                </p>

                <div className="mt-6 max-w-xl">

                  <PayPalScriptProvider
                    key={config.clientId}
                    options={{
                      clientId:
                        config.clientId,

                      currency:
                        config.currency ||
                        "USD",

                      intent:
                        "capture",
                    }}
                  >
                    <PayPalButtons
                      key={selectedPack}
                      style={{
                        layout:
                          "vertical",

                        shape:
                          "rect",
                      }}

                      createOrder={async () => {
                        const currentUser =
                          firebaseAuth.currentUser;

                        if (!currentUser) {
                          throw new Error(
                            "Sign in before purchasing credits."
                          );
                        }

                        const token =
                          await currentUser.getIdToken();

                        const response =
                          await fetch(
                            "/api/visualizer-credits/payment",
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

                                  packId:
                                    selectedPack,
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
                            "Could not create PayPal order."
                          );
                        }

                        return data.orderId;
                      }}

                      onApprove={async data => {
                        const currentUser =
                          firebaseAuth.currentUser;

                        if (!currentUser) {
                          throw new Error(
                            "Sign in again before completing payment."
                          );
                        }

                        setError(
                          ""
                        );

                        setMessage(
                          "Confirming payment..."
                        );

                        const token =
                          await currentUser.getIdToken();

                        const response =
                          await fetch(
                            "/api/visualizer-credits/payment",
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

                                  orderId:
                                    data.orderID,
                                }),
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
                            "Visualizer Credit payment could not be completed."
                          );
                        }

                        setBalance(
                          Number(
                            result.balance ||
                            0
                          )
                        );

                        setMessage(
                          result.message ||
                          "Visualizer Credits added successfully."
                        );

                        window.setTimeout(
                          () => {
                            window.location.href =
                              "/music-visualizer";
                          },
                          900
                        );
                      }}

                      onError={paypalError => {
                        console.error(
                          "Visualizer Credit PayPal error:",
                          paypalError
                        );

                        setMessage(
                          ""
                        );

                        setError(
                          "PayPal could not complete this Visualizer Credit purchase."
                        );
                      }}
                    />
                  </PayPalScriptProvider>

                </div>

                {message ? (
                  <p className="mt-5 rounded-xl border border-emerald-300/20 bg-emerald-300/10 p-4 text-emerald-200">
                    {message}
                  </p>
                ) : null}

                {error ? (
                  <p className="mt-5 rounded-xl border border-red-300/20 bg-red-400/10 p-4 text-red-200">
                    {error}
                  </p>
                ) : null}

              </section>
            ) : null}

          </>
        )}

      </div>
    </main>
  );
}
