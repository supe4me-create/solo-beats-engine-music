import { NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { getAuth } from "firebase-admin/auth";

import {
  firebaseAdminApp,
} from "../../../../lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OWNER_EMAIL = "supe4.me@gmail.com";

function getBearerToken(
  request: Request
) {
  const header =
    request.headers.get(
      "authorization"
    ) || "";

  return (
    header.match(
      /^Bearer\s+(.+)$/i
    )?.[1]?.trim() || null
  );
}

async function verifyOwner(
  request: Request
) {
  const token =
    getBearerToken(request);

  if (!token) {
    throw new Error(
      "OWNER_AUTH_REQUIRED"
    );
  }

  const decoded =
    await getAuth(
      firebaseAdminApp
    ).verifyIdToken(token);

  const email =
    decoded.email
      ?.trim()
      .toLowerCase() || "";

  if (
    email !== OWNER_EMAIL.toLowerCase()
  ) {
    throw new Error("OWNER_ONLY");
  }
}

function allowedBlobUrl(
  value: string
) {
  try {
    const url = new URL(value);

    return (
      url.protocol === "https:" &&
      url.hostname.endsWith(
        ".blob.vercel-storage.com"
      )
    );
  } catch {
    return false;
  }
}

export async function POST(
  request: Request
) {
  try {
    await verifyOwner(request);

    const body =
      await request.json();

    const urls =
      Array.isArray(body?.urls)
        ? body.urls
            .map((value: unknown) =>
              String(value || "")
            )
            .filter(allowedBlobUrl)
            .slice(0, 20)
        : [];

    if (urls.length) {
      await del(urls);
    }

    return NextResponse.json({
      ok: true,
      deleted: urls.length,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : String(error);

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      {
        status:
          message === "OWNER_ONLY" ||
          message ===
            "OWNER_AUTH_REQUIRED"
            ? 403
            : 500,
      }
    );
  }
}
