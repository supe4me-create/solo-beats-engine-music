import { NextResponse } from "next/server";

import { adminDb } from "../../../lib/firebaseAdmin";
import { albums } from "../../store/albums";

type PurchaseItem = {
  itemType?: "album" | "track" | null;
  itemId?: string | null;
  quantity?: number;
};

type AlbumStats = {
  purchaseCount: number;
  latestPurchaseAt: Date | null;
  albumPurchaseCount: number;
  trackPurchaseCount: number;
};

type RankedAlbum = {
  albumId: string;
  purchaseCount: number;
  albumPurchaseCount: number;
  trackPurchaseCount: number;
  latestPurchaseAt: string | null;
  title: string;
  genre: string;
  cover: string;
  href: string;
};

function getPurchaseDate(data: Record<string, unknown>): Date | null {
  for (const value of [data.createdAt, data.updatedAt, data.accountLinkedAt]) {
    if (
      value &&
      typeof value === "object" &&
      "toDate" in value &&
      typeof (value as { toDate?: unknown }).toDate === "function"
    ) {
      const date = (value as { toDate: () => Date }).toDate();

      if (!Number.isNaN(date.getTime())) {
        return date;
      }
    }
  }

  for (const value of [
    data.paypalCreateTime,
    data.paypalUpdateTime,
    data.createTime,
    data.updateTime,
  ]) {
    if (typeof value !== "string") {
      continue;
    }

    const date = new Date(value);

    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }

  return null;
}

function findAlbumId(itemType: "album" | "track", itemId: string) {
  if (itemType === "album") {
    return albums.some((album) => album.id === itemId) ? itemId : null;
  }

  const album = albums.find((candidate) =>
    candidate.tracks.some((track) => track.id === itemId)
  );

  return album?.id || null;
}

export async function GET() {
  try {
    const snapshot = await adminDb.collection("purchases").get();
    const stats = new Map<string, AlbumStats>();

    for (const document of snapshot.docs) {
      const data = document.data();

      if (
        data.paymentStatus !== "COMPLETED" ||
        data.paymentCaptureStatus !== "COMPLETED"
      ) {
        continue;
      }

      const purchaseDate = getPurchaseDate(data);
      const items: PurchaseItem[] = Array.isArray(data.items)
        ? data.items
        : [];

      for (const item of items) {
        if (
          (item.itemType !== "album" && item.itemType !== "track") ||
          typeof item.itemId !== "string" ||
          !item.itemId
        ) {
          continue;
        }

        const albumId = findAlbumId(item.itemType, item.itemId);

        if (!albumId) {
          continue;
        }

        const quantity =
          typeof item.quantity === "number" && item.quantity > 0
            ? item.quantity
            : 1;

        const current = stats.get(albumId) || {
          purchaseCount: 0,
          latestPurchaseAt: null,
          albumPurchaseCount: 0,
          trackPurchaseCount: 0,
        };

        stats.set(albumId, {
          purchaseCount: current.purchaseCount + quantity,
          latestPurchaseAt:
            purchaseDate &&
            (!current.latestPurchaseAt ||
              purchaseDate.getTime() > current.latestPurchaseAt.getTime())
              ? purchaseDate
              : current.latestPurchaseAt,
          albumPurchaseCount:
            current.albumPurchaseCount +
            (item.itemType === "album" ? quantity : 0),
          trackPurchaseCount:
            current.trackPurchaseCount +
            (item.itemType === "track" ? quantity : 0),
        });
      }
    }

    const ranked: RankedAlbum[] = albums
      .map((album) => {
        const albumStats = stats.get(album.id);

        if (!albumStats || albumStats.purchaseCount <= 0) {
          return null;
        }

        return {
          albumId: album.id,
          purchaseCount: albumStats.purchaseCount,
          albumPurchaseCount: albumStats.albumPurchaseCount,
          trackPurchaseCount: albumStats.trackPurchaseCount,
          latestPurchaseAt:
            albumStats.latestPurchaseAt?.toISOString() || null,
          title: album.title,
          genre: album.genre,
          cover: album.cover,
          href: `/store?album=${album.id}`,
        };
      })
      .filter((item): item is RankedAlbum => Boolean(item));

    ranked.sort((a, b) => {
      if (b.purchaseCount !== a.purchaseCount) {
        return b.purchaseCount - a.purchaseCount;
      }

      const aTime = a.latestPurchaseAt
        ? new Date(a.latestPurchaseAt).getTime()
        : 0;
      const bTime = b.latestPurchaseAt
        ? new Date(b.latestPurchaseAt).getTime()
        : 0;

      if (bTime !== aTime) {
        return bTime - aTime;
      }

      return a.title.localeCompare(b.title);
    });

    return NextResponse.json({
      success: true,
      trending: ranked.slice(0, 8),
    });
  } catch (error) {
    console.error("Trending API error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Trending music could not be loaded.",
      },
      { status: 500 }
    );
  }
}
