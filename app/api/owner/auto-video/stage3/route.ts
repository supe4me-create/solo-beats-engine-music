import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import RunwayML from "@runwayml/sdk";
import ffmpegPath from "ffmpeg-static";
import { adminBucket, adminDb, firebaseAdminApp } from "../../../../../lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
const OWNER_EMAIL = "supe4.me@gmail.com";
const MAX_VIDEO_BYTES = 90 * 1024 * 1024;

async function requireOwner(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return false;
  const decoded = await getAuth(firebaseAdminApp).verifyIdToken(token);
  return decoded.email?.toLowerCase() === OWNER_EMAIL;
}

async function runFF(args: string[]) {
  if (!ffmpegPath) throw new Error("FFmpeg is unavailable on this server.");
  const ffmpegExecutable = ffmpegPath;
  await new Promise<void>((resolve, reject) => {
    const child = spawn(ffmpegExecutable, ["-hide_banner", "-loglevel", "error", "-nostdin", ...args], { windowsHide: true });
    let errors = "";
    child.stderr.on("data", (data: Buffer) => { errors = (errors + data.toString()).slice(-2500); });
    child.once("error", reject);
    child.once("close", code => code === 0 ? resolve() : reject(new Error(`FFmpeg exited ${code}: ${errors}`)));
  });
}

async function downloadRunwayVideo(urlText: string, dest: string) {
  const url = new URL(urlText);
  // Only server-retrieved Runway output, never a customer-submitted URL.
  if (url.protocol !== "https:" || url.username || url.password) throw new Error("Invalid Runway output URL.");
  const resp = await fetch(url, { signal: AbortSignal.timeout(90000), cache: "no-store" });
  if (!resp.ok || !resp.body) throw new Error(`Runway clip download failed (${resp.status}).`);
  const declared = Number(resp.headers.get("content-length") || 0);
  if (declared > MAX_VIDEO_BYTES) throw new Error("Runway clip is too large.");
  let count = 0;
  const limiter = new Transform({ transform(chunk: Buffer, _encoding, callback) {
    count += chunk.length;
    callback(count > MAX_VIDEO_BYTES ? new Error("Runway clip size limit exceeded.") : null, chunk);
  }});
  await pipeline(Readable.fromWeb(resp.body as never), limiter, createWriteStream(dest, { flags: "wx" }));
  if (count < 1024) throw new Error("Runway clip download is empty.");
}

// SOLO_STAGE3_TRACK_CHOOSER_V2 — read-only owner Media Library listing.
export async function GET(request: Request) {
  try {
    if (!(await requireOwner(request))) return NextResponse.json({ success: false, error: "Owner access required." }, { status: 403 });
    const snapshot = await adminDb.collection("mediaLibrary").limit(300).get();
    const tracks = snapshot.docs.filter(doc => {
      const item = doc.data();
      return item.kind === "audio" && typeof item.storagePath === "string" && item.storagePath.length > 0;
    }).map(doc => {
      const item = doc.data();
      const label = [item.title, item.name, item.originalName, item.fileName].find(x => typeof x === "string" && x.trim());
      return { id: doc.id, label: typeof label === "string" ? label.slice(0, 160) : doc.id };
    }).sort((a,b) => a.label.localeCompare(b.label));
    return NextResponse.json({ success: true, tracks });
  } catch (error) {
    console.error("STAGE3_MEDIA_LIST_ERROR", error);
    return NextResponse.json({ success: false, error: "Unable to load audio library." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let temp = "";
  try {
    if (!(await requireOwner(request))) return NextResponse.json({ success: false, error: "Owner access required." }, { status: 403 });
    const body = await request.json();
    const jobIds: unknown = body?.jobIds;
    const duration = Number(body?.duration);
    const bpm = Number(body?.bpm);
    const audioMediaId = typeof body?.audioMediaId === "string" ? body.audioMediaId.trim() : "";
    if (!Array.isArray(jobIds) || jobIds.length < 2 || jobIds.length > 6 || !jobIds.every(x => typeof x === "string" && /^[A-Za-z0-9_-]{8,150}$/.test(x))) {
      return NextResponse.json({ success: false, error: "Select between 2 and 6 completed Runway jobs." }, { status: 400 });
    }
    if (duration !== 15 || !Number.isFinite(bpm) || bpm < 60 || bpm > 200 || !/^[A-Za-z0-9_-]{8,150}$/.test(audioMediaId)) {
      return NextResponse.json({ success: false, error: "Pilot requires 15 seconds, BPM 60-200 and a valid audio Media Library ID." }, { status: 400 });
    }
    const jobs = await Promise.all(jobIds.map(id => adminDb.collection("aiVideoJobs").doc(id).get()));
    if (jobs.some(s => !s.exists || s.data()?.status !== "completed" || s.data()?.provider !== "runway" || typeof s.data()?.providerJobId !== "string")) {
      return NextResponse.json({ success: false, error: "Every selected job must be a completed Runway generation." }, { status: 400 });
    }
    const ratios = jobs.map(s => s.data()?.aspectRatio);
    if (ratios.some(r => r !== ratios[0] || !["9:16", "16:9"].includes(r))) {
      return NextResponse.json({ success: false, error: "All clips must share a 9:16 or 16:9 aspect ratio." }, { status: 400 });
    }
    const audioSnapshot = await adminDb.collection("mediaLibrary").doc(audioMediaId).get();
    const audio = audioSnapshot.data();
    if (!audioSnapshot.exists || audio?.kind !== "audio" || typeof audio.storagePath !== "string") {
      return NextResponse.json({ success: false, error: "Select a valid music track from the Media Library." }, { status: 400 });
    }
    // SOLO_STAGE3_COMPLETED_OUTPUT_FALLBACK_V1
    // Reuse completed video outputs without creating new Runway jobs.
    const runwayKey = process.env.RUNWAYML_API_SECRET;
    const client = runwayKey ? new RunwayML({ apiKey: runwayKey }) : null;
    const outputs: string[] = [];

    for (const job of jobs) {
      const data = job.data()!;
      const savedUrl = typeof data.outputUrl === "string"
        ? data.outputUrl.trim()
        : "";

      let outputUrl = "";

      // Refresh from Runway when an API key is configured.
      if (client) {
        try {
          const task = await client.tasks.retrieve(data.providerJobId as string);
          if (task.status === "SUCCEEDED" &&
              Array.isArray(task.output) &&
              typeof task.output[0] === "string") {
            outputUrl = task.output[0];
          }
        } catch (error) {
          console.warn("STAGE3_RUNWAY_REFRESH_UNAVAILABLE", error);
        }
      }

      // A completed job may already have a stored provider output URL.
      if (!outputUrl && savedUrl) {
        outputUrl = savedUrl;
      }

      if (!outputUrl) {
        return NextResponse.json({
          success: false,
          error: "A completed Runway video has no saved output URL. Configure RUNWAYML_API_SECRET on Vercel to retrieve it again."
        }, { status: 400 });
      }

      const parsed = new URL(outputUrl);
      if (parsed.protocol !== "https:" ||
          parsed.username || parsed.password ||
          parsed.port) {
        return NextResponse.json({
          success: false,
          error: "A completed video has an invalid output URL."
        }, { status: 400 });
      }

      outputs.push(outputUrl);
    }
    temp = await mkdtemp(join(tmpdir(), "solo-stage3-owner-"));
    const clips: string[] = [];
    for (let i = 0; i < outputs.length; i++) {
      const file = join(temp, `input-${i}.mp4`);
      await downloadRunwayVideo(outputs[i], file);
      clips.push(file);
    }
    const audioPath = join(temp, "music-source");
    await adminBucket.file(audio.storagePath).download({ destination: audioPath });
    const secondsPerBeat = 60 / bpm;
    const beatsPerScene = [4,8,12,16,24,32].filter(n => n*secondsPerBeat >= 2.5 && n*secondsPerBeat <= 9)
      .sort((a,b) => Math.abs(a*secondsPerBeat - 4) - Math.abs(b*secondsPerBeat - 4))[0];
    if (!beatsPerScene) throw new Error("Could not plan beat-aligned scenes.");
    const segmentLength = beatsPerScene * secondsPerBeat;
    const [width,height] = ratios[0] === "9:16" ? [720,1280] : [1280,720];
    const pieces: string[] = [];
    let elapsed = 0;
    while (elapsed < duration - .001) {
      const index = pieces.length;
      const piece = join(temp, `piece-${index}.mp4`);
      const length = Math.min(segmentLength, duration - elapsed);
      await runFF(["-y", "-stream_loop", "-1", "-i", clips[index % clips.length], "-t", length.toFixed(3), "-an", "-vf", `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},setsar=1,fps=24,format=yuv420p`, "-c:v", "libx264", "-preset", "veryfast", "-crf", "25", "-pix_fmt", "yuv420p", piece]);
      pieces.push(piece);
      elapsed += length;
    }
    const concatFile = join(temp, "clips.txt");
    await writeFile(concatFile, pieces.map((_,i) => `file 'piece-${i}.mp4'`).join("\n"));
    const silent = join(temp, "silent.mp4");
    await runFF(["-y", "-f", "concat", "-safe", "0", "-i", concatFile, "-c", "copy", silent]);
    const final = join(temp, "stage3.mp4");
    await runFF(["-y", "-i", silent, "-i", audioPath, "-map", "0:v:0", "-map", "1:a:0", "-t", String(duration), "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", final]);
    const bytes = await readFile(final);
    if (bytes.length < 1024 || bytes.length > MAX_VIDEO_BYTES) throw new Error("Rendered MP4 failed size checks.");
    const id = adminDb.collection("mediaLibrary").doc().id;
    const storagePath = `media/video/${id}/solo-stage3-${randomUUID()}.mp4`;
    const storageFile = adminBucket.file(storagePath);
    await storageFile.save(bytes, { resumable: false, metadata: { contentType: "video/mp4" } });
    await adminDb.collection("mediaLibrary").doc(id).set({
      kind: "video", title: "SOLO BEATS Stage 3 Animated Music Video", description: `Animated music video assembled from ${clips.length} completed Runway clips at ${bpm} BPM.`,
      sourceType: "solo-beats", originalName: "solo-stage3.mp4", mimeType: "video/mp4", extension: "mp4", sizeBytes: bytes.length, storagePath,
      status: "active", published: false, homepageEnabled: false, premiumTvEnabled: false, featured: false, displayOrder: 0,
      stage3: { jobIds, audioMediaId, duration, bpm, sceneCount: pieces.length }, createdAt: new Date(), updatedAt: new Date()
    });
    const [videoUrl] = await storageFile.getSignedUrl({ action: "read", expires: Date.now() + 60 * 60 * 1000 });
    return NextResponse.json({ success: true, videoUrl, mediaId: id, storagePath, sceneCount: pieces.length });
  } catch (error) {
    console.error("STAGE3_OWNER_RENDER_FAILED", error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Stage 3 render failed." }, { status: 500 });
  } finally {
    if (temp) await rm(temp, { recursive: true, force: true }).catch(() => undefined);
  }
}
