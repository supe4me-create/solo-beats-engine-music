import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";

import {
  adminDb,
  firebaseAdminApp,
} from "../../../../lib/firebaseAdmin";

export const dynamic = "force-dynamic";

function clean(value: unknown, max = 3000) {
  return typeof value === "string"
    ? value.trim().slice(0, max)
    : "";
}

function bearer(request: Request) {
  const header =
    request.headers.get("authorization") || "";

  return (
    header.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() ||
    null
  );
}

async function verifyUser(request: Request) {
  const token = bearer(request);

  if (!token) return null;

  try {
    return await getAuth(
      firebaseAdminApp
    ).verifyIdToken(token);
  } catch {
    return null;
  }
}

function toIso(value: unknown) {
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as { toDate?: unknown }).toDate ===
      "function"
  ) {
    return (
      value as { toDate: () => Date }
    ).toDate().toISOString();
  }

  return null;
}

export async function GET(request: Request) {
  try {
    const decoded = await verifyUser(request);

    if (!decoded) {
      return NextResponse.json(
        {
          success: false,
          error: "Sign in required.",
        },
        { status: 401 }
      );
    }

    const snapshot = await adminDb
      .collection("soloConnectNotifications")
      .where("recipientUid", "==", decoded.uid)
      .limit(100)
      .get();

    const notifications = snapshot.docs
      .map(document => {
        const data = document.data() || {};

        return {
          id: document.id,
          source: "connect",
          type: clean(data.type, 40) || "general",
          title:
            clean(data.title, 140) ||
            "SOLO CONNECT",
          message: clean(data.message, 500),
          targetUrl:
            clean(data.targetUrl, 1000) ||
            "/connect",
          relatedId:
            clean(data.relatedId, 180) || null,
          read: data.read === true,
          createdAt: toIso(data.createdAt),
          updatedAt: toIso(data.updatedAt),
        };
      })
      .sort((a, b) =>
        String(b.createdAt || "").localeCompare(
          String(a.createdAt || "")
        )
      );

    return NextResponse.json({
      success: true,
      unreadCount: notifications.filter(
        notification => !notification.read
      ).length,
      notifications,
    });
  } catch (error) {
    console.error(
      "SOLO CONNECT NOTIFICATIONS GET:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Notifications could not be loaded.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const decoded = await verifyUser(request);

    if (!decoded) {
      return NextResponse.json(
        {
          success: false,
          error: "Sign in required.",
        },
        { status: 401 }
      );
    }

    const body = await request.json();

    if (body?.markAllRead === true) {
      const snapshot = await adminDb
        .collection("soloConnectNotifications")
        .where("recipientUid", "==", decoded.uid)
        .limit(100)
        .get();

      const unread = snapshot.docs.filter(
        document =>
          document.data()?.read !== true
      );

      if (unread.length > 0) {
        const batch = adminDb.batch();

        unread.forEach(document => {
          batch.update(document.ref, {
            read: true,
            readAt:
              FieldValue.serverTimestamp(),
            updatedAt:
              FieldValue.serverTimestamp(),
          });
        });

        await batch.commit();
      }

      return NextResponse.json({
        success: true,
        updated: unread.length,
      });
    }

    const notificationId =
      clean(body?.notificationId, 180);

    if (!notificationId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "A notification ID is required.",
        },
        { status: 400 }
      );
    }

    const ref = adminDb
      .collection("soloConnectNotifications")
      .doc(notificationId);

    const snapshot = await ref.get();

    if (!snapshot.exists) {
      return NextResponse.json(
        {
          success: false,
          error: "Notification not found.",
        },
        { status: 404 }
      );
    }

    if (
      clean(
        snapshot.data()?.recipientUid,
        128
      ) !== decoded.uid
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "You cannot edit this notification.",
        },
        { status: 403 }
      );
    }

    await ref.update({
      read: true,
      readAt: FieldValue.serverTimestamp(),
      updatedAt:
        FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      success: true,
      notificationId,
    });
  } catch (error) {
    console.error(
      "SOLO CONNECT NOTIFICATIONS PATCH:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Notification could not be updated.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const decoded = await verifyUser(request);

    if (!decoded) {
      return NextResponse.json(
        {
          success: false,
          error: "Sign in required.",
        },
        { status: 401 }
      );
    }

    const body = await request.json();

    const notificationId =
      clean(body?.notificationId, 180);

    if (!notificationId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "A notification ID is required.",
        },
        { status: 400 }
      );
    }

    const ref = adminDb
      .collection("soloConnectNotifications")
      .doc(notificationId);

    const snapshot = await ref.get();

    if (!snapshot.exists) {
      return NextResponse.json(
        {
          success: false,
          error: "Notification not found.",
        },
        { status: 404 }
      );
    }

    if (
      clean(
        snapshot.data()?.recipientUid,
        128
      ) !== decoded.uid
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "You cannot delete this notification.",
        },
        { status: 403 }
      );
    }

    await ref.delete();

    return NextResponse.json({
      success: true,
      notificationId,
      deleted: true,
    });
  } catch (error) {
    console.error(
      "SOLO CONNECT NOTIFICATIONS DELETE:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Notification could not be deleted.",
      },
      { status: 500 }
    );
  }
}