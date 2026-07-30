import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import {
  adminDb,
  firebaseAdminApp,
} from "../../../../lib/firebaseAdmin";

function getBearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization");

  if (!authorization) {
    return null;
  }

  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

export async function GET(request: Request) {
  try {
    const idToken = getBearerToken(request);

    if (!idToken) {
      return NextResponse.json(
        {
          success: false,
          error: "You must be signed in to view Premium status.",
        },
        { status: 401 }
      );
    }

    const decodedToken = await getAuth(
      firebaseAdminApp
    ).verifyIdToken(idToken);

    const snapshot = await adminDb
      .collection("premiumSubscriptions")
      .doc(decodedToken.uid)
      .get();

    const environment =
      (process.env.PAYPAL_BASE_URL || "").includes("sandbox")
        ? "sandbox"
        : "live";

    if (!snapshot.exists) {
      return NextResponse.json({
        success: true,
        premiumActive: false,
        status: null,
        subscriptionId: null,
        planId: null,
        startTime: null,
        nextBillingTime: null,
        subscriberEmail: null,
        environment,
      });
    }

    const data = snapshot.data() || {};
    const status =
      typeof data.status === "string" ? data.status : null;

    return NextResponse.json({
      success: true,
      premiumActive:
        data.premiumActive === true && status === "ACTIVE",
      status,
      subscriptionId:
        typeof data.paypalSubscriptionId === "string"
          ? data.paypalSubscriptionId
          : null,
      planId:
        typeof data.paypalPlanId === "string"
          ? data.paypalPlanId
          : null,
      startTime:
        typeof data.startTime === "string"
          ? data.startTime
          : null,
      nextBillingTime:
        typeof data.nextBillingTime === "string"
          ? data.nextBillingTime
          : null,
      subscriberEmail:
        typeof data.subscriberEmail === "string"
          ? data.subscriberEmail
          : null,
      environment,
    });
  } catch (error) {
    console.error("Premium status error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Premium membership status could not be loaded.",
      },
      { status: 500 }
    );
  }
}

