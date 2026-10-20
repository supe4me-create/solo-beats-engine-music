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
        "youtube"
      );

    const clientId =
      process.env.YOUTUBE_CLIENT_ID?.trim();

    const redirectUri =
      process.env.YOUTUBE_REDIRECT_URI?.trim();

    if (
      !clientId ||
      !redirectUri
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "YouTube OAuth credentials are not configured.",
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
          "youtube",

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
        "https://accounts.google.com/o/oauth2/v2/auth"
      );

    authUrl.searchParams.set(
      "client_id",
      clientId
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
      "access_type",
      "offline"
    );

    authUrl.searchParams.set(
      "prompt",
      "consent"
    );

    authUrl.searchParams.set(
      "scope",
      [
        "https://www.googleapis.com/auth/youtube.upload",
        "https://www.googleapis.com/auth/youtube.readonly",
      ].join(" ")
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
            ? "YouTube is not included in your current plan."
            : message ===
                "SCHEDULER_SUBSCRIPTION_REQUIRED"
              ? "An active Social Scheduler subscription is required."
              : "YouTube connection could not start.",
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
