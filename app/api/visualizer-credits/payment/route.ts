import crypto from "crypto";

import {
  getAuth,
} from "firebase-admin/auth";

import {
  FieldValue,
} from "firebase-admin/firestore";

import {
  NextResponse,
} from "next/server";

import {
  adminDb,
  firebaseAdminApp,
} from "../../../../lib/firebaseAdmin";

import {
  VISUALIZER_CREDIT_PACKS,
  isVisualizerCreditPackId,
} from "../../../../lib/visualizerCredits";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

const PAYPAL_CLIENT_ID =
  process.env
    .PAYPAL_CLIENT_ID;

const PAYPAL_CLIENT_SECRET =
  process.env
    .PAYPAL_CLIENT_SECRET;

const PAYPAL_BASE_URL = (
  process.env
    .PAYPAL_BASE_URL ||
  "https://api-m.paypal.com"
).replace(
  /\/+$/,
  ""
);

function getBearerToken(
  request: Request
) {
  const authorization =
    request.headers.get(
      "authorization"
    ) || "";

  return (
    authorization.match(
      /^Bearer\s+(.+)$/i
    )?.[1]?.trim() ||
    null
  );
}

async function requireUser(
  request: Request
) {
  const token =
    getBearerToken(
      request
    );

  if (!token) {
    throw new Error(
      "AUTH_REQUIRED"
    );
  }

  const user =
    await getAuth(
      firebaseAdminApp
    ).verifyIdToken(
      token
    );

  if (
    user.email_verified !==
    true
  ) {
    throw new Error(
      "EMAIL_VERIFICATION_REQUIRED"
    );
  }

  return user;
}

async function getPayPalAccessToken() {
  if (
    !PAYPAL_CLIENT_ID ||
    !PAYPAL_CLIENT_SECRET
  ) {
    throw new Error(
      "PAYPAL_SERVER_CREDENTIALS_MISSING"
    );
  }

  const credentials =
    Buffer.from(
      `${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`
    ).toString(
      "base64"
    );

  const response =
    await fetch(
      `${PAYPAL_BASE_URL}/v1/oauth2/token`,
      {
        method:
          "POST",

        headers: {
          Authorization:
            `Basic ${credentials}`,

          "Content-Type":
            "application/x-www-form-urlencoded",
        },

        body:
          "grant_type=client_credentials",

        cache:
          "no-store",
      }
    );

  const data =
    await response.json();

  if (
    !response.ok ||
    !data.access_token
  ) {
    throw new Error(
      data?.error_description ||
      "PAYPAL_AUTHENTICATION_FAILED"
    );
  }

  return String(
    data.access_token
  );
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
        method:
          "GET",

        headers: {
          Authorization:
            `Bearer ${accessToken}`,

          "Content-Type":
            "application/json",
        },

        cache:
          "no-store",
      }
    );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data?.details?.[0]
        ?.description ||
      data?.message ||
      "PAYPAL_ORDER_LOOKUP_FAILED"
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
        method:
          "POST",

        headers: {
          Authorization:
            `Bearer ${accessToken}`,

          "Content-Type":
            "application/json",
        },

        cache:
          "no-store",
      }
    );

  const data =
    await response.json();

  if (!response.ok) {
    throw new Error(
      data?.details?.[0]
        ?.description ||
      data?.message ||
      "PAYPAL_CAPTURE_FAILED"
    );
  }

  return data;
}

export async function GET() {
  if (
    !PAYPAL_CLIENT_ID
  ) {
    return NextResponse.json(
      {
        success:
          false,

        error:
          "PAYPAL_CLIENT_ID_MISSING",
      },
      {
        status:
          500,
      }
    );
  }

  return NextResponse.json({
    success:
      true,

    clientId:
      PAYPAL_CLIENT_ID,

    currency:
      "USD",

    packs:
      Object.values(
        VISUALIZER_CREDIT_PACKS
      ),
  });
}

export async function POST(
  request: Request
) {
  try {
    const user =
      await requireUser(
        request
      );

    const body =
      await request.json();

    const action =
      typeof body?.action ===
      "string"
        ? body.action.trim()
        : "";

    if (
      action ===
      "create"
    ) {
      if (
        !isVisualizerCreditPackId(
          body?.packId
        )
      ) {
        return NextResponse.json(
          {
            success:
              false,

            error:
              "INVALID_VISUALIZER_CREDIT_PACK",
          },
          {
            status:
              400,
          }
        );
      }

      const packId =
        body.packId as keyof typeof VISUALIZER_CREDIT_PACKS;

      const pack =
        VISUALIZER_CREDIT_PACKS[
          packId
        ];

      const accessToken =
        await getPayPalAccessToken();

      const requestId =
        crypto.randomUUID();

      const customId =
        [
          user.uid,
          pack.id,
        ].join(
          ":"
        );

      const paypalResponse =
        await fetch(
          `${PAYPAL_BASE_URL}/v2/checkout/orders`,
          {
            method:
              "POST",

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

            body:
              JSON.stringify({
                intent:
                  "CAPTURE",

                purchase_units: [
                  {
                    reference_id:
                      "solo-beats-visualizer-credits",

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

            cache:
              "no-store",
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
            success:
              false,

            error:
              paypalOrder
                ?.details?.[0]
                ?.description ||
              paypalOrder
                ?.message ||
              "PAYPAL_VISUALIZER_CREDIT_ORDER_FAILED",
          },
          {
            status:
              paypalResponse.status ||
              500,
          }
        );
      }

      return NextResponse.json({
        success:
          true,

        orderId:
          paypalOrder.id,

        pack,
      });
    }

    if (
      action ===
      "capture"
    ) {
      const orderId =
        typeof body?.orderId ===
        "string"
          ? body.orderId.trim()
          : "";

      if (!orderId) {
        return NextResponse.json(
          {
            success:
              false,

            error:
              "PAYPAL_ORDER_ID_REQUIRED",
          },
          {
            status:
              400,
          }
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
          ?.custom_id ===
          "string"
          ? purchaseUnit
              .custom_id
              .trim()
          : "";

      const [
        orderUid,
        orderPackId,
      ] =
        customId.split(
          ":"
        );

      if (
        orderUid !==
        user.uid
      ) {
        return NextResponse.json(
          {
            success:
              false,

            error:
              "VISUALIZER_CREDIT_ORDER_ACCOUNT_MISMATCH",
          },
          {
            status:
              403,
          }
        );
      }

      if (
        !isVisualizerCreditPackId(
          orderPackId
        )
      ) {
        return NextResponse.json(
          {
            success:
              false,

            error:
              "INVALID_VISUALIZER_CREDIT_PACK",
          },
          {
            status:
              400,
          }
        );
      }

      const pack =
        VISUALIZER_CREDIT_PACKS[
          orderPackId
        ];

      const expectedAmount =
        pack.price.toFixed(
          2
        );

      const originalAmount =
        String(
          purchaseUnit
            ?.amount
            ?.value ||
          ""
        );

      const originalCurrency =
        String(
          purchaseUnit
            ?.amount
            ?.currency_code ||
          ""
        );

      if (
        originalAmount !==
          expectedAmount ||
        originalCurrency !==
          "USD"
      ) {
        return NextResponse.json(
          {
            success:
              false,

            error:
              "VISUALIZER_CREDIT_PAYMENT_AMOUNT_MISMATCH",
          },
          {
            status:
              400,
          }
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
            success:
              false,

            error:
              `PAYMENT_STATUS_${completedOrder.status}`,
          },
          {
            status:
              400,
          }
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
            success:
              false,

            error:
              "PAYPAL_CAPTURE_NOT_COMPLETED",
          },
          {
            status:
              400,
          }
        );
      }

      if (
        String(
          paymentCapture
            ?.amount
            ?.value ||
          ""
        ) !== expectedAmount ||
        String(
          paymentCapture
            ?.amount
            ?.currency_code ||
          ""
        ) !== "USD"
      ) {
        return NextResponse.json(
          {
            success:
              false,

            error:
              "CAPTURED_VISUALIZER_CREDIT_AMOUNT_MISMATCH",
          },
          {
            status:
              400,
          }
        );
      }

      const purchaseRef =
        adminDb
          .collection(
            "visualizerCreditPurchases"
          )
          .doc(
            orderId
          );

      const accountRef =
        adminDb
          .collection(
            "visualizerCredits"
          )
          .doc(
            user.uid
          );

      const ledgerRef =
        accountRef
          .collection(
            "ledger"
          )
          .doc(
            `paypal_${orderId}`
          );

      const result =
        await adminDb.runTransaction(
          async transaction => {
            const [
              purchaseSnapshot,
              accountSnapshot,
            ] =
              await Promise.all([
                transaction.get(
                  purchaseRef
                ),

                transaction.get(
                  accountRef
                ),
              ]);

            const purchaseData =
              purchaseSnapshot.exists
                ? purchaseSnapshot.data() ||
                  {}
                : {};

            const accountData =
              accountSnapshot.exists
                ? accountSnapshot.data() ||
                  {}
                : {};

            const currentBalance =
              typeof accountData.balance ===
                "number" &&
              Number.isFinite(
                accountData.balance
              )
                ? Math.max(
                    0,
                    Math.floor(
                      accountData.balance
                    )
                  )
                : 0;

            if (
              purchaseData
                .creditsGranted ===
              true
            ) {
              return {
                balance:
                  currentBalance,

                alreadyGranted:
                  true,
              };
            }

            const newBalance =
              currentBalance +
              pack.credits;

            transaction.set(
              accountRef,
              {
                balance:
                  newBalance,

                updatedAt:
                  FieldValue.serverTimestamp(),
              },
              {
                merge:
                  true,
              }
            );

            transaction.set(
              purchaseRef,
              {
                uid:
                  user.uid,

                email:
                  user.email ||
                  null,

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
                merge:
                  true,
              }
            );

            transaction.set(
              ledgerRef,
              {
                type:
                  "credit",

                amount:
                  pack.credits,

                reason:
                  "paypal_visualizer_credit_pack",

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
        success:
          true,

        pack,

        balance:
          result.balance,

        alreadyGranted:
          result.alreadyGranted,

        message:
          result.alreadyGranted
            ? "This Visualizer Credit purchase was already applied."
            : `${pack.credits} Visualizer Credit${pack.credits === 1 ? "" : "s"} added to your account.`,
      });
    }

    return NextResponse.json(
      {
        success:
          false,

        error:
          "INVALID_PAYMENT_ACTION",
      },
      {
        status:
          400,
      }
    );
  }
  catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "VISUALIZER_CREDIT_PAYMENT_FAILED";

    console.error(
      "Visualizer credit payment error:",
      error
    );

    return NextResponse.json(
      {
        success:
          false,

        error:
          message,
      },
      {
        status:
          message ===
          "AUTH_REQUIRED"
            ? 401
            : message ===
              "EMAIL_VERIFICATION_REQUIRED"
              ? 403
              : 500,
      }
    );
  }
}