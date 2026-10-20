import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";

import {
  adminDb,
  firebaseAdminApp,
} from "../../../../lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MASTER_ONLY_PRICE = 49.99;
const MIX_MASTER_BASE_PRICE = 99.99;
const PER_STEM_PRICE = 10.00;

const PAYPAL_CLIENT_ID =
  process.env.PAYPAL_CLIENT_ID || "";

const PAYPAL_CLIENT_SECRET =
  process.env.PAYPAL_CLIENT_SECRET || "";

const PAYPAL_BASE_URL =
  process.env.PAYPAL_BASE_URL ||
  "https://api-m.paypal.com";

function getBearerToken(request: Request) {
  const header =
    request.headers.get("authorization") || "";

  return (
    header.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() ||
    null
  );
}

async function getUser(request: Request) {
  const token =
    getBearerToken(request);

  if (!token) {
    throw new Error("AUTH_REQUIRED");
  }

  return getAuth(
    firebaseAdminApp
  ).verifyIdToken(token);
}

function calculatePrice(
  serviceType: string,
  stemCount: number
) {
  if (serviceType === "MASTER_ONLY") {
    return MASTER_ONLY_PRICE;
  }

  const safeStemCount =
    Math.max(
      1,
      Math.min(
        20,
        Math.floor(stemCount)
      )
    );

  return (
    MIX_MASTER_BASE_PRICE +
    safeStemCount * PER_STEM_PRICE
  );
}

// SOLO_MM_PAYPAL_CLIENT_CONFIG_V1
export async function GET() {
  if (!PAYPAL_CLIENT_ID) {
    return NextResponse.json(
      {
        success: false,
        error: "PAYPAL_CLIENT_ID_MISSING",
      },
      {
        status: 500,
      }
    );
  }

  return NextResponse.json({
    success: true,
    clientId: PAYPAL_CLIENT_ID,
    currency: "USD",
  });
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
      "PAYPAL_AUTHENTICATION_FAILED"
    );
  }

  return String(
    data.access_token
  );
}

export async function POST(
  request: Request
) {
  try {
    const user =
      await getUser(request);

    const body =
      await request.json();

    const action =
      String(
        body?.action || ""
      ).trim();

    const orderId =
      String(
        body?.orderId || ""
      ).trim();

    const paypalOrderId =
      String(
        body?.paypalOrderId || ""
      ).trim();

    if (
      !orderId ||
      !["create", "capture"].includes(action)
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "INVALID_PAYMENT_REQUEST",
        },
        {
          status: 400,
        }
      );
    }

    const orderRef =
      adminDb
        .collection(
          "mixMasteringOrders"
        )
        .doc(orderId);

    const snapshot =
      await orderRef.get();

    if (!snapshot.exists) {
      return NextResponse.json(
        {
          success: false,
          error:
            "ORDER_NOT_FOUND",
        },
        {
          status: 404,
        }
      );
    }

    const order =
      snapshot.data() || {};

    if (
      String(order.uid || "") !==
      String(user.uid || "")
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "ORDER_ACCESS_DENIED",
        },
        {
          status: 403,
        }
      );
    }

    if (
      order.ownerDirect === true
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "OWNER_DIRECT_PAYMENT_NOT_REQUIRED",
        },
        {
          status: 400,
        }
      );
    }

    if (
      order.uploadComplete !== true
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "ORDER_UPLOAD_NOT_COMPLETE",
        },
        {
          status: 409,
        }
      );
    }

    const serviceType =
      order.serviceType ===
      "MASTER_ONLY"
        ? "MASTER_ONLY"
        : "MIX_MASTER";

    const stemCount =
      Number(
        order.stemCount ||
        (
          Array.isArray(order.stems)
            ? order.stems.length
            : 0
        )
      );

    if (
      serviceType === "MASTER_ONLY" &&
      stemCount !== 1
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "INVALID_MASTER_ONLY_FILE_COUNT",
        },
        {
          status: 400,
        }
      );
    }

    if (
      serviceType === "MIX_MASTER" &&
      (
        stemCount < 1 ||
        stemCount > 20
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "INVALID_STEM_COUNT",
        },
        {
          status: 400,
        }
      );
    }

    const price =
      calculatePrice(
        serviceType,
        stemCount
      );

    if (
      order.paymentStatus ===
      "PAID"
    ) {
      return NextResponse.json({
        success: true,
        alreadyPaid: true,
        paymentStatus:
          "PAID",
        orderId,
        serviceType,
        stemCount,
        price:
          price.toFixed(2),
      });
    }

    const accessToken =
      await getPayPalAccessToken();

    if (action === "create") {
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

              "PayPal-Request-Id":
                `solo-mm-${orderId}`,
            },

            body:
              JSON.stringify({
                intent:
                  "CAPTURE",

                purchase_units: [
                  {
                    custom_id:
                      orderId,

                    description:
                      serviceType ===
                      "MASTER_ONLY"
                        ? "SOLO BEATS MASTER ONLY"
                        : `SOLO BEATS MIX & MASTER - ${stemCount} STEMS`,

                    amount: {
                      currency_code:
                        "USD",

                      value:
                        price.toFixed(2),
                    },
                  },
                ],

                application_context: {
                  brand_name:
                    "SOLO BEATS ENGINE MUSIC",

                  user_action:
                    "PAY_NOW",
                },
              }),
          }
        );

      const paypalData =
        await paypalResponse.json();

      if (
        !paypalResponse.ok ||
        !paypalData?.id
      ) {
        console.error(
          "MIX MASTER PAYPAL CREATE ERROR",
          paypalData
        );

        return NextResponse.json(
          {
            success: false,
            error:
              "PAYPAL_ORDER_CREATION_FAILED",
          },
          {
            status: 502,
          }
        );
      }

      await orderRef.set(
        {
          paymentStatus:
            "PAYMENT_PENDING",

          pricingModel:
            serviceType ===
            "MASTER_ONLY"
              ? "FLAT_MASTER"
              : "BASE_PLUS_PER_STEM",

          masterOnlyPrice:
            MASTER_ONLY_PRICE,

          mixMasterBasePrice:
            MIX_MASTER_BASE_PRICE,

          perStemPrice:
            PER_STEM_PRICE,

          stemCount,

          priceUsd:
            price,

          currency:
            "USD",

          paypalOrderId:
            String(
              paypalData.id
            ),

          updatedAt:
            new Date()
              .toISOString(),
        },
        {
          merge: true,
        }
      );

      return NextResponse.json({
        success: true,

        paypalOrderId:
          paypalData.id,

        orderId,

        serviceType,

        stemCount,

        price:
          price.toFixed(2),
      });
    }

    if (!paypalOrderId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "PAYPAL_ORDER_ID_REQUIRED",
        },
        {
          status: 400,
        }
      );
    }

    const captureResponse =
      await fetch(
        `${PAYPAL_BASE_URL}/v2/checkout/orders/${encodeURIComponent(
          paypalOrderId
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
        }
      );

    const captured =
      await captureResponse.json();

    if (!captureResponse.ok) {
      console.error(
        "MIX MASTER PAYPAL CAPTURE ERROR",
        captured
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "PAYPAL_CAPTURE_FAILED",
        },
        {
          status: 502,
        }
      );
    }

    const purchaseUnit =
      captured
        ?.purchase_units?.[0];

    const capture =
      purchaseUnit
        ?.payments
        ?.captures?.[0];

    const amount =
      String(
        capture
          ?.amount
          ?.value || ""
      );

    const currency =
      String(
        capture
          ?.amount
          ?.currency_code || ""
      );

    if (
      captured?.status !==
        "COMPLETED" ||
      capture?.status !==
        "COMPLETED" ||
      amount !==
        price.toFixed(2) ||
      currency !==
        "USD"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "PAYMENT_VERIFICATION_FAILED",
        },
        {
          status: 400,
        }
      );
    }

    const paidAt =
      new Date()
        .toISOString();

    await orderRef.set(
      {
        paymentStatus:
          "PAID",

        pricingModel:
          serviceType ===
          "MASTER_ONLY"
            ? "FLAT_MASTER"
            : "BASE_PLUS_PER_STEM",

        stemCount,

        priceUsd:
          price,

        currency:
          "USD",

        paypalOrderId,

        paypalCaptureId:
          capture?.id || "",

        paidAt,

        status:
          "PAID_WAITING_FOR_PROCESSING",

        processingStatus:
          "WAITING_FOR_PROCESSING",

        updatedAt:
          paidAt,
      },
      {
        merge: true,
      }
    );

    return NextResponse.json({
      success: true,

      paymentStatus:
        "PAID",

      orderId,

      serviceType,

      stemCount,

      price:
        price.toFixed(2),
    });
  } catch (error) {
    console.error(
      "MIX MASTER PAYMENT ERROR",
      error
    );

    const message =
      error instanceof Error
        ? error.message
        : String(error);

    return NextResponse.json(
      {
        success: false,
        error:
          message,
      },
      {
        status:
          message ===
          "AUTH_REQUIRED"
            ? 401
            : 500,
      }
    );
  }
}

