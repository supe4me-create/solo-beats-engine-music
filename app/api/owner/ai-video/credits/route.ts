import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";

import {
  adminDb,
  firebaseAdminApp,
} from "../../../../../lib/firebaseAdmin";

const OWNER_EMAIL = "supe4.me@gmail.com";

function getBearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization");

  if (!authorization) {
    return null;
  }

  const match = authorization.match(/^Bearer\s+(.+)$/i);

  return match?.[1]?.trim() || null;
}

async function requireOwner(request: Request) {
  const token = getBearerToken(request);

  if (!token) {
    throw new Error("AUTH_REQUIRED");
  }

  const decoded =
    await getAuth(firebaseAdminApp)
      .verifyIdToken(token);

  const email =
    typeof decoded.email === "string"
      ? decoded.email.toLowerCase()
      : "";

  if (email !== OWNER_EMAIL) {
    throw new Error("OWNER_REQUIRED");
  }

  return decoded;
}

function serializeTimestamp(value: unknown): string | null {
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as { toDate?: unknown }).toDate === "function"
  ) {
    return (value as { toDate: () => Date })
      .toDate()
      .toISOString();
  }

  return null;
}

export async function GET(request: Request) {
  try {
    await requireOwner(request);

    const snapshot =
      await adminDb
        .collection("aiVideoCredits")
        .get();

    const accounts =
      snapshot.docs
        .map((document) => {
          const data = document.data();

          return {
            uid: document.id,
            balance:
              typeof data.balance === "number" &&
              Number.isFinite(data.balance)
                ? Math.max(0, Math.floor(data.balance))
                : 0,
            updatedAt:
              serializeTimestamp(data.updatedAt),
          };
        })
        .sort((a, b) => b.balance - a.balance);

    const totalCredits =
      accounts.reduce(
        (total, account) =>
          total + account.balance,
        0
      );

    return NextResponse.json({
      success: true,
      accounts,
      summary: {
        accounts: accounts.length,
        totalCredits,
      },
      packs: [
        {
          id: "credits_10",
          credits: 10,
          price: 14.99,
        },
        {
          id: "credits_25",
          credits: 25,
          price: 32.99,
        },
        {
          id: "credits_50",
          credits: 50,
          price: 59.99,
        },
        {
          id: "credits_100",
          credits: 100,
          price: 109.99,
        },
      ],
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Credits could not be loaded.";

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      {
        status:
          message === "AUTH_REQUIRED"
            ? 401
            : message === "OWNER_REQUIRED"
              ? 403
              : 500,
      }
    );
  }
}

export async function POST(request: Request) {
  try {
    const owner =
      await requireOwner(request);

    const body =
      (await request.json()) as {
        uid?: unknown;
        amount?: unknown;
      };

    const uid =
      typeof body.uid === "string"
        ? body.uid.trim()
        : "";

    const amount =
      Math.floor(Number(body.amount));

    if (!uid) {
      return NextResponse.json(
        {
          success: false,
          error: "Subscriber UID is required.",
        },
        { status: 400 }
      );
    }

    if (
      !Number.isFinite(amount) ||
      amount < 1 ||
      amount > 10000
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Credit amount must be between 1 and 10000.",
        },
        { status: 400 }
      );
    }

    const accountRef =
      adminDb
        .collection("aiVideoCredits")
        .doc(uid);

    const ledgerRef =
      accountRef
        .collection("ledger")
        .doc();

    const newBalance =
      await adminDb.runTransaction(
        async (transaction) => {
          const snapshot =
            await transaction.get(accountRef);

          const data =
            snapshot.exists
              ? snapshot.data() || {}
              : {};

          const currentBalance =
            typeof data.balance === "number" &&
            Number.isFinite(data.balance)
              ? Math.max(
                  0,
                  Math.floor(data.balance)
                )
              : 0;

          const balance =
            currentBalance + amount;

          transaction.set(
            accountRef,
            {
              balance,
              updatedAt:
                FieldValue.serverTimestamp(),
            },
            { merge: true }
          );

          transaction.set(
            ledgerRef,
            {
              type: "credit",
              amount,
              reason:
                "owner_manual_adjustment",
              balanceBefore:
                currentBalance,
              balanceAfter:
                balance,
              ownerUid:
                owner.uid,
              ownerEmail:
                owner.email || null,
              createdAt:
                FieldValue.serverTimestamp(),
            }
          );

          return balance;
        }
      );

    return NextResponse.json({
      success: true,
      uid,
      added: amount,
      balance: newBalance,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Credits could not be updated.";

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      {
        status:
          message === "AUTH_REQUIRED"
            ? 401
            : message === "OWNER_REQUIRED"
              ? 403
              : 500,
      }
    );
  }
}
