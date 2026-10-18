"use client";
import { getAuth } from "firebase/auth";
import { useState } from "react";
import Link from "next/link";
export default function ObsRadioSetup() {
 const [server,setServer]=useState("");
 const [key,setKey]=useState("");
 const [message,setMessage]=useState("OBS Radio is separate from Live TV. Owner GO LIVE and DJs take priority.");
 const [busy,setBusy]=useState(false);
 async function setup(){
  setBusy(true);
  try {
   const user = getAuth().currentUser;
   if (!user) throw new Error("Sign in as the owner first.");
   const token = await user.getIdToken();
   const response = await fetch("/api/owner/radio/obs-ingress",{method:"POST",headers:{Authorization:`Bearer ${token}`}});
   const data = await response.json();
   if (!response.ok || !data.success || !data.server || !data.streamKey) throw new Error(data.error || "OBS credentials unavailable.");
   setServer(data.server); setKey(data.streamKey);
   setMessage("OBS Radio connection is ready. In OBS, create a separate RADIO profile, select Custom Streaming, and paste the values below. Never use the Live TV streaming key for Radio.");
  } catch(e){setMessage(e instanceof Error?e.message:"Radio setup failed");}
  finally{setBusy(false);}
 }
 return <main className="min-h-screen bg-black text-white p-6 md:p-10"><div className="mx-auto max-w-3xl space-y-5">
 <Link href="/developer/control-room" className="text-red-400">← Control Center</Link>
 <h1 className="text-3xl font-bold">SOLO BEATS — OBS RADIO</h1>
 <p className="text-gray-300">{message}</p>
 <button onClick={setup} disabled={busy} className="rounded-xl bg-red-600 px-5 py-3 font-bold disabled:opacity-40">{busy?"Preparing...":"SET UP OBS RADIO"}</button>
 {server && <div className="space-y-3 rounded-xl border border-white/20 p-5"><p>OBS → Settings → Stream → Service: Custom</p><label className="block text-sm">Server<input className="mt-1 w-full rounded bg-gray-900 p-3" readOnly value={server}/></label><label className="block text-sm">Stream key (keep private)<input className="mt-1 w-full rounded bg-gray-900 p-3" readOnly value={key} type="password"/></label>
<div className="flex flex-wrap gap-3">
<button type="button" onClick={async () => {
 try {
  await navigator.clipboard.writeText(server);
  setMessage("SERVER COPIED. Paste into OBS Stream settings.");
 } catch {
  setMessage("Server copy failed. Check browser clipboard permissions.");
 }
}} className="rounded-lg bg-blue-600 px-4 py-3 font-bold">
COPY SERVER
</button>
<button type="button" onClick={async () => {
 try {
  await navigator.clipboard.writeText(key);
  setMessage("STREAM KEY COPIED. Paste into OBS. Keep it private.");
 } catch {
  setMessage("Stream key copy failed. Check browser clipboard permissions.");
 }
}} className="rounded-lg bg-green-600 px-4 py-3 font-bold">
COPY STREAM KEY
</button>
</div>
<p className="text-sm text-yellow-300">Copy the stream key into OBS; do not share screenshots of it.</p><p>Start Streaming in OBS to send audio to Radio. Stop Streaming to resume normal programming. An active DJ or owner Live Mix takes priority.</p></div>}
 <Link href="/premium/radio" className="block text-red-400">Open Premium Radio →</Link>
 </div></main>;
}
