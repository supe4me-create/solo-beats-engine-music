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

async function verifyOwner(
  request: Request
) {
  const token =
    bearer(request);

  if (!token) {
    throw new Error(
      "OWNER_AUTH_REQUIRED"
    );
  }

  const decoded =
    await getAuth(
      firebaseAdminApp
    ).verifyIdToken(
      token
    );

  const email =
    (
      decoded.email ||
      ""
    )
      .trim()
      .toLowerCase();

  if (
    email !==
    OWNER_EMAIL
  ) {
    throw new Error(
      "OWNER_ONLY"
    );
  }

  return decoded;
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
    await verifyOwner(
      request
    );

    const snapshot =
      await adminDb
        .collection(
          "soloConnectSupportOrders"
        )
        .limit(
          500
        )
        .get();

    const rows =
      await Promise.all(
        snapshot.docs
          .map(async document => {
            const data =
              document.data() ||
              {};

            if (
              data.status !==
              "paid"
            ) {
              return null;
            }

            const creatorUid =
              clean(
                data.creatorUid,
                128
              );

            let payoutEmail =
              "";

            if (
              creatorUid
            ) {
              const payoutSnapshot =
                await adminDb
                  .collection(
                    "soloConnectCreatorPayoutProfiles"
                  )
                  .doc(
                    creatorUid
                  )
                  .get();

              payoutEmail =
                clean(
                  payoutSnapshot.data()
                    ?.payoutEmail,
                  320
                );
            }

            return {
              id:
                document.id,

              creatorUid,

              creatorUsername:
                clean(
                  data.creatorUsername,
                  24
                ),

              creatorDisplayName:
                clean(
                  data.creatorDisplayName,
                  100
                ),

              supporterName:
                clean(
                  data.supporterName,
                  100
                ),

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

              payoutStatus:
                clean(
                  data.payoutStatus,
                  30
                ) ||
                "unpaid",

              payoutEmail,

              paidAt:
                toIso(
                  data.paidAt
                ),

              payoutPaidAt:
                toIso(
                  data.payoutPaidAt
                ),

              payoutNote:
                clean(
                  data.payoutNote,
                  500
                ),
            };
          })
      );

    const orders =
      rows
        .filter(
          (
            item
          ): item is NonNullable<
            typeof item
          > =>
            Boolean(item)
        )
        .sort(
          (a, b) =>
            String(
              b.paidAt ||
                ""
            ).localeCompare(
              String(
                a.paidAt ||
                  ""
              )
            )
        );

    const pending =
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

    return NextResponse.json({
      success: true,
      orders,
      pending,
    });
  }
  catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "";

    if (
      message ===
        "OWNER_AUTH_REQUIRED" ||
      message ===
        "OWNER_ONLY"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Owner access only.",
        },
        {
          status:
            message ===
            "OWNER_AUTH_REQUIRED"
              ? 401
              : 403,
        }
      );
    }

    console.error(
      "CONNECT PAYOUT LEDGER:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Payout ledger could not be loaded.",
      },
      {
        status: 500,
      }
    );
  }
}

export async function PATCH(
  request: Request
) {
  try {
    const owner =
      await verifyOwner(
        request
      );

    const body =
      await request.json();

    const orderId =
      clean(
        body?.orderId,
        200
      );

    const payoutStatus =
      body?.payoutStatus ===
        "paid" ||
      body?.payoutStatus ===
        "unpaid"
        ? body.payoutStatus
        : "";

    const payoutNote =
      clean(
        body?.payoutNote,
        500
      );

    if (
      !orderId ||
      !payoutStatus
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Order and payout status are required.",
        },
        {
          status: 400,
        }
      );
    }

    const ref =
      adminDb
        .collection(
          "soloConnectSupportOrders"
        )
        .doc(
          orderId
        );

    const snapshot =
      await ref.get();

    if (
      !snapshot.exists ||
      snapshot.data()
        ?.status !==
        "paid"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Paid support record not found.",
        },
        {
          status: 404,
        }
      );
    }

    await ref.set(
      {
        payoutStatus,

        payoutNote,

        payoutPaidAt:
          payoutStatus ===
          "paid"
            ? FieldValue.serverTimestamp()
            : null,

        payoutUpdatedBy:
          owner.uid,

        payoutUpdatedAt:
          FieldValue.serverTimestamp(),
      },
      {
        merge: true,
      }
    );

    return NextResponse.json({
      success: true,
      payoutStatus,
    });
  }
  catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "";

    if (
      message ===
        "OWNER_AUTH_REQUIRED" ||
      message ===
        "OWNER_ONLY"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Owner access only.",
        },
        {
          status:
            message ===
            "OWNER_AUTH_REQUIRED"
              ? 401
              : 403,
        }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error:
          "Payout status could not be updated.",
      },
      {
        status: 500,
      }
    );
  }
}