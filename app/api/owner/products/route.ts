import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";

import {
  adminBucket,
  adminDb,
  firebaseAdminApp,
} from "../../../../lib/firebaseAdmin";

export const dynamic = "force-dynamic";

const OWNER_EMAIL = "supe4.me@gmail.com";

function bearer(request: Request) {
  const value =
    request.headers.get("authorization") || "";

  return (
    value.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() ||
    null
  );
}

async function verifyOwner(request: Request) {
  const token = bearer(request);

  if (!token) {
    throw new Error("OWNER_AUTH_REQUIRED");
  }

  const decoded = await getAuth(
    firebaseAdminApp
  ).verifyIdToken(token);

  if (
    decoded.email?.toLowerCase() !==
    OWNER_EMAIL.toLowerCase()
  ) {
    throw new Error("OWNER_ACCESS_ONLY");
  }

  return decoded;
}

function authError(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : "";

  if (message === "OWNER_AUTH_REQUIRED") {
    return NextResponse.json(
      {
        success: false,
        error: "Owner sign-in is required.",
      },
      { status: 401 }
    );
  }

  if (message === "OWNER_ACCESS_ONLY") {
    return NextResponse.json(
      {
        success: false,
        error: "Owner access only.",
      },
      { status: 403 }
    );
  }

  return null;
}

function clean(
  value: unknown,
  maxLength = 500
) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .replace(/\0/g, "")
    .trim()
    .slice(0, maxLength);
}

function numberValue(
  value: unknown,
  fallback = 0
) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : fallback;
}

async function generateAutoSku() {
  const snapshot =
    await adminDb
      .collection("physicalProducts")
      .get();

  let highest = 0;

  snapshot.docs.forEach((doc) => {
    const data = doc.data();

    const sku =
      typeof data.sku === "string"
        ? data.sku.trim().toUpperCase()
        : "";

    const match =
      sku.match(/^SB-PROD-(\d+)$/);

    if (!match) {
      return;
    }

    const number =
      Number(match[1]);

    if (
      Number.isFinite(number) &&
      number > highest
    ) {
      highest = number;
    }
  });

  const nextNumber =
    highest + 1;

  return `SB-PROD-${String(
    nextNumber
  ).padStart(4, "0")}`;
}

function toIso(value: unknown) {
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as { toDate?: unknown }).toDate ===
      "function"
  ) {
    return (
      value as { toDate: () => Date }
    ).toDate().toISOString();
  }

  return typeof value === "string"
    ? value
    : null;
}

async function signedReadUrl(
  storagePath: unknown
) {
  if (
    typeof storagePath !== "string" ||
    !storagePath
  ) {
    return null;
  }

  try {
    const file =
      adminBucket.file(storagePath);

    const [exists] =
      await file.exists();

    if (!exists) {
      return null;
    }

    const [url] =
      await file.getSignedUrl({
        action: "read",
        expires:
          Date.now() +
          60 * 60 * 1000,
      });

    return url;
  } catch (error) {
    console.error(
      "Product image URL error:",
      error
    );

    return null;
  }
}

async function getProductImage(
  mediaId: string
) {
  const snapshot =
    await adminDb
      .collection("mediaLibrary")
      .doc(mediaId)
      .get();

  if (!snapshot.exists) {
    return null;
  }

  const data = snapshot.data() || {};

  if (
    data.kind !== "image" ||
    data.status === "deleted" ||
    typeof data.storagePath !== "string" ||
    !data.storagePath
  ) {
    return null;
  }

  return {
    mediaId: snapshot.id,
    storagePath:
      data.storagePath as string,
  };
}

export async function GET(
  request: Request
) {
  try {
    await verifyOwner(request);

    const snapshot =
      await adminDb
        .collection("physicalProducts")
        .orderBy("updatedAt", "desc")
        .get();

    const products =
      await Promise.all(
        snapshot.docs.map(
          async (document) => {
            const data =
              document.data();

            return {
              productId: document.id,

              title:
                data.title ||
                "Untitled Product",

              description:
                data.description || "",

              sku:
                data.sku || "",

              category:
                data.category || "",

              price:
                Number(
                  data.price || 0
                ),

              stock:
                Number(
                  data.stock || 0
                ),

              shippingCharge:
                Number(
                  data.shippingCharge || 0
                ),

              active:
                data.active === true,

              imageMediaId:
                data.imageMediaId ||
                null,

              imageStoragePath:
                data.imageStoragePath ||
                null,

              imagePreviewUrl:
                await signedReadUrl(
                  data.imageStoragePath
                ),

              createdAt:
                toIso(
                  data.createdAt
                ),

              updatedAt:
                toIso(
                  data.updatedAt
                ),
            };
          }
        )
      );

    return NextResponse.json(
      {
        success: true,
        products,
      },
      {
        headers: {
          "Cache-Control":
            "no-store",
        },
      }
    );
  } catch (error) {
    const response =
      authError(error);

    if (response) {
      return response;
    }

    console.error(
      "Owner Products GET error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Products could not be loaded.",
      },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request
) {
  try {
    const owner =
      await verifyOwner(request);

    const body =
      await request.json();

    const action =
      clean(body.action, 30);

    if (action === "delete") {
      const productId =
        clean(
          body.productId,
          150
        );

      if (!productId) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Product ID is required.",
          },
          { status: 400 }
        );
      }

      await adminDb
        .collection(
          "physicalProducts"
        )
        .doc(productId)
        .delete();

      return NextResponse.json({
        success: true,
        productId,
        message:
          "Product deleted.",
      });
    }

    if (
      action !== "create" &&
      action !== "update"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Use action "create", "update", or "delete".',
        },
        { status: 400 }
      );
    }

    const title =
      clean(body.title, 160);

    const description =
      clean(
        body.description,
        3000
      );

    let sku =
      clean(body.sku, 100);

    if (
      !sku &&
      action === "create"
    ) {
      sku =
        await generateAutoSku();
    }

    const category =
      clean(
        body.category,
        100
      );

    const price =
      Number(
        numberValue(
          body.price,
          0
        ).toFixed(2)
      );

    const stock =
      Math.max(
        0,
        Math.floor(
          numberValue(
            body.stock,
            0
          )
        )
      );

    const shippingCharge =
      Math.max(
        0,
        Number(
          numberValue(
            body.shippingCharge,
            0
          ).toFixed(2)
        )
      );

    const active =
      body.active === true;

    const imageMediaId =
      clean(
        body.imageMediaId,
        150
      );

    if (!title) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Product title is required.",
        },
        { status: 400 }
      );
    }

    if (
      !Number.isFinite(price) ||
      price <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Product price must be greater than zero.",
        },
        { status: 400 }
      );
    }

    if (!imageMediaId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Choose a product image from the Media Library.",
        },
        { status: 400 }
      );
    }

    const productImage =
      await getProductImage(
        imageMediaId
      );

    if (!productImage) {
      return NextResponse.json(
        {
          success: false,
          error:
            "The selected Media Library image could not be used.",
        },
        { status: 400 }
      );
    }

    let productRef;

    if (
      action === "update"
    ) {
      const productId =
        clean(
          body.productId,
          150
        );

      if (!productId) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Product ID is required for update.",
          },
          { status: 400 }
        );
      }

      productRef =
        adminDb
          .collection(
            "physicalProducts"
          )
          .doc(productId);

      const existing =
        await productRef.get();

      if (!existing.exists) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Product was not found.",
          },
          { status: 404 }
        );
      }
    } else {
      productRef =
        adminDb
          .collection(
            "physicalProducts"
          )
          .doc();
    }

    const existing =
      await productRef.get();

    await productRef.set(
      {
        productId:
          productRef.id,

        title,
        description,
        sku,
        category,
        price,
        stock,
        shippingCharge,
        active,

        imageMediaId:
          productImage.mediaId,

        imageStoragePath:
          productImage.storagePath,

        updatedAt:
          FieldValue.serverTimestamp(),

        updatedBy:
          owner.email ||
          OWNER_EMAIL,

        ...(existing.exists
          ? {}
          : {
              createdAt:
                FieldValue.serverTimestamp(),

              createdBy:
                owner.email ||
                OWNER_EMAIL,
            }),
      },
      { merge: true }
    );

    return NextResponse.json({
      success: true,
      productId:
        productRef.id,
      message:
        action === "create"
          ? "Product created."
          : "Product updated.",
    });
  } catch (error) {
    const response =
      authError(error);

    if (response) {
      return response;
    }

    console.error(
      "Owner Products POST error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          "Product operation could not be completed.",
      },
      { status: 500 }
    );
  }
}

