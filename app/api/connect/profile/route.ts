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

function clean(value: unknown, max = 500) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function validUsername(username: string) {
  return /^[a-z0-9_]{3,24}$/.test(username);
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

function normalizeProfile(document: FirebaseFirestore.DocumentSnapshot) {
  if (!document.exists) return null;

  const data = document.data() || {};

  return {
    uid: document.id,
    username: clean(data.username, 24),
    displayName: clean(data.displayName, 100),
    bio: clean(data.bio, 500),
    photoURL: clean(data.photoURL, 4000),
    photoPath: clean(data.photoPath, 1000),
    followerCount: Math.max(0, Number(data.followerCount || 0)),
    followingCount: Math.max(0, Number(data.followingCount || 0)),
    postCount: Math.max(0, Number(data.postCount || 0)),
  };
}

async function deleteStorageObject(path: string) {
  if (!path || !path.startsWith("solo-connect/")) return;
  try {
    await adminBucket.file(path).delete({ ignoreNotFound: true });
  } catch (error) {
    console.error("SOLO CONNECT PROFILE PHOTO DELETE:", error);
  }
}

async function syncIdentity(
  uid: string,
  username: string,
  displayName: string,
  photoURL: string
) {
  const [posts, comments] = await Promise.all([
    adminDb.collection("soloConnectPosts").where("authorUid", "==", uid).get(),
    adminDb.collection("soloConnectComments").where("uid", "==", uid).get(),
  ]);

  const all = [...posts.docs, ...comments.docs];

  for (let index = 0; index < all.length; index += 400) {
    const batch = adminDb.batch();

    all.slice(index, index + 400).forEach(document => {
      batch.update(document.ref, {
        username,
        displayName,
        ...(document.ref.parent.id === "soloConnectPosts" ? { photoURL } : {}),
      });
    });

    await batch.commit();
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);

    const username = clean(url.searchParams.get("username"), 24).toLowerCase();
    const requestedUid = clean(url.searchParams.get("uid"), 128);

    let profileUid = requestedUid;

    if (username) {
      const usernameSnapshot = await adminDb
        .collection("soloConnectUsernames")
        .doc(username)
        .get();

      if (!usernameSnapshot.exists) {
        return NextResponse.json({
          success: true,
          profile: null,
        });
      }

      profileUid = clean(usernameSnapshot.data()?.uid, 128);
    }

    if (!profileUid) {
      profileUid = (await verifyUser(request))?.uid || "";
    }

    if (!profileUid) {
      return NextResponse.json(
        { success: false, error: "Sign in required." },
        { status: 401 }
      );
    }

    const profileSnapshot = await adminDb
      .collection("soloConnectProfiles")
      .doc(profileUid)
      .get();

    return NextResponse.json({
      success: true,
      profile: normalizeProfile(profileSnapshot),
    });
  } catch (error) {
    console.error("SOLO CONNECT PROFILE GET:", error);
    return NextResponse.json(
      { success: false, error: "Profile could not be loaded." },
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

    const uid = decoded.uid;
    const body = await request.json();

    const username = clean(body?.username, 24).toLowerCase();
    const displayName = clean(body?.displayName, 100);
    const bio = clean(body?.bio, 500);
    const suppliedPhotoURL = clean(body?.photoURL, 4000);
    const suppliedPhotoPath = clean(body?.photoPath, 1000);
    const removePhoto = body?.removePhoto === true;

    if (!validUsername(username)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Username must be 3-24 characters using lowercase letters, numbers, or underscore.",
        },
        { status: 400 }
      );
    }

    if (
      suppliedPhotoPath &&
      !suppliedPhotoPath.startsWith(`solo-connect/${uid}/profile/`)
    ) {
      return NextResponse.json(
        { success: false, error: "Invalid profile photo path." },
        { status: 400 }
      );
    }

    const profileRef = adminDb.collection("soloConnectProfiles").doc(uid);
    const currentProfile = await profileRef.get();

    const previous = currentProfile.exists ? currentProfile.data() || {} : {};
    const previousUsername = clean(previous.username, 24).toLowerCase();
    const previousPhotoPath = clean(previous.photoPath, 1000);

    const defaultPhoto =
      typeof decoded.picture === "string" ? decoded.picture : "";

    const nextPhotoURL = removePhoto
      ? ""
      : suppliedPhotoURL || clean(previous.photoURL, 4000) || defaultPhoto;

    const nextPhotoPath = removePhoto
      ? ""
      : suppliedPhotoPath || previousPhotoPath;

    const usernameRef = adminDb.collection("soloConnectUsernames").doc(username);

    await adminDb.runTransaction(async transaction => {
      const usernameSnapshot = await transaction.get(usernameRef);

      if (
        usernameSnapshot.exists &&
        usernameSnapshot.data()?.uid !== uid
      ) {
        throw new Error("USERNAME_TAKEN");
      }

      if (previousUsername && previousUsername !== username) {
        transaction.delete(
          adminDb.collection("soloConnectUsernames").doc(previousUsername)
        );
      }

      transaction.set(
        usernameRef,
        {
          uid,
          username,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      transaction.set(
        profileRef,
        {
          uid,
          username,
          displayName: displayName || decoded.name || username,
          bio,
          photoURL: nextPhotoURL,
          photoPath: nextPhotoPath,
          email: typeof decoded.email === "string" ? decoded.email : "",
          followerCount: currentProfile.exists
            ? Number(previous.followerCount || 0)
            : 0,
          followingCount: currentProfile.exists
            ? Number(previous.followingCount || 0)
            : 0,
          postCount: currentProfile.exists ? Number(previous.postCount || 0) : 0,
          createdAt: currentProfile.exists
            ? previous.createdAt || FieldValue.serverTimestamp()
            : FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    });

    await syncIdentity(
      uid,
      username,
      displayName || decoded.name || username,
      nextPhotoURL
    );

    if (
      previousPhotoPath &&
      (removePhoto ||
        (suppliedPhotoPath && suppliedPhotoPath !== previousPhotoPath))
    ) {
      await deleteStorageObject(previousPhotoPath);
    }

    return NextResponse.json({
      success: true,
      username,
    });
  } catch (error) {
    console.error("SOLO CONNECT PROFILE POST:", error);

    if (error instanceof Error && error.message === "USERNAME_TAKEN") {
      return NextResponse.json(
        { success: false, error: "That username is already taken." },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { success: false, error: "Profile could not be saved." },
      { status: 500 }
    );
  }
}