import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";

import {
  adminDb,
  firebaseAdminApp,
} from "../../../../lib/firebaseAdmin";

const PAYPAL_CLIENT_ID =
  process.env.PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET =
  process.env.PAYPAL_CLIENT_SECRET;

const PAYPAL_BASE_URL = (
  process.env.PAYPAL_BASE_URL ||
  "https://api-m.paypal.com"
).replace(/\/+$/, "");

function getBearerToken(
  request: Request
): string | null {
  const authorization =
    request.headers.get("authorization");

  if (!authorization) return null;

  const match =
    authorization.match(/^Bearer\s+(.+)$/i);

  return match?.[1]?.trim() || null;
}

async function verifyCustomer(
  request: Request
) {
  const idToken = getBearerToken(request);

  if (!idToken) {
    throw new Error("AUTH_REQUIRED");
  }

  return getAuth(
    firebaseAdminApp
  ).verifyIdToken(idToken);
}

async function getPayPalAccessToken() {
  if (
    !PAYPAL_CLIENT_ID ||
    !PAYPAL_CLIENT_SECRET
  ) {
    throw new Error(
      "PayPal server credentials are missing."
    );
  }

  const credentials = Buffer.from(
    `${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`
  ).toString("base64");

  const response = await fetch(
    `${PAYPAL_BASE_URL}/v1/oauth2/token`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type":
          "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
      cache: "no-store",
    }
  );

  const data = await response.json();

  if (!response.ok || !data.access_token) {
    throw new Error(
      data.error_description ||
        "PayPal authentication failed."
    );
  }

  return data.access_token as string;
}

async function getSubmissionForUser(
  uid: string
) {
  const snapshot = await adminDb
    .collection("businessAdvertisingSubmissions")
    .where("advertiserUid", "==", uid)
    .where("reviewStatus", "==", "approved")
    .get();

  const candidates = snapshot.docs
    .map((document) => ({
      id: document.id,
      ...(document.data() as {
        paymentStatus?: string;
        createdAt?: {
          toMillis?: () => number;
        };
        requestedDurationDays?: number | string;
        finalPrice?: number | string;
        businessName?: string;
        campaignName?: string;
      }),
    }))
    .filter(
      (item) =>
        item.paymentStatus !== "paid"
    )
    .sort((a, b) => {
      const aTime =
        typeof a.createdAt?.toMillis === "function"
          ? a.createdAt.toMillis()
          : 0;
      const bTime =
        typeof b.createdAt?.toMillis === "function"
          ? b.createdAt.toMillis()
          : 0;
      return bTime - aTime;
    });

  return candidates[0] || null;
}

export async function GET(
  request: Request
) {
  try {
    const customer =
      await verifyCustomer(request);

    const submission =
      await getSubmissionForUser(
        customer.uid
      );

    if (!submission) {
      return NextResponse.json({
        success: true,
        submission: null,
      });
    }

    const durationDays = Number(
      submission.requestedDurationDays
    );
    const price = Number(
      submission.finalPrice
    );

    if (
      !Number.isFinite(price) ||
      price <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "This approved business campaign does not have a valid final price.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      submission: {
        submissionId: submission.id,
        businessName:
          submission.businessName || "",
        campaignName:
          submission.campaignName || "",
        requestedDurationDays: durationDays,
        price: price.toFixed(2),
        currency: "USD",
        paymentStatus:
          submission.paymentStatus ||
          "awaiting_payment",
      },
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "AUTH_REQUIRED"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "You must be signed in.",
        },
        { status: 401 }
      );
    }

    console.error(
      "Business advertising payment status error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Business advertising payment information could not be loaded.",
      },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request
) {
  try {
    const customer =
      await verifyCustomer(request);

    const body =
      await request.json();

    const action =
      body?.action === "create" ||
      body?.action === "capture"
        ? body.action
        : "";

    const submissionId =
      typeof body?.submissionId === "string"
        ? body.submissionId.trim()
        : "";

    if (!action || !submissionId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "A valid payment action and submission ID are required.",
        },
        { status: 400 }
      );
    }

    const submissionRef =
      adminDb
        .collection(
          "businessAdvertisingSubmissions"
        )
        .doc(submissionId);

    const snapshot =
      await submissionRef.get();

    if (!snapshot.exists) {
      return NextResponse.json(
        {
          success: false,
          error:
            "The business advertising submission was not found.",
        },
        { status: 404 }
      );
    }

    const submission =
      snapshot.data() || {};

    if (
      submission.advertiserUid !==
      customer.uid
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "You can only pay for your own business advertising submission.",
        },
        { status: 403 }
      );
    }

    if (
      submission.reviewStatus !==
      "approved"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "This business advertising campaign has not been approved for payment.",
        },
        { status: 400 }
      );
    }

    if (
      submission.paymentStatus ===
      "paid"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "This business advertising campaign has already been paid.",
        },
        { status: 400 }
      );
    }

    const durationDays =
      Number(
        submission.requestedDurationDays
      );

    const price =
      Number(
        submission.finalPrice
      );

    if (
      !Number.isFinite(price) ||
      price <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "This business campaign does not have a valid final price.",
        },
        { status: 400 }
      );
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
              Prefer:
                "return=representation",
              "PayPal-Request-Id":
                crypto.randomUUID(),
            },
            body: JSON.stringify({
              intent: "CAPTURE",
              purchase_units: [
                {
                  reference_id:
                    `business-advertising-${submissionId}`,
                  custom_id:
                    submissionId,
                  description:
                    "SOLO BEATS ENGINE MUSIC business advertising",
                  amount: {
                    currency_code:
                      "USD",
                    value:
                      price.toFixed(2),
                    breakdown: {
                      item_total: {
                        currency_code:
                          "USD",
                        value:
                          price.toFixed(2),
                      },
                    },
                  },
                  items: [
                    {
                      name:
                        `${submission.campaignName || "Business Advertising"} — ${durationDays} Days`.slice(
                          0,
                          127
                        ),
                      description:
                        `Sponsored placement for ${submission.businessName || "Business Advertiser"}`.slice(
                          0,
                          127
                        ),
                      sku:
                        `business-ad-${submissionId}`.slice(
                          0,
                          127
                        ),
                      quantity: "1",
                      category:
                        "DIGITAL_GOODS",
                      unit_amount: {
                        currency_code:
                          "USD",
                        value:
                          price.toFixed(2),
                      },
                    },
                  ],
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

      const order =
        await paypalResponse.json();

      if (
        !paypalResponse.ok ||
        !order.id
      ) {
        throw new Error(
          order?.details?.[0]
            ?.description ||
            order?.message ||
            "PayPal could not create the business advertising order."
        );
      }

      await submissionRef.set(
        {
          paymentStatus:
            "payment_started",
          paypalOrderId:
            order.id,
          businessAdvertisingPrice:
            price.toFixed(2),
          businessAdvertisingCurrency:
            "USD",
          updatedAt:
            FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      return NextResponse.json({
        success: true,
        orderId: order.id,
      });
    }

    const orderId =
      typeof body?.orderId === "string"
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

    const captureResponse =
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

    const captured =
      await captureResponse.json();

    if (!captureResponse.ok) {
      throw new Error(
        captured?.details?.[0]
          ?.description ||
          captured?.message ||
          "PayPal could not capture the business advertising payment."
      );
    }

    const purchaseUnit =
      captured.purchase_units?.[0];

    const paymentCapture =
      purchaseUnit?.payments
        ?.captures?.[0];

    if (
      captured.status !== "COMPLETED" ||
      paymentCapture?.status !==
        "COMPLETED"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "The business advertising payment was not completed.",
        },
        { status: 400 }
      );
    }

    const paidValue =
      paymentCapture.amount?.value;
    const paidCurrency =
      paymentCapture.amount
        ?.currency_code;

    if (
      paidValue !== price.toFixed(2) ||
      paidCurrency !== "USD"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "The captured business advertising amount is invalid.",
        },
        { status: 400 }
      );
    }

    const paymentRef =
      adminDb
        .collection(
          "businessAdvertisingPayments"
        )
        .doc(orderId);

    await adminDb.runTransaction(
      async (transaction) => {
        transaction.set(
          paymentRef,
          {
            orderId,
            captureId:
              paymentCapture.id ||
              null,
            submissionId,
            advertiserUid:
              customer.uid,
            advertiserEmail:
              customer.email ||
              null,
            durationDays,
            amount:
              price.toFixed(2),
            currency: "USD",
            status:
              "COMPLETED",
            createdAt:
              FieldValue.serverTimestamp(),
            updatedAt:
              FieldValue.serverTimestamp(),
            source:
              "solo-beats-engine-music-business-advertising",
          },
          { merge: true }
        );

        transaction.set(
          submissionRef,
          {
            paymentStatus:
              "paid",
            paymentOrderId:
              orderId,
            paymentCaptureId:
              paymentCapture.id ||
              null,
            paidAmount:
              price.toFixed(2),
            paidCurrency:
              "USD",
            paidAt:
              FieldValue.serverTimestamp(),
            placementStatus:
              "ready_to_schedule",
            updatedAt:
              FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      }
    );

    return NextResponse.json({
      success: true,
      paymentStatus: "paid",
      placementStatus:
        "ready_to_schedule",
      submissionId,
      orderId,
      captureId:
        paymentCapture.id ||
        null,
      amount:
        price.toFixed(2),
      currency: "USD",
      message:
        "Business advertising payment completed. The campaign is ready to be scheduled.",
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "AUTH_REQUIRED"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "You must be signed in.",
        },
        { status: 401 }
      );
    }

    console.error(
      "Business advertising payment error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "The business advertising payment could not be completed.",
      },
      { status: 500 }
    );
  }
}
