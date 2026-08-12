import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";

import {
  adminDb,
  firebaseAdminApp,
} from "../../../../lib/firebaseAdmin";

const OWNER_EMAIL = "supe4.me@gmail.com";
const PREMIUM_DOWNLOAD_LIMIT = 10;

const PAYPAL_CLIENT_ID =
  process.env.PAYPAL_CLIENT_ID;

const PAYPAL_CLIENT_SECRET =
  process.env.PAYPAL_CLIENT_SECRET;
const PAYPAL_BASE_URL = (
  process.env.PAYPAL_BASE_URL ||
  "https://api-m.paypal.com"
).replace(/\/+$/, "");

const DEFAULT_PAYPAL_ENVIRONMENT =
  PAYPAL_BASE_URL.includes("sandbox")
    ? "sandbox"
    : "live";

async function getOwnerPayPalAccessToken() {
  if (
    !PAYPAL_CLIENT_ID ||
    !PAYPAL_CLIENT_SECRET
  ) {
    throw new Error(
      "PayPal server credentials are missing."
    );
  }

  const credentials = Buffer.from(
    `${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`
  ).toString("base64");

  const response = await fetch(
    `${PAYPAL_BASE_URL}/v1/oauth2/token`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type":
          "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
      cache: "no-store",
    }
  );

  const data = await response.json();

  if (
    !response.ok ||
    !data.access_token
  ) {
    throw new Error(
      data.error_description ||
        "PayPal authentication failed."
    );
  }

  return data.access_token as string;
}

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

function getOwnerPremiumCycleKey(
  startTime: string | undefined,
  nextBillingTime: string | undefined
): string {
  const now = new Date();

  if (nextBillingTime) {
    const nextBilling = new Date(nextBillingTime);

    if (!Number.isNaN(nextBilling.getTime())) {
      const cycleStart = new Date(nextBilling);

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
    const started = new Date(startTime);

    if (!Number.isNaN(started.getTime())) {
      const cycleStart = new Date(started);

      while (true) {
        const next = new Date(cycleStart);

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

export async function PATCH(request: Request) {
  try {
    const idToken = getBearerToken(request);

    if (!idToken) {
      return NextResponse.json(
        {
          success: false,
          error: "Owner sign-in is required.",
        },
        { status: 401 }
      );
    }

    const decodedToken = await getAuth(
      firebaseAdminApp
    ).verifyIdToken(idToken);

    if (
      decodedToken.email?.toLowerCase() !==
      OWNER_EMAIL
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Owner access only.",
        },
        { status: 403 }
      );
    }

    const body = await request.json();

    const uid =
      typeof body?.uid === "string"
        ? body.uid.trim()
        : "";

    const action =
      typeof body?.action === "string"
        ? body.action.trim()
        : "";

    if (!uid) {
      return NextResponse.json(
        {
          success: false,
          error: "A Premium member UID is required.",
        },
        { status: 400 }
      );
    }

    const subscriptionRef = adminDb
      .collection("premiumSubscriptions")
      .doc(uid);

    const subscriptionSnapshot =
      await subscriptionRef.get();

    if (!subscriptionSnapshot.exists) {
      return NextResponse.json(
        {
          success: false,
          error: "Premium subscription record not found.",
        },
        { status: 404 }
      );
    }

    const subscription =
      subscriptionSnapshot.data() || {};

    const cycleKey = getOwnerPremiumCycleKey(
      typeof subscription.startTime === "string"
        ? subscription.startTime
        : undefined,
      typeof subscription.nextBillingTime === "string"
        ? subscription.nextBillingTime
        : undefined
    );

    const usageRef = adminDb
      .collection("premiumDownloadUsage")
      .doc(`${uid}_${cycleKey}`);

    if (action === "reset-downloads") {
      const currentLimit =
        Number.isFinite(
          subscription.premiumDownloadLimit
        ) &&
        Number(subscription.premiumDownloadLimit) > 0
          ? Math.floor(
              Number(
                subscription.premiumDownloadLimit
              )
            )
          : PREMIUM_DOWNLOAD_LIMIT;

      await Promise.all([
        usageRef.set(
          {
            uid,
            cycleKey,
            subscriptionId:
              typeof subscription.paypalSubscriptionId ===
              "string"
                ? subscription.paypalSubscriptionId
                : null,
            downloadsUsed: 0,
            downloadLimit: currentLimit,
            selectedTrackIds: [],
            lastDownloadedTrackId: null,
            resetByOwner: true,
            resetAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        ),

        subscriptionRef.set(
          {
            premiumDownloadsUsed: 0,
            premiumDownloadLimit: currentLimit,
            premiumDownloadCycleKey: cycleKey,
            premiumDownloadsResetAt:
              FieldValue.serverTimestamp(),
            updatedAt:
              FieldValue.serverTimestamp(),
          },
          { merge: true }
        ),
      ]);

      return NextResponse.json({
        success: true,
        action,
        uid,
        cycleKey,
        downloadsUsed: 0,
        downloadLimit: currentLimit,
        downloadsRemaining: currentLimit,
        message:
          "Premium downloads were reset successfully.",
      });
    }

    if (action === "change-download-limit") {
      const requestedLimit =
        Number(body?.downloadLimit);

      if (
        !Number.isInteger(requestedLimit) ||
        requestedLimit < 1 ||
        requestedLimit > 100
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Download limit must be a whole number from 1 to 100.",
          },
          { status: 400 }
        );
      }

      const usageSnapshot =
        await usageRef.get();

      const usage =
        usageSnapshot.data() || {};

      const selectedTrackIds =
        Array.isArray(usage.selectedTrackIds)
          ? usage.selectedTrackIds
          : [];

      const downloadsUsed =
        Number.isFinite(usage.downloadsUsed)
          ? Number(usage.downloadsUsed)
          : selectedTrackIds.length;

      await Promise.all([
        subscriptionRef.set(
          {
            premiumDownloadLimit:
              requestedLimit,
            premiumDownloadCycleKey:
              cycleKey,
            updatedAt:
              FieldValue.serverTimestamp(),
          },
          { merge: true }
        ),

        usageRef.set(
          {
            uid,
            cycleKey,
            subscriptionId:
              typeof subscription.paypalSubscriptionId ===
              "string"
                ? subscription.paypalSubscriptionId
                : null,
            downloadsUsed,
            downloadLimit:
              requestedLimit,
            selectedTrackIds,
            limitChangedByOwner: true,
            limitChangedAt:
              FieldValue.serverTimestamp(),
            updatedAt:
              FieldValue.serverTimestamp(),
          },
          { merge: true }
        ),
      ]);

      return NextResponse.json({
        success: true,
        action,
        uid,
        cycleKey,
        downloadsUsed,
        downloadLimit: requestedLimit,
        downloadsRemaining: Math.max(
          0,
          requestedLimit - downloadsUsed
        ),
        message:
          `Premium download limit changed to ${requestedLimit}.`,
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: "Unknown Premium member action.",
      },
      { status: 400 }
    );
  } catch (error) {
    console.error(
      "Owner Premium member PATCH error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Premium member could not be updated.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const idToken = getBearerToken(request);

    if (!idToken) {
      return NextResponse.json(
        {
          success: false,
          error: "Owner sign-in is required.",
        },
        { status: 401 }
      );
    }

    const decodedToken = await getAuth(
      firebaseAdminApp
    ).verifyIdToken(idToken);

    if (
      decodedToken.email?.toLowerCase() !==
      OWNER_EMAIL
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Owner access only.",
        },
        { status: 403 }
      );
    }

    const body = await request.json();

    const action =
      typeof body?.action === "string"
        ? body.action.trim()
        : "";

    const uid =
      typeof body?.uid === "string"
        ? body.uid.trim()
        : "";

    if (action !== "cancel-premium") {
      return NextResponse.json(
        {
          success: false,
          error:
            "Unknown Premium member action.",
        },
        { status: 400 }
      );
    }

    if (!uid) {
      return NextResponse.json(
        {
          success: false,
          error:
            "A Premium member UID is required.",
        },
        { status: 400 }
      );
    }

    const subscriptionRef = adminDb
      .collection("premiumSubscriptions")
      .doc(uid);

    const snapshot =
      await subscriptionRef.get();

    if (!snapshot.exists) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Premium subscription record not found.",
        },
        { status: 404 }
      );
    }

    const subscription =
      snapshot.data() || {};

    const subscriptionId =
      typeof subscription.paypalSubscriptionId ===
      "string"
        ? subscription.paypalSubscriptionId.trim()
        : typeof subscription.subscriptionId ===
            "string"
          ? subscription.subscriptionId.trim()
          : "";

    if (!subscriptionId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "This member does not have a PayPal subscription ID.",
        },
        { status: 400 }
      );
    }

    if (
      subscription.status === "CANCELLED" ||
      subscription.premiumActive === false
    ) {
      return NextResponse.json({
        success: true,
        alreadyCancelled: true,
        status:
          typeof subscription.status === "string"
            ? subscription.status
            : "CANCELLED",
        uid,
        subscriptionId,
        message:
          "This Premium membership is already inactive or cancelled.",
      });
    }

    const memberEnvironment =
      typeof subscription.environment ===
      "string"
        ? subscription.environment
            .trim()
            .toLowerCase()
        : typeof subscription.billingEnvironment ===
            "string"
          ? subscription.billingEnvironment
              .trim()
              .toLowerCase()
          : DEFAULT_PAYPAL_ENVIRONMENT;

    if (
      memberEnvironment === "sandbox" ||
      memberEnvironment === "live"
    ) {
      if (
        memberEnvironment !==
        DEFAULT_PAYPAL_ENVIRONMENT
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              `PayPal environment mismatch. This subscription is ${memberEnvironment}, but the server is configured for ${DEFAULT_PAYPAL_ENVIRONMENT}. Cancellation was not attempted.`,
          },
          { status: 409 }
        );
      }
    }

    const accessToken =
      await getOwnerPayPalAccessToken();

    const paypalResponse = await fetch(
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
            "Cancelled by SOLO BEATS ENGINE MUSIC owner from Owner Control Center.",
        }),
        cache: "no-store",
      }
    );

    if (
      !paypalResponse.ok &&
      paypalResponse.status !== 204
    ) {
      let paypalError: unknown = null;

      try {
        paypalError =
          await paypalResponse.json();
      } catch {
        paypalError = null;
      }

      console.error(
        "Owner PayPal cancellation error:",
        paypalError
      );

      const message =
        typeof paypalError === "object" &&
        paypalError !== null &&
        "message" in paypalError &&
        typeof (
          paypalError as {
            message?: unknown;
          }
        ).message === "string"
          ? (
              paypalError as {
                message: string;
              }
            ).message
          : "PayPal could not cancel this Premium subscription.";

      return NextResponse.json(
        {
          success: false,
          error: message,
        },
        {
          status:
            paypalResponse.status || 500,
        }
      );
    }

    await subscriptionRef.set(
      {
        status: "CANCELLED",
        premiumActive: false,
        cancelledAt:
          FieldValue.serverTimestamp(),
        cancellationSource:
          "owner-control-center",
        cancelledByOwnerEmail:
          decodedToken.email || OWNER_EMAIL,
        updatedAt:
          FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return NextResponse.json({
      success: true,
      uid,
      subscriptionId,
      status: "CANCELLED",
      premiumActive: false,
      message:
        "Premium subscription was cancelled successfully through PayPal.",
    });
  } catch (error) {
    console.error(
      "Owner Premium cancellation error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Premium subscription could not be cancelled.",
      },
      { status: 500 }
    );
  }
}
