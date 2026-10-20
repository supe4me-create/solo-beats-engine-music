import {
  NextResponse,
} from "next/server";

import {
  runSocialPublisher,
} from "../../../../lib/socialPublisher";

import {
  runCustomerSocialPublisher,
} from "../../../../lib/customerSocialPublisher";

// SOLO_CUSTOMER_EXTERNAL_AUTO_PUBLISHER_V1

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function getAutomationSecret(
  request: Request
) {
  const bearer =
    request.headers
      .get("authorization")
      ?.match(/^Bearer\s+(.+)$/i)?.[1]
      ?.trim();

  const headerSecret =
    request.headers
      .get(
        "x-social-publisher-secret"
      )
      ?.trim();

  const urlSecret =
    new URL(request.url)
      .searchParams
      .get("key")
      ?.trim();

  return (
    bearer ||
    headerSecret ||
    urlSecret ||
    ""
  );
}

async function run(
  request: Request
) {
  try {
    const expected =
      process.env
        .SOCIAL_PUBLISHER_CRON_SECRET
        ?.trim();

    if (!expected) {
      return NextResponse.json(
        {
          success: false,
          error:
            "SOCIAL_PUBLISHER_CRON_SECRET is not configured.",
        },
        {
          status: 500,
        }
      );
    }

    const supplied =
      getAutomationSecret(
        request
      );

    if (
      !supplied ||
      supplied !== expected
    ) {
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

    const ownerResult =
      await runSocialPublisher();

    const customerResult =
      await runCustomerSocialPublisher();

    const result = {
      success: true,
      owner: ownerResult,
      customer: customerResult,
    };

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
      "AUTOMATIC SOCIAL PUBLISHER ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Automatic publisher failed.",
      },
      {
        status: 500,
      }
    );
  }
}

export async function POST(
  request: Request
) {
  return run(request);
}

export async function GET(
  request: Request
) {
  return run(request);
}

