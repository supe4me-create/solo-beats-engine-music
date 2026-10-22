import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";

import {
  adminDb,
  firebaseAdminApp,
} from "../../../../lib/firebaseAdmin";

import {
  createConnectNotification,
} from "../../../../lib/soloConnectNotifications";

export const dynamic = "force-dynamic";

function clean(value: unknown, max = 3000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function getBearerToken(request: Request) {
  const header = request.headers.get("authorization") || "";
  return header.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || null;
}

async function verifyUser(request: Request) {
  const token = getBearerToken(request);

  if (!token) return null;

  try {
    return await getAuth(firebaseAdminApp).verifyIdToken(token);
  } catch {
    return null;
  }
}

function toIso(value: unknown) {
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as { toDate?: unknown }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }

  return null;
}

async function getProfile(uid: string) {
  const snapshot = await adminDb
    .collection("soloConnectProfiles")
    .doc(uid)
    .get();

  if (!snapshot.exists) return null;

  const data = snapshot.data() || {};

  return {
    uid: snapshot.id,
    username: clean(data.username, 24),
    displayName: clean(data.displayName, 100),
    photoURL: clean(data.photoURL, 4000),
  };
}

async function requireConversation(conversationId: string, uid: string) {
  const ref = adminDb
    .collection("soloConnectConversations")
    .doc(conversationId);

  const snapshot = await ref.get();

  if (!snapshot.exists) {
    throw new Error("CONVERSATION_NOT_FOUND");
  }

  const data = snapshot.data() || {};
  const memberUids = Array.isArray(data.memberUids)
    ? data.memberUids.filter((value: unknown): value is string => typeof value === "string")
    : [];

  if (!memberUids.includes(uid)) {
    throw new Error("NOT_A_MEMBER");
  }

  return {
    ref,
    snapshot,
    data,
    memberUids,
  };
}

function apiError(error: unknown) {
  const message = error instanceof Error ? error.message : "";

  if (message === "CONVERSATION_NOT_FOUND") {
    return NextResponse.json(
      { success: false, error: "Conversation not found." },
      { status: 404 }
    );
  }

  if (message === "NOT_A_MEMBER") {
    return NextResponse.json(
      { success: false, error: "You do not have access to this conversation." },
      { status: 403 }
    );
  }

  console.error("SOLO CONNECT MESSAGES:", error);

  return NextResponse.json(
    { success: false, error: "Messaging request could not be completed." },
    { status: 500 }
  );
}

export async function GET(request: Request) {
  try {
    const decoded = await verifyUser(request);

    if (!decoded) {
      return NextResponse.json(
        { success: false, error: "Sign in required." },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const mode = clean(url.searchParams.get("mode"), 40);

    if (mode === "members") {
      const q = clean(url.searchParams.get("q"), 100).toLowerCase();

      const snapshot = await adminDb
        .collection("soloConnectProfiles")
        .limit(100)
        .get();

      const members = snapshot.docs
        .map(document => {
          const data = document.data() || {};

          return {
            uid: document.id,
            username: clean(data.username, 24),
            displayName: clean(data.displayName, 100),
            photoURL: clean(data.photoURL, 4000),
          };
        })
        .filter(member => member.uid !== decoded.uid)
        .filter(member => {
          if (!q) return true;

          return (
            member.username.toLowerCase().includes(q) ||
            member.displayName.toLowerCase().includes(q)
          );
        })
        .slice(0, 30);

      return NextResponse.json({
        success: true,
        members,
      });
    }

    if (mode === "messages") {
      const conversationId = clean(
        url.searchParams.get("conversationId"),
        180
      );

      if (!conversationId) {
        return NextResponse.json(
          { success: false, error: "Conversation not found." },
          { status: 400 }
        );
      }

      const conversation = await requireConversation(
        conversationId,
        decoded.uid
      );

      const snapshot = await adminDb
        .collection("soloConnectMessages")
        .where("conversationId", "==", conversationId)
        .limit(150)
        .get();

      const messages = snapshot.docs
        .map(document => {
          const data = document.data() || {};

          return {
            id: document.id,
            conversationId,
            senderUid: clean(data.senderUid, 128),
            username: clean(data.username, 24),
            displayName: clean(data.displayName, 100),
            photoURL: clean(data.photoURL, 4000),
            text: clean(data.text, 3000),
            deleted: data.deleted === true,
            createdAt: toIso(data.createdAt),
            editedAt: toIso(data.editedAt),
          };
        })
        .sort((a, b) =>
          String(a.createdAt || "").localeCompare(
            String(b.createdAt || "")
          )
        );

      const unreadCounts = {
        ...(conversation.data.unreadCounts || {}),
        [decoded.uid]: 0,
      };

      await conversation.ref.update({
        unreadCounts,
      });

      return NextResponse.json({
        success: true,
        messages,
      });
    }

    const snapshot = await adminDb
      .collection("soloConnectConversations")
      .where("memberUids", "array-contains", decoded.uid)
      .limit(100)
      .get();

    const conversations = await Promise.all(
      snapshot.docs.map(async document => {
        const data = document.data() || {};
        const memberUids = Array.isArray(data.memberUids)
          ? data.memberUids.filter(
              (value): value is string => typeof value === "string"
            )
          : [];

        const profiles = (
          await Promise.all(memberUids.map(uid => getProfile(uid)))
        ).filter(Boolean);

        const type = data.type === "group" ? "group" : "dm";
        const otherProfiles = profiles.filter(
          profile => profile?.uid !== decoded.uid
        );

        const displayTitle =
          type === "group"
            ? clean(data.title, 100) || "Group Chat"
            : otherProfiles[0]?.displayName ||
              otherProfiles[0]?.username ||
              "Conversation";

        return {
          id: document.id,
          type,
          title: displayTitle,
          createdBy: clean(data.createdBy, 128),
          memberUids,
          members: profiles,
          lastMessageText: clean(data.lastMessageText, 300),
          lastMessageAt: toIso(data.lastMessageAt),
          updatedAt: toIso(data.updatedAt),
          unreadCount: Math.max(
            0,
            Number(data.unreadCounts?.[decoded.uid] || 0)
          ),
        };
      })
    );

    conversations.sort((a, b) =>
      String(b.updatedAt || "").localeCompare(
        String(a.updatedAt || "")
      )
    );

    return NextResponse.json({
      success: true,
      conversations,
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const decoded = await verifyUser(request);

    if (!decoded) {
      return NextResponse.json(
        { success: false, error: "Sign in required." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const action = clean(body?.action, 40);

    if (action === "start_dm") {
      const targetUid = clean(body?.targetUid, 128);

      if (!targetUid || targetUid === decoded.uid) {
        return NextResponse.json(
          { success: false, error: "Choose another SOLO CONNECT member." },
          { status: 400 }
        );
      }

      const [mine, target] = await Promise.all([
        getProfile(decoded.uid),
        getProfile(targetUid),
      ]);

      if (!mine || !target) {
        return NextResponse.json(
          { success: false, error: "SOLO CONNECT profile not found." },
          { status: 404 }
        );
      }

      const memberUids = [decoded.uid, targetUid].sort();
      const conversationId = `dm_${memberUids.join("_")}`;
      const ref = adminDb
        .collection("soloConnectConversations")
        .doc(conversationId);

      const snapshot = await ref.get();

      if (!snapshot.exists) {
        await ref.set({
          type: "dm",
          title: "",
          memberUids,
          createdBy: decoded.uid,
          unreadCounts: {
            [memberUids[0]]: 0,
            [memberUids[1]]: 0,
          },
          lastMessageText: "",
          lastMessageAt: null,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }

      return NextResponse.json({
        success: true,
        conversationId,
      });
    }

    if (action === "create_group") {
      const title = clean(body?.title, 100) || "Group Chat";
      const rawUids = Array.isArray(body?.memberUids)
        ? body.memberUids
        : [];

      const selected: string[] = Array.from(
        new Set<string>(
          rawUids
            .filter((value: unknown): value is string => typeof value === "string")
            .map((value: string) => value.trim())
            .filter(Boolean)
            .filter((value: string) => value !== decoded.uid)
        )
      ).slice(0, 30);

      if (selected.length < 2) {
        return NextResponse.json(
          {
            success: false,
            error: "Choose at least 2 other members for a group chat.",
          },
          { status: 400 }
        );
      }

      const profiles = await Promise.all(
        [decoded.uid, ...selected].map(uid => getProfile(uid))
      );

      if (profiles.some(profile => !profile)) {
        return NextResponse.json(
          { success: false, error: "One or more members could not be found." },
          { status: 404 }
        );
      }

      const memberUids = [decoded.uid, ...selected];
      const unreadCounts = Object.fromEntries(
        memberUids.map(uid => [uid, 0])
      );

      const ref = adminDb
        .collection("soloConnectConversations")
        .doc();

      await ref.set({
        type: "group",
        title,
        memberUids,
        createdBy: decoded.uid,
        unreadCounts,
        lastMessageText: "",
        lastMessageAt: null,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      return NextResponse.json({
        success: true,
        conversationId: ref.id,
      });
    }

    if (action === "send") {
      const conversationId = clean(body?.conversationId, 180);
      const text = clean(body?.text, 3000);

      if (!conversationId || !text) {
        return NextResponse.json(
          { success: false, error: "Write a message first." },
          { status: 400 }
        );
      }

      const [conversation, profile] = await Promise.all([
        requireConversation(conversationId, decoded.uid),
        getProfile(decoded.uid),
      ]);

      if (!profile) {
        return NextResponse.json(
          { success: false, error: "Create your SOLO CONNECT profile first." },
          { status: 400 }
        );
      }

      const messageRef = adminDb
        .collection("soloConnectMessages")
        .doc();

      const unreadCounts = {
        ...(conversation.data.unreadCounts || {}),
      };

      conversation.memberUids.forEach(uid => {
        unreadCounts[uid] =
          uid === decoded.uid
            ? 0
            : Math.max(0, Number(unreadCounts[uid] || 0)) + 1;
      });

      const batch = adminDb.batch();

      batch.set(messageRef, {
        conversationId,
        senderUid: decoded.uid,
        username: profile.username,
        displayName: profile.displayName,
        photoURL: profile.photoURL,
        text,
        deleted: false,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      batch.update(conversation.ref, {
        lastMessageId: messageRef.id,
        lastMessageText: text.slice(0, 300),
        lastMessageAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        unreadCounts,
      });

      await batch.commit();

      const senderName =
        profile.displayName ||
        profile.username ||
        "A SOLO CONNECT member";

      const conversationTitle =
        conversation.data.type === "group"
          ? clean(conversation.data.title, 100) ||
            "Group Chat"
          : "";

      await Promise.all(
        conversation.memberUids
          .filter(uid => uid !== decoded.uid)
          .map(recipientUid =>
            createConnectNotification({
              recipientUid,
              actorUid: decoded.uid,
              type: "message",
              title:
                conversation.data.type === "group"
                  ? `New message in ${conversationTitle}`
                  : "New private message",
              message: `${senderName}: ${text.slice(0, 180)}`,
              targetUrl:
                `/connect/messages?conversation=${encodeURIComponent(
                  conversationId
                )}`,
              relatedId: conversationId,
            })
          )
      );

      return NextResponse.json({
        success: true,
        messageId: messageRef.id,
      });
    }

    if (action === "mark_read") {
      const conversationId = clean(body?.conversationId, 180);

      const conversation = await requireConversation(
        conversationId,
        decoded.uid
      );

      await conversation.ref.update({
        unreadCounts: {
          ...(conversation.data.unreadCounts || {}),
          [decoded.uid]: 0,
        },
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { success: false, error: "Unsupported messaging action." },
      { status: 400 }
    );
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const decoded = await verifyUser(request);

    if (!decoded) {
      return NextResponse.json(
        { success: false, error: "Sign in required." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const action = clean(body?.action, 40);

    if (action === "rename_group") {
      const conversationId = clean(body?.conversationId, 180);
      const title = clean(body?.title, 100);

      if (!conversationId || !title) {
        return NextResponse.json(
          { success: false, error: "Enter a group name." },
          { status: 400 }
        );
      }

      const conversation = await requireConversation(
        conversationId,
        decoded.uid
      );

      if (
        conversation.data.type !== "group" ||
        clean(conversation.data.createdBy, 128) !== decoded.uid
      ) {
        return NextResponse.json(
          { success: false, error: "Only the group creator can rename this chat." },
          { status: 403 }
        );
      }

      await conversation.ref.update({
        title,
        updatedAt: FieldValue.serverTimestamp(),
      });

      return NextResponse.json({ success: true });
    }

    const messageId = clean(body?.messageId, 180);
    const text = clean(body?.text, 3000);

    if (!messageId || !text) {
      return NextResponse.json(
        { success: false, error: "Message cannot be empty." },
        { status: 400 }
      );
    }

    const messageRef = adminDb
      .collection("soloConnectMessages")
      .doc(messageId);

    const messageSnapshot = await messageRef.get();

    if (!messageSnapshot.exists) {
      return NextResponse.json(
        { success: false, error: "Message not found." },
        { status: 404 }
      );
    }

    const message = messageSnapshot.data() || {};

    if (clean(message.senderUid, 128) !== decoded.uid) {
      return NextResponse.json(
        { success: false, error: "You can only edit your own messages." },
        { status: 403 }
      );
    }

    if (message.deleted === true) {
      return NextResponse.json(
        { success: false, error: "Deleted messages cannot be edited." },
        { status: 400 }
      );
    }

    const conversationId = clean(message.conversationId, 180);
    const conversation = await requireConversation(
      conversationId,
      decoded.uid
    );

    await messageRef.update({
      text,
      editedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    if (clean(conversation.data.lastMessageId, 180) === messageId) {
      await conversation.ref.update({
        lastMessageText: text.slice(0, 300),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const decoded = await verifyUser(request);

    if (!decoded) {
      return NextResponse.json(
        { success: false, error: "Sign in required." },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const messageId = clean(url.searchParams.get("messageId"), 180);

    if (!messageId) {
      return NextResponse.json(
        { success: false, error: "Message not found." },
        { status: 400 }
      );
    }

    const messageRef = adminDb
      .collection("soloConnectMessages")
      .doc(messageId);

    const snapshot = await messageRef.get();

    if (!snapshot.exists) {
      return NextResponse.json(
        { success: false, error: "Message not found." },
        { status: 404 }
      );
    }

    const message = snapshot.data() || {};

    if (clean(message.senderUid, 128) !== decoded.uid) {
      return NextResponse.json(
        { success: false, error: "You can only delete your own messages." },
        { status: 403 }
      );
    }

    const conversationId = clean(message.conversationId, 180);
    const conversation = await requireConversation(
      conversationId,
      decoded.uid
    );

    await messageRef.update({
      text: "",
      deleted: true,
      editedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    if (clean(conversation.data.lastMessageId, 180) === messageId) {
      await conversation.ref.update({
        lastMessageText: "Message deleted",
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return apiError(error);
  }
}