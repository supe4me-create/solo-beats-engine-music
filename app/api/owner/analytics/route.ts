import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import {
  adminDb,
  firebaseAdminApp,
} from "../../../../lib/firebaseAdmin";

export const dynamic = "force-dynamic";

const OWNER_EMAIL = (
  process.env.OWNER_EMAIL ||
  process.env.NEXT_PUBLIC_OWNER_EMAIL ||
  ""
)
  .trim()
  .toLowerCase();

function getBearerToken(
  request: Request
): string | null {
  const authorization =
    request.headers.get("authorization");

  if (
    !authorization ||
    !authorization.startsWith("Bearer ")
  ) {
    return null;
  }

  return authorization.slice(7).trim() || null;
}

function toDate(value: unknown): Date | null {
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as { toDate?: unknown }).toDate ===
      "function"
  ) {
    return (
      value as { toDate: () => Date }
    ).toDate();
  }

  if (
    typeof value === "string" ||
    typeof value === "number"
  ) {
    const parsed = new Date(value);

    return Number.isNaN(parsed.getTime())
      ? null
      : parsed;
  }

  return null;
}

type EventRecord = {
  eventType: string;
  path: string | null;
  visitorId: string | null;
  sessionId: string | null;
  isAlbumPage: boolean;
  createdAt: Date | null;
};

export async function GET(request: Request) {
  try {
    const idToken = getBearerToken(request);

    if (!idToken) {
      return NextResponse.json(
        {
          success: false,
          error: "Owner authentication is required.",
        },
        { status: 401 }
      );
    }

    const decodedToken = await getAuth(
      firebaseAdminApp
    ).verifyIdToken(idToken);

    const email =
      typeof decodedToken.email === "string"
        ? decodedToken.email.trim().toLowerCase()
        : "";

    if (!OWNER_EMAIL || email !== OWNER_EMAIL) {
      return NextResponse.json(
        {
          success: false,
          error: "Owner access only.",
        },
        { status: 403 }
      );
    }

    const snapshot = await adminDb
      .collection("analyticsEvents")
      .orderBy("createdAt", "desc")
      .limit(10000)
      .get();

    const events: EventRecord[] =
      snapshot.docs.map((document) => {
        const data = document.data();

        return {
          eventType:
            typeof data.eventType === "string"
              ? data.eventType
              : "unknown",

          path:
            typeof data.path === "string"
              ? data.path
              : null,

          visitorId:
            typeof data.visitorId === "string"
              ? data.visitorId
              : null,

          sessionId:
            typeof data.sessionId === "string"
              ? data.sessionId
              : null,

          isAlbumPage:
            data.isAlbumPage === true,

          createdAt: toDate(data.createdAt),
        };
      });

    const now = new Date();

    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );

    const sevenDaysAgo = new Date(
      now.getTime() -
        7 * 24 * 60 * 60 * 1000
    );

    const thirtyDaysAgo = new Date(
      now.getTime() -
        30 * 24 * 60 * 60 * 1000
    );

    const pageViews = events.filter(
      (event) =>
        event.eventType === "page_view"
    );
    const previewEvents30d =
      events.filter(
        (event) =>
          event.createdAt &&
          event.createdAt >= thirtyDaysAgo
      );

    function countPreviewEvent(
      eventType: string
    ) {
      return previewEvents30d.filter(
        (event) =>
          event.eventType === eventType
      ).length;
    }

    const previewFunnel = {
      radioPublicStarted:
        countPreviewEvent(
          "radio_public_preview_started"
        ),

      radioPublicLimit:
        countPreviewEvent(
          "radio_public_preview_limit"
        ),

      radioFreeStarted:
        countPreviewEvent(
          "radio_free_preview_started"
        ),

      radioFreeLimit:
        countPreviewEvent(
          "radio_free_preview_limit"
        ),

      tvPublicStarted:
        countPreviewEvent(
          "tv_public_preview_started"
        ),

      tvPublicLimit:
        countPreviewEvent(
          "tv_public_preview_limit"
        ),

      tvFreeStarted:
        countPreviewEvent(
          "tv_free_preview_started"
        ),

      tvFreeLimit:
        countPreviewEvent(
          "tv_free_preview_limit"
        ),
    };

    const todayViews = pageViews.filter(
      (event) =>
        event.createdAt &&
        event.createdAt >= todayStart
    );

    const sevenDayViews = pageViews.filter(
      (event) =>
        event.createdAt &&
        event.createdAt >= sevenDaysAgo
    );

    const thirtyDayViews = pageViews.filter(
      (event) =>
        event.createdAt &&
        event.createdAt >= thirtyDaysAgo
    );

    const uniqueVisitors = new Set(
      pageViews
        .map((event) => event.visitorId)
        .filter(Boolean)
    ).size;

    const uniqueVisitors30d = new Set(
      thirtyDayViews
        .map((event) => event.visitorId)
        .filter(Boolean)
    ).size;

    const uniqueVisitorsToday = new Set(
      todayViews
        .map((event) => event.visitorId)
        .filter(Boolean)
    ).size;

    const sessions30d = new Set(
      thirtyDayViews
        .map((event) => event.sessionId)
        .filter(Boolean)
    ).size;

    const pageCounts =
      new Map<string, number>();

    for (const event of thirtyDayViews) {
      const path = event.path || "/";

      pageCounts.set(
        path,
        (pageCounts.get(path) || 0) + 1
      );
    }

    const topPages = Array.from(
      pageCounts.entries()
    )
      .map(([path, views]) => ({
        path,
        views,
      }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 15);

    const albumCounts =
      new Map<string, number>();

    for (const event of thirtyDayViews) {
      if (
        !event.isAlbumPage ||
        !event.path
      ) {
        continue;
      }

      albumCounts.set(
        event.path,
        (albumCounts.get(event.path) || 0) + 1
      );
    }

    const topAlbums = Array.from(
      albumCounts.entries()
    )
      .map(([path, views]) => ({
        path,
        views,
      }))
      .sort((a, b) => b.views - a.views)
      .slice(0, 10);

    const dailyMap =
      new Map<string, number>();

    for (let offset = 29; offset >= 0; offset--) {
      const date = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - offset
      );

      const key = date
        .toISOString()
        .slice(0, 10);

      dailyMap.set(key, 0);
    }

    for (const event of thirtyDayViews) {
      if (!event.createdAt) {
        continue;
      }

      const key = event.createdAt
        .toISOString()
        .slice(0, 10);

      if (dailyMap.has(key)) {
        dailyMap.set(
          key,
          (dailyMap.get(key) || 0) + 1
        );
      }
    }

    const dailyViews = Array.from(
      dailyMap.entries()
    ).map(([date, views]) => ({
      date,
      views,
    }));

    return NextResponse.json({
      success: true,

      totals: {
        recordedPageViews: pageViews.length,
        uniqueVisitors,
        todayViews: todayViews.length,
        todayUniqueVisitors:
          uniqueVisitorsToday,
        sevenDayViews:
          sevenDayViews.length,
        thirtyDayViews:
          thirtyDayViews.length,
        thirtyDayUniqueVisitors:
          uniqueVisitors30d,
        thirtyDaySessions: sessions30d,
        albumViews30d:
          thirtyDayViews.filter(
            (event) => event.isAlbumPage
          ).length,
      },

      topPages,
      topAlbums,
      dailyViews,
      previewFunnel,

      note:
        snapshot.size >= 10000
          ? "Showing analytics from the newest 10,000 recorded events."
          : null,
    });
  } catch (error) {
    console.error(
      "Owner analytics API error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Owner analytics could not be loaded.",
      },
      { status: 500 }
    );
  }
}
