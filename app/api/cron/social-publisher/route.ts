import {
  NextResponse,
} from "next/server";

import {
  runSocialPublisher,
} from "../../../../lib/socialPublisher";

import {
  runCustomerSocialPublisher,
} from "../../../../lib/customerSocialPublisher";

// SOLO_CUSTOMER_AUTO_PUBLISHER_V1

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export const maxDuration =
  300;

function authorized(
  request: Request
) {
  const expected =
    (
      process.env.AUTO_PUBLISH_CRON_KEY ||
      process.env.SOCIAL_PUBLISHER_SECRET ||
      ""
    ).trim();

  if (!expected) {
    return false;
  }

  const authorization =
    request.headers.get(
      "authorization"
    ) || "";

  return (
    authorization ===
    `Bearer ${expected}`
  );
}

export async function GET(
  request: Request
) {
  if (!authorized(request)) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Publisher authorization failed.",
      },
      {
        status: 401,
      }
    );
  }

  try {
    const result =
      await runSocialPublisher();

    try {
      await runCustomerSocialPublisher();
    } catch (customerError) {
      console.error(
        "CUSTOMER AUTOMATIC SOCIAL PUBLISHER ERROR:",
        customerError
      );
    }

    return NextResponse.json(
      result,
      {
        headers: {
          "Cache-Control":
            "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error(
      "SOCIAL PUBLISHER ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Publisher failed.",
      },
      {
        status: 500,
      }
    );
  }
}
