import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import {
  adminDb,
  firebaseAdminApp,
} from "../../../lib/firebaseAdmin";

type PurchaseItem = {
  name?: string;
  description?: string | null;
  sku?: string | null;
  itemType?: "album" | "track" | null;
  itemId?: string | null;
  quantity?: number;
  unitAmount?: string | null;
  currency?: string;
};

function getBearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization");

  if (!authorization) {
    return null;
  }

  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function toIsoString(value: unknown): string | null {
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as { toDate?: unknown }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }

  return typeof value === "string" ? value : null;
}

export async function GET(request: Request) {
  try {
    const idToken = getBearerToken(request);

    if (!idToken) {
      return NextResponse.json(
        {
          success: false,
          error: "You must be signed in to open My Music.",
        },
        { status: 401 }
      );
    }

    const decodedToken = await getAuth(
      firebaseAdminApp
    ).verifyIdToken(idToken);

    const snapshot = await adminDb
      .collection("purchases")
      .where("customerUid", "==", decodedToken.uid)
      .get();

    const purchases = snapshot.docs
      .map((document) => {
        const data = document.data();
        const rawItems = Array.isArray(data.items)
          ? (data.items as PurchaseItem[])
          : [];

        return {
          orderId:
            typeof data.orderId === "string"
              ? data.orderId
              : document.id,
          captureId:
            typeof data.paymentCaptureId === "string"
              ? data.paymentCaptureId
              : null,
          paymentStatus:
            typeof data.paymentStatus === "string"
              ? data.paymentStatus
              : null,
          paymentCaptureStatus:
            typeof data.paymentCaptureStatus === "string"
              ? data.paymentCaptureStatus
              : null,
          amount:
            typeof data.amount === "string"
              ? data.amount
              : null,
          currency:
            typeof data.currency === "string"
              ? data.currency
              : "USD",
          purchasedAt:
            toIsoString(data.createdAt) ||
            toIsoString(data.updatedAt) ||
            (typeof data.paypalCreateTime === "string"
              ? data.paypalCreateTime
              : null),
          items: rawItems
            .filter(
              (item) =>
                (item.itemType === "album" ||
                  item.itemType === "track") &&
                typeof item.itemId === "string" &&
                item.itemId.length > 0
            )
            .map((item) => ({
              name:
                typeof item.name === "string"
                  ? item.name
                  : "Music purchase",
              description:
                typeof item.description === "string"
                  ? item.description
                  : null,
              sku:
                typeof item.sku === "string"
                  ? item.sku
                  : null,
              itemType: item.itemType as "album" | "track",
              itemId: item.itemId as string,
              quantity:
                typeof item.quantity === "number"
                  ? item.quantity
                  : 1,
              unitAmount:
                typeof item.unitAmount === "string"
                  ? item.unitAmount
                  : null,
              currency:
                typeof item.currency === "string"
                  ? item.currency
                  : "USD",
            })),
        };
      })
      .filter(
        (purchase) =>
          purchase.paymentStatus === "COMPLETED" &&
          purchase.paymentCaptureStatus === "COMPLETED" &&
          purchase.captureId &&
          purchase.items.length > 0
      )
      .sort((a, b) => {
        const aTime = a.purchasedAt
          ? new Date(a.purchasedAt).getTime()
          : 0;
        const bTime = b.purchasedAt
          ? new Date(b.purchasedAt).getTime()
          : 0;

        return bTime - aTime;
      });

    return NextResponse.json({
      success: true,
      purchases,
    });
  } catch (error) {
    console.error("My Music API error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "My Music could not be loaded.",
      },
      { status: 500 }
    );
  }
}
