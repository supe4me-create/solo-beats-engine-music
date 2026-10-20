"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../../auth/AuthContext";

type Application = {
  uid: string;
  email: string;
  legalName?: string;
  displayName?: string;
  name?: string;
  djName?: string;
  city?: string;
  country?: string;
  introduction?: string;
  links?: string[];
  musicUrl?: string;
  status: string;
  feedback?: string;
  updatedAt: number;
  version?: number;
  hasPhoto: boolean;
  hasVideo: boolean;
  emailVerified?: boolean;
  accountDisabled?: boolean;
};

type State = {
  enabled: boolean;
  requests?: Application[];
  application?: Application | null;
  status?: string;
  canApply?: boolean;
  blocked?: string;
  emailVerified?: boolean;
  accessReason?: string;
  hasMore?: boolean;
};

const empty = {
  legalName: "",
  displayName: "",
  djName: "",
  city: "",
  country: "",
  introduction: "",
  links: "",
};

const input =
  "w-full rounded-xl border border-white/20 bg-black/30 p-3 text-white";

const button =
  "rounded-xl border border-white/20 px-4 py-3 font-bold disabled:opacity-40";

export default function DjAccessRequests({
  owner,
  onChanged,
}: {
  owner: boolean;
  onChanged: () => void;
}) {
  const { user } = useAuth();

  const [state, setState] = useState<State | null>(null);
  const [filter, setFilter] = useState("pending");
  const [form, setForm] = useState(empty);
  const [consent, setConsent] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [video, setVideo] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [previews, setPreviews] = useState<Record<string, string>>({});

  const initialized = useRef(false);
  const identity = useRef(user?.uid);
  identity.current = user?.uid;

  const api = useCallback(async (
    path: string,
    method = "GET",
    body?: object
  ) => {
    if (!user) throw new Error("Sign in first.");

    const token = await user.getIdToken();
    const response = await fetch(path, {
      method,
      cache: "no-store",
      headers: {
        Authorization: "Bearer " + token,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || "Request failed.");
    }

    if (identity.current !== user.uid) {
      throw new Error("Account changed. Reload this page.");
    }

    return data;
  }, [user]);

  const load = useCallback(async () => {
    const data = await api(
      "/api/dj/requests?status=" + filter
    ) as State;

    setState(data);

    if (!owner && !initialized.current) {
      const a = data.application;

      if (a) {
        setForm({
          legalName: a.legalName || "",
          displayName: a.displayName || a.name || "",
          djName: a.djName || "",
          city: a.city || "",
          country: a.country || "",
          introduction: a.introduction || "",
          links: a.links?.join("\n") || a.musicUrl || "",
        });
      }

      initialized.current = true;
    }
  }, [api, filter, owner]);

  useEffect(() => {
    initialized.current = false;
    setState(null);
    setForm(empty);
    setConsent(false);
    setPhoto(null);
    setVideo(null);
    setPreviews({});
  }, [user?.uid]);

  useEffect(() => {
    if (!user) return;

    let disposed = false;

    const run = () => {
      if (!disposed) {
        load().catch(e => {
          if (!disposed) setError(e.message);
        });
      }
    };

    run();

    return () => {
      disposed = true;
    };
  }, [load, user]);

  async function action(work: () => Promise<void>) {
    if (busy) return;

    setBusy(true);
    setError("");
    setMessage("");

    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed.");
    } finally {
      setBusy(false);
    }
  }

  async function upload(kind: "photo" | "video", file: File | null) {
    if (!file) return "";

    const mime = file.type || (
      kind === "video" && /\.mp4$/i.test(file.name)
        ? "video/mp4"
        : ""
    );

    if (file.size > (kind === "photo" ? 5 : 40) * 1024 * 1024) {
      throw new Error(`${kind} exceeds the size limit.`);
    }

    setMessage("Uploading " + kind + "â€¦ Keep this page open.");

    const policy = await api("/api/dj/application-media", "POST", {
      kind,
      mime,
      size: file.size,
    });

    const data = new FormData();

    Object.entries(
      policy.fields as Record<string, string>
    ).forEach(([key, value]) => data.append(key, value));

    data.append("file", file);

    // Submission independently verifies the uploaded object.
    await fetch(policy.url, {
      method: "POST",
      mode: "no-cors",
      credentials: "omit",
      body: data,
    });

    return policy.id as string;
  }

  async function submit() {
    const photoId = await upload("photo", photo);
    const videoId = await upload("video", video);

    setMessage("Validating media and submitting applicationâ€¦");

    const data = await api("/api/dj/requests", "POST", {
      ...form,
      links: form.links.split(/\r?\n/).map(s => s.trim()).filter(Boolean),
      consent,
      photoId,
      videoId,
    });

    setMessage(data.message);
    setPhoto(null);
    setVideo(null);
    await load();
    onChanged();
  }

  async function decide(row: Application, choice: string) {
    const explanation =
      choice === "approve"
        ? "Approve this DJ application? Approval allows the DJ to choose a paid access plan. DJ tools remain locked until PayPal payment is verified, unless you manually Grant Free Access."
        : choice === "delete"
          ? "Delete this application's personal details and submitted media? This does not delete the account or revoke DJ access."
          : "Save this review decision?";

    if (!window.confirm(explanation)) return;

    await action(async () => {
      const data = await api("/api/dj/requests", "PATCH", {
        uid: row.uid,
        action: choice,
        updatedAt: row.updatedAt,
        feedback: feedback[row.uid] || "",
      });

      setMessage(data.message);
      setPreviews({});
      await load();
      onChanged();
    });
  }

  async function preview(row: Application, kind: string) {
    await action(async () => {
      const data = await api(
        `/api/dj/application-media?uid=${encodeURIComponent(row.uid)}&kind=${kind}`
      );

      setPreviews(old => ({
        ...old,
        [row.uid + kind]: data.url,
      }));
    });
  }

  if (!user) return null;

  return (
    <section
      id="dj-requests"
      className="mt-8 rounded-3xl border border-cyan-400/30 bg-cyan-950/10 p-6 text-white"
    >
      <h2 className="text-2xl font-bold">
        {owner ? "DJ Applications - Owner Review" : "DJ application"}
      </h2>

      <p className="mt-3 text-white/70">
        Verified email and owner review required. Submitted details are for
        application review, not public profiles. No ID document is requested.
      </p>

      <p className="mt-2 text-sm text-amber-200">
        Application approval and DJ tool access are separate.
        Paid DJ plans are not connected yet.
      </p>

      {error && (
        <p role="alert" className="mt-4 text-red-300">{error}</p>
      )}

      {message && (
        <p role="status" className="mt-4 text-cyan-200">{message}</p>
      )}

      <button
        type="button"
        className={button + " mt-4"}
        disabled={busy}
        onClick={() => action(load)}
      >
        Refresh applications
      </button>

      {!state && <p className="mt-4">Loading applicationâ€¦</p>}

      {state?.enabled === false && (
        <p className="mt-4">Applications are currently disabled.</p>
      )}

      {state?.enabled && owner && (
        <>
          <label className="mt-4 block">
            Review list
            <select
              className={input + " mt-2"}
              value={filter}
              disabled={busy}
              onChange={e => {
                setState(null);
                setFilter(e.target.value);
              }}
            >
              {[
                "pending", "more_info", "approved",
                "declined", "revoked", "deleted",
              ].map(s => (
                <option key={s} value={s}>
                  {s.replaceAll("_", " ").toUpperCase()}
                </option>
              ))}
            </select>
          </label>

          {state.hasMore && (
            <p className="mt-3 text-amber-200">
              Showing up to 100 applications in this status.
            </p>
          )}

          {!state.requests?.length && (
            <p className="mt-4">No applications in this list.</p>
          )}

          {state.requests?.map(row => (
            <article
              key={row.uid}
              className="mt-5 rounded-2xl border border-white/15 p-5"
            >
              <h3 className="text-xl font-bold">
                {row.djName || "DJ applicant"}
              </h3>
              <p>{row.email}</p>

              <p className="mt-2">
                Email: {row.emailVerified ? "verified" : "not verified"}
                {row.accountDisabled ? " · Account unavailable/disabled" : ""}
              </p>

              <p>Application: {row.status.replaceAll("_", " ")}</p>

              {row.version !== 3 && (
                <p className="text-amber-200">
                  Legacy application: use Request More Info to collect
                  the new details.
                </p>
              )}

              <dl className="mt-3 space-y-2">
                <div>
                  <dt className="text-white/60">Legal name</dt>
                  <dd>{row.legalName || "Not supplied"}</dd>
                </div>
                <div>
                  <dt className="text-white/60">Display name</dt>
                  <dd>{row.displayName || row.name || "Not supplied"}</dd>
                </div>
                <div>
                  <dt className="text-white/60">Location</dt>
                  <dd>
                    {[row.city, row.country].filter(Boolean).join(", ") ||
                      "Not supplied"}
                  </dd>
                </div>
              </dl>

              <p className="mt-3 whitespace-pre-wrap">
                {row.introduction}
              </p>

              <div className="mt-3 space-y-2">
                {(row.links || (row.musicUrl ? [row.musicUrl] : []))
                  .filter(url => /^https?:\/\//i.test(url))
                  .map((url, i) => (
                    <a
                      className="block break-all text-cyan-300 underline"
                      key={i}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {url}
                    </a>
                  ))}
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                {row.hasPhoto && (
                  <button
                    type="button"
                    className={button}
                    disabled={busy}
                    onClick={() => preview(row, "photo")}
                  >
                    View photo
                  </button>
                )}

                {row.hasVideo && (
                  <button
                    type="button"
                    className={button}
                    disabled={busy}
                    onClick={() => preview(row, "video")}
                  >
                    View intro video
                  </button>
                )}
              </div>

              {previews[row.uid + "photo"] && (
                <img
                  src={previews[row.uid + "photo"]}
                  alt="Applicant profile"
                  className="mt-3 max-h-64 rounded-xl"
                  referrerPolicy="no-referrer"
                />
              )}

              {previews[row.uid + "video"] && (
                <video
                  src={previews[row.uid + "video"]}
                  controls
                  preload="metadata"
                  className="mt-3 max-h-80 w-full rounded-xl"
                />
              )}

              {row.feedback && (
                <p className="mt-3 whitespace-pre-wrap">
                  Previous feedback: {row.feedback}
                </p>
              )}

              <label className="mt-4 block">
                Feedback to applicant
                <textarea
                  className={input + " mt-2"}
                  maxLength={1000}
                  value={feedback[row.uid] || ""}
                  disabled={busy}
                  onChange={e => setFeedback(old => ({
                    ...old,
                    [row.uid]: e.target.value,
                  }))}
                />
              </label>

              <div className="mt-4 flex flex-wrap gap-3">
                {["pending", "more_info"].includes(row.status) && (
                  <>
                    <button
                      type="button"
                      className={button + " bg-emerald-700"}
                      disabled={
                        busy ||
                        row.accountDisabled ||
                        !row.emailVerified ||
                        row.version !== 3
                      }
                      onClick={() => decide(row, "approve")}
                    >
                      Approve application
                    </button>

                    <button
                      type="button"
                      className={button}
                      disabled={busy}
                      onClick={() => decide(row, "decline")}
                    >
                      Decline
                    </button>
                  </>
                )}

                {row.status !== "deleted" && (
                  <button
                    type="button"
                    className={button}
                    disabled={busy || !feedback[row.uid]?.trim()}
                    onClick={() => decide(row, "more_info")}
                  >
                    Request More Info
                  </button>
                )}

                <button
                  type="button"
                  className={button + " text-red-300"}
                  disabled={busy}
                  onClick={() => decide(row, "delete")}
                >
                  Delete application
                </button>
              </div>
            </article>
          ))}
        </>
      )}

      {state?.enabled && !owner && (
        <>
          <p className="mt-5 font-bold">
            Application: {(state.status || "none")
              .replaceAll("_", " ").toUpperCase()}
          </p>

          <p className="mt-2">DJ tools: {state.accessReason}</p>

          {state.application?.feedback && (
            <p className="mt-3 whitespace-pre-wrap text-cyan-200">
              Owner feedback: {state.application.feedback}
            </p>
          )}

          {!state.emailVerified && (
            <p className="mt-3 text-amber-200">
              Verify your account email before applying,
              then refresh this page.
            </p>
          )}

          {!state.canApply && (
            <p className="mt-3">{state.blocked}</p>
          )}

          {state.canApply && (
            <form
              className="mt-5 space-y-4"
              onSubmit={e => {
                e.preventDefault();
                action(submit);
              }}
            >
              <fieldset
                disabled={busy || !state.emailVerified}
                className="space-y-4 disabled:opacity-50"
              >
                {([
                  ["legalName", "Legal name"],
                  ["displayName", "Display name"],
                  ["djName", "DJ / artist name"],
                  ["city", "City"],
                  ["country", "Country"],
                ] as const).map(([key, label]) => (
                  <label key={key} className="block">
                    {label}
                    <input
                      required
                      maxLength={
                        key === "legalName"
                          ? 120
                          : key === "city" || key === "country"
                            ? 100
                            : 80
                      }
                      className={input + " mt-2"}
                      value={form[key]}
                      onChange={e => setForm(old => ({
                        ...old,
                        [key]: e.target.value,
                      }))}
                    />
                  </label>
                ))}

                <label className="block">
                  Introduction
                  <textarea
                    required
                    maxLength={1000}
                    className={input + " mt-2"}
                    value={form.introduction}
                    onChange={e => setForm(old => ({
                      ...old,
                      introduction: e.target.value,
                    }))}
                  />
                </label>

                <label className="block">
                  Music / social links - one HTTPS link per line, up to 8
                  <textarea
                    required
                    maxLength={4100}
                    className={input + " mt-2"}
                    value={form.links}
                    onChange={e => setForm(old => ({
                      ...old,
                      links: e.target.value,
                    }))}
                  />
                </label>

                <label className="block">
                  Profile photo - JPG/PNG, maximum 5 MB
                  {state.application?.hasPhoto && (
                    <span>
                      {" "}· Existing submitted photo will be kept
                      unless replaced
                    </span>
                  )}
                  <input
                    type="file"
                    accept="image/jpeg,image/png"
                    required={!state.application?.hasPhoto}
                    className={input + " mt-2"}
                    onChange={e => setPhoto(e.target.files?.[0] || null)}
                  />
                </label>

                <label className="block">
                  Intro video - MP4, 30-60 seconds, maximum 40 MB
                  {state.application?.hasVideo && (
                    <span>
                      {" "}· Existing submitted video will be kept
                      unless replaced
                    </span>
                  )}
                  <input
                    type="file"
                    accept="video/mp4,.mp4"
                    required={!state.application?.hasVideo}
                    className={input + " mt-2"}
                    onChange={e => setVideo(e.target.files?.[0] || null)}
                  />
                </label>

                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    required
                    checked={consent}
                    onChange={e => setConsent(e.target.checked)}
                    className="mt-1"
                  />
                  <span>
                    I confirm these details are accurate and agree to
                    owner review of my application, photo, and intro video.
                    This is not automated identity verification.
                  </span>
                </label>

                <button
                  type="submit"
                  className={button + " bg-cyan-400 text-black"}
                >
                  Submit application
                </button>
              </fieldset>
            </form>
          )}
        </>
      )}
    </section>
  );
}



