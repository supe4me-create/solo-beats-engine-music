import {
  getAuth,
} from "firebase-admin/auth";

import {
  handleUpload,
  type HandleUploadBody,
} from "@vercel/blob/client";

import {
  NextResponse,
} from "next/server";

import {
  firebaseAdminApp,
} from "../../../../lib/firebaseAdmin";

export const runtime =
  "nodejs";

function getBearerToken(
  request: Request
) {
  const authorization =
    request.headers.get(
      "authorization"
    ) || "";

  return (
    authorization.match(
      /^Bearer\s+(.+)$/i
    )?.[1]?.trim() ||
    null
  );
}

export async function POST(
  request: Request
) {
  try {
    const token =
      getBearerToken(
        request
      );

    if (!token) {
      return NextResponse.json(
        {
          error:
            "AUTH_REQUIRED",
        },
        {
          status:
            401,
        }
      );
    }

    const user =
      await getAuth(
        firebaseAdminApp
      ).verifyIdToken(
        token
      );

    if (
      user.email_verified !==
      true
    ) {
      return NextResponse.json(
        {
          error:
            "EMAIL_VERIFICATION_REQUIRED",
        },
        {
          status:
            403,
        }
      );
    }

    const body =
      (await request.json()) as HandleUploadBody;

    const jsonResponse =
      await handleUpload({
        body,
        request,

        onBeforeGenerateToken:
          async (
            pathname
          ) => {
            if (
              !pathname.startsWith(
                "customer-audio-input/"
              )
            ) {
              throw new Error(
                "INVALID_UPLOAD_PATH"
              );
            }

            return {
              allowedContentTypes: [
                "audio/mpeg",
                "audio/wav",
                "audio/x-wav",
                "audio/flac",
                "audio/mp4",
                "audio/aac",
                "audio/ogg",
                "application/octet-stream",
              ],

              maximumSizeInBytes:
                250 *
                1024 *
                1024,

              addRandomSuffix:
                true,

              tokenPayload:
                JSON.stringify({
                  uid:
                    user.uid,
                }),
            };
          },

        onUploadCompleted:
          async () => {},
      });

    return NextResponse.json(
      jsonResponse
    );
  } catch (error) {
    console.error(
      "Customer audio upload error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "UPLOAD_FAILED",
      },
      {
        status:
          500,
      }
    );
  }
}
