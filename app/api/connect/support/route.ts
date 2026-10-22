import { NextResponse } from "next/server";

import {
  getAuth,
} from "firebase-admin/auth";

import {
  FieldValue,
} from "firebase-admin/firestore";

import {
  adminDb,
  firebaseAdminApp,
} from "../../../../lib/firebaseAdmin";

export const dynamic =
  "force-dynamic";

const OWNER_EMAIL = (
  process.env.OWNER_EMAIL ||
  process.env.NEXT_PUBLIC_OWNER_EMAIL ||
  "supe4.me@gmail.com"
)
  .trim()
  .toLowerCase();

const PAYPAL_CLIENT_ID =
  process.env.PAYPAL_CLIENT_ID;

const PAYPAL_CLIENT_SECRET =
  process.env.PAYPAL_CLIENT_SECRET;

const PAYPAL_BASE_URL = (
  process.env.PAYPAL_BASE_URL ||
  "https://api-m.paypal.com"
).replace(/\/+$/, "");

const SUPPORT_AMOUNTS =
  new Set([
    3,
    5,
    10,
    25,
  ]);

function clean(
  value: unknown,
  max = 4000
) {
  return typeof value === "string"
    ? value.trim().slice(0, max)
    : "";
}

function bearer(
  request: Request
) {
  return (
    request.headers
      .get("authorization")
      ?.match(/^Bearer\s+(.+)$/i)?.[1]
      ?.trim() ||
    ""
  );
}

async function verifyUser(
  request: Request
) {
  const token =
    bearer(request);

  if (!token) {
    return null;
  }

  try {
    return await getAuth(
      firebaseAdminApp
    ).verifyIdToken(
      token
    );
  }
  catch {
    return null;
  }
}

async function getPayPalToken() {
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
    ).toString(
      "base64"
    );

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

        cache:
          "no-store",
      }
    );

  const data =
    await response.json();

  if (
    !response.ok ||
    !data.access_token
  ) {
    throw new Error(
      "PayPal authentication failed."
    );
  }

  return data.access_token as string;
}

function toIso(
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
    const url =
      new URL(
        request.url
      );

    const mode =
      clean(
        url.searchParams.get(
          "mode"
        ),
        30
      );

    if (
      mode === "creator"
    ) {
      const creatorUid =
        clean(
          url.searchParams.get(
            "uid"
          ),
          128
        );

      if (!creatorUid) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Creator ID is required.",
          },
          {
            status: 400,
          }
        );
      }

      const profileSnapshot =
        await adminDb
          .collection(
            "soloConnectProfiles"
          )
          .doc(
            creatorUid
          )
          .get();

      if (
        !profileSnapshot.exists
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Creator profile not found.",
          },
          {
            status: 404,
          }
        );
      }

      const profile =
        profileSnapshot.data() ||
        {};

      return NextResponse.json({
        success: true,

        creator: {
          uid:
            creatorUid,

          username:
            clean(
              profile.username,
              24
            ),

          displayName:
            clean(
              profile.displayName,
              100
            ),

          photoURL:
            clean(
              profile.photoURL,
              4000
            ),

          bio:
            clean(
              profile.bio,
              500
            ),
        },

        amounts:
          Array.from(
            SUPPORT_AMOUNTS
          ),
      });
    }

    if (
      mode === "earnings"
    ) {
      const user =
        await verifyUser(
          request
        );

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

      const ordersSnapshot =
        await adminDb
          .collection(
            "soloConnectSupportOrders"
          )
          .where(
            "creatorUid",
            "==",
            user.uid
          )
          .limit(
            500
          )
          .get();

      const orders =
        ordersSnapshot.docs
          .map(document => {
            const data =
              document.data() ||
              {};

            return {
              id:
                document.id,

              amount:
                Number(
                  data.amount ||
                    0
                ),

              currency:
                clean(
                  data.currency,
                  10
                ) ||
                "USD",

              supporterName:
                clean(
                  data.supporterName,
                  100
                ),

              status:
                clean(
                  data.status,
                  30
                ),

              payoutStatus:
                clean(
                  data.payoutStatus,
                  30
                ) ||
                "unpaid",

              createdAt:
                toIso(
                  data.createdAt
                ),

              paidAt:
                toIso(
                  data.paidAt
                ),

              payoutPaidAt:
                toIso(
                  data.payoutPaidAt
                ),
            };
          })
          .filter(
            item =>
              item.status ===
              "paid"
          )
          .sort(
            (a, b) =>
              String(
                b.paidAt ||
                  b.createdAt ||
                  ""
              ).localeCompare(
                String(
                  a.paidAt ||
                    a.createdAt ||
                    ""
                )
              )
          );

      const totalReceived =
        orders.reduce(
          (
            total,
            item
          ) =>
            total +
            item.amount,
          0
        );

      const pendingPayout =
        orders
          .filter(
            item =>
              item.payoutStatus ===
              "unpaid"
          )
          .reduce(
            (
              total,
              item
            ) =>
              total +
              item.amount,
            0
          );

      const paidOut =
        orders
          .filter(
            item =>
              item.payoutStatus ===
                "paid" ||
              item.payoutStatus ===
                "owner_direct"
          )
          .reduce(
            (
              total,
              item
            ) =>
              total +
              item.amount,
            0
          );

      const payoutSnapshot =
        await adminDb
          .collection(
            "soloConnectCreatorPayoutProfiles"
          )
          .doc(
            user.uid
          )
          .get();

      const payoutProfile =
        payoutSnapshot.data() ||
        {};

      return NextResponse.json({
        success: true,

        totals: {
          totalReceived,
          pendingPayout,
          paidOut,
        },

        payoutEmail:
          clean(
            payoutProfile.payoutEmail,
            320
          ),

        orders,
      });
    }

    return NextResponse.json(
      {
        success: false,
        error:
          "Invalid support request.",
      },
      {
        status: 400,
      }
    );
  }
  catch (error) {
    console.error(
      "SOLO CONNECT SUPPORT GET:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "Creator support could not be loaded.",
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
      await verifyUser(
        request
      );

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
      clean(
        body?.action,
        40
      );

    if (
      action ===
      "save-payout-email"
    ) {
      const payoutEmail =
        clean(
          body?.payoutEmail,
          320
        ).toLowerCase();

      if (
        payoutEmail &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
          payoutEmail
        )
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Enter a valid PayPal payout email.",
          },
          {
            status: 400,
          }
        );
      }

      await adminDb
        .collection(
          "soloConnectCreatorPayoutProfiles"
        )
        .doc(
          user.uid
        )
        .set(
          {
            uid:
              user.uid,

            payoutEmail,

            updatedAt:
              FieldValue.serverTimestamp(),
          },
          {
            merge: true,
          }
        );

      return NextResponse.json({
        success: true,
        payoutEmail,
      });
    }

    const creatorUid =
      clean(
        body?.creatorUid,
        128
      );

    if (!creatorUid) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Creator ID is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      creatorUid ===
      user.uid
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "You cannot send support to your own account.",
        },
        {
          status: 400,
        }
      );
    }

    const creatorProfileSnapshot =
      await adminDb
        .collection(
          "soloConnectProfiles"
        )
        .doc(
          creatorUid
        )
        .get();

    if (
      !creatorProfileSnapshot.exists
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Creator profile not found.",
        },
        {
          status: 404,
        }
      );
    }

    const creatorProfile =
      creatorProfileSnapshot.data() ||
      {};

    const amount =
      Number(
        body?.amount
      );

    if (
      !SUPPORT_AMOUNTS.has(
        amount
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Choose a valid support amount.",
        },
        {
          status: 400,
        }
      );
    }

    const accessToken =
      await getPayPalToken();

    if (
      action === "create"
    ) {
      const response =
        await fetch(
          `${PAYPAL_BASE_URL}/v2/checkout/orders`,
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

              "PayPal-Request-Id":
                crypto.randomUUID(),
            },

            body:
              JSON.stringify({
                intent:
                  "CAPTURE",

                purchase_units: [
                  {
                    custom_id:
                      creatorUid,

                    description:
                      "SOLO CONNECT Creator Support",

                    amount: {
                      currency_code:
                        "USD",

                      value:
                        amount.toFixed(
                          2
                        ),
                    },
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
        await response.json();

      if (
        !response.ok ||
        !order.id
      ) {
        throw new Error(
          order?.message ||
            "PayPal order could not be created."
        );
      }

      await adminDb
        .collection(
          "soloConnectSupportOrders"
        )
        .doc(
          order.id
        )
        .set({
          orderId:
            order.id,

          supporterUid:
            user.uid,

          supporterEmail:
            clean(
              user.email,
              320
            ),

          supporterName:
            clean(
              user.name ||
                user.email ||
                "SOLO CONNECT Member",
              100
            ),

          creatorUid,

          creatorUsername:
            clean(
              creatorProfile.username,
              24
            ),

          creatorDisplayName:
            clean(
              creatorProfile.displayName,
              100
            ),

          amount,

          currency:
            "USD",

          status:
            "created",

          payoutStatus:
            "unpaid",

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

    if (
      action !== "capture"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid creator support action.",
        },
        {
          status: 400,
        }
      );
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
          "soloConnectSupportOrders"
        )
        .doc(
          orderId
        );

    const orderSnapshot =
      await orderRef.get();

    if (
      !orderSnapshot.exists
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Support order not found.",
        },
        {
          status: 404,
        }
      );
    }

    const orderRecord =
      orderSnapshot.data() ||
      {};

    if (
      clean(
        orderRecord.supporterUid,
        128
      ) !== user.uid ||
      clean(
        orderRecord.creatorUid,
        128
      ) !== creatorUid ||
      Number(
        orderRecord.amount
      ) !== amount
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Support order verification failed.",
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
      });
    }

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
        completedOrder?.message ||
          "PayPal capture failed."
      );
    }

    const purchaseUnit =
      completedOrder
        ?.purchase_units?.[0];

    const capture =
      purchaseUnit
        ?.payments
        ?.captures
        ?.find(
          (
            item: {
              status?: string;
            }
          ) =>
            item.status ===
            "COMPLETED"
        );

    const paidAmount =
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
      paidAmount !== amount ||
      customId !== creatorUid
    ) {
      throw new Error(
        "PayPal creator support verification failed."
      );
    }

    let payoutStatus =
      "unpaid";

    try {
      const creatorAuth =
        await getAuth(
          firebaseAdminApp
        ).getUser(
          creatorUid
        );

      const creatorEmail =
        (
          creatorAuth.email ||
          ""
        )
          .trim()
          .toLowerCase();

      if (
        creatorEmail ===
        OWNER_EMAIL
      ) {
        payoutStatus =
          "owner_direct";
      }
    }
    catch {
      // Creator auth lookup is optional
      // for payout status.
    }

    await orderRef.set(
      {
        status:
          "paid",

        payoutStatus,

        paypalCaptureId:
          clean(
            capture.id,
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

    return NextResponse.json({
      success: true,

      amount,

      creatorDisplayName:
        clean(
          creatorProfile.displayName,
          100
        ),

      message:
        `Thank you for supporting ${
          clean(
            creatorProfile.displayName,
            100
          ) ||
          clean(
            creatorProfile.username,
            24
          )
        }.`,
    });
  }
  catch (error) {
    console.error(
      "SOLO CONNECT SUPPORT:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "Creator support payment failed.",
      },
      {
        status: 500,
      }
    );
  }
}