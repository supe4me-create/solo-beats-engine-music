import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";

import {
  adminDb,
  firebaseAdminApp,
} from "../../../../lib/firebaseAdmin";

const PREMIUM_MONTHLY_TRACK_LIMIT = 10;

function getBearerToken(
  request: Request
): string | null {
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

function getPremiumCycleKey(
  startTime: string | undefined,
  nextBillingTime: string | undefined
): string {
  const now = new Date();

  if (nextBillingTime) {
    const nextBilling =
      new Date(nextBillingTime);

    if (
      !Number.isNaN(
        nextBilling.getTime()
      )
    ) {
      const cycleStart =
        new Date(nextBilling);

      cycleStart.setUTCMonth(
        cycleStart.getUTCMonth() - 1
      );

      if (
        now >= cycleStart &&
        now < nextBilling
      ) {
        return cycleStart
          .toISOString()
          .slice(0, 10);
      }
    }
  }

  if (startTime) {
    const started =
      new Date(startTime);

    if (
      !Number.isNaN(started.getTime())
    ) {
      const cycleStart =
        new Date(started);

      while (true) {
        const next =
          new Date(cycleStart);

        next.setUTCMonth(
          next.getUTCMonth() + 1
        );

        if (now < next) {
          return cycleStart
            .toISOString()
            .slice(0, 10);
        }

        cycleStart.setUTCMonth(
          cycleStart.getUTCMonth() + 1
        );
      }
    }
  }

  return now.toISOString().slice(0, 7);
}

export async function GET(
  request: Request
) {
  try {
    const idToken =
      getBearerToken(request);

    if (!idToken) {
      return NextResponse.json(
        {
          success: false,
          error:
            "You must be signed in to view Premium download usage.",
        },
        { status: 401 }
      );
    }

    const decodedToken =
      await getAuth(
        firebaseAdminApp
      ).verifyIdToken(idToken);

    const subscriptionSnapshot =
      await adminDb
        .collection(
          "premiumSubscriptions"
        )
        .doc(decodedToken.uid)
        .get();

    if (
      !subscriptionSnapshot.exists
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "An active SOLO BEATS PREMIUM membership is required.",
        },
        { status: 403 }
      );
    }

    const subscription =
      subscriptionSnapshot.data() || {};

    if (
      subscription.premiumActive !== true ||
      subscription.status !== "ACTIVE"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Your SOLO BEATS PREMIUM membership is not active.",
        },
        { status: 403 }
      );
    }

    const premiumDownloadLimit =
      Number.isFinite(
        subscription.premiumDownloadLimit
      ) &&
      Number(
        subscription.premiumDownloadLimit
      ) > 0
        ? Math.floor(
            Number(
              subscription.premiumDownloadLimit
            )
          )
        : PREMIUM_MONTHLY_TRACK_LIMIT;

    const cycleKey =
      getPremiumCycleKey(
        typeof subscription.startTime ===
          "string"
          ? subscription.startTime
          : undefined,
        typeof subscription.nextBillingTime ===
          "string"
          ? subscription.nextBillingTime
          : undefined
      );

    const usageSnapshot =
      await adminDb
        .collection(
          "premiumDownloadUsage"
        )
        .doc(
          `${decodedToken.uid}_${cycleKey}`
        )
        .get();

    const usage =
      usageSnapshot.data() || {};

    const selectedTrackIds =
      Array.isArray(
        usage.selectedTrackIds
      )
        ? usage.selectedTrackIds
        : [];

    const downloadsUsed =
      Number.isFinite(
        usage.downloadsUsed
      )
        ? Number(
            usage.downloadsUsed
          )
        : selectedTrackIds.length;

    return NextResponse.json({
      success: true,
      cycleKey,
      downloadsUsed,
      downloadsRemaining:
        Math.max(
          0,
          premiumDownloadLimit -
            downloadsUsed
        ),
      downloadLimit:
        premiumDownloadLimit,
      selectedTrackIds,
    });
  } catch (error) {
    console.error(
      "Premium download usage error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Premium download usage could not be loaded.",
      },
      { status: 500 }
    );
  }
}
