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
  // SOLO_STAGE3_TRACK_CHOOSER_V2
  const [tracks, setTracks] = useState<{id: string; label: string}[]>([]);
  const [tracksLoading, setTracksLoading] = useState(true);
  const [tracksError, setTracksError] = useState("");
  const [desktopAudio, setDesktopAudio] = useState<File | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

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

  useEffect(() => {
    if (!user || !owner) return;
    let active = true;
    setTracksLoading(true);
    user.getIdToken().then(token => fetch("/api/owner/auto-video/stage3", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }))
      .then(async response => { const data = await response.json(); if (!response.ok || !data.success) throw new Error(data.error || "Cannot load tracks"); return data; })
      .then(data => { if (active) { setTracks(data.tracks || []); setTracksError(""); } })
      .catch(error => { if (active) setTracksError(error instanceof Error ? error.message : "Cannot load tracks"); })
      .finally(() => { if (active) setTracksLoading(false); });
    return () => { active = false; };
  }, [user, owner]);

  async function uploadDesktopAudio() {
    if (!user || !owner || !desktopAudio || uploadBusy) return;
    setUploadBusy(true); setUploadProgress(0); setMessage("Uploading desktop audio in secure chunks...");
    try {
      const token = await user.getIdToken();
      const endpoint = "/api/owner/auto-video/stage3/audio-upload";
      const headers = { Authorization: `Bearer ${token}` };
      async function action(body: object) {
        const response = await fetch(endpoint, { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify(body) });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error || "Upload failed");
        return data;
      }
      const start = await action({ action: "start", fileName: desktopAudio.name, size: desktopAudio.size });
      for (let i = 0; i < start.chunks; i++) {
        const begin = i * start.chunkBytes;
        const piece = desktopAudio.slice(begin, Math.min(begin + start.chunkBytes, desktopAudio.size));
        const response = await fetch(endpoint, { method: "PUT", headers: { ...headers, "x-stage3-upload-id": start.uploadId, "x-stage3-chunk-index": String(i), "Content-Type": "application/octet-stream" }, body: piece });
        if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.error || `Chunk ${i + 1} failed`); }
        setUploadProgress(Math.round(100 * (i + 1) / start.chunks));
      }
      setMessage("Finalizing uploaded track...");
      const completed = await action({ action: "finish", uploadId: start.uploadId });
      setTracks(prev => [...prev.filter(track => track.id !== completed.mediaId), { id: completed.mediaId, label: completed.label || desktopAudio.name }].sort((a,b) => a.label.localeCompare(b.label)));
      setAudioMediaId(completed.mediaId);
      setDesktopAudio(null);
      setMessage("Desktop track uploaded and selected. You can now render.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Upload failed");
    } finally { setUploadBusy(false); }
  }

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
        <div className="space-y-3">
          <label className="block font-bold" htmlFor="stage3-audio-track">SELECT MUSIC FROM LIBRARY</label>
          <select id="stage3-audio-track" value={audioMediaId} onChange={e => setAudioMediaId(e.target.value)} disabled={tracksLoading || uploadBusy} className="block w-full rounded-xl bg-black border border-white/25 p-3 text-white">
            <option value="">{tracksLoading ? "Loading music tracks..." : "Choose an existing music track"}</option>
            {tracks.map(track => <option key={track.id} value={track.id}>{track.label}</option>)}
          </select>
          {tracksError && <p className="text-amber-300 text-sm" role="alert">{tracksError}</p>}
          <div className="border border-white/20 rounded-xl p-4 space-y-3">
            <label className="block font-bold" htmlFor="stage3-desktop-audio">OR UPLOAD TRACK FROM DESKTOP</label>
            <input id="stage3-desktop-audio" type="file" accept=".mp3,.wav,.m4a,.aac,.flac,.ogg,audio/*" disabled={uploadBusy} onChange={e => setDesktopAudio(e.target.files?.[0] || null)} className="block w-full text-sm" />
            <button type="button" onClick={uploadDesktopAudio} disabled={!desktopAudio || uploadBusy || busy} className="rounded-xl bg-cyan-600 px-5 py-3 font-bold disabled:opacity-40">{uploadBusy ? `UPLOADING ${uploadProgress}%` : "UPLOAD AND SELECT TRACK"}</button>
            <p className="text-xs text-white/50">Maximum 60 MB, uploaded in 2 MB chunks. Uploading does not spend Runway credits.</p>
          </div>
        </div>
        <p className="text-xs text-white/50">Use a library track or upload from your computer. The Media ID is selected automatically.</p>
        <label className="block">BPM (60–200)<input type="number" min="60" max="200" value={bpm} onChange={e=>setBpm(Number(e.target.value))} className="mt-2 w-full rounded-xl bg-black border border-white/25 p-3" /></label>
        <button onClick={render} disabled={busy || selected.length < 2 || !audioMediaId.trim() || selected.some(id => jobs.find(j => j.id === id)?.aspectRatio !== jobs.find(j => j.id === selected[0])?.aspectRatio)} className="rounded-xl bg-fuchsia-600 disabled:opacity-40 px-6 py-3 font-black">{busy ? "RENDERING..." : "RENDER 15-SECOND MUSIC VIDEO"}</button>
        <p role="status" className="text-sm text-cyan-200">{message}</p>
        {videoUrl && <><video controls src={videoUrl} className="w-full max-w-sm rounded-xl"/><a className="inline-block underline text-fuchsia-300" href={videoUrl} target="_blank" rel="noopener noreferrer">Open finished MP4</a></>}
      </section>
    </div>
  </main>;
}
