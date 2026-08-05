"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useAuth } from "../../auth/AuthContext";

const OWNER_EMAIL =
  "supe4.me@gmail.com";

const PROMOTION_PRICES: Record<number, number> = {
  7: 19.99,
  14: 34.99,
  30: 59.99,
};

type ReviewStatus =
  | "pending"
  | "approved"
  | "rejected";

type PromotionSubmission = {
  submissionId: string;
  artistUid: string;
  artistAccountEmail: string | null;
  artistAccountName: string | null;
  artistName: string;
  songTitle: string;
  genre: string;
  description: string;
  socialLink: string | null;
  youtubeLink: string | null;
  promotionDurationDays: number;
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
  songUrl: string | null;
  artworkUrl: string | null;
  songOriginalName: string | null;
  artworkOriginalName: string | null;
};

type FilterValue =
  | "all"
  | ReviewStatus;

function getYouTubeEmbedUrl(
  value: string | null
): string | null {
  if (!value) return null;

  try {
    const url = new URL(value);
    let videoId = "";

    if (
      url.hostname === "youtu.be"
    ) {
      videoId =
        url.pathname
          .replace(/^\//, "")
          .split("/")[0] || "";
    } else {
      videoId =
        url.searchParams.get("v") ||
        url.pathname
          .split("/")
          .filter(Boolean)
          .pop() ||
        "";
    }

    if (!videoId) return null;

    return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(
      videoId
    )}`;
  } catch {
    return null;
  }
}

export default function ArtistPromotionReviewPage() {
  const { user, loading } =
    useAuth();

  const [submissions, setSubmissions] =
    useState<PromotionSubmission[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] =
    useState(false);
  const [errorMessage, setErrorMessage] =
    useState("");
  const [successMessage, setSuccessMessage] =
    useState("");
  const [filter, setFilter] =
    useState<FilterValue>("pending");
  const [reviewingId, setReviewingId] =
    useState<string | null>(null);
  const [copiedPaymentId, setCopiedPaymentId] =
    useState<string | null>(null);
  const [rejectionReasons, setRejectionReasons] =
    useState<Record<string, string>>({});
  const [scheduleValues, setScheduleValues] =
    useState<
      Record<
        string,
        {
          startDate: string;
          endDate: string;
          placementLocation: string;
        }
      >
    >({});

  const isOwner =
    user?.email?.toLowerCase() ===
    OWNER_EMAIL;

  const paymentRedirectHandled =
    useRef(false);

  useEffect(() => {
    if (!user || !isOwner) return;

    const currentUser = user;
    let cancelled = false;

    async function loadSubmissions() {
      setLoadingSubmissions(true);
      setErrorMessage("");

      try {
        const token =
          await currentUser.getIdToken();

        const response = await fetch(
          "/api/owner/artist-promotions",
          {
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
            cache: "no-store",
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
              "Artist promotion submissions could not be loaded."
          );
        }

        if (!cancelled) {
          setSubmissions(
            Array.isArray(data.submissions)
              ? data.submissions
              : []
          );
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Artist promotion submissions could not be loaded."
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingSubmissions(false);
        }
      }
    }

    void loadSubmissions();

    return () => {
      cancelled = true;
    };
  }, [user, isOwner]);

  useEffect(() => {
    if (
      paymentRedirectHandled.current ||
      submissions.length === 0
    ) {
      return;
    }

    const params = new URLSearchParams(
      window.location.search
    );
    const submissionId =
      params.get("submissionId");
    const paymentStatus =
      params.get("payment");

    if (
      paymentStatus !== "success" ||
      !submissionId
    ) {
      return;
    }

    const matchingSubmission =
      submissions.find(
        (submission) =>
          submission.submissionId ===
          submissionId
      );

    if (!matchingSubmission) {
      return;
    }

    paymentRedirectHandled.current = true;
    setFilter("approved");
    setSuccessMessage(
      "Payment successful — this promotion is ready to schedule."
    );

    window.setTimeout(() => {
      document
        .getElementById(
          `artist-submission-${submissionId}`
        )
        ?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
    }, 250);
  }, [submissions]);

  const visibleSubmissions =
    useMemo(() => {
      if (filter === "all") {
        return submissions;
      }

      return submissions.filter(
        (submission) =>
          submission.reviewStatus ===
          filter
      );
    }, [submissions, filter]);

  const counts = useMemo(
    () => ({
      all: submissions.length,
      pending: submissions.filter(
        (item) =>
          item.reviewStatus ===
          "pending"
      ).length,
      approved: submissions.filter(
        (item) =>
          item.reviewStatus ===
          "approved"
      ).length,
      rejected: submissions.filter(
        (item) =>
          item.reviewStatus ===
          "rejected"
      ).length,
    }),
    [submissions]
  );

  async function copyPaymentLink(
    submissionId: string
  ) {
    const paymentUrl =
      `${window.location.origin}/artist-promotion/payment`;

    try {
      await navigator.clipboard.writeText(
        paymentUrl
      );
      setCopiedPaymentId(submissionId);
      window.setTimeout(
        () => setCopiedPaymentId(null),
        2500
      );
    } catch {
      setErrorMessage(
        "The payment link could not be copied. Open the customer payment page and copy the browser address."
      );
    }
  }

  async function reviewSubmission(
    submissionId: string,
    action: "approve" | "reject", reasonOverride?: string
  ) {
    if (!user) return;

    const rejectionReason =
      reasonOverride?.trim() || rejectionReasons[submissionId]?.trim() ||
      "";

    if (
      action === "reject" &&
      !rejectionReason
    ) {
      setErrorMessage(
        "Enter a rejection reason before rejecting the submission."
      );
      return;
    }

    setReviewingId(submissionId);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const token =
        await user.getIdToken();

      const response = await fetch(
        "/api/owner/artist-promotions",
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
            action,
            rejectionReason:
              action === "reject"
                ? rejectionReason
                : null,
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
            "The submission could not be reviewed."
        );
      }

      setSubmissions((current) =>
        current.map((submission) =>
          submission.submissionId ===
          submissionId
            ? {
                ...submission,
                reviewStatus:
                  data.reviewStatus,
                paymentStatus:
                  data.paymentStatus,
                placementStatus:
                  data.placementStatus,
                reviewedAt:
                  data.reviewedAt ||
                  new Date().toISOString(),
                rejectionReason:
                  data.rejectionReason ||
                  null,
              }
            : submission
        )
      );

      setSuccessMessage(
        action === "approve"
          ? "The submission was approved. The payment request is ready below."
          : "The submission was rejected."
      );

      if (action === "approve") {
        setFilter("approved");
        window.setTimeout(() => {
          document
            .getElementById(
              `artist-submission-${submissionId}`
            )
            ?.scrollIntoView({
              behavior: "smooth",
              block: "center",
            });
        }, 100);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The submission could not be reviewed."
      );
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
      setErrorMessage(
        "Choose a start date, end date, and placement location."
      );
      return;
    }

    setReviewingId(submissionId);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const token =
        await user.getIdToken();

      const response = await fetch(
        "/api/owner/artist-promotions",
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
            "The promotion could not be scheduled."
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

      setSuccessMessage(
        "The paid promotion was scheduled successfully."
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The promotion could not be scheduled."
      );
    } finally {
      setReviewingId(null);
    }
  }

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center px-6">
        <p className="text-white/70">
          Loading owner access...
        </p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="grid min-h-screen place-items-center px-5 pb-20 pt-52">
        <section className="w-full max-w-xl rounded-[2rem] border border-white/10 bg-white/[0.04] p-8 text-center">
          <h1 className="text-4xl font-black">
            Sign in required
          </h1>
          <Link
            href="/account"
            className="mt-7 inline-flex rounded-2xl bg-white px-6 py-4 font-black text-black"
          >
            Open Account
          </Link>
        </section>
      </main>
    );
  }

  if (!isOwner) {
    return (
      <main className="grid min-h-screen place-items-center px-5 pb-20 pt-52">
        <section className="w-full max-w-xl rounded-[2rem] border border-red-400/20 bg-red-400/10 p-8 text-center">
          <h1 className="text-4xl font-black">
            Owner access only
          </h1>
          <Link
            href="/"
            className="mt-7 inline-flex rounded-2xl bg-white px-6 py-4 font-black text-black"
          >
            Return Home
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-5 pb-40 pt-52 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <section className="rounded-[2.5rem] border border-violet-300/20 bg-gradient-to-br from-violet-700/25 via-black/50 to-cyan-500/15 p-8 shadow-2xl sm:p-12">
          <p className="text-sm font-black uppercase tracking-[0.22em] text-emerald-300">
            Owner Review
          </p>

          <h1 className="mt-4 text-5xl font-black sm:text-7xl">
            Artist Promotion Submissions
          </h1>

          <p className="mt-5 max-w-3xl text-lg leading-8 text-white/60">
            Review uploaded songs and artwork, listen to each submission, and approve or reject it before payment and placement.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/developer"
              className="rounded-2xl bg-white px-5 py-4 font-black text-black"
            >
              Owner Dashboard
            </Link>

            <Link
              href="/artist-promotion"
              className="rounded-2xl border border-white/15 bg-white/5 px-5 py-4 font-black"
            >
              Public Submission Page
            </Link>
          </div>
        </section>

        <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="All"
            value={counts.all}
          />
          <StatCard
            label="Pending"
            value={counts.pending}
          />
          <StatCard
            label="Approved"
            value={counts.approved}
          />
          <StatCard
            label="Rejected"
            value={counts.rejected}
          />
        </section>

        <section className="mt-8 rounded-[2rem] border border-white/10 bg-white/[0.035] p-5 sm:p-6">
          <div className="flex flex-wrap gap-2">
            {(
              [
                "pending",
                "approved",
                "rejected",
                "all",
              ] as FilterValue[]
            ).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() =>
                  setFilter(value)
                }
                className={`rounded-full px-4 py-2 text-sm font-black capitalize ${
                  filter === value
                    ? "bg-white text-black"
                    : "border border-white/10 bg-white/5 text-white/65"
                }`}
              >
                {value}
              </button>
            ))}
          </div>

          {successMessage ? (
            <p className="mt-5 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4 text-emerald-200">
              {successMessage}
            </p>
          ) : null}

          {errorMessage ? (
            <p className="mt-5 rounded-2xl border border-red-300/20 bg-red-300/10 p-4 text-red-200">
              {errorMessage}
            </p>
          ) : null}
        </section>

        <section className="mt-8 grid gap-6">
          {loadingSubmissions ? (
            <div className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-10 text-center text-white/55">
              Loading submissions...
            </div>
          ) : visibleSubmissions.length ===
            0 ? (
            <div className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-10 text-center text-white/55">
              No {filter === "all" ? "" : filter} submissions found.
            </div>
          ) : (
            visibleSubmissions.map(
              (submission) => (
                <article
                  id={`artist-submission-${submission.submissionId}`}
                  key={
                    submission.submissionId
                  }
                  className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.035]"
                >
                  <div className="grid gap-6 p-6 lg:grid-cols-[240px_minmax(0,1fr)]">
                    <div>
                      {submission.artworkUrl ? (
                        <img
                          src={
                            submission.artworkUrl
                          }
                          alt={`${submission.songTitle} artwork`}
                          className="aspect-square w-full rounded-2xl object-cover"
                        />
                      ) : (
                        <div className="grid aspect-square place-items-center rounded-2xl border border-white/10 bg-black/20 text-white/35">
                          Artwork unavailable
                        </div>
                      )}

                      <span
                        className={`mt-4 inline-flex rounded-full border px-3 py-1 text-xs font-black uppercase tracking-[0.14em] ${
                          submission.reviewStatus ===
                          "approved"
                            ? "border-emerald-300/20 bg-emerald-300/10 text-emerald-200"
                            : submission.reviewStatus ===
                                "rejected"
                              ? "border-red-300/20 bg-red-300/10 text-red-200"
                              : "border-amber-300/20 bg-amber-300/10 text-amber-100"
                        }`}
                      >
                        {
                          submission.reviewStatus
                        }
                      </span>
                    </div>

                    <div className="min-w-0">
                      <p className="text-sm font-black uppercase tracking-[0.16em] text-violet-300">
                        {
                          submission.artistName
                        }
                      </p>

                      <h2 className="mt-2 text-4xl font-black">
                        {
                          submission.songTitle
                        }
                      </h2>

                      <p className="mt-2 text-white/45">
                        {submission.genre} •{" "}
                        {
                          submission.promotionDurationDays
                        }{" "}
                        days
                      </p>

                      <p className="mt-5 max-w-3xl leading-7 text-white/60">
                        {
                          submission.description
                        }
                      </p>

                      <div className="mt-5 grid gap-3 sm:grid-cols-2">
                        <InfoBox
                          label="Account email"
                          value={
                            submission.artistAccountEmail ||
                            "Not available"
                          }
                        />
                        <InfoBox
                          label="Submitted"
                          value={
                            submission.createdAt
                              ? new Date(
                                  submission.createdAt
                                ).toLocaleString(
                                  "en-US"
                                )
                              : "Not available"
                          }
                        />
                        <InfoBox
                          label="Payment status"
                          value={
                            submission.paymentStatus
                          }
                        />
                        <InfoBox
                          label="Placement status"
                          value={
                            submission.placementStatus
                          }
                        />
                      </div>

                      {submission.socialLink ? (
                        <a
                          href={
                            submission.socialLink
                          }
                          target="_blank"
                          rel="noreferrer"
                          className="mt-5 inline-flex font-black text-cyan-300"
                        >
                          Open artist link
                        </a>
                      ) : null}

                      {getYouTubeEmbedUrl(
                        submission.youtubeLink
                      ) ? (
                        <div className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-black/20 p-4">
                          <p className="mb-3 text-sm font-black uppercase tracking-[0.14em] text-fuchsia-300">
                            YouTube Video Preview
                          </p>
                          <div className="aspect-video overflow-hidden rounded-xl bg-black">
                            <iframe
                              src={
                                getYouTubeEmbedUrl(
                                  submission.youtubeLink
                                ) || undefined
                              }
                              title={`${submission.songTitle} YouTube preview`}
                              className="h-full w-full"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                              allowFullScreen
                            />
                          </div>
                        </div>
                      ) : null}

                      {submission.songUrl ? (
                        <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4">
                          <p className="mb-3 text-sm font-black uppercase tracking-[0.14em] text-emerald-300">
                            Song Preview
                          </p>
                          <audio
                            controls
                            preload="metadata"
                            src={
                              submission.songUrl
                            }
                            className="w-full"
                          />
                        </div>
                      ) : (
                        <p className="mt-6 rounded-2xl border border-red-300/20 bg-red-300/10 p-4 text-red-200">
                          Song preview unavailable.
                        </p>
                      )}

                      {submission.reviewStatus ===
                      "pending" ? (
                        <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-5">
                          <label className="grid gap-2">
                            <span className="text-sm font-black text-white/70">
                              Rejection reason
                            </span>
                            <textarea
                              rows={3}
                              value={
                                rejectionReasons[
                                  submission
                                    .submissionId
                                ] || ""
                              }
                              onChange={(
                                event
                              ) =>
                                setRejectionReasons(
                                  (current) => ({
                                    ...current,
                                    [submission.submissionId]:
                                      event
                                        .target
                                        .value,
                                  })
                                )
                              }
                              placeholder="Required only when rejecting"
                              className="rounded-2xl border border-white/10 bg-black/25 px-4 py-4 outline-none focus:border-violet-400"
                            />
                          </label>

                          <div className="mt-4 flex flex-wrap gap-3">
                            <button
                              type="button"
                              disabled={
                                reviewingId ===
                                submission
                                  .submissionId
                              }
                              onClick={() =>
                                reviewSubmission(
                                  submission.submissionId,
                                  "approve"
                                )
                              }
                              className="rounded-2xl bg-emerald-300 px-5 py-4 font-black text-black disabled:opacity-50"
                            >
                              {reviewingId ===
                              submission.submissionId
                                ? "Saving..."
                                : "Approve"}
                            </button>

                            <button
                              type="button"
                              disabled={
                                reviewingId ===
                                submission
                                  .submissionId
                              }
                              onClick={() =>
                                reviewSubmission(
                                  submission.submissionId,
                                  "reject"
                                )
                              }
                              className="rounded-2xl border border-red-300/20 bg-red-300/10 px-5 py-4 font-black text-red-200 disabled:opacity-50"
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      ) : null}

                      {submission.reviewStatus ===
                        "approved" &&
                      submission.paymentStatus !==
                        "paid" ? (
                        <div className="mt-6 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-5">
                          <p className="font-black text-amber-100">
                            Payment required
                          </p>
                          <p className="mt-2 text-sm text-amber-100/75">
                            Approved price: $
                            {(
                              PROMOTION_PRICES[
                                submission.promotionDurationDays
                              ] || 0
                            ).toFixed(2)}{" "}
                            USD for{" "}
                            {
                              submission.promotionDurationDays
                            }{" "}
                            days.
                          </p>
                          <p className="mt-2 text-sm text-amber-100/75">
                            Send the payment link to{" "}
                            {submission.artistAccountEmail ||
                              "the artist"}. They must sign in with the same account used for this submission.
                          </p>
                          <button
                            type="button"
                            onClick={() =>
                              copyPaymentLink(
                                submission.submissionId
                              )
                            }
                            className="mt-4 rounded-xl bg-white px-4 py-3 font-black text-black"
                          >
                            {copiedPaymentId ===
                            submission.submissionId
                              ? "Payment Link Copied"
                              : "Copy Artist Payment Link"}
                          </button>
                        </div>
                      ) : null}

                      {submission.reviewStatus ===
                        "approved" &&
                      submission.paymentStatus ===
                        "paid" &&
                      submission.placementStatus !==
                        "scheduled" ? (
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
                                  scheduleValues[
                                    submission
                                      .submissionId
                                  ]?.startDate ||
                                  ""
                                }
                                onChange={(event) =>
                                  setScheduleValues(
                                    (current) => ({
                                      ...current,
                                      [submission.submissionId]:
                                        {
                                          startDate:
                                            event
                                              .target
                                              .value,
                                          endDate:
                                            current[
                                              submission
                                                .submissionId
                                            ]
                                              ?.endDate ||
                                            "",
                                          placementLocation:
                                            current[
                                              submission
                                                .submissionId
                                            ]
                                              ?.placementLocation ||
                                            "homepage",
                                        },
                                    })
                                  )
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
                                  scheduleValues[
                                    submission
                                      .submissionId
                                  ]?.endDate ||
                                  ""
                                }
                                onChange={(event) =>
                                  setScheduleValues(
                                    (current) => ({
                                      ...current,
                                      [submission.submissionId]:
                                        {
                                          startDate:
                                            current[
                                              submission
                                                .submissionId
                                            ]
                                              ?.startDate ||
                                            "",
                                          endDate:
                                            event
                                              .target
                                              .value,
                                          placementLocation:
                                            current[
                                              submission
                                                .submissionId
                                            ]
                                              ?.placementLocation ||
                                            "homepage",
                                        },
                                    })
                                  )
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
                                  scheduleValues[
                                    submission
                                      .submissionId
                                  ]?.placementLocation ||
                                  "homepage"
                                }
                                onChange={(event) =>
                                  setScheduleValues(
                                    (current) => ({
                                      ...current,
                                      [submission.submissionId]:
                                        {
                                          startDate:
                                            current[
                                              submission
                                                .submissionId
                                            ]
                                              ?.startDate ||
                                            "",
                                          endDate:
                                            current[
                                              submission
                                                .submissionId
                                            ]
                                              ?.endDate ||
                                            "",
                                          placementLocation:
                                            event
                                              .target
                                              .value,
                                        },
                                    })
                                  )
                                }
                                className="rounded-2xl border border-white/10 bg-black/25 px-4 py-4"
                              >
                                <option value="homepage">
                                  Homepage
                                </option>
                                <option value="store">
                                  Store
                                </option>
                                <option value="radio">
                                  Premium Radio
                                </option>
                                <option value="tv">
                                  Premium TV
                                </option>
                              </select>
                            </label>
                          </div>

                          <button
                            type="button"
                            disabled={
                              reviewingId ===
                              submission
                                .submissionId
                            }
                            onClick={() =>
                              scheduleSubmission(
                                submission.submissionId
                              )
                            }
                            className="mt-4 rounded-2xl bg-cyan-200 px-5 py-4 font-black text-black disabled:opacity-50"
                          >
                            {reviewingId ===
                            submission.submissionId
                              ? "Scheduling..."
                              : "Schedule Promotion"}
                          </button>
                        </div>
                      ) : null}

                      {submission.placementStatus ===
                        "scheduled" ? (
                        <div className="mt-6 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-5 text-emerald-100">
                          <p className="font-black">
                            Promotion scheduled
                          </p>
                          <p className="mt-2 text-sm">
                            {submission.placementLocation ||
                              "placement"}{" "}
                            •{" "}
                            {submission.scheduleStartDate ||
                              "start date"}{" "}
                            to{" "}
                            {submission.scheduleEndDate ||
                              "end date"}
                          </p>
                          <p className="mt-2 text-xs uppercase tracking-[0.14em] text-emerald-200">
                            Label: Promoted
                          </p>
                        </div>
                      ) : null}

                      {submission.reviewStatus === "approved" ? (<button type="button" disabled={reviewingId === submission.submissionId} onClick={() => reviewSubmission(submission.submissionId, "reject", "Removed after testing.")} className="mt-6 rounded-2xl border border-red-300/20 bg-red-300/10 px-5 py-4 font-black text-red-200 disabled:opacity-50">{reviewingId === submission.submissionId ? "Deactivating..." : "Deactivate Promotion"}</button>) : null}

{submission.rejectionReason ? (
                        <p className="mt-5 rounded-2xl border border-red-300/20 bg-red-300/10 p-4 text-red-200">
                          Rejection reason:{" "}
                          {
                            submission.rejectionReason
                          }
                        </p>
                      ) : null}
                    </div>
                  </div>
                </article>
              )
            )
          )}
        </section>
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
      <p className="text-sm text-white/50">
        {label}
      </p>
      <p className="mt-2 text-4xl font-black">
        {value}
      </p>
    </article>
  );
}

function InfoBox({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <p className="text-xs uppercase tracking-[0.14em] text-white/35">
        {label}
      </p>
      <p className="mt-2 break-all font-bold text-white/80">
        {value}
      </p>
    </div>
  );
}



