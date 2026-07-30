import { NextResponse } from "next/server";
import { adminBucket, adminDb } from "../../../../lib/firebaseAdmin";

const ALLOWED = new Set(["homepage", "store", "radio", "tv"]);

function active(startDate: unknown, endDate: unknown) {
  if (typeof startDate !== "string" || typeof endDate !== "string") return false;
  const now = new Date();
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T23:59:59.999Z`);
  return !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && now >= start && now <= end;
}

async function signedUrl(path: unknown) {
  if (typeof path !== "string" || !path) return null;
  const file = adminBucket.file(path);
  const [exists] = await file.exists();
  if (!exists) return null;
  const [url] = await file.getSignedUrl({ action: "read", expires: Date.now() + 60 * 60 * 1000 });
  return url;
}

export async function GET(request: Request) {
  try {
    const placement = (new URL(request.url).searchParams.get("placement") || "homepage").toLowerCase();
    if (!ALLOWED.has(placement)) return NextResponse.json({ success: false, error: "Invalid placement." }, { status: 400 });
    const snapshot = await adminDb.collection("artistPromotionSubmissions").where("placementStatus", "==", "scheduled").get();
    const docs = snapshot.docs.filter((doc) => {
      const d = doc.data();
      return d.reviewStatus === "approved" && d.paymentStatus === "paid" && d.placementLocation === placement && active(d.scheduleStartDate, d.scheduleEndDate);
    });
    const promotions = await Promise.all(docs.map(async (doc) => {
      const d = doc.data();
      const [artworkUrl, songUrl] = await Promise.all([signedUrl(d.artworkStoragePath), signedUrl(d.songStoragePath)]);
      return { submissionId: doc.id, artistName: d.artistName || "Independent Artist", songTitle: d.songTitle || "Untitled Song", genre: d.genre || "Music", description: d.description || "", socialLink: d.socialLink || null, youtubeLink: d.youtubeLink || null, artworkUrl, songUrl, sponsoredLabel: d.sponsoredLabel || "Promoted" };
    }));
    return NextResponse.json({ success: true, placement, promotions });
  } catch (error) {
    console.error("Public promotions error:", error);
    return NextResponse.json({ success: false, error: "Promoted music could not be loaded." }, { status: 500 });
  }
}
