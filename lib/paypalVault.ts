import { FieldValue } from "firebase-admin/firestore";

import { adminDb } from "./firebaseAdmin";

const PAYPAL_CLIENT_ID =
  process.env.PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET =
  process.env.PAYPAL_CLIENT_SECRET;

export const PAYPAL_BASE_URL = (
  process.env.PAYPAL_BASE_URL ||
  "https://api-m.paypal.com"
).replace(/\/+$/, "");

export type SavedPayPalMethod = {
  vaultId: string;
  customerId: string | null;
  methodType: "paypal" | "card";
  brand: string | null;
  lastDigits: string | null;
};

export async function getPayPalAccessToken() {
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

export async function saveVaultProfile({
  uid,
  email,
  vaultId,
  customerId,
  methodType,
  brand,
  lastDigits,
}: {
  uid: string;
  email: string | null;
  vaultId: string;
  customerId: string | null;
  methodType: "paypal" | "card";
  brand?: string | null;
  lastDigits?: string | null;
}) {
  await adminDb
    .collection("paypalVaultProfiles")
    .doc(uid)
    .set(
      {
        uid,
        email,
        vaultId,
        paypalCustomerId:
          customerId || null,
        methodType,
        brand: brand || null,
        lastDigits:
          lastDigits || null,
        status: "active",
        updatedAt:
          FieldValue.serverTimestamp(),
        createdAt:
          FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
}

export async function getSavedMethod(
  uid: string
): Promise<SavedPayPalMethod | null> {
  const snapshot = await adminDb
    .collection("paypalVaultProfiles")
    .doc(uid)
    .get();

  if (!snapshot.exists) {
    return null;
  }

  const data = snapshot.data() || {};

  if (
    data.status !== "active" ||
    typeof data.vaultId !== "string" ||
    !data.vaultId.trim()
  ) {
    return null;
  }

  return {
    vaultId: data.vaultId.trim(),
    customerId:
      typeof data.paypalCustomerId ===
      "string"
        ? data.paypalCustomerId
        : null,
    methodType:
      data.methodType === "card"
        ? "card"
        : "paypal",
    brand:
      typeof data.brand === "string"
        ? data.brand
        : null,
    lastDigits:
      typeof data.lastDigits === "string"
        ? data.lastDigits
        : null,
  };
}

function paymentSourceForSavedMethod(
  method: SavedPayPalMethod
) {
  if (method.methodType === "card") {
    return {
      card: {
        vault_id: method.vaultId,
        stored_credential: {
          payment_initiator:
            "MERCHANT",
          payment_type:
            "UNSCHEDULED",
          usage: "SUBSEQUENT",
        },
      },
    };
  }

  return {
    paypal: {
      vault_id: method.vaultId,
    },
  };
}

export async function chargeSavedMethod({
  uid,
  submissionId,
  amount,
  campaignName,
}: {
  uid: string;
  submissionId: string;
  amount: string;
  campaignName: string;
}) {
  const method =
    await getSavedMethod(uid);

  if (!method) {
    return {
      success: false as const,
      reason:
        "NO_SAVED_PAYMENT_METHOD",
      error:
        "No authorized saved payment method is available.",
    };
  }

  const accessToken =
    await getPayPalAccessToken();

  const createResponse = await fetch(
    `${PAYPAL_BASE_URL}/v2/checkout/orders`,
    {
      method: "POST",
      headers: {
        Authorization:
          `Bearer ${accessToken}`,
        "Content-Type":
          "application/json",
        Prefer: "return=representation",
        "PayPal-Request-Id":
          crypto.randomUUID(),
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            reference_id:
              `business-advertising-${submissionId}`,
            custom_id: submissionId,
            description:
              "SOLO BEATS ENGINE MUSIC business advertising",
            amount: {
              currency_code: "USD",
              value: amount,
            },
          },
        ],
        payment_source:
          paymentSourceForSavedMethod(
            method
          ),
      }),
      cache: "no-store",
    }
  );

  const order =
    await createResponse.json();

  if (!createResponse.ok) {
    return {
      success: false as const,
      reason:
        "SAVED_METHOD_CHARGE_FAILED",
      error:
        order?.details?.[0]
          ?.description ||
        order?.message ||
        "The saved payment method could not be charged.",
    };
  }

  let completedOrder = order;

  if (
    completedOrder.status !==
      "COMPLETED" &&
    completedOrder.id
  ) {
    const captureResponse =
      await fetch(
        `${PAYPAL_BASE_URL}/v2/checkout/orders/${encodeURIComponent(
          completedOrder.id
        )}/capture`,
        {
          method: "POST",
          headers: {
            Authorization:
              `Bearer ${accessToken}`,
            "Content-Type":
              "application/json",
            "PayPal-Request-Id":
              crypto.randomUUID(),
          },
          cache: "no-store",
        }
      );

    completedOrder =
      await captureResponse.json();

    if (!captureResponse.ok) {
      return {
        success: false as const,
        reason:
          "SAVED_METHOD_CHARGE_FAILED",
        error:
          completedOrder?.details?.[0]
            ?.description ||
          completedOrder?.message ||
          "The saved payment method could not be charged.",
      };
    }
  }

  const capture =
    completedOrder.purchase_units?.[0]
      ?.payments?.captures?.[0];

  if (
    completedOrder.status !==
      "COMPLETED" ||
    capture?.status !== "COMPLETED"
  ) {
    return {
      success: false as const,
      reason:
        "CUSTOMER_ACTION_REQUIRED",
      error:
        "PayPal requires the customer to complete checkout again.",
    };
  }

  if (
    capture.amount?.value !== amount ||
    capture.amount?.currency_code !==
      "USD"
  ) {
    return {
      success: false as const,
      reason:
        "AMOUNT_MISMATCH",
      error:
        "The saved-method payment amount did not match the campaign price.",
    };
  }

  return {
    success: true as const,
    orderId:
      completedOrder.id as string,
    captureId:
      (capture.id as string) || null,
    amount,
    currency: "USD",
    methodType: method.methodType,
    campaignName,
  };
}
