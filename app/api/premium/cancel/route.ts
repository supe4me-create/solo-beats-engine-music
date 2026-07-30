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
  "https://api-m.sandbox.paypal.com"
).replace(/\/+$/, "");

function getBearerToken(
  request: Request
): string | null {
  const authorization =
    request.headers.get("authorization");

  if (!authorization) {
    return null;
  }

  const match = authorization.match(
    /^Bearer\s+(.+)$/i
  );

  return match?.[1]?.trim() || null;
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

export async function POST(
  request: Request
) {
  try {
    const idToken = getBearerToken(request);

    if (!idToken) {
      return NextResponse.json(
        {
          success: false,
          error:
            "You must be signed in to cancel Premium.",
        },
        { status: 401 }
      );
    }

    const decodedToken = await getAuth(
      firebaseAdminApp
    ).verifyIdToken(idToken);

    const body = await request.json();
    const subscriptionId =
      body?.subscriptionId;

    if (
      !subscriptionId ||
      typeof subscriptionId !== "string"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "A valid PayPal subscription ID is required.",
        },
        { status: 400 }
      );
    }

    const subscriptionRef = adminDb
      .collection("premiumSubscriptions")
      .doc(decodedToken.uid);

    const snapshot =
      await subscriptionRef.get();

    if (!snapshot.exists) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No Premium subscription is linked to this account.",
        },
        { status: 404 }
      );
    }

    const subscriptionData =
      snapshot.data() || {};

    if (
      subscriptionData.paypalSubscriptionId !==
      subscriptionId
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "This subscription does not belong to the signed-in account.",
        },
        { status: 403 }
      );
    }

    if (
      subscriptionData.status === "CANCELLED"
    ) {
      return NextResponse.json({
        success: true,
        status: "CANCELLED",
        message:
          "This Premium subscription is already cancelled.",
      });
    }

    const accessToken =
      await getPayPalAccessToken();

    const paypalResponse = await fetch(
      `${PAYPAL_BASE_URL}/v1/billing/subscriptions/${encodeURIComponent(
        subscriptionId
      )}/cancel`,
      {
        method: "POST",
        headers: {
          Authorization:
            `Bearer ${accessToken}`,
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          reason:
            "Customer requested cancellation from SOLO BEATS ENGINE MUSIC.",
        }),
        cache: "no-store",
      }
    );

    if (
      !paypalResponse.ok &&
      paypalResponse.status !== 204
    ) {
      let paypalError: unknown = null;

      try {
        paypalError =
          await paypalResponse.json();
      } catch {
        paypalError = null;
      }

      console.error(
        "PayPal cancel subscription error:",
        paypalError
      );

      const message =
        typeof paypalError === "object" &&
        paypalError !== null &&
        "message" in paypalError &&
        typeof paypalError.message ===
          "string"
          ? paypalError.message
          : "PayPal could not cancel the subscription.";

      return NextResponse.json(
        {
          success: false,
          error: message,
        },
        {
          status:
            paypalResponse.status || 500,
        }
      );
    }

    await subscriptionRef.set(
      {
        status: "CANCELLED",
        premiumActive: false,
        cancelledAt:
          FieldValue.serverTimestamp(),
        cancellationSource:
          "customer-account",
        updatedAt:
          FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return NextResponse.json({
      success: true,
      status: "CANCELLED",
      subscriptionId,
      message:
        "SOLO BEATS PREMIUM has been cancelled.",
    });
  } catch (error) {
    console.error(
      "Cancel Premium error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "An unexpected cancellation error occurred.",
      },
      { status: 500 }
    );
  }
}
