import { adminDb } from "./firebaseAdmin";

export type ArtistMembershipPlanKey =
  | "starter"
  | "pro"
  | "elite";

export type ArtistMembershipPlanDefinition = {
  key: ArtistMembershipPlanKey;
  name: string;
  price: string;
  interval: "MONTH";
  uploads: string;
  promotion: string;
  analytics: string;
  mixMasterDiscount: string;
};

export const ARTIST_MEMBERSHIP_PLANS:
  ArtistMembershipPlanDefinition[] = [
  {
    key: "starter",
    name: "Starter Artist",
    price: "9.99",
    interval: "MONTH",
    uploads: "Artist profile + basic music uploads",
    promotion: "Eligible for SOLO BEATS discovery",
    analytics: "Basic artist analytics",
    mixMasterDiscount: "5% Mix & Mastering discount",
  },
  {
    key: "pro",
    name: "Artist Pro",
    price: "24.99",
    interval: "MONTH",
    uploads: "Expanded music uploads",
    promotion: "Radio consideration + promotion tools",
    analytics: "Advanced artist analytics",
    mixMasterDiscount: "10% Mix & Mastering discount",
  },
  {
    key: "elite",
    name: "Elite Artist",
    price: "49.99",
    interval: "MONTH",
    uploads: "Maximum artist upload access",
    promotion: "Priority promotional consideration",
    analytics: "Full artist analytics",
    mixMasterDiscount: "20% Mix & Mastering discount",
  },
];

export const PAYPAL_BASE_URL = (
  process.env.PAYPAL_BASE_URL ||
  "https://api-m.paypal.com"
).replace(/\/+$/, "");

export const ARTIST_PAYPAL_ENVIRONMENT:
  "live" | "sandbox" =
  PAYPAL_BASE_URL.includes("sandbox")
    ? "sandbox"
    : "live";

export function getArtistPayPalClientId() {
  return (
    process.env.PAYPAL_CLIENT_ID ||
    ""
  ).replace(/\s+/g, "");
}

export async function getArtistPayPalAccessToken() {
  const clientId =
    process.env.PAYPAL_CLIENT_ID;

  const clientSecret =
    process.env.PAYPAL_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "PayPal server credentials are missing."
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
        Authorization:
          `Basic ${credentials}`,
        "Content-Type":
          "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
      cache: "no-store",
    }
  );

  const data = await response.json();

  if (
    !response.ok ||
    !data.access_token
  ) {
    throw new Error(
      data.error_description ||
        "PayPal authentication failed."
    );
  }

  return data.access_token as string;
}

export type ArtistPayPalPlanConfig = {
  productId: string;

  environment:
    | "live"
    | "sandbox";

  plans: Record<
    ArtistMembershipPlanKey,
    {
      paypalPlanId: string;
      name: string;
      price: string;
    }
  >;
};

const configRef = () =>
  adminDb
    .collection("systemConfig")
    .doc("artistMembershipPayPalPlans");

export async function getArtistPlanConfig():
  Promise<ArtistPayPalPlanConfig | null> {
  const snapshot =
    await configRef().get();

  if (!snapshot.exists) {
    return null;
  }

  const data =
    snapshot.data() as Partial<ArtistPayPalPlanConfig>;

  if (
    !data.productId ||
    !data.plans?.starter?.paypalPlanId ||
    !data.plans?.pro?.paypalPlanId ||
    !data.plans?.elite?.paypalPlanId
  ) {
    return null;
  }

  return data as ArtistPayPalPlanConfig;
}

export function isArtistPlanConfigCurrent(
  config: ArtistPayPalPlanConfig | null
) {
  if (!config) return false;

  if (
    config.environment !==
    ARTIST_PAYPAL_ENVIRONMENT
  ) {
    return false;
  }

  return ARTIST_MEMBERSHIP_PLANS.every(
    definition => {
      const stored =
        config.plans[definition.key];

      return (
        stored?.paypalPlanId &&
        stored.price === definition.price
      );
    }
  );
}

async function paypalRequest(
  path: string,
  options: RequestInit
) {
  const accessToken =
    await getArtistPayPalAccessToken();

  const response =
    await fetch(
      `${PAYPAL_BASE_URL}${path}`,
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

export async function ensureArtistPayPalPlans():
  Promise<ArtistPayPalPlanConfig> {
  const existing =
    await getArtistPlanConfig();

  if (
    existing &&
    isArtistPlanConfigCurrent(
      existing
    )
  ) {
    return existing;
  }

  const product =
    await paypalRequest(
      "/v1/catalogs/products",
      {
        method: "POST",
        body: JSON.stringify({
          name:
            "SOLO BEATS ARTIST MEMBERSHIP",
          description:
            "Artist membership plans for SOLO BEATS ENGINE MUSIC.",
          type: "DIGITAL",
        }),
      }
    );

  const plans =
    {} as ArtistPayPalPlanConfig["plans"];

  for (
    const definition of
    ARTIST_MEMBERSHIP_PLANS
  ) {
    const plan =
      await paypalRequest(
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
                  interval_unit:
                    "MONTH",
                  interval_count: 1,
                },

                tenure_type:
                  "REGULAR",

                sequence: 1,

                total_cycles: 0,

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

              payment_failure_threshold:
                1,
            },
          }),
        }
      );

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
    ArtistPayPalPlanConfig = {
    productId:
      product.id,

    environment:
      ARTIST_PAYPAL_ENVIRONMENT,

    plans,
  };

  await configRef().set(
    {
      ...config,

      createdAt:
        Date.now(),

      updatedAt:
        Date.now(),
    },
    {
      merge: true,
    }
  );

  return config;
}

export function artistPlanFromPaypalId(
  config: ArtistPayPalPlanConfig,
  paypalPlanId: string
) {
  return (
    ARTIST_MEMBERSHIP_PLANS.find(
      definition =>
        config.plans[
          definition.key
        ]?.paypalPlanId ===
        paypalPlanId
    ) || null
  );
}

