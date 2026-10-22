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

function getBearerToken(request: Request) {
  const header =
    request.headers.get("authorization") || "";

  return (
    header.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() ||
    null
  );
}

function clean(value: unknown, max = 1000) {
  return typeof value === "string"
    ? value.trim().slice(0, max)
    : "";
}

async function verifyUser(request: Request) {
  const token = getBearerToken(request);

  if (!token) return null;

  try {
    return await getAuth(
      firebaseAdminApp
    ).verifyIdToken(token);
  } catch {
    return null;
  }
}

async function actorProfile(uid: string) {
  const snapshot = await adminDb
    .collection("soloConnectProfiles")
    .doc(uid)
    .get();

  if (!snapshot.exists) return null;

  const data = snapshot.data() || {};

  return {
    uid,
    username: clean(data.username, 24),
    displayName: clean(
      data.displayName,
      100
    ),
  };
}

function actorName(
  profile:
    | {
        username: string;
        displayName: string;
      }
    | null
) {
  return (
    profile?.displayName ||
    profile?.username ||
    "A SOLO CONNECT member"
  );
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);

    const postId = clean(
      url.searchParams.get("postId"),
      128
    );

    if (postId) {
      const snapshot = await adminDb
        .collection("soloConnectComments")
        .where("postId", "==", postId)
        .limit(100)
        .get();

      const comments = snapshot.docs
        .map(document => {
          const data = document.data();

          const createdAt =
            data.createdAt?.toDate
              ? data.createdAt
                  .toDate()
                  .toISOString()
              : null;

          return {
            id: document.id,
            uid: clean(data.uid, 128),
            username: clean(
              data.username,
              24
            ),
            displayName: clean(
              data.displayName,
              100
            ),
            text: clean(data.text, 1000),
            createdAt,
          };
        })
        .sort((a, b) =>
          String(
            a.createdAt || ""
          ).localeCompare(
            String(b.createdAt || "")
          )
        );

      return NextResponse.json({
        success: true,
        comments,
      });
    }

    const followerUid = clean(
      url.searchParams.get("followerUid"),
      128
    );

    const followingUid = clean(
      url.searchParams.get("followingUid"),
      128
    );

    if (followerUid && followingUid) {
      const snapshot = await adminDb
        .collection("soloConnectFollows")
        .doc(
          `${followerUid}_${followingUid}`
        )
        .get();

      return NextResponse.json({
        success: true,
        following: snapshot.exists,
      });
    }

    return NextResponse.json({
      success: true,
      comments: [],
      following: false,
    });
  } catch (error) {
    console.error(
      "SOLO CONNECT SOCIAL GET:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "SOLO CONNECT data could not be loaded.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const decoded =
      await verifyUser(request);

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

    const action = clean(
      body?.action,
      40
    );

    if (
      action === "like" ||
      action === "unlike"
    ) {
      const postId = clean(
        body?.postId,
        128
      );

      if (!postId) {
        return NextResponse.json(
          {
            success: false,
            error: "Post not found.",
          },
          { status: 400 }
        );
      }

      const likeRef = adminDb
        .collection("soloConnectLikes")
        .doc(
          `${postId}_${decoded.uid}`
        );

      const postRef = adminDb
        .collection("soloConnectPosts")
        .doc(postId);

      const changed =
        await adminDb.runTransaction(
          async transaction => {
            const likeSnapshot =
              await transaction.get(
                likeRef
              );

            const postSnapshot =
              await transaction.get(
                postRef
              );

            if (!postSnapshot.exists) {
              throw new Error(
                "POST_NOT_FOUND"
              );
            }

            if (
              action === "like" &&
              !likeSnapshot.exists
            ) {
              transaction.set(
                likeRef,
                {
                  postId,
                  uid: decoded.uid,
                  createdAt:
                    FieldValue.serverTimestamp(),
                }
              );

              transaction.update(
                postRef,
                {
                  likeCount:
                    FieldValue.increment(1),
                }
              );

              return true;
            }

            if (
              action === "unlike" &&
              likeSnapshot.exists
            ) {
              transaction.delete(
                likeRef
              );

              const count = Math.max(
                0,
                Number(
                  postSnapshot.data()
                    ?.likeCount || 0
                )
              );

              transaction.update(
                postRef,
                {
                  likeCount:
                    Math.max(
                      0,
                      count - 1
                    ),
                }
              );

              return true;
            }

            return false;
          }
        );

      if (
        action === "like" &&
        changed
      ) {
        const [
          postSnapshot,
          actor,
        ] = await Promise.all([
          postRef.get(),
          actorProfile(decoded.uid),
        ]);

        const authorUid = clean(
          postSnapshot.data()?.authorUid,
          128
        );

        await createConnectNotification({
          recipientUid: authorUid,
          actorUid: decoded.uid,
          type: "like",
          title: "New like",
          message: `${actorName(
            actor
          )} liked your post.`,
          targetUrl: "/connect",
          relatedId: postId,
        });
      }

      return NextResponse.json({
        success: true,
      });
    }

    if (action === "comment") {
      const postId = clean(
        body?.postId,
        128
      );

      const text = clean(
        body?.text,
        1000
      );

      if (!postId || !text) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Comment cannot be empty.",
          },
          { status: 400 }
        );
      }

      const profileSnapshot =
        await adminDb
          .collection(
            "soloConnectProfiles"
          )
          .doc(decoded.uid)
          .get();

      if (!profileSnapshot.exists) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Create your SOLO CONNECT profile first.",
          },
          { status: 400 }
        );
      }

      const postRef = adminDb
        .collection("soloConnectPosts")
        .doc(postId);

      const postSnapshot =
        await postRef.get();

      if (!postSnapshot.exists) {
        return NextResponse.json(
          {
            success: false,
            error: "Post not found.",
          },
          { status: 404 }
        );
      }

      const profile =
        profileSnapshot.data() || {};

      const commentRef = adminDb
        .collection(
          "soloConnectComments"
        )
        .doc();

      const batch =
        adminDb.batch();

      batch.set(
        commentRef,
        {
          postId,
          uid: decoded.uid,
          username: clean(
            profile.username,
            24
          ),
          displayName: clean(
            profile.displayName,
            100
          ),
          text,
          createdAt:
            FieldValue.serverTimestamp(),
          updatedAt:
            FieldValue.serverTimestamp(),
        }
      );

      batch.update(
        postRef,
        {
          commentCount:
            FieldValue.increment(1),
        }
      );

      await batch.commit();

      const authorUid = clean(
        postSnapshot.data()?.authorUid,
        128
      );

      const name =
        clean(
          profile.displayName,
          100
        ) ||
        clean(
          profile.username,
          24
        ) ||
        "A SOLO CONNECT member";

      await createConnectNotification({
        recipientUid: authorUid,
        actorUid: decoded.uid,
        type: "comment",
        title: "New comment",
        message: `${name} commented on your post.`,
        targetUrl: "/connect",
        relatedId: postId,
      });

      return NextResponse.json({
        success: true,
      });
    }

    if (
      action === "follow" ||
      action === "unfollow"
    ) {
      const targetUid = clean(
        body?.targetUid,
        128
      );

      if (
        !targetUid ||
        targetUid === decoded.uid
      ) {
        return NextResponse.json(
          {
            success: false,
            error: "Invalid member.",
          },
          { status: 400 }
        );
      }

      const viewerRef = adminDb
        .collection(
          "soloConnectProfiles"
        )
        .doc(decoded.uid);

      const targetRef = adminDb
        .collection(
          "soloConnectProfiles"
        )
        .doc(targetUid);

      const followRef = adminDb
        .collection(
          "soloConnectFollows"
        )
        .doc(
          `${decoded.uid}_${targetUid}`
        );

      const changed =
        await adminDb.runTransaction(
          async transaction => {
            const viewerSnapshot =
              await transaction.get(
                viewerRef
              );

            const targetSnapshot =
              await transaction.get(
                targetRef
              );

            const followSnapshot =
              await transaction.get(
                followRef
              );

            if (
              !viewerSnapshot.exists ||
              !targetSnapshot.exists
            ) {
              throw new Error(
                "PROFILE_NOT_FOUND"
              );
            }

            if (
              action === "follow" &&
              !followSnapshot.exists
            ) {
              transaction.set(
                followRef,
                {
                  followerUid:
                    decoded.uid,
                  followingUid:
                    targetUid,
                  createdAt:
                    FieldValue.serverTimestamp(),
                }
              );

              transaction.update(
                viewerRef,
                {
                  followingCount:
                    FieldValue.increment(
                      1
                    ),
                }
              );

              transaction.update(
                targetRef,
                {
                  followerCount:
                    FieldValue.increment(
                      1
                    ),
                }
              );

              return true;
            }

            if (
              action === "unfollow" &&
              followSnapshot.exists
            ) {
              const viewerCount =
                Math.max(
                  0,
                  Number(
                    viewerSnapshot.data()
                      ?.followingCount ||
                      0
                  )
                );

              const targetCount =
                Math.max(
                  0,
                  Number(
                    targetSnapshot.data()
                      ?.followerCount || 0
                  )
                );

              transaction.delete(
                followRef
              );

              transaction.update(
                viewerRef,
                {
                  followingCount:
                    Math.max(
                      0,
                      viewerCount - 1
                    ),
                }
              );

              transaction.update(
                targetRef,
                {
                  followerCount:
                    Math.max(
                      0,
                      targetCount - 1
                    ),
                }
              );

              return true;
            }

            return false;
          }
        );

      if (
        action === "follow" &&
        changed
      ) {
        const actor =
          await actorProfile(
            decoded.uid
          );

        const username =
          actor?.username || "";

        await createConnectNotification({
          recipientUid: targetUid,
          actorUid: decoded.uid,
          type: "follow",
          title: "New follower",
          message: `${actorName(
            actor
          )} started following you.`,
          targetUrl: username
            ? `/connect/profile/${username}`
            : "/connect",
          relatedId: decoded.uid,
        });
      }

      return NextResponse.json({
        success: true,
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: "Unsupported action.",
      },
      { status: 400 }
    );
  } catch (error) {
    console.error(
      "SOLO CONNECT SOCIAL POST:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Action could not be completed.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const decoded =
      await verifyUser(request);

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

    const commentId = clean(
      body?.commentId,
      128
    );

    const text = clean(
      body?.text,
      1000
    );

    if (!commentId || !text) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Comment cannot be empty.",
        },
        { status: 400 }
      );
    }

    const commentRef = adminDb
      .collection(
        "soloConnectComments"
      )
      .doc(commentId);

    const snapshot =
      await commentRef.get();

    if (!snapshot.exists) {
      return NextResponse.json(
        {
          success: false,
          error: "Comment not found.",
        },
        { status: 404 }
      );
    }

    if (
      clean(
        snapshot.data()?.uid,
        128
      ) !== decoded.uid
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "You can only edit your own comments.",
        },
        { status: 403 }
      );
    }

    await commentRef.update({
      text,
      updatedAt:
        FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error(
      "SOLO CONNECT COMMENT UPDATE:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Comment could not be updated.",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const decoded =
      await verifyUser(request);

    if (!decoded) {
      return NextResponse.json(
        {
          success: false,
          error: "Sign in required.",
        },
        { status: 401 }
      );
    }

    const url = new URL(request.url);

    const commentId = clean(
      url.searchParams.get(
        "commentId"
      ),
      128
    );

    if (!commentId) {
      return NextResponse.json(
        {
          success: false,
          error: "Comment not found.",
        },
        { status: 400 }
      );
    }

    const commentRef = adminDb
      .collection(
        "soloConnectComments"
      )
      .doc(commentId);

    const snapshot =
      await commentRef.get();

    if (!snapshot.exists) {
      return NextResponse.json(
        {
          success: false,
          error: "Comment not found.",
        },
        { status: 404 }
      );
    }

    const comment =
      snapshot.data() || {};

    if (
      clean(
        comment.uid,
        128
      ) !== decoded.uid
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "You can only delete your own comments.",
        },
        { status: 403 }
      );
    }

    const postId = clean(
      comment.postId,
      128
    );

    const postRef = adminDb
      .collection("soloConnectPosts")
      .doc(postId);

    const postSnapshot =
      await postRef.get();

    const batch =
      adminDb.batch();

    batch.delete(commentRef);

    if (postSnapshot.exists) {
      const count = Math.max(
        0,
        Number(
          postSnapshot.data()
            ?.commentCount || 0
        )
      );

      batch.update(
        postRef,
        {
          commentCount:
            Math.max(
              0,
              count - 1
            ),
        }
      );
    }

    await batch.commit();

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error(
      "SOLO CONNECT COMMENT DELETE:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Comment could not be deleted.",
      },
      { status: 500 }
    );
  }
}