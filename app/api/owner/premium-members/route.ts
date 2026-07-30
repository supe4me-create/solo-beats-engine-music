import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";

import {
  adminDb,
  firebaseAdminApp,
} from "../../../../lib/firebaseAdmin";

const OWNER_EMAIL = "supe4.me@gmail.com";
const PREMIUM_DOWNLOAD_LIMIT = 10;
const PAYPAL_BASE_URL = (
  process.env.PAYPAL_BASE_URL ||
  "https://api-m.paypal.com"
).replace(/\/+$/, "");

const DEFAULT_PAYPAL_ENVIRONMENT =
  PAYPAL_BASE_URL.includes("sandbox")
    ? "sandbox"
    : "live";

function getBearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization");

  if (!authorization) return null;

  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function asIsoString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) {
    return value;
  }

  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as { toDate?: unknown }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }

  return null;
}

export async function GET(request: Request) {
  try {
    const idToken = getBearerToken(request);

    if (!idToken) {
      return NextResponse.json(
        { success: false, error: "Owner sign-in is required." },
        { status: 401 }
      );
    }

    const decodedToken = await getAuth(
      firebaseAdminApp
    ).verifyIdToken(idToken);

    if (decodedToken.email?.toLowerCase() !== OWNER_EMAIL) {
      return NextResponse.json(
        { success: false, error: "Owner access only." },
        { status: 403 }
      );
    }

    const [subscriptionsSnapshot, usageSnapshot] =
      await Promise.all([
        adminDb.collection("premiumSubscriptions").get(),
        adminDb.collection("premiumDownloadUsage").get(),
      ]);

    const latestUsageByUid = new Map<
      string,
      {
        cycleKey: string | null;
        downloadsUsed: number;
        downloadLimit: number;
        updatedAt: string | null;
      }
    >();

    for (const document of usageSnapshot.docs) {
      const usage = document.data();
      const uid =
        typeof usage.uid === "string" && usage.uid
          ? usage.uid
          : document.id.split("_")[0] || "";

      if (!uid) continue;

      const updatedAt =
        asIsoString(usage.updatedAt) ||
        asIsoString(usage.lastDownloadAt);

      const current = latestUsageByUid.get(uid);

      if (
        !current ||
        (updatedAt || "") > (current.updatedAt || "")
      ) {
        latestUsageByUid.set(uid, {
          cycleKey:
            typeof usage.cycleKey === "string"
              ? usage.cycleKey
              : null,
          downloadsUsed: Number.isFinite(usage.downloadsUsed)
            ? Number(usage.downloadsUsed)
            : Array.isArray(usage.selectedTrackIds)
              ? usage.selectedTrackIds.length
              : 0,
          downloadLimit: Number.isFinite(usage.downloadLimit)
            ? Number(usage.downloadLimit)
            : PREMIUM_DOWNLOAD_LIMIT,
          updatedAt,
        });
      }
    }

    const members = subscriptionsSnapshot.docs.map((document) => {
      const subscription = document.data();
      const usage = latestUsageByUid.get(document.id);

      const downloadsUsed = usage?.downloadsUsed ?? (
        Number.isFinite(subscription.premiumDownloadsUsed)
          ? Number(subscription.premiumDownloadsUsed)
          : 0
      );

      const downloadLimit = usage?.downloadLimit ?? (
        Number.isFinite(subscription.premiumDownloadLimit)
          ? Number(subscription.premiumDownloadLimit)
          : PREMIUM_DOWNLOAD_LIMIT
      );

      return {
        uid: document.id,
        email:
          typeof subscription.email === "string"
            ? subscription.email
            : null,
        subscriberEmail:
          typeof subscription.subscriberEmail === "string"
            ? subscription.subscriberEmail
            : null,
        subscriberName:
          typeof subscription.subscriberName === "string"
            ? subscription.subscriberName
            : null,
        status:
          typeof subscription.status === "string"
            ? subscription.status
            : subscription.premiumActive === true
              ? "ACTIVE"
              : "INACTIVE",
        premiumActive: subscription.premiumActive === true,
        subscriptionId:
          typeof subscription.paypalSubscriptionId === "string"
            ? subscription.paypalSubscriptionId
            : typeof subscription.subscriptionId === "string"
              ? subscription.subscriptionId
              : null,
        environment:
          typeof subscription.environment === "string"
            ? subscription.environment
            : typeof subscription.billingEnvironment === "string"
              ? subscription.billingEnvironment
              : DEFAULT_PAYPAL_ENVIRONMENT,
        startTime: asIsoString(subscription.startTime),
        nextBillingTime: asIsoString(subscription.nextBillingTime),
        cycleKey:
          usage?.cycleKey ||
          (typeof subscription.premiumDownloadCycleKey === "string"
            ? subscription.premiumDownloadCycleKey
            : null),
        downloadsUsed,
        downloadLimit,
        downloadsRemaining: Math.max(
          0,
          downloadLimit - downloadsUsed
        ),
      };
    });

    members.sort((a, b) => {
      if (a.premiumActive !== b.premiumActive) {
        return a.premiumActive ? -1 : 1;
      }

      return (
        (a.subscriberEmail || a.email || "").localeCompare(
          b.subscriberEmail || b.email || ""
        )
      );
    });

    const summary = {
      totalMembers: members.length,
      activeMembers: members.filter(
        (member) => member.premiumActive
      ).length,
      cancelledMembers: members.filter(
        (member) => !member.premiumActive
      ).length,
      totalDownloadsUsed: members.reduce(
        (total, member) => total + member.downloadsUsed,
        0
      ),
    };

    return NextResponse.json({
      success: true,
      summary,
      members,
    });
  } catch (error) {
    console.error("Owner Premium members error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Premium members could not be loaded.",
      },
      { status: 500 }
    );
  }
}
