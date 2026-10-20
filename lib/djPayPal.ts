import { adminDb } from "./firebaseAdmin";

export type DjPlanKey =
  | "monthly"
  | "three_month"
  | "annual";

export type DjPlanDefinition = {
  key: DjPlanKey;
  name: string;
  price: string;
  months: number;
};

export const DJ_PLAN_DEFINITIONS: DjPlanDefinition[] = [
  {
    key: "monthly",
    name: "Monthly DJ Access",
    price: "29.99",
    months: 1,
  },
  {
    key: "three_month",
    name: "3-Month DJ Access",
    price: "74.99",
    months: 3,
  },
  {
    key: "annual",
    name: "Annual DJ Access",
    price: "199.99",
    months: 12,
  },
];

export const PAYPAL_BASE_URL = (
  process.env.PAYPAL_BASE_URL ||
  "https://api-m.sandbox.paypal.com"
).replace(/\/+$/, "");

export async function getPayPalAccessToken() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "PayPal server credentials are missing. PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET are required."
    );
  }

  const credentials = Buffer.from(
    `${clientId}:${clientSecret}`
  ).toString("base64");

  const response = await fetch(
    `${PAYPAL_BASE_URL}/v1/oauth2/token`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type":
          "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
      cache: "no-store",
    }
  );

  const data = await response.json();

  if (!response.ok || !data.access_token) {
    throw new Error(
      data.error_description ||
        "PayPal authentication failed."
    );
  }

  return data.access_token as string;
}

export type DjPayPalPlanConfig = {
  productId: string;
  plans: Record<
    DjPlanKey,
    {
      paypalPlanId: string;
      name: string;
      price: string;
      months: number;
    }
  >;
};

// SOLO_DJ_PLAN_CONFIG_CURRENT_V2
export function isDjPayPalPlanConfigCurrent(
  config: DjPayPalPlanConfig | null
) {
  if (!config) return false;

  return DJ_PLAN_DEFINITIONS.every(
    definition => {
      const stored =
        config.plans[definition.key];

      return (
        stored?.paypalPlanId &&
        stored.price === definition.price &&
        stored.months === definition.months
      );
    }
  );
}

const configRef = () =>
  adminDb
    .collection("systemConfig")
    .doc("djPayPalPlans");

export async function getDjPayPalPlanConfig():
  Promise<DjPayPalPlanConfig | null> {
  const snapshot = await configRef().get();

  if (!snapshot.exists) return null;

  const data =
    snapshot.data() as Partial<DjPayPalPlanConfig>;

  if (
    !data.productId ||
    !data.plans?.monthly?.paypalPlanId ||
    !data.plans?.three_month?.paypalPlanId ||
    !data.plans?.annual?.paypalPlanId
  ) {
    return null;
  }

  return data as DjPayPalPlanConfig;
}

async function paypalRequest(
  path: string,
  options: RequestInit
) {
  const accessToken =
    await getPayPalAccessToken();

  const response = await fetch(
    `${PAYPAL_BASE_URL}${path}`,
    {
      ...options,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      cache: "no-store",
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.details?.[0]?.description ||
        data?.message ||
        `PayPal request failed: ${response.status}`
    );
  }

  return data;
}

export async function ensureDjPayPalPlans() {
  const existing =
    await getDjPayPalPlanConfig();

  if (isDjPayPalPlanConfigCurrent(existing)) return existing;

  const product = await paypalRequest(
    "/v1/catalogs/products",
    {
      method: "POST",
      body: JSON.stringify({
        name: "SOLO BEATS ENGINE MUSIC DJ ACCESS",
        description:
          "Timed DJ access to SOLO BEATS ENGINE MUSIC DJ tools and radio playback library.",
        type: "DIGITAL",
      }),
    }
  );

  const plans =
    {} as DjPayPalPlanConfig["plans"];

  for (const definition of DJ_PLAN_DEFINITIONS) {
    const plan = await paypalRequest(
      "/v1/billing/plans",
      {
        method: "POST",
        body: JSON.stringify({
          product_id: product.id,
          name: definition.name,
          description:
            `${definition.name} - SOLO BEATS ENGINE MUSIC`,
          status: "ACTIVE",

          billing_cycles: [
            {
              frequency: {
                interval_unit: "MONTH",
                interval_count: definition.months,
              },

              tenure_type: "REGULAR",
              sequence: 1,
              total_cycles: 0,

              pricing_scheme: {
                fixed_price: {
                  value: definition.price,
                  currency_code: "USD",
                },
              },
            },
          ],

          payment_preferences: {
            auto_bill_outstanding: true,
            payment_failure_threshold: 1,
          },
        }),
      }
    );

    plans[definition.key] = {
      paypalPlanId: plan.id,
      name: definition.name,
      price: definition.price,
      months: definition.months,
    };
  }

  const config: DjPayPalPlanConfig = {
    productId: product.id,
    plans,
  };

  await configRef().set(
    {
      ...config,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
    { merge: true }
  );

  return config;
}

export function addMonths(
  value: number,
  months: number
) {
  const date = new Date(value);
  date.setUTCMonth(
    date.getUTCMonth() + months
  );
  return date.getTime();
}

export function planFromPaypalId(
  config: DjPayPalPlanConfig,
  paypalPlanId: string
) {
  return DJ_PLAN_DEFINITIONS.find(
    definition =>
      config.plans[definition.key]
        ?.paypalPlanId === paypalPlanId
  ) || null;
}
