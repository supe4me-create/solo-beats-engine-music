"use client";

import Link from "next/link";
import {
  PayPalButtons,
  PayPalScriptProvider,
  usePayPalScriptReducer,
} from "@paypal/react-paypal-js";
import {
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import {
  useEffect,
  useRef,
  useState,
} from "react";

import { firebaseAuth } from "../../../lib/firebaseClient";

type Submission = {
  submissionId: string;
  businessName: string;
  campaignName: string;
  requestedDurationDays: number;
  requestedPlacements: string[];
  price: string;
  currency: string;
  paymentStatus: string;
};

export default function BusinessAdvertisingPaymentPage() {
  const [user, setUser] =
    useState<User | null>(null);
  const [loading, setLoading] =
    useState(true);
  const [submission, setSubmission] =
    useState<Submission | null>(null);
  const [errorMessage, setErrorMessage] =
    useState("");
  const [successMessage, setSuccessMessage] =
    useState("");
  const [savePaymentMethod, setSavePaymentMethod] =
    useState(true);
  const [clientToken, setClientToken] =
    useState("");

  const clientId = (process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || "").replace(/\s+/g, "");

  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        firebaseAuth,
        async (currentUser) => {
          setUser(currentUser);
          setErrorMessage("");

          if (!currentUser) {
            setLoading(false);
            return;
          }

          try {
            const token =
              await currentUser.getIdToken();

            const response = await fetch(
              "/api/business-advertising/payment",
              {
                headers: {
                  Authorization:
                    `Bearer ${token}`,
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
                  "Payment information could not be loaded."
              );
            }

            setSubmission(
              data.submission
            );

            const cardTokenResponse =
              await fetch(
                "/api/paypal/client-token",
                {
                  headers: {
                    Authorization:
                      `Bearer ${token}`,
                  },
                  cache: "no-store",
                }
              );

            const cardTokenData =
              await cardTokenResponse.json();

            if (
              cardTokenResponse.ok &&
              cardTokenData.success &&
              typeof cardTokenData.clientToken ===
                "string"
            ) {
              setClientToken(
                cardTokenData.clientToken
              );
            } else {
              console.warn(
                "Advanced card checkout unavailable:",
                cardTokenData.error
              );
            }
          } catch (error) {
            setErrorMessage(
              error instanceof Error
                ? error.message
                : "Payment information could not be loaded."
            );
          } finally {
            setLoading(false);
          }
        }
      );

    return unsubscribe;
  }, []);

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center px-6">
        <p className="text-white/70">
          Loading business advertising payment...
        </p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="grid min-h-screen place-items-center px-5 pb-20 pt-52">
        <section className="w-full max-w-xl rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 text-center">
          <h1 className="text-4xl font-black">
            Sign in required
          </h1>
          <Link
            href="/account"
            className="mt-7 inline-flex rounded-2xl bg-white px-6 py-4 font-black text-black"
          >
            Open Account
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-5 pb-40 pt-52 sm:px-8">
      <div className="mx-auto max-w-4xl">
        <section className="rounded-[2.5rem] border border-violet-300/20 bg-gradient-to-br from-violet-700/25 via-black/50 to-cyan-500/15 p-8 shadow-2xl sm:p-12">
          <p className="text-sm font-black uppercase tracking-[0.22em] text-emerald-300">
            Approved Business Advertising
          </p>

          <h1 className="mt-4 text-5xl font-black">
            Business Advertising Payment
          </h1>

          <p className="mt-4 text-lg text-white/60">
            Complete payment to move the approved campaign into scheduling.
          </p>
        </section>

        {errorMessage ? (
          <p className="mt-8 rounded-2xl border border-red-300/20 bg-red-300/10 p-5 text-red-200">
            {errorMessage}
          </p>
        ) : null}

        {successMessage ? (
          <section className="mt-8 rounded-[2rem] border border-emerald-300/20 bg-emerald-300/10 p-8 text-center">
            <h2 className="text-3xl font-black text-emerald-200">
              Payment Complete
            </h2>
            <p className="mt-3 text-emerald-100/80">
              {successMessage}
            </p>
            <Link
              href="/business-advertising"
              className="mt-6 inline-flex rounded-2xl bg-white px-6 py-4 font-black text-black"
            >
              Return to Business Advertising
            </Link>
          </section>
        ) : null}

        {!successMessage &&
        !submission ? (
          <section className="mt-8 rounded-[2rem] border border-white/10 bg-white/[0.035] p-8 text-center">
            <h2 className="text-3xl font-black">
              No payment is currently due
            </h2>
            <p className="mt-3 text-white/55">
              An owner must approve a business advertising campaign before payment.
            </p>
            <Link
              href="/business-advertising"
              className="mt-6 inline-flex rounded-2xl bg-white px-6 py-4 font-black text-black"
            >
              Submit Campaign
            </Link>
          </section>
        ) : null}

        {!successMessage &&
        submission ? (
          <section className="mt-8 rounded-[2rem] border border-white/10 bg-white/[0.035] p-6 sm:p-8">
            <div className="grid gap-4 sm:grid-cols-2">
              <Info
                label="Business"
                value={
                  submission.businessName
                }
              />
              <Info
                label="Campaign"
                value={
                  submission.campaignName
                }
              />
              <Info
                label="Duration"
                value={`${submission.requestedDurationDays} days`}
              />
              <Info
                label="Placements"
                value={submission.requestedPlacements
                  .map((placement) =>
                    placement === "homepage"
                      ? "Homepage"
                      : placement === "store"
                        ? "Store"
                        : placement === "radio"
                          ? "Premium Radio"
                          : "Premium TV"
                  )
                  .join(", ")}
              />
              <Info
                label="Total"
                value={`$${submission.price} ${submission.currency}`}
              />
            </div>

            <label className="mt-8 flex cursor-pointer items-start gap-3 rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-5">
              <input
                type="checkbox"
                checked={savePaymentMethod}
                onChange={(event) =>
                  setSavePaymentMethod(
                    event.target.checked
                  )
                }
                className="mt-1 h-5 w-5"
              />
              <span>
                <span className="block font-black text-cyan-100">
                  Save PayPal or card for future approved campaigns
                </span>
                <span className="mt-1 block text-sm text-white/60">
                  By selecting this, you authorize SOLO BEATS ENGINE MUSIC to save the PayPal Wallet or card you choose and charge it only after you submit a future campaign and the owner approves its displayed locked price. PayPal securely stores the payment details; SOLO BEATS stores only PayPal's token, card brand, and last four digits.
                </span>
              </span>
            </label>

            <div className="mt-5 rounded-2xl bg-white p-5">
              {clientId ? (
                <PayPalScriptProvider
                  options={{
                    clientId,
                    currency: "USD",
                    intent: "capture",
                    components:
                      "buttons,card-fields",
                    ...(clientToken
                      ? {
                          dataClientToken:
                            clientToken,
                        }
                      : {}),
                  }}
                >
                  <PayPalButtons
                    style={{
                      layout:
                        "vertical",
                      shape: "rect",
                      label: "pay",
                    }}
                    createOrder={async () => {
                      const token =
                        await user.getIdToken();

                      const response =
                        await fetch(
                          "/api/business-advertising/payment",
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
                                submissionId:
                                  submission.submissionId,
                                savePaymentMethod,
                                paymentSource:
                                  "paypal",
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
                            "PayPal order could not be created."
                        );
                      }

                      return data.orderId;
                    }}
                    onApprove={async (
                      data
                    ) => {
                      const token =
                        await user.getIdToken();

                      const response =
                        await fetch(
                          "/api/business-advertising/payment",
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
                                submissionId:
                                  submission.submissionId,
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
                            "The business advertising payment could not be completed."
                        );
                      }

                      setErrorMessage("");
                      setSuccessMessage(
                        result.message ||
                          "Payment completed successfully. Opening scheduling..."
                      );

                      window.setTimeout(() => {
                        window.location.assign(
                          `/business-advertising/success?submissionId=${encodeURIComponent(
                            submission.submissionId
                          )}&payment=success`
                        );
                      }, 1200);
                    }}
                    onError={(error) => {
                      console.error(
                        "Business promotion PayPal error:",
                        error
                      );

                      setErrorMessage(
                        "PayPal could not complete the business advertising payment."
                      );
                    }}
                  />

                  <div className="my-6 flex items-center gap-4">
                    <span className="h-px flex-1 bg-black/15" />
                    <span className="text-xs font-black uppercase tracking-[0.16em] text-black/50">
                      Or pay securely by card
                    </span>
                    <span className="h-px flex-1 bg-black/15" />
                  </div>

                  {clientToken ? (
                    savePaymentMethod ? (
                      <SavedCardCheckout
                        user={user}
                        submission={submission}
                        onError={(message) => {
                          setSuccessMessage("");
                          setErrorMessage(
                            message
                          );
                        }}
                        onSuccess={(message) => {
                          setErrorMessage("");
                          setSuccessMessage(
                            message
                          );

                          window.setTimeout(
                            () => {
                              window.location.assign(
                                `/business-advertising/success?submissionId=${encodeURIComponent(
                                  submission.submissionId
                                )}&payment=success`
                              );
                            },
                            1200
                          );
                        }}
                      />
                    ) : (
                      <p className="rounded-xl bg-amber-100 p-4 text-sm font-bold text-amber-900">
                        Select the save-payment authorization above to use secure card checkout and automatic future campaign charging.
                      </p>
                    )
                  ) : (
                    <p className="rounded-xl bg-black/5 p-4 text-center text-sm font-bold text-black/60">
                      Secure debit and credit card fields are temporarily unavailable. PayPal Wallet checkout is still available above.
                    </p>
                  )}
                </PayPalScriptProvider>
              ) : (
                <p className="text-center font-black text-red-700">
                  PayPal client ID is missing.
                </p>
              )}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}

type PayPalCardFieldsInstance = {
  isEligible: () => boolean;
  NameField: (options?: Record<string, unknown>) => {
    render: (selector: string) => Promise<void>;
  };
  NumberField: (options?: Record<string, unknown>) => {
    render: (selector: string) => Promise<void>;
  };
  ExpiryField: (options?: Record<string, unknown>) => {
    render: (selector: string) => Promise<void>;
  };
  CVVField: (options?: Record<string, unknown>) => {
    render: (selector: string) => Promise<void>;
  };
  submit: () => Promise<void>;
  close?: () => void;
};

function SavedCardCheckout({
  user,
  submission,
  onSuccess,
  onError,
}: {
  user: User;
  submission: Submission;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [{ isResolved }] =
    usePayPalScriptReducer();
  const cardFieldsRef =
    useRef<PayPalCardFieldsInstance | null>(
      null
    );
  const initializedRef =
    useRef(false);
  const [eligible, setEligible] =
    useState(true);
  const [submitting, setSubmitting] =
    useState(false);

  useEffect(() => {
    if (
      !isResolved ||
      initializedRef.current
    ) {
      return;
    }

    const paypal = (
      window as Window & {
        paypal?: {
          CardFields?: (
            options: Record<
              string,
              unknown
            >
          ) => PayPalCardFieldsInstance;
        };
      }
    ).paypal;

    if (!paypal?.CardFields) {
      setEligible(false);
      return;
    }

    initializedRef.current = true;

    const fields = paypal.CardFields({
      style: {
        input: {
          "font-size": "16px",
          color: "#111111",
          "font-family":
            "Arial, sans-serif",
        },
        ".invalid": {
          color: "#b91c1c",
        },
        ".valid": {
          color: "#065f46",
        },
      },
      createOrder: async () => {
        const token =
          await user.getIdToken();

        const response = await fetch(
          "/api/business-advertising/payment",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
              Authorization:
                `Bearer ${token}`,
            },
            body: JSON.stringify({
              action: "create",
              submissionId:
                submission.submissionId,
              savePaymentMethod: true,
              paymentSource: "card",
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
              "The secure card order could not be created."
          );
        }

        return data.orderId;
      },
      onApprove: async (data: {
        orderID?: string;
      }) => {
        if (!data.orderID) {
          throw new Error(
            "PayPal did not return a valid card order."
          );
        }

        const token =
          await user.getIdToken();

        const response = await fetch(
          "/api/business-advertising/payment",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
              Authorization:
                `Bearer ${token}`,
            },
            body: JSON.stringify({
              action: "capture",
              submissionId:
                submission.submissionId,
              orderId: data.orderID,
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
              "The card payment could not be completed."
          );
        }

        onSuccess(
          result.message ||
            "Card payment completed and saved securely. Opening scheduling..."
        );
      },
      onError: (error: unknown) => {
        console.error(
          "Business advertising card error:",
          error
        );

        onError(
          error instanceof Error
            ? error.message
            : "PayPal could not complete the debit or credit card payment."
        );
      },
    });

    if (!fields.isEligible()) {
      setEligible(false);
      return;
    }

    cardFieldsRef.current = fields;

    Promise.all([
      fields
        .NameField()
        .render(
          "#business-card-name"
        ),
      fields
        .NumberField()
        .render(
          "#business-card-number"
        ),
      fields
        .ExpiryField()
        .render(
          "#business-card-expiry"
        ),
      fields
        .CVVField()
        .render(
          "#business-card-cvv"
        ),
    ]).catch((error) => {
      console.error(
        "Card fields render error:",
        error
      );
      setEligible(false);
    });

    return () => {
      fields.close?.();
      cardFieldsRef.current = null;
      initializedRef.current = false;
    };
  }, [isResolved, submission.submissionId, user.uid]);

  if (!eligible) {
    return (
      <p className="rounded-xl bg-black/5 p-4 text-center text-sm font-bold text-black/60">
        Debit and credit card fields are not eligible for this PayPal account or location. PayPal Wallet checkout remains available.
      </p>
    );
  }

  return (
    <section>
      <div className="grid gap-4">
        <CardField
          label="Name on card"
          id="business-card-name"
        />
        <CardField
          label="Card number"
          id="business-card-number"
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <CardField
            label="Expiration date"
            id="business-card-expiry"
          />
          <CardField
            label="Security code"
            id="business-card-cvv"
          />
        </div>
      </div>

      <button
        type="button"
        disabled={submitting}
        onClick={async () => {
          const fields =
            cardFieldsRef.current;

          if (!fields) {
            onError(
              "The secure card fields are not ready yet."
            );
            return;
          }

          setSubmitting(true);
          onError("");

          try {
            await fields.submit();
          } catch (error) {
            console.error(
              "Card submit error:",
              error
            );
            onError(
              error instanceof Error
                ? error.message
                : "The card payment could not be submitted."
            );
          } finally {
            setSubmitting(false);
          }
        }}
        className="mt-5 w-full rounded-xl bg-black px-5 py-4 font-black text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting
          ? "Processing Secure Card Payment..."
          : `Pay $${submission.price} by Debit or Credit Card`}
      </button>

      <p className="mt-3 text-center text-xs leading-5 text-black/50">
        Card details are entered directly into PayPal-hosted secure fields. SOLO BEATS ENGINE MUSIC never receives or stores the full card number or security code.
      </p>
    </section>
  );
}

function CardField({
  label,
  id,
}: {
  label: string;
  id: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-black text-black/70">
      {label}
      <span
        id={id}
        className="block min-h-12 rounded-xl border border-black/15 bg-white px-3 py-3 shadow-inner"
      />
    </label>
  );
}

function Info({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <article className="rounded-2xl border border-white/10 bg-black/20 p-5">
      <p className="text-xs uppercase tracking-[0.14em] text-white/35">
        {label}
      </p>
      <p className="mt-2 text-xl font-black">
        {value}
      </p>
    </article>
  );
}



