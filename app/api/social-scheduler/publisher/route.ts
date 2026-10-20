import {
  NextResponse,
} from "next/server";

import {
  runCustomerSocialPublisher,
} from "../../../../lib/customerSocialPublisher";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export const maxDuration =
  300;

// ============================================================
// SOLO_CUSTOMER_MANUAL_PUBLISHER_SECURITY_V1
// This route is NOT public.
// It requires SOCIAL_PUBLISHER_CRON_SECRET.
// ============================================================

function authorized(
  request: Request
) {
  const expected =
    process.env
      .SOCIAL_PUBLISHER_CRON_SECRET
      ?.trim() || "";

  if (!expected) {
    return false;
  }

  const bearer =
    request.headers
      .get("authorization")
      ?.match(
        /^Bearer\s+(.+)$/i
      )?.[1]
      ?.trim() || "";

  const headerSecret =
    request.headers
      .get(
        "x-social-publisher-secret"
      )
      ?.trim() || "";

  return (
    bearer === expected ||
    headerSecret === expected
  );
}

async function run(
  request: Request
) {
  if (!authorized(request)) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Unauthorized.",
      },
      {
        status: 401,
      }
    );
  }

  try {
    const result =
      await runCustomerSocialPublisher();

    return NextResponse.json(
      result
    );
  } catch (error) {
    console.error(
      "CUSTOMER SOCIAL PUBLISHER ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "Customer publisher failed.",
      },
      {
        status: 500,
      }
    );
  }
}

export async function GET(
  request: Request
) {
  return run(request);
}

export async function POST(
  request: Request
) {
  return run(request);
}
