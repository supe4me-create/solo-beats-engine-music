import { FieldValue } from "firebase-admin/firestore";

import { adminDb } from "./firebaseAdmin";

type CreateConnectNotificationInput = {
  recipientUid: string;
  actorUid: string;
  type: "like" | "comment" | "follow" | "message";
  title: string;
  message: string;
  targetUrl: string;
  relatedId?: string | null;
};

function clean(value: unknown, max = 3000) {
  return typeof value === "string"
    ? value.trim().slice(0, max)
    : "";
}

export async function createConnectNotification(
  input: CreateConnectNotificationInput
) {
  const recipientUid = clean(input.recipientUid, 128);
  const actorUid = clean(input.actorUid, 128);

  if (!recipientUid || recipientUid === actorUid) {
    return;
  }

  try {
    await adminDb
      .collection("soloConnectNotifications")
      .add({
        recipientUid,
        actorUid,
        type: clean(input.type, 40) || "general",
        title: clean(input.title, 140) || "SOLO CONNECT",
        message: clean(input.message, 500),
        targetUrl:
          clean(input.targetUrl, 1000) || "/connect",
        relatedId:
          clean(input.relatedId, 180) || null,
        read: false,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
  } catch (error) {
    // A notification failure must never block the social action.
    console.error(
      "SOLO CONNECT NOTIFICATION CREATE:",
      error
    );
  }
}