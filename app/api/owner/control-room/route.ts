import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";

import {
  adminDb,
  firebaseAdminApp,
} from "../../../../lib/firebaseAdmin";

import {
  DJ_POLICY_CLAIM,
  evaluateDjAccess,
} from "../../../../lib/djAccessPolicy";

import {
  RADIO_DJ_CLAIM,
} from "../../../../lib/radioDjAccess";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OWNER_EMAIL = "supe4.me@gmail.com";

function bearer(request: Request) {
  const header =
    request.headers.get("authorization") || "";

  return (
    header.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() ||
    null
  );
}

async function verifyOwner(request: Request) {
  const token = bearer(request);

  if (!token) {
    throw new Error("OWNER_AUTH_REQUIRED");
  }

  const decoded =
    await getAuth(
      firebaseAdminApp
    ).verifyIdToken(token);

  if (
    decoded.email?.trim().toLowerCase() !==
    OWNER_EMAIL
  ) {
    throw new Error("OWNER_ONLY");
  }

  return decoded;
}

function cleanString(value: unknown) {
  return typeof value === "string"
    ? value
    : "";
}

function timestampMillis(value: unknown) {
  if (
    value &&
    typeof value === "object" &&
    "toMillis" in value &&
    typeof (value as { toMillis?: unknown }).toMillis ===
      "function"
  ) {
    return (
      value as {
        toMillis: () => number;
      }
    ).toMillis();
  }

  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed)
      ? parsed
      : 0;
  }

  if (typeof value === "number") {
    return value;
  }

  return 0;
}

export async function GET(request: Request) {
  try {
    await verifyOwner(request);

    const [
      broadcastSnapshot,
      youtubeSnapshot,
      djRequestSnapshot,
      djSubscriptionSnapshot,
      premiumSnapshot,
      mixSnapshot,
      notificationSnapshot,
      usersResult,
    ] = await Promise.all([
      adminDb
        .collection("platformSettings")
        .doc("broadcast")
        .get(),

      adminDb
        .collection("radioSettings")
        .doc("station")
        .get(),

      adminDb
        .collection("radioDjRequests")
        .get(),

      adminDb
        .collection("djSubscriptions")
        .get(),

      adminDb
        .collection("premiumSubscriptions")
        .get(),

      adminDb
        .collection("mixMasteringOrders")
        .get(),

      adminDb
        .collection("ownerNotifications")
        .limit(100)
        .get(),

      getAuth(
        firebaseAdminApp
      ).listUsers(1000),
    ]);

    const broadcast =
      broadcastSnapshot.exists
        ? broadcastSnapshot.data() || {}
        : {};

    const youtube =
      youtubeSnapshot.exists
        ? youtubeSnapshot.data() || {}
        : {};

    const djRequests: Record<string, any>[] = djRequestSnapshot.docs.map(
        document => ({
          id: document.id,
          ...(document.data() as Record<string, any>),
        })
      );

    const pendingApplications =
      djRequests.filter(
        request =>
          request.status === "pending" ||
          request.status === "more_info"
      ).length;

    let djTotal = 0;
    let djActive = 0;
    let djExpired = 0;
    let djSuspended = 0;
    let djRevoked = 0;
    let djScheduled = 0;
    let djPaymentRequired = 0;

    for (const user of usersResult.users) {
      const claims =
        user.customClaims || {};

      const hasDj =
        claims[RADIO_DJ_CLAIM] === true ||
        Object.prototype.hasOwnProperty.call(
          claims,
          DJ_POLICY_CLAIM
        );

      if (!hasDj) {
        continue;
      }

      djTotal += 1;

      const access =
        evaluateDjAccess(
          claims,
          user.emailVerified,
          false
        );

      const status =
        cleanString(access.status)
          .toLowerCase();

      if (
        access.allowed === true ||
        status === "active"
      ) {
        djActive += 1;
      } else if (
        status.includes("expired")
      ) {
        djExpired += 1;
      } else if (
        status.includes("suspend")
      ) {
        djSuspended += 1;
      } else if (
        status.includes("revoke")
      ) {
        djRevoked += 1;
      } else if (
        status.includes("schedule") ||
        status.includes("wait")
      ) {
        djScheduled += 1;
      } else if (
        status.includes("payment") ||
        status.includes("paid")
      ) {
        djPaymentRequired += 1;
      }
    }

    const subscriptions: Record<string, any>[] = djSubscriptionSnapshot.docs.map(
        document => ({
          id: document.id,
          ...(document.data() as Record<string, any>),
        })
      );

    const pendingDjPayments =
      subscriptions.filter(
        item =>
          item.pendingOwnerApproval === true
      ).length;

    const paidDjSubscriptions =
      subscriptions.filter(
        item =>
          item.status === "ACTIVE" ||
          item.status === "active"
      ).length;

    const premiumMembers: Record<string, any>[] = premiumSnapshot.docs.map(
        document =>
          document.data() as Record<string, any>
      );

    const activePremium =
      premiumMembers.filter(
        item =>
          item.premiumActive === true
      ).length;

    const mixOrders: Record<string, any>[] = mixSnapshot.docs.map(
        document => ({
          id: document.id,
          ...(document.data() as Record<string, any>),
        })
      );

    const openMixOrders =
      mixOrders.filter(item => {
        const status =
          cleanString(item.status)
            .toLowerCase();

        return ![
          "completed",
          "complete",
          "delivered",
          "cancelled",
          "canceled",
        ].includes(status);
      }).length;

    const paidMixOrders =
      mixOrders.filter(
        item =>
          cleanString(
            item.paymentStatus
          ).toUpperCase() === "PAID"
      ).length;

    const notifications: Record<string, any>[] = notificationSnapshot.docs.map(
        document => ({
          id: document.id,
          ...(document.data() as Record<string, any>),
        })
      );

    const unreadNotifications =
      notifications.filter(
        item =>
          item.read !== true &&
          item.seen !== true
      ).length;

    const latestNotifications =
      notifications
        .sort(
          (a, b) =>
            timestampMillis(b.createdAt) -
            timestampMillis(a.createdAt)
        )
        .slice(0, 5)
        .map(item => ({
          id: item.id,
          type:
            cleanString(item.type) ||
            "notification",
          message:
            cleanString(item.message),
          targetUrl:
            cleanString(item.targetUrl),
        }));

    return NextResponse.json(
      {
        success: true,

        broadcast: {
          radioOnAir:
            typeof broadcast.radioOnAir ===
            "boolean"
              ? broadcast.radioOnAir
              : true,

          liveMicOnAir:
            broadcast.liveMicOnAir === true,

          liveMicMode:
            broadcast.liveMicMode ===
            "takeover"
              ? "takeover"
              : "duck",

          broadcasterEmail:
            cleanString(
              broadcast.liveBroadcasterEmail
            ),

          broadcasterRole:
            cleanString(
              broadcast.liveBroadcasterRole
            ),

          room:
            cleanString(
              broadcast.liveMicRoom
            ) ||
            "solo-beats-premium-radio",
        },

        youtube: {
          enabled:
            youtube.youtubeEnabled === true,

          playbackState:
            youtube.youtubePlaybackState ===
            "playing"
              ? "playing"
              : "paused",

          label:
            cleanString(
              youtube.youtubeLabel
            ) ||
            "SOLO BEATS YOUTUBE RADIO",

          playlistId:
            cleanString(
              youtube.youtubePlaylistId
            ),
        },

        dj: {
          total: djTotal,
          active: djActive,
          expired: djExpired,
          suspended: djSuspended,
          revoked: djRevoked,
          scheduled: djScheduled,
          paymentRequired:
            djPaymentRequired,
          pendingApplications,
          pendingPayments:
            pendingDjPayments,
          activePaidSubscriptions:
            paidDjSubscriptions,
        },

        premium: {
          total:
            premiumMembers.length,
          active:
            activePremium,
          inactive:
            premiumMembers.length -
            activePremium,
        },

        mixMastering: {
          total:
            mixOrders.length,
          open:
            openMixOrders,
          paid:
            paidMixOrders,
        },

        platform: {
          accounts:
            usersResult.users.length,
          unreadNotifications,
        },

        notifications:
          latestNotifications,
      },
      {
        headers: {
          "Cache-Control":
            "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "";

    if (
      message ===
      "OWNER_AUTH_REQUIRED"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Owner sign-in is required.",
        },
        { status: 401 }
      );
    }

    if (
      message === "OWNER_ONLY"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Owner access only.",
        },
        { status: 403 }
      );
    }

    console.error(
      "Control Room live data error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Control Room live data could not be loaded.",
      },
      { status: 500 }
    );
  }
}


