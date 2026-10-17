import {
  NextResponse,
} from "next/server";

import {
  getAuth,
} from "firebase-admin/auth";

import {
  firebaseAdminApp,
} from "../../../../../lib/firebaseAdmin";

import {
  runSocialPublisher,
} from "../../../../../lib/socialPublisher";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

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
      ?.trim() ||
    null
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
    email !== OWNER_EMAIL
  ) {
    throw new Error(
      "OWNER_ONLY"
    );
  }
}

export async function POST(
  request: Request
) {
  try {
    await verifyOwner(
      request
    );

    const result =
      await runSocialPublisher();

    return NextResponse.json(
      result
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "";

    if (
      message === "OWNER_AUTH_REQUIRED" ||
      message === "OWNER_ONLY"
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
      "OWNER SOCIAL PUBLISHER ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Publisher failed.",
      },
      {
        status: 500,
      }
    );
  }
}