import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "../../../../lib/firebaseAdmin";

const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
const PAYPAL_BASE_URL = (
  process.env.PAYPAL_BASE_URL ||
  "https://api-m.sandbox.paypal.com"
).replace(/\/+$/, "");
const PAYPAL_WEBHOOK_ID = process.env.PAYPAL_PREMIUM_WEBHOOK_ID;

type PayPalWebhookEvent = {
  id?: string;
  event_type?: string;
  create_time?: string;
  resource?: {
    id?: string;
    status?: string;
    plan_id?: string;
    billing_agreement_id?: string;
    amount?: {
      value?: string;
      currency_code?: string;
    };
    billing_info?: {
      next_billing_time?: string;
    };
  };
};

async function getPayPalAccessToken() {
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
    throw new Error(
      data.error_description ||
        "PayPal authentication failed."
    );
  }

  return data.access_token as string;
}

async function verifyWebhookSignature(
  request: Request,
  event: PayPalWebhookEvent
) {
  if (!PAYPAL_WEBHOOK_ID) {
    throw new Error(
      "PAYPAL_PREMIUM_WEBHOOK_ID is missing from .env.local."
    );
  }

  const transmissionId =
    request.headers.get("paypal-transmission-id");
  const transmissionTime =
    request.headers.get("paypal-transmission-time");
  const transmissionSig =
    request.headers.get("paypal-transmission-sig");
  const certUrl =
    request.headers.get("paypal-cert-url");
  const authAlgo =
    request.headers.get("paypal-auth-algo");

  if (
    !transmissionId ||
    !transmissionTime ||
    !transmissionSig ||
    !certUrl ||
    !authAlgo
  ) {
    return false;
  }

  const accessToken =
    await getPayPalAccessToken();

  const response = await fetch(
    `${PAYPAL_BASE_URL}/v1/notifications/verify-webhook-signature`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        auth_algo: authAlgo,
        cert_url: certUrl,
        transmission_id: transmissionId,
        transmission_sig: transmissionSig,
        transmission_time: transmissionTime,
        webhook_id: PAYPAL_WEBHOOK_ID,
        webhook_event: event,
      }),
      cache: "no-store",
    }
  );

  const data = await response.json();

  return (
    response.ok &&
    data.verification_status === "SUCCESS"
  );
}

function getSubscriptionId(
  event: PayPalWebhookEvent
) {
  if (
    event.event_type?.startsWith(
      "BILLING.SUBSCRIPTION."
    )
  ) {
    return event.resource?.id || null;
  }

  if (
    event.event_type?.startsWith(
      "PAYMENT.SALE."
    )
  ) {
    return (
      event.resource?.billing_agreement_id ||
      null
    );
  }

  return null;
}

async function findSubscriptionDocument(
  subscriptionId: string
) {
  const snapshot = await adminDb
    .collection("premiumSubscriptions")
    .where(
      "paypalSubscriptionId",
      "==",
      subscriptionId
    )
    .limit(1)
    .get();

  return snapshot.empty
    ? null
    : snapshot.docs[0];
}

export async function POST(
  request: Request
) {
  try {
    const event =
      (await request.json()) as PayPalWebhookEvent;

    const verified =
      await verifyWebhookSignature(
        request,
        event
      );

    if (!verified) {
      return NextResponse.json(
        {
          success: false,
          error:
            "PayPal webhook signature verification failed.",
        },
        { status: 400 }
      );
    }

    const eventType =
      event.event_type || "";
    const subscriptionId =
      getSubscriptionId(event);

    if (!subscriptionId) {
      return NextResponse.json({
        success: true,
        ignored: true,
      });
    }

    const document =
      await findSubscriptionDocument(
        subscriptionId
      );

    if (!document) {
      return NextResponse.json({
        success: true,
        ignored: true,
      });
    }

    const updates: Record<string, unknown> = {
      lastWebhookEventId:
        event.id || null,
      lastWebhookEventType: eventType,
      lastWebhookAt:
        FieldValue.serverTimestamp(),
      updatedAt:
        FieldValue.serverTimestamp(),
    };

    switch (eventType) {
      case "BILLING.SUBSCRIPTION.ACTIVATED":
      case "BILLING.SUBSCRIPTION.RE-ACTIVATED":
        updates.status = "ACTIVE";
        updates.premiumActive = true;
        break;

      case "BILLING.SUBSCRIPTION.CANCELLED":
        updates.status = "CANCELLED";
        updates.premiumActive = false;
        updates.cancelledAt =
          FieldValue.serverTimestamp();
        break;

      case "BILLING.SUBSCRIPTION.SUSPENDED":
        updates.status = "SUSPENDED";
        updates.premiumActive = false;
        updates.suspendedAt =
          FieldValue.serverTimestamp();
        break;

      case "BILLING.SUBSCRIPTION.EXPIRED":
        updates.status = "EXPIRED";
        updates.premiumActive = false;
        updates.expiredAt =
          FieldValue.serverTimestamp();
        break;

      case "BILLING.SUBSCRIPTION.PAYMENT.FAILED":
        updates.status = "PAYMENT_FAILED";
        updates.premiumActive = false;
        updates.lastPaymentIssue =
          eventType;
        updates.lastPaymentIssueAt =
          FieldValue.serverTimestamp();
        break;

      case "PAYMENT.SALE.COMPLETED":
        updates.status = "ACTIVE";
        updates.premiumActive = true;
        updates.lastPaymentAt =
          event.create_time || null;
        updates.lastPaymentAmount =
          event.resource?.amount?.value ||
          null;
        updates.lastPaymentCurrency =
          event.resource?.amount
            ?.currency_code || "USD";
        updates.renewalCount =
          FieldValue.increment(1);
        break;

      case "PAYMENT.SALE.REFUNDED":
      case "PAYMENT.SALE.REVERSED":
        updates.lastPaymentIssue =
          eventType;
        updates.lastPaymentIssueAt =
          FieldValue.serverTimestamp();
        break;

      default:
        return NextResponse.json({
          success: true,
          ignored: true,
        });
    }

    if (
      event.resource?.billing_info
        ?.next_billing_time
    ) {
      updates.nextBillingTime =
        event.resource.billing_info
          .next_billing_time;
    }

    await document.ref.set(
      updates,
      { merge: true }
    );

    
  // OWNER_NOTIFICATION_PREMIUM_EVENTS
  let ownerNotification:
    | {
        type: string;
        category: string;
        title: string;
        message: string;
      }
    | null = null;

  switch (eventType) {
    case "BILLING.SUBSCRIPTION.ACTIVATED":
    case "BILLING.SUBSCRIPTION.RE-ACTIVATED":
      ownerNotification = {
        type: "premium_activated",
        category: "premium",
        title: "Premium Activated",
        message: "A Premium subscription was activated.",
      };
      break;

    case "PAYMENT.SALE.COMPLETED":
      ownerNotification = {
        type: "premium_payment_completed",
        category: "premium",
        title: "Premium Payment Completed",
        message: "A Premium subscription payment was completed successfully.",
      };
      break;

    case "BILLING.SUBSCRIPTION.CANCELLED":
      ownerNotification = {
        type: "premium_cancelled",
        category: "premium",
        title: "Premium Cancelled",
        message: "A Premium subscription was cancelled.",
      };
      break;

    case "BILLING.SUBSCRIPTION.SUSPENDED":
      ownerNotification = {
        type: "premium_suspended",
        category: "premium",
        title: "Premium Suspended",
        message: "A Premium subscription was suspended.",
      };
      break;

    case "BILLING.SUBSCRIPTION.EXPIRED":
      ownerNotification = {
        type: "premium_expired",
        category: "premium",
        title: "Premium Expired",
        message: "A Premium subscription expired.",
      };
      break;

    case "BILLING.SUBSCRIPTION.PAYMENT.FAILED":
      ownerNotification = {
        type: "premium_payment_failed",
        category: "premium",
        title: "Premium Payment Failed",
        message: "A Premium subscription payment failed.",
      };
      break;
  }

  if (ownerNotification) {
    const notificationId =
      typeof event.id === "string" && event.id.length > 0
        ? `premium-${event.id}`
        : `premium-${subscriptionId}-${eventType.replace(
            /[^A-Za-z0-9._-]/g,
            "-"
          )}`;

    await adminDb
      .collection("ownerNotifications")
      .doc(notificationId)
      .set(
        {
          ...ownerNotification,
          targetUrl: "/developer",
          relatedId: subscriptionId,
          read: false,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
  }
return NextResponse.json({
      success: true,
      eventType,
      subscriptionId,
    });
  } catch (error) {
    console.error(
      "PayPal Premium webhook error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "An unexpected webhook error occurred.",
      },
      { status: 500 }
    );
  }
}
