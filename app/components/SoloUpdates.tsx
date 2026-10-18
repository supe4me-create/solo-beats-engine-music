"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "../auth/AuthContext";

type Item = {
  id: string; title: string; body: string; href: string;
  pinned: boolean; enabled: boolean; startsAt: string; endsAt: string;
};
type Config = { enabled: boolean; automatic: boolean; items: Item[] };
type PublicItem = {
  id: string; title: string; body: string;
  href: string; pinned: boolean; category: string;
};
type Feed = {
  success: boolean; enabled: boolean; items: PublicItem[];
  automaticUnavailable?: boolean;
};
const inputStyle = "mt-1 w-full rounded-xl border border-white/20 bg-black p-3 text-white";
const buttonStyle = "rounded-xl border border-white/25 px-4 py-2 font-bold disabled:opacity-40";

export default function SoloUpdates() {
  const [feed, setFeed] = useState<Feed | null>(null);
  const [error, setError] = useState(false);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let stopped = false;
    let running = false;
    let controller: AbortController | null = null;
    async function load() {
      if (running) return;
      running = true;
      controller = new AbortController();
      const timeout = window.setTimeout(() => controller?.abort(), 15000);
      try {
        const response = await fetch("/api/homepage/updates", {
          cache: "no-store", signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok || !data.success || !Array.isArray(data.items)) {
          throw new Error("Updates unavailable");
        }
        if (!stopped) { setFeed(data); setError(false); }
      } catch {
        if (!stopped) { setFeed(null); setError(true); }
      } finally {
        window.clearTimeout(timeout);
        running = false;
      }
    }
    void load();
    const timer = window.setInterval(() => {
      if (!document.hidden) void load();
    }, 60000);
    const visible = () => { if (!document.hidden) void load(); };
    document.addEventListener("visibilitychange", visible);
    return () => {
      stopped = true;
      controller?.abort();
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [refresh]);

  if (feed && !feed.enabled) return null;
  return (
    <section aria-labelledby="solo-updates-title"
      className="mb-8 overflow-hidden rounded-3xl border border-cyan-300/30 bg-gradient-to-br from-slate-950 to-cyan-950/40">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-cyan-300">What's happening</p>
          <h2 id="solo-updates-title" className="mt-1 text-2xl font-black">Solo Beats Updates</h2>
        </div>
        <button type="button" className={buttonStyle}
          onClick={() => setRefresh(value => value + 1)}>Refresh</button>
      </div>
      <div className="max-h-80 overflow-y-auto p-5">
        {error ? <p role="status">Updates are temporarily unavailable. Try Refresh.</p>
          : !feed ? <p role="status">Loading updates...</p>
          : <>
            {feed.automaticUnavailable && (
              <p role="status" className="mb-3 text-sm text-amber-200">
                Some automatic updates are temporarily unavailable.
              </p>
            )}
            {feed.items.length === 0 ? <p className="text-white/60">No announcements right now.</p> : (
              <div className="grid gap-3 sm:grid-cols-2">
                {feed.items.map(item => (
                  <article key={item.id} className="min-w-0 rounded-2xl border border-white/10 bg-black/30 p-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-cyan-200">
                      {item.pinned ? "Pinned · " : ""}{item.category}
                    </p>
                    <h3 className="mt-2 break-words text-lg font-bold">{item.title}</h3>
                    {item.body && <p className="mt-2 whitespace-pre-wrap break-words text-sm text-white/70">{item.body}</p>}
                    {item.href && <Link href={item.href}
                      className="mt-3 inline-block font-bold text-cyan-300 underline"
                      aria-label={`View ${item.title}`}>View details</Link>}
                  </article>
                ))}
              </div>
            )}
          </>}
      </div>
      <p className="border-t border-white/10 px-5 py-3 text-xs text-white/50">
        Refreshes every minute while this page is visible.
      </p>
    </section>
  );
}

function localDate(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
function isoDate(value: string) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : "";
}

export function SoloUpdatesManager() {
  const { user, loading } = useAuth();
  const [config, setConfig] = useState<Config | null>(null);
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setConfig(null);
    setError("");
    setMessage("");
    if (!user) return;
    setBusy(true);
    async function load() {
      try {
        const token = await user!.getIdToken();
        const response = await fetch("/api/homepage/updates?manage=1", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error || "Could not load editor.");
        if (!cancelled) { setConfig(data.config); setVersion(data.version); }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load editor.");
      } finally {
        if (!cancelled) setBusy(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [user, reload]);

  function edit(id: string, patch: Partial<Item>) {
    setConfig(current => current ? {
      ...current, items: current.items.map(item => item.id === id ? { ...item, ...patch } : item),
    } : current);
    setMessage("");
  }

  async function save() {
    if (!user || !config || busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/homepage/updates", {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ config, version }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Save failed.");
      setConfig(data.config);
      setVersion(data.version);
      setMessage("Saved. Visitors see changes on the next refresh, within about one minute.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed.");
    } finally { setBusy(false); }
  }

  return (
    <section className="mt-8 rounded-3xl border border-cyan-300/30 bg-cyan-950/20 p-6">
      <h2 className="text-3xl font-black">Homepage Updates Manager</h2>
      <p className="mt-3 text-white/65">
        Automatic updates use published albums and Radio/TV status.
        Add other news below. Changes publish when you press Save updates.
      </p>
      {loading ? <p className="mt-4">Checking sign-in...</p>
        : !user ? <Link href="/account" className="mt-4 inline-block text-cyan-300 underline">Sign in as owner</Link>
        : <>
          {error && <p role="alert" className="mt-4 text-red-200">{error}</p>}
          {message && <p role="status" className="mt-4 text-emerald-200">{message}</p>}
          <button type="button" disabled={busy} className={`${buttonStyle} mt-4`}
            onClick={() => {
              if (!config || window.confirm("Discard unsaved edits and reload?")) setReload(n => n + 1);
            }}>Reload saved settings</button>
          {busy && !config && <p className="mt-4">Loading editor...</p>}
          {config && (
            <form onSubmit={event => { event.preventDefault(); void save(); }}>
              <fieldset disabled={busy} className="mt-5 space-y-5 disabled:opacity-60">
                <div className="flex flex-wrap gap-6">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={config.enabled}
                      onChange={e => { setConfig({ ...config, enabled: e.target.checked }); setMessage(""); }} />
                    Show homepage panel
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" checked={config.automatic}
                      onChange={e => { setConfig({ ...config, automatic: e.target.checked }); setMessage(""); }} />
                    Include automatic updates
                  </label>
                </div>
                <p className="text-sm text-white/60">
                  Dates use this device's local timezone. Empty dates mean no time limit.
                  Hidden, future, and expired announcements are excluded from the public feed.
                </p>
                {config.items.map((item, index) => (
                  <div key={item.id} className="space-y-4 rounded-2xl border border-white/15 bg-black/30 p-4">
                    <h3 className="font-bold">Announcement {index + 1}</h3>
                    <label className="block">Title
                      <input required maxLength={100} value={item.title} className={inputStyle}
                        onChange={e => edit(item.id, { title: e.target.value })} />
                    </label>
                    <label className="block">Message
                      <textarea rows={3} maxLength={500} value={item.body} className={inputStyle}
                        onChange={e => edit(item.id, { body: e.target.value })} />
                    </label>
                    <label className="block">Optional site link
                      <input maxLength={300} placeholder="/store" value={item.href} className={inputStyle}
                        onChange={e => edit(item.id, { href: e.target.value })} />
                    </label>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label>Start date and time
                        <input type="datetime-local" className={inputStyle}
                          value={localDate(item.startsAt)}
                          onChange={e => edit(item.id, { startsAt: isoDate(e.target.value) })} />
                      </label>
                      <label>End date and time
                        <input type="datetime-local" className={inputStyle}
                          value={localDate(item.endsAt)}
                          onChange={e => edit(item.id, { endsAt: isoDate(e.target.value) })} />
                      </label>
                    </div>
                    <div className="flex flex-wrap items-center gap-5">
                      <label className="flex items-center gap-2">
                        <input type="checkbox" checked={item.enabled}
                          onChange={e => edit(item.id, { enabled: e.target.checked })} />Visible
                      </label>
                      <label className="flex items-center gap-2">
                        <input type="checkbox" checked={item.pinned}
                          onChange={e => edit(item.id, { pinned: e.target.checked })} />Pin to top
                      </label>
                      <button type="button" className={buttonStyle} onClick={() => {
                        if (window.confirm("Remove this announcement? Press Save updates to apply.")) {
                          setConfig({ ...config, items: config.items.filter(a => a.id !== item.id) });
                          setMessage("");
                        }
                      }}>Remove</button>
                    </div>
                  </div>
                ))}
                <div className="flex flex-wrap gap-3">
                  <button type="button" className={buttonStyle} disabled={config.items.length >= 20}
                    onClick={() => {
                      setConfig({ ...config, items: [...config.items, {
                        id: crypto.randomUUID(), title: "", body: "", href: "",
                        pinned: false, enabled: true, startsAt: "", endsAt: "",
                      }] });
                      setMessage("");
                    }}>Add announcement</button>
                  <button type="submit"
                    className="rounded-xl bg-cyan-300 px-5 py-3 font-black text-black">
                    {busy ? "Saving..." : "Save updates"}
                  </button>
                </div>
              </fieldset>
            </form>
          )}
        </>}
    </section>
  );
}