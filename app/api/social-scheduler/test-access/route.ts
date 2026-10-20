import {
  getAuth,
} from "firebase-admin/auth";

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

function bearer(
  request: Request
) {
  return request.headers
    .get("authorization")
    ?.match(
      /^Bearer\s+(.+)$/i
    )?.[1]
    ?.trim() || null;
}

export async function POST(
  request: Request
) {
  try {
    const token =
      bearer(request);

    if (!token) {
      return Response.json(
        {
          success: false,
          error:
            "Authentication required.",
        },
        {
          status: 401,
        }
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

    if (email !== OWNER_EMAIL) {
      return Response.json(
        {
          success: false,
          error:
            "Owner access required.",
        },
        {
          status: 403,
        }
      );
    }

    await adminDb
      .collection(
        "socialSchedulerCustomers"
      )
      .doc(decoded.uid)
      .set(
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

          testAccess:
            false,

          ownerAccessGrantedAt:
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

      uid:
        decoded.uid,

      email:
        decoded.email || null,

      planName:
        "Owner — Free Unlimited",

      ownerUnlimited:
        true,
    });
  } catch (error) {
    console.error(
      "Social Scheduler owner access error:",
      error
    );

    return Response.json(
      {
        success: false,
        error:
          "Owner access could not be activated.",
      },
      {
        status: 500,
      }
    );
  }
}
