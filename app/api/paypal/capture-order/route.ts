import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";
import {
  adminDb,
  firebaseAdminApp,
} from "../../../../lib/firebaseAdmin";

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;

const PAYPAL_BASE_URL = (
  process.env.PAYPAL_BASE_URL || "https://api-m.paypal.com"
).replace(/\/+$/, "");

type PayPalPurchasedItem = {
  name?: string;
  description?: string;
  sku?: string;
  quantity?: string;
  unit_amount?: {
    currency_code?: string;
    value?: string;
  };
};

type ParsedPurchasedItem = {
  name: string;
  description: string | null;
  sku: string | null;
  itemType: "album" | "track" | null;
  itemId: string | null;
  quantity: number;
  unitAmount: string | null;
  currency: string;
};

type VerifiedCustomer = {
  uid: string;
  email: string | null;
  name: string | null;
  emailVerified: boolean;
  provider: string | null;
};

function parsePurchasedItemSku(sku?: string) {
  if (!sku) {
    return {
      itemType: null,
      itemId: null,
    };
  }

  if (sku.startsWith("album-")) {
    return {
      itemType: "album" as const,
      itemId: sku.slice("album-".length),
    };
  }

  if (sku.startsWith("track-")) {
    return {
      itemType: "track" as const,
      itemId: sku.slice("track-".length),
    };
  }

  return {
    itemType: null,
    itemId: null,
  };
}

function parsePurchasedItems(
  items?: PayPalPurchasedItem[]
): ParsedPurchasedItem[] {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.map((item) => {
    const parsedSku = parsePurchasedItemSku(item.sku);

    return {
      name: item.name || "Music purchase",
      description: item.description || null,
      sku: item.sku || null,
      itemType: parsedSku.itemType,
      itemId: parsedSku.itemId,
      quantity: Number(item.quantity || 1),
      unitAmount: item.unit_amount?.value || null,
      currency: item.unit_amount?.currency_code || "USD",
    };
  });
}

function getBearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization");

  if (!authorization) {
    return null;
  }

  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

async function verifySignedInCustomer(
  request: Request
): Promise<VerifiedCustomer | null> {
  const idToken = getBearerToken(request);

  /*
   * Authentication remains optional so old completed purchases can still
   * be restored by order ID. New signed-in purchases will include the token
   * and will be connected automatically to My Music.
   */
  if (!idToken) {
    return null;
  }

  try {
    const decodedToken = await getAuth(
      firebaseAdminApp
    ).verifyIdToken(idToken);

    const provider =
      typeof decodedToken.firebase?.sign_in_provider === "string"
        ? decodedToken.firebase.sign_in_provider
        : null;

    return {
      uid: decodedToken.uid,
      email:
        typeof decodedToken.email === "string"
          ? decodedToken.email.toLowerCase()
          : null,
      name:
        typeof decodedToken.name === "string"
          ? decodedToken.name
          : null,
      emailVerified: decodedToken.email_verified === true,
      provider,
    };
  } catch (error) {
    console.error("Firebase ID-token verification failed:", error);

    throw new Error(
      "Your account session could not be verified. Please sign in again."
    );
  }
}

async function getPayPalAccessToken(): Promise<string> {
  if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
    throw new Error("PayPal server credentials are missing.");
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
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
      cache: "no-store",
    }
  );

  const data = await response.json();

  if (!response.ok || !data.access_token) {
    console.error("PayPal authentication response:", data);

    throw new Error(
      data.error_description ||
        "PayPal authentication failed."
    );
  }

  return data.access_token as string;
}

async function getPayPalOrder(
  orderId: string,
  accessToken: string
) {
  const response = await fetch(
    `${PAYPAL_BASE_URL}/v2/checkout/orders/${encodeURIComponent(
      orderId
    )}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    }
  );

  const data = await response.json();

  if (!response.ok) {
    console.error("PayPal order-details response:", data);

    throw new Error(
      data?.details?.[0]?.description ||
        data?.message ||
        "PayPal could not retrieve the order details."
    );
  }

  return data;
}

async function capturePayPalOrder(
  orderId: string,
  accessToken: string
) {
  const response = await fetch(
    `${PAYPAL_BASE_URL}/v2/checkout/orders/${encodeURIComponent(
      orderId
    )}/capture`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    }
  );

  const data = await response.json();

  if (!response.ok) {
    console.error("PayPal capture response:", data);

    throw new Error(
      data?.details?.[0]?.description ||
        data?.message ||
        "PayPal could not complete the payment."
    );
  }

  return data;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const orderId = body?.orderId;

    if (!orderId || typeof orderId !== "string") {
      return NextResponse.json(
        {
          success: false,
          error: "A valid PayPal order ID is required.",
        },
        { status: 400 }
      );
    }

    const signedInCustomer =
      await verifySignedInCustomer(request);

    const accessToken = await getPayPalAccessToken();

    /*
     * Retrieve the order before capture because the order-details
     * response contains the original line items and their SKUs.
     */
    const originalOrder = await getPayPalOrder(
      orderId,
      accessToken
    );

    const originalPurchaseUnit =
      originalOrder.purchase_units?.[0];

    const purchasedItems = parsePurchasedItems(
      originalPurchaseUnit?.items
    );

    if (purchasedItems.length === 0) {
      console.error(
        "PayPal order contained no line items:",
        originalOrder
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "The PayPal order contains no identifiable music items.",
        },
        { status: 400 }
      );
    }

    const invalidItems = purchasedItems.filter(
      (item) => !item.itemType || !item.itemId
    );

    if (invalidItems.length > 0) {
      console.error(
        "Purchase contains invalid item identifiers:",
        invalidItems
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "One or more purchased items could not be identified securely.",
        },
        { status: 400 }
      );
    }

    /*
     * Do not attempt to charge an order twice.
     * If it is already completed, use its existing payment details.
     */
    let completedOrder = originalOrder;

    if (originalOrder.status !== "COMPLETED") {
      await capturePayPalOrder(orderId, accessToken);

      /*
       * Retrieve the completed order again so we have the final
       * payer, capture and payment information.
       */
      completedOrder = await getPayPalOrder(
        orderId,
        accessToken
      );
    }

    if (completedOrder.status !== "COMPLETED") {
      return NextResponse.json(
        {
          success: false,
          error: `Payment status is ${completedOrder.status}.`,
        },
        { status: 400 }
      );
    }

    const completedPurchaseUnit =
      completedOrder.purchase_units?.[0];

    const paymentCapture =
      completedPurchaseUnit?.payments?.captures?.[0];

    if (
      !paymentCapture ||
      paymentCapture.status !== "COMPLETED"
    ) {
      console.error(
        "PayPal payment capture was not completed:",
        completedOrder
      );

      return NextResponse.json(
        {
          success: false,
          error:
            "The PayPal payment capture was not completed.",
        },
        { status: 400 }
      );
    }

    const payerEmail =
      completedOrder.payer?.email_address || null;

    const payerName = completedOrder.payer?.name
      ? `${completedOrder.payer.name.given_name || ""} ${
          completedOrder.payer.name.surname || ""
        }`.trim()
      : null;

    const totalAmount =
      paymentCapture.amount?.value ||
      completedPurchaseUnit?.amount?.value ||
      originalPurchaseUnit?.amount?.value ||
      null;

    const currency =
      paymentCapture.amount?.currency_code ||
      completedPurchaseUnit?.amount?.currency_code ||
      originalPurchaseUnit?.amount?.currency_code ||
      "USD";

    const purchaseRef = adminDb
      .collection("purchases")
      .doc(completedOrder.id);

    const existingPurchase = await purchaseRef.get();

    const purchaseRecord = {
      orderId: completedOrder.id,
      paymentCaptureId: paymentCapture.id || null,
      paymentStatus: completedOrder.status,
      paymentCaptureStatus: paymentCapture.status,
      payerEmail,
      payerName,
      payerId:
        completedOrder.payer?.payer_id || null,
      amount: totalAmount,
      currency,
      items: purchasedItems,
      paypalCreateTime:
        completedOrder.create_time ||
        originalOrder.create_time ||
        null,
      paypalUpdateTime:
        completedOrder.update_time || null,

      /*
       * These fields connect a purchase to Firebase Authentication.
       * They are written only when the request includes a valid signed-in
       * user's Firebase ID token.
       */
      ...(signedInCustomer
        ? {
            customerUid: signedInCustomer.uid,
            customerEmail: signedInCustomer.email,
            customerDisplayName: signedInCustomer.name,
            customerEmailVerified:
              signedInCustomer.emailVerified,
            customerAuthProvider:
              signedInCustomer.provider,
            accountLinkedAt:
              FieldValue.serverTimestamp(),
          }
        : {}),

      ...(existingPurchase.exists
        ? {}
        : {
            createdAt: FieldValue.serverTimestamp(),
            deliveryStatus: "pending",
            downloadAccessGranted: false,
            downloadCount: 0,
            lastDownloadAt: null,
          }),

      updatedAt: FieldValue.serverTimestamp(),
      source: "solo-beats-engine-music-store",
    };

    await purchaseRef.set(purchaseRecord, {
      merge: true,
    });

    return NextResponse.json({
      success: true,
      orderId: completedOrder.id,
      captureId: paymentCapture.id || null,
      status: completedOrder.status,
      paymentCaptureStatus: paymentCapture.status,
      amount: totalAmount,
      currency,
      payerEmail,
      items: purchasedItems,
      accountLinked: Boolean(signedInCustomer),
      customerUid: signedInCustomer?.uid || null,
      message: signedInCustomer
        ? "Payment completed, purchase recorded, and added to your My Music account."
        : "Payment completed and purchase recorded securely.",
    });
  } catch (error) {
    console.error(
      "Capture PayPal order error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "An unexpected payment-capture error occurred.",
      },
      { status: 500 }
    );
  }
}
