/**
 * SOLO BEATS: customer TikTok inbox-draft binary transfer.
 * No public post is created; the creator finishes in TikTok.
 * Source file remains private in the customer's Firebase Storage directory.
 */
import { adminBucket } from "./firebaseAdmin";

const MIN_CHUNK = 5 * 1024 * 1024;
const CHUNK_SIZE = 10 * 1024 * 1024;
const MAX_FILE = 100 * 1024 * 1024; // conservative for synchronous serverless execution

function videoMime(path: string) {
  if (/\.mp4$/i.test(path)) return "video/mp4";
  if (/\.mov$/i.test(path)) return "video/quicktime";
  if (/\.webm$/i.test(path)) return "video/webm";
  throw new Error("TikTok draft accepts MP4, MOV, or WebM video files.");
}

export async function sendTikTokInboxDraftFromFirebase(options: {
  customerUid: string;
  mediaStoragePath: string;
  accessToken: string;
}): Promise<string> {
  const { customerUid, mediaStoragePath, accessToken } = options;
  if (!customerUid || /[\\/]/.test(customerUid) || customerUid === "." || customerUid === "..") {
    throw new Error("Invalid customer identifier.");
  }
  const prefix = `social-promotions/device/${customerUid}/`;
  if (!mediaStoragePath.startsWith(prefix) || mediaStoragePath.length <= prefix.length ||
      mediaStoragePath.includes("..") || mediaStoragePath.includes("\\")) {
    throw new Error("TikTok video is not in the customer's approved media directory.");
  }
  const mime = videoMime(mediaStoragePath);
  const file = adminBucket.file(mediaStoragePath);
  const [metadata] = await file.getMetadata();
  const bytes = Number(metadata.size);
  if (!Number.isSafeInteger(bytes) || bytes < 1 || bytes > MAX_FILE) {
    throw new Error(`TikTok draft upload size must be between 1 byte and ${MAX_FILE} bytes.`);
  }
  // TikTok merges the remainder into the last chunk. Small files upload as one chunk.
  const chunkCount = Math.max(1, Math.floor(bytes / CHUNK_SIZE));
  const chunkSize = chunkCount === 1 ? bytes : CHUNK_SIZE;
  if (chunkCount > 1 && chunkSize < MIN_CHUNK) {
    throw new Error("Invalid TikTok chunk configuration.");
  }

  const init = await fetch("https://open.tiktokapis.com/v2/post/publish/inbox/video/init/", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json; charset=UTF-8" },
    body: JSON.stringify({ source_info: {
      source: "FILE_UPLOAD", video_size: bytes, chunk_size: chunkSize, total_chunk_count: chunkCount,
    } }),
    signal: AbortSignal.timeout(30000),
  });
  const initBody = await init.json().catch(() => ({})) as {
    data?: {publish_id?: string; upload_url?: string};
    error?: {code?: string; message?: string};
  };
  if (!init.ok || initBody.error?.code !== "ok" || !initBody.data?.publish_id || !initBody.data.upload_url) {
    throw new Error(`TikTok draft initialization failed: ${initBody.error?.code || init.status} ${initBody.error?.message || ""}`.slice(0, 400));
  }
  const destination = new URL(initBody.data.upload_url);
  if (destination.protocol !== "https:" || destination.username || destination.password || destination.port ||
      !(destination.hostname === "tiktokapis.com" || destination.hostname.endsWith(".tiktokapis.com"))) {
    throw new Error("TikTok returned an unexpected upload host; transfer blocked.");
  }
  // Upload sequentially. Do not automatically retry uncertain uploads: TikTok may already have the data.
  for (let i = 0; i < chunkCount; i++) {
    const start = i * chunkSize;
    const end = i === chunkCount - 1 ? bytes - 1 : Math.min(bytes - 1, start + chunkSize - 1);
    const expected = end - start + 1;
    const [data] = await file.download({start, end});
    if (data.length !== expected) throw new Error("Firebase returned an incomplete TikTok video chunk.");
    const response = await fetch(destination.toString(), {
      method: "PUT",
      headers: {
        "Content-Type": mime,
        "Content-Range": `bytes ${start}-${end}/${bytes}`,
        "Content-Length": String(data.length),
      },
      body: new Uint8Array(data),
      signal: AbortSignal.timeout(90000),
      redirect: "error",
    });
    const expectedCode = i === chunkCount - 1 ? 201 : 206;
    if (response.status !== expectedCode) {
      throw new Error(`TikTok rejected video chunk ${i + 1}/${chunkCount} (HTTP ${response.status}); verify post status before retrying.`);
    }
  }
  return initBody.data.publish_id;
}
