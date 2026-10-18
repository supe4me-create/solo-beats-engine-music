import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";

import {
  adminBucket,
  adminDb,
  firebaseAdminApp,
} from "../../../../../lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OWNER_EMAIL =
  "supe4.me@gmail.com";

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
    email !==
    OWNER_EMAIL.toLowerCase()
  ) {
    throw new Error(
      "OWNER_ONLY"
    );
  }
}

async function signedReadUrl(
  storagePath: unknown
) {
  const value =
    typeof storagePath ===
      "string"
      ? storagePath
      : "";

  if (!value) {
    return "";
  }

  try {
    const file =
      adminBucket.file(
        value
      );

    const [exists] =
      await file.exists();

    if (!exists) {
      return "";
    }

    const [url] =
      await file
        .getSignedUrl({
          action: "read",

          expires:
            Date.now() +
            60 *
              60 *
              1000,
        });

    return url;
  } catch {
    return "";
  }
}


function safeDownloadName(
  value: unknown
) {
  const text =
    typeof value === "string"
      ? value
      : "solo-beats-master";

  const cleaned =
    text
      .replace(/[^\w\- .()]/g, "_")
      .replace(/\s+/g, " ")
      .trim();

  return cleaned || "solo-beats-master";
}

async function signedDownloadUrl(
  storagePath: unknown,
  fileName: string
) {
  const value =
    typeof storagePath === "string"
      ? storagePath
      : "";

  if (!value) {
    return "";
  }

  try {
    const file =
      adminBucket.file(value);

    const [exists] =
      await file.exists();

    if (!exists) {
      return "";
    }

    const cleanName =
      safeDownloadName(fileName)
        .replace(/"/g, "");

    const [url] =
      await file.getSignedUrl({
        version: "v4",
        action: "read",
        expires:
          Date.now() +
          60 * 60 * 1000,
        responseDisposition:
          `attachment; filename="${cleanName}"`,
      });

    return url;
  } catch {
    return "";
  }
}
export async function GET(
  request: Request
) {
  try {
    await verifyOwner(
      request
    );

    const snapshot =
      await adminDb
        .collection(
          "mixMasteringOrders"
        )
        .orderBy(
          "createdAt",
          "desc"
        )
        .limit(50)
        .get();

    const orders =
      await Promise.all(
        snapshot.docs.map(
          async doc => {
            const data =
              doc.data();

            const wavUrl =
              await signedReadUrl(
                data.autoMasterWavPath
              );

            
const mp3Url =
              await signedReadUrl(
                data.autoMasterMp3Path
              );

            const masterName =
              safeDownloadName(
                data.songTitle ||
                "solo-beats-master"
              );

            const wavDownloadUrl =
              await signedDownloadUrl(
                data.autoMasterWavPath,
                `${masterName}-SOLO-BEATS-MASTER.wav`
              );

            const mp3DownloadUrl =
              await signedDownloadUrl(
                data.autoMasterMp3Path,
                `${masterName}-SOLO-BEATS-MASTER.mp3`
              );

            return {
              id:
                doc.id,

              orderId:
                data.orderId ||
                doc.id,

              songTitle:
                data.songTitle ||
                "",

              artistName:
                data.artistName ||
                "",

              genre:
                data.genre ||
                "",

              notes:
                data.notes ||
                "",

              serviceType:
                data.serviceType ||
                data.orderType ||
                "MIX_MASTER",

              stemCount:
                data.stemCount ||
                0,

              userEmail:
                data.userEmail ||
                "",

              status:
                data.status ||
                "",

              processingStatus:
                data.processingStatus ||
                "",

              // SOLO_MM_OWNER_PAYMENT_FIELDS_V1
              paymentStatus:
                data.paymentStatus ||
                "",

              priceUsd:
                Number(
                  data.priceUsd ??
                  data.quotedPriceUsd ??
                  0
                ) || 0,

              currency:
                data.currency ||
                "USD",

              paypalOrderId:
                data.paypalOrderId ||
                "",

              paypalCaptureId:
                data.paypalCaptureId ||
                "",

              paidAt:
                data.paidAt ||
                "",

              ownerDirect:
                data.ownerDirect === true,

              createdAt:
                data.createdAt ||
                "",

              submittedAt:
                data.submittedAt ||
                "",
              wavUrl,

              mp3Url,

              wavDownloadUrl,

              mp3DownloadUrl,

              autoMixMaster:
                data.autoMixMaster ||
                null,
            };
          }
        )
      );

    return NextResponse.json({
      success: true,
      orders,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : String(error);

    return NextResponse.json(
      {
        success: false,
        error:
          message,
      },
      {
        status:
          message ===
            "OWNER_ONLY" ||
          message ===
            "OWNER_AUTH_REQUIRED"
            ? 403
            : 500,
      }
    );
  }
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

    const orderId =
      String(
        body?.orderId || ""
      ).trim();

    if (!orderId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "ORDER_ID_REQUIRED",
        },
        {
          status: 400,
        }
      );
    }

    const orderRef =
      adminDb
        .collection(
          "mixMasteringOrders"
        )
        .doc(orderId);

    const snapshot =
      await orderRef.get();

    if (!snapshot.exists) {
      return NextResponse.json(
        {
          success: false,
          error:
            "ORDER_NOT_FOUND",
        },
        {
          status: 404,
        }
      );
    }

    const order =
      snapshot.data() || {};

    const status =
      String(
        order.processingStatus ||
        order.status ||
        ""
      )
        .trim()
        .toUpperCase();

    const allowedStatuses =
      new Set([
        "AUTO_COMPLETE",
        "COMPLETE",
        "COMPLETED",
        "DELIVERED",
      ]);

    if (
      !allowedStatuses.has(
        status
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "ONLY_COMPLETED_ORDERS_CAN_BE_DELETED",
        },
        {
          status: 409,
        }
      );
    }

    const storagePaths =
      new Set<string>();

    const stems =
      Array.isArray(
        order.stems
      )
        ? order.stems
        : [];

    for (
      const stem of stems
    ) {
      const storagePath =
        typeof stem?.storagePath ===
          "string"
          ? stem.storagePath.trim()
          : "";

      if (storagePath) {
        storagePaths.add(
          storagePath
        );
      }
    }

    const wavPath =
      typeof order.autoMasterWavPath ===
        "string"
        ? order.autoMasterWavPath.trim()
        : "";

    const mp3Path =
      typeof order.autoMasterMp3Path ===
        "string"
        ? order.autoMasterMp3Path.trim()
        : "";

    if (wavPath) {
      storagePaths.add(
        wavPath
      );
    }

    if (mp3Path) {
      storagePaths.add(
        mp3Path
      );
    }

    for (
      const storagePath of
      storagePaths
    ) {
      const file =
        adminBucket.file(
          storagePath
        );

      const [
        exists,
      ] =
        await file.exists();

      if (exists) {
        await file.delete();
      }
    }

    await orderRef.delete();

    return NextResponse.json({
      success: true,
      orderId,
      deletedFiles:
        storagePaths.size,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : String(error);

    console.error(
      "MIX MASTERING DELETE ORDER ERROR:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          message,
      },
      {
        status:
          message ===
            "OWNER_ONLY" ||
          message ===
            "OWNER_AUTH_REQUIRED"
            ? 403
            : 500,
      }
    );
  }
}


