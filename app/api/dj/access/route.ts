import {
  radioAccount,
  radioAccessFailure,
} from "../../../../lib/radioDjAccess";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { account, owner, ...access } = await radioAccount(request);
    return Response.json({
      success: true,
      email: account.email || "",
      owner,
      ...access,
      emailVerified: account.emailVerified,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return radioAccessFailure(error);
  }
}