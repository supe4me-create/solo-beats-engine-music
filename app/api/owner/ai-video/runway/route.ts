import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { FieldValue } from "firebase-admin/firestore";
import RunwayML from "@runwayml/sdk";

import {
  adminDb,
  firebaseAdminApp,
} from "../../../../../lib/firebaseAdmin";

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

async function verifyOwner(
  request: Request
) {
  const idToken =
    getBearerToken(request);

  if (!idToken) {
    throw new Error("UNAUTHORIZED");
  }

  const decoded =
    await getAuth(
      firebaseAdminApp
    ).verifyIdToken(idToken);

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
    await verifyOwner(request);

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

    const client =
      new RunwayML({
        apiKey:
          process.env
            .RUNWAYML_API_SECRET,
      });

    await jobReference.set(
      {
        provider: "runway",
        status:
          "submitting_to_provider",
        progress: 5,
        error: null,
        updatedAt:
          FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    const runwayResponse =
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
          body: JSON.stringify({
            model: "gen4.5",
            promptText: prompt,
            ratio,
            duration,
          }),
        }
      );

    const runwayData =
      (await runwayResponse.json()) as {
        id?: string;
        error?: string;
        message?: string;
      };

    if (
      !runwayResponse.ok ||
      !runwayData.id
    ) {
      throw new Error(
        runwayData.error ||
        runwayData.message ||
        `Runway text-to-video request failed with status ${runwayResponse.status}.`
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
    await verifyOwner(request);

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
        error: message,
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