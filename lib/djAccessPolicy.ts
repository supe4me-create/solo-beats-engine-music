// SOLO_DJ_ACCESS_FOUNDATION_V2
// Paid DJ access requires an owner-approved DJ application + verified payment.

export const DJ_POLICY_CLAIM = "soloBeatsDjPolicy";

export type DjPolicy = {
  v: 1;
  type: "free" | "paid";
  state: "active" | "suspended" | "revoked";
  start: number | null;
  end: number | null;
  paidApproved?: boolean;
};

export function readDjPolicy(value: unknown): DjPolicy | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const p = value as Record<string, unknown>;

  if (p.v !== 1) return null;
  if (p.type !== "free" && p.type !== "paid") return null;

  if (
    p.state !== "active" &&
    p.state !== "suspended" &&
    p.state !== "revoked"
  ) {
    return null;
  }

  const validDate = (v: unknown) =>
    v === null ||
    (typeof v === "number" && Number.isFinite(v) && v >= 0);

  if (!validDate(p.start) || !validDate(p.end)) return null;

  const policy: DjPolicy = {
    v: 1,
    type: p.type,
    state: p.state,
    start: p.start as number | null,
    end: p.end as number | null,
  };

  if (typeof p.paidApproved === "boolean") {
    policy.paidApproved = p.paidApproved;
  }

  return policy;
}

export function evaluateDjAccess(
  claims: Record<string, unknown>,
  verified: boolean,
  owner: boolean,
  now = Date.now()
) {
  const approved = claims.soloBeatsRadioDj === true;

  const hasPolicy = Object.prototype.hasOwnProperty.call(
    claims,
    DJ_POLICY_CLAIM
  );

  const policy = readDjPolicy(claims[DJ_POLICY_CLAIM]);

  let status = "active";
  let reason = "DJ access active.";

  if (owner) {
    reason = "Owner access active.";
  } else if (hasPolicy && !policy) {
    status = "invalid";
    reason = "DJ access settings need owner review.";
  } else if (policy?.state === "revoked") {
    status = "revoked";
    reason = "DJ access was revoked.";
  } else if (!approved) {
    status = "not_approved";
    reason = "Owner approval is required for DJ tools.";
  } else if (policy?.state === "suspended") {
    status = "suspended";
    reason = "DJ access is suspended. Contact the owner.";
  } else if (!verified) {
    status = "unverified";
    reason = "Verify your account email before using DJ tools.";
  } else if (
    policy?.end !== null &&
    policy?.end !== undefined &&
    now >= policy.end
  ) {
    status = "expired";
    reason = "DJ access has expired. Renew your DJ plan.";
  } else if (
    policy?.start !== null &&
    policy?.start !== undefined &&
    now < policy.start
  ) {
    status = "scheduled";
    reason = "DJ access has not started yet.";
  } else if (
    policy?.type === "paid" &&
    policy.paidApproved !== true
  ) {
    status = "payment_required";
    reason =
      "Choose a DJ plan and complete payment. DJ tools unlock automatically after PayPal verifies the subscription.";
  }

  const end = owner ? null : policy?.end ?? null;

  return {
    approved: owner || approved,
    allowed: owner || status === "active",

    accessType: owner
      ? "owner"
      : policy?.type ?? (approved ? "free" : "none"),

    status,
    reason,

    startsAt: owner
      ? null
      : policy?.start ?? null,

    expiresAt: end,

    daysRemaining:
      end === null
        ? null
        : Math.max(
            0,
            Math.ceil((end - now) / 86400000)
          ),

    legacyAccess:
      !owner &&
      approved &&
      !hasPolicy,
  };
}
