import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import {
  FieldValue,
  Timestamp,
} from "firebase-admin/firestore";

import {
  adminDb,
  firebaseAdminApp,
} from "../../../../lib/firebaseAdmin";

export const dynamic = "force-dynamic";

const PAYPAL_CLIENT_ID =
  process.env.PAYPAL_CLIENT_ID;

const PAYPAL_CLIENT_SECRET =
  process.env.PAYPAL_CLIENT_SECRET;

const PAYPAL_BASE_URL = (
  process.env.PAYPAL_BASE_URL ||
  "https://api-m.paypal.com"
).replace(/\/+$/, "");

const OWNER_EMAIL = (
  process.env.OWNER_EMAIL ||
  process.env.NEXT_PUBLIC_OWNER_EMAIL ||
  "supe4.me@gmail.com"
)
  .trim()
  .toLowerCase();

const PROMOTION_PACKAGES: Record<
  number,
  {
    name: string;
    price: number;
  }
> = {
  3: {
    name: "Starter Push",
    price: 29.99,
  },
  7: {
    name: "Growth Push",
    price: 74.99,
  },
  14: {
    name: "Major Push",
    price: 149.99,
  },
  30: {
    name: "Spotlight Campaign",
    price: 299.99,
  },
};

function clean(
  value: unknown,
  max = 5000
) {
  return typeof value === "string"
    ? value.trim().slice(0, max)
    : "";
}

function getBearerToken(
  request: Request
) {
  const header =
    request.headers.get("authorization") || "";

  return (
    header.match(
      /^Bearer\s+(.+)$/i
    )?.[1]?.trim() || ""
  );
}

async function verifyUser(
  request: Request
) {
  const token =
    getBearerToken(request);

  if (!token) {
    return null;
  }

  try {
    return await getAuth(
      firebaseAdminApp
    ).verifyIdToken(token);
  }
  catch {
    return null;
  }
}

function isOwner(
  user: {
    email?: unknown;
  }
) {
  const email =
    typeof user.email === "string"
      ? user.email.trim().toLowerCase()
      : "";

  return email === OWNER_EMAIL;
}

async function getPayPalAccessToken() {
  if (
    !PAYPAL_CLIENT_ID ||
    !PAYPAL_CLIENT_SECRET
  ) {
    throw new Error(
      "PayPal server credentials are missing."
    );
  }

  const credentials =
    Buffer.from(
      `${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`
    ).toString("base64");

  const response =
    await fetch(
      `${PAYPAL_BASE_URL}/v1/oauth2/token`,
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
    !data.access_token
  ) {
    throw new Error(
      data.error_description ||
        "PayPal authentication failed."
    );
  }

  return data.access_token as string;
}

function timestampIso(
  value: unknown
) {
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (
      value as {
        toDate?: unknown;
      }
    ).toDate === "function"
  ) {
    return (
      value as {
        toDate: () => Date;
      }
    )
      .toDate()
      .toISOString();
  }

  return null;
}

export async function GET(
  request: Request
) {
  try {
    const user =
      await verifyUser(request);

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Sign in required.",
        },
        {
          status: 401,
        }
      );
    }

    const url =
      new URL(request.url);

    const postId =
      clean(
        url.searchParams.get("postId"),
        128
      );

    if (!postId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Post ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    const snapshot =
      await adminDb
        .collection(
          "soloConnectPosts"
        )
        .doc(postId)
        .get();

    if (!snapshot.exists) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Post not found.",
        },
        {
          status: 404,
        }
      );
    }

    const post =
      snapshot.data() || {};

    if (
      clean(
        post.authorUid,
        128
      ) !== user.uid
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "You can only promote your own post.",
        },
        {
          status: 403,
        }
      );
    }

    const packages =
      Object.entries(
        PROMOTION_PACKAGES
      ).map(
        ([days, item]) => ({
          durationDays:
            Number(days),
          name:
            item.name,
          price:
            item.price,
          currency:
            "USD",
        })
      );

    const activeUntil =
      timestampIso(
        post.promotionActiveUntil
      );

    const active =
      Boolean(
        activeUntil &&
        new Date(
          activeUntil
        ).getTime() >
          Date.now()
      );

    return NextResponse.json({
      success: true,
      post: {
        id:
          snapshot.id,

        text:
          clean(
            post.text,
            3000
          ),

        username:
          clean(
            post.username,
            24
          ),

        displayName:
          clean(
            post.displayName,
            100
          ),

        mediaURL:
          clean(
            post.mediaURL,
            4000
          ),

        mediaType:
          clean(
            post.mediaType,
            20
          ),

        active,
        promotionActiveUntil:
          activeUntil,
      },

      packages,

      ownerFree:
        isOwner(user),
    });
  }
  catch (error) {
    console.error(
      "SOLO CONNECT PROMOTION GET:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Promotion information could not be loaded.",
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
  try {
    const user =
      await verifyUser(request);

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Sign in required.",
        },
        {
          status: 401,
        }
      );
    }

    const body =
      await request.json();

    const action =
      body?.action === "create" ||
      body?.action === "capture" ||
      body?.action === "activate-free"
        ? body.action
        : "";

    const postId =
      clean(
        body?.postId,
        128
      );

    if (
      !action ||
      !postId
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "A valid promotion action and post ID are required.",
        },
        {
          status: 400,
        }
      );
    }

    const postRef =
      adminDb
        .collection(
          "soloConnectPosts"
        )
        .doc(postId);

    const postSnapshot =
      await postRef.get();

    if (!postSnapshot.exists) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Post not found.",
        },
        {
          status: 404,
        }
      );
    }

    const post =
      postSnapshot.data() || {};

    if (
      clean(
        post.authorUid,
        128
      ) !== user.uid
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "You can only promote your own post.",
        },
        {
          status: 403,
        }
      );
    }

    if (
      action === "activate-free"
    ) {
      if (!isOwner(user)) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Owner access required.",
          },
          {
            status: 403,
          }
        );
      }

      const durationDays =
        Number(
          body?.durationDays
        );

      const promotionPackage =
        PROMOTION_PACKAGES[
          durationDays
        ];

      if (!promotionPackage) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Choose a valid promotion package.",
          },
          {
            status: 400,
          }
        );
      }

      const current =
        (
          await postRef.get()
        ).data() || {};

      const previousUntil =
        current
          .promotionActiveUntil
          ?.toDate
          ? current
              .promotionActiveUntil
              .toDate()
              .getTime()
          : 0;

      const startAt =
        Math.max(
          Date.now(),
          previousUntil
        );

      const activeUntil =
        Timestamp.fromMillis(
          startAt +
            durationDays *
              24 *
              60 *
              60 *
              1000
        );

      const promotionId =
        `owner-free-${crypto.randomUUID()}`;

      const batch =
        adminDb.batch();

      batch.set(
        postRef,
        {
          promoted: true,

          promotionActiveUntil:
            activeUntil,

          promotionPackageName:
            promotionPackage.name,

          promotionDurationDays:
            durationDays,

          promotionPaymentType:
            "owner_free",

          promotionLastOrderId:
            promotionId,

          promotedAt:
            FieldValue.serverTimestamp(),

          updatedAt:
            FieldValue.serverTimestamp(),
        },
        {
          merge: true,
        }
      );

      batch.set(
        adminDb
          .collection(
            "soloConnectPromotions"
          )
          .doc(promotionId),
        {
          promotionId,

          uid:
            user.uid,

          postId,

          durationDays,

          packageName:
            promotionPackage.name,

          price:
            "0.00",

          currency:
            "USD",

          paymentType:
            "owner_free",

          activeUntil,

          marker:
            "OWNER_FREE_PROMOTION",

          createdAt:
            FieldValue.serverTimestamp(),
        }
      );

      await batch.commit();

      return NextResponse.json({
        success: true,

        ownerFree: true,

        activeUntil:
          activeUntil
            .toDate()
            .toISOString(),

        message:
          `Owner promotion activated FREE for ${durationDays} days.`,
      });
    }

    const accessToken =
      await getPayPalAccessToken();

    if (action === "create") {
      const durationDays =
        Number(
          body?.durationDays
        );

      const promotionPackage =
        PROMOTION_PACKAGES[
          durationDays
        ];

      if (!promotionPackage) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Choose a valid promotion package.",
          },
          {
            status: 400,
          }
        );
      }

      const price =
        promotionPackage.price;

      const paypalResponse =
        await fetch(
          `${PAYPAL_BASE_URL}/v2/checkout/orders`,
          {
            method: "POST",

            headers: {
              Authorization:
                `Bearer ${accessToken}`,

              "Content-Type":
                "application/json",

              Prefer:
                "return=representation",

              "PayPal-Request-Id":
                crypto.randomUUID(),
            },

            body:
              JSON.stringify({
                intent:
                  "CAPTURE",

                purchase_units: [
                  {
                    reference_id:
                      `solo-connect-${postId}`,

                    custom_id:
                      postId,

                    description:
                      "SOLO CONNECT promoted post",

                    amount: {
                      currency_code:
                        "USD",

                      value:
                        price.toFixed(
                          2
                        ),

                      breakdown: {
                        item_total: {
                          currency_code:
                            "USD",

                          value:
                            price.toFixed(
                              2
                            ),
                        },
                      },
                    },

                    items: [
                      {
                        name:
                          `${promotionPackage.name} - SOLO CONNECT Post`.slice(
                            0,
                            127
                          ),

                        description:
                          `${durationDays}-day promoted placement on SOLO CONNECT`.slice(
                            0,
                            127
                          ),

                        sku:
                          `connect-boost-${durationDays}`,

                        quantity:
                          "1",

                        category:
                          "DIGITAL_GOODS",

                        unit_amount: {
                          currency_code:
                            "USD",

                          value:
                            price.toFixed(
                              2
                            ),
                        },
                      },
                    ],
                  },
                ],

                application_context: {
                  brand_name:
                    "SOLO BEATS ENGINE MUSIC",

                  shipping_preference:
                    "NO_SHIPPING",

                  user_action:
                    "PAY_NOW",
                },
              }),

            cache:
              "no-store",
          }
        );

      const order =
        await paypalResponse.json();

      if (
        !paypalResponse.ok ||
        !order.id
      ) {
        throw new Error(
          order?.details?.[0]
            ?.description ||
            order?.message ||
            "PayPal could not create the promoted post order."
        );
      }

      await adminDb
        .collection(
          "soloConnectPromotionOrders"
        )
        .doc(order.id)
        .set({
          orderId:
            order.id,

          uid:
            user.uid,

          postId,

          durationDays,

          packageName:
            promotionPackage.name,

          price:
            price.toFixed(2),

          currency:
            "USD",

          status:
            "created",

          createdAt:
            FieldValue.serverTimestamp(),

          updatedAt:
            FieldValue.serverTimestamp(),
        });

      return NextResponse.json({
        success: true,
        orderId:
          order.id,
      });
    }

    const orderId =
      clean(
        body?.orderId,
        200
      );

    if (!orderId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "PayPal order ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    const orderRef =
      adminDb
        .collection(
          "soloConnectPromotionOrders"
        )
        .doc(orderId);

    const orderSnapshot =
      await orderRef.get();

    if (!orderSnapshot.exists) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Promotion payment record was not found.",
        },
        {
          status: 404,
        }
      );
    }

    const orderRecord =
      orderSnapshot.data() || {};

    if (
      clean(
        orderRecord.uid,
        128
      ) !== user.uid ||
      clean(
        orderRecord.postId,
        128
      ) !== postId
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "This promotion order does not belong to you.",
        },
        {
          status: 403,
        }
      );
    }

    if (
      orderRecord.status ===
      "paid"
    ) {
      return NextResponse.json({
        success: true,
        alreadyCaptured:
          true,

        activeUntil:
          timestampIso(
            orderRecord.activeUntil
          ),

        message:
          "This promoted post payment was already applied.",
      });
    }

    const durationDays =
      Number(
        orderRecord.durationDays
      );

    const promotionPackage =
      PROMOTION_PACKAGES[
        durationDays
      ];

    if (!promotionPackage) {
      throw new Error(
        "Invalid promotion package."
      );
    }

    const expectedPrice =
      promotionPackage.price;

    const captureResponse =
      await fetch(
        `${PAYPAL_BASE_URL}/v2/checkout/orders/${encodeURIComponent(
          orderId
        )}/capture`,
        {
          method:
            "POST",

          headers: {
            Authorization:
              `Bearer ${accessToken}`,

            "Content-Type":
              "application/json",

            Prefer:
              "return=representation",
          },

          cache:
            "no-store",
        }
      );

    const completedOrder =
      await captureResponse.json();

    if (
      !captureResponse.ok
    ) {
      throw new Error(
        completedOrder
          ?.details?.[0]
          ?.description ||
          completedOrder?.message ||
          "PayPal could not capture the promotion payment."
      );
    }

    const purchaseUnit =
      completedOrder
        ?.purchase_units?.[0];

    const capture =
      purchaseUnit
        ?.payments
        ?.captures?.find(
          (
            entry: {
              status?: string;
            }
          ) =>
            entry?.status ===
            "COMPLETED"
        );

    const paidValue =
      Number(
        capture
          ?.amount
          ?.value
      );

    const currency =
      clean(
        capture
          ?.amount
          ?.currency_code,
        10
      );

    const customId =
      clean(
        purchaseUnit
          ?.custom_id,
        128
      );

    if (
      completedOrder.status !==
        "COMPLETED" ||
      !capture ||
      currency !== "USD" ||
      !Number.isFinite(
        paidValue
      ) ||
      Math.abs(
        paidValue -
          expectedPrice
      ) > 0.001 ||
      customId !== postId
    ) {
      throw new Error(
        "PayPal payment verification failed."
      );
    }

    const currentPost =
      (
        await postRef.get()
      ).data() || {};

    const previousUntil =
      currentPost
        .promotionActiveUntil
        ?.toDate
        ? currentPost
            .promotionActiveUntil
            .toDate()
            .getTime()
        : 0;

    const startAt =
      Math.max(
        Date.now(),
        previousUntil
      );

    const activeUntilMs =
      startAt +
      durationDays *
        24 *
        60 *
        60 *
        1000;

    const activeUntil =
      Timestamp.fromMillis(
        activeUntilMs
      );

    const batch =
      adminDb.batch();

    batch.set(
      postRef,
      {
        promoted:
          true,

        promotionActiveUntil:
          activeUntil,

        promotionPackageName:
          promotionPackage.name,

        promotionDurationDays:
          durationDays,

        promotionLastOrderId:
          orderId,

        promotedAt:
          FieldValue.serverTimestamp(),

        updatedAt:
          FieldValue.serverTimestamp(),
      },
      {
        merge: true,
      }
    );

    batch.set(
      orderRef,
      {
        status:
          "paid",

        activeUntil,

        paypalCaptureId:
          clean(
            capture?.id,
            200
          ),

        paypalPayerId:
          clean(
            completedOrder
              ?.payer
              ?.payer_id,
            200
          ),

        paidAt:
          FieldValue.serverTimestamp(),

        updatedAt:
          FieldValue.serverTimestamp(),
      },
      {
        merge: true,
      }
    );

    batch.set(
      adminDb
        .collection(
          "soloConnectPromotions"
        )
        .doc(orderId),
      {
        orderId,
        uid:
          user.uid,
        postId,
        durationDays,
        packageName:
          promotionPackage.name,
        price:
          expectedPrice.toFixed(
            2
          ),
        currency:
          "USD",
        activeUntil,
        captureId:
          clean(
            capture?.id,
            200
          ),
        createdAt:
          FieldValue.serverTimestamp(),
      }
    );

    await batch.commit();

    return NextResponse.json({
      success: true,

      orderId,

      durationDays,

      packageName:
        promotionPackage.name,

      activeUntil:
        activeUntil
          .toDate()
          .toISOString(),

      message:
        `Your post is promoted for ${durationDays} days.`,
    });
  }
  catch (error) {
    console.error(
      "SOLO CONNECT PROMOTION PAYMENT:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "Promoted post payment failed.",
      },
      {
        status: 500,
      }
    );
  }
}