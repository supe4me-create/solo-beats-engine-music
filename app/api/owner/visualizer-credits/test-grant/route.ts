import {
  getAuth,
} from "firebase-admin/auth";

import {
  FieldValue,
} from "firebase-admin/firestore";

import {
  NextResponse,
} from "next/server";

import {
  adminDb,
  firebaseAdminApp,
} from "../../../../../lib/firebaseAdmin";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

const OWNER_EMAIL = (
  process.env.OWNER_EMAIL ||
  process.env.NEXT_PUBLIC_OWNER_EMAIL ||
  "supe4.me@gmail.com"
)
  .trim()
  .toLowerCase();

function bearerToken(
  request: Request
) {
  const authorization =
    request.headers.get(
      "authorization"
    ) || "";

  return (
    authorization.match(
      /^Bearer\s+(.+)$/i
    )?.[1]?.trim() ||
    null
  );
}

async function requireOwner(
  request: Request
) {
  const token =
    bearerToken(
      request
    );

  if (!token) {
    throw new Error(
      "AUTH_REQUIRED"
    );
  }

  let decoded;

  try {
    decoded =
      await getAuth(
        firebaseAdminApp
      ).verifyIdToken(
        token
      );
  }
  catch {
    throw new Error(
      "AUTH_INVALID"
    );
  }

  const account =
    await getAuth(
      firebaseAdminApp
    ).getUser(
      decoded.uid
    );

  const email =
    account.email
      ?.trim()
      .toLowerCase() ||
    "";

  if (
    email !==
    OWNER_EMAIL
  ) {
    throw new Error(
      "OWNER_ACCESS_REQUIRED"
    );
  }

  return account;
}

export async function POST(
  request: Request
) {
  try {
    const owner =
      await requireOwner(
        request
      );

    const body =
      await request.json();

    const targetEmail =
      typeof body?.email ===
      "string"
        ? body.email
            .trim()
            .toLowerCase()
        : "";

    if (
      !targetEmail ||
      !targetEmail.includes(
        "@"
      )
    ) {
      return NextResponse.json(
        {
          success:
            false,

          error:
            "VALID_CUSTOMER_EMAIL_REQUIRED",
        },
        {
          status:
            400,
        }
      );
    }

    let target;

    try {
      target =
        await getAuth(
          firebaseAdminApp
        ).getUserByEmail(
          targetEmail
        );
    }
    catch {
      return NextResponse.json(
        {
          success:
            false,

          error:
            "CUSTOMER_ACCOUNT_NOT_FOUND",
        },
        {
          status:
            404,
        }
      );
    }

    if (
      target.email?.toLowerCase() ===
      OWNER_EMAIL
    ) {
      return NextResponse.json(
        {
          success:
            false,

          error:
            "OWNER_ACCOUNT_DOES_NOT_NEED_TEST_CREDITS",
        },
        {
          status:
            400,
        }
      );
    }

    if (
      !target.emailVerified
    ) {
      return NextResponse.json(
        {
          success:
            false,

          error:
            "CUSTOMER_EMAIL_NOT_VERIFIED",
        },
        {
          status:
            400,
        }
      );
    }

    const accountRef =
      adminDb
        .collection(
          "visualizerCredits"
        )
        .doc(
          target.uid
        );

    const grantId =
      crypto
        .randomUUID();

    const ledgerRef =
      accountRef
        .collection(
          "ledger"
        )
        .doc(
          `owner_test_grant_${grantId}`
        );

    const result =
      await adminDb.runTransaction(
        async transaction => {
          const snapshot =
            await transaction.get(
              accountRef
            );

          const currentBalance =
            Number(
              snapshot
                .data()
                ?.balance ||
              0
            );

          const newBalance =
            currentBalance +
            1;

          transaction.set(
            accountRef,
            {
              balance:
                newBalance,

              updatedAt:
                FieldValue.serverTimestamp(),
            },
            {
              merge:
                true,
            }
          );

          transaction.set(
            ledgerRef,
            {
              type:
                "credit",

              amount:
                1,

              reason:
                "owner_test_visualizer_credit",

              targetUid:
                target.uid,

              targetEmail:
                target.email ||
                targetEmail,

              grantedByUid:
                owner.uid,

              grantedByEmail:
                owner.email ||
                OWNER_EMAIL,

              balanceBefore:
                currentBalance,

              balanceAfter:
                newBalance,

              createdAt:
                FieldValue.serverTimestamp(),
            }
          );

          return {
            balanceBefore:
              currentBalance,

            balance:
              newBalance,
          };
        }
      );

    return NextResponse.json({
      success:
        true,

      uid:
        target.uid,

      email:
        target.email ||
        targetEmail,

      balanceBefore:
        result.balanceBefore,

      balance:
        result.balance,

      creditsAdded:
        1,

      message:
        `1 test Visualizer Credit added to ${target.email || targetEmail}.`,
    });
  }
  catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "TEST_CREDIT_GRANT_FAILED";

    const status =
      message ===
        "AUTH_REQUIRED" ||
      message ===
        "AUTH_INVALID"
        ? 401
        : message ===
            "OWNER_ACCESS_REQUIRED"
          ? 403
          : 500;

    console.error(
      "Visualizer test credit grant error:",
      error
    );

    return NextResponse.json(
      {
        success:
          false,

        error:
          message,
      },
      {
        status,
      }
    );
  }
}