import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";

import {
  adminDb,
  firebaseAdminApp,
} from "../../../../lib/firebaseAdmin";

import {
  PAYPAL_BASE_URL,
  artistPlanFromPaypalId,
  getArtistPayPalAccessToken,
  getArtistPlanConfig,
} from "../../../../lib/artistMembership";

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
            "Sign in before joining an Artist Membership plan.",
        },
        {
          status: 401,
        }
      );
    }

    const account =
      await getAuth(
        firebaseAdminApp
      ).verifyIdToken(token);

    if (
      !account.email_verified
    ) {
      return Response.json(
        {
          success: false,
          error:
            "Verify your email before starting Artist Membership.",
        },
        {
          status: 400,
        }
      );
    }

    const body =
      await request.json();

    const subscriptionId =
      typeof body?.subscriptionId ===
      "string"
        ? body.subscriptionId.trim()
        : "";

    if (
      !subscriptionId ||
      subscriptionId.length >
        128
    ) {
      return Response.json(
        {
          success: false,
          error:
            "Invalid PayPal subscription.",
        },
        {
          status: 400,
        }
      );
    }

    const config =
      await getArtistPlanConfig();

    if (!config) {
      return Response.json(
        {
          success: false,
          error:
            "Artist Membership PayPal plans are not initialized.",
        },
        {
          status: 409,
        }
      );
    }

    const accessToken =
      await getArtistPayPalAccessToken();

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
      throw new Error(
        subscription?.message ||
          "PayPal subscription verification failed."
      );
    }

    const paypalPlanId =
      typeof subscription?.plan_id ===
      "string"
        ? subscription.plan_id
        : "";

    const plan =
      artistPlanFromPaypalId(
        config,
        paypalPlanId
      );

    if (!plan) {
      return Response.json(
        {
          success: false,
          error:
            "This PayPal subscription does not belong to a SOLO BEATS Artist Membership plan.",
        },
        {
          status: 400,
        }
      );
    }

    const status =
      typeof subscription?.status ===
      "string"
        ? subscription.status
        : "UNKNOWN";

    const active =
      status === "ACTIVE";

    await adminDb
      .collection(
        "artistMemberships"
      )
      .doc(account.uid)
      .set(
        {
          uid:
            account.uid,

          email:
            account.email ||
            null,

          planKey:
            plan.key,

          planName:
            plan.name,

          price:
            plan.price,

          paypalPlanId,

          subscriptionId,

          status,

          active,

          subscriberEmail:
            subscription
              ?.subscriber
              ?.email_address ||
            account.email ||
            null,

          startTime:
            subscription
              ?.start_time ||
            null,

          nextBillingTime:
            subscription
              ?.billing_info
              ?.next_billing_time ||
            null,

          updatedAt:
            FieldValue.serverTimestamp(),

          createdAt:
            FieldValue.serverTimestamp(),
        },
        {
          merge: true,
        }
      );

    return Response.json({
      success: true,
      active,
      status,
      planKey:
        plan.key,
      planName:
        plan.name,
      price:
        plan.price,
      subscriptionId,
    });
  } catch (error) {
    console.error(
      "Artist membership verification error:",
      error
    );

    return Response.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "Artist Membership could not be activated.",
      },
      {
        status: 500,
      }
    );
  }
}
