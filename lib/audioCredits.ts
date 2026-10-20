import {
  FieldValue,
} from "firebase-admin/firestore";

import {
  adminDb,
} from "./firebaseAdmin";

export type AudioCreditPackId =
  | "audio_1"
  | "audio_5"
  | "audio_20";

export type AudioCreditPack = {
  id: AudioCreditPackId;
  credits: number;
  price: number;
  label: string;
};

export const AUDIO_CREDIT_PACKS:
  Record<AudioCreditPackId, AudioCreditPack> = {
    audio_1: {
      id: "audio_1",
      credits: 1,
      price: 5,
      label: "1 Audio Credit",
    },

    audio_5: {
      id: "audio_5",
      credits: 5,
      price: 20,
      label: "5 Audio Credits",
    },

    audio_20: {
      id: "audio_20",
      credits: 20,
      price: 60,
      label: "20 Audio Credits",
    },
  };

export function isAudioCreditPackId(
  value: unknown
): value is AudioCreditPackId {
  return (
    value === "audio_1" ||
    value === "audio_5" ||
    value === "audio_20"
  );
}

function safeBalance(
  value: unknown
) {
  return (
    typeof value === "number" &&
    Number.isFinite(value)
      ? Math.max(
          0,
          Math.floor(value)
        )
      : 0
  );
}

export async function getAudioCreditBalance(
  uid: string
): Promise<number> {
  const snapshot =
    await adminDb
      .collection("audioCredits")
      .doc(uid)
      .get();

  if (!snapshot.exists) {
    return 0;
  }

  return safeBalance(
    snapshot.data()?.balance
  );
}

export async function addAudioCredits(
  uid: string,
  amount: number,
  reason = "credit_adjustment",
  metadata:
    Record<string, unknown> = {}
): Promise<number> {
  const safeAmount =
    Math.floor(amount);

  if (
    !Number.isFinite(safeAmount) ||
    safeAmount <= 0
  ) {
    throw new Error(
      "INVALID_AUDIO_CREDIT_AMOUNT"
    );
  }

  const accountRef =
    adminDb
      .collection("audioCredits")
      .doc(uid);

  const ledgerRef =
    accountRef
      .collection("ledger")
      .doc();

  return adminDb.runTransaction(
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
          merge: true,
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

          ...metadata,

          createdAt:
            FieldValue.serverTimestamp(),
        }
      );

      return newBalance;
    }
  );
}

export async function spendAudioCredits(
  uid: string,
  amount: number,
  reason: string,
  metadata:
    Record<string, unknown> = {}
): Promise<number> {
  const safeAmount =
    Math.floor(amount);

  if (
    !Number.isFinite(safeAmount) ||
    safeAmount <= 0
  ) {
    throw new Error(
      "INVALID_AUDIO_CREDIT_COST"
    );
  }

  const accountRef =
    adminDb
      .collection("audioCredits")
      .doc(uid);

  const ledgerRef =
    accountRef
      .collection("ledger")
      .doc();

  return adminDb.runTransaction(
    async transaction => {
      const snapshot =
        await transaction.get(
          accountRef
        );

      const currentBalance =
        safeBalance(
          snapshot.data()?.balance
        );

      if (
        currentBalance <
        safeAmount
      ) {
        throw new Error(
          "INSUFFICIENT_AUDIO_CREDITS"
        );
      }

      const newBalance =
        currentBalance -
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
          merge: true,
        }
      );

      transaction.set(
        ledgerRef,
        {
          type:
            "debit",

          amount:
            safeAmount,

          reason,

          balanceBefore:
            currentBalance,

          balanceAfter:
            newBalance,

          ...metadata,

          createdAt:
            FieldValue.serverTimestamp(),
        }
      );

      return newBalance;
    }
  );
}
