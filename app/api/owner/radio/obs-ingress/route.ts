import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { IngressClient, IngressInput } from "livekit-server-sdk";
import { firebaseAdminApp } from "../../../../../lib/firebaseAdmin";

export const runtime = "nodejs";
const ROOM = "solo-beats-obs-radio";
const ID = "solo-beats-obs-radio";
async function owner(req:Request) {
 const header = req.headers.get("authorization") || "";
 const token = header.match(/^Bearer\s+(.+)$/i)?.[1];
 if (!token) return false;
 try {
  const decoded = await getAuth(firebaseAdminApp).verifyIdToken(token);
  return decoded.email?.toLowerCase() === "supe4.me@gmail.com";
 } catch { return false; }
}
export async function POST(req:Request) {
 const headers = {"Cache-Control":"no-store"};
 if (!(await owner(req))) return NextResponse.json({success:false,error:"Owner sign-in required"},{status:403,headers});
 try {
  const url=process.env.LIVEKIT_URL, key=process.env.LIVEKIT_API_KEY, secret=process.env.LIVEKIT_API_SECRET;
  if (!url || !key || !secret) throw new Error("LiveKit credentials missing");
  const ingress = new IngressClient(url,key,secret);
  const existing = await ingress.listIngress({roomName:ROOM});
  let entry = existing.find(i => i.participantIdentity === ID && i.url && i.streamKey);
  if (!entry) entry = await ingress.createIngress(IngressInput.RTMP_INPUT, {
   name:"SOLO BEATS OBS RADIO",roomName:ROOM,participantIdentity:ID,participantName:"SOLO BEATS OBS RADIO"
  });
  return NextResponse.json({success:true,server:entry.url,streamKey:entry.streamKey,room:ROOM},{headers});
 } catch (e) {
  console.error("OBS Radio ingress setup:",e);
  return NextResponse.json({success:false,error:"Could not configure OBS Radio ingress"},{status:500,headers});
 }
}
