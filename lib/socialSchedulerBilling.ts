import {
  adminDb,
} from "./firebaseAdmin";

export type SocialSchedulerPlanKey =
  | "starter"
  | "pro"
  | "business";

export type SocialSchedulerPlan = {
  key: SocialSchedulerPlanKey;
  name: string;
  price: string;
  monthlyPostLimit: number;
  maxConnectedAccounts: number;
  platforms: string[];
  recurringEnabled: boolean;
  description: string;
};

export const SOCIAL_SCHEDULER_PLANS:
  SocialSchedulerPlan[] = [
    {
      key: "starter",
      name: "Starter",
      price: "9.99",
      monthlyPostLimit: 30,
      maxConnectedAccounts: 2,
      platforms: [
        "facebook",
        "instagram",
      ],
      recurringEnabled: false,
      description:
        "30 scheduled image or video posts per month, up to 2 connected social accounts.",
    },
    {
      key: "pro",
      name: "Pro",
      price: "19.99",
      monthlyPostLimit: 150,
      maxConnectedAccounts: 5,
      platforms: [
        "facebook",
        "instagram",
      ],
      recurringEnabled: true,
      description:
        "150 scheduled image or video posts per month, up to 5 connected social accounts and recurring campaigns.",
    },
    {
      key: "business",
      name: "Business",
      price: "39.99",
      monthlyPostLimit: 500,
      maxConnectedAccounts: 10,
      platforms: [
        "facebook",
        "instagram",
      ],
      recurringEnabled: true,
      description:
        "500 scheduled image or video posts per month, up to 10 connected social accounts and recurring campaigns.",
    },
  ];

export const SOCIAL_SCHEDULER_PAYPAL_BASE_URL =
  (
    process.env.PAYPAL_BASE_URL ||
    "https://api-m.paypal.com"
  ).replace(/\/+$/, "");

export const SOCIAL_SCHEDULER_PAYPAL_ENVIRONMENT:
  "live" | "sandbox" =
  SOCIAL_SCHEDULER_PAYPAL_BASE_URL.includes(
    "sandbox"
  )
    ? "sandbox"
    : "live";

export function getSocialSchedulerPayPalClientId() {
  return (
    process.env.PAYPAL_CLIENT_ID ||
    ""
  ).replace(/\s+/g, "");
}

export async function getSocialSchedulerPayPalAccessToken() {
  const clientId =
    process.env.PAYPAL_CLIENT_ID;

  const clientSecret =
    process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "PayPal server credentials are missing."
    );
  }

  const credentials =
    Buffer.from(
      `${clientId}:${clientSecret}`
    ).toString("base64");

  const response =
    await fetch(
      `${SOCIAL_SCHEDULER_PAYPAL_BASE_URL}/v1/oauth2/token`,
      {
        method: "POST",
        headers: {
          Authorization:
            `Basic ${credentials}`,
          "Content-Type":
            "application/x-www-form-urlencoded",
        },
        body:
          "grant_type=client_credentials",
        cache: "no-store",
      }
    );

  const data =
    await response.json();

  if (
    !response.ok ||
    typeof data?.access_token !==
      "string"
  ) {
    throw new Error(
      data?.error_description ||
        "PayPal access token could not be created."
    );
  }

  return data.access_token as string;
}

type StoredPlan = {
  paypalPlanId: string;
  name: string;
  price: string;
};

type SchedulerPayPalConfig = {
  environment: "live" | "sandbox";
  productId: string;
  plans: Record<
    SocialSchedulerPlanKey,
    StoredPlan
  >;
};

function configRef() {
  return adminDb
    .collection(
      "socialSchedulerConfiguration"
    )
    .doc("paypal");
}

async function paypalRequest(
  path: string,
  options: RequestInit = {}
) {
  const accessToken =
    await getSocialSchedulerPayPalAccessToken();

  const response =
    await fetch(
      `${SOCIAL_SCHEDULER_PAYPAL_BASE_URL}${path}`,
      {
        ...options,
        headers: {
          Authorization:
            `Bearer ${accessToken}`,
          "Content-Type":
            "application/json",
          ...(options.headers || {}),
        },
        cache: "no-store",
      }
    );

  const text =
    await response.text();

  let data: any = null;

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!response.ok) {
    throw new Error(
      typeof data?.message ===
        "string"
        ? data.message
        : `PayPal request failed (${response.status}).`
    );
  }

  return data;
}

function validStoredConfig(
  data: any
): data is SchedulerPayPalConfig {
  if (
    !data ||
    data.environment !==
      SOCIAL_SCHEDULER_PAYPAL_ENVIRONMENT ||
    typeof data.productId !== "string" ||
    !data.productId
  ) {
    return false;
  }

  return SOCIAL_SCHEDULER_PLANS.every(
    plan => {
      const stored =
        data.plans?.[plan.key];

      return (
        typeof stored?.paypalPlanId ===
          "string" &&
        stored.paypalPlanId.length > 0 &&
        stored.price === plan.price
      );
    }
  );
}

export async function ensureSocialSchedulerPayPalPlans() {
  const snapshot =
    await configRef().get();

  const stored =
    snapshot.exists
      ? snapshot.data()
      : null;

  if (validStoredConfig(stored)) {
    return stored;
  }

  const product =
    await paypalRequest(
      "/v1/catalogs/products",
      {
        method: "POST",
        body:
          JSON.stringify({
            name:
              "SOLO BEATS Social Scheduler",
            description:
              "Social media scheduling subscription by SOLO BEATS ENGINE MUSIC.",
            type:
              "SERVICE",
            category:
              "SOFTWARE",
          }),
      }
    );

  if (
    typeof product?.id !==
      "string"
  ) {
    throw new Error(
      "PayPal product ID was not returned."
    );
  }

  const plans =
    {} as SchedulerPayPalConfig["plans"];

  for (
    const definition of
    SOCIAL_SCHEDULER_PLANS
  ) {
    const plan =
      await paypalRequest(
        "/v1/billing/plans",
        {
          method: "POST",
          body:
            JSON.stringify({
              product_id:
                product.id,

              name:
                `SOLO BEATS Social Scheduler - ${definition.name}`,

              description:
                definition.description,

              status:
                "ACTIVE",

              billing_cycles: [
                {
                  frequency: {
                    interval_unit:
                      "MONTH",
                    interval_count:
                      1,
                  },

                  tenure_type:
                    "REGULAR",

                  sequence:
                    1,

                  total_cycles:
                    0,

                  pricing_scheme: {
                    fixed_price: {
                      value:
                        definition.price,
                      currency_code:
                        "USD",
                    },
                  },
                },
              ],

              payment_preferences: {
                auto_bill_outstanding:
                  true,

                setup_fee: {
                  value:
                    "0",
                  currency_code:
                    "USD",
                },

                setup_fee_failure_action:
                  "CONTINUE",

                payment_failure_threshold:
                  3,
              },
            }),
        }
      );

    if (
      typeof plan?.id !==
        "string"
    ) {
      throw new Error(
        `PayPal plan ID was not returned for ${definition.name}.`
      );
    }

    plans[definition.key] = {
      paypalPlanId:
        plan.id,

      name:
        definition.name,

      price:
        definition.price,
    };
  }

  const config:
    SchedulerPayPalConfig = {
      environment:
        SOCIAL_SCHEDULER_PAYPAL_ENVIRONMENT,

      productId:
        product.id,

      plans,
    };

  await configRef().set(
    config,
    {
      merge: false,
    }
  );

  return config;
}

export function schedulerPlanFromPaypalId(
  config: SchedulerPayPalConfig,
  paypalPlanId: string
) {
  return (
    SOCIAL_SCHEDULER_PLANS.find(
      definition =>
        config.plans[
          definition.key
        ]?.paypalPlanId ===
        paypalPlanId
    ) ||
    null
  );
}
