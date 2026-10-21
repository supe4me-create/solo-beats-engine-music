import { getAuth } from "firebase-admin/auth";

import {
  adminDb,
  firebaseAdminApp,
} from "../../../../lib/firebaseAdmin";

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

export async function GET(
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
            "Sign in to view your artist membership.",
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

    const snapshot =
      await adminDb
        .collection(
          "artistMemberships"
        )
        .doc(account.uid)
        .get();

    if (!snapshot.exists) {
      return Response.json({
        success: true,
        active: false,
        membership: null,
      });
    }

    const membership =
      snapshot.data() || {};

    return Response.json({
      success: true,

      active:
        membership.active ===
        true,

      membership: {
        planKey:
          membership.planKey ||
          null,

        planName:
          membership.planName ||
          null,

        price:
          membership.price ||
          null,

        status:
          membership.status ||
          null,

        subscriptionId:
          membership.subscriptionId ||
          null,

        startTime:
          membership.startTime ||
          null,

        nextBillingTime:
          membership.nextBillingTime ||
          null,
      },
    });
  } catch (error) {
    console.error(
      "Artist membership status error:",
      error
    );

    return Response.json(
      {
        success: false,
        error:
          "Artist membership status could not be loaded.",
      },
      {
        status: 500,
      }
    );
  }
}
