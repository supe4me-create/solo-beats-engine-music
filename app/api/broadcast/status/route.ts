import { NextResponse } from "next/server";

import { adminDb } from "../../../../lib/firebaseAdmin";

export async function GET() {
  try {
    const snapshot = await adminDb
      .collection("platformSettings")
      .doc("broadcast")
      .get();

    const data = snapshot.exists
      ? snapshot.data() || {}
      : {};

    return NextResponse.json(
      {
        success: true,
        radioOnAir:
          typeof data.radioOnAir === "boolean"
            ? data.radioOnAir
            : true,
        tvOnAir:
          typeof data.tvOnAir === "boolean"
            ? data.tvOnAir
            : true,
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error("Public broadcast status error:", error);

    return NextResponse.json(
      {
        success: false,
        radioOnAir: true,
        tvOnAir: true,
        error: "Broadcast status could not be loaded.",
      },
      { status: 500 }
    );
  }
}
