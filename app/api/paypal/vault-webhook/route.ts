import { NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";

import { adminDb } from "../../../../lib/firebaseAdmin";
import {
  getPayPalAccessToken,
  PAYPAL_BASE_URL,
} from "../../../../lib/paypalVault";

const PAYPAL_VAULT_WEBHOOK_ID =
  process.env.PAYPAL_VAULT_WEBHOOK_ID;

function requiredHeader(
  request: Request,
  name: string
) {
  return request.headers.get(name) || "";
}

async function verifyWebhook(
  request: Request,
  event: unknown
) {
  if (!PAYPAL_VAULT_WEBHOOK_ID) {
    throw new Error(
      "PAYPAL_VAULT_WEBHOOK_ID is missing."
    );
  }

  const accessToken =
    await getPayPalAccessToken();

  const response = await fetch(
    `${PAYPAL_BASE_URL}/v1/notifications/verify-webhook-signature`,
    {
      method: "POST",
      headers: {
        Authorization:
          `Bearer ${accessToken}`,
        "Content-Type":
          "application/json",
      },
      body: JSON.stringify({
        auth_algo: requiredHeader(
          request,
          "paypal-auth-algo"
        ),
        cert_url: requiredHeader(
          request,
          "paypal-cert-url"
        ),
        transmission_id:
          requiredHeader(
            request,
            "paypal-transmission-id"
          ),
        transmission_sig:
          requiredHeader(
            request,
            "paypal-transmission-sig"
          ),
        transmission_time:
          requiredHeader(
            request,
            "paypal-transmission-time"
          ),
        webhook_id:
          PAYPAL_VAULT_WEBHOOK_ID,
        webhook_event: event,
      }),
      cache: "no-store",
    }
  );

  const result =
    await response.json();

  return (
    response.ok &&
    result.verification_status ===
      "SUCCESS"
  );
}

export async function POST(
  request: Request
) {
  try {
    const event = await request.json();

    const verified =
      await verifyWebhook(
        request,
        event
      );

    if (!verified) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid PayPal webhook signature.",
        },
        { status: 400 }
      );
    }

    const eventType =
      typeof event?.event_type ===
      "string"
        ? event.event_type
        : "";

    const resource =
      event?.resource || {};
    const vaultId =
      typeof resource?.id === "string"
        ? resource.id
        : "";
    const customerId =
      typeof resource?.customer?.id ===
      "string"
        ? resource.customer.id
        : "";

    if (
      eventType ===
        "VAULT.PAYMENT-TOKEN.CREATED" &&
      vaultId &&
      customerId
    ) {
      const profileQuery =
        await adminDb
          .collection(
            "paypalVaultProfiles"
          )
          .where(
            "paypalCustomerId",
            "==",
            customerId
          )
          .limit(1)
          .get();

      if (!profileQuery.empty) {
        const profileRef =
          profileQuery.docs[0].ref;
        const card =
          resource?.payment_source
            ?.card;
        const methodType = card
          ? "card"
          : "paypal";

        await profileRef.set(
          {
            vaultId,
            paypalCustomerId:
              customerId,
            methodType,
            brand:
              card?.brand || null,
            lastDigits:
              card?.last_digits ||
              null,
            status: "active",
            updatedAt:
              FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      }
    }

    if (
      [
        "VAULT.PAYMENT-TOKEN.DELETED",
        "VAULT.PAYMENT-TOKEN.DELETION-INITIATED",
      ].includes(eventType) &&
      vaultId
    ) {
      const profileQuery =
        await adminDb
          .collection(
            "paypalVaultProfiles"
          )
          .where(
            "vaultId",
            "==",
            vaultId
          )
          .get();

      await Promise.all(
        profileQuery.docs.map(
          (document) =>
            document.ref.set(
              {
                status:
                  "inactive",
                updatedAt:
                  FieldValue.serverTimestamp(),
              },
              { merge: true }
            )
        )
      );
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error(
      "PayPal vault webhook error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "The PayPal vault webhook could not be processed.",
      },
      { status: 500 }
    );
  }
}

