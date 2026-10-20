import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";

import {
  adminDb,
  firebaseAdminApp,
} from "../../../../../lib/firebaseAdmin";

import {
  DJ_POLICY_CLAIM,
  readDjPolicy,
  type DjPolicy,
} from "../../../../../lib/djAccessPolicy";

import {
  RADIO_DJ_CLAIM,
  radioAccount,
  radioAccessFailure,
  RadioAccessError,
} from "../../../../../lib/radioDjAccess";

import {
  PAYPAL_BASE_URL,
  getPayPalAccessToken,
  getDjPayPalPlanConfig,
  planFromPaypalId,
  addMonths,
} from "../../../../../lib/djPayPal";

export const runtime = "nodejs";

// SOLO_DJ_AUTO_PAID_ACTIVATION_V2
export async function POST(request: Request) {
  try {
    const { account, owner } =
      await radioAccount(request);

    if (
      !owner &&
      account.customClaims
        ?.soloBeatsRadioDj !== true
    ) {
      throw new RadioAccessError(
        "Your DJ application must be approved before choosing a paid plan.",
        403
      );
    }

    if (!account.emailVerified && !owner) {
      throw new RadioAccessError(
        "Verify your email before paying for DJ access.",
        400
      );
    }

    const raw = await request.text();

    if (raw.length > 4096) {
      throw new RadioAccessError(
        "Request too large.",
        400
      );
    }

    let body: {
      subscriptionId?: unknown;
    };

    try {
      body = JSON.parse(raw);
    } catch {
      throw new RadioAccessError(
        "Invalid request.",
        400
      );
    }

    const subscriptionId =
      typeof body.subscriptionId === "string"
        ? body.subscriptionId.trim()
        : "";

    if (
      !subscriptionId ||
      subscriptionId.length > 128
    ) {
      throw new RadioAccessError(
        "Invalid PayPal subscription.",
        400
      );
    }

    const config =
      await getDjPayPalPlanConfig();

    if (!config) {
      throw new RadioAccessError(
        "DJ payment plans have not been initialized by the owner yet.",
        409
      );
    }

    const accessToken =
      await getPayPalAccessToken();

    const paypalResponse =
      await fetch(
        `${PAYPAL_BASE_URL}/v1/billing/subscriptions/${encodeURIComponent(
          subscriptionId
        )}`,
        {
          headers: {
            Authorization:
              `Bearer ${accessToken}`,
          },
          cache: "no-store",
        }
      );

    const subscription =
      await paypalResponse.json();

    if (!paypalResponse.ok) {
      throw new RadioAccessError(
        subscription?.details?.[0]
          ?.description ||
          subscription?.message ||
          "PayPal could not verify the DJ subscription.",
        paypalResponse.status || 500
      );
    }

    const plan =
      planFromPaypalId(
        config,
        subscription.plan_id
      );

    if (!plan) {
      throw new RadioAccessError(
        "This PayPal subscription does not match a SOLO BEATS DJ plan.",
        400
      );
    }

    if (
      subscription.status !==
      "ACTIVE"
    ) {
      throw new RadioAccessError(
        `PayPal subscription is ${subscription.status}. Access activates automatically when PayPal confirms the subscription as ACTIVE.`,
        409
      );
    }

    const duplicate =
      await adminDb
        .collection("djSubscriptions")
        .where(
          "paypalSubscriptionId",
          "==",
          subscription.id
        )
        .limit(1)
        .get();

    if (
      !duplicate.empty &&
      duplicate.docs[0].id !==
        account.uid
    ) {
      throw new RadioAccessError(
        "This PayPal subscription is already connected to another account.",
        409
      );
    }

    const auth =
      getAuth(firebaseAdminApp);

    const target =
      await auth.getUser(
        account.uid
      );

    if (
      target.disabled ||
      (
        !target.emailVerified &&
        !owner
      )
    ) {
      throw new RadioAccessError(
        "The DJ account must be enabled and email verified.",
        409
      );
    }

    const claims = {
      ...(target.customClaims || {}),
    };

    const now = Date.now();

    const policy: DjPolicy = {
      v: 1,
      type: "paid",
      state: "active",
      start: now,
      end: addMonths(
        now,
        plan.months
      ),
      paidApproved: true,
    };

    if (!readDjPolicy(policy)) {
      throw new RadioAccessError(
        "Generated DJ paid-access policy is invalid.",
        500
      );
    }

    claims[RADIO_DJ_CLAIM] = true;
    claims[DJ_POLICY_CLAIM] =
      policy;

    if (
      Buffer.byteLength(
        JSON.stringify(claims),
        "utf8"
      ) > 1000
    ) {
      throw new RadioAccessError(
        "Account permission storage is full.",
        409
      );
    }

    await auth.setCustomUserClaims(
      account.uid,
      claims
    );

    const subscriberEmail =
      subscription.subscriber
        ?.email_address ||
      null;

    const lastPaymentTime =
      subscription.billing_info
        ?.last_payment?.time ||
      null;

    const coveredPaymentTime =
      lastPaymentTime ||
      new Date().toISOString();

    await adminDb
      .collection("djSubscriptions")
      .doc(account.uid)
      .set(
        {
          customerUid:
            account.uid,

          customerEmail:
            account.email?.toLowerCase() ||
            null,

          paypalSubscriptionId:
            subscription.id,

          paypalPlanId:
            subscription.plan_id,

          planKey:
            plan.key,

          planName:
            plan.name,

          planPrice:
            plan.price,

          planMonths:
            plan.months,

          status:
            subscription.status,

          ownerApproved: true,

          pendingOwnerApproval: false,

          ownerDecision:
            "auto_activated_after_payment",

          subscriberEmail,

          startTime:
            subscription.start_time ||
            null,

          currentPeriodStart:
            now,

          currentPeriodEnd:
            policy.end,

          nextBillingTime:
            subscription.billing_info
              ?.next_billing_time ||
            null,

          lastPaymentAt:
            lastPaymentTime,

          coveredPaymentTime,

          environment:
            PAYPAL_BASE_URL.includes(
              "sandbox"
            )
              ? "sandbox"
              : "live",

          source:
            "solo-beats-dj-access",

          activatedAt:
            FieldValue.serverTimestamp(),

          updatedAt:
            FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

    await adminDb
      .collection("ownerNotifications")
      .doc(
        `dj-payment-${account.uid}-${subscription.id}`
      )
      .set(
        {
          type:
            "dj_payment_activated",

          category:
            "dj",

          title:
            "DJ Paid Access Activated",

          message:
            `${account.email || "A DJ"} paid for ${plan.name} ($${plan.price}). DJ access activated automatically.`,

          targetUrl:
            "/developer/radio",

          relatedId:
            account.uid,

          read: false,

          createdAt:
            FieldValue.serverTimestamp(),

          updatedAt:
            FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

    return Response.json({
      success: true,

      pendingOwnerApproval: false,

      accessActive: true,

      startsAt:
        policy.start,

      expiresAt:
        policy.end,

      message:
        `${plan.name} payment verified. Your DJ access is now active.`,

      plan: {
        key: plan.key,
        name: plan.name,
        price: plan.price,
        months: plan.months,
      },
    });
  } catch (error) {
    return radioAccessFailure(error);
  }
}