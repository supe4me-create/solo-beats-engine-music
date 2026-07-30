import { getAuth } from "firebase-admin/auth";
import {
  adminDb,
  firebaseAdminApp,
} from "./firebaseAdmin";

export type PremiumAccessResult =
  | {
      allowed: true;
      uid: string;
      status: "ACTIVE";
      subscriptionId: string | null;
      nextBillingTime: string | null;
    }
  | {
      allowed: false;
      statusCode: 401 | 403;
      error: string;
    };

function getBearerToken(request: Request): string | null {
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

export async function requirePremiumAccess(
  request: Request
): Promise<PremiumAccessResult> {
  const idToken = getBearerToken(request);

  if (!idToken) {
    return {
      allowed: false,
      statusCode: 401,
      error:
        "You must be signed in to access Premium content.",
    };
  }

  let decodedToken;

  try {
    decodedToken = await getAuth(
      firebaseAdminApp
    ).verifyIdToken(idToken);
  } catch {
    return {
      allowed: false,
      statusCode: 401,
      error:
        "Your sign-in session is invalid or expired.",
    };
  }

  const snapshot = await adminDb
    .collection("premiumSubscriptions")
    .doc(decodedToken.uid)
    .get();

  if (!snapshot.exists) {
    return {
      allowed: false,
      statusCode: 403,
      error:
        "An active SOLO BEATS PREMIUM membership is required.",
    };
  }

  const data = snapshot.data() || {};
  const status =
    typeof data.status === "string"
      ? data.status
      : null;

  const premiumActive =
    data.premiumActive === true &&
    status === "ACTIVE";

  if (!premiumActive) {
    return {
      allowed: false,
      statusCode: 403,
      error:
        "Your SOLO BEATS PREMIUM membership is not active.",
    };
  }

  return {
    allowed: true,
    uid: decodedToken.uid,
    status: "ACTIVE",
    subscriptionId:
      typeof data.paypalSubscriptionId ===
      "string"
        ? data.paypalSubscriptionId
        : null,
    nextBillingTime:
      typeof data.nextBillingTime ===
      "string"
        ? data.nextBillingTime
        : null,
  };
}
