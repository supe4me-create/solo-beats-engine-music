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

type PromotionPackage = {
  durationDays: number;
  name: string;
  price: number;
  currency: string;
};

type PostInfo = {
  id: string;
  text: string;
  username: string;
  displayName: string;
  mediaURL: string;
  mediaType: string;
  active: boolean;
  promotionActiveUntil:
    | string
    | null;
};

export default function PromotePostPage() {
  const {
    user,
    loading:
      authLoading,
  } = useAuth();

  const [
    postId,
    setPostId,
  ] = useState("");

  const [
    post,
    setPost,
  ] = useState<
    PostInfo | null
  >(null);

  const [
    packages,
    setPackages,
  ] = useState<
    PromotionPackage[]
  >([]);

  const [
    durationDays,
    setDurationDays,
  ] = useState(3);

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

  const [
    ownerFree,
    setOwnerFree,
  ] = useState(false);

  const clientId =
    (
      process.env
        .NEXT_PUBLIC_PAYPAL_CLIENT_ID ||
      ""
    ).replace(/\s+/g, "");

  async function loadPromotion(
    id: string
  ) {
    if (!user) return;

    setLoading(true);
    setError("");

    try {
      const token =
        await user.getIdToken();

      const response =
        await fetch(
          `/api/connect/promotion?postId=${encodeURIComponent(
            id
          )}`,
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
            "Promotion could not be loaded."
        );
      }

      setPost(
        data.post || null
      );

      setOwnerFree(
        Boolean(
          data.ownerFree
        )
      );

      const nextPackages =
        Array.isArray(
          data.packages
        )
          ? data.packages
          : [];

      setPackages(
        nextPackages
      );

      if (
        nextPackages.length >
        0
      ) {
        setDurationDays(
          Number(
            nextPackages[0]
              .durationDays
          )
        );
      }
    }
    catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Promotion could not be loaded."
      );
    }
    finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (authLoading) {
      return;
    }

    const params =
      new URLSearchParams(
        window.location.search
      );

    const id =
      params.get("post") ||
      "";

    setPostId(id);

    if (
      !user ||
      !id
    ) {
      setLoading(false);
      return;
    }

    void loadPromotion(id);
  }, [
    user,
    authLoading,
  ]);

  const selectedPackage =
    packages.find(
      item =>
        item.durationDays ===
        durationDays
    ) || null;

  if (
    authLoading ||
    loading
  ) {
    return (
      <main className="grid min-h-screen place-items-center">
        Loading promotion...
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen px-5 py-16">
        <div className="mx-auto max-w-2xl rounded-3xl border border-white/10 bg-white/[0.035] p-8">
          <h1 className="text-3xl font-black">
            Sign in required
          </h1>

          <Link
            href="/account?mode=signin"
            className="mt-6 inline-flex rounded-xl bg-white px-5 py-3 font-black text-black"
          >
            SIGN IN
          </Link>
        </div>
      </main>
    );
  }

  if (!postId) {
    return (
      <main className="min-h-screen px-5 py-16">
        <div className="mx-auto max-w-2xl rounded-3xl border border-white/10 p-8">
          Choose one of your posts from SOLO CONNECT and press PROMOTE.
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 pb-28 pt-12 sm:px-8">
      <div className="mx-auto max-w-4xl">
        <section className="rounded-[2rem] border border-fuchsia-400/20 bg-gradient-to-br from-fuchsia-500/20 via-black to-amber-400/10 p-7 sm:p-10">
          <p className="text-sm font-black uppercase tracking-[0.25em] text-fuchsia-300">
            SOLO CONNECT
          </p>

          <h1 className="mt-3 text-4xl font-black sm:text-6xl">
            PROMOTE POST
          </h1>

          <p className="mt-4 max-w-2xl text-white/60">
            Boost one of your SOLO CONNECT posts into paid Discovery visibility.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/connect"
              className="rounded-xl bg-white px-5 py-3 font-black text-black"
            >
              BACK TO CONNECT
            </Link>

            <Link
              href="/connect/monetize"
              className="rounded-xl border border-white/10 bg-white/5 px-5 py-3 font-black"
            >
              MONETIZATION
            </Link>
          </div>
        </section>

        {ownerFree ? (
          <section className="mt-6 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-5">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-emerald-300">
              OWNER - FREE PROMOTION
            </p>

            <p className="mt-2 text-white/70">
              Owner promotions are free. No PayPal payment is required.
            </p>
          </section>
        ) : null}

        {error ? (
          <p className="mt-6 rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-red-200">
            {error}
          </p>
        ) : null}

        {success ? (
          <p className="mt-6 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 font-black text-emerald-200">
            {success}
          </p>
        ) : null}

        {post ? (
          <>
            <section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.035] p-6">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">
                POST TO PROMOTE
              </p>

              <h2 className="mt-3 text-xl font-black">
                {post.displayName ||
                  post.username}
              </h2>

              <p className="text-sm text-white/40">
                @{post.username}
              </p>

              {post.text ? (
                <p className="mt-5 whitespace-pre-wrap text-lg leading-8 text-white/85">
                  {post.text}
                </p>
              ) : null}

              {post.mediaType ===
                "image" &&
              post.mediaURL ? (
                <img
                  src={post.mediaURL}
                  alt=""
                  className="mt-5 max-h-80 w-full rounded-2xl object-contain bg-black"
                />
              ) : null}

              {post.active &&
              post.promotionActiveUntil ? (
                <p className="mt-5 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-emerald-200">
                  Currently promoted until{" "}
                  {new Date(
                    post.promotionActiveUntil
                  ).toLocaleString()}
                  . Buying another package extends the promotion.
                </p>
              ) : null}
            </section>

            <section className="mt-8">
              <h2 className="text-3xl font-black">
                CHOOSE PROMOTION
              </h2>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                {packages.map(
                  item => (
                    <button
                      key={
                        item.durationDays
                      }
                      type="button"
                      onClick={() =>
                        setDurationDays(
                          item.durationDays
                        )
                      }
                      className={`rounded-3xl border p-6 text-left transition ${
                        durationDays ===
                        item.durationDays
                          ? "border-fuchsia-300 bg-fuchsia-400/15"
                          : "border-white/10 bg-white/[0.035]"
                      }`}
                    >
                      <p className="text-sm font-black uppercase tracking-[0.16em] text-fuchsia-300">
                        {item.name}
                      </p>

                      <p className="mt-3 text-4xl font-black">
                        {ownerFree
                          ? "FREE"
                          : `$${item.price.toFixed(
                              2
                            )}`}
                      </p>

                      <p className="mt-2 text-white/50">
                        {item.durationDays} days of promoted visibility
                      </p>
                    </button>
                  )
                )}
              </div>
            </section>

            {selectedPackage ? (
              <section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.035] p-6">
                <h2 className="text-2xl font-black">
                  CHECKOUT
                </h2>

                <p className="mt-2 text-white/55">
                  {selectedPackage.name}
                  {" • "}
                  {selectedPackage.durationDays} days
                  {" • $"}
                  {selectedPackage.price.toFixed(
                    2
                  )}
                  {" USD"}
                </p>

                <div className="mt-6 rounded-2xl bg-white p-5">
                  {ownerFree ? (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          setError("");
                          setSuccess("");

                          const token =
                            await user.getIdToken();

                          const response =
                            await fetch(
                              "/api/connect/promotion",
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
                                      "activate-free",

                                    postId,

                                    durationDays,
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
                                "Free promotion could not be activated."
                            );
                          }

                          setSuccess(
                            result.message
                          );

                          await loadPromotion(
                            postId
                          );
                        }
                        catch (activationError) {
                          setError(
                            activationError instanceof Error
                              ? activationError.message
                              : "Free promotion could not be activated."
                          );
                        }
                      }}
                      className="w-full rounded-xl bg-emerald-500 px-6 py-4 text-lg font-black text-black"
                    >
                      ACTIVATE FREE PROMOTION
                    </button>
                  ) : clientId ? (
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
                          durationDays,
                          postId,
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
                              "/api/connect/promotion",
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

                                    postId,

                                    durationDays,
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
                                "PayPal order could not be created."
                            );
                          }

                          return data.orderId;
                        }}
                        onApprove={async data => {
                          const token =
                            await user.getIdToken();

                          const response =
                            await fetch(
                              "/api/connect/promotion",
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

                                    postId,

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
                                "Promotion payment could not be completed."
                            );
                          }

                          setError("");

                          setSuccess(
                            result.message ||
                              "Your post is now promoted."
                          );

                          await loadPromotion(
                            postId
                          );
                        }}
                        onError={paypalError => {
                          console.error(
                            "SOLO CONNECT PayPal error:",
                            paypalError
                          );

                          setError(
                            "PayPal could not complete the promoted post payment."
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
            ) : null}
          </>
        ) : null}
      </div>
    </main>
  );
}