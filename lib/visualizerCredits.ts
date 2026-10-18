import {
  FieldValue,
} from "firebase-admin/firestore";

import {
  adminDb,
} from "./firebaseAdmin";

export type VisualizerCreditPack = {
  id:
    | "credits_1"
    | "credits_5"
    | "credits_10";

  credits: number;
  price: number;
  label: string;
};

export const VISUALIZER_CREDIT_PACKS = {
  credits_1: {
    id: "credits_1",
    credits: 1,
    price: 3,
    label: "1 Visualizer Credit",
  },

  credits_5: {
    id: "credits_5",
    credits: 5,
    price: 12,
    label: "5 Visualizer Credits",
  },

  credits_10: {
    id: "credits_10",
    credits: 10,
    price: 20,
    label: "10 Visualizer Credits",
  },
} satisfies Record<
  string,
  VisualizerCreditPack
>;

export type VisualizerCreditPackId =
  keyof typeof VISUALIZER_CREDIT_PACKS;

export function isVisualizerCreditPackId(
  value: unknown
): value is VisualizerCreditPackId {
  return (
    typeof value === "string" &&
    value in VISUALIZER_CREDIT_PACKS
  );
}

function safeBalance(
  value: unknown
) {
  return (
    typeof value === "number" &&
    Number.isFinite(value)
  )
    ? Math.max(
        0,
        Math.floor(value)
      )
    : 0;
}

export async function getVisualizerCreditBalance(
  uid: string
) {
  const snapshot =
    await adminDb
      .collection(
        "visualizerCredits"
      )
      .doc(uid)
      .get();

  return safeBalance(
    snapshot.data()?.balance
  );
}

export async function addVisualizerCredits(
  uid: string,
  amount: number,
  reason = "manual_credit"
) {
  const safeAmount =
    Math.max(
      0,
      Math.floor(amount)
    );

  if (
    safeAmount < 1
  ) {
    throw new Error(
      "INVALID_VISUALIZER_CREDIT_AMOUNT"
    );
  }

  const accountRef =
    adminDb
      .collection(
        "visualizerCredits"
      )
      .doc(uid);

  const ledgerRef =
    accountRef
      .collection(
        "ledger"
      )
      .doc();

  return await adminDb.runTransaction(
    async transaction => {
      const snapshot =
        await transaction.get(
          accountRef
        );

      const currentBalance =
        safeBalance(
          snapshot.data()?.balance
        );

      const newBalance =
        currentBalance +
        safeAmount;

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
            safeAmount,

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