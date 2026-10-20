import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";

import {
  firebaseAdminApp,
  adminDb,
} from "../../../../lib/firebaseAdmin";

import {
  DJ_POLICY_CLAIM,
  readDjPolicy,
  type DjPolicy,
} from "../../../../lib/djAccessPolicy";

import {
  RADIO_DJ_CLAIM,
  requireRadioOwner,
  radioAccessFailure,
  RadioAccessError,
} from "../../../../lib/radioDjAccess";

import {
  PAYPAL_BASE_URL,
  getPayPalAccessToken,
  getDjPayPalPlanConfig,
  planFromPaypalId,
  addMonths,
} from "../../../../lib/djPayPal";

export const runtime = "nodejs";

const json = (data: object) =>
  Response.json(data, {
    headers: {
      "Cache-Control": "no-store",
    },
  });

export async function GET(request: Request) {
  try {
    await requireRadioOwner(request);

    const snapshot =
      await adminDb
        .collection("djSubscriptions")
        .where(
          "pendingOwnerApproval",
          "==",
          true
        )
        .limit(50)
        .get();

    const payments =
      snapshot.docs
        .map(doc => ({
          uid: doc.id,
          ...(doc.data() as Record<string, any>),
        }))
        .sort((a, b) => {
          const aa =
            typeof (a as any).createdAt
              ?.toMillis === "function"
              ? (a as any).createdAt.toMillis()
              : 0;

          const bb =
            typeof (b as any).createdAt
              ?.toMillis === "function"
              ? (b as any).createdAt.toMillis()
              : 0;

          return bb - aa;
        });

    return json({
      success: true,
      payments,
    });
  } catch (error) {
    return radioAccessFailure(error);
  }
}

export async function POST(request: Request) {
  try {
    const { account: owner } =
      await requireRadioOwner(request);

    const raw =
      await request.text();

    if (raw.length > 4096) {
      throw new RadioAccessError(
        "Request too large.",
        400
      );
    }

    let body: {
      uid?: unknown;
      action?: unknown;
    };

    try {
      body = JSON.parse(raw);
    } catch {
      throw new RadioAccessError(
        "Invalid request.",
        400
      );
    }

    const uid =
      typeof body.uid === "string"
        ? body.uid.trim()
        : "";

    const action =
      typeof body.action === "string"
        ? body.action
        : "";

    if (!uid) {
      throw new RadioAccessError(
        "DJ account is missing.",
        400
      );
    }

    if (
      action !== "approve" &&
      action !== "decline"
    ) {
      throw new RadioAccessError(
        "Choose Approve or Decline.",
        400
      );
    }

    if (uid === owner.uid) {
      throw new RadioAccessError(
        "Owner DJ access cannot be changed here.",
        400
      );
    }

    const subscriptionRef =
      adminDb
        .collection("djSubscriptions")
        .doc(uid);

    const subscriptionSnapshot =
      await subscriptionRef.get();

    if (!subscriptionSnapshot.exists) {
      throw new RadioAccessError(
        "DJ payment record was not found.",
        404
      );
    }

    const billing =
      subscriptionSnapshot.data()!;

    if (
      !billing.paypalSubscriptionId
    ) {
      throw new RadioAccessError(
        "PayPal subscription ID is missing.",
        409
      );
    }

    const accessToken =
      await getPayPalAccessToken();

    const paypalResponse =
      await fetch(
        `${PAYPAL_BASE_URL}/v1/billing/subscriptions/${encodeURIComponent(
          billing.paypalSubscriptionId
        )}`,
        {
          headers: {
            Authorization:
              `Bearer ${accessToken}`,
          },
          cache: "no-store",
        }
      );

    const paypalSubscription =
      await paypalResponse.json();

    if (!paypalResponse.ok) {
      throw new RadioAccessError(
        paypalSubscription?.details?.[0]
          ?.description ||
          paypalSubscription?.message ||
          "PayPal could not verify this subscription.",
        409
      );
    }

    if (action === "decline") {
      if (
        paypalSubscription.status ===
        "ACTIVE"
      ) {
        const cancelResponse =
          await fetch(
            `${PAYPAL_BASE_URL}/v1/billing/subscriptions/${encodeURIComponent(
              billing.paypalSubscriptionId
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
                  "SOLO BEATS DJ access was not approved.",
              }),
              cache: "no-store",
            }
          );

        if (
          !cancelResponse.ok &&
          cancelResponse.status !== 204
        ) {
          console.error(
            "DJ PayPal cancel failed:",
            await cancelResponse.text()
          );
        }
      }

      await subscriptionRef.set(
        {
          ownerApproved: false,
          pendingOwnerApproval: false,
          ownerDecision: "declined",
          declinedBy: owner.uid,
          declinedAt:
            FieldValue.serverTimestamp(),
          updatedAt:
            FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      return json({
        success: true,
        message:
          "DJ payment request declined. Future PayPal renewals were cancelled.",
      });
    }

    if (
      paypalSubscription.status !==
      "ACTIVE"
    ) {
      throw new RadioAccessError(
        `PayPal subscription must be ACTIVE before approval. Current status: ${paypalSubscription.status}.`,
        409
      );
    }

    const config =
      await getDjPayPalPlanConfig();

    if (!config) {
      throw new RadioAccessError(
        "DJ PayPal plans are not configured.",
        409
      );
    }

    const plan =
      planFromPaypalId(
        config,
        paypalSubscription.plan_id
      );

    if (!plan) {
      throw new RadioAccessError(
        "This subscription does not match an approved DJ plan.",
        409
      );
    }

    const auth =
      getAuth(firebaseAdminApp);

    const target =
      await auth.getUser(uid);

    if (
      target.disabled ||
      !target.emailVerified
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
        "Generated DJ access policy is invalid.",
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
      uid,
      claims
    );

    const coveredPaymentTime =
      paypalSubscription.billing_info
        ?.last_payment?.time ||
      null;

    await subscriptionRef.set(
      {
        ownerApproved: true,

        pendingOwnerApproval: false,

        ownerDecision: "approved",

        approvedBy: owner.uid,

        approvedAt:
          FieldValue.serverTimestamp(),

        status:
          paypalSubscription.status,

        planKey:
          plan.key,

        planName:
          plan.name,

        planPrice:
          plan.price,

        planMonths:
          plan.months,

        currentPeriodStart:
          now,

        currentPeriodEnd:
          policy.end,

        coveredPaymentTime,

        nextBillingTime:
          paypalSubscription.billing_info
            ?.next_billing_time ||
          null,

        updatedAt:
          FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return json({
      success: true,

      uid,

      message:
        `${plan.name} approved. DJ access is active.`,

      startsAt:
        policy.start,

      expiresAt:
        policy.end,
    });
  } catch (error) {
    return radioAccessFailure(error);
  }
}


