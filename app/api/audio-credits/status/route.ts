import {
  getAuth,
} from "firebase-admin/auth";

import {
  NextResponse,
} from "next/server";

import {
  firebaseAdminApp,
} from "../../../../lib/firebaseAdmin";

import {
  AUDIO_CREDIT_PACKS,
  getAudioCreditBalance,
} from "../../../../lib/audioCredits";

export const runtime =
  "nodejs";

export const dynamic =
  "force-dynamic";

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

export async function GET(
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
          success:
            false,

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

    const balance =
      await getAudioCreditBalance(
        user.uid
      );

    return NextResponse.json({
      success:
        true,

      balance,

      packs:
        Object.values(
          AUDIO_CREDIT_PACKS
        ),
    });
  } catch (error) {
    console.error(
      "Audio credit status error:",
      error
    );

    return NextResponse.json(
      {
        success:
          false,

        error:
          error instanceof Error
            ? error.message
            : "AUDIO_CREDIT_STATUS_FAILED",
      },
      {
        status:
          500,
      }
    );
  }
}
