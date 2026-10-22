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
  useAuth,
} from "../../auth/AuthContext";

type Creator = {
  uid: string;
  username: string;
  displayName: string;
  photoURL: string;
  bio: string;
};

export default function SupportCreatorPage() {
  const {
    user,
    loading:
      authLoading,
  } = useAuth();

  const [
    creatorUid,
    setCreatorUid,
  ] = useState("");

  const [
    creator,
    setCreator,
  ] = useState<
    Creator | null
  >(null);

  const [
    amounts,
    setAmounts,
  ] = useState<
    number[]
  >([]);

  const [
    amount,
    setAmount,
  ] = useState(5);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const [
    success,
    setSuccess,
  ] = useState("");

  const clientId =
    (
      process.env
        .NEXT_PUBLIC_PAYPAL_CLIENT_ID ||
      ""
    ).replace(
      /\s+/g,
      ""
    );

  useEffect(() => {
    const params =
      new URLSearchParams(
        window.location.search
      );

    const uid =
      params.get(
        "creator"
      ) || "";

    setCreatorUid(
      uid
    );

    if (!uid) {
      setLoading(false);
      return;
    }

    let cancelled =
      false;

    async function load() {
      try {
        const response =
          await fetch(
            `/api/connect/support?mode=creator&uid=${encodeURIComponent(
              uid
            )}`,
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
              "Creator could not be loaded."
          );
        }

        if (
          cancelled
        ) {
          return;
        }

        setCreator(
          data.creator ||
            null
        );

        const nextAmounts =
          Array.isArray(
            data.amounts
          )
            ? data.amounts.map(
                Number
              )
            : [];

        setAmounts(
          nextAmounts
        );

        if (
          nextAmounts.includes(
            5
          )
        ) {
          setAmount(
            5
          );
        }
        else if (
          nextAmounts.length
        ) {
          setAmount(
            nextAmounts[0]
          );
        }
      }
      catch (loadError) {
        if (
          !cancelled
        ) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Creator could not be loaded."
          );
        }
      }
      finally {
        if (
          !cancelled
        ) {
          setLoading(
            false
          );
        }
      }
    }

    void load();

    return () => {
      cancelled =
        true;
    };
  }, []);

  if (
    loading ||
    authLoading
  ) {
    return (
      <main className="grid min-h-screen place-items-center">
        Loading creator support...
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 pb-28 pt-12 sm:px-8">
      <div className="mx-auto max-w-4xl">
        <section className="rounded-[2rem] border border-pink-400/20 bg-gradient-to-br from-pink-500/20 via-black to-violet-500/15 p-7 sm:p-10">
          <p className="text-sm font-black uppercase tracking-[0.25em] text-pink-300">
            SOLO CONNECT
          </p>

          <h1 className="mt-3 text-4xl font-black sm:text-6xl">
            SUPPORT CREATOR
          </h1>

          <p className="mt-4 text-white/60">
            Send direct support to a SOLO CONNECT creator.
          </p>

          <Link
            href="/connect"
            className="mt-6 inline-flex rounded-xl bg-white px-5 py-3 font-black text-black"
          >
            BACK TO CONNECT
          </Link>
        </section>

        {error ? (
          <p className="mt-6 rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-red-200">
            {error}
          </p>
        ) : null}

        {success ? (
          <p className="mt-6 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-5 font-black text-emerald-200">
            {success}
          </p>
        ) : null}

        {creator ? (
          <>
            <section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.035] p-7">
              <div className="flex items-center gap-5">
                <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-violet-500 to-cyan-400 text-xl font-black">
                  {creator.photoURL ? (
                    <img
                      src={
                        creator.photoURL
                      }
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    (
                      creator.displayName ||
                      creator.username ||
                      "SB"
                    )
                      .slice(
                        0,
                        2
                      )
                      .toUpperCase()
                  )}
                </div>

                <div>
                  <h2 className="text-2xl font-black">
                    {creator.displayName ||
                      creator.username}
                  </h2>

                  <p className="text-cyan-300">
                    @{creator.username}
                  </p>
                </div>
              </div>

              {creator.bio ? (
                <p className="mt-5 leading-7 text-white/60">
                  {creator.bio}
                </p>
              ) : null}
            </section>

            {!user ? (
              <section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.035] p-7">
                <h2 className="text-2xl font-black">
                  Sign in to support this creator
                </h2>

                <Link
                  href="/account?mode=signin"
                  className="mt-5 inline-flex rounded-xl bg-white px-5 py-3 font-black text-black"
                >
                  SIGN IN
                </Link>
              </section>
            ) : user.uid === creatorUid ? (
              <section className="mt-8 rounded-3xl border border-white/10 p-7 text-white/60">
                This is your own creator profile. Your earnings are available from the Monetization page.
              </section>
            ) : (
              <>
                <section className="mt-8">
                  <h2 className="text-3xl font-black">
                    CHOOSE SUPPORT AMOUNT
                  </h2>

                  <div className="mt-5 grid gap-4 sm:grid-cols-4">
                    {amounts.map(
                      value => (
                        <button
                          key={
                            value
                          }
                          type="button"
                          onClick={() =>
                            setAmount(
                              value
                            )
                          }
                          className={`rounded-2xl border p-5 text-2xl font-black ${
                            amount ===
                            value
                              ? "border-pink-300 bg-pink-400/15"
                              : "border-white/10 bg-white/[0.035]"
                          }`}
                        >
                          ${value}
                        </button>
                      )
                    )}
                  </div>
                </section>

                <section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.035] p-6">
                  <h2 className="text-2xl font-black">
                    SUPPORT ${amount}
                  </h2>

                  <p className="mt-2 text-sm text-white/45">
                    Payment is collected by SOLO BEATS ENGINE MUSIC and credited to this creator's payout ledger.
                  </p>

                  <div className="mt-6 rounded-2xl bg-white p-5">
                    {clientId ? (
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
                          forceReRender={[
                            creatorUid,
                            amount,
                          ]}
                          style={{
                            layout:
                              "vertical",
                            shape:
                              "rect",
                            label:
                              "pay",
                          }}
                          createOrder={async () => {
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
                                        "create",

                                      creatorUid,

                                      amount,
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
                                  "Support payment could not start."
                              );
                            }

                            return data.orderId;
                          }}
                          onApprove={async data => {
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
                                        "capture",

                                      creatorUid,

                                      amount,

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
                                  "Support payment could not be completed."
                              );
                            }

                            setError(
                              ""
                            );

                            setSuccess(
                              result.message ||
                                "Creator support completed."
                            );
                          }}
                          onError={paypalError => {
                            console.error(
                              paypalError
                            );

                            setError(
                              "PayPal could not complete the creator support payment."
                            );
                          }}
                        />
                      </PayPalScriptProvider>
                    ) : (
                      <p className="text-center font-black text-red-700">
                        PayPal client ID is missing.
                      </p>
                    )}
                  </div>
                </section>
              </>
            )}
          </>
        ) : null}
      </div>
    </main>
  );
}