"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import { useAuth } from "../../auth/AuthContext";

type Plan = {
  key:
    | "monthly"
    | "three_month"
    | "annual";

  name: string;
  price: string;
  months: number;
  paypalPlanId: string;
};

type PayPalSubscriptionData = {
  subscriptionID?: string;
};

type PayPalActions = {
  subscription: {
    create: (
      data: {
        plan_id: string;
      }
    ) => Promise<string>;
  };
};

declare global {
  interface Window {
    paypalDj?: {
      Buttons: (
        options: {
          createSubscription: (
            data: unknown,
            actions: PayPalActions
          ) => Promise<string>;

          onApprove: (
            data: PayPalSubscriptionData
          ) => Promise<void>;

          onCancel?: () => void;

          onError?: (
            error: unknown
          ) => void;
        }
      ) => {
        render: (
          selector: string
        ) => Promise<void>;

        close?: () =>
          Promise<void>;
      };
    };
  }
}

const card =
  "rounded-2xl border border-white/15 bg-black/30 p-4";

export default function DjPaymentPlans() {
  const { user } = useAuth();

  const [plans, setPlans] =
    useState<Plan[]>([]);

  const [configured, setConfigured] =
    useState(false);

  const [selected, setSelected] =
    useState<string>("monthly");

  const [message, setMessage] =
    useState("");

  const [error, setError] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [sdkReady, setSdkReady] =
    useState(false);

  const buttonsRef =
    useRef<{
      close?: () =>
        Promise<void>;
    } | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!user) return;

      try {
        const token =
          await user.getIdToken();

        const response =
          await fetch(
            "/api/dj/paypal/plans",
            {
              cache: "no-store",
              headers: {
                Authorization:
                  "Bearer " +
                  token,
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
              "DJ payment plans could not be loaded."
          );
        }

        if (cancelled) return;

        setConfigured(
          data.configured === true
        );

        setPlans(
          Array.isArray(
            data.plans
          )
            ? data.plans
            : []
        );

        if (
          data.subscription
            ?.pendingOwnerApproval
        ) {
          setMessage(
            "Your payment is verified and waiting for owner approval."
          );
        }
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error
              ? e.message
              : "DJ payment plans could not be loaded."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!configured) return;

    const clientId =
      process.env
        .NEXT_PUBLIC_PAYPAL_CLIENT_ID;

    if (!clientId) {
      setError(
        "PayPal client ID is not configured."
      );
      return;
    }

    if (window.paypalDj) {
      setSdkReady(true);
      return;
    }

    const existing =
      document.querySelector(
        'script[data-solo-dj-paypal="true"]'
      ) as HTMLScriptElement | null;

    if (existing) {
      existing.addEventListener(
        "load",
        () => setSdkReady(true),
        { once: true }
      );
      return;
    }

    const script =
      document.createElement(
        "script"
      );

    script.src =
      "https://www.paypal.com/sdk/js" +
      "?client-id=" +
      encodeURIComponent(
        clientId
      ) +
      "&components=buttons" +
      "&vault=true" +
      "&intent=subscription";

    script.async = true;

    script.dataset
      .soloDjPaypal =
      "true";

    script.setAttribute(
      "data-namespace",
      "paypalDj"
    );

    script.onload =
      () =>
        setSdkReady(true);

    script.onerror =
      () =>
        setError(
          "PayPal could not be loaded."
        );

    document.head.appendChild(
      script
    );
  }, [configured]);

  useEffect(() => {
    if (
      !sdkReady ||
      !window.paypalDj ||
      !user ||
      plans.length === 0
    ) {
      return;
    }

    const plan =
      plans.find(
        item =>
          item.key === selected
      ) || plans[0];

    let disposed = false;

    async function render() {
      try {
        if (
          buttonsRef.current
            ?.close
        ) {
          try {
            await buttonsRef
              .current
              .close?.();
          } catch {
            // Ignore PayPal cleanup errors.
          }
        }

        const container =
          document.getElementById(
            "solo-dj-paypal-buttons"
          );

        if (!container) return;

        container.innerHTML = "";

        const buttons =
          window.paypalDj!.Buttons(
            {
              createSubscription: (
                _data,
                actions
              ) =>
                actions.subscription.create(
                  {
                    plan_id:
                      plan.paypalPlanId,
                  }
                ),

              onApprove:
                async data => {
                  if (
                    !data.subscriptionID
                  ) {
                    setError(
                      "PayPal did not return a subscription ID."
                    );
                    return;
                  }

                  setError("");
                  setMessage(
                    "Verifying payment..."
                  );

                  if (!user) {
                    throw new Error("You must be signed in to continue.");
                  }

                  const token =
                    await user.getIdToken();

                  const response =
                    await fetch(
                      "/api/dj/paypal/verify-subscription",
                      {
                        method:
                          "POST",

                        headers: {
                          Authorization:
                            "Bearer " +
                            token,

                          "Content-Type":
                            "application/json",
                        },

                        body:
                          JSON.stringify(
                            {
                              subscriptionId:
                                data.subscriptionID,
                            }
                          ),
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
                        "DJ payment could not be verified."
                    );
                  }

                  // SOLO_DJ_FORCE_TOKEN_REFRESH_V2
                  await user.getIdToken(true);

                  setMessage(
                    result.message ||
                      "Payment verified. DJ access activated."
                  );
                },

              onCancel: () => {
                setMessage(
                  "PayPal checkout was cancelled."
                );
              },

              onError: error => {
                console.error(
                  "DJ PayPal:",
                  error
                );

                setError(
                  "PayPal checkout encountered an error."
                );
              },
            }
          );

        buttonsRef.current =
          buttons;

        await buttons.render(
          "#solo-dj-paypal-buttons"
        );
      } catch (e) {
        if (!disposed) {
          setError(
            e instanceof Error
              ? e.message
              : "PayPal buttons could not be displayed."
          );
        }
      }
    }

    void render();

    return () => {
      disposed = true;
    };
  }, [
    sdkReady,
    selected,
    plans,
    user,
  ]);

  if (!user) return null;

  return (
    <section className="mt-5 rounded-2xl border border-emerald-300/25 bg-emerald-300/5 p-5">
      <h3 className="text-xl font-black">
        DJ Access Plans
      </h3>

      <p className="mt-2 text-sm text-white/65">
        Your DJ application must be approved first. After PayPal verifies payment, DJ access activates automatically.
      </p>

      <p className="mt-2 text-sm font-bold text-amber-200">
        DJ radio tracks are playback-only. DJ access does not include track downloads.
      </p>

      {loading && (
        <p className="mt-4 text-white/60">
          Loading DJ plans...
        </p>
      )}

      {!loading &&
        !configured && (
          <p className="mt-4 text-amber-200">
            DJ PayPal plans are waiting for owner initialization.
          </p>
        )}

      {configured &&
        plans.length > 0 && (
          <>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {plans.map(plan => (
                <button
                  key={plan.key}
                  type="button"
                  onClick={() =>
                    setSelected(
                      plan.key
                    )
                  }
                  className={
                    card +
                    " text-left " +
                    (
                      selected ===
                      plan.key
                        ? "border-cyan-300 bg-cyan-300/10"
                        : ""
                    )
                  }
                >
                  <div className="font-black">
                    {plan.name}
                  </div>

                  <div className="mt-2 text-2xl font-black text-cyan-200">
                    ${plan.price}
                  </div>

                  <div className="mt-1 text-xs text-white/55">
                    {plan.key === "monthly"
                      ? "$29.99 per month"
                      : plan.key === "three_month"
                        ? "About $25/month • billed $74.99 every 3 months"
                        : "About $16.67/month • billed $199.99 annually"}
                  </div>
                </button>
              ))}
            </div>

            <div
              id="solo-dj-paypal-buttons"
              className="mt-5 min-h-12"
            />
          </>
        )}

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

