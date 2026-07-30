"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../auth/AuthContext";

const OWNER_EMAIL = "supe4.me@gmail.com";

type ReviewStatus = "pending" | "approved" | "rejected";
type FilterValue = "all" | ReviewStatus;

type Submission = {
  submissionId: string;
  advertiserAccountEmail: string | null;
  businessName: string;
  contactName: string;
  businessEmail: string | null;
  businessWebsite: string | null;
  campaignName: string;
  campaignGoal: string;
  headline: string;
  description: string;
  callToAction: string;
  targetAudience: string | null;
  targetGenre: string | null;
  requestedPlacements: string[];
  requestedDurationDays: number;
  proposedBudget: string;
  finalPrice: string | null;
  currency: string;
  preferredStartDate: string | null;
  youtubeLink: string | null;
  creativeType: string;
  reviewStatus: ReviewStatus;
  paymentStatus: string;
  placementStatus: string;
  sponsoredLabel: string;
  createdAt: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  scheduleStartDate: string | null;
  scheduleEndDate: string | null;
  placementLocation: string | null;
  imageUrl: string | null;
  videoUrl: string | null;
};

function youtubeEmbed(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    const id =
      url.hostname === "youtu.be"
        ? url.pathname.replace(/^\//, "").split("/")[0]
        : url.searchParams.get("v") ||
          url.pathname.split("/").filter(Boolean).pop();
    return id
      ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}`
      : null;
  } catch {
    return null;
  }
}

function pretty(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function BusinessAdvertisingReviewPage() {
  const { user, loading } = useAuth();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [filter, setFilter] = useState<FilterValue>("pending");
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [finalPrices, setFinalPrices] = useState<Record<string, string>>({});
  const [rejectionReasons, setRejectionReasons] = useState<Record<string, string>>({});
  const [scheduleValues, setScheduleValues] = useState<
    Record<
      string,
      {
        startDate: string;
        endDate: string;
        placementLocation: string;
      }
    >
  >({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const isOwner = user?.email?.toLowerCase() === OWNER_EMAIL;

  useEffect(() => {
    if (!user || !isOwner) return;

    const currentUser = user;
    let cancelled = false;

    async function load() {
      setLoadingSubmissions(true);
      setError("");
      try {
        const token = await currentUser.getIdToken();
        const response = await fetch("/api/owner/business-advertising", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const contentType = response.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) {
          throw new Error("The business advertising review service returned an invalid response.");
        }
        const data = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data.error || "Business advertising submissions could not be loaded.");
        }
        if (!cancelled) {
          const items = Array.isArray(data.submissions) ? data.submissions : [];
          setSubmissions(items);
          setFinalPrices(
            Object.fromEntries(
              items.map((item: Submission) => [
                item.submissionId,
                item.finalPrice || item.proposedBudget || "",
              ])
            )
          );
        }
      } catch (cause) {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : "Submissions could not be loaded.");
        }
      } finally {
        if (!cancelled) setLoadingSubmissions(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [user, isOwner]);

  const visible = useMemo(
    () => (filter === "all" ? submissions : submissions.filter((item) => item.reviewStatus === filter)),
    [submissions, filter]
  );

  const counts = useMemo(
    () => ({
      all: submissions.length,
      pending: submissions.filter((item) => item.reviewStatus === "pending").length,
      approved: submissions.filter((item) => item.reviewStatus === "approved").length,
      rejected: submissions.filter((item) => item.reviewStatus === "rejected").length,
    }),
    [submissions]
  );

  async function review(submissionId: string, action: "approve" | "reject") {
    if (!user) return;
    const finalPrice = finalPrices[submissionId]?.trim() || "";
    const rejectionReason = rejectionReasons[submissionId]?.trim() || "";

    if (action === "approve" && (!finalPrice || Number(finalPrice) <= 0)) {
      setError("Enter a valid final campaign price before approving.");
      return;
    }
    if (action === "reject" && !rejectionReason) {
      setError("Enter a rejection reason before rejecting.");
      return;
    }

    setReviewingId(submissionId);
    setMessage("");
    setError("");

    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/owner/business-advertising", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          submissionId,
          action,
          finalPrice: action === "approve" ? finalPrice : null,
          rejectionReason: action === "reject" ? rejectionReason : null,
        }),
      });

      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        throw new Error("The business advertising review service returned an invalid response.");
      }

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "The campaign could not be reviewed.");
      }

      setSubmissions((current) =>
        current.map((item) =>
          item.submissionId === submissionId
            ? {
                ...item,
                reviewStatus: data.reviewStatus,
                paymentStatus: data.paymentStatus,
                placementStatus: data.placementStatus,
                finalPrice: data.finalPrice || item.finalPrice,
                rejectionReason: data.rejectionReason || null,
                reviewedAt: data.reviewedAt || new Date().toISOString(),
              }
            : item
        )
      );

      setMessage(
        action === "approve"
          ? "The business campaign was approved and is ready for payment."
          : "The business campaign was rejected."
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The campaign could not be reviewed.");
    } finally {
      setReviewingId(null);
    }
  }

  async function scheduleSubmission(
    submissionId: string
  ) {
    if (!user) return;

    const values =
      scheduleValues[submissionId];

    if (
      !values?.startDate ||
      !values?.endDate ||
      !values?.placementLocation
    ) {
      setError(
        "Choose a start date, end date, and placement."
      );
      return;
    }

    setReviewingId(submissionId);
    setError("");
    setMessage("");

    try {
      const token =
        await user.getIdToken();

      const response = await fetch(
        "/api/owner/business-advertising",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
            Authorization:
              `Bearer ${token}`,
          },
          body: JSON.stringify({
            submissionId,
            action: "schedule",
            startDate:
              values.startDate,
            endDate:
              values.endDate,
            placementLocation:
              values.placementLocation,
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
            "The business campaign could not be scheduled."
        );
      }

      setSubmissions((current) =>
        current.map((submission) =>
          submission.submissionId ===
          submissionId
            ? {
                ...submission,
                placementStatus:
                  data.placementStatus,
                scheduleStartDate:
                  data.scheduleStartDate,
                scheduleEndDate:
                  data.scheduleEndDate,
                placementLocation:
                  data.placementLocation,
              }
            : submission
        )
      );

      setMessage(
        "The paid business campaign was scheduled successfully."
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "The business campaign could not be scheduled."
      );
    } finally {
      setReviewingId(null);
    }
  }

  if (loading) {
    return <main className="grid min-h-screen place-items-center">Loading owner access...</main>;
  }

  if (!user || !isOwner) {
    return (
      <main className="grid min-h-screen place-items-center px-5 pt-52">
        <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 text-center">
          <h1 className="text-4xl font-black">{user ? "Owner access only" : "Sign in required"}</h1>
          <Link href={user ? "/" : "/account"} className="mt-7 inline-flex rounded-2xl bg-white px-6 py-4 font-black text-black">
            {user ? "Return Home" : "Open Account"}
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-5 pb-40 pt-52 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <section className="rounded-[2.5rem] border border-cyan-300/20 bg-gradient-to-br from-cyan-700/25 via-black/50 to-violet-500/15 p-8 shadow-2xl sm:p-12">
          <p className="text-sm font-black uppercase tracking-[0.22em] text-emerald-300">Owner Review</p>
          <h1 className="mt-4 text-5xl font-black sm:text-7xl">Business Advertising Submissions</h1>
          <p className="mt-5 max-w-4xl text-lg leading-8 text-white/60">
            Review business campaigns, images, videos, budgets, goals, and requested placements before payment.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/developer" className="rounded-2xl bg-white px-5 py-4 font-black text-black">Owner Dashboard</Link>
            <Link href="/business-advertising" className="rounded-2xl border border-white/15 bg-white/5 px-5 py-4 font-black">Public Submission Page</Link>
          </div>
        </section>

        <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {(["all", "pending", "approved", "rejected"] as const).map((key) => (
            <article key={key} className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
              <p className="text-sm capitalize text-white/50">{key}</p>
              <p className="mt-2 text-4xl font-black">{counts[key]}</p>
            </article>
          ))}
        </section>

        <section className="mt-8 rounded-[2rem] border border-white/10 bg-white/[0.035] p-5">
          <div className="flex flex-wrap gap-2">
            {(["pending", "approved", "rejected", "all"] as FilterValue[]).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                className={`rounded-full px-4 py-2 text-sm font-black capitalize ${
                  filter === value ? "bg-white text-black" : "border border-white/10 bg-white/5 text-white/65"
                }`}
              >
                {value}
              </button>
            ))}
          </div>
          {message ? <p className="mt-5 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4 text-emerald-200">{message}</p> : null}
          {error ? <p className="mt-5 rounded-2xl border border-red-300/20 bg-red-300/10 p-4 text-red-200">{error}</p> : null}
        </section>

        <section className="mt-8 grid gap-6">
          {loadingSubmissions ? (
            <div className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-10 text-center">Loading submissions...</div>
          ) : visible.length === 0 ? (
            <div className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-10 text-center text-white/55">No submissions found.</div>
          ) : (
            visible.map((submission) => {
              const embed = youtubeEmbed(submission.youtubeLink);
              return (
                <article key={submission.submissionId} className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.035]">
                  <div className="grid gap-6 p-6 lg:grid-cols-[280px_minmax(0,1fr)]">
                    <div>
                      {submission.imageUrl ? (
                        <img src={submission.imageUrl} alt={submission.campaignName} className="aspect-square w-full rounded-2xl object-cover" />
                      ) : (
                        <div className="grid aspect-square place-items-center rounded-2xl border border-white/10 bg-black/20 text-white/35">No image creative</div>
                      )}
                      <span className="mt-4 inline-flex rounded-full border border-white/10 px-3 py-1 text-xs font-black uppercase tracking-[0.14em]">
                        {submission.reviewStatus}
                      </span>
                    </div>

                    <div>
                      <p className="text-sm font-black uppercase tracking-[0.16em] text-cyan-300">{submission.businessName}</p>
                      <h2 className="mt-2 text-4xl font-black">{submission.campaignName}</h2>
                      <p className="mt-2 text-white/45">{pretty(submission.campaignGoal)} • {submission.requestedDurationDays} days</p>
                      <h3 className="mt-5 text-2xl font-black">{submission.headline}</h3>
                      <p className="mt-3 leading-7 text-white/60">{submission.description}</p>

                      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        <Info label="Contact" value={submission.contactName} />
                        <Info label="Business email" value={submission.businessEmail || "Not available"} />
                        <Info label="Proposed budget" value={`$${submission.proposedBudget} ${submission.currency}`} />
                        <Info label="Placements" value={submission.requestedPlacements.join(", ") || "None"} />
                        <Info label="Target audience" value={submission.targetAudience || "Not specified"} />
                        <Info label="Target genre" value={submission.targetGenre || "Not specified"} />
                      </div>

                      {submission.businessWebsite ? (
                        <a href={submission.businessWebsite} target="_blank" rel="noreferrer" className="mt-5 inline-flex font-black text-cyan-300">
                          Open business website
                        </a>
                      ) : null}

                      {embed ? (
                        <div className="mt-6 aspect-video overflow-hidden rounded-2xl border border-white/10 bg-black">
                          <iframe src={embed} title={submission.campaignName} className="h-full w-full" allowFullScreen />
                        </div>
                      ) : null}

                      {submission.videoUrl ? (
                        <video controls preload="metadata" src={submission.videoUrl} className="mt-6 aspect-video w-full rounded-2xl bg-black" />
                      ) : null}

                      {submission.reviewStatus === "pending" ? (
                        <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-5">
                          <label className="grid gap-2">
                            <span className="text-sm font-black text-white/70">Final campaign price (USD)</span>
                            <input
                              type="number"
                              min="1"
                              step="0.01"
                              value={finalPrices[submission.submissionId] || ""}
                              onChange={(event) =>
                                setFinalPrices((current) => ({
                                  ...current,
                                  [submission.submissionId]: event.target.value,
                                }))
                              }
                              className="rounded-2xl border border-white/10 bg-black/25 px-4 py-4"
                            />
                          </label>

                          <label className="mt-4 grid gap-2">
                            <span className="text-sm font-black text-white/70">Rejection reason</span>
                            <textarea
                              rows={3}
                              value={rejectionReasons[submission.submissionId] || ""}
                              onChange={(event) =>
                                setRejectionReasons((current) => ({
                                  ...current,
                                  [submission.submissionId]: event.target.value,
                                }))
                              }
                              className="rounded-2xl border border-white/10 bg-black/25 px-4 py-4"
                            />
                          </label>

                          <div className="mt-4 flex flex-wrap gap-3">
                            <button
                              type="button"
                              disabled={reviewingId === submission.submissionId}
                              onClick={() => review(submission.submissionId, "approve")}
                              className="rounded-2xl bg-emerald-300 px-5 py-4 font-black text-black disabled:opacity-50"
                            >
                              {reviewingId === submission.submissionId ? "Saving..." : "Approve Campaign"}
                            </button>
                            <button
                              type="button"
                              disabled={reviewingId === submission.submissionId}
                              onClick={() => review(submission.submissionId, "reject")}
                              className="rounded-2xl border border-red-300/20 bg-red-300/10 px-5 py-4 font-black text-red-200 disabled:opacity-50"
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      ) : null}

                      {submission.reviewStatus === "approved" &&
                      submission.paymentStatus !== "paid" ? (
                        <div className="mt-6 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-5 text-amber-100">
                          <p className="font-black">Awaiting business payment</p>
                          <p className="mt-2 text-sm">
                            Final price: ${submission.finalPrice || "0.00"} {submission.currency}
                          </p>
                          <Link
                            href="/business-advertising/payment"
                            className="mt-4 inline-flex rounded-xl bg-white px-4 py-3 font-black text-black"
                          >
                            Open Payment Page
                          </Link>
                        </div>
                      ) : null}

                      {submission.reviewStatus === "approved" &&
                      submission.paymentStatus === "paid" &&
                      submission.placementStatus !== "scheduled" ? (
                        <div className="mt-6 rounded-2xl border border-cyan-300/20 bg-cyan-300/10 p-5">
                          <p className="font-black text-cyan-100">
                            Ready to schedule
                          </p>

                          <div className="mt-4 grid gap-4 sm:grid-cols-3">
                            <label className="grid gap-2">
                              <span className="text-sm font-black text-white/70">
                                Start date
                              </span>
                              <input
                                type="date"
                                value={
                                  scheduleValues[submission.submissionId]?.startDate || ""
                                }
                                onChange={(event) =>
                                  setScheduleValues((current) => ({
                                    ...current,
                                    [submission.submissionId]: {
                                      startDate: event.target.value,
                                      endDate:
                                        current[submission.submissionId]?.endDate || "",
                                      placementLocation:
                                        current[submission.submissionId]
                                          ?.placementLocation ||
                                        submission.requestedPlacements[0] ||
                                        "homepage",
                                    },
                                  }))
                                }
                                className="rounded-2xl border border-white/10 bg-black/25 px-4 py-4"
                              />
                            </label>

                            <label className="grid gap-2">
                              <span className="text-sm font-black text-white/70">
                                End date
                              </span>
                              <input
                                type="date"
                                value={
                                  scheduleValues[submission.submissionId]?.endDate || ""
                                }
                                onChange={(event) =>
                                  setScheduleValues((current) => ({
                                    ...current,
                                    [submission.submissionId]: {
                                      startDate:
                                        current[submission.submissionId]?.startDate || "",
                                      endDate: event.target.value,
                                      placementLocation:
                                        current[submission.submissionId]
                                          ?.placementLocation ||
                                        submission.requestedPlacements[0] ||
                                        "homepage",
                                    },
                                  }))
                                }
                                className="rounded-2xl border border-white/10 bg-black/25 px-4 py-4"
                              />
                            </label>

                            <label className="grid gap-2">
                              <span className="text-sm font-black text-white/70">
                                Placement
                              </span>
                              <select
                                value={
                                  scheduleValues[submission.submissionId]
                                    ?.placementLocation ||
                                  submission.requestedPlacements[0] ||
                                  "homepage"
                                }
                                onChange={(event) =>
                                  setScheduleValues((current) => ({
                                    ...current,
                                    [submission.submissionId]: {
                                      startDate:
                                        current[submission.submissionId]?.startDate || "",
                                      endDate:
                                        current[submission.submissionId]?.endDate || "",
                                      placementLocation: event.target.value,
                                    },
                                  }))
                                }
                                className="rounded-2xl border border-white/10 bg-black/25 px-4 py-4"
                              >
                                {submission.requestedPlacements.map((placement) => (
                                  <option key={placement} value={placement}>
                                    {placement === "homepage"
                                      ? "Homepage"
                                      : placement === "store"
                                        ? "Store"
                                        : placement === "radio"
                                          ? "Premium Radio"
                                          : "Premium TV"}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>

                          <button
                            type="button"
                            disabled={reviewingId === submission.submissionId}
                            onClick={() =>
                              scheduleSubmission(submission.submissionId)
                            }
                            className="mt-4 rounded-2xl bg-cyan-200 px-5 py-4 font-black text-black disabled:opacity-50"
                          >
                            {reviewingId === submission.submissionId
                              ? "Scheduling..."
                              : "Schedule Campaign"}
                          </button>
                        </div>
                      ) : null}

                      {submission.placementStatus === "scheduled" ? (
                        <div className="mt-6 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-5 text-emerald-100">
                          <p className="font-black">Business campaign scheduled</p>
                          <p className="mt-2 text-sm">
                            {submission.placementLocation || "placement"} •{" "}
                            {submission.scheduleStartDate || "start date"} to{" "}
                            {submission.scheduleEndDate || "end date"}
                          </p>
                          <p className="mt-2 text-xs uppercase tracking-[0.14em] text-emerald-200">
                            Label: Sponsored
                          </p>
                        </div>
                      ) : null}

                      {submission.rejectionReason ? (
                        <p className="mt-5 rounded-2xl border border-red-300/20 bg-red-300/10 p-4 text-red-200">
                          Rejection reason: {submission.rejectionReason}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </section>
      </div>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <p className="text-xs uppercase tracking-[0.14em] text-white/35">{label}</p>
      <p className="mt-2 break-all font-bold text-white/80">{value}</p>
    </div>
  );
}
