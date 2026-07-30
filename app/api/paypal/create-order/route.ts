import { NextResponse } from "next/server";
import { albums } from "@/app/store/albums";

type CheckoutItem = {
  id: string;
  type: "album" | "track";
};

type CheckoutRequest = {
  items?: CheckoutItem[];
};

type ValidatedCheckoutItem = {
  sku: string;
  name: string;
  description: string;
  unitAmount: number;
  albumTitle: string;
  type: "DIGITAL_GOODS";
};

const PAYPAL_CLIENT_ID =
  process.env.PAYPAL_CLIENT_ID;

const PAYPAL_CLIENT_SECRET =
  process.env.PAYPAL_CLIENT_SECRET;

const PAYPAL_BASE_URL = (
  process.env.PAYPAL_BASE_URL ||
  "https://api-m.paypal.com"
).replace(/\/+$/, "");

function getAlbumPrice(album: {
  tracks: { price: number }[];
}) {
  return album.tracks.reduce(
    (total, track) => total + track.price,
    0
  );
}

async function getPayPalAccessToken() {
  if (
    !PAYPAL_CLIENT_ID ||
    !PAYPAL_CLIENT_SECRET
  ) {
    throw new Error(
      "PayPal credentials are missing from .env.local."
    );
  }

  const credentials = Buffer.from(
    `${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`
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
    console.error(
      "PayPal access-token error:",
      data
    );

    throw new Error(
      data.error_description ||
        "Could not authenticate with PayPal."
    );
  }

  return data.access_token as string;
}

function findCheckoutItem(
  item: CheckoutItem
): ValidatedCheckoutItem | null {
  if (
    !item ||
    typeof item.id !== "string" ||
    (item.type !== "album" &&
      item.type !== "track")
  ) {
    return null;
  }

  if (item.type === "album") {
    const albumId = item.id.replace(
      /^album-/,
      ""
    );

    const album = albums.find(
      (entry) => entry.id === albumId
    );

    if (
      !album ||
      album.status !== "released"
    ) {
      return null;
    }

    const automaticAlbumPrice =
      getAlbumPrice(album);

    if (
      !Number.isFinite(automaticAlbumPrice) ||
      automaticAlbumPrice <= 0
    ) {
      return null;
    }

    return {
      sku: `album-${album.id}`,
      name: `${album.title} — Full Album`,
      description: `Full digital album by ${album.artist}`,
      unitAmount: automaticAlbumPrice,
      albumTitle: album.title,
      type: "DIGITAL_GOODS",
    };
  }

  const trackId = item.id.replace(
    /^track-/,
    ""
  );

  for (const album of albums) {
    const track = album.tracks.find(
      (entry) => entry.id === trackId
    );

    if (
      track &&
      album.status === "released"
    ) {
      if (
        !Number.isFinite(track.price) ||
        track.price <= 0
      ) {
        return null;
      }

      return {
        sku: `track-${track.id}`,
        name: track.title,
        description: `Track from ${album.title} by ${album.artist}`,
        unitAmount: track.price,
        albumTitle: album.title,
        type: "DIGITAL_GOODS",
      };
    }
  }

  return null;
}

export async function POST(
  request: Request
) {
  try {
    const body =
      (await request.json()) as CheckoutRequest;

    if (
      !Array.isArray(body.items) ||
      body.items.length === 0
    ) {
      return NextResponse.json(
        {
          error:
            "Your shopping cart is empty.",
        },
        { status: 400 }
      );
    }

    if (body.items.length > 100) {
      return NextResponse.json(
        {
          error:
            "Too many items were submitted.",
        },
        { status: 400 }
      );
    }

    const uniqueItems = Array.from(
      new Map(
        body.items.map((item) => [
          `${item.type}-${item.id}`,
          item,
        ])
      ).values()
    );

    const validatedItems =
      uniqueItems.map(findCheckoutItem);

    if (
      validatedItems.some(
        (item) => item === null
      )
    ) {
      return NextResponse.json(
        {
          error:
            "One or more cart items are unavailable or cannot be purchased yet.",
        },
        { status: 400 }
      );
    }

    const purchasableItems =
      validatedItems.filter(
        (
          item
        ): item is ValidatedCheckoutItem =>
          item !== null
      );

    const total =
      purchasableItems.reduce(
        (sum, item) =>
          sum + item.unitAmount,
        0
      );

    if (
      !Number.isFinite(total) ||
      total <= 0
    ) {
      return NextResponse.json(
        {
          error:
            "The order total is invalid.",
        },
        { status: 400 }
      );
    }

    const formattedTotal =
      total.toFixed(2);

    const accessToken =
      await getPayPalAccessToken();

    const paypalResponse = await fetch(
      `${PAYPAL_BASE_URL}/v2/checkout/orders`,
      {
        method: "POST",
        headers: {
          Authorization:
            `Bearer ${accessToken}`,
          "Content-Type":
            "application/json",
          Prefer: "return=representation",
          "PayPal-Request-Id":
            crypto.randomUUID(),
        },
        body: JSON.stringify({
          intent: "CAPTURE",
          purchase_units: [
            {
              reference_id:
                "solo-beats-order",
              description:
                "SOLO BEATS ENGINE MUSIC digital purchase",
              amount: {
                currency_code: "USD",
                value: formattedTotal,
                breakdown: {
                  item_total: {
                    currency_code: "USD",
                    value: formattedTotal,
                  },
                },
              },
              items:
                purchasableItems.map(
                  (item) => ({
                    name:
                      item.name.slice(
                        0,
                        127
                      ),
                    description:
                      item.description.slice(
                        0,
                        127
                      ),
                    sku:
                      item.sku.slice(
                        0,
                        127
                      ),
                    quantity: "1",
                    category:
                      item.type,
                    unit_amount: {
                      currency_code:
                        "USD",
                      value:
                        item.unitAmount.toFixed(
                          2
                        ),
                    },
                  })
                ),
            },
          ],
          application_context: {
            brand_name:
              "SOLO BEATS ENGINE MUSIC",
            shipping_preference:
              "NO_SHIPPING",
            user_action: "PAY_NOW",
          },
        }),
        cache: "no-store",
      }
    );

    const paypalOrder =
      await paypalResponse.json();

    if (
      !paypalResponse.ok ||
      !paypalOrder.id
    ) {
      console.error(
        "PayPal create-order error:",
        paypalOrder
      );

      return NextResponse.json(
        {
          error:
            paypalOrder?.details?.[0]
              ?.description ||
            paypalOrder?.message ||
            "PayPal could not create the order. Please try again.",
        },
        {
          status:
            paypalResponse.status || 500,
        }
      );
    }

    return NextResponse.json({
      orderId: paypalOrder.id,
      status: paypalOrder.status,
      total: formattedTotal,
      currency: "USD",
    });
  } catch (error) {
    console.error(
      "Create PayPal order error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "An unexpected checkout error occurred.",
      },
      { status: 500 }
    );
  }
}