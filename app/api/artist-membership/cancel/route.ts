import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";

import {
  adminDb,
  firebaseAdminApp,
} from "../../../../lib/firebaseAdmin";

import {
  PAYPAL_BASE_URL,
  getArtistPayPalAccessToken,
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
            "Sign in before cancelling Artist Membership.",
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

    const membershipRef =
      adminDb
        .collection(
          "artistMemberships"
        )
        .doc(account.uid);

    const snapshot =
      await membershipRef.get();

    if (!snapshot.exists) {
      return Response.json(
        {
          success: false,
          error:
            "No Artist Membership subscription was found.",
        },
        {
          status: 404,
        }
      );
    }

    const membership =
      snapshot.data() || {};

    const subscriptionId =
      typeof membership.subscriptionId ===
      "string"
        ? membership.subscriptionId
        : "";

    if (!subscriptionId) {
      return Response.json(
        {
          success: false,
          error:
            "PayPal subscription ID is missing.",
        },
        {
          status: 400,
        }
      );
    }

    const accessToken =
      await getArtistPayPalAccessToken();

    const paypalResponse =
      await fetch(
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
              "Cancelled by SOLO BEATS artist account holder.",
          }),

          cache: "no-store",
        }
      );

    if (
      !paypalResponse.ok &&
      paypalResponse.status !==
        204
    ) {
      const paypalError =
        await paypalResponse
          .json()
          .catch(() => null);

      throw new Error(
        paypalError?.message ||
          "PayPal cancellation failed."
      );
    }

    await membershipRef.set(
      {
        active: false,
        status:
          "CANCELLED",

        cancelledAt:
          FieldValue.serverTimestamp(),

        updatedAt:
          FieldValue.serverTimestamp(),
      },
      {
        merge: true,
      }
    );

    return Response.json({
      success: true,
      status:
        "CANCELLED",
    });
  } catch (error) {
    console.error(
      "Artist membership cancellation error:",
      error
    );

    return Response.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "Artist Membership could not be cancelled.",
      },
      {
        status: 500,
      }
    );
  }
}
