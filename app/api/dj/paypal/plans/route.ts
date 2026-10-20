import {
  radioAccount,
  requireRadioOwner,
  radioAccessFailure,
  RadioAccessError,
} from "../../../../../lib/radioDjAccess";

import { adminDb } from "../../../../../lib/firebaseAdmin";

import {
  DJ_PLAN_DEFINITIONS,
  ensureDjPayPalPlans,
  getDjPayPalPlanConfig,
  isDjPayPalPlanConfigCurrent,
} from "../../../../../lib/djPayPal";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { account, owner } =
      await radioAccount(request);

    if (
      !owner &&
      account.customClaims
        ?.soloBeatsRadioDj !== true
    ) {
      throw new RadioAccessError(
        "Owner DJ approval is required before choosing a paid plan.",
        403
      );
    }

    const storedConfig =
      await getDjPayPalPlanConfig();

    // SOLO_DJ_PAYPAL_NULL_SAFE_V2
    // Only expose PayPal plans when the stored configuration
    // matches the current SOLO BEATS DJ pricing.
    const config =
      storedConfig &&
      isDjPayPalPlanConfigCurrent(
        storedConfig
      )
        ? storedConfig
        : null;

    const subscriptionSnapshot =
      await adminDb
        .collection("djSubscriptions")
        .doc(account.uid)
        .get();

    const subscription =
      subscriptionSnapshot.exists
        ? subscriptionSnapshot.data()
        : null;

    const plans =
      config !== null
        ? DJ_PLAN_DEFINITIONS.map(
            definition => {
              const storedPlan =
                config.plans[
                  definition.key
                ];

              return {
                ...definition,
                paypalPlanId:
                  storedPlan.paypalPlanId,
              };
            }
          )
        : [];

    return Response.json(
      {
        success: true,

        configured:
          config !== null,

        plans,

        subscription:
          subscription
            ? {
                planKey:
                  subscription.planKey ||
                  null,

                status:
                  subscription.status ||
                  null,

                ownerApproved:
                  subscription.ownerApproved ===
                  true,

                pendingOwnerApproval:
                  subscription.pendingOwnerApproval ===
                  true,

                currentPeriodEnd:
                  subscription.currentPeriodEnd ||
                  null,
              }
            : null,
      },
      {
        headers: {
          "Cache-Control":
            "no-store",
        },
      }
    );
  } catch (error) {
    return radioAccessFailure(
      error
    );
  }
}

export async function POST(
  request: Request
) {
  try {
    await requireRadioOwner(
      request
    );

    const config =
      await ensureDjPayPalPlans();

    // SOLO_DJ_POST_CONFIG_GUARD_V2
    if (!config) {
      throw new RadioAccessError(
        "DJ PayPal plans could not be initialized.",
        500
      );
    }

    const plans =
      DJ_PLAN_DEFINITIONS.map(
        definition => {
          const storedPlan =
            config.plans[
              definition.key
            ];

          return {
            ...definition,
            paypalPlanId:
              storedPlan.paypalPlanId,
          };
        }
      );

    return Response.json(
      {
        success: true,
        configured: true,
        plans,
      },
      {
        headers: {
          "Cache-Control":
            "no-store",
        },
      }
    );
  } catch (error) {
    return radioAccessFailure(
      error
    );
  }
}