"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthContext";

type Track = {
  id: string;
  title: string;
  artist: string;
  rightsholder: string;
  ownershipType: string;
  label?: string;
  publisher?: string;
  originalName: string;
  status: string;
  duplicateDetected?: boolean;
  duplicateCount?: number;
  reviewReason?: string;
  reviewNote?: string;
  proofNote?: string;
  email?: string;
};

type PrepareResponse = {
  success?: boolean;
  id?: string;
  uploadUrl?: string;
  fields?: Record<string, string>;
  error?: string;
};

const input =
  "mt-2 w-full rounded-xl border border-white/20 bg-black/40 px-4 py-3 text-white";

const button =
  "rounded-xl border border-white/20 px-5 py-3 font-bold disabled:opacity-40";

function statusClass(status: string) {
  if (status === "cleared") {
    return "border-emerald-300/30 bg-emerald-300/10 text-emerald-200";
  }

  if (status === "rejected") {
    return "border-red-300/30 bg-red-300/10 text-red-200";
  }

  return "border-amber-300/30 bg-amber-300/10 text-amber-200";
}

export default function DjMusicUploadPanel({
  owner,
}: {
  owner: boolean;
}) {
  const { user } = useAuth();

  const [file, setFile] = useState<File | null>(null);

  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [rightsholder, setRightsholder] = useState("");

  const [ownershipType, setOwnershipType] =
    useState("owner");

  const [label, setLabel] = useState("");
  const [publisher, setPublisher] = useState("");
  const [proofNote, setProofNote] = useState("");

  const [confirmed, setConfirmed] =
    useState(false);

  const [tracks, setTracks] =
    useState<Track[]>([]);

  const [ownerTracks, setOwnerTracks] =
    useState<Track[]>([]);

  const [busy, setBusy] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const loadTracks = useCallback(async () => {
    if (!user) return;

    try {
      const token = await user.getIdToken();

      const response = await fetch(
        owner
          ? "/api/owner/dj-music"
          : "/api/dj/music",
        {
          cache: "no-store",
          headers: {
            Authorization:
              "Bearer " + token,
          },
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error ||
            "DJ music could not be loaded."
        );
      }

      if (owner) {
        setOwnerTracks(
          Array.isArray(data.tracks)
            ? data.tracks
            : []
        );
      } else {
        setTracks(
          Array.isArray(data.tracks)
            ? data.tracks
            : []
        );
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "DJ music could not be loaded."
      );
    }
  }, [user, owner]);

  useEffect(() => {
    void loadTracks();
  }, [loadTracks]);

  async function upload() {
    if (!user || busy) return;

    if (!file) {
      setMessage("Choose an audio file.");
      return;
    }

    if (
      !title.trim() ||
      !artist.trim() ||
      !rightsholder.trim()
    ) {
      setMessage(
        "Track title, artist, and rights holder are required."
      );
      return;
    }

    if (!confirmed) {
      setMessage(
        "Confirm that you own the music or have permission/license to use it."
      );
      return;
    }

    setBusy(true);
    setMessage(
      "Preparing secure DJ music upload..."
    );

    try {
      const token = await user.getIdToken();

      const prepareResponse = await fetch(
        "/api/dj/music",
        {
          method: "POST",
          headers: {
            Authorization:
              "Bearer " + token,
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            action: "prepare",

            title: title.trim(),
            artist: artist.trim(),
            rightsholder:
              rightsholder.trim(),

            ownershipType,

            label: label.trim(),
            publisher:
              publisher.trim(),

            proofNote:
              proofNote.trim(),

            ownershipConfirmed: true,

            originalName: file.name,

            mime:
              file.type ||
              (file.name
                .toLowerCase()
                .endsWith(".mp3")
                ? "audio/mpeg"
                : file.name
                    .toLowerCase()
                    .endsWith(".wav")
                  ? "audio/wav"
                  : file.name
                      .toLowerCase()
                      .endsWith(".flac")
                    ? "audio/flac"
                    : file.name
                        .toLowerCase()
                        .endsWith(".ogg")
                      ? "audio/ogg"
                      : "audio/mp4"),

            size: file.size,
          }),
        }
      );

      const prepared: PrepareResponse =
        await prepareResponse.json();

      if (
        !prepareResponse.ok ||
        !prepared.success ||
        !prepared.id ||
        !prepared.uploadUrl ||
        !prepared.fields
      ) {
        throw new Error(
          prepared.error ||
            "Secure upload could not be prepared."
        );
      }

      setMessage(
        "Uploading private audio..."
      );

      const form = new FormData();

      Object.entries(
        prepared.fields
      ).forEach(([key, value]) => {
        form.append(key, value);
      });

      form.append("file", file);

      const storageResponse =
        await fetch(
          prepared.uploadUrl,
          {
            method: "POST",
            body: form,
          }
        );

      if (!storageResponse.ok) {
        throw new Error(
          "Audio upload failed before verification."
        );
      }

      setMessage(
        "Verifying audio and checking fingerprint..."
      );

      const finalizeResponse =
        await fetch(
          "/api/dj/music",
          {
            method: "POST",
            headers: {
              Authorization:
                "Bearer " + token,
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              action: "finalize",
              id: prepared.id,
            }),
          }
        );

      const finalized =
        await finalizeResponse.json();

      if (
        !finalizeResponse.ok ||
        !finalized.success
      ) {
        throw new Error(
          finalized.error ||
            "DJ music verification failed."
        );
      }

      setMessage(
        finalized.message ||
          "DJ music upload complete."
      );

      setFile(null);
      setTitle("");
      setArtist("");
      setRightsholder("");
      setOwnershipType("owner");
      setLabel("");
      setPublisher("");
      setProofNote("");
      setConfirmed(false);

      const fileInput =
        document.getElementById(
          "dj-music-file"
        ) as HTMLInputElement | null;

      if (fileInput) {
        fileInput.value = "";
      }

      await loadTracks();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "DJ music upload failed."
      );
    } finally {
      setBusy(false);
    }
  }

  async function review(
    trackId: string,
    action:
      | "approve"
      | "reject"
      | "requestProof"
      | "delete"
  ) {
    if (
      !user ||
      !owner ||
      busy
    ) {
      return;
    }

    let note = "";

    if (action === "reject" || action === "requestProof") {
      note =
        window.prompt(
          action === "reject"
            ? "Reason for rejection:"
            : "What proof should the DJ provide?",
          ""
        ) || "";
    }

    if (
      action === "reject" &&
      !window.confirm(
        "Reject this DJ track?"
      )
    ) {
      return;
    }

    if (
      action === "delete" &&
      !window.confirm(
        "Permanently delete this rejected DJ track and its private audio file?"
      )
    ) {
      return;
    }

    setBusy(true);
    setMessage(
      "Updating DJ music review..."
    );

    try {
      const token =
        await user.getIdToken();

      const response =
        await fetch(
          "/api/owner/dj-music",
          {
            method: "POST",
            headers: {
              Authorization:
                "Bearer " + token,
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              trackId,
              action,
              note,
            }),
          }
        );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.error ||
            "DJ music review failed."
        );
      }

      setMessage(
        data.message ||
          "DJ music review updated."
      );

      await loadTracks();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "DJ music review failed."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-6 rounded-3xl border border-violet-300/25 bg-violet-300/5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black tracking-[0.2em] text-violet-300">
            MUSIC RIGHTS PROTECTION
          </p>

          <h2 className="mt-2 text-2xl font-black">
            DJ Music Ownership
          </h2>

          <p className="mt-3 max-w-3xl text-white/70">
            Upload music only if you own it,
            licensed it, or have permission from
            the rights holder. Every uploaded
            file is privately stored and checked
            for an exact duplicate fingerprint.
          </p>
        </div>
      </div>

      {true && (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <label>
              Audio file
              <input
                id="dj-music-file"
                type="file"
                accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac"
                disabled={busy}
                className={input}
                onChange={event =>
                  setFile(
                    event.target.files?.[0] ||
                      null
                  )
                }
              />
            </label>

            <label>
              Track title
              <input
                className={input}
                value={title}
                disabled={busy}
                maxLength={160}
                onChange={event =>
                  setTitle(
                    event.target.value
                  )
                }
              />
            </label>

            <label>
              Artist
              <input
                className={input}
                value={artist}
                disabled={busy}
                maxLength={160}
                onChange={event =>
                  setArtist(
                    event.target.value
                  )
                }
              />
            </label>

            <label>
              Rights holder
              <input
                className={input}
                value={rightsholder}
                disabled={busy}
                maxLength={200}
                placeholder="Artist, label, publisher, or owner"
                onChange={event =>
                  setRightsholder(
                    event.target.value
                  )
                }
              />
            </label>

            <label>
              Your rights
              <select
                className={input}
                value={ownershipType}
                disabled={busy}
                onChange={event =>
                  setOwnershipType(
                    event.target.value
                  )
                }
              >
                <option value="owner">
                  I own this music
                </option>

                <option value="licensed">
                  I licensed this music
                </option>

                <option value="authorized">
                  I have permission / authorization
                </option>
              </select>
            </label>

            <label>
              Record label (optional)
              <input
                className={input}
                value={label}
                disabled={busy}
                maxLength={160}
                onChange={event =>
                  setLabel(
                    event.target.value
                  )
                }
              />
            </label>

            <label>
              Publisher (optional)
              <input
                className={input}
                value={publisher}
                disabled={busy}
                maxLength={160}
                onChange={event =>
                  setPublisher(
                    event.target.value
                  )
                }
              />
            </label>

            <label>
              License / proof note (optional)
              <textarea
                className={input}
                value={proofNote}
                disabled={busy}
                maxLength={1000}
                rows={3}
                placeholder="License source, agreement details, rights-holder permission, etc."
                onChange={event =>
                  setProofNote(
                    event.target.value
                  )
                }
              />
            </label>
          </div>

          <label className="mt-5 flex items-start gap-3 rounded-2xl border border-amber-300/25 bg-amber-300/5 p-4">
            <input
              type="checkbox"
              checked={confirmed}
              disabled={busy}
              onChange={event =>
                setConfirmed(
                  event.target.checked
                )
              }
              className="mt-1"
            />

            <span className="text-sm text-white/80">
              I confirm that I own this music
              or have a valid license,
              authorization, or permission to
              use it on SOLO BEATS ENGINE MUSIC.
            </span>
          </label>

          <button
            type="button"
            className={
              button +
              " mt-5 bg-violet-300 text-black"
            }
            disabled={
              busy ||
              !file ||
              !title.trim() ||
              !artist.trim() ||
              !rightsholder.trim() ||
              !confirmed
            }
            onClick={() =>
              void upload()
            }
          >
            {busy
              ? "Processing..."
              : "Upload + Check Music"}
          </button>
        </>
      )}

      <p
        role="status"
        aria-live="polite"
        className="mt-5 text-amber-200"
      >
        {message}
      </p>

      {true && (
        <div className="mt-7">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-xl font-black">
              Your DJ Music
            </h3>

            <button
              type="button"
              className={button}
              disabled={busy}
              onClick={() =>
                void loadTracks()
              }
            >
              Refresh
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {tracks.map(track => (
              <article
                key={track.id}
                className="rounded-2xl border border-white/10 bg-black/20 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-black">
                      {track.title ||
                        track.originalName}
                    </p>

                    <p className="mt-1 text-sm text-white/60">
                      {track.artist}
                    </p>

                    <p className="mt-2 text-xs text-white/45">
                      Rights holder:{" "}
                      {track.rightsholder}
                    </p>
                  </div>

                  <span
                    className={
                      "rounded-full border px-3 py-1 text-xs font-black uppercase " +
                      statusClass(
                        track.status
                      )
                    }
                  >
                    {track.status}
                  </span>
                </div>

                {track.duplicateDetected && (
                  <p className="mt-3 text-sm text-amber-200">
                    Exact duplicate fingerprint
                    detected. Owner review is
                    required.
                  </p>
                )}

                {track.reviewReason && (
                  <p className="mt-2 text-sm text-amber-200">
                    {track.reviewReason}
                  </p>
                )}

                {track.reviewNote && (
                  <p className="mt-2 text-sm text-white/70">
                    Owner note:{" "}
                    {track.reviewNote}
                  </p>
                )}
              </article>
            ))}

            {!tracks.length && (
              <p className="text-sm text-white/50">
                No DJ music uploaded yet.
              </p>
            )}
          </div>
        </div>
      )}

      {owner && (
        <div className="mt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-black">
                Owner Music Review
              </h3>

              <p className="mt-2 text-sm text-white/60">
                Flagged tracks need attention.
                Cleared tracks passed the exact-file
                duplicate check or were approved
                manually.
              </p>
            </div>

            <button
              type="button"
              className={button}
              disabled={busy}
              onClick={() =>
                void loadTracks()
              }
            >
              Refresh Reviews
            </button>
          </div>

          <div className="mt-5 space-y-4">
            {ownerTracks.map(track => (
              <article
                key={track.id}
                className="rounded-2xl border border-white/10 bg-black/20 p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="font-black">
                      {track.title ||
                        track.originalName}
                    </p>

                    <p className="mt-1 text-sm text-white/70">
                      {track.artist}
                    </p>

                    <p className="mt-2 text-xs text-white/50">
                      DJ account:{" "}
                      {track.email || "Unknown"}
                    </p>

                    <p className="mt-1 text-xs text-white/50">
                      Rights holder:{" "}
                      {track.rightsholder}
                    </p>

                    <p className="mt-1 text-xs text-white/50">
                      Rights type:{" "}
                      {track.ownershipType}
                    </p>
                  </div>

                  <span
                    className={
                      "rounded-full border px-3 py-1 text-xs font-black uppercase " +
                      statusClass(
                        track.status
                      )
                    }
                  >
                    {track.status}
                  </span>
                </div>

                {track.proofNote && (
                  <p className="mt-4 rounded-xl border border-white/10 p-3 text-sm text-white/70">
                    DJ proof note:{" "}
                    {track.proofNote}
                  </p>
                )}

                {track.reviewReason && (
                  <p className="mt-3 text-sm text-amber-200">
                    {track.reviewReason}
                  </p>
                )}

                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    className={
                      button +
                      " bg-emerald-300 text-black"
                    }
                    disabled={busy}
                    onClick={() =>
                      void review(
                        track.id,
                        "approve"
                      )
                    }
                  >
                    Approve
                  </button>

                  <button
                    type="button"
                    className={button}
                    disabled={busy}
                    onClick={() =>
                      void review(
                        track.id,
                        "requestProof"
                      )
                    }
                  >
                    Request Proof
                  </button>

                  <button
                    type="button"
                    className={
                      button +
                      " border-red-300/40 text-red-200"
                    }
                    disabled={busy}
                    onClick={() =>
                      void review(
                        track.id,
                        "reject"
                      )
                    }
                  >
                    Reject
                  </button>

                  {track.status === "rejected" && (
                    <button
                      type="button"
                      className={
                        button +
                        " border-red-500/60 bg-red-500/10 text-red-200"
                      }
                      disabled={busy}
                      onClick={() =>
                        void review(
                          track.id,
                          "delete"
                        )
                      }
                    >
                      Delete Rejected
                    </button>
                  )}
                </div>
              </article>
            ))}

            {!ownerTracks.length && (
              <p className="text-sm text-white/50">
                No DJ music submissions yet.
              </p>
            )}
          </div>
        </div>
      )}

      <p className="mt-5 text-xs text-white/45">
        Exact fingerprint protection detects the
        identical uploaded audio file. Acoustic
        matching of altered or re-encoded versions
        will be added separately.
      </p>
    </section>
  );
}


