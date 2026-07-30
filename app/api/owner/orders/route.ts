import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import {
  adminDb,
  firebaseAdminApp,
} from "../../../../lib/firebaseAdmin";

const OWNER_EMAIL = "supe4.me@gmail.com";

type PurchaseItem = {
  name?: string;
  description?: string | null;
  sku?: string | null;
  itemType?: "album" | "track" | null;
  itemId?: string | null;
  quantity?: number;
  unitAmount?: string | number | null;
  currency?: string | null;
};

function getBearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  if (!authorization) return null;

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

function getText(value: unknown): string | null {
  return typeof value === "string" && value.trim()
    ? value.trim()
    : null;
}

export async function GET(request: Request) {
  try {
    const idToken = getBearerToken(request);

    if (!idToken) {
      return NextResponse.json(
        { success: false, error: "Owner authentication is required." },
        { status: 401 }
      );
    }

    const decodedToken = await getAuth(firebaseAdminApp).verifyIdToken(idToken);
    const email =
      typeof decodedToken.email === "string"
        ? decodedToken.email.toLowerCase()
        : "";

    if (email !== OWNER_EMAIL) {
      return NextResponse.json(
        { success: false, error: "Owner access only." },
        { status: 403 }
      );
    }

    const snapshot = await adminDb.collection("purchases").get();

    const orders = snapshot.docs
      .map((document) => {
        const data = document.data();

        if (
          data.paymentStatus !== "COMPLETED" ||
          data.paymentCaptureStatus !== "COMPLETED"
        ) {
          return null;
        }

        const amount = Number(data.amount || 0);
        const customerEmail =
          getText(data.customerEmail) || getText(data.payerEmail);

        const rawItems = Array.isArray(data.items)
          ? (data.items as PurchaseItem[])
          : [];

        let itemCount = 0;

        const items = rawItems.map((item) => {
          const quantity =
            typeof item.quantity === "number" && item.quantity > 0
              ? item.quantity
              : 1;

          itemCount += quantity;

          return {
            name: getText(item.name) || "Purchased item",
            description: getText(item.description),
            sku: getText(item.sku),
            itemType:
              item.itemType === "album" || item.itemType === "track"
                ? item.itemType
                : null,
            itemId: getText(item.itemId),
            quantity,
            unitAmount:
              item.unitAmount === null || item.unitAmount === undefined
                ? null
                : String(item.unitAmount),
            currency: getText(item.currency) || getText(data.currency) || "USD",
          };
        });

        return {
          orderId: getText(data.orderId) || document.id,
          captureId: getText(data.captureId),
          payerId: getText(data.payerId),
          customerUid: getText(data.customerUid),
          customer:
            getText(data.customerDisplayName) ||
            getText(data.payerName) ||
            customerEmail ||
            "Guest customer",
          customerEmail,
          amount: Number.isFinite(amount) ? amount : 0,
          currency: getText(data.currency) || "USD",
          purchasedAt:
            toIsoString(data.createdAt) ||
            toIsoString(data.updatedAt) ||
            getText(data.paypalCreateTime),
          itemCount,
          items,
        };
      })
      .filter(Boolean)
      .sort((a, b) => {
        const aTime = a?.purchasedAt
          ? new Date(a.purchasedAt).getTime()
          : 0;
        const bTime = b?.purchasedAt
          ? new Date(b.purchasedAt).getTime()
          : 0;

        return bTime - aTime;
      });

    return NextResponse.json({
      success: true,
      orders,
    });
  } catch (error) {
    console.error("Owner orders API error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Owner orders could not be loaded.",
      },
      { status: 500 }
    );
  }
}
