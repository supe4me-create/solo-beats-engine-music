import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";

import {
  firebaseAdminApp,
} from "../../../../lib/firebaseAdmin";
import {
  getPayPalAccessToken,
  PAYPAL_BASE_URL,
} from "../../../../lib/paypalVault";

function getBearerToken(
  request: Request
): string | null {
  const authorization =
    request.headers.get("authorization");

  if (!authorization) return null;

  const match =
    authorization.match(/^Bearer\s+(.+)$/i);

  return match?.[1]?.trim() || null;
}

export async function GET(
  request: Request
) {
  try {
    const idToken =
      getBearerToken(request);

    if (!idToken) {
      return NextResponse.json(
        {
          success: false,
          error:
            "You must be signed in.",
        },
        { status: 401 }
      );
    }

    await getAuth(
      firebaseAdminApp
    ).verifyIdToken(idToken);

    const accessToken =
      await getPayPalAccessToken();

    const response = await fetch(
      `${PAYPAL_BASE_URL}/v1/identity/generate-token`,
      {
        method: "POST",
        headers: {
          Authorization:
            `Bearer ${accessToken}`,
          "Content-Type":
            "application/json",
        },
        cache: "no-store",
      }
    );

    const data = await response.json();

    if (
      !response.ok ||
      typeof data.client_token !==
        "string"
    ) {
      throw new Error(
        data.error_description ||
          data.message ||
          "PayPal could not generate the secure card client token."
      );
    }

    return NextResponse.json({
      success: true,
      clientToken:
        data.client_token,
    });
  } catch (error) {
    console.error(
      "PayPal client-token error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "The secure card session could not be created.",
      },
      { status: 500 }
    );
  }
}

