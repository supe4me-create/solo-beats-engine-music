import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";
import {
  adminDb,
  firebaseAdminApp,
} from "../../../../lib/firebaseAdmin";

const OWNER_EMAIL = "supe4.me@gmail.com";

function getBearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  if (!authorization) return null;

  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

async function verifyOwner(request: Request): Promise<void> {
  const idToken = getBearerToken(request);

  if (!idToken) {
    throw new Error("UNAUTHORIZED");
  }

  const decodedToken = await getAuth(firebaseAdminApp).verifyIdToken(idToken);
  const email =
    typeof decodedToken.email === "string"
      ? decodedToken.email.toLowerCase()
      : "";

  if (email !== OWNER_EMAIL) {
    throw new Error("FORBIDDEN");
  }
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
    await verifyOwner(request);

    const snapshot = await adminDb
      .collection("ownerNotifications")
      .orderBy("createdAt", "desc")
      .limit(50)
      .get();

    const notifications = snapshot.docs.map((document) => {
      const data = document.data();

      return {
        id: document.id,
        type: typeof data.type === "string" ? data.type : "general",
        category:
          typeof data.category === "string" ? data.category : "general",
        title:
          typeof data.title === "string" ? data.title : "Notification",
        message:
          typeof data.message === "string" ? data.message : "",
        targetUrl:
          typeof data.targetUrl === "string" ? data.targetUrl : "/developer",
        relatedId:
          typeof data.relatedId === "string" ? data.relatedId : null,
        read: data.read === true,
        createdAt: toIsoString(data.createdAt),
        updatedAt: toIsoString(data.updatedAt),
      };
    });

    return NextResponse.json({
      success: true,
      unreadCount: notifications.filter((notification) => !notification.read)
        .length,
      notifications,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json(
        { success: false, error: "Owner authentication is required." },
        { status: 401 }
      );
    }

    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json(
        { success: false, error: "Owner access only." },
        { status: 403 }
      );
    }

    console.error("Owner notifications GET error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Notifications could not be loaded.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    await verifyOwner(request);

    const body = (await request.json()) as {
      notificationId?: string;
      markAllRead?: boolean;
    };

    if (body.markAllRead === true) {
      const snapshot = await adminDb
        .collection("ownerNotifications")
        .where("read", "==", false)
        .get();

      const batch = adminDb.batch();

      for (const document of snapshot.docs) {
        batch.set(
          document.ref,
          {
            read: true,
            readAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      }

      await batch.commit();

      return NextResponse.json({
        success: true,
        updated: snapshot.size,
      });
    }

    const notificationId =
      typeof body.notificationId === "string"
        ? body.notificationId.trim()
        : "";

    if (!notificationId) {
      return NextResponse.json(
        { success: false, error: "A notification ID is required." },
        { status: 400 }
      );
    }

    await adminDb
      .collection("ownerNotifications")
      .doc(notificationId)
      .set(
        {
          read: true,
          readAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

    return NextResponse.json({
      success: true,
      notificationId,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json(
        { success: false, error: "Owner authentication is required." },
        { status: 401 }
      );
    }

    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json(
        { success: false, error: "Owner access only." },
        { status: 403 }
      );
    }

    console.error("Owner notifications PATCH error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Notification could not be updated.",
      },
      { status: 500 }
    );
  }
}
