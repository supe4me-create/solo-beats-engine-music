import crypto from "crypto";

import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";

import {
  adminDb,
} from "../../../../../lib/firebaseAdmin";

import {
  requirePremiumAccess,
} from "../../../../../lib/requirePremium";

const PAYPAL_CLIENT_ID =
  process.env.PAYPAL_CLIENT_ID;

const PAYPAL_CLIENT_SECRET =
  process.env.PAYPAL_CLIENT_SECRET;

const PAYPAL_BASE_URL = (
  process.env.PAYPAL_BASE_URL ||
  "https://api-m.paypal.com"
).replace(/\/+$/, "");

type CreditPackId =
  | "credits_10"
  | "credits_25"
  | "credits_50"
  | "credits_100";

type CreditPack = {
  id: CreditPackId;
  credits: number;
  price: number;
  label: string;
};

const CREDIT_PACKS:
  Record<CreditPackId, CreditPack> = {
    credits_10: {
      id: "credits_10",
      credits: 10,
      price: 14.99,
      label: "10 AI Video Credits",
    },
    credits_25: {
      id: "credits_25",
      credits: 25,
      price: 32.99,
      label: "25 AI Video Credits",
    },
    credits_50: {
      id: "credits_50",
      credits: 50,
      price: 59.99,
      label: "50 AI Video Credits",
    },
    credits_100: {
      id: "credits_100",
      credits: 100,
      price: 109.99,
      label: "100 AI Video Credits",
    },
  };

function isCreditPackId(
  value: unknown
): value is CreditPackId {
  return (
    value === "credits_10" ||
    value === "credits_25" ||
    value === "credits_50" ||
    value === "credits_100"
  );
}

async function getPayPalAccessToken():
  Promise<string> {
  if (
    !PAYPAL_CLIENT_ID ||
    !PAYPAL_CLIENT_SECRET
  ) {
    throw new Error(
      "PayPal server credentials are missing."
    );
  }

  const credentials =
    Buffer.from(
      `${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`
    ).toString("base64");

  const response =
    await fetch(
      `${PAYPAL_BASE_URL}/v1/oauth2/token`,
      {
        method: "POST",
        headers: {
          Authorization:
            `Basic ${credentials}`,
          "Content-Type":
            "application/x-www-form-urlencoded",
        },
        body:
          "grant_type=client_credentials",
        cache: "no-store",
      }
    );

  const data =
    await response.json();

  if (
    !response.ok ||
    typeof data.access_token !==
      "string"
  ) {
    throw new Error(
      data?.error_description ||
        "PayPal authentication failed."
    );
  }

  return data.access_token;
}

async function getPayPalOrder(
  orderId: string,
  accessToken: string
) {
  const response =
    await fetch(
      `${PAYPAL_BASE_URL}/v2/checkout/orders/${encodeURIComponent(
        orderId
      )}`,
      {
        method: "GET",
        headers: {
          Authorization:
            `Bearer ${accessToken}`,
          "Content-Type":
            "application/json",
        },
        cache: "no-store",
      }
    );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data?.details?.[0]?.description ||
        data?.message ||
        "PayPal could not retrieve the AI Video credit order."
    );
  }

  return data;
}

async function capturePayPalOrder(
  orderId: string,
  accessToken: string
) {
  const response =
    await fetch(
      `${PAYPAL_BASE_URL}/v2/checkout/orders/${encodeURIComponent(
        orderId
      )}/capture`,
      {
        method: "POST",
        headers: {
          Authorization:
            `Bearer ${accessToken}`,
          "Content-Type":
            "application/json",
        },
        cache: "no-store",
      }
    );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data?.details?.[0]?.description ||
        data?.message ||
        "PayPal could not complete the AI Video credit payment."
    );
  }

  return data;
}

export async function GET(
  request: Request
) {
  const premiumAccess =
    await requirePremiumAccess(
      request
    );

  if (!premiumAccess.allowed) {
    return NextResponse.json(
      {
        success: false,
        error:
          premiumAccess.error,
      },
      {
        status:
          premiumAccess.statusCode,
      }
    );
  }

  const creditSnapshot =
    await adminDb
      .collection("aiVideoCredits")
      .doc(premiumAccess.uid)
      .get();

  const creditData =
    creditSnapshot.exists
      ? creditSnapshot.data() || {}
      : {};

  const balance =
    typeof creditData.balance ===
      "number" &&
    Number.isFinite(
      creditData.balance
    )
      ? Math.max(
          0,
          Math.floor(
            creditData.balance
          )
        )
      : 0;

  return NextResponse.json({
    success: true,
    balance,
    packs:
      Object.values(
        CREDIT_PACKS
      ),
  });
}

export async function POST(
  request: Request
) {
  try {
    const premiumAccess =
      await requirePremiumAccess(
        request
      );

    if (!premiumAccess.allowed) {
      return NextResponse.json(
        {
          success: false,
          error:
            premiumAccess.error,
        },
        {
          status:
            premiumAccess.statusCode,
        }
      );
    }

    const body =
      (await request.json()) as {
        action?: unknown;
        packId?: unknown;
        orderId?: unknown;
      };

    const action =
      typeof body.action === "string"
        ? body.action.trim()
        : "";

    if (action === "create") {
      if (
        !isCreditPackId(
          body.packId
        )
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "A valid AI Video credit pack is required.",
          },
          { status: 400 }
        );
      }

      const pack =
        CREDIT_PACKS[
          body.packId
        ];

      const accessToken =
        await getPayPalAccessToken();

      const requestId =
        crypto.randomUUID();

      const customId =
        [
          premiumAccess.uid,
          pack.id,
        ].join(":");

      const paypalResponse =
        await fetch(
          `${PAYPAL_BASE_URL}/v2/checkout/orders`,
          {
            method: "POST",
            headers: {
              Authorization:
                `Bearer ${accessToken}`,
              "Content-Type":
                "application/json",
              Prefer:
                "return=representation",
              "PayPal-Request-Id":
                requestId,
            },
            body: JSON.stringify({
              intent: "CAPTURE",
              purchase_units: [
                {
                  reference_id:
                    "solo-beats-ai-video-credits",
                  custom_id:
                    customId,
                  description:
                    pack.label,
                  amount: {
                    currency_code:
                      "USD",
                    value:
                      pack.price.toFixed(
                        2
                      ),
                  },
                },
              ],
              application_context: {
                brand_name:
                  "SOLO BEATS ENGINE MUSIC",
                shipping_preference:
                  "NO_SHIPPING",
                user_action:
                  "PAY_NOW",
              },
            }),
            cache: "no-store",
          }
        );

      const paypalOrder =
        await paypalResponse.json();

      if (
        !paypalResponse.ok ||
        !paypalOrder.id
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              paypalOrder
                ?.details?.[0]
                ?.description ||
              paypalOrder?.message ||
              "PayPal could not create the AI Video credit order.",
          },
          {
            status:
              paypalResponse.status ||
              500,
          }
        );
      }

      return NextResponse.json({
        success: true,
        orderId:
          paypalOrder.id,
        status:
          paypalOrder.status,
        pack,
      });
    }

    if (action === "capture") {
      const orderId =
        typeof body.orderId ===
          "string"
          ? body.orderId.trim()
          : "";

      if (!orderId) {
        return NextResponse.json(
          {
            success: false,
            error:
              "A valid PayPal order ID is required.",
          },
          { status: 400 }
        );
      }

      const accessToken =
        await getPayPalAccessToken();

      const originalOrder =
        await getPayPalOrder(
          orderId,
          accessToken
        );

      const purchaseUnit =
        originalOrder
          ?.purchase_units?.[0];

      const customId =
        typeof purchaseUnit
          ?.custom_id === "string"
          ? purchaseUnit
              .custom_id
              .trim()
          : "";

      const [
        orderUid,
        orderPackId,
      ] =
        customId.split(":");

      if (
        orderUid !==
        premiumAccess.uid
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "This AI Video credit order does not belong to your account.",
          },
          { status: 403 }
        );
      }

      if (
        !isCreditPackId(
          orderPackId
        )
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "The AI Video credit pack could not be verified.",
          },
          { status: 400 }
        );
      }

      const pack =
        CREDIT_PACKS[
          orderPackId
        ];

      const expectedAmount =
        pack.price.toFixed(2);

      const originalAmount =
        typeof purchaseUnit
          ?.amount?.value ===
          "string"
          ? purchaseUnit
              .amount.value
          : "";

      const originalCurrency =
        purchaseUnit
          ?.amount
          ?.currency_code;

      if (
        originalAmount !==
          expectedAmount ||
        originalCurrency !==
          "USD"
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "The PayPal AI Video credit amount does not match the selected pack.",
          },
          { status: 400 }
        );
      }

      let completedOrder =
        originalOrder;

      if (
        originalOrder.status !==
        "COMPLETED"
      ) {
        await capturePayPalOrder(
          orderId,
          accessToken
        );

        completedOrder =
          await getPayPalOrder(
            orderId,
            accessToken
          );
      }

      if (
        completedOrder.status !==
        "COMPLETED"
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              `Payment status is ${completedOrder.status}.`,
          },
          { status: 400 }
        );
      }

      const completedUnit =
        completedOrder
          ?.purchase_units?.[0];

      const paymentCapture =
        completedUnit
          ?.payments
          ?.captures?.[0];

      if (
        !paymentCapture ||
        paymentCapture.status !==
          "COMPLETED"
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "The PayPal AI Video credit capture was not completed.",
          },
          { status: 400 }
        );
      }

      const capturedAmount =
        paymentCapture
          ?.amount?.value;

      const capturedCurrency =
        paymentCapture
          ?.amount
          ?.currency_code;

      if (
        capturedAmount !==
          expectedAmount ||
        capturedCurrency !==
          "USD"
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "The completed PayPal payment amount does not match the AI Video credit pack.",
          },
          { status: 400 }
        );
      }

      const purchaseReference =
        adminDb
          .collection(
            "aiVideoCreditPurchases"
          )
          .doc(orderId);

      const creditReference =
        adminDb
          .collection(
            "aiVideoCredits"
          )
          .doc(
            premiumAccess.uid
          );

      const ledgerReference =
        creditReference
          .collection("ledger")
          .doc(
            `paypal_${orderId}`
          );

      const result =
        await adminDb.runTransaction(
          async (transaction) => {
            const [
              purchaseSnapshot,
              creditSnapshot,
            ] =
              await Promise.all([
                transaction.get(
                  purchaseReference
                ),
                transaction.get(
                  creditReference
                ),
              ]);

            const existingPurchase =
              purchaseSnapshot.exists
                ? purchaseSnapshot.data() ||
                  {}
                : {};

            const creditData =
              creditSnapshot.exists
                ? creditSnapshot.data() ||
                  {}
                : {};

            const currentBalance =
              typeof creditData.balance ===
                "number" &&
              Number.isFinite(
                creditData.balance
              )
                ? Math.max(
                    0,
                    Math.floor(
                      creditData.balance
                    )
                  )
                : 0;

            if (
              existingPurchase
                .creditsGranted ===
              true
            ) {
              return {
                balance:
                  currentBalance,
                alreadyGranted: true,
              };
            }

            const newBalance =
              currentBalance +
              pack.credits;

            transaction.set(
              creditReference,
              {
                balance:
                  newBalance,
                updatedAt:
                  FieldValue.serverTimestamp(),
              },
              {
                merge: true,
              }
            );

            transaction.set(
              purchaseReference,
              {
                uid:
                  premiumAccess.uid,
                orderId:
                  completedOrder.id,
                captureId:
                  paymentCapture.id ||
                  null,
                packId:
                  pack.id,
                credits:
                  pack.credits,
                amount:
                  expectedAmount,
                currency:
                  "USD",
                paymentStatus:
                  completedOrder.status,
                captureStatus:
                  paymentCapture.status,
                creditsGranted:
                  true,
                creditsGrantedAt:
                  FieldValue.serverTimestamp(),
                payerEmail:
                  completedOrder
                    ?.payer
                    ?.email_address ||
                  null,
                createdAt:
                  FieldValue.serverTimestamp(),
                updatedAt:
                  FieldValue.serverTimestamp(),
              },
              {
                merge: true,
              }
            );

            transaction.set(
              ledgerReference,
              {
                type:
                  "credit",
                amount:
                  pack.credits,
                reason:
                  "paypal_credit_pack",
                orderId:
                  completedOrder.id,
                captureId:
                  paymentCapture.id ||
                  null,
                packId:
                  pack.id,
                paymentAmount:
                  expectedAmount,
                paymentCurrency:
                  "USD",
                balanceBefore:
                  currentBalance,
                balanceAfter:
                  newBalance,
                createdAt:
                  FieldValue.serverTimestamp(),
              }
            );

            return {
              balance:
                newBalance,
              alreadyGranted:
                false,
            };
          }
        );

      return NextResponse.json({
        success: true,
        orderId:
          completedOrder.id,
        captureId:
          paymentCapture.id ||
          null,
        pack,
        creditsGranted:
          pack.credits,
        balance:
          result.balance,
        alreadyGranted:
          result.alreadyGranted,
        message:
          result.alreadyGranted
            ? "This AI Video credit purchase was already applied."
            : `${pack.credits} AI Video credits were added to your account.`,
      });
    }

    return NextResponse.json(
      {
        success: false,
        error:
          "A valid payment action is required.",
      },
      { status: 400 }
    );
  } catch (error) {
    console.error(
      "AI Video credit payment error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "AI Video credit payment failed.",
      },
      { status: 500 }
    );
  }
}
