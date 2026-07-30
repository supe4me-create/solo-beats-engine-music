import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb, firebaseAdminApp } from "../../../../lib/firebaseAdmin";

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
const PAYPAL_BASE_URL = (process.env.PAYPAL_BASE_URL || "https://api-m.paypal.com").replace(/\/+$/, "");
const PREMIUM_PLAN_ID = process.env.NEXT_PUBLIC_PAYPAL_PREMIUM_PLAN_ID;

const PAYPAL_ENVIRONMENT =
  PAYPAL_BASE_URL.includes("sandbox")
    ? "sandbox"
    : "live";

function getBearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  if (!authorization) return null;
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

async function getPayPalAccessToken() {
  if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
    throw new Error("PayPal server credentials are missing.");
  }

  const credentials = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString("base64");
  const response = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });

  const data = await response.json();
  if (!response.ok || !data.access_token) {
    console.error("PayPal access-token error:", data);
    throw new Error(data.error_description || "PayPal authentication failed.");
  }

  return data.access_token as string;
}

export async function POST(request: Request) {
  try {
    const idToken = getBearerToken(request);
    if (!idToken) {
      return NextResponse.json({ success: false, error: "You must be signed in to activate Premium." }, { status: 401 });
    }

    if (!PREMIUM_PLAN_ID) throw new Error("The Premium PayPal plan ID is missing.");

    const decodedToken = await getAuth(firebaseAdminApp).verifyIdToken(idToken);
    const body = await request.json();
    const subscriptionId = body?.subscriptionId;

    if (!subscriptionId || typeof subscriptionId !== "string") {
      return NextResponse.json({ success: false, error: "A valid PayPal subscription ID is required." }, { status: 400 });
    }

    const accessToken = await getPayPalAccessToken();
    const paypalResponse = await fetch(`${PAYPAL_BASE_URL}/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    const subscription = await paypalResponse.json();
    if (!paypalResponse.ok) {
      console.error("PayPal subscription verification error:", subscription);
      return NextResponse.json({
        success: false,
        error: subscription?.details?.[0]?.description || subscription?.message || "PayPal could not verify the subscription.",
      }, { status: paypalResponse.status || 500 });
    }

    if (subscription.plan_id !== PREMIUM_PLAN_ID) {
      return NextResponse.json({ success: false, error: "This PayPal subscription does not match the SOLO BEATS PREMIUM plan." }, { status: 400 });
    }

    if (!["ACTIVE", "APPROVAL_PENDING"].includes(subscription.status)) {
      return NextResponse.json({ success: false, error: `Subscription status is ${subscription.status}.` }, { status: 400 });
    }

    const customerEmail = typeof decodedToken.email === "string" ? decodedToken.email.toLowerCase() : null;

    await adminDb.collection("premiumSubscriptions").doc(decodedToken.uid).set({
      customerUid: decodedToken.uid,
      customerEmail,
      customerDisplayName: typeof decodedToken.name === "string" ? decodedToken.name : null,
      paypalSubscriptionId: subscription.id,
      paypalPlanId: subscription.plan_id,
      status: subscription.status,
      premiumActive: subscription.status === "ACTIVE",
      subscriberEmail: subscription.subscriber?.email_address || null,
      subscriberName: subscription.subscriber?.name
        ? `${subscription.subscriber.name.given_name || ""} ${subscription.subscriber.name.surname || ""}`.trim()
        : null,
      startTime: subscription.start_time || null,
      nextBillingTime: subscription.billing_info?.next_billing_time || null,
      lastPaymentAmount: subscription.billing_info?.last_payment?.amount?.value || null,
      lastPaymentCurrency: subscription.billing_info?.last_payment?.amount?.currency_code || "USD",
      environment: PAYPAL_ENVIRONMENT,
      billingEnvironment: PAYPAL_ENVIRONMENT,
      source: "solo-beats-engine-music-premium",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    return NextResponse.json({
      success: true,
      subscriptionId: subscription.id,
      status: subscription.status,
      premiumActive: subscription.status === "ACTIVE",
      planId: subscription.plan_id,
      message: subscription.status === "ACTIVE"
        ? "SOLO BEATS PREMIUM is active."
        : "The subscription was created and is awaiting final PayPal approval.",
    });
  } catch (error) {
    console.error("Verify PayPal subscription error:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "An unexpected subscription verification error occurred.",
    }, { status: 500 });
  }
}
