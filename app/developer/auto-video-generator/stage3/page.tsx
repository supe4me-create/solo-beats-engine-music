"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "../../../auth/AuthContext";

type Job = { id: string; prompt: string; status: string; provider: string | null; aspectRatio: string };

export default function Stage3Pilot() {
  const { user, loading } = useAuth();
  const owner = user?.email?.toLowerCase() === "supe4.me@gmail.com";
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [audioMediaId, setAudioMediaId] = useState("");
  const [bpm, setBpm] = useState(120);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");

  useEffect(() => {
    if (!user || !owner) return;
    let active = true;
    user.getIdToken().then(token => fetch("/api/owner/ai-video/jobs", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }))
      .then(async response => { if (!response.ok) throw new Error("Cannot load Runway jobs"); return response.json(); })
      .then(data => { if (active) setJobs((data.jobs || []).filter((j: Job) => j.status === "completed" && j.provider === "runway" && ["9:16", "16:9"].includes(j.aspectRatio))); })
      .catch(e => { if (active) setMessage(String(e)); });
    return () => { active = false; };
  }, [user, owner]);

  async function render() {
    if (!user || !owner || busy) return;
    setBusy(true); setVideoUrl(""); setMessage("Assembling selected clips with music. Keep this page open.");
    try {
      const token = await user.getIdToken();
      const resp = await fetch("/api/owner/auto-video/stage3", { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ jobIds: selected, audioMediaId: audioMediaId.trim(), duration: 15, bpm }) });
      const data = await resp.json();
      if (!resp.ok || !data.success) throw new Error(data.error || "Render failed");
      setVideoUrl(data.videoUrl); setMessage(`Created ${data.sceneCount} scenes. Saved unpublished to Video Manager (media ID: ${data.mediaId}).`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Render failed"); }
    finally { setBusy(false); }
  }

  if (loading) return <main className="p-8 text-white">Loading...</main>;
  if (!owner) return <main className="p-8 text-white">Owner pilot only. Please sign in with the owner account.</main>;
  return <main className="min-h-screen bg-[#090714] p-6 text-white md:p-10">
    <div className="mx-auto max-w-4xl space-y-6">
      <Link href="/developer/auto-video-generator" className="text-fuchsia-300">← Auto Video Generator</Link>
      <h1 className="text-3xl font-black">SOLO BEATS Stage 3 — Owner Pilot</h1>
      <p className="text-white/70">Select 2–6 previously completed Runway clips, all with the same aspect ratio. This pilot assembles a 15-second video with your Media Library soundtrack. It does not create or charge new Runway generations.</p>
      <section className="rounded-2xl border border-white/20 p-5 space-y-4">
        <h2 className="text-xl font-bold">Completed Runway clips ({jobs.length})</h2>
        <div className="space-y-2">{jobs.map(job => <label key={job.id} className="flex gap-3 items-start rounded-xl bg-white/5 p-3"><input type="checkbox" checked={selected.includes(job.id)} onChange={e => setSelected(old => e.target.checked ? old.length < 6 ? [...old, job.id] : old : old.filter(id => id !== job.id))}/><span className="text-sm break-words">{job.aspectRatio} — {job.prompt?.slice(0,130) || job.id}<span className="block text-white/40">{job.id}</span></span></label>)}</div>
        {jobs.length === 0 && <p className="text-white/60">Create and complete at least two clips in <Link href="/developer/ai-video" className="underline">Runway AI Video</Link> first.</p>}
        <label className="block">Audio Media Library ID<input value={audioMediaId} onChange={e=>setAudioMediaId(e.target.value)} placeholder="Paste the existing audio media ID" className="mt-2 w-full rounded-xl bg-black border border-white/25 p-3"/></label>
        <p className="text-xs text-white/50">Pilot uses an existing Media Library audio track. No direct audio upload in this version.</p>
        <label className="block">BPM (60–200)<input type="number" min="60" max="200" value={bpm} onChange={e=>setBpm(Number(e.target.value))} className="mt-2 w-full rounded-xl bg-black border border-white/25 p-3" /></label>
        <button onClick={render} disabled={busy || selected.length < 2 || !audioMediaId.trim() || selected.some(id => jobs.find(j => j.id === id)?.aspectRatio !== jobs.find(j => j.id === selected[0])?.aspectRatio)} className="rounded-xl bg-fuchsia-600 disabled:opacity-40 px-6 py-3 font-black">{busy ? "RENDERING..." : "RENDER 15-SECOND MUSIC VIDEO"}</button>
        <p role="status" className="text-sm text-cyan-200">{message}</p>
        {videoUrl && <><video controls src={videoUrl} className="w-full max-w-sm rounded-xl"/><a className="inline-block underline text-fuchsia-300" href={videoUrl} target="_blank" rel="noopener noreferrer">Open finished MP4</a></>}
      </section>
    </div>
  </main>;
}
