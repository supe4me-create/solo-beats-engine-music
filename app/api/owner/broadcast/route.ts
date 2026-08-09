import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";

import {
  adminDb,
  firebaseAdminApp,
} from "../../../../lib/firebaseAdmin";

const OWNER_EMAIL = "supe4.me@gmail.com";

function bearer(request: Request) {
  const value = request.headers.get("authorization") || "";
  return value.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || null;
}

async function verifyOwner(request: Request) {
  const token = bearer(request);

  if (!token) {
    throw new Error("OWNER_AUTH_REQUIRED");
  }

  const decoded = await getAuth(firebaseAdminApp).verifyIdToken(token);

  if (decoded.email?.toLowerCase() !== OWNER_EMAIL) {
    throw new Error("OWNER_ACCESS_ONLY");
  }

  return decoded;
}

function authError(error: unknown) {
  const message = error instanceof Error ? error.message : "";

  if (message === "OWNER_AUTH_REQUIRED") {
    return NextResponse.json(
      { success: false, error: "Owner sign-in is required." },
      { status: 401 }
    );
  }

  if (message === "OWNER_ACCESS_ONLY") {
    return NextResponse.json(
      { success: false, error: "Owner access only." },
      { status: 403 }
    );
  }

  return null;
}

async function readStatus() {
  const ref = adminDb.collection("platformSettings").doc("broadcast");
  const snapshot = await ref.get();
  const data = snapshot.exists ? snapshot.data() || {} : {};

  return {
    radioOnAir:
      typeof data.radioOnAir === "boolean"
        ? data.radioOnAir
        : true,
    tvOnAir:
      typeof data.tvOnAir === "boolean"
        ? data.tvOnAir
        : true,
  };
}

export async function GET(request: Request) {
  try {
    await verifyOwner(request);

    const status = await readStatus();

    return NextResponse.json({
      success: true,
      ...status,
    });
  } catch (error) {
    const response = authError(error);
    if (response) return response;

    console.error("Owner broadcast GET error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Broadcast status could not be loaded.",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const decoded = await verifyOwner(request);
    const body = await request.json();

    const updates: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy:
        typeof decoded.email === "string"
          ? decoded.email.toLowerCase()
          : OWNER_EMAIL,
    };

    if (typeof body.radioOnAir === "boolean") {
      updates.radioOnAir = body.radioOnAir;
    }

    if (typeof body.tvOnAir === "boolean") {
      updates.tvOnAir = body.tvOnAir;
    }

    if (
      typeof body.radioOnAir !== "boolean" &&
      typeof body.tvOnAir !== "boolean"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "A Radio or TV broadcast status is required.",
        },
        { status: 400 }
      );
    }

    await adminDb
      .collection("platformSettings")
      .doc("broadcast")
      .set(updates, { merge: true });

    const status = await readStatus();

    return NextResponse.json({
      success: true,
      ...status,
    });
  } catch (error) {
    const response = authError(error);
    if (response) return response;

    console.error("Owner broadcast PATCH error:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Broadcast status could not be updated.",
      },
      { status: 500 }
    );
  }
}

