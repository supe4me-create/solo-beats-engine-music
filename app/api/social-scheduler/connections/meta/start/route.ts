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
        "facebook"
      );

    const appId =
      process.env.META_APP_ID?.trim();

    const redirectUri =
      process.env.META_REDIRECT_URI?.trim();

    const configId =
      process.env.META_CONFIG_ID?.trim();

    const version =
      process.env.META_GRAPH_VERSION?.trim() ||
      "v23.0";

    if (
      !appId ||
      !redirectUri ||
      !configId
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Meta credentials are not configured.",
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
          "meta",

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
        `https://www.facebook.com/${version}/dialog/oauth`
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
      "state",
      state
    );

    authUrl.searchParams.set(
      "config_id",
      configId
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
            ? "Facebook is not included in your current plan."
            : message ===
                "SCHEDULER_SUBSCRIPTION_REQUIRED"
              ? "An active Social Scheduler subscription is required."
              : "Facebook connection could not start.",
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
