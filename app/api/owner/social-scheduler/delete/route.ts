import {
  NextResponse,
} from "next/server";

import {
  getAuth,
} from "firebase-admin/auth";

import {
  adminDb,
  firebaseAdminApp,
} from "../../../../../lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OWNER_EMAIL = (
  process.env.OWNER_EMAIL ||
  process.env.NEXT_PUBLIC_OWNER_EMAIL ||
  "supe4.me@gmail.com"
)
  .trim()
  .toLowerCase();

function bearer(
  request: Request
) {
  return (
    request.headers
      .get("authorization")
      ?.match(/^Bearer\s+(.+)$/i)?.[1]
      ?.trim() || null
  );
}

async function verifyOwner(
  request: Request
) {
  const token =
    bearer(request);

  if (!token) {
    throw new Error(
      "OWNER_AUTH_REQUIRED"
    );
  }

  const decoded =
    await getAuth(
      firebaseAdminApp
    ).verifyIdToken(
      token
    );

  const email =
    typeof decoded.email === "string"
      ? decoded.email
          .trim()
          .toLowerCase()
      : "";

  if (
    !email ||
    email !== OWNER_EMAIL
  ) {
    throw new Error(
      "OWNER_ONLY"
    );
  }

  return decoded;
}

export async function DELETE(
  request: Request
) {
  try {
    await verifyOwner(
      request
    );

    const body =
      await request.json();

    const postId =
      typeof body?.postId === "string"
        ? body.postId.trim()
        : "";

    if (!postId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "POST_ID_REQUIRED",
        },
        {
          status: 400,
        }
      );
    }

    const ref =
      adminDb
        .collection(
          "socialPromotionQueue"
        )
        .doc(postId);

    const snapshot =
      await ref.get();

    if (!snapshot.exists) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Promotion not found.",
        },
        {
          status: 404,
        }
      );
    }

    await ref.delete();

    return NextResponse.json({
      success: true,
      postId,
    });

  } catch (error) {

    const message =
      error instanceof Error
        ? error.message
        : "";

    if (
      message ===
        "OWNER_AUTH_REQUIRED" ||
      message ===
        "OWNER_ONLY"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Owner access only.",
        },
        {
          status:
            message ===
            "OWNER_AUTH_REQUIRED"
              ? 401
              : 403,
        }
      );
    }

    console.error(
      "SOCIAL PROMOTION DELETE ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          message ||
          "Promotion could not be deleted.",
      },
      {
        status: 500,
      }
    );
  }
}