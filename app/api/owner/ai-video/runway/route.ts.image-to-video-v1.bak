import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";
import RunwayML from "@runwayml/sdk";

import {
  adminDb,
  firebaseAdminApp,
} from "../../../../../lib/firebaseAdmin";

import {
  requirePremiumAccess,
} from "../../../../../lib/requirePremium";

import {
  getAiVideoCreditCost,
} from "../../../../../lib/aiVideoCredits";

const OWNER_EMAIL = "supe4.me@gmail.com";

function getBearerToken(
  request: Request
): string | null {
  const authorization =
    request.headers.get("authorization");

  if (!authorization) {
    return null;
  }

  const match =
    authorization.match(/^Bearer\s+(.+)$/i);

  return match?.[1]?.trim() || null;
}

async function verifyAuthenticatedUser(
  request: Request
) {
  const idToken =
    getBearerToken(request);

  if (!idToken) {
    throw new Error("UNAUTHORIZED");
  }

  try {
    return await getAuth(
      firebaseAdminApp
    ).verifyIdToken(idToken);
  } catch {
    throw new Error("UNAUTHORIZED");
  }
}

async function verifyOwner(
  request: Request
) {
  const decoded =
    await verifyAuthenticatedUser(
      request
    );

  const email =
    typeof decoded.email === "string"
      ? decoded.email.toLowerCase()
      : "";

  if (email !== OWNER_EMAIL) {
    throw new Error("FORBIDDEN");
  }

  return decoded;
}

function errorResponse(
  error: unknown
) {
  if (
    error instanceof Error &&
    error.message === "UNAUTHORIZED"
  ) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Owner authentication is required.",
      },
      { status: 401 }
    );
  }

  if (
    error instanceof Error &&
    error.message === "FORBIDDEN"
  ) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Owner access only.",
      },
      { status: 403 }
    );
  }

  console.error(
    "Runway AI video error:",
    error
  );

  return NextResponse.json(
    {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Runway request failed.",
    },
    { status: 500 }
  );
}

function runwayRatio(
  aspectRatio: unknown
):
  | "1280:720"
  | "720:1280"
  | null {
  if (aspectRatio === "16:9") {
    return "1280:720";
  }

  if (aspectRatio === "9:16") {
    return "720:1280";
  }

  return null;
}

export async function POST(
  request: Request
) {
  try {
    const decoded =
      await verifyAuthenticatedUser(
        request
      );

    const authenticatedEmail =
      typeof decoded.email === "string"
        ? decoded.email.toLowerCase()
        : "";

    const isOwner =
      authenticatedEmail === OWNER_EMAIL;

    if (!isOwner) {
      const premiumAccess =
        await requirePremiumAccess(
          request
        );

      if (!premiumAccess.allowed) {
        return NextResponse.json(
          {
            success: false,
            error:
              premiumAccess.error,
          },
          {
            status:
              premiumAccess.statusCode,
          }
        );
      }

      if (
        premiumAccess.uid !==
        decoded.uid
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Premium account verification failed.",
          },
          { status: 403 }
        );
      }
    }

    if (!process.env.RUNWAYML_API_SECRET) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Runway API key is not configured.",
        },
        { status: 500 }
      );
    }

    const body =
      (await request.json()) as {
        jobId?: unknown;
      };

    const jobId =
      typeof body.jobId === "string"
        ? body.jobId.trim()
        : "";

    if (!jobId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "AI video job ID is required.",
        },
        { status: 400 }
      );
    }

    const jobReference =
      adminDb
        .collection("aiVideoJobs")
        .doc(jobId);

    const snapshot =
      await jobReference.get();

    if (!snapshot.exists) {
      return NextResponse.json(
        {
          success: false,
          error:
            "AI video job was not found.",
        },
        { status: 404 }
      );
    }

    const job =
      snapshot.data() || {};

    if (job.mode !== "text") {
      return NextResponse.json(
        {
          success: false,
          error:
            "Step 3B-2 currently supports Text to Video only.",
        },
        { status: 400 }
      );
    }

    const prompt =
      typeof job.prompt === "string"
        ? job.prompt.trim()
        : "";

    if (!prompt) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Generation prompt is empty.",
        },
        { status: 400 }
      );
    }

    const ratio =
      runwayRatio(
        job.aspectRatio
      );

    if (!ratio) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Runway Text to Video currently requires 16:9 or 9:16 in this integration.",
        },
        { status: 400 }
      );
    }

    const duration =
      Number(job.duration);

    if (
      duration !== 5 &&
      duration !== 10
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "For the first Runway connection, choose 5 or 10 seconds.",
        },
        { status: 400 }
      );
    }

    
let creditCost = 0;
let creditBalance:
  number | null = null;

if (!isOwner) {
  creditCost =
    getAiVideoCreditCost(
      duration
    );

  const creditAccountReference =
    adminDb
      .collection(
        "aiVideoCredits"
      )
      .doc(decoded.uid);

  const creditLedgerReference =
    creditAccountReference
      .collection("ledger")
      .doc(
        `runway_${jobId}`
      );

  const chargeResult =
    await adminDb.runTransaction(
      async (transaction) => {
        const creditSnapshot =
          await transaction.get(
            creditAccountReference
          );

        const latestJobSnapshot =
          await transaction.get(
            jobReference
          );

        if (
          !latestJobSnapshot.exists
        ) {
          return {
            success: false as const,
            reason:
              "JOB_NOT_FOUND" as const,
            balance: 0,
          };
        }

        const latestJob =
          latestJobSnapshot.data() || {};

        const creditData =
          creditSnapshot.exists
            ? creditSnapshot.data() || {}
            : {};

        const currentBalance =
          typeof creditData.balance ===
            "number" &&
          Number.isFinite(
            creditData.balance
          )
            ? Math.max(
                0,
                Math.floor(
                  creditData.balance
                )
              )
            : 0;

        if (
          latestJob.ownerUid !==
          decoded.uid
        ) {
          return {
            success: false as const,
            reason:
              "JOB_FORBIDDEN" as const,
            balance:
              currentBalance,
          };
        }

        if (
          latestJob.creditCharged ===
          true
        ) {
          return {
            success: true as const,
            alreadyCharged: true,
            balance:
              currentBalance,
          };
        }

        if (
          currentBalance <
          creditCost
        ) {
          return {
            success: false as const,
            reason:
              "INSUFFICIENT_CREDITS" as const,
            balance:
              currentBalance,
          };
        }

        const newBalance =
          currentBalance -
          creditCost;

        transaction.set(
          creditAccountReference,
          {
            balance:
              newBalance,
            updatedAt:
              FieldValue.serverTimestamp(),
          },
          {
            merge: true,
          }
        );

        transaction.set(
          jobReference,
          {
            creditCharged: true,
            creditCost,
            creditChargedUid:
              decoded.uid,
            creditBalanceAfter:
              newBalance,
            creditChargedAt:
              FieldValue.serverTimestamp(),
            updatedAt:
              FieldValue.serverTimestamp(),
          },
          {
            merge: true,
          }
        );

        transaction.set(
          creditLedgerReference,
          {
            type: "debit",
            amount:
              creditCost,
            reason:
              "ai_video_generation",
            jobId,
            provider:
              "runway",
            duration,
            balanceBefore:
              currentBalance,
            balanceAfter:
              newBalance,
            createdAt:
              FieldValue.serverTimestamp(),
          }
        );

        return {
          success: true as const,
          alreadyCharged: false,
          balance:
            newBalance,
        };
      }
    );

  if (!chargeResult.success) {
    if (
      chargeResult.reason ===
      "INSUFFICIENT_CREDITS"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            `Not enough AI Video credits. This generation requires ${creditCost} credit${creditCost === 1 ? "" : "s"}.`,
          creditsRequired:
            creditCost,
          creditsAvailable:
            chargeResult.balance,
        },
        { status: 402 }
      );
    }

    if (
      chargeResult.reason ===
      "JOB_FORBIDDEN"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "You do not have access to this AI video job.",
        },
        { status: 403 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error:
          "AI video job was not found.",
      },
      { status: 404 }
    );
  }

  creditBalance =
    chargeResult.balance;
}
    /*
     * AI_VIDEO_PROVIDER_SUBMISSION_LOCK
     *
     * Atomically reserve this SOLO BEATS job before calling Runway.
     * This prevents two simultaneous POST requests from starting
     * two provider tasks for the same job.
     */
    const submissionGuard =
      await adminDb.runTransaction(
        async (transaction) => {
          const submissionSnapshot =
            await transaction.get(
              jobReference
            );

          if (
            !submissionSnapshot.exists
          ) {
            return {
              action:
                "missing" as const,
            };
          }

          const submissionJob =
            submissionSnapshot.data() ||
            {};

          const existingProviderJobId =
            typeof submissionJob
              .providerJobId ===
              "string"
              ? submissionJob
                  .providerJobId
                  .trim()
              : "";

          if (
            existingProviderJobId
          ) {
            return {
              action:
                "existing" as const,
              providerJobId:
                existingProviderJobId,
              status:
                typeof submissionJob
                  .status ===
                  "string"
                  ? submissionJob.status
                  : "submitted",
              progress:
                typeof submissionJob
                  .progress ===
                  "number"
                  ? submissionJob.progress
                  : 10,
            };
          }

          if (
            submissionJob
              .providerSubmissionLocked ===
              true ||
            submissionJob.status ===
              "submitting_to_provider"
          ) {
            return {
              action:
                "locked" as const,
            };
          }

          transaction.set(
            jobReference,
            {
              provider:
                "runway",
              providerSubmissionLocked:
                true,
              providerSubmissionState:
                "reserved",
              providerSubmissionLockedAt:
                FieldValue.serverTimestamp(),
              status:
                "submitting_to_provider",
              progress: 5,
              error: null,
              updatedAt:
                FieldValue.serverTimestamp(),
            },
            {
              merge: true,
            }
          );

          return {
            action:
              "reserved" as const,
          };
        }
      );

    if (
      submissionGuard.action ===
      "missing"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "AI video job was not found.",
        },
        { status: 404 }
      );
    }

    if (
      submissionGuard.action ===
      "existing"
    ) {
      return NextResponse.json({
        success: true,
        jobId,
        provider:
          "runway",
        providerJobId:
          submissionGuard
            .providerJobId,
        status:
          submissionGuard.status,
        progress:
          submissionGuard.progress,
        duplicateSubmissionPrevented:
          true,
        message:
          "This AI video job was already submitted to Runway.",
      });
    }

    if (
      submissionGuard.action ===
      "locked"
    ) {
      return NextResponse.json(
        {
          success: false,
          jobId,
          provider:
            "runway",
          status:
            "submitting_to_provider",
          duplicateSubmissionPrevented:
            true,
          error:
            "This AI video job is already being submitted to Runway.",
        },
        { status: 409 }
      );
    }
    async function rejectProviderSubmission(
      failureMessage: string
    ) {
      await adminDb.runTransaction(
        async (transaction) => {
          const latestSnapshot =
            await transaction.get(
              jobReference
            );

          if (!latestSnapshot.exists) {
            return;
          }

          const latestJob =
            latestSnapshot.data() ||
            {};

          let refundAmount = 0;
          let refundUid = "";
          let newBalance:
            number | null = null;

          const chargedCredits =
            typeof latestJob.creditCost ===
              "number" &&
            Number.isFinite(
              latestJob.creditCost
            )
              ? Math.max(
                  0,
                  Math.floor(
                    latestJob.creditCost
                  )
                )
              : 0;

          const chargedUid =
            typeof latestJob
              .creditChargedUid ===
              "string"
              ? latestJob
                  .creditChargedUid
                  .trim()
              : "";

          if (
            latestJob.creditCharged ===
              true &&
            latestJob.creditRefunded !==
              true &&
            chargedUid &&
            chargedCredits > 0
          ) {
            const creditReference =
              adminDb
                .collection(
                  "aiVideoCredits"
                )
                .doc(
                  chargedUid
                );

            const creditSnapshot =
              await transaction.get(
                creditReference
              );

            const creditData =
              creditSnapshot.exists
                ? creditSnapshot.data() ||
                  {}
                : {};

            const currentBalance =
              typeof creditData.balance ===
                "number" &&
              Number.isFinite(
                creditData.balance
              )
                ? Math.max(
                    0,
                    Math.floor(
                      creditData.balance
                    )
                  )
                : 0;

            newBalance =
              currentBalance +
              chargedCredits;

            const refundLedgerReference =
              creditReference
                .collection(
                  "ledger"
                )
                .doc(
                  `runway_refund_${jobId}`
                );

            transaction.set(
              creditReference,
              {
                balance:
                  newBalance,
                updatedAt:
                  FieldValue.serverTimestamp(),
              },
              {
                merge: true,
              }
            );

            transaction.set(
              refundLedgerReference,
              {
                type:
                  "credit",
                amount:
                  chargedCredits,
                reason:
                  "ai_video_generation_refund",
                refundStage:
                  "provider_submission",
                jobId,
                provider:
                  "runway",
                providerStatus:
                  "rejected",
                balanceBefore:
                  currentBalance,
                balanceAfter:
                  newBalance,
                createdAt:
                  FieldValue.serverTimestamp(),
              },
              {
                merge: true,
              }
            );

            refundAmount =
              chargedCredits;

            refundUid =
              chargedUid;
          }

          transaction.set(
            jobReference,
            {
              providerSubmissionLocked:
                false,
              providerSubmissionState:
                "rejected",
              providerSubmissionFailedAt:
                FieldValue.serverTimestamp(),
              status:
                "failed",
              progress: 0,
              error:
                failureMessage,

              ...(refundAmount > 0
                ? {
                    creditRefunded:
                      true,
                    creditRefundAmount:
                      refundAmount,
                    creditRefundUid:
                      refundUid,
                    creditBalanceAfterRefund:
                      newBalance,
                    creditRefundReason:
                      "provider_submission_rejected",
                    creditRefundedAt:
                      FieldValue.serverTimestamp(),
                  }
                : {}),

              updatedAt:
                FieldValue.serverTimestamp(),
            },
            {
              merge: true,
            }
          );
        }
      );
    }

    let runwayResponse:
      Response;

    try {
      runwayResponse =
        await fetch(
          "https://api.dev.runwayml.com/v1/text_to_video",
          {
            method: "POST",
            headers: {
              Authorization:
                `Bearer ${process.env.RUNWAYML_API_SECRET}`,
              "Content-Type":
                "application/json",
              "X-Runway-Version":
                "2024-11-06",
            },
            body:
              JSON.stringify({
                model:
                  "gen4.5",
                promptText:
                  prompt,
                ratio,
                duration,
              }),
          }
        );
    } catch (providerNetworkError) {
      const networkMessage =
        providerNetworkError instanceof
          Error
          ? providerNetworkError.message
          : "Runway submission network failure.";

      /*
       * IMPORTANT:
       * We do NOT unlock/refund here.
       * The request may have reached Runway even though
       * we did not receive the response.
       */
      await jobReference.set(
        {
          providerSubmissionLocked:
            true,
          providerSubmissionState:
            "unknown",
          status:
            "submission_unknown",
          error:
            `Runway submission result is unknown: ${networkMessage}`,
          providerSubmissionUnknownAt:
            FieldValue.serverTimestamp(),
          updatedAt:
            FieldValue.serverTimestamp(),
        },
        {
          merge: true,
        }
      );

      return NextResponse.json(
        {
          success: false,
          jobId,
          provider:
            "runway",
          status:
            "submission_unknown",
          duplicateSubmissionPrevented:
            true,
          error:
            "The Runway submission result could not be confirmed. This job has been locked to prevent duplicate provider charges.",
        },
        {
          status: 502,
        }
      );
    }

    let runwayData: {
      id?: string;
      error?: string;
      message?: string;
    } = {};

    try {
      runwayData =
        (await runwayResponse.json()) as {
          id?: string;
          error?: string;
          message?: string;
        };
    } catch {
      runwayData = {};
    }

    if (!runwayResponse.ok) {
      const providerMessage =
        runwayData.error ||
        runwayData.message ||
        `Runway text-to-video request failed with status ${runwayResponse.status}.`;

      await rejectProviderSubmission(
        providerMessage
      );

      const rejectedJobSnapshot =
        await jobReference.get();

      const rejectedJob =
        rejectedJobSnapshot.exists
          ? rejectedJobSnapshot.data() || {}
          : {};

      const providerRejectionCreditsRefunded =
        rejectedJob.creditRefunded === true &&
        rejectedJob.creditRefundReason ===
          "provider_submission_rejected";

      return NextResponse.json(
        {
          success: false,
          jobId,
          provider:
            "runway",
          status:
            "failed",
          creditsRefunded:
            providerRejectionCreditsRefunded,
          error:
            providerMessage,
        },
        {
          status: 502,
        }
      );
    }

    if (!runwayData.id) {
      /*
       * A successful HTTP response without a task ID is ambiguous.
       * Do not unlock and do not submit again automatically.
       */
      await jobReference.set(
        {
          providerSubmissionLocked:
            true,
          providerSubmissionState:
            "unknown",
          status:
            "submission_unknown",
          error:
            "Runway accepted the request but did not return a task ID.",
          providerSubmissionUnknownAt:
            FieldValue.serverTimestamp(),
          updatedAt:
            FieldValue.serverTimestamp(),
        },
        {
          merge: true,
        }
      );

      return NextResponse.json(
        {
          success: false,
          jobId,
          provider:
            "runway",
          status:
            "submission_unknown",
          duplicateSubmissionPrevented:
            true,
          error:
            "Runway did not return a task ID. The job has been locked to prevent a duplicate provider charge.",
        },
        {
          status: 502,
        }
      );
    }
const createdTask = {
      id: runwayData.id,
    };

    await jobReference.set(
      {
        provider: "runway",
        providerJobId:
          createdTask.id,
        providerSubmissionLocked:
          false,
        providerSubmissionState:
          "submitted",
        providerSubmittedAt:
          FieldValue.serverTimestamp(),
        status: "submitted",
        progress: 10,
        error: null,
        updatedAt:
          FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return NextResponse.json({
      success: true,
      jobId,
      provider: "runway",
      providerJobId:
        createdTask.id,
      status: "submitted",
      progress: 10,
      message:
        "Runway generation started.",
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function GET(
  request: Request
) {
  try {
    const decoded =
      await verifyAuthenticatedUser(
        request
      );

    const authenticatedEmail =
      typeof decoded.email === "string"
        ? decoded.email.toLowerCase()
        : "";

    const isOwner =
      authenticatedEmail === OWNER_EMAIL;

    if (!isOwner) {
      const premiumAccess =
        await requirePremiumAccess(
          request
        );

      if (!premiumAccess.allowed) {
        return NextResponse.json(
          {
            success: false,
            error:
              premiumAccess.error,
          },
          {
            status:
              premiumAccess.statusCode,
          }
        );
      }

      if (
        premiumAccess.uid !==
        decoded.uid
      ) {
        return NextResponse.json(
          {
            success: false,
            error:
              "Premium account verification failed.",
          },
          { status: 403 }
        );
      }
    }

    if (!process.env.RUNWAYML_API_SECRET) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Runway API key is not configured.",
        },
        { status: 500 }
      );
    }

    const url =
      new URL(request.url);

    const jobId =
      url.searchParams
        .get("jobId")
        ?.trim() || "";

    if (!jobId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "AI video job ID is required.",
        },
        { status: 400 }
      );
    }

    const jobReference =
      adminDb
        .collection("aiVideoJobs")
        .doc(jobId);

    const snapshot =
      await jobReference.get();

    if (!snapshot.exists) {
      return NextResponse.json(
        {
          success: false,
          error:
            "AI video job was not found.",
        },
        { status: 404 }
      );
    }

    const job =
      snapshot.data() || {};

    if (
      !isOwner &&
      job.ownerUid !== decoded.uid
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "You do not have access to this AI video job.",
        },
        { status: 403 }
      );
    }

    const providerJobId =
      typeof job.providerJobId ===
      "string"
        ? job.providerJobId
        : "";

    if (!providerJobId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Runway task ID is missing.",
        },
        { status: 400 }
      );
    }

    const client =
      new RunwayML({
        apiKey:
          process.env
            .RUNWAYML_API_SECRET,
      });

    const task =
      await client.tasks.retrieve(
        providerJobId
      );

    const status =
      task.status;

    if (status === "SUCCEEDED") {
      const outputUrl =
        Array.isArray(task.output) &&
        typeof task.output[0] ===
          "string"
          ? task.output[0]
          : null;

      await jobReference.set(
        {
          status: "completed",
          progress: 100,
          outputUrl,
          error: null,
          updatedAt:
            FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      return NextResponse.json({
        success: true,
        jobId,
        providerJobId,
        providerStatus: status,
        status: "completed",
        progress: 100,
        outputUrl,
        message:
          "Runway video generation completed.",
      });
    }
    if (
      status === "FAILED" ||
      status === "CANCELLED"
    ) {
      const message =
        status === "FAILED"
          ? "Runway video generation failed."
          : "Runway video generation was cancelled.";

      let creditsRefunded = 0;

      let creditBalanceAfterRefund:
        number | null = null;

      await adminDb.runTransaction(
        async (transaction) => {
          const latestJobSnapshot =
            await transaction.get(
              jobReference
            );

          if (
            !latestJobSnapshot.exists
          ) {
            return;
          }

          const latestJob =
            latestJobSnapshot.data() ||
            {};

          if (
            latestJob.creditCharged !==
              true ||
            latestJob.creditRefunded ===
              true
          ) {
            return;
          }

          const chargedUid =
            typeof latestJob
              .creditChargedUid ===
              "string"
              ? latestJob
                  .creditChargedUid
                  .trim()
              : "";

          const chargedCredits =
            typeof latestJob
              .creditCost ===
              "number" &&
            Number.isFinite(
              latestJob.creditCost
            )
              ? Math.max(
                  0,
                  Math.floor(
                    latestJob.creditCost
                  )
                )
              : 0;

          if (
            !chargedUid ||
            chargedCredits <= 0
          ) {
            return;
          }

          const creditReference =
            adminDb
              .collection(
                "aiVideoCredits"
              )
              .doc(
                chargedUid
              );

          const creditSnapshot =
            await transaction.get(
              creditReference
            );

          const creditData =
            creditSnapshot.exists
              ? creditSnapshot.data() ||
                {}
              : {};

          const currentBalance =
            typeof creditData.balance ===
              "number" &&
            Number.isFinite(
              creditData.balance
            )
              ? Math.max(
                  0,
                  Math.floor(
                    creditData.balance
                  )
                )
              : 0;

          const newBalance =
            currentBalance +
            chargedCredits;

          const refundLedgerReference =
            creditReference
              .collection(
                "ledger"
              )
              .doc(
                `runway_refund_${jobId}`
              );

          transaction.set(
            creditReference,
            {
              balance:
                newBalance,
              updatedAt:
                FieldValue.serverTimestamp(),
            },
            {
              merge: true,
            }
          );

          transaction.set(
            refundLedgerReference,
            {
              type:
                "credit",
              amount:
                chargedCredits,
              reason:
                "ai_video_generation_refund",
              jobId,
              provider:
                "runway",
              providerJobId,
              providerStatus:
                status,
              balanceBefore:
                currentBalance,
              balanceAfter:
                newBalance,
              createdAt:
                FieldValue.serverTimestamp(),
            }
          );

          transaction.set(
            jobReference,
            {
              creditRefunded:
                true,
              creditRefundAmount:
                chargedCredits,
              creditRefundUid:
                chargedUid,
              creditBalanceAfterRefund:
                newBalance,
              creditRefundReason:
                status === "FAILED"
                  ? "provider_failed"
                  : "provider_cancelled",
              creditRefundedAt:
                FieldValue.serverTimestamp(),
            },
            {
              merge: true,
            }
          );

          creditsRefunded =
            chargedCredits;

          creditBalanceAfterRefund =
            newBalance;
        }
      );

      await jobReference.set(
        {
          status:
            status === "FAILED"
              ? "failed"
              : "canceled",
          error: message,
          updatedAt:
            FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      return NextResponse.json({
        success: false,
        jobId,
        providerJobId,
        providerStatus: status,
        status:
          status === "FAILED"
            ? "failed"
            : "canceled",
        error:
          creditsRefunded > 0
            ? `${message} ${creditsRefunded} AI Video credit${
                creditsRefunded === 1
                  ? ""
                  : "s"
              } refunded automatically.`
            : message,
        creditsRefunded,
        creditBalanceAfterRefund,
      });
    }

    await jobReference.set(
      {
        status: "generating",
        progress: 25,
        updatedAt:
          FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return NextResponse.json({
      success: true,
      jobId,
      providerJobId,
      providerStatus: status,
      status: "generating",
      progress: 25,
      outputUrl: null,
      message:
        `Runway status: ${status}`,
    });
  } catch (error) {
    return errorResponse(error);
  }
}







