import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";

import {
  adminBucket,
  adminDb,
  firebaseAdminApp,
} from "../../../../lib/firebaseAdmin";

export const dynamic = "force-dynamic";

function getBearerToken(request: Request) {
  const header = request.headers.get("authorization") || "";
  return header.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || null;
}

function clean(value: unknown, max = 5000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
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

async function verifyUser(request: Request) {
  const token = getBearerToken(request);
  if (!token) return null;
  try {
    return await getAuth(firebaseAdminApp).verifyIdToken(token);
  } catch {
    return null;
  }
}

async function deleteStorageObject(path: string) {
  if (!path || !path.startsWith("solo-connect/")) return;
  try {
    await adminBucket.file(path).delete({ ignoreNotFound: true });
  } catch (error) {
    console.error("SOLO CONNECT MEDIA DELETE:", error);
  }
}

function normalizeMediaType(value: unknown) {
  const type = clean(value, 20);
  return ["image", "audio", "video"].includes(type) ? type : "";
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const username = clean(url.searchParams.get("username"), 24).toLowerCase();

    let authorUid = "";

    if (username) {
      const usernameDoc = await adminDb
        .collection("soloConnectUsernames")
        .doc(username)
        .get();

      if (!usernameDoc.exists) {
        return NextResponse.json({ success: true, posts: [] });
      }

      authorUid = clean(usernameDoc.data()?.uid, 128);
    }

    let snapshot: FirebaseFirestore.QuerySnapshot;

    if (authorUid) {
      snapshot = await adminDb
        .collection("soloConnectPosts")
        .where("authorUid", "==", authorUid)
        .limit(100)
        .get();
    } else {
      snapshot = await adminDb
        .collection("soloConnectPosts")
        .orderBy("createdAt", "desc")
        .limit(50)
        .get();
    }

    let posts = snapshot.docs.map(document => {
      const data = document.data();

      return {
        id: document.id,
        authorUid: clean(data.authorUid, 128),
        username: clean(data.username, 24),
        displayName: clean(data.displayName, 100),
        photoURL: clean(data.photoURL, 2000),
        text: clean(data.text, 3000),
        mediaURL: clean(data.mediaURL, 4000),
        mediaPath: clean(data.mediaPath, 1000),
        mediaType: normalizeMediaType(data.mediaType),
        mediaName: clean(data.mediaName, 255),
        likeCount: Math.max(0, Number(data.likeCount || 0)),
        commentCount: Math.max(0, Number(data.commentCount || 0)),
        createdAt: toIso(data.createdAt),
        updatedAt: toIso(data.updatedAt),
        liked: false,
      };
    });

    if (authorUid) {
      posts = posts.sort((a, b) =>
        String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
      );
    }

    const viewer = await verifyUser(request);

    if (viewer) {
      const blockedByMeSnapshot = await adminDb
        .collection("soloConnectBlocks")
        .where("blockerUid", "==", viewer.uid)
        .limit(500)
        .get();

      const blockingMeSnapshot = await adminDb
        .collection("soloConnectBlocks")
        .where("blockedUid", "==", viewer.uid)
        .limit(500)
        .get();

      const hiddenUids = new Set<string>();

      blockedByMeSnapshot.docs.forEach(document => {
        const uid = clean(document.data()?.blockedUid, 128);
        if (uid) hiddenUids.add(uid);
      });

      blockingMeSnapshot.docs.forEach(document => {
        const uid = clean(document.data()?.blockerUid, 128);
        if (uid) hiddenUids.add(uid);
      });

      posts = posts.filter(post =>
        !hiddenUids.has(post.authorUid)
      );

      const likeSnapshot = await adminDb
        .collection("soloConnectLikes")
        .where("uid", "==", viewer.uid)
        .limit(500)
        .get();

      const likedPostIds = new Set(
        likeSnapshot.docs
          .map(document => clean(document.data()?.postId, 128))
          .filter(Boolean)
      );

      posts = posts.map(post => ({
        ...post,
        liked: likedPostIds.has(post.id),
      }));
    }

    return NextResponse.json({ success: true, posts });
  } catch (error) {
    console.error("SOLO CONNECT POSTS GET:", error);
    return NextResponse.json(
      { success: false, error: "Posts could not be loaded." },
      { status: 500 }
    );
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

    const profileRef = adminDb.collection("soloConnectProfiles").doc(decoded.uid);
    const profileSnapshot = await profileRef.get();

    if (!profileSnapshot.exists) {
      return NextResponse.json(
        { success: false, error: "Create your SOLO CONNECT profile first." },
        { status: 400 }
      );
    }

    const profile = profileSnapshot.data() || {};
    const body = await request.json();

    const text = clean(body?.text, 3000);
    const mediaURL = clean(body?.mediaURL, 4000);
    const mediaPath = clean(body?.mediaPath, 1000);
    const mediaType = normalizeMediaType(body?.mediaType);
    const mediaName = clean(body?.mediaName, 255);

    if (!text && !mediaURL) {
      return NextResponse.json(
        { success: false, error: "Add text or media before posting." },
        { status: 400 }
      );
    }

    if (mediaURL && !mediaType) {
      return NextResponse.json(
        { success: false, error: "Unsupported media type." },
        { status: 400 }
      );
    }

    if (mediaPath && !mediaPath.startsWith(`solo-connect/${decoded.uid}/`)) {
      return NextResponse.json(
        { success: false, error: "Invalid media path." },
        { status: 400 }
      );
    }

    const postRef = adminDb.collection("soloConnectPosts").doc();
    const batch = adminDb.batch();

    batch.set(postRef, {
      authorUid: decoded.uid,
      username: clean(profile.username, 24),
      displayName: clean(profile.displayName, 100),
      photoURL: clean(profile.photoURL, 2000),
      text,
      mediaURL,
      mediaPath,
      mediaType,
      mediaName,
      likeCount: 0,
      commentCount: 0,
      visibility: "public",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    batch.update(profileRef, {
      postCount: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    });

    await batch.commit();

    return NextResponse.json({
      success: true,
      postId: postRef.id,
    });
  } catch (error) {
    console.error("SOLO CONNECT POST CREATE:", error);
    return NextResponse.json(
      { success: false, error: "Post could not be created." },
      { status: 500 }
    );
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
    const postId = clean(body?.postId, 128);
    const text = clean(body?.text, 3000);
    const mediaURL = clean(body?.mediaURL, 4000);
    const mediaPath = clean(body?.mediaPath, 1000);
    const mediaType = normalizeMediaType(body?.mediaType);
    const mediaName = clean(body?.mediaName, 255);
    const removeMedia = body?.removeMedia === true;

    if (!postId) {
      return NextResponse.json(
        { success: false, error: "Post not found." },
        { status: 400 }
      );
    }

    if (mediaPath && !mediaPath.startsWith(`solo-connect/${decoded.uid}/`)) {
      return NextResponse.json(
        { success: false, error: "Invalid media path." },
        { status: 400 }
      );
    }

    const postRef = adminDb.collection("soloConnectPosts").doc(postId);
    const postSnapshot = await postRef.get();

    if (!postSnapshot.exists) {
      return NextResponse.json(
        { success: false, error: "Post not found." },
        { status: 404 }
      );
    }

    const current = postSnapshot.data() || {};

    if (clean(current.authorUid, 128) !== decoded.uid) {
      return NextResponse.json(
        { success: false, error: "You can only edit your own posts." },
        { status: 403 }
      );
    }

    const nextMediaURL = removeMedia ? "" : mediaURL || clean(current.mediaURL, 4000);
    const nextMediaPath = removeMedia ? "" : mediaPath || clean(current.mediaPath, 1000);
    const nextMediaType = removeMedia ? "" : mediaType || normalizeMediaType(current.mediaType);
    const nextMediaName = removeMedia ? "" : mediaName || clean(current.mediaName, 255);

    if (!text && !nextMediaURL) {
      return NextResponse.json(
        { success: false, error: "A post must contain text or media." },
        { status: 400 }
      );
    }

    await postRef.update({
      text,
      mediaURL: nextMediaURL,
      mediaPath: nextMediaPath,
      mediaType: nextMediaType,
      mediaName: nextMediaName,
      updatedAt: FieldValue.serverTimestamp(),
    });

    const oldPath = clean(current.mediaPath, 1000);
    if (oldPath && (removeMedia || (mediaPath && mediaPath !== oldPath))) {
      await deleteStorageObject(oldPath);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("SOLO CONNECT POST UPDATE:", error);
    return NextResponse.json(
      { success: false, error: "Post could not be updated." },
      { status: 500 }
    );
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
    const postId = clean(url.searchParams.get("postId"), 128);

    if (!postId) {
      return NextResponse.json(
        { success: false, error: "Post not found." },
        { status: 400 }
      );
    }

    const postRef = adminDb.collection("soloConnectPosts").doc(postId);
    const postSnapshot = await postRef.get();

    if (!postSnapshot.exists) {
      return NextResponse.json(
        { success: false, error: "Post not found." },
        { status: 404 }
      );
    }

    const post = postSnapshot.data() || {};

    if (clean(post.authorUid, 128) !== decoded.uid) {
      return NextResponse.json(
        { success: false, error: "You can only delete your own posts." },
        { status: 403 }
      );
    }

    const comments = await adminDb
      .collection("soloConnectComments")
      .where("postId", "==", postId)
      .get();

    const likes = await adminDb
      .collection("soloConnectLikes")
      .where("postId", "==", postId)
      .get();

    const batch = adminDb.batch();

    comments.docs.forEach(document => batch.delete(document.ref));
    likes.docs.forEach(document => batch.delete(document.ref));
    batch.delete(postRef);

    const profileRef = adminDb.collection("soloConnectProfiles").doc(decoded.uid);
    const profileSnapshot = await profileRef.get();

    if (profileSnapshot.exists) {
      const currentCount = Math.max(0, Number(profileSnapshot.data()?.postCount || 0));
      batch.update(profileRef, {
        postCount: Math.max(0, currentCount - 1),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }

    await batch.commit();

    await deleteStorageObject(clean(post.mediaPath, 1000));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("SOLO CONNECT POST DELETE:", error);
    return NextResponse.json(
      { success: false, error: "Post could not be deleted." },
      { status: 500 }
    );
  }
}