import { FieldValue } from "firebase-admin/firestore";

import { adminDb } from "./firebaseAdmin";

export type AiVideoDuration =
  | 5
  | 10
  | 15
  | 30
  | 60;

export function getAiVideoCreditCost(
  duration: AiVideoDuration
): number {
  switch (duration) {
    case 5:
      return 1;
    case 10:
      return 2;
    case 15:
      return 3;
    case 30:
      return 6;
    case 60:
      return 12;
    default:
      return 1;
  }
}

export async function getAiVideoCreditBalance(
  uid: string
): Promise<number> {
  const snapshot =
    await adminDb
      .collection("aiVideoCredits")
      .doc(uid)
      .get();

  if (!snapshot.exists) {
    return 0;
  }

  const data = snapshot.data() || {};

  return typeof data.balance === "number" &&
    Number.isFinite(data.balance)
    ? Math.max(
        0,
        Math.floor(data.balance)
      )
    : 0;
}

export async function addAiVideoCredits(
  uid: string,
  amount: number,
  reason = "credit_adjustment"
): Promise<number> {
  const safeAmount =
    Math.floor(amount);

  if (
    !Number.isFinite(safeAmount) ||
    safeAmount <= 0
  ) {
    throw new Error(
      "INVALID_CREDIT_AMOUNT"
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

  return adminDb.runTransaction(
    async (transaction) => {
      const snapshot =
        await transaction.get(
          accountRef
        );

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

      const newBalance =
        currentBalance + safeAmount;

      transaction.set(
        accountRef,
        {
          balance: newBalance,
          updatedAt:
            FieldValue.serverTimestamp(),
        },
        {
          merge: true,
        }
      );

      transaction.set(
        ledgerRef,
        {
          type: "credit",
          amount: safeAmount,
          reason,
          balanceBefore:
            currentBalance,
          balanceAfter:
            newBalance,
          createdAt:
            FieldValue.serverTimestamp(),
        }
      );

      return newBalance;
    }
  );
}

