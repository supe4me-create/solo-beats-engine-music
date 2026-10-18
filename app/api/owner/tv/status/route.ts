import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { RoomServiceClient } from "livekit-server-sdk";
import { firebaseAdminApp } from "../../../../../lib/firebaseAdmin";

export const dynamic = "force-dynamic";
const ROOM = "solo-beats-premium-live-tv";
const OWNER = "supe4.me@gmail.com";
const headers = { "Cache-Control": "private, no-store, max-age=0" };

export async function GET(request: Request) {
  const bearer = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!bearer) return NextResponse.json({ success: false, error: "Sign in required" }, { status: 401, headers });
  try {
    const user = await getAuth(firebaseAdminApp).verifyIdToken(bearer);
    if (user.email?.toLowerCase() !== OWNER) {
      return NextResponse.json({ success: false, error: "Owner only" }, { status: 403, headers });
    }
  } catch {
    return NextResponse.json({ success: false, error: "Invalid sign in" }, { status: 401, headers });
  }
  try {
    const url = process.env.LIVEKIT_URL;
    const key = process.env.LIVEKIT_API_KEY;
    const secret = process.env.LIVEKIT_API_SECRET;
    if (!url || !key || !secret) throw new Error("LiveKit not configured");
    const client = new RoomServiceClient(url.replace(/^wss:/, "https:").replace(/^ws:/, "http:"), key, secret);
    const rooms = await client.listRooms([ROOM]);
    if (!rooms.length) return NextResponse.json({ success: true, live: false, viewers: 0, room: ROOM }, { headers });
    const people = await client.listParticipants(ROOM);
    const onAir = people.some(p => p.identity === "solo-beats-obs-tv" && p.tracks.some(t => !t.muted));
    const viewers = onAir ? people.filter(p => p.identity.startsWith("tv-viewer-")).length : 0;
    return NextResponse.json({ success: true, live: onAir, viewers, room: ROOM }, { headers });
  } catch (e) {
    console.error("Owner Live TV status:", e);
    return NextResponse.json({ success: false, error: "Live status unavailable" }, { status: 503, headers });
  }
}