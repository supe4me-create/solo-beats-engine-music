import { NextResponse } from "next/server";
import { requirePremiumAccess } from "../../../../lib/requirePremium";

export async function GET(request: Request) {
  try {
    const access =
      await requirePremiumAccess(request);

    if (!access.allowed) {
      return NextResponse.json(
        {
          success: false,
          premiumAccess: false,
          error: access.error,
        },
        { status: access.statusCode }
      );
    }

    return NextResponse.json({
      success: true,
      premiumAccess: true,
      status: access.status,
      subscriptionId:
        access.subscriptionId,
      nextBillingTime:
        access.nextBillingTime,
      message:
        "Premium access confirmed.",
    });
  } catch (error) {
    console.error(
      "Premium access check error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        premiumAccess: false,
        error:
          error instanceof Error
            ? error.message
            : "Premium access could not be checked.",
      },
      { status: 500 }
    );
  }
}

