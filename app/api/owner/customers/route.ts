import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import {
  adminDb,
  firebaseAdminApp,
} from "../../../../lib/firebaseAdmin";

const OWNER_EMAIL = "supe4.me@gmail.com";

type PurchaseItem = {
  name?: string;
  itemType?: "album" | "track" | null;
  itemId?: string | null;
  quantity?: number;
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

    const customerMap = new Map<
      string,
      {
        key: string;
        customerUid: string | null;
        name: string;
        email: string | null;
        totalOrders: number;
        albumsPurchased: number;
        tracksPurchased: number;
        totalSpent: number;
        latestPurchaseAt: string | null;
        orders: Array<{
          orderId: string;
          amount: number;
          currency: string;
          purchasedAt: string | null;
          itemCount: number;
          items: Array<{
            name: string;
            itemType: "album" | "track" | null;
            itemId: string | null;
            quantity: number;
          }>;
        }>;
      }
    >();

    for (const document of snapshot.docs) {
      const data = document.data();

      if (
        data.paymentStatus !== "COMPLETED" ||
        data.paymentCaptureStatus !== "COMPLETED"
      ) {
        continue;
      }

      const customerUid = getText(data.customerUid);
      const customerEmail =
        getText(data.customerEmail) || getText(data.payerEmail);
      const customerName =
        getText(data.customerDisplayName) ||
        getText(data.payerName) ||
        customerEmail ||
        "Guest customer";

      const customerKey = customerUid
        ? `uid:${customerUid}`
        : customerEmail
          ? `email:${customerEmail.toLowerCase()}`
          : `guest:${document.id}`;

      const amount = Number(data.amount || 0);
      const currency = getText(data.currency) || "USD";

      const rawItems = Array.isArray(data.items)
        ? (data.items as PurchaseItem[])
        : [];

      let itemCount = 0;
      let albumCount = 0;
      let trackCount = 0;

      const items = rawItems.map((item) => {
        const quantity =
          typeof item.quantity === "number" && item.quantity > 0
            ? item.quantity
            : 1;

        itemCount += quantity;

        if (item.itemType === "album") albumCount += quantity;
        if (item.itemType === "track") trackCount += quantity;

        return {
          name: getText(item.name) || "Purchased item",
          itemType:
            item.itemType === "album" || item.itemType === "track"
              ? item.itemType
              : null,
          itemId: getText(item.itemId),
          quantity,
        };
      });

      const purchasedAt =
        toIsoString(data.createdAt) ||
        toIsoString(data.updatedAt) ||
        getText(data.paypalCreateTime);

      const order = {
        orderId: getText(data.orderId) || document.id,
        amount: Number.isFinite(amount) ? amount : 0,
        currency,
        purchasedAt,
        itemCount,
        items,
      };

      const current = customerMap.get(customerKey);

      if (current) {
        current.totalOrders += 1;
        current.albumsPurchased += albumCount;
        current.tracksPurchased += trackCount;
        current.totalSpent += Number.isFinite(amount) ? amount : 0;
        current.orders.push(order);

        const currentTime = current.latestPurchaseAt
          ? new Date(current.latestPurchaseAt).getTime()
          : 0;
        const orderTime = purchasedAt
          ? new Date(purchasedAt).getTime()
          : 0;

        if (orderTime > currentTime) {
          current.latestPurchaseAt = purchasedAt;
        }
      } else {
        customerMap.set(customerKey, {
          key: customerKey,
          customerUid,
          name: customerName,
          email: customerEmail,
          totalOrders: 1,
          albumsPurchased: albumCount,
          tracksPurchased: trackCount,
          totalSpent: Number.isFinite(amount) ? amount : 0,
          latestPurchaseAt: purchasedAt,
          orders: [order],
        });
      }
    }

    const customers = Array.from(customerMap.values())
      .map((customer) => ({
        ...customer,
        totalSpent: Number(customer.totalSpent.toFixed(2)),
        orders: customer.orders.sort((a, b) => {
          const aTime = a.purchasedAt
            ? new Date(a.purchasedAt).getTime()
            : 0;
          const bTime = b.purchasedAt
            ? new Date(b.purchasedAt).getTime()
            : 0;

          return bTime - aTime;
        }),
      }))
      .sort((a, b) => {
        const aTime = a.latestPurchaseAt
          ? new Date(a.latestPurchaseAt).getTime()
          : 0;
        const bTime = b.latestPurchaseAt
          ? new Date(b.latestPurchaseAt).getTime()
          : 0;

        return bTime - aTime;
      });

    return NextResponse.json({
      success: true,
      customers,
    });
  } catch (error) {
    console.error("Owner customers API error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Customers could not be loaded.",
      },
      { status: 500 }
    );
  }
}
