import {
  ARTIST_MEMBERSHIP_PLANS,
  ARTIST_PAYPAL_ENVIRONMENT,
  ensureArtistPayPalPlans,
  getArtistPayPalClientId,
} from "../../../../lib/artistMembership";

export const runtime = "nodejs";

export async function GET() {
  try {
    const config =
      await ensureArtistPayPalPlans();

    const plans =
      ARTIST_MEMBERSHIP_PLANS.map(
        definition => ({
          ...definition,

          paypalPlanId:
            config.plans[
              definition.key
            ].paypalPlanId,
        })
      );

    return Response.json({
      success: true,

      paypalClientId:
        getArtistPayPalClientId(),

      paypalEnvironment:
        ARTIST_PAYPAL_ENVIRONMENT,

      plans,
    });
  } catch (error) {
    console.error(
      "Artist membership plans error:",
      error
    );

    return Response.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "Artist membership plans could not be loaded.",
      },
      {
        status: 500,
      }
    );
  }
}
