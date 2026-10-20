import { getAuth } from "firebase-admin/auth";

import {
  FieldValue,
} from "firebase-admin/firestore";

import {
  adminDb,
  firebaseAdminApp,
} from "../../../../lib/firebaseAdmin";

export const dynamic =
  "force-dynamic";

const OWNER_EMAIL =
  (
    process.env.OWNER_EMAIL ||
    process.env.NEXT_PUBLIC_OWNER_EMAIL ||
    "supe4.me@gmail.com"
  )
    .trim()
    .toLowerCase();

function bearerToken(
  request: Request
): string | null {
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

function cleanText(
  value: unknown
): string | null {
  return (
    typeof value === "string" &&
    value.trim()
  )
    ? value.trim()
    : null;
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
            "Sign in to access the Social Scheduler.",
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

    const email =
      typeof customer.email ===
        "string"
        ? customer.email
            .trim()
            .toLowerCase()
        : "";

    const isOwner =
      Boolean(email) &&
      email === OWNER_EMAIL;

    const customerRef =
      adminDb
        .collection(
          "socialSchedulerCustomers"
        )
        .doc(customer.uid);

    if (isOwner) {
      await customerRef.set(
        {
          uid:
            customer.uid,

          email:
            customer.email || null,

          accessActive:
            true,

          status:
            "ACTIVE",

          planKey:
            "owner",

          planName:
            "Owner — Free Unlimited",

          price:
            0,

          monthlyPostLimit:
            -1,

          maxConnectedAccounts:
            -1,

          ownerUnlimited:
            true,

          platforms: [
            "facebook",
            "instagram",
            "youtube",
            "tiktok",
          ],

          recurringEnabled:
            true,

          subscriptionProvider:
            "owner",

          updatedAt:
            FieldValue.serverTimestamp(),
        },
        {
          merge: true,
        }
      );

      return Response.json({
        success:
          true,

        customer: {
          uid:
            customer.uid,

          email:
            customer.email || null,
        },

        scheduler: {
          accessActive:
            true,

          status:
            "ACTIVE",

          planId:
            null,

          planName:
            "Owner — Free Unlimited",

          subscriptionId:
            null,

          subscriptionProvider:
            "owner",

          currentPeriodEnd:
            null,

          monthlyPostLimit:
            -1,

          maxConnectedAccounts:
            -1,

          ownerUnlimited:
            true,
        },
      });
    }

    const snapshot =
      await customerRef.get();

    const data =
      snapshot.exists
        ? snapshot.data() || {}
        : {};

    const accessActive =
      data.accessActive === true;

    const status =
      cleanText(data.status) ||
      (
        accessActive
          ? "ACTIVE"
          : "NOT_SUBSCRIBED"
      );

    return Response.json({
      success: true,

      customer: {
        uid:
          customer.uid,

        email:
          customer.email || null,
      },

      scheduler: {
        accessActive,

        status,

        planId:
          cleanText(data.planId),

        planName:
          cleanText(data.planName),

        subscriptionId:
          cleanText(
            data.subscriptionId
          ),

        subscriptionProvider:
          cleanText(
            data.subscriptionProvider
          ),

        currentPeriodEnd:
          cleanText(
            data.currentPeriodEnd
          ),

        monthlyPostLimit:
          Number(
            data.monthlyPostLimit
          ) || 0,

        maxConnectedAccounts:
          Number(
            data.maxConnectedAccounts
          ) || 0,

        ownerUnlimited:
          data.ownerUnlimited ===
          true,
      },
    });
  } catch (error) {
    console.error(
      "Customer Social Scheduler status error:",
      error
    );

    return Response.json(
      {
        success: false,
        error:
          "Social Scheduler access could not be loaded.",
      },
      {
        status: 500,
      }
    );
  }
}
