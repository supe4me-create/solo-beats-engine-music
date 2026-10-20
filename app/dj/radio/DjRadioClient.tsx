"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import DjAccessRequests from "./DjAccessRequests";
import DjTimedAccess from "./DjTimedAccess";
import DjMusicUploadPanel from "./DjMusicUploadPanel";
import { useAuth } from "../../auth/AuthContext";

type Access = {
  success?: boolean;
  email?: string;
  owner?: boolean;
  approved?: boolean;
  allowed?: boolean;
  emailVerified?: boolean;
  error?: string;
};

export default function DjRadioPage() {
  const { user, loading } = useAuth();
  const [access, setAccess] = useState<Access | null>(null);
  const [checking, setChecking] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    setAccess(null);
    setMessage("");

    if (loading) return () => { cancelled = true; };

    if (!user) {
      setChecking(false);
      return () => { cancelled = true; };
    }

    setChecking(true);
    const currentUser = user;

    async function check() {
      try {
        const token = await currentUser.getIdToken();
        const response = await fetch("/api/dj/access", {
          cache: "no-store",
          headers: { Authorization: `Bearer ${token}` },
        });
        const data: Access = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data.error || "Could not check DJ access.");
        }
        if (!cancelled) setAccess(data);
      } catch (error) {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : "Access check failed.");
        }
      } finally {
        if (!cancelled) setChecking(false);
      }
    }

    void check();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void check();
    }, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [user, loading, refresh]);

  async function changeAccess(enabled: boolean) {
    if (!user || busy || !access?.owner) return;

    const target = email.trim();
    if (!target) {
      setMessage("Enter the DJ account email.");
      return;
    }

    if (!window.confirm(
      `${enabled ? "Grant FREE" : "Revoke"} DJ access for ${target}?`
    )) return;

    setBusy(true);
    setMessage("");

    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/owner/radio/djs", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: target, enabled }),
      });
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "DJ access update failed.");
      }

      setMessage(data.message);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "DJ access update failed.");
    } finally {
      setBusy(false);
    }
  }

  const button =
    "rounded-xl border border-white/20 px-5 py-3 font-bold disabled:opacity-40";

  return (
    <div className="mx-auto max-w-5xl px-5 py-12">
      <p className="text-sm font-black tracking-widest text-cyan-300">
        SOLO BEATS ENGINE MUSIC
      </p>
      <h1 className="mt-3 text-4xl font-black">DJ Workspace</h1>
      <p className="mt-4 text-white/70">
        Owner-approved access for radio DJs.
      </p>

      <section className="mt-8 rounded-3xl border border-white/15 bg-white/5 p-6">
        <h2 className="text-2xl font-bold">Your access</h2>

        {loading || checking ? (
          <p className="mt-4">Checking sign-in and permissions...</p>
        ) : !user ? (
          <div className="mt-4">
            <p className="text-white/75">
              Create a site account or sign in, verify your email,
              then tell us about yourself and your music.
              The owner reviews every application.
            </p>
            <Link
              href="/account?next=%2Fdj%2Fradio"
              className="mt-5 inline-flex rounded-xl bg-cyan-300 px-5 py-3 font-black text-black"
            >
              Sign in / Create account
            </Link>
          </div>
        ) : access ? (
          <>
            <p className="mt-4 text-white/70">{access.email}</p>
            <p className="mt-3 text-xl font-bold">
              {access.owner
                ? "OWNER ACCESS ACTIVE"
                : access.allowed
                  ? "DJ ACCESS ACTIVE"
                  : access.approved
                    ? "DJ APPROVED - PAYMENT REQUIRED"
                    : "DJ ACCESS NOT ACTIVE"}
            </p>
            {!access.allowed && (
              <p className="mt-3 text-amber-200">
                {!access.emailVerified
                  ? "Verify your account email, then submit your DJ application below."
                  : access.approved
                    ? "Your DJ application is approved. Choose a paid plan below. Access activates automatically after PayPal verifies payment."
                    : "Use Request DJ Access below to apply."}
                {!access.emailVerified && (
                  <Link
                    href="/account?next=%2Fdj%2Fradio"
                    className="mt-3 block font-bold text-cyan-300 underline"
                  >
                    Verify email and continue application
                  </Link>
                )}
              </p>
            )}
          </>
        ) : (
          <p className="mt-4">Access could not be confirmed.</p>
        )}

        {user && (
          <button
            type="button"
            className={`${button} mt-5`}
            disabled={checking || busy}
            onClick={() => setRefresh(value => value + 1)}
          >
            Refresh Access
          </button>
        )}
      </section>

      {user && access && (
        <DjAccessRequests
          key={user.uid}
          owner={access.owner === true}
          onChanged={() => setRefresh(value => value + 1)}
        />
      )}

      {access?.owner && (
        <section className="mt-6 rounded-3xl border border-cyan-300/30 bg-cyan-300/5 p-6">
          <h2 className="text-2xl font-bold">Invite a DJ to apply</h2>
          <p className="mt-3 text-white/70">
            Share this link. DJs create or sign in to their site account,
            verify their email, and submit an application.
            You review requests above and choose Approve or Decline.
          </p>
          <input
            aria-label="DJ application link"
            readOnly
            value="https://www.solobeatsenginemusic.com/dj/radio"
            onFocus={event => event.target.select()}
            className="mt-4 w-full rounded-xl border border-white/20 bg-black/40 p-3 text-white"
          />
          <button
            type="button"
            className={button + " mt-3"}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(
                  "https://www.solobeatsenginemusic.com/dj/radio"
                );
                setMessage("DJ application link copied. Share it with your DJs.");
              } catch {
                setMessage("Select the application link above and copy it manually.");
              }
            }}
          >
            Copy DJ application link
          </button>
        </section>
      )}

      {access?.owner && (
        <section className="mt-6 rounded-3xl border border-amber-300/30 bg-amber-300/5 p-6">
          <h2 className="text-2xl font-bold">Owner: Manage DJ Access</h2>
          <p className="mt-3 text-white/70">
            The DJ must already have a site account with a verified email.
            Approval does not give access to your owner dashboard.
            No invitation email is sent.
          </p>
          <label htmlFor="dj-email" className="mt-5 block font-bold">
            DJ account email
          </label>
          <input
            id="dj-email"
            type="email"
            autoComplete="off"
            value={email}
            disabled={busy}
            onChange={event => setEmail(event.target.value)}
            placeholder="dj@example.com"
            className="mt-2 w-full rounded-xl border border-white/20 bg-black/40 px-4 py-3 text-white"
          />
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              disabled={busy || !email.trim()}
              onClick={() => void changeAccess(true)}
              className={`${button} bg-emerald-300 text-black`}
            >
              Grant Free DJ Access
            </button>
            <button
              type="button"
              disabled={busy || !email.trim()}
              onClick={() => void changeAccess(false)}
              className={`${button} text-red-200`}
            >
              Revoke DJ
            </button>
          </div>
          <Link
            href="/developer/radio"
            className="mt-6 inline-block text-cyan-300 underline"
          >
            Open Owner Radio Controls
          </Link>
        </section>
      )}

      {user && access && <DjTimedAccess owner={access.owner === true} />}

      {user && access?.allowed && (
        <DjMusicUploadPanel
          owner={access.owner === true}
        />
      )}

      <p role="status" aria-live="polite" className="mt-5 text-amber-200">
        {busy ? "Saving DJ access..." : message}
      </p>

      {access?.allowed && (
        <section className="mt-6 rounded-3xl border border-white/15 p-6">
          <h2 className="text-xl font-bold">DJ workspace ready</h2>
          <Link
            href="/dj/turntable"
            className="mt-5 inline-block rounded-2xl bg-cyan-300 px-6 py-4 font-black text-black"
          >
            Open Digital Turntable
          </Link>
          <p className="mt-3 text-white/70">
            The Digital Turntable supports local mixing and WAV recording.
            Approved DJs can now submit privately stored music with ownership and rights-holder information.
            Existing Radio playback and owner controls are unchanged.
          </p>
          <Link
            href="/premium/radio"
            className="mt-5 inline-block text-cyan-300 underline"
          >
            Open Radio Listener
          </Link>
        </section>
      )}
    </div>
  );
}
