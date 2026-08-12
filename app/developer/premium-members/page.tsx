"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useAuth } from "../../auth/AuthContext";

const OWNER_EMAIL = "supe4.me@gmail.com";

type PremiumMember = {
  uid: string;
  email: string | null;
  subscriberEmail: string | null;
  subscriberName: string | null;
  status: string;
  premiumActive: boolean;
  subscriptionId: string | null;
  environment: string | null;
  startTime: string | null;
  nextBillingTime: string | null;
  cycleKey: string | null;
  downloadsUsed: number;
  downloadLimit: number;
  downloadsRemaining: number;
};

type PremiumSummary = {
  totalMembers: number;
  activeMembers: number;
  cancelledMembers: number;
  totalDownloadsUsed: number;
};

type PremiumResponse = {
  success?: boolean;
  summary?: PremiumSummary;
  members?: PremiumMember[];
  error?: string;
};

type StatusFilter = "all" | "active" | "inactive";

function formatDate(value: string | null) {
  if (!value) return "Not available";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function memberName(member: PremiumMember) {
  return member.subscriberName?.trim() || "Premium Member";
}

function memberEmail(member: PremiumMember) {
  return (
    member.subscriberEmail?.trim() ||
    member.email?.trim() ||
    "No email available"
  );
}

export default function PremiumMembersManagerPage() {
  const { user, loading } = useAuth();

  const [members, setMembers] = useState<PremiumMember[]>([]);
  const [summary, setSummary] = useState<PremiumSummary | null>(null);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [selectedMember, setSelectedMember] =
    useState<PremiumMember | null>(null);

  const [savingAction, setSavingAction] =
    useState<"reset" | "limit" | null>(null);

  const [actionMessage, setActionMessage] =
    useState("");

  const [actionError, setActionError] =
    useState("");

  const [limitInput, setLimitInput] =
    useState("10");

  const [cancellingMember, setCancellingMember] =
    useState(false);

  const loadPremiumMembers = useCallback(async () => {
    if (!user || user.email?.toLowerCase() !== OWNER_EMAIL) {
      setMembers([]);
      setSummary(null);
      return;
    }

    setLoadingMembers(true);
    setError("");

    try {
      const token = await user.getIdToken();

      const response = await fetch("/api/owner/premium-members", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      });

      const data = (await response.json()) as PremiumResponse;

      if (!response.ok || !data.success) {
        throw new Error(
          data.error || "Premium members could not be loaded."
        );
      }

      setMembers(
        Array.isArray(data.members) ? data.members : []
      );

      setSummary(data.summary || null);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Premium members could not be loaded."
      );
    } finally {
      setLoadingMembers(false);
    }
  }, [user]);

  useEffect(() => {
    if (loading) return;

    void loadPremiumMembers();
  }, [loading, loadPremiumMembers]);

  const filteredMembers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return members.filter((member) => {
      if (filter === "active" && !member.premiumActive) {
        return false;
      }

      if (filter === "inactive" && member.premiumActive) {
        return false;
      }

      if (!query) return true;

      const haystack = [
        member.uid,
        member.subscriberName,
        member.subscriberEmail,
        member.email,
        member.status,
        member.subscriptionId,
        member.environment,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [members, search, filter]);

  async function runMemberAction(
    action:
      | "reset-downloads"
      | "change-download-limit",
    member: PremiumMember,
    requestedLimit?: number
  ) {
    if (!user) return;

    setActionMessage("");
    setActionError("");

    if (action === "reset-downloads") {
      const confirmed = window.confirm(
        `Reset ${memberName(member)} to 0 used Premium downloads for the current billing cycle?`
      );

      if (!confirmed) return;

      setSavingAction("reset");
    } else {
      if (
        !Number.isInteger(requestedLimit) ||
        !requestedLimit ||
        requestedLimit < 1 ||
        requestedLimit > 100
      ) {
        setActionError(
          "Enter a whole-number download limit from 1 to 100."
        );
        return;
      }

      setSavingAction("limit");
    }

    try {
      const token = await user.getIdToken();

      const response = await fetch(
        "/api/owner/premium-members",
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            uid: member.uid,
            action,
            downloadLimit:
              action === "change-download-limit"
                ? requestedLimit
                : undefined,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error ||
            "Premium member could not be updated."
        );
      }

      setActionMessage(
        data.message ||
          "Premium member updated successfully."
      );

      await loadPremiumMembers();

      setSelectedMember(null);
    } catch (saveError) {
      setActionError(
        saveError instanceof Error
          ? saveError.message
          : "Premium member could not be updated."
      );
    } finally {
      setSavingAction(null);
    }
  }

  async function cancelPremiumMember(
    member: PremiumMember
  ) {
    if (!user) return;

    if (!member.subscriptionId) {
      setActionError(
        "This member does not have a PayPal subscription ID."
      );
      return;
    }

    const confirmed = window.confirm(
      `Cancel SOLO BEATS PREMIUM for ${memberName(
        member
      )}?

This will cancel the PayPal subscription and turn Premium access OFF.

This action should only be used when you really want to stop the membership.`
    );

    if (!confirmed) return;

    setCancellingMember(true);
    setActionMessage("");
    setActionError("");

    try {
      const token =
        await user.getIdToken();

      const response = await fetch(
        "/api/owner/premium-members",
        {
          method: "POST",
          headers: {
            Authorization:
              `Bearer ${token}`,
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            action: "cancel-premium",
            uid: member.uid,
          }),
        }
      );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.error ||
            "Premium subscription could not be cancelled."
        );
      }

      window.alert(
        data.message ||
          "Premium subscription cancelled successfully."
      );

      setSelectedMember(null);

      await loadPremiumMembers();
    } catch (cancelError) {
      setActionError(
        cancelError instanceof Error
          ? cancelError.message
          : "Premium subscription could not be cancelled."
      );
    } finally {
      setCancellingMember(false);
    }
  }
  if (loading) {
    return (
      <main className="min-h-screen bg-[#050507] px-6 py-12 text-white">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-8">
            <p className="text-white/60">
              Checking owner access...
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (
    !user ||
    user.email?.toLowerCase() !== OWNER_EMAIL
  ) {
    return (
      <main className="min-h-screen bg-[#050507] px-6 py-12 text-white">
        <div className="mx-auto max-w-3xl">
          <div className="rounded-[2rem] border border-red-400/20 bg-red-400/10 p-8">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-red-200">
              Owner Access Only
            </p>

            <h1 className="mt-3 text-3xl font-black">
              Premium Members Manager
            </h1>

            <p className="mt-4 text-white/65">
              Sign in with the SOLO BEATS owner account to
              manage Premium membership records.
            </p>

            <Link
              href="/"
              className="mt-6 inline-flex rounded-2xl bg-white px-5 py-3 font-black text-black"
            >
              Return Home
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050507] px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1500px]">
        <section className="rounded-[2rem] border border-emerald-300/15 bg-gradient-to-br from-emerald-400/10 via-white/[0.035] to-violet-500/10 p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.22em] text-emerald-300">
                SOLO BEATS PREMIUM
              </p>

              <h1 className="mt-3 text-4xl font-black sm:text-5xl">
                Premium Members Manager
              </h1>

              <p className="mt-4 max-w-3xl text-white/60">
                Review Premium subscribers, PayPal subscription
                status, billing information, and monthly download
                usage from the Owner Control Center.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void loadPremiumMembers()}
                disabled={loadingMembers}
                className="rounded-2xl border border-emerald-300/25 bg-emerald-300/10 px-5 py-3 font-black text-emerald-100 transition hover:bg-emerald-300/15 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loadingMembers
                  ? "Refreshing..."
                  : "Refresh Members"}
              </button>

              <Link
                href="/developer"
                className="rounded-2xl bg-white px-5 py-3 font-black text-black"
              >
                Owner Control Center
              </Link>
            </div>
          </div>

          {error ? (
            <div className="mt-6 rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-red-200">
              {error}
            </div>
          ) : null}

          <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Premium Members"
              value={
                loadingMembers
                  ? "..."
                  : summary?.totalMembers ?? 0
              }
            />

            <StatCard
              label="Active"
              value={
                loadingMembers
                  ? "..."
                  : summary?.activeMembers ?? 0
              }
            />

            <StatCard
              label="Cancelled / Inactive"
              value={
                loadingMembers
                  ? "..."
                  : summary?.cancelledMembers ?? 0
              }
            />

            <StatCard
              label="Downloads Used"
              value={
                loadingMembers
                  ? "..."
                  : summary?.totalDownloadsUsed ?? 0
              }
            />
          </div>
        </section>

        <section className="mt-8 rounded-[2rem] border border-white/10 bg-white/[0.035] p-6 sm:p-8">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.2em] text-violet-300">
                Membership Records
              </p>

              <h2 className="mt-2 text-3xl font-black">
                Subscribers
              </h2>

              <p className="mt-2 text-white/50">
                {filteredMembers.length} member
                {filteredMembers.length === 1 ? "" : "s"} shown
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_auto]">
            <input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search name, email, status, UID, or subscription ID..."
              className="w-full rounded-2xl border border-white/10 bg-black/30 px-5 py-4 text-white outline-none transition placeholder:text-white/30 focus:border-emerald-300/40"
            />

            <div className="flex flex-wrap gap-2">
              <FilterButton
                active={filter === "all"}
                onClick={() => setFilter("all")}
              >
                All
              </FilterButton>

              <FilterButton
                active={filter === "active"}
                onClick={() => setFilter("active")}
              >
                Active
              </FilterButton>

              <FilterButton
                active={filter === "inactive"}
                onClick={() => setFilter("inactive")}
              >
                Inactive
              </FilterButton>
            </div>
          </div>

          <div className="mt-7 overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full min-w-[1250px] text-left">
              <thead className="bg-black/30 text-xs uppercase tracking-[0.14em] text-white/45">
                <tr>
                  <th className="px-5 py-4">Member</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4">Downloads</th>
                  <th className="px-5 py-4">Billing Cycle</th>
                  <th className="px-5 py-4">Next Billing</th>
                  <th className="px-5 py-4">PayPal</th>
                  <th className="px-5 py-4">Subscription ID</th>
                  <th className="px-5 py-4">Details</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-white/10">
                {loadingMembers ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-5 py-10 text-center text-white/50"
                    >
                      Loading Premium member records...
                    </td>
                  </tr>
                ) : filteredMembers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-5 py-10 text-center text-white/50"
                    >
                      No Premium members match this view.
                    </td>
                  </tr>
                ) : (
                  filteredMembers.map((member) => (
                    <tr
                      key={member.uid}
                      className="align-top transition hover:bg-white/[0.025]"
                    >
                      <td className="px-5 py-4">
                        <p className="font-black">
                          {memberName(member)}
                        </p>

                        <p className="mt-1 text-sm text-white/45">
                          {memberEmail(member)}
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full border px-3 py-1 text-xs font-black uppercase tracking-[0.12em] ${
                            member.premiumActive
                              ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-200"
                              : "border-red-300/20 bg-red-300/10 text-red-200"
                          }`}
                        >
                          {member.status ||
                            (member.premiumActive
                              ? "ACTIVE"
                              : "INACTIVE")}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <p className="font-black">
                          {member.downloadsUsed} used
                        </p>

                        <p className="mt-1 text-sm text-white/45">
                          {member.downloadsRemaining} of{" "}
                          {member.downloadLimit} remaining
                        </p>
                      </td>

                      <td className="px-5 py-4 text-sm text-white/65">
                        {member.cycleKey || "Not started"}
                      </td>

                      <td className="px-5 py-4 text-sm text-white/65">
                        {formatDate(member.nextBillingTime)}
                      </td>

                      <td className="px-5 py-4">
                        <span className="rounded-full border border-white/10 bg-white/[0.045] px-3 py-1 text-xs font-black uppercase text-white/65">
                          {member.environment || "Unknown"}
                        </span>
                      </td>

                      <td className="max-w-[260px] break-all px-5 py-4 text-xs text-white/45">
                        {member.subscriptionId ||
                          "Not available"}
                      </td>

                      <td className="px-5 py-4">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedMember(member);
                            setLimitInput(
                              String(member.downloadLimit)
                            );
                            setActionMessage("");
                            setActionError("");
                          }}
                          className="rounded-xl border border-violet-300/20 bg-violet-300/10 px-4 py-2 text-sm font-black text-violet-100 transition hover:bg-violet-300/15"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {selectedMember ? (
          <section className="mt-8 rounded-[2rem] border border-violet-300/15 bg-gradient-to-br from-violet-500/10 via-white/[0.035] to-emerald-400/10 p-6 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div>
                <p className="text-sm font-black uppercase tracking-[0.2em] text-violet-300">
                  Member Details
                </p>

                <h2 className="mt-2 text-3xl font-black">
                  {memberName(selectedMember)}
                </h2>

                <p className="mt-2 text-white/55">
                  {memberEmail(selectedMember)}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedMember(null)}
                className="rounded-2xl border border-white/10 bg-white/[0.05] px-5 py-3 font-black text-white"
              >
                Close Details
              </button>
            </div>

            <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <DetailCard
                label="Premium Status"
                value={
                  selectedMember.status ||
                  (selectedMember.premiumActive
                    ? "ACTIVE"
                    : "INACTIVE")
                }
              />

              <DetailCard
                label="Premium Access"
                value={
                  selectedMember.premiumActive
                    ? "Enabled"
                    : "Disabled"
                }
              />

              <DetailCard
                label="Downloads Used"
                value={`${selectedMember.downloadsUsed} / ${selectedMember.downloadLimit}`}
              />

              <DetailCard
                label="Downloads Remaining"
                value={String(
                  selectedMember.downloadsRemaining
                )}
              />

              <DetailCard
                label="Billing Cycle"
                value={
                  selectedMember.cycleKey ||
                  "Not started"
                }
              />

              <DetailCard
                label="Subscription Started"
                value={formatDate(
                  selectedMember.startTime
                )}
              />

              <DetailCard
                label="Next Billing"
                value={formatDate(
                  selectedMember.nextBillingTime
                )}
              />

              <DetailCard
                label="PayPal Environment"
                value={
                  selectedMember.environment ||
                  "Unknown"
                }
              />

              <DetailCard
                label="Firebase UID"
                value={selectedMember.uid}
                breakAll
              />

              <div className="md:col-span-2 xl:col-span-3">
                <DetailCard
                  label="PayPal Subscription ID"
                  value={
                    selectedMember.subscriptionId ||
                    "Not available"
                  }
                  breakAll
                />
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-amber-300/15 bg-amber-300/[0.06] p-5">
              <p className="font-black text-amber-200">
                Owner download controls
              </p>

              <p className="mt-2 text-sm leading-6 text-white/55">
                Reset this member's current Premium download usage
                or assign a custom monthly track-download limit.
                PayPal subscription activation remains controlled
                by verified billing events.
              </p>

              {actionMessage ? (
                <p className="mt-4 rounded-xl border border-emerald-300/20 bg-emerald-300/10 p-4 text-sm font-bold text-emerald-200">
                  {actionMessage}
                </p>
              ) : null}

              {actionError ? (
                <p className="mt-4 rounded-xl border border-red-300/20 bg-red-300/10 p-4 text-sm font-bold text-red-200">
                  {actionError}
                </p>
              ) : null}

              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                  <p className="font-black">
                    Reset Current Downloads
                  </p>

                  <p className="mt-2 text-sm text-white/50">
                    Current usage:{" "}
                    {selectedMember.downloadsUsed} of{" "}
                    {selectedMember.downloadLimit}
                  </p>

                  <button
                    type="button"
                    disabled={savingAction !== null}
                    onClick={() =>
                      void runMemberAction(
                        "reset-downloads",
                        selectedMember
                      )
                    }
                    className="mt-4 rounded-xl border border-amber-300/25 bg-amber-300/10 px-4 py-3 font-black text-amber-100 transition hover:bg-amber-300/15 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {savingAction === "reset"
                      ? "Resetting..."
                      : "Reset Downloads to 0"}
                  </button>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                  <p className="font-black">
                    Monthly Download Limit
                  </p>

                  <p className="mt-2 text-sm text-white/50">
                    Set a custom allowance from 1 to 100 tracks.
                  </p>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <input
                      type="number"
                      min={1}
                      max={100}
                      step={1}
                      value={limitInput}
                      onChange={(event) =>
                        setLimitInput(event.target.value)
                      }
                      className="w-32 rounded-xl border border-white/10 bg-black/30 px-4 py-3 font-black text-white outline-none focus:border-emerald-300/40"
                    />

                    <button
                      type="button"
                      disabled={savingAction !== null}
                      onClick={() =>
                        void runMemberAction(
                          "change-download-limit",
                          selectedMember,
                          Number(limitInput)
                        )
                      }
                      className="rounded-xl border border-emerald-300/25 bg-emerald-300/10 px-4 py-3 font-black text-emerald-100 transition hover:bg-emerald-300/15 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {savingAction === "limit"
                        ? "Saving..."
                        : "Save Download Limit"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
            {selectedMember.premiumActive ? (
              <div className="mt-6 rounded-2xl border border-red-400/20 bg-red-400/[0.07] p-5">
                <p className="text-sm font-black uppercase tracking-[0.18em] text-red-300">
                  Subscription Cancellation
                </p>

                <h3 className="mt-2 text-xl font-black">
                  Cancel Premium Through PayPal
                </h3>

                <p className="mt-2 max-w-3xl text-sm leading-6 text-white/55">
                  This contacts PayPal first. Premium access is
                  turned off in Firestore only after PayPal accepts
                  the cancellation.
                </p>

                <button
                  type="button"
                  disabled={
                    cancellingMember ||
                    !selectedMember.subscriptionId
                  }
                  onClick={() =>
                    void cancelPremiumMember(
                      selectedMember
                    )
                  }
                  className="mt-5 rounded-xl border border-red-300/30 bg-red-500/15 px-5 py-3 font-black text-red-100 transition hover:bg-red-500/25 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {cancellingMember
                    ? "Cancelling Through PayPal..."
                    : selectedMember.subscriptionId
                      ? "Cancel Premium Through PayPal"
                      : "No PayPal Subscription ID"}
                </button>
              </div>
            ) : (
              <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.035] p-5">
                <p className="font-black text-white/70">
                  Premium is already inactive
                </p>

                <p className="mt-2 text-sm text-white/45">
                  No cancellation action is available for this
                  member because Premium access is not active.
                </p>
              </div>
            )}
          </section>
        ) : null}
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
      <p className="text-xs font-black uppercase tracking-[0.16em] text-white/40">
        {label}
      </p>

      <p className="mt-3 text-3xl font-black">
        {value}
      </p>
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border px-5 py-3 font-black transition ${
        active
          ? "border-emerald-300/30 bg-emerald-300/15 text-emerald-100"
          : "border-white/10 bg-white/[0.04] text-white/60 hover:bg-white/[0.07]"
      }`}
    >
      {children}
    </button>
  );
}

function DetailCard({
  label,
  value,
  breakAll = false,
}: {
  label: string;
  value: string;
  breakAll?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
      <p className="text-xs font-black uppercase tracking-[0.14em] text-white/40">
        {label}
      </p>

      <p
        className={`mt-2 font-bold text-white/85 ${
          breakAll ? "break-all" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}
