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

const PROMOTION_PRICES: Record<number, number> = {
  7: 19.99,
  14: 34.99,
  30: 59.99,
};

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
    .collection("artistPromotionSubmissions")
    .where("artistUid", "==", uid)
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
        promotionDurationDays?: number | string;
        artistName?: string;
        songTitle?: string;
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
      submission.promotionDurationDays
    );
    const price =
      PROMOTION_PRICES[durationDays];

    if (!price) {
      return NextResponse.json(
        {
          success: false,
          error:
            "This approved promotion does not have a valid price.",
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      submission: {
        submissionId: submission.id,
        artistName:
          submission.artistName || "",
        songTitle:
          submission.songTitle || "",
        durationDays,
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
      "Artist promotion payment status error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Promotion payment information could not be loaded.",
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
          "artistPromotionSubmissions"
        )
        .doc(submissionId);

    const snapshot =
      await submissionRef.get();

    if (!snapshot.exists) {
      return NextResponse.json(
        {
          success: false,
          error:
            "The promotion submission was not found.",
        },
        { status: 404 }
      );
    }

    const submission =
      snapshot.data() || {};

    if (
      submission.artistUid !==
      customer.uid
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "You can only pay for your own submission.",
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
            "This promotion has not been approved for payment.",
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
            "This promotion has already been paid.",
        },
        { status: 400 }
      );
    }

    const durationDays =
      Number(
        submission.promotionDurationDays
      );

    const price =
      PROMOTION_PRICES[durationDays];

    if (!price) {
      return NextResponse.json(
        {
          success: false,
          error:
            "This promotion duration does not have a valid price.",
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
                    `artist-promotion-${submissionId}`,
                  custom_id:
                    submissionId,
                  description:
                    "SOLO BEATS ENGINE MUSIC artist promotion",
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
                        `${submission.songTitle || "Artist Promotion"} — ${durationDays} Days`.slice(
                          0,
                          127
                        ),
                      description:
                        `Promoted placement for ${submission.artistName || "Independent Artist"}`.slice(
                          0,
                          127
                        ),
                      sku:
                        `promotion-${submissionId}`.slice(
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
            "PayPal could not create the promotion order."
        );
      }

      await submissionRef.set(
        {
          paymentStatus:
            "payment_started",
          paypalOrderId:
            order.id,
          promotionPrice:
            price.toFixed(2),
          promotionCurrency:
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
          "PayPal could not capture the promotion payment."
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
            "The promotion payment was not completed.",
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
            "The captured promotion amount is invalid.",
        },
        { status: 400 }
      );
    }

    const paymentRef =
      adminDb
        .collection(
          "artistPromotionPayments"
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
            artistUid:
              customer.uid,
            artistEmail:
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
              "solo-beats-engine-music-artist-promotion",
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

    
  // OWNER_NOTIFICATION_ARTIST_PAYMENT
  await adminDb
    .collection("ownerNotifications")
    .doc(`artist-payment-${orderId}`)
    .set(
      {
        type: "artist_promotion_payment_received",
        category: "artist_promotion",
        title: "Artist Promotion Payment Received",
        message: `Artist Promotion payment of $${price.toFixed(2)} USD was received.`,
        targetUrl: "/developer",
        relatedId: submissionId,
        read: false,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
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
        "Promotion payment completed. The campaign is ready to be scheduled.",
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
      "Artist promotion payment error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "The promotion payment could not be completed.",
      },
      { status: 500 }
    );
  }
}
