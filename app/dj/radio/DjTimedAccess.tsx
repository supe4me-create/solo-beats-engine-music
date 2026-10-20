"use client";
import { useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import DjPaymentPlans from "./DjPaymentPlans";
import DjPaymentManager from "./DjPaymentManager";
type Access = {
  uid?: string; email?: string; allowed: boolean; accessType: string; status: string;
  reason: string; startsAt: number | null; expiresAt: number | null;
  daysRemaining: number | null; legacyAccess: boolean;
};
const button = "rounded-xl border border-white/20 px-4 py-3 font-bold disabled:opacity-40";
const input = "mt-2 w-full rounded-xl border border-white/20 bg-black/40 p-3 text-white";
const date = (value: number | null) => value === null ? "No time limit" : new Date(value).toLocaleString();
export default function DjTimedAccess({ owner }: { owner: boolean }) {
  const { user } = useAuth();
  const [self, setSelf] = useState<Access | null>(null);
  const [target, setTarget] = useState<Access | null>(null);
  const [email, setEmail] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [days, setDays] = useState(30);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false, running = false;
    setSelf(null); setTarget(null); setMessage(""); setError("");
    async function load() {
      if (!user || running) return;
      running = true;
      try {
        const token = await user.getIdToken();
        const response = await fetch("/api/dj/access", { cache: "no-store", headers: { Authorization: "Bearer " + token } });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error || "Access check failed.");
        if (!cancelled) setSelf(data);
      } catch (e) {
        if (!cancelled) { setSelf(null); setError(e instanceof Error ? e.message : "Access check failed."); }
      } finally { running = false; }
    }
    void load();
    const timer = window.setInterval(() => void load(), 10000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [user]);
  async function act(action?: string) {
    if (!user || busy || !owner || (action && !target?.uid)) return;
    const iso = (value: string) => value ? new Date(value).toISOString() : null;
    const labels: Record<string, string> = {
      grant_free: "Grant FREE access with the selected dates (blank expiration means no time limit)",
      require_paid: "Require PAID access and lock DJ tools until PayPal payment is verified",
      extend: "Extend access by " + days + " days (suspension/payment restrictions stay unchanged)",
      suspend: "Suspend DJ tools", restore: "Restore suspended access (expiration/payment restrictions still apply)", revoke: "Revoke DJ access",
    };
    if (action && !window.confirm(labels[action] + " for " + target!.email + "?")) return;
    setBusy(true); setMessage(""); setError("");
    try {
      const token = await user.getIdToken();
      const response = await fetch(action ? "/api/owner/radio/djs" : "/api/owner/radio/djs?email=" + encodeURIComponent(email.trim()), {
        method: action ? "POST" : "GET", cache: "no-store",
        headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
        ...(action ? { body: JSON.stringify({ email: target!.email, uid: target!.uid, action,
          ...(action === "grant_free" ? { startsAt: iso(start), expiresAt: iso(end) } : {}), days }) } : {}),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || "Access action failed.");
      setTarget(data); setMessage(data.message || "Account found. Check the email and access before changing it.");
    } catch (e) { setError(e instanceof Error ? e.message : "Access action failed."); }
    finally { setBusy(false); }
  }
  function summary(access: Access) {
    return <div className="mt-4 space-y-2 rounded-xl border border-white/15 p-4">
      <p className="break-all font-bold">{access.email}</p>
      <p>{access.accessType.toUpperCase()} / {access.status.toUpperCase().replaceAll("_", " ")}</p>
      <p className={access.allowed ? "text-emerald-300" : "text-amber-200"}>{access.reason}</p>
      <p>
        Starts: {
          access.startsAt !== null
            ? date(access.startsAt)
            : access.status === "expired"
              ? "Original start date not recorded"
              : "Immediately"
        }
      </p>
      <p>Expires: {date(access.expiresAt)}{access.daysRemaining !== null ? " / " + access.daysRemaining + " days remaining" : ""}</p>
      {access.legacyAccess && <p className="text-sm text-white/60">Existing approval preserved. No expiration was previously set.</p>}
    </div>;
  }
  return <section className="mt-6 rounded-3xl border border-cyan-300/30 bg-cyan-300/5 p-6">
    <h2 className="text-2xl font-bold">{owner ? "Owner: Timed DJ Access" : "Your DJ access details"}</h2>
    {self && summary(self)}
    {!owner && <p className="mt-3 text-white/65">Your application is approved. Choose a paid DJ plan below. Access activates automatically after PayPal verifies payment.</p>}
    {!owner && <DjPaymentPlans />}
    {owner && <fieldset disabled={busy} className="mt-5 space-y-4">
      <p className="text-white/65">DJ permissions only. Premium subscriptions and downloads are unchanged. Dates use this device&apos;s timezone.</p>
      <label className="block">DJ account email<input type="email" value={email} className={input}
        onChange={event => { setEmail(event.target.value); setTarget(null); setMessage(""); }} /></label>
      <button className={button} disabled={busy || !email.trim()} onClick={() => void act()}>Look up account</button>
      {target && <>
        {summary(target)}
        <p className="text-sm text-amber-200">Grant Free replaces the existing DJ access type and dates. Blank expiration grants access without a time limit.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label>Start for Grant Free<input type="datetime-local" value={start} className={input} onChange={event => setStart(event.target.value)} /></label>
          <label>Expiration for Grant Free<input type="datetime-local" value={end} className={input} onChange={event => setEnd(event.target.value)} /></label>
        </div>
        <label className="block">Extension days<input type="number" min={1} max={3650} value={days} className={input} onChange={event => setDays(Number(event.target.value))} /></label>
        <div className="flex flex-wrap gap-3">
          {[["grant_free", "Grant Free Access"], ["require_paid", "Require Paid Access"], ["extend", "Extend"], ["suspend", "Suspend"], ["restore", "Restore"], ["revoke", "Revoke"]].map(([action, label]) =>
            <button key={action} className={button} disabled={busy || target.accessType === "owner"} onClick={() => void act(action)}>{label}</button>)}
        </div>
      </>}
    </fieldset>}
    {owner && <DjPaymentManager />}
    {error && <p role="alert" className="mt-4 text-red-200">{error}</p>}
    <p role="status" className="mt-4 text-cyan-200">{busy ? "Working..." : message}</p>
  </section>;
}


