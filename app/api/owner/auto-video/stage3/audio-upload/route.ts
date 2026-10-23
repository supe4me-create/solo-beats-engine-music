import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { randomUUID } from "node:crypto";
import { adminBucket, adminDb, firebaseAdminApp } from "../../../../../../lib/firebaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const OWNER_EMAIL = "supe4.me@gmail.com";
const CHUNK_BYTES = 2 * 1024 * 1024;
const MAX_BYTES = 60 * 1024 * 1024;
const MAX_CHUNKS = 30;
const VALID_EXTENSIONS = new Set(["mp3", "wav", "m4a", "aac", "flac", "ogg"]);

async function authorized(request: Request): Promise<boolean> {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return false;
  try {
    const user = await getAuth(firebaseAdminApp).verifyIdToken(token);
    return user.email?.toLowerCase() === OWNER_EMAIL;
  } catch { return false; }
}
function fail(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status });
}
function audioType(extension: string) {
  const types: Record<string, string> = { mp3: "audio/mpeg", wav: "audio/wav", m4a: "audio/mp4", aac: "audio/aac", flac: "audio/flac", ogg: "audio/ogg" };
  return types[extension] || "application/octet-stream";
}
function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 120);
}
function uploadRef(id: string) { return adminDb.collection("soloStage3AudioUploads").doc(id); }
function validId(id: unknown): id is string {
  return typeof id === "string" && /^[a-f0-9-]{36}$/i.test(id);
}

export async function POST(request: Request) {
  if (!(await authorized(request))) return fail("Owner access required.", 403);
  try {
    const body = await request.json();
    if (body?.action === "start") {
      const name = typeof body.fileName === "string" ? safeName(body.fileName) : "";
      const extension = name.split(".").pop()?.toLowerCase() || "";
      const size = Number(body.size);
      if (!VALID_EXTENSIONS.has(extension) || !Number.isSafeInteger(size) || size < 1 || size > MAX_BYTES) {
        return fail("Choose MP3, WAV, M4A, AAC, FLAC or OGG audio up to 60 MB.");
      }
      const chunks = Math.ceil(size / CHUNK_BYTES);
      if (chunks > MAX_CHUNKS) return fail("Audio exceeds upload chunk limit.");
      const uploadId = randomUUID();
      await uploadRef(uploadId).create({ fileName: name, extension, size, chunks, status: "uploading", createdAt: new Date(), expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000) });
      return NextResponse.json({ success: true, uploadId, chunkBytes: CHUNK_BYTES, chunks });
    }
    if (body?.action === "finish") {
      const id = body.uploadId;
      if (!validId(id)) return fail("Invalid upload ID.");
      const reference = uploadRef(id);
      const snapshot = await reference.get();
      const job = snapshot.data();
      if (!snapshot.exists || job?.status !== "uploading" || !job?.expiresAt?.toDate || job.expiresAt.toDate().getTime() < Date.now()) {
        return fail("Upload expired or already processed.");
      }
      // Prevent a second request from finalizing the same upload.
      await adminDb.runTransaction(async tx => {
        const fresh = await tx.get(reference);
        if (fresh.data()?.status !== "uploading") throw new Error("Upload already finalizing.");
        tx.update(reference, { status: "finalizing" });
      });
      const parts: Buffer[] = [];
      const paths: string[] = [];
      let received = 0;
      try {
        for (let i = 0; i < job.chunks; i++) {
          const partPath = `stage3-temp/${id}/${i}`;
          paths.push(partPath);
          const [data] = await adminBucket.file(partPath).download();
          const expected = i === job.chunks - 1 ? job.size - i * CHUNK_BYTES : CHUNK_BYTES;
          if (data.length !== expected) throw new Error(`Chunk ${i + 1} missing or has incorrect size.`);
          parts.push(data); received += data.length;
        }
        if (received !== job.size) throw new Error("Uploaded audio size mismatch.");
        const mediaRef = adminDb.collection("mediaLibrary").doc();
        const storagePath = `media/audio/${mediaRef.id}/solo-stage3-${id}.${job.extension}`;
        await adminBucket.file(storagePath).save(Buffer.concat(parts), { resumable: false, metadata: { contentType: audioType(job.extension) } });
        await mediaRef.set({ kind: "audio", title: job.fileName.replace(/\.[^.]+$/, ""), name: job.fileName, originalName: job.fileName, mimeType: audioType(job.extension), extension: job.extension, sizeBytes: received, storagePath, status: "active", sourceType: "solo-stage3-upload", published: false, createdAt: new Date(), updatedAt: new Date() });
        await reference.update({ status: "completed", mediaId: mediaRef.id, finishedAt: new Date() });
        await Promise.all(paths.map(p => adminBucket.file(p).delete({ ignoreNotFound: true }).catch(() => undefined)));
        return NextResponse.json({ success: true, mediaId: mediaRef.id, label: job.fileName });
      } catch (error) {
        await reference.update({ status: "uploading" }).catch(() => undefined);
        throw error;
      }
    }
    return fail("Unknown upload action.");
  } catch (error) {
    console.error("STAGE3_UPLOAD_ERROR", error);
    return fail(error instanceof Error ? error.message : "Audio upload failed.", 500);
  }
}

export async function PUT(request: Request) {
  if (!(await authorized(request))) return fail("Owner access required.", 403);
  const id = request.headers.get("x-stage3-upload-id");
  const index = Number(request.headers.get("x-stage3-chunk-index"));
  if (!validId(id) || !Number.isInteger(index)) return fail("Invalid chunk metadata.");
  try {
    const snapshot = await uploadRef(id).get();
    const data = snapshot.data();
    if (!snapshot.exists || data?.status !== "uploading" || index < 0 || index >= data.chunks || !data.expiresAt?.toDate || data.expiresAt.toDate().getTime() < Date.now()) return fail("Upload session expired or invalid.");
    const bytes = Buffer.from(await request.arrayBuffer());
    const expected = index === data.chunks - 1 ? data.size - index * CHUNK_BYTES : CHUNK_BYTES;
    if (bytes.length !== expected) return fail("Incorrect chunk size.");
    await adminBucket.file(`stage3-temp/${id}/${index}`).save(bytes, { resumable: false, metadata: { contentType: "application/octet-stream" } });
    return NextResponse.json({ success: true, chunk: index });
  } catch (error) {
    console.error("STAGE3_UPLOAD_CHUNK_ERROR", error);
    return fail("Audio chunk upload failed.", 500);
  }
}
