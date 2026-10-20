import {
  SOCIAL_SCHEDULER_PAYPAL_ENVIRONMENT,
  SOCIAL_SCHEDULER_PLANS,
  ensureSocialSchedulerPayPalPlans,
  getSocialSchedulerPayPalClientId,
} from "../../../../lib/socialSchedulerBilling";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

export async function GET() {
  try {
    const config =
      await ensureSocialSchedulerPayPalPlans();

    const plans =
      SOCIAL_SCHEDULER_PLANS.map(
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
        getSocialSchedulerPayPalClientId(),

      paypalEnvironment:
        SOCIAL_SCHEDULER_PAYPAL_ENVIRONMENT,

      plans,
    });
  } catch (error) {
    console.error(
      "Social Scheduler plans error:",
      error
    );

    return Response.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Social Scheduler plans could not be loaded.",
      },
      {
        status: 500,
      }
    );
  }
}
