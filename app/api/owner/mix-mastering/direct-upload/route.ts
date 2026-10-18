import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import crypto from "crypto";

import {
  adminBucket,
  adminDb,
  firebaseAdminApp,
} from "../../../../../lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const OWNER_EMAIL = "supe4.me@gmail.com";

function getBearerToken(request: Request) {
  const header =
    request.headers.get("authorization") || "";

  return (
    header.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() ||
    null
  );
}

async function verifyOwner(request: Request) {
  const token = getBearerToken(request);

  if (!token) {
    throw new Error("OWNER_AUTH_REQUIRED");
  }

  const decoded =
    await getAuth(
      firebaseAdminApp
    ).verifyIdToken(token);

  const email =
    decoded.email?.trim().toLowerCase() || "";

  if (
    email !==
    OWNER_EMAIL.toLowerCase()
  ) {
    throw new Error("OWNER_ONLY");
  }

  return decoded;
}

function safeName(value: string) {
  return (
    value
      .replace(/[^\w\- .()]/g, "_")
      .replace(/\s+/g, " ")
      .trim() || "audio"
  );
}

export async function POST(request: Request) {
  try {
    const owner =
      await verifyOwner(request);

    const form =
      await request.formData();

    const serviceType =
      String(
        form.get("serviceType") || ""
      ).trim();

    if (
      serviceType !== "MASTER_ONLY" &&
      serviceType !== "MIX_MASTER"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "INVALID_SERVICE_TYPE",
        },
        {
          status: 400,
        }
      );
    }

    const songTitle =
      String(
        form.get("songTitle") || ""
      ).trim();

    const artistName =
      String(
        form.get("artistName") || "Solo Beats"
      ).trim();

    const genre =
      String(
        form.get("genre") || ""
      ).trim();

    const notes =
      String(
        form.get("notes") || ""
      ).trim();

    const files =
      form
        .getAll("files")
        .filter(
          value =>
            value instanceof File
        ) as File[];

    if (
      serviceType === "MASTER_ONLY" &&
      files.length !== 1
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "MASTER_ONLY_REQUIRES_ONE_STEREO_FILE",
        },
        {
          status: 400,
        }
      );
    }

    if (
      serviceType === "MIX_MASTER" &&
      (
        files.length < 1 ||
        files.length > 20
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "MIX_MASTER_REQUIRES_1_TO_20_STEMS",
        },
        {
          status: 400,
        }
      );
    }

    const orderId =
      `OWNER-${crypto
        .randomUUID()
        .replace(/-/g, "")
        .slice(0, 16)
        .toUpperCase()}`;

    const uid =
      String(
        owner.uid || "owner"
      );

    const createdAt =
      new Date().toISOString();

    const stems = [];

    for (
      let index = 0;
      index < files.length;
      index += 1
    ) {
      const file =
        files[index];

      const originalName =
        safeName(
          file.name ||
            `audio-${index + 1}`
        );

      const extension =
        originalName.includes(".")
          ? originalName
              .split(".")
              .pop()
              ?.toLowerCase() || "bin"
          : "bin";

      const storagePath =
        `mix-mastering/${uid}/${orderId}/uploads/${String(
          index + 1
        ).padStart(
          2,
          "0"
        )}-${crypto
          .randomUUID()
          .slice(
            0,
            8
          )}.${extension}`;

      const bytes =
        Buffer.from(
          await file.arrayBuffer()
        );

      await adminBucket
        .file(storagePath)
        .save(bytes, {
          resumable: false,

          metadata: {
            contentType:
              file.type ||
              "application/octet-stream",

            metadata: {
              originalName,
              ownerDirect:
                "true",
              orderId,
            },
          },
        });

      stems.push({
        name: originalName,
        originalName,
        storagePath,
        sizeBytes:
          bytes.length,
        contentType:
          file.type ||
          "application/octet-stream",
        type:
          serviceType ===
          "MASTER_ONLY"
            ? "STEREO_MASTER_SOURCE"
            : "STEM",
      });
    }

    const orderRef =
      adminDb
        .collection(
          "mixMasteringOrders"
        )
        .doc(orderId);

    await orderRef.set({
      orderId,

      uid,

      userEmail:
        OWNER_EMAIL,

      songTitle:
        songTitle ||
        (
          serviceType ===
          "MASTER_ONLY"
            ? "Owner Master"
            : "Owner Mix & Master"
        ),

      artistName:
        artistName ||
        "Solo Beats",

      genre,

      notes,

      serviceType,

      orderType:
        serviceType,

      stemCount:
        stems.length,

      stems,

      uploadComplete:
        true,

      ownerDirect:
        true,

      source:
        "OWNER_DIRECT",

      status:
        "WAITING_FOR_PROCESSING",

      processingStatus:
        "WAITING_FOR_PROCESSING",

      createdAt,

      submittedAt:
        createdAt,

      updatedAt:
        createdAt,
    });

    return NextResponse.json({
      success: true,
      orderId,
      serviceType,
      stemCount:
        stems.length,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : String(error);

    console.error(
      "OWNER DIRECT MIX MASTER UPLOAD ERROR:",
      error
    );

    const authError =
      message === "OWNER_ONLY" ||
      message === "OWNER_AUTH_REQUIRED";

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      {
        status:
          authError
            ? 403
            : 500,
      }
    );
  }
}
