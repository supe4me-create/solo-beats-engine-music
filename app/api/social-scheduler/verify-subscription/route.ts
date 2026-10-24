import {
  FieldValue,
} from "firebase-admin/firestore";

import {
  getAuth,
} from "firebase-admin/auth";

import {
  adminDb,
  firebaseAdminApp,
} from "../../../../lib/firebaseAdmin";

import {
  SOCIAL_SCHEDULER_PAYPAL_BASE_URL,
  ensureSocialSchedulerPayPalPlans,
  getSocialSchedulerPayPalAccessToken,
  schedulerPlanFromPaypalId,
} from "../../../../lib/socialSchedulerBilling";

export const runtime =
  "nodejs";

function bearerToken(
  request: Request
) {
  const authorization =
    request.headers.get(
      "authorization"
    );

  const match =
    authorization?.match(
      /^Bearer\s+(.+)$/i
    );

  return (
    match?.[1]?.trim() ||
    null
  );
}

// ============================================================
// SOLO_SOCIAL_SCHEDULER_VERIFY_SUBSCRIPTION_V1
// ============================================================

export async function POST(
  request: Request
) {
  try {
    const token =
      bearerToken(request);

    if (!token) {
      return Response.json(
        {
          success: false,
          error:
            "Sign in before purchasing Social Scheduler access.",
        },
        {
          status: 401,
        }
      );
    }

    const customer =
      await getAuth(
        firebaseAdminApp
      ).verifyIdToken(token);

    const body =
      await request.json();

    const subscriptionId =
      typeof body?.subscriptionId ===
        "string"
        ? body.subscriptionId.trim()
        : "";

    if (
      !subscriptionId ||
      subscriptionId.length > 128
    ) {
      return Response.json(
        {
          success: false,
          error:
            "Invalid PayPal subscription ID.",
        },
        {
          status: 400,
        }
      );
    }

    const config =
      await ensureSocialSchedulerPayPalPlans();

    const accessToken =
      await getSocialSchedulerPayPalAccessToken();

    const paypalResponse =
      await fetch(
        `${SOCIAL_SCHEDULER_PAYPAL_BASE_URL}/v1/billing/subscriptions/${encodeURIComponent(
          subscriptionId
        )}`,
        {
          headers: {
            Authorization:
              `Bearer ${accessToken}`,
          },
          cache:
            "no-store",
        }
      );

    const subscription =
      await paypalResponse.json();

    if (!paypalResponse.ok) {
      return Response.json(
        {
          success: false,
          error:
            subscription?.message ||
            "PayPal subscription verification failed.",
        },
        {
          status: 400,
        }
      );
    }

    const paypalPlanId =
      typeof subscription?.plan_id ===
        "string"
        ? subscription.plan_id
        : "";

    const plan =
      schedulerPlanFromPaypalId(
        config,
        paypalPlanId
      );

    if (!plan) {
      return Response.json(
        {
          success: false,
          error:
            "This PayPal subscription does not belong to a valid Social Scheduler plan.",
        },
        {
          status: 400,
        }
      );
    }

    const paypalStatus =
      typeof subscription?.status ===
        "string"
        ? subscription.status
        : "";

    const active =
      paypalStatus ===
      "ACTIVE";

    const startTime =
      typeof subscription?.start_time ===
        "string"
        ? subscription.start_time
        : null;

    const nextBillingTime =
      typeof subscription
        ?.billing_info
        ?.next_billing_time ===
        "string"
        ? subscription
            .billing_info
            .next_billing_time
        : null;

    const subscriberEmail =
      typeof subscription
        ?.subscriber
        ?.email_address ===
        "string"
        ? subscription
            .subscriber
            .email_address
        : customer.email ||
          null;

    // SOLO_SCHEDULER_PAYPAL_OWNERSHIP_GUARD_V1
    // A PayPal subscription must not be claimable by knowing its ID.
    const verifiedFirebaseEmail =
      typeof customer.email === "string" && customer.email_verified === true
        ? customer.email.trim().toLowerCase()
        : "";
    const actualPaypalEmail =
      typeof subscription?.subscriber?.email_address === "string"
        ? subscription.subscriber.email_address.trim().toLowerCase()
        : "";

    if (!verifiedFirebaseEmail || !actualPaypalEmail ||
        verifiedFirebaseEmail !== actualPaypalEmail) {
      return Response.json(
        { success: false, error: "The verified sign-in email must match the PayPal subscriber email. Contact support if your PayPal account uses another email." },
        { status: 403 }
      );
    }

    // A Firestore transaction enforces a unique subscription -> customer binding.
    const claimRef = adminDb.collection("socialSchedulerSubscriptionClaims").doc(subscriptionId);
    const customerRef = adminDb.collection("socialSchedulerCustomers").doc(customer.uid);
    try {
      await adminDb.runTransaction(async tx => {
        const [claim, existingCustomer] = await Promise.all([
          tx.get(claimRef),
          tx.get(customerRef),
        ]);
        const priorUid = claim.data()?.uid;
        if (claim.exists && priorUid !== customer.uid) {
          throw new Error("SUBSCRIPTION_ALREADY_CLAIMED");
        }
        const currentSubscription = existingCustomer.data()?.subscriptionId;
        if (typeof currentSubscription === "string" &&
            currentSubscription && currentSubscription !== subscriptionId &&
            existingCustomer.data()?.accessActive === true) {
          throw new Error("CUSTOMER_HAS_ACTIVE_SUBSCRIPTION");
        }
        tx.set(claimRef, {
          uid: customer.uid,
          subscriptionId,
          verifiedPaypalEmail: actualPaypalEmail,
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
        tx.set(customerRef,
        {
          uid:
            customer.uid,

          email:
            customer.email ||
            subscriberEmail,

          accessActive:
            active,

          status:
            paypalStatus ||
            "UNKNOWN",

          planKey:
            plan.key,

          planId:
            paypalPlanId,

          planName:
            plan.name,

          price:
            plan.price,

          monthlyPostLimit:
            plan.monthlyPostLimit,

          maxConnectedAccounts:
            plan.maxConnectedAccounts,

          ownerUnlimited:
            false,

          platforms:
            plan.platforms,

          recurringEnabled:
            plan.recurringEnabled,

          subscriptionId,

          subscriptionProvider:
            "paypal",

          subscriberEmail,

          startTime,

          currentPeriodEnd:
            nextBillingTime,

          createdAt:
            FieldValue.serverTimestamp(),

          updatedAt:
            FieldValue.serverTimestamp(),
        },
        {
          merge: true,
        });
      });
    } catch (claimError) {
      if (claimError instanceof Error &&
          (claimError.message === "SUBSCRIPTION_ALREADY_CLAIMED" ||
           claimError.message === "CUSTOMER_HAS_ACTIVE_SUBSCRIPTION")) {
        return Response.json({ success: false, error: "Subscription is already linked to an account. Contact support." }, { status: 409 });
      }
      throw claimError;
    }

    return Response.json({
      success: true,

      accessActive:
        active,

      status:
        paypalStatus,

      subscriptionId,

      plan: {
        key:
          plan.key,

        name:
          plan.name,

        price:
          plan.price,

        monthlyPostLimit:
          plan.monthlyPostLimit,

        maxConnectedAccounts:
          plan.maxConnectedAccounts,

        platforms:
          plan.platforms,

        recurringEnabled:
          plan.recurringEnabled,
      },
    });
  } catch (error) {
    console.error(
      "Social Scheduler subscription verification error:",
      error
    );

    return Response.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Social Scheduler subscription could not be verified.",
      },
      {
        status: 500,
      }
    );
  }
}

