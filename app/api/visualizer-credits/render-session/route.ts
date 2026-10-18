import {
  NextResponse,
} from "next/server";

import {
  reserveVisualizerCredit,
  requireVisualizerRenderAccess,
  refundVisualizerReservation,
} from "../../../../lib/visualizerRenderAccess";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export async function POST(
  request: Request
) {
  try {
    const body =
      await request.json()
        .catch(
          () => ({})
        );

    const action =
      typeof body?.action ===
      "string"
        ? body.action.trim()
        : "";

    if (
      action ===
      "reserve"
    ) {
      const result =
        await reserveVisualizerCredit(
          request
        );

      return NextResponse.json(
        result
      );
    }

    if (
      action ===
      "refund"
    ) {
      const reservationId =
        typeof body?.reservationId ===
        "string"
          ? body.reservationId
          : "";

      const access =
        await requireVisualizerRenderAccess(
          request,
          reservationId
        );

      await refundVisualizerReservation(
        access,
        typeof body?.reason ===
        "string"
          ? body.reason.slice(
              0,
              250
            )
          : "client_render_failure"
      );

      return NextResponse.json({
        success:
          true,

        refunded:
          !access.owner,

        ownerBypass:
          access.owner,
      });
    }

    return NextResponse.json(
      {
        success:
          false,

        error:
          "INVALID_RENDER_SESSION_ACTION",
      },
      {
        status:
          400,
      }
    );
  }
  catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "VISUALIZER_RENDER_SESSION_FAILED";

    const status =
      message ===
      "AUTH_REQUIRED" ||
      message ===
      "AUTH_INVALID"
        ? 401
        : message ===
          "EMAIL_VERIFICATION_REQUIRED" ||
          message ===
          "ACCOUNT_DISABLED"
          ? 403
          : message ===
            "NO_VISUALIZER_CREDITS"
            ? 402
            : 400;

    return NextResponse.json(
      {
        success:
          false,

        error:
          message,
      },
      {
        status,
      }
    );
  }
}