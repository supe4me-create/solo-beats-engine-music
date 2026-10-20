import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";

import {
  adminBucket,
  adminDb,
  firebaseAdminApp,
} from "../../../../lib/firebaseAdmin";

const MAX_STEMS = 20;
const MAX_FILE_BYTES = 250 * 1024 * 1024;

const MASTER_ONLY_PRICE = 49.99;
const MIX_MASTER_BASE_PRICE = 99.99;
const PER_STEM_PRICE = 10.00;

function calculateServicePrice(
  serviceType: "MIX_MASTER" | "MASTER_ONLY",
  stemCount: number
) {
  if (serviceType === "MASTER_ONLY") {
    return MASTER_ONLY_PRICE;
  }

  return (
    MIX_MASTER_BASE_PRICE +
    stemCount * PER_STEM_PRICE
  );
}

type ServiceType =
  | "MIX_MASTER"
  | "MASTER_ONLY";

type StemInput = {
  name?: string;
  size?: number;
  type?: string;
};

type CreateOrderBody = {
  action?: "create";
  serviceType?: ServiceType;
  songTitle?: string;
  artistName?: string;
  genre?: string;
  notes?: string;
  stems?: StemInput[];
};

type CompleteOrderBody = {
  action?: "complete";
  orderId?: string;
};

function getBearerToken(
  request: Request
) {
  const authorization =
    request.headers.get(
      "authorization"
    ) || "";

  const match =
    authorization.match(
      /^Bearer\s+(.+)$/i
    );

  return (
    match?.[1]?.trim() ||
    null
  );
}

async function getUser(
  request: Request
) {
  const token =
    getBearerToken(
      request
    );

  if (!token) {
    throw new Error(
      "AUTH_REQUIRED"
    );
  }

  try {
    return await getAuth(
      firebaseAdminApp
    ).verifyIdToken(
      token
    );
  } catch {
    throw new Error(
      "AUTH_INVALID"
    );
  }
}

function safeFileName(
  value: string
) {
  const cleaned =
    value
      .replace(
        /[^\w.\- ()]/g,
        "_"
      )
      .replace(
        /\s+/g,
        " "
      )
      .trim();

  return (
    cleaned ||
    "stem"
  );
}

function safeText(
  value: unknown,
  max: number
) {
  return typeof value ===
    "string"
      ? value
          .trim()
          .slice(
            0,
            max
          )
      : "";
}

export async function POST(
  request: Request
) {
  try {
    const user =
      await getUser(
        request
      );

    const body =
      (await request.json()) as
        | CreateOrderBody
        | CompleteOrderBody;

    // ============================================================
    // COMPLETE UPLOAD
    // ============================================================

    if (
      body.action ===
      "complete"
    ) {
      const orderId =
        safeText(
          body.orderId,
          200
        );

      if (!orderId) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Order ID is required.",
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
          .doc(
            orderId
          );

      const orderSnapshot =
        await orderRef.get();

      if (
        !orderSnapshot.exists
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Mix & Mastering order was not found.",
          },
          {
            status: 404,
          }
        );
      }

      const order =
        orderSnapshot.data() ||
        {};

      if (
        order.uid !==
        user.uid
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "You do not have access to this order.",
          },
          {
            status: 403,
          }
        );
      }

      const serviceType:
        ServiceType =
        order.serviceType ===
        "MASTER_ONLY"
          ? "MASTER_ONLY"
          : "MIX_MASTER";

      const stems =
        Array.isArray(
          order.stems
        )
          ? order.stems
          : [];

      if (
        serviceType ===
          "MASTER_ONLY" &&
        stems.length !== 1
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "MASTER ONLY requires exactly one finished stereo mix.",
          },
          {
            status: 400,
          }
        );
      }

      if (
        serviceType ===
          "MIX_MASTER" &&
        (
          stems.length < 1 ||
          stems.length >
            MAX_STEMS
        )
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "The order has an invalid stem list.",
          },
          {
            status: 400,
          }
        );
      }

      const verifiedStems =
        [];

      for (
        const stem of
        stems
      ) {
        const storagePath =
          typeof stem?.storagePath ===
          "string"
            ? stem.storagePath
            : "";

        if (
          !storagePath
        ) {
          return NextResponse.json(
            {
              success: false,
              error:
                serviceType ===
                "MASTER_ONLY"
                  ? "The stereo mix storage path is missing."
                  : "A stem storage path is missing.",
            },
            {
              status: 400,
            }
          );
        }

        const storageFile =
          adminBucket.file(
            storagePath
          );

        const [
          exists,
        ] =
          await storageFile.exists();

        if (!exists) {
          return NextResponse.json(
            {
              success: false,
              error:
                serviceType ===
                "MASTER_ONLY"
                  ? `Stereo mix upload is incomplete: ${
                      stem.name ||
                      "unknown file"
                    }`
                  : `Stem upload is incomplete: ${
                      stem.name ||
                      "unknown file"
                    }`,
            },
            {
              status: 409,
            }
          );
        }

        const [
          metadata,
        ] =
          await storageFile.getMetadata();

        verifiedStems.push(
          {
            index:
              Number(
                stem.index
              ) || 0,

            name:
              typeof stem.name ===
              "string"
                ? stem.name
                : "",

            originalName:
              typeof stem.originalName ===
              "string"
                ? stem.originalName
                : typeof stem.name ===
                    "string"
                  ? stem.name
                  : "",

            storagePath,

            sizeBytes:
              Number(
                metadata.size
              ) || 0,

            contentType:
              metadata.contentType ||
              stem.type ||
              "application/octet-stream",

            type:
              metadata.contentType ||
              stem.type ||
              "application/octet-stream",

            uploaded: true,
          }
        );
      }

      const completedAt =
        new Date()
          .toISOString();

      await orderRef.set(
        {
          stems:
            verifiedStems,

          stemCount:
            verifiedStems.length,

          serviceType,

          orderType:
            serviceType,

          status:
            "SUBMITTED",

          uploadComplete:
            true,

          submittedAt:
            completedAt,

          updatedAt:
            completedAt,
        },
        {
          merge: true,
        }
      );

      return NextResponse.json(
        {
          success: true,

          orderId,

          serviceType,

          stemCount:
            verifiedStems.length,

          status:
            "SUBMITTED",
        }
      );
    }

    // ============================================================
    // CREATE ORDER
    // ============================================================

    const serviceType:
      ServiceType =
      "serviceType" in
        body &&
      body.serviceType ===
        "MASTER_ONLY"
        ? "MASTER_ONLY"
        : "MIX_MASTER";

    const songTitle =
      safeText(
        "songTitle" in body
          ? body.songTitle
          : "",
        200
      );

    const artistName =
      safeText(
        "artistName" in body
          ? body.artistName
          : "",
        200
      );

    const genre =
      safeText(
        "genre" in body
          ? body.genre
          : "",
        100
      );

    const notes =
      safeText(
        "notes" in body
          ? body.notes
          : "",
        5000
      );

    const stems =
      "stems" in body &&
      Array.isArray(
        body.stems
      )
        ? body.stems
        : [];

    if (!songTitle) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Song title is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (!artistName) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Artist name is required.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      serviceType ===
        "MASTER_ONLY" &&
      stems.length !== 1
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "MASTER ONLY requires exactly one finished stereo mix.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      serviceType ===
        "MIX_MASTER" &&
      (
        stems.length < 1 ||
        stems.length >
          MAX_STEMS
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            `Select between 1 and ${MAX_STEMS} stems.`,
        },
        {
          status: 400,
        }
      );
    }

    for (
      const stem of
      stems
    ) {
      const size =
        Number(
          stem.size
        ) || 0;

      if (
        size <= 0 ||
        size >
          MAX_FILE_BYTES
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              `${stem.name || "Audio file"} exceeds the allowed file size.`,
          },
          {
            status: 400,
          }
        );
      }
    }

    const orderRef =
      adminDb
        .collection(
          "mixMasteringOrders"
        )
        .doc();

    const orderId =
      orderRef.id;

    const createdAt =
      new Date()
        .toISOString();

    const orderStems =
      stems.map(
        (
          stem,
          index
        ) => {
          const originalName =
            safeFileName(
              safeText(
                stem.name,
                300
              )
            );

          const storageFolder =
            serviceType ===
            "MASTER_ONLY"
              ? "master-source"
              : "stems";

          const storagePath =
            `mix-mastering/${user.uid}/${orderId}/${storageFolder}/${String(
              index + 1
            ).padStart(
              2,
              "0"
            )}-${originalName}`;

          return {
            index,

            name:
              originalName,

            originalName:
              safeText(
                stem.name,
                300
              ),

            sizeBytes:
              Number(
                stem.size
              ) || 0,

            type:
              safeText(
                stem.type,
                200
              ) ||
              "application/octet-stream",

            storagePath,

            uploaded:
              false,
          };
        }
      );

    const quotedPriceUsd =
      calculateServicePrice(
        serviceType,
        orderStems.length
      );

    await orderRef.set(
      {
        orderId,

        uid:
          user.uid,

        userEmail:
          user.email ||
          "",

        songTitle,

        artistName,

        genre,

        notes,

        serviceType,

        orderType:
          serviceType,

        stemCount:
          orderStems.length,

        stems:
          orderStems,

        status:
          "UPLOADING",

        uploadComplete:
          false,

        service:
          "SOLO BEATS MIX & MASTERING",

        paymentStatus:
          "NOT_STARTED",

        pricingModel:
          serviceType === "MASTER_ONLY"
            ? "FLAT_MASTER"
            : "BASE_PLUS_PER_STEM",

        masterOnlyPrice:
          MASTER_ONLY_PRICE,

        mixMasterBasePrice:
          MIX_MASTER_BASE_PRICE,

        perStemPrice:
          PER_STEM_PRICE,

        quotedPriceUsd,

        processingStatus:
          "WAITING_FOR_UPLOAD",

        createdAt,

        updatedAt:
          createdAt,
      }
    );

    const uploads =
      [];

    for (
      const stem of
      orderStems
    ) {
      const storageFile =
        adminBucket.file(
          stem.storagePath
        );

      const [
        uploadUrl,
      ] =
        await storageFile.getSignedUrl(
          {
            version: "v4",

            action:
              "write",

            expires:
              Date.now() +
              30 *
                60 *
                1000,

            contentType:
              stem.type,
          }
        );

      uploads.push(
        {
          index:
            stem.index,

          name:
            stem.name,

          storagePath:
            stem.storagePath,

          contentType:
            stem.type,

          uploadUrl,
        }
      );
    }

    return NextResponse.json(
      {
        success: true,

        orderId,

        serviceType,

        uploads,

        status:
          "UPLOADING",
      }
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "";

    if (
      message ===
      "AUTH_REQUIRED"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Please sign in before submitting a Mix & Mastering project.",
        },
        {
          status: 401,
        }
      );
    }

    if (
      message ===
      "AUTH_INVALID"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Your sign-in session is invalid or expired. Please sign in again.",
        },
        {
          status: 401,
        }
      );
    }

    console.error(
      "MIX MASTERING ORDER ERROR",
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          message ||
          "Mix & Mastering order could not be created.",
      },
      {
        status: 500,
      }
    );
  }
}

