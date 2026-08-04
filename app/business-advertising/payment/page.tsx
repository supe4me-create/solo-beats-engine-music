"use client";

import Link from "next/link";
import {
  PayPalButtons,
  PayPalScriptProvider,
} from "@paypal/react-paypal-js";
import {
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import {
  useEffect,
  useState,
} from "react";

import { firebaseAuth } from "../../../lib/firebaseClient";

type Submission = {
  submissionId: string;
  businessName: string;
  campaignName: string;
  requestedDurationDays: number;
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
                label="Total"
                value={`$${submission.price} ${submission.currency}`}
              />
            </div>

            <div className="mt-8 rounded-2xl bg-white p-5">
              {clientId ? (
                <PayPalScriptProvider
                  options={{
                    clientId,
                    currency: "USD",
                    intent: "capture",
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

                      setSuccessMessage(
                        result.message
                      );
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

