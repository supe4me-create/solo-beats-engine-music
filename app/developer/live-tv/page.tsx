"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { firebaseAuth } from "../../../lib/firebaseClient";

type TvStatus = { success: boolean; live?: boolean; viewers?: number; room?: string; error?: string };
export default function OwnerLiveTv() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<TvStatus | null>(null);
  useEffect(() => onAuthStateChanged(firebaseAuth, u => { setUser(u); setReady(true); }), []);
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    async function check() {
      if (!user) { setStatus({success:false,error:"Owner sign-in required"}); return; }
      try {
        const token = await user.getIdToken();
        const res = await fetch("/api/owner/tv/status", {headers:{Authorization:`Bearer ${token}`},cache:"no-store"});
        const result: TvStatus = await res.json();
        if (!cancelled) setStatus(result);
      } catch { if (!cancelled) setStatus({success:false,error:"Status connection unavailable"}); }
    }
    void check();
    const id = window.setInterval(() => void check(), 5000);
    return () => { cancelled = true; window.clearInterval(id); };
  }, [user,ready]);
  return <main className="min-h-screen bg-black px-6 pt-32 pb-24 text-white">
    <div className="mx-auto max-w-5xl">
      <Link href="/developer/control-room" className="text-red-300 font-bold">Back to Owner Control Center</Link>
      <h1 className="mt-8 text-3xl font-black">SOLO BEATS LIVE TV CONTROL</h1>
      <p className="mt-2 text-white/60">OBS broadcast monitor Â· refreshes every 5 seconds</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <section className="rounded-2xl border border-white/15 bg-white/5 p-6">
          <h2 className="font-bold text-white/60">BROADCAST STATUS</h2>
          <p className="mt-4 text-2xl font-black">{!status ? "CHECKING" : !status.success ? "UNAVAILABLE" : status.live ? "LIVE ON AIR" : "OFF AIR"}</p>
        </section>
        <section className="rounded-2xl border border-white/15 bg-white/5 p-6">
          <h2 className="font-bold text-white/60">CONNECTED VIEWERS</h2>
          <p className="mt-4 text-3xl font-black">{status?.success ? status.viewers ?? 0 : "--"}</p>
          <p className="mt-2 text-xs text-white/50">LiveKit viewer sessions, not unique people</p>
        </section>
      </div>
      {status?.error && <p className="mt-5 text-red-300">{status.error}</p>}
      {status?.success && <div className="mt-7 flex flex-wrap gap-3">
        <Link href="/premium/tv" className="rounded-xl bg-white px-5 py-3 font-bold text-black">OPEN PREMIUM TV</Link>
        <Link href="/premium/tv/live" className="rounded-xl border border-white/20 px-5 py-3 font-bold">OPEN LIVE TV TEST</Link>
      </div>}
      <section className="mt-8 rounded-2xl border border-red-500/20 bg-red-500/5 p-6">
        <h2 className="font-black">OBS MANAGEMENT</h2>
        <p className="mt-2 text-white/60">Start or stop your broadcast in OBS Studio. This page monitors the LiveKit stream automatically. Stream keys are never displayed.</p>
      </section>
    </div>
  </main>;
}