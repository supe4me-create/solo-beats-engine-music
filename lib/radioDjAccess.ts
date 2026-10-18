import { getAuth } from "firebase-admin/auth";
import { firebaseAdminApp } from "./firebaseAdmin";
import { evaluateDjAccess } from "./djAccessPolicy";

export const RADIO_DJ_CLAIM = "soloBeatsRadioDj";
const OWNER_EMAIL = "supe4.me@gmail.com";

export class RadioAccessError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

export async function radioAccount(request: Request) {
  const token = request.headers.get("authorization")
    ?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();

  if (!token) {
    throw new RadioAccessError("Sign in to continue.", 401);
  }

  const auth = getAuth(firebaseAdminApp);
  let decoded;

  try {
    decoded = await auth.verifyIdToken(token);
  } catch {
    throw new RadioAccessError("Your session expired. Sign in again.", 401);
  }

  const account = await auth.getUser(decoded.uid);
  if (account.disabled) {
    throw new RadioAccessError("This account is disabled.", 403);
  }

  const owner = account.email?.toLowerCase() === OWNER_EMAIL;
  const access = evaluateDjAccess(account.customClaims || {}, account.emailVerified, owner);
  return { account, owner, ...access };
}

export async function requireRadioOwner(request: Request) {
  const result = await radioAccount(request);
  if (!result.owner) {
    throw new RadioAccessError("Owner access only.", 403);
  }
  return result;
}

export async function requireRadioDj(request: Request) {
  const result = await radioAccount(request);
  if (!result.allowed) {
    throw new RadioAccessError(result.reason, 403);
  }
  return result;
}

export function radioAccessFailure(error: unknown) {
  if (error instanceof RadioAccessError) {
    return Response.json(
      { success: false, error: error.message },
      { status: error.status, headers: { "Cache-Control": "no-store" } }
    );
  }

  console.error("Radio DJ access error:", error);
  return Response.json(
    { success: false, error: "DJ access could not be processed. Try again." },
    { status: 500, headers: { "Cache-Control": "no-store" } }
  );
}