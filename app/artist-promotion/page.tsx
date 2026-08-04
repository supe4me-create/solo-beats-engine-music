"use client";

import Link from "next/link";
import {
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import {
  FormEvent,
  useEffect,
  useState,
} from "react";

import { firebaseAuth } from "../../lib/firebaseClient";

type PromotionDuration =
  | "7"
  | "14"
  | "30";

export default function ArtistPromotionPage() {
  const [user, setUser] =
    useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] =
    useState(true);

  const [artistName, setArtistName] =
    useState("");
  const [songTitle, setSongTitle] =
    useState("");
  const [genre, setGenre] =
    useState("");
  const [duration, setDuration] =
    useState<PromotionDuration>("7");
  const [description, setDescription] =
    useState("");
  const [socialLink, setSocialLink] =
    useState("");
  const [youtubeLink, setYoutubeLink] =
    useState("");
  const [songFile, setSongFile] =
    useState<File | null>(null);
  const [artworkFile, setArtworkFile] =
    useState<File | null>(null);

  const [submitting, setSubmitting] =
    useState(false);
  const [successMessage, setSuccessMessage] =
    useState("");
  const [errorMessage, setErrorMessage] =
    useState("");

  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        firebaseAuth,
        (currentUser) => {
          setUser(currentUser);
          setLoadingAuth(false);
        }
      );

    return unsubscribe;
  }, []);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const form =
      event.currentTarget;

    if (!user) {
      setErrorMessage(
        "You must sign in before submitting music for promotion."
      );
      return;
    }

    if (!songFile || !artworkFile) {
      setErrorMessage(
        "A song file and artwork file are required."
      );
      return;
    }

    if (
      songFile.size >
      100 * 1024 * 1024
    ) {
      setErrorMessage(
        "The song file exceeds the 100 MB limit."
      );
      return;
    }

    if (
      artworkFile.size >
      10 * 1024 * 1024
    ) {
      setErrorMessage(
        "The artwork file exceeds the 10 MB limit."
      );
      return;
    }

    setSubmitting(true);
    setSuccessMessage("");
    setErrorMessage("");

    try {
      const idToken =
        await user.getIdToken();

      const fileInfo = (
        file: File
      ) => ({
        name: file.name,
        type: file.type,
        size: file.size,
      });

      const submissionData = {
        artistName,
        songTitle,
        genre,
        duration,
        description,
        socialLink,
        youtubeLink,
        songFile:
          fileInfo(songFile),
        artworkFile:
          fileInfo(artworkFile),
      };

      const prepareResponse =
        await fetch(
          "/api/artist-promotion/submit",
          {
            method: "POST",
            headers: {
              Authorization:
                `Bearer ${idToken}`,
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              action: "prepare",
              ...submissionData,
            }),
          }
        );

      const prepareText =
        await prepareResponse.text();

      let prepared: {
        success?: boolean;
        error?: string;
        submissionId?: string;
        songStoragePath?: string;
        artworkStoragePath?: string;
        songUploadUrl?: string;
        artworkUploadUrl?: string;
      };

      try {
        prepared =
          JSON.parse(prepareText);
      } catch {
        throw new Error(
          prepareResponse.status ===
            413
            ? "The selected files are too large to submit."
            : "The promotion service returned an invalid response."
        );
      }

      if (
        !prepareResponse.ok ||
        !prepared.success ||
        !prepared.submissionId ||
        !prepared.songStoragePath ||
        !prepared.artworkStoragePath ||
        !prepared.songUploadUrl ||
        !prepared.artworkUploadUrl
      ) {
        throw new Error(
          prepared.error ||
            "The promotion submission could not be prepared."
        );
      }

      const songUpload =
        await fetch(
          prepared.songUploadUrl,
          {
            method: "PUT",
            headers: {
              "Content-Type":
                songFile.type,
            },
            body: songFile,
          }
        );

      if (!songUpload.ok) {
        throw new Error(
          "The song file could not be uploaded."
        );
      }

      const artworkUpload =
        await fetch(
          prepared.artworkUploadUrl,
          {
            method: "PUT",
            headers: {
              "Content-Type":
                artworkFile.type,
            },
            body: artworkFile,
          }
        );

      if (!artworkUpload.ok) {
        throw new Error(
          "The artwork file could not be uploaded."
        );
      }

      const response = await fetch(
        "/api/artist-promotion/submit",
        {
          method: "POST",
          headers: {
            Authorization:
              `Bearer ${idToken}`,
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            action: "finalize",
            ...submissionData,
            submissionId:
              prepared.submissionId,
            songStoragePath:
              prepared.songStoragePath,
            artworkStoragePath:
              prepared.artworkStoragePath,
          }),
        }
      );

      const responseText =
        await response.text();

      let data: {
        success?: boolean;
        error?: string;
      };

      try {
        data =
          JSON.parse(responseText);
      } catch {
        throw new Error(
          "The promotion service returned an invalid response."
        );
      }

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.error ||
            "The promotion submission could not be completed."
        );
      }

      setSuccessMessage(
        "Your promotion submission was received and is waiting for owner review."
      );

      setArtistName("");
      setSongTitle("");
      setGenre("");
      setDuration("7");
      setDescription("");
      setSocialLink("");
      setYoutubeLink("");
      setSongFile(null);
      setArtworkFile(null);

      form.reset();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "The promotion submission could not be completed."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingAuth) {
    return (
      <main className="min-h-screen px-5 pb-32 pt-52 sm:px-8">
        <section className="mx-auto max-w-5xl rounded-[2rem] border border-white/10 bg-white/[0.035] p-10 text-center">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-violet-300">
            Artist Promotion
          </p>
          <h1 className="mt-3 text-4xl font-black">
            Loading...
          </h1>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-5 pb-40 pt-52 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <section className="rounded-[2.5rem] border border-violet-300/20 bg-gradient-to-br from-violet-700/30 via-black/50 to-cyan-500/15 p-8 shadow-2xl sm:p-12">
          <p className="text-sm font-black uppercase tracking-[0.22em] text-emerald-300">
            Promote Your Music
          </p>

          <h1 className="mt-4 text-5xl font-black sm:text-7xl">
            Artist Promotion
          </h1>

          <p className="mt-5 max-w-3xl text-lg leading-8 text-white/60">
            Submit your song, artwork, and optional YouTube video for possible sponsored placement across SOLO BEATS ENGINE MUSIC. Every submission is reviewed before publishing.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-white/70">
              7 Days
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-white/70">
              14 Days
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-white/70">
              30 Days
            </span>
          </div>
        </section>

        <section className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
          <form
            onSubmit={handleSubmit}
            className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-6 sm:p-8"
          >
            <div>
              <p className="text-sm font-black uppercase tracking-[0.18em] text-violet-300">
                Promotion Submission
              </p>
              <h2 className="mt-2 text-3xl font-black">
                Submit your song
              </h2>
            </div>

            {!user ? (
              <div className="mt-6 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-5 text-amber-100">
                <p className="font-black">
                  Sign in required
                </p>
                <p className="mt-2 text-sm">
                  You must sign in before uploading a song and artwork.
                </p>
                <Link
                  href="/account"
                  className="mt-4 inline-flex rounded-xl bg-white px-4 py-3 font-black text-black"
                >
                  Open Account
                </Link>
              </div>
            ) : null}

            <div className="mt-7 grid gap-5 sm:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm font-black text-white/70">
                  Artist name
                </span>
                <input
                  required
                  value={artistName}
                  onChange={(event) =>
                    setArtistName(
                      event.target.value
                    )
                  }
                  className="rounded-2xl border border-white/10 bg-black/25 px-4 py-4 outline-none focus:border-violet-400"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-black text-white/70">
                  Song title
                </span>
                <input
                  required
                  value={songTitle}
                  onChange={(event) =>
                    setSongTitle(
                      event.target.value
                    )
                  }
                  className="rounded-2xl border border-white/10 bg-black/25 px-4 py-4 outline-none focus:border-violet-400"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-black text-white/70">
                  Genre
                </span>
                <input
                  required
                  value={genre}
                  onChange={(event) =>
                    setGenre(
                      event.target.value
                    )
                  }
                  className="rounded-2xl border border-white/10 bg-black/25 px-4 py-4 outline-none focus:border-violet-400"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-black text-white/70">
                  Promotion duration
                </span>
                <select
                  value={duration}
                  onChange={(event) =>
                    setDuration(
                      event.target.value as PromotionDuration
                    )
                  }
                  className="rounded-2xl border border-white/10 bg-black/25 px-4 py-4 outline-none focus:border-violet-400"
                >
                  <option value="7">
                    7 days
                  </option>
                  <option value="14">
                    14 days
                  </option>
                  <option value="30">
                    30 days
                  </option>
                </select>
              </label>
            </div>

            <label className="mt-5 grid gap-2">
              <span className="text-sm font-black text-white/70">
                Short description
              </span>
              <textarea
                required
                maxLength={600}
                value={description}
                onChange={(event) =>
                  setDescription(
                    event.target.value
                  )
                }
                rows={5}
                className="rounded-2xl border border-white/10 bg-black/25 px-4 py-4 outline-none focus:border-violet-400"
              />
            </label>

            <label className="mt-5 grid gap-2">
              <span className="text-sm font-black text-white/70">
                Artist website or social link
              </span>
              <input
                type="url"
                value={socialLink}
                onChange={(event) =>
                  setSocialLink(
                    event.target.value
                  )
                }
                placeholder="https://"
                className="rounded-2xl border border-white/10 bg-black/25 px-4 py-4 outline-none focus:border-violet-400"
              />
            </label>

            <label className="mt-5 grid gap-2">
              <span className="text-sm font-black text-white/70">
                YouTube promotion video link
              </span>
              <input
                type="url"
                value={youtubeLink}
                onChange={(event) =>
                  setYoutubeLink(
                    event.target.value
                  )
                }
                placeholder="https://www.youtube.com/watch?v=..."
                className="rounded-2xl border border-white/10 bg-black/25 px-4 py-4 outline-none focus:border-violet-400"
              />
              <span className="text-xs text-white/35">
                Optional. Add an official YouTube video, visualizer, lyric video, or music video.
              </span>
            </label>

            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm font-black text-white/70">
                  Song file
                </span>
                <input
                  required
                  type="file"
                  accept=".mp3,.wav,.m4a,audio/*"
                  onChange={(event) =>
                    setSongFile(
                      event.target.files?.[0] ||
                        null
                    )
                  }
                  className="rounded-2xl border border-white/10 bg-black/25 px-4 py-4 text-sm"
                />
                <span className="text-xs text-white/35">
                  MP3, WAV, or M4A. Maximum 100 MB.
                </span>
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-black text-white/70">
                  Artwork
                </span>
                <input
                  required
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,image/*"
                  onChange={(event) =>
                    setArtworkFile(
                      event.target.files?.[0] ||
                        null
                    )
                  }
                  className="rounded-2xl border border-white/10 bg-black/25 px-4 py-4 text-sm"
                />
                <span className="text-xs text-white/35">
                  JPG, PNG, or WEBP. Maximum 10 MB.
                </span>
              </label>
            </div>

            {successMessage ? (
              <p className="mt-6 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4 text-emerald-200">
                {successMessage}
              </p>
            ) : null}

            {errorMessage ? (
              <p className="mt-6 rounded-2xl border border-red-300/20 bg-red-300/10 p-4 text-red-200">
                {errorMessage}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={
                submitting ||
                !user
              }
              className="mt-7 rounded-2xl bg-white px-6 py-4 font-black text-black disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting
                ? "Submitting..."
                : "Submit for Review"}
            </button>
          </form>

          <aside className="rounded-[2rem] border border-white/10 bg-white/[0.035] p-6">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-emerald-300">
              How It Works
            </p>

            <div className="mt-6 grid gap-4">
              <InfoCard
                number="1"
                title="Submit"
                text="Upload your song, artwork, artist details, and preferred promotion duration."
              />
              <InfoCard
                number="2"
                title="Owner Review"
                text="Every submission is reviewed for quality, rights, metadata, and suitability."
              />
              <InfoCard
                number="3"
                title="Payment"
                text="Approved submissions will continue to the promotion payment stage."
              />
              <InfoCard
                number="4"
                title="Featured Placement"
                text="Approved music will appear with a clear Sponsored or Promoted label."
              />
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

function InfoCard({
  number,
  title,
  text,
}: {
  number: string;
  title: string;
  text: string;
}) {
  return (
    <article className="rounded-2xl border border-white/10 bg-black/20 p-5">
      <div className="grid h-10 w-10 place-items-center rounded-full bg-white text-sm font-black text-black">
        {number}
      </div>
      <h3 className="mt-4 text-xl font-black">
        {title}
      </h3>
      <p className="mt-2 text-sm leading-6 text-white/50">
        {text}
      </p>
    </article>
  );
}
