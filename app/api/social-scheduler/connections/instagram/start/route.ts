import { randomUUID } from "crypto";
import { FieldValue } from "firebase-admin/firestore";
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
        "instagram"
      );

    const appId =
      process.env.INSTAGRAM_APP_ID?.trim() ||
      "1394720918748316";

    const redirectUri =
      (
        process.env
          .INSTAGRAM_REDIRECT_URI ||
        process.env
          .META_REDIRECT_URI
      )?.trim();

    if (
      !appId ||
      !redirectUri
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Instagram credentials are not configured.",
        },
        {
          status: 400,
        }
      );
    }

    const state =
      randomUUID();

    await adminDb
      .collection(
        "socialOAuthStates"
      )
      .doc(state)
      .set({
        provider:
          "instagram",

        connectionScope:
          "customer",

        customerUid:
          decoded.uid,

        customerEmail:
          decoded.email || null,

        used:
          false,

        createdAt:
          FieldValue.serverTimestamp(),

        expiresAt:
          Date.now() +
          10 * 60 * 1000,
      });

    const authUrl =
      new URL(
        "https://www.instagram.com/oauth/authorize"
      );

    authUrl.searchParams.set(
      "client_id",
      appId
    );

    authUrl.searchParams.set(
      "redirect_uri",
      redirectUri
    );

    authUrl.searchParams.set(
      "response_type",
      "code"
    );

    authUrl.searchParams.set(
      "force_reauth",
      "true"
    );

    authUrl.searchParams.set(
      "force_authentication",
      "1"
    );

    authUrl.searchParams.set(
      "scope",
      [
        "instagram_business_basic",
        "instagram_business_manage_messages",
        "instagram_business_manage_comments",
        "instagram_business_content_publish",
        "instagram_business_manage_insights",
      ].join(",")
    );

    authUrl.searchParams.set(
      "state",
      state
    );

    return NextResponse.json({
      success: true,
      authUrl:
        authUrl.toString(),
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
            ? "Instagram is not included in your current plan."
            : message ===
                "SCHEDULER_SUBSCRIPTION_REQUIRED"
              ? "An active Social Scheduler subscription is required."
              : "Instagram connection could not start.",
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

