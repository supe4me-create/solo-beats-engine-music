import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import ffmpegStatic from "ffmpeg-static";

import { adminBucket } from "../../../../lib/firebaseAdmin";
import { requireSchedulerCustomer } from "../../../../lib/socialSchedulerCustomer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function runAnalysis(file: string, seconds: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const binary = ffmpegStatic;
    if (!binary) {
      reject(new Error("FFmpeg is not available."));
      return;
    }

    const args = [
      "-hide_banner",
      "-nostdin",
      "-i", file,
      "-vn",
      "-t", "900",
      "-af",
      "astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.RMS_level",
      "-f", "null",
      "-"
    ];

    const child = spawn(binary, args, {
      windowsHide: true
    });

    let output = "";
    let stderr = "";

    child.stdout.on("data", chunk => {
      output += String(chunk);
      if (output.length > 2000000) {
        output = output.slice(-2000000);
      }
    });

    child.stderr.on("data", chunk => {
      stderr += String(chunk);
      if (stderr.length > 200000) {
        stderr = stderr.slice(-200000);
      }
    });

    child.on("error", reject);

    child.on("close", code => {
      if (code !== 0) {
        reject(new Error(stderr.slice(-1000) || "Audio analysis failed."));
        return;
      }
      resolve(output + "\n" + stderr);
    });
  });
}

function findBestStart(output: string, duration: number) {
  const frames: Array<{ time: number; db: number }> = [];
  let currentTime = 0;

  for (const line of output.split(/\r?\n/)) {
    const timestamp = line.match(/pts_time:([0-9.]+)/);
    if (timestamp) currentTime = Number(timestamp[1]);

    const level = line.match(
      /lavfi\.astats\.Overall\.RMS_level=([-+]?[0-9.]+)/
    );

    if (level) {
      const db = Number(level[1]);
      if (Number.isFinite(db) && currentTime <= 900) {
        frames.push({ time: currentTime, db });
      }
    }
  }

  if (!frames.length) {
    throw new Error("No usable audio energy detected. Select a start time manually.");
  }

  const lastTime = frames[frames.length - 1].time;
  if (lastTime < duration) {
    throw new Error("The video is shorter than the selected Short length.");
  }

  let bestStart = 0;
  let bestScore = -Infinity;

  // Compare candidate windows, prioritizing consistently
  // energetic audio and avoiding quiet sections.
  for (let start = 0; start + duration <= lastTime; start += 5) {
    let total = 0;
    let count = 0;
    let quiet = 0;

    for (const frame of frames) {
      if (frame.time >= start && frame.time < start + duration) {
        const value = Math.max(-90, Math.min(0, frame.db));
        total += value;
        count++;
        if (value < -45) quiet++;
      }
    }

    if (!count) continue;

    const score = total / count - (quiet / count) * 15;

    if (score > bestScore) {
      bestScore = score;
      bestStart = start;
    }
  }

  return Math.max(0, Math.floor(bestStart));
}

export async function POST(request: Request) {
  let workDir = "";

  try {
    const { decoded } = await requireSchedulerCustomer(request);
    const body = await request.json();

    const sourceStoragePath =
      typeof body.sourceStoragePath === "string"
        ? body.sourceStoragePath.trim()
        : "";

    const duration = Number(body.duration);

    if (![15, 30, 60].includes(duration)) {
      return Response.json(
        { success: false, error: "Invalid Short length." },
        { status: 400 }
      );
    }

    const prefix = `social-promotions/device/${decoded.uid}/`;

    if (
      !sourceStoragePath.startsWith(prefix) ||
      sourceStoragePath.includes("..")
    ) {
      return Response.json(
        { success: false, error: "Invalid customer video." },
        { status: 400 }
      );
    }

    const sourceFile = adminBucket.file(sourceStoragePath);
    const [exists] = await sourceFile.exists();

    if (!exists) {
      return Response.json(
        { success: false, error: "Original video not found." },
        { status: 404 }
      );
    }

    workDir = await mkdtemp(
      path.join(os.tmpdir(), "solo-best-part-")
    );

    const inputPath = path.join(workDir, "source-video");

    await sourceFile.download({
      destination: inputPath
    });

    const analysis = await runAnalysis(inputPath, duration);
    const startSeconds = findBestStart(analysis, duration);

    return Response.json({
      success: true,
      startSeconds,
      duration,
      method: "audio-energy",
      message: "Recommended high-energy section found."
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Best part analysis failed.";

    console.error("AUTO_BEST_PART_ERROR", error);

    const status =
      message === "CUSTOMER_AUTH_REQUIRED" ? 401 :
      message === "SCHEDULER_SUBSCRIPTION_REQUIRED" ? 403 : 500;

    return Response.json(
      { success: false, error: message },
      { status }
    );
  } finally {
    if (workDir) {
      await rm(workDir, {
        recursive: true,
        force: true
      }).catch(() => {});
    }
  }
}