import { randomBytes } from "crypto";
import { NextResponse } from "next/server";

import {
  adminDb,
} from "../../../../../../lib/firebaseAdmin";

import {
  requireSchedulerCustomer,
} from "../../../../../../lib/socialSchedulerCustomer";

export const dynamic =
  "force-dynamic";

export async function POST(
  request: Request
) {
  try {
    const { decoded } =
      await requireSchedulerCustomer(
        request,
        "tiktok"
      );

    const clientKey =
      process.env.TIKTOK_CLIENT_KEY?.trim();

    const redirectUri =
      process.env.TIKTOK_REDIRECT_URI?.trim();

    if (
      !clientKey ||
      !redirectUri
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "TikTok credentials are not configured.",
        },
        {
          status: 400,
        }
      );
    }

    const state =
      randomBytes(24)
        .toString("hex");

    await adminDb
      .collection(
        "socialOauthStates"
      )
      .doc(
        `tiktok-${state}`
      )
      .set({
        provider:
          "tiktok",

        state,

        connectionScope:
          "customer",

        customerUid:
          decoded.uid,

        customerEmail:
          decoded.email || null,

        createdAt:
          Date.now(),

        expiresAt:
          Date.now() +
          10 * 60 * 1000,
      });

    const params =
      new URLSearchParams({
        client_key:
          clientKey,

        response_type:
          "code",

        scope:
          [
            "user.info.basic",
            "video.upload",
            "video.publish",
          ].join(","),

        redirect_uri:
          redirectUri,

        state,
      });

    return NextResponse.json({
      success: true,

      authUrl:
        "https://www.tiktok.com/v2/auth/authorize/?" +
        params.toString(),
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "";

    return NextResponse.json(
      {
        success: false,
        error:
          message ===
          "PLATFORM_NOT_INCLUDED"
            ? "TikTok is not included in your current plan."
            : message ===
                "SCHEDULER_SUBSCRIPTION_REQUIRED"
              ? "An active Social Scheduler subscription is required."
              : "TikTok connection could not start.",
      },
      {
        status:
          message ===
          "CUSTOMER_AUTH_REQUIRED"
            ? 401
            : 403,
      }
    );
  }
}
