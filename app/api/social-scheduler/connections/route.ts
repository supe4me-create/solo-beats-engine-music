import {
  FieldValue,
} from "firebase-admin/firestore";

import {
  getAuth,
} from "firebase-admin/auth";

import {
  adminDb,
  firebaseAdminApp,
} from "../../../../lib/firebaseAdmin";

export const dynamic =
  "force-dynamic";

function bearer(request: Request) {
  return request.headers
    .get("authorization")
    ?.match(/^Bearer\s+(.+)$/i)?.[1]
    ?.trim() || null;
}

async function authenticatedCustomer(
  request: Request
) {
  const token =
    bearer(request);

  if (!token) {
    throw new Error(
      "AUTH_REQUIRED"
    );
  }

  return getAuth(
    firebaseAdminApp
  ).verifyIdToken(token);
}

export async function GET(
  request: Request
) {
  try {
    const customer =
      await authenticatedCustomer(
        request
      );

    const [
      customerSnapshot,
      connectionSnapshot,
    ] =
      await Promise.all([
        adminDb
          .collection(
            "socialSchedulerCustomers"
          )
          .doc(customer.uid)
          .get(),

        adminDb
          .collection(
            "socialSchedulerConnections"
          )
          .doc(customer.uid)
          .get(),
      ]);

    const account =
      customerSnapshot.data() || {};

    const stored =
      connectionSnapshot.data() || {};

    const allowedPlatforms =
      Array.isArray(account.platforms)
        ? account.platforms.filter(
            (
              value: unknown
            ): value is string =>
              typeof value === "string"
          )
        : [];

    return Response.json({
      success: true,

      accessActive:
        account.accessActive === true &&
        account.status === "ACTIVE",

      planName:
        typeof account.planName ===
          "string"
          ? account.planName
          : null,

      allowedPlatforms,

      facebook: {
        configured:
          Boolean(
            process.env.META_APP_ID &&
            process.env.META_APP_SECRET &&
            process.env.META_REDIRECT_URI
          ),

        connected:
          stored.facebookConnected ===
          true,

        pageName:
          typeof stored.facebookPageName ===
            "string"
            ? stored.facebookPageName
            : null,
      },

      instagram: {
        configured:
          Boolean(
            (
              process.env.INSTAGRAM_APP_ID ||
              process.env.META_APP_ID
            ) &&
            process.env.META_REDIRECT_URI
          ),

        connected:
          stored.instagramConnected ===
            true ||
          (
            typeof stored.instagramAccessTokenEncrypted ===
              "string" &&
            stored.instagramAccessTokenEncrypted
              .trim()
              .length > 0
          ),

        username:
          typeof stored.instagramUsername ===
            "string"
            ? stored.instagramUsername
            : null,
      },

      youtube: {
        configured:
          Boolean(
            process.env.YOUTUBE_CLIENT_ID &&
            process.env.YOUTUBE_CLIENT_SECRET &&
            process.env.YOUTUBE_REDIRECT_URI
          ),

        connected:
          stored.youtubeConnected ===
          true,

        channelTitle:
          typeof stored.youtubeChannelTitle ===
            "string"
            ? stored.youtubeChannelTitle
            : null,
      },

      tiktok: {
        configured:
          Boolean(
            process.env.TIKTOK_CLIENT_KEY &&
            process.env.TIKTOK_CLIENT_SECRET &&
            process.env.TIKTOK_REDIRECT_URI
          ),

        connected:
          stored.tiktokConnected ===
          true,

        username:
          typeof stored.tiktokUsername ===
            "string"
            ? stored.tiktokUsername
            : null,

        displayName:
          typeof stored.tiktokDisplayName ===
            "string"
            ? stored.tiktokDisplayName
            : null,
      },
    });
  } catch (error) {
    console.error(
      "Customer social status error:",
      error
    );

    return Response.json(
      {
        success: false,
        error:
          "Social connections could not be loaded.",
      },
      {
        status: 401,
      }
    );
  }
}

export async function DELETE(
  request: Request
) {
  try {
    const customer =
      await authenticatedCustomer(
        request
      );

    const body =
      await request.json();

    const platform =
      typeof body?.platform ===
        "string"
        ? body.platform
            .trim()
            .toLowerCase()
        : "";

    if (
      ![
        "facebook",
        "instagram",
        "youtube",
        "tiktok",
      ].includes(platform)
    ) {
      return Response.json(
        {
          success: false,
          error:
            "Invalid platform.",
        },
        {
          status: 400,
        }
      );
    }

    const updates:
      Record<string, unknown> = {
        updatedAt:
          FieldValue.serverTimestamp(),
      };

    if (platform === "facebook") {
      updates.facebookConnected =
        false;

      updates.facebookPageId =
        FieldValue.delete();

      updates.facebookPageName =
        FieldValue.delete();

      updates.facebookPageAccessTokenEncrypted =
        FieldValue.delete();

      updates.metaUserAccessTokenEncrypted =
        FieldValue.delete();
    }

    if (platform === "instagram") {
      updates.instagramConnected =
        false;

      updates.instagramAccountId =
        FieldValue.delete();

      updates.instagramUsername =
        FieldValue.delete();

      updates.instagramAccessTokenEncrypted =
        FieldValue.delete();

      updates.instagramTokenExpiresAt =
        FieldValue.delete();
    }

    if (platform === "youtube") {
      updates.youtubeConnected =
        false;

      updates.youtubeChannelId =
        FieldValue.delete();

      updates.youtubeChannelTitle =
        FieldValue.delete();

      updates.youtubeRefreshTokenEncrypted =
        FieldValue.delete();

      updates.youtubeScopes =
        FieldValue.delete();
    }

    if (platform === "tiktok") {
      updates.tiktokConnected =
        false;

      updates.tiktokAccessTokenEncrypted =
        FieldValue.delete();

      updates.tiktokRefreshTokenEncrypted =
        FieldValue.delete();

      updates.tiktokOpenId =
        FieldValue.delete();

      updates.tiktokUsername =
        FieldValue.delete();

      updates.tiktokDisplayName =
        FieldValue.delete();

      updates.tiktokScope =
        FieldValue.delete();

      updates.tiktokAccessTokenExpiresAt =
        FieldValue.delete();

      updates.tiktokRefreshTokenExpiresAt =
        FieldValue.delete();
    }

    await adminDb
      .collection(
        "socialSchedulerConnections"
      )
      .doc(customer.uid)
      .set(
        updates,
        {
          merge: true,
        }
      );

    return Response.json({
      success: true,
      platform,
    });
  } catch (error) {
    console.error(
      "Customer social disconnect error:",
      error
    );

    return Response.json(
      {
        success: false,
        error:
          "Social account could not be disconnected.",
      },
      {
        status: 500,
      }
    );
  }
}
