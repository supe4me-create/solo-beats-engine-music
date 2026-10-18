import { NextResponse } from "next/server";
import {
  handleUpload,
  type HandleUploadBody,
} from "@vercel/blob/client";
import { getAuth } from "firebase-admin/auth";

import {
  firebaseAdminApp,
} from "../../../../lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OWNER_EMAIL = "supe4.me@gmail.com";

async function verifyOwnerToken(token: string) {
  if (!token) {
    throw new Error("OWNER_AUTH_REQUIRED");
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

  return decoded;
}

export async function POST(
  request: Request
) {
  try {
    const body =
      (await request.json()) as HandleUploadBody;

    const result =
      await handleUpload({
        body,
        request,

        onBeforeGenerateToken: async (
          pathname,
          clientPayload
        ) => {
          if (
            !pathname.startsWith(
              "solo-stem-input/"
            ) &&
            !pathname.startsWith(
              "solo-stem-cover/"
            )
          ) {
            throw new Error(
              "INVALID_STEM_UPLOAD_PATH"
            );
          }

          let payload: {
            token?: string;
          };

          try {
            payload =
              JSON.parse(
                clientPayload || "{}"
              );
          } catch {
            throw new Error(
              "INVALID_UPLOAD_AUTH"
            );
          }

          await verifyOwnerToken(
            String(payload.token || "")
          );

          return {
            addRandomSuffix: true,

            maximumSizeInBytes:
              250 * 1024 * 1024,

            tokenPayload:
              JSON.stringify({
                owner: true,
              }),
          };
        },

        onUploadCompleted:
          async () => {},
      });

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : String(error);

    console.error(
      "OWNER STEM UPLOAD ERROR:",
      error
    );

    const authError =
      message === "OWNER_ONLY" ||
      message === "OWNER_AUTH_REQUIRED";

    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      {
        status: authError
          ? 403
          : 400,
      }
    );
  }
}

