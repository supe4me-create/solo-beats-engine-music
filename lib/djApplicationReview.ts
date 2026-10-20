// SOLO_DJ_APPLICATION_REVIEW_V3: application review does not grant DJ permissions.
import { createHash } from "node:crypto";
import { adminBucket, adminDb } from "./firebaseAdmin";
import { RadioAccessError } from "./radioDjAccess";

export const keyFor = (uid: string) =>
  createHash("sha256").update(uid).digest("hex");

export const appRef = (uid: string) =>
  adminDb.collection("radioDjRequests").doc(keyFor(uid));

export const noteRef = (uid: string) =>
  adminDb.collection("ownerNotifications").doc("dj-request-" + keyFor(uid));

export const uploadRef = (uid: string, kind: string) =>
  adminDb.collection("djApplicationUploads").doc(keyFor(uid) + "-" + kind);

export const reply = (body: object) =>
  Response.json(body, { headers: { "Cache-Control": "no-store" } });

export function feature() {
  if (process.env.RADIO_DJ_REQUESTS_ENABLED === "false")
    throw new RadioAccessError("DJ applications are disabled.", 503);
}

export async function bodyOf(request: Request) {
  const text = await request.text();
  if (text.length > 16000)
    throw new RadioAccessError("Request too large.", 413);

  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new RadioAccessError("Invalid request.", 400);
  }

  if (!body || typeof body !== "object" || Array.isArray(body))
    throw new RadioAccessError("Invalid request.", 400);

  return body as Record<string, unknown>;
}

function text(value: unknown, label: string, max: number) {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.trim().length > max
  ) {
    throw new RadioAccessError(
      `${label} is required (maximum ${max} characters).`,
      400
    );
  }

  return value.trim();
}

export function validateProfile(body: Record<string, unknown>) {
  const legalName = text(body.legalName, "Legal name", 120);
  const displayName = text(body.displayName, "Display name", 80);
  const djName = text(body.djName, "DJ name", 80);
  const city = text(body.city, "City", 100);
  const country = text(body.country, "Country", 100);
  const introduction = text(body.introduction, "Introduction", 1000);

  if (
    !Array.isArray(body.links) ||
    body.links.length < 1 ||
    body.links.length > 8
  ) {
    throw new RadioAccessError(
      "Add between 1 and 8 music/social links.",
      400
    );
  }

  const links = body.links.map(value => {
    const input = text(value, "Link", 500);

    try {
      const url = new URL(input);
      if (
        url.protocol !== "https:" ||
        url.username ||
        url.password
      ) {
        throw new Error();
      }
      return url.href;
    } catch {
      throw new RadioAccessError(
        "Music/social links must be complete https:// links.",
        400
      );
    }
  });

  if (body.consent !== true) {
    throw new RadioAccessError(
      "Confirm the application details and owner review consent.",
      400
    );
  }

  return {
    legalName,
    displayName,
    djName,
    city,
    country,
    introduction,
    links,
    consent: true,
  };
}

export function submissionAllowed(
  data: Record<string, unknown> | undefined,
  now: number
) {
  if (["pending", "approved", "reviewing"].includes(String(data?.status))) {
    throw new RadioAccessError(
      "Your application is already submitted. Contact the owner about access changes.",
      409
    );
  }

  if (
    ["declined", "revoked", "deleted"].includes(String(data?.status)) &&
    false
  ) {
    throw new RadioAccessError(
      "Wait 24 hours after the decision before applying again.",
      429
    );
  }
}

export function mediaPath(uid: string, value: unknown) {
  return (
    typeof value === "string" &&
    new RegExp(
      "^private-dj-applications/" +
      keyFor(uid) +
      "/[a-f0-9-]{36}/(photo|video)$"
    ).test(value)
  ) ? value : null;
}

export async function privateStorage() {
  const [metadata] = await adminBucket.getMetadata();
  const [policy] = await adminBucket.iam.getPolicy();

  if (
    policy.bindings?.some(binding =>
      binding.members?.some(member =>
        member === "allUsers" ||
        member === "allAuthenticatedUsers"
      )
    )
  ) {
    throw new RadioAccessError(
      "Application uploads blocked: the storage bucket has public IAM access. Owner review of storage settings is required.",
      503
    );
  }

  return metadata.iamConfiguration?.uniformBucketLevelAccess?.enabled === true;
}

