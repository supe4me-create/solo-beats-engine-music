import {
  getAuth,
} from "firebase-admin/auth";

import {
  FieldValue,
} from "firebase-admin/firestore";

import {
  adminDb,
  firebaseAdminApp,
} from "./firebaseAdmin";

const OWNER_EMAIL = (
  process.env.OWNER_EMAIL ||
  process.env.NEXT_PUBLIC_OWNER_EMAIL ||
  "supe4.me@gmail.com"
)
  .trim()
  .toLowerCase();

const SESSION_COLLECTION =
  "visualizerRenderSessions";

export type VisualizerRenderAccess = {
  uid: string;
  email: string | null;
  owner: boolean;
  sessionId: string | null;
};

function getBearerToken(
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

export async function getVisualizerAuthenticatedUser(
  request: Request
) {
  const token =
    getBearerToken(
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

  if (account.disabled) {
    throw new Error(
      "ACCOUNT_DISABLED"
    );
  }

  const email =
    account.email
      ?.trim()
      .toLowerCase() ||
    null;

  const owner =
    email === OWNER_EMAIL;

  if (
    !owner &&
    !account.emailVerified
  ) {
    throw new Error(
      "EMAIL_VERIFICATION_REQUIRED"
    );
  }

  return {
    uid:
      account.uid,

    email,

    owner,
  };
}

export async function reserveVisualizerCredit(
  request: Request
) {
  const user =
    await getVisualizerAuthenticatedUser(
      request
    );

  if (user.owner) {
    const accountSnapshot =
      await adminDb
        .collection(
          "visualizerCredits"
        )
        .doc(
          user.uid
        )
        .get();

    const balance =
      Number(
        accountSnapshot
          .data()
          ?.balance ||
        0
      );

    return {
      success:
        true,

      ownerBypass:
        true,

      reservationId:
        null,

      balance,
    };
  }

  const reservationId =
    crypto.randomUUID();

  const accountRef =
    adminDb
      .collection(
        "visualizerCredits"
      )
      .doc(
        user.uid
      );

  const sessionRef =
    adminDb
      .collection(
        SESSION_COLLECTION
      )
      .doc(
        reservationId
      );

  const ledgerRef =
    accountRef
      .collection(
        "ledger"
      )
      .doc(
        `render_reserve_${reservationId}`
      );

  const result =
    await adminDb.runTransaction(
      async transaction => {
        const accountSnapshot =
          await transaction.get(
            accountRef
          );

        const currentBalance =
          Number(
            accountSnapshot
              .data()
              ?.balance ||
            0
          );

        if (
          currentBalance <
          1
        ) {
          throw new Error(
            "NO_VISUALIZER_CREDITS"
          );
        }

        const nextBalance =
          currentBalance -
          1;

        transaction.set(
          accountRef,
          {
            balance:
              nextBalance,

            updatedAt:
              FieldValue.serverTimestamp(),
          },
          {
            merge:
              true,
          }
        );

        transaction.set(
          sessionRef,
          {
            reservationId,

            uid:
              user.uid,

            email:
              user.email,

            status:
              "reserved",

            creditsReserved:
              1,

            balanceBefore:
              currentBalance,

            balanceAfterReserve:
              nextBalance,

            createdAt:
              FieldValue.serverTimestamp(),

            updatedAt:
              FieldValue.serverTimestamp(),
          }
        );

        transaction.set(
          ledgerRef,
          {
            type:
              "debit",

            amount:
              -1,

            reason:
              "visualizer_render_reservation",

            reservationId,

            balanceBefore:
              currentBalance,

            balanceAfter:
              nextBalance,

            createdAt:
              FieldValue.serverTimestamp(),
          }
        );

        return {
          balance:
            nextBalance,
        };
      }
    );

  return {
    success:
      true,

    ownerBypass:
      false,

    reservationId,

    balance:
      result.balance,
  };
}

export async function requireVisualizerRenderAccess(
  request: Request,
  reservationId: string | null | undefined
): Promise<VisualizerRenderAccess> {
  const user =
    await getVisualizerAuthenticatedUser(
      request
    );

  if (user.owner) {
    return {
      uid:
        user.uid,

      email:
        user.email,

      owner:
        true,

      sessionId:
        null,
    };
  }

  const safeReservationId =
    String(
      reservationId ||
      ""
    )
      .trim()
      .replace(
        /[^a-zA-Z0-9_-]/g,
        ""
      )
      .slice(
        0,
        120
      );

  if (!safeReservationId) {
    throw new Error(
      "VISUALIZER_CREDIT_RESERVATION_REQUIRED"
    );
  }

  const sessionSnapshot =
    await adminDb
      .collection(
        SESSION_COLLECTION
      )
      .doc(
        safeReservationId
      )
      .get();

  if (
    !sessionSnapshot.exists
  ) {
    throw new Error(
      "VISUALIZER_CREDIT_RESERVATION_NOT_FOUND"
    );
  }

  const data =
    sessionSnapshot.data() ||
    {};

  if (
    data.uid !==
    user.uid
  ) {
    throw new Error(
      "VISUALIZER_CREDIT_RESERVATION_OWNER_MISMATCH"
    );
  }

  if (
    data.status !==
    "reserved"
  ) {
    throw new Error(
      `VISUALIZER_CREDIT_RESERVATION_${String(
        data.status ||
        "INVALID"
      ).toUpperCase()}`
    );
  }

  return {
    uid:
      user.uid,

    email:
      user.email,

    owner:
      false,

    sessionId:
      safeReservationId,
  };
}

export async function completeVisualizerReservation(
  access: VisualizerRenderAccess
) {
  if (
    access.owner ||
    !access.sessionId
  ) {
    return;
  }

  const sessionRef =
    adminDb
      .collection(
        SESSION_COLLECTION
      )
      .doc(
        access.sessionId
      );

  await adminDb.runTransaction(
    async transaction => {
      const snapshot =
        await transaction.get(
          sessionRef
        );

      if (!snapshot.exists) {
        return;
      }

      const data =
        snapshot.data() ||
        {};

      if (
        data.uid !==
        access.uid
      ) {
        return;
      }

      if (
        data.status !==
        "reserved"
      ) {
        return;
      }

      transaction.set(
        sessionRef,
        {
          status:
            "completed",

          completedAt:
            FieldValue.serverTimestamp(),

          updatedAt:
            FieldValue.serverTimestamp(),
        },
        {
          merge:
            true,
        }
      );
    }
  );
}

export async function refundVisualizerReservation(
  access: VisualizerRenderAccess,
  reason = "visualizer_render_failed"
) {
  if (
    access.owner ||
    !access.sessionId
  ) {
    return;
  }

  const accountRef =
    adminDb
      .collection(
        "visualizerCredits"
      )
      .doc(
        access.uid
      );

  const sessionRef =
    adminDb
      .collection(
        SESSION_COLLECTION
      )
      .doc(
        access.sessionId
      );

  const ledgerRef =
    accountRef
      .collection(
        "ledger"
      )
      .doc(
        `render_refund_${access.sessionId}`
      );

  await adminDb.runTransaction(
    async transaction => {
      const [
        sessionSnapshot,
        accountSnapshot,
      ] =
        await Promise.all([
          transaction.get(
            sessionRef
          ),

          transaction.get(
            accountRef
          ),
        ]);

      if (
        !sessionSnapshot.exists
      ) {
        return;
      }

      const sessionData =
        sessionSnapshot.data() ||
        {};

      if (
        sessionData.uid !==
        access.uid
      ) {
        return;
      }

      if (
        sessionData.status !==
        "reserved"
      ) {
        return;
      }

      const currentBalance =
        Number(
          accountSnapshot
            .data()
            ?.balance ||
          0
        );

      const nextBalance =
        currentBalance +
        1;

      transaction.set(
        accountRef,
        {
          balance:
            nextBalance,

          updatedAt:
            FieldValue.serverTimestamp(),
        },
        {
          merge:
            true,
        }
      );

      transaction.set(
        sessionRef,
        {
          status:
            "refunded",

          refundReason:
            reason,

          refundedAt:
            FieldValue.serverTimestamp(),

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
            "visualizer_render_refund",

          refundReason:
            reason,

          reservationId:
            access.sessionId,

          balanceBefore:
            currentBalance,

          balanceAfter:
            nextBalance,

          createdAt:
            FieldValue.serverTimestamp(),
        }
      );
    }
  );
}