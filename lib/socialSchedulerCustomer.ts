import { getAuth } from "firebase-admin/auth";

import {
  FieldValue,
} from "firebase-admin/firestore";

import {
  adminDb,
  firebaseAdminApp,
} from "./firebaseAdmin";

export type SchedulerPlatform =
  | "facebook"
  | "instagram"
  | "youtube"
  | "tiktok";

const OWNER_EMAIL =
  (
    process.env.OWNER_EMAIL ||
    process.env.NEXT_PUBLIC_OWNER_EMAIL ||
    "supe4.me@gmail.com"
  )
    .trim()
    .toLowerCase();

const OWNER_PLATFORMS:
  SchedulerPlatform[] = [
    "facebook",
    "instagram",
    "youtube",
    "tiktok",
  ];

function bearerToken(request: Request) {
  return request.headers
    .get("authorization")
    ?.match(/^Bearer\s+(.+)$/i)?.[1]
    ?.trim() || null;
}

export async function requireSchedulerCustomer(
  request: Request,
  platform?: SchedulerPlatform
) {
  const token =
    bearerToken(request);

  if (!token) {
    throw new Error(
      "CUSTOMER_AUTH_REQUIRED"
    );
  }

  const decoded =
    await getAuth(
      firebaseAdminApp
    ).verifyIdToken(token);

  const email =
    typeof decoded.email === "string"
      ? decoded.email
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
      .doc(decoded.uid);

  if (isOwner) {
    await customerRef.set(
      {
        uid:
          decoded.uid,

        email:
          decoded.email || null,

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

        platforms:
          OWNER_PLATFORMS,

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

    if (
      platform &&
      !OWNER_PLATFORMS.includes(
        platform
      )
    ) {
      throw new Error(
        "PLATFORM_NOT_INCLUDED"
      );
    }

    return {
      decoded,

      customer: {
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

        platforms:
          OWNER_PLATFORMS,

        recurringEnabled:
          true,

        subscriptionProvider:
          "owner",
      },

      platforms:
        OWNER_PLATFORMS,

      isOwner:
        true,
    };
  }

  const snapshot =
    await customerRef.get();

  if (!snapshot.exists) {
    throw new Error(
      "SCHEDULER_SUBSCRIPTION_REQUIRED"
    );
  }

  const customer =
    snapshot.data() || {};

  if (
    customer.accessActive !== true ||
    customer.status !== "ACTIVE"
  ) {
    throw new Error(
      "SCHEDULER_SUBSCRIPTION_REQUIRED"
    );
  }

  const platforms =
    Array.isArray(customer.platforms)
      ? customer.platforms.filter(
          (
            value: unknown
          ): value is SchedulerPlatform =>
            typeof value === "string" &&
            OWNER_PLATFORMS.includes(
              value as SchedulerPlatform
            )
        )
      : [];

  if (
    platform &&
    !platforms.includes(platform)
  ) {
    throw new Error(
      "PLATFORM_NOT_INCLUDED"
    );
  }

  return {
    decoded,
    customer,
    platforms,
    isOwner:
      false,
  };
}
