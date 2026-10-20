"use client";

import Link from "next/link";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  onAuthStateChanged,
  type User,
} from "firebase/auth";

import {
  upload,
} from "@vercel/blob/client";

import {
  firebaseAuth,
} from "../../../lib/firebaseClient";

type OutputFormat =
  | "mp3"
  | "wav"
  | "flac"
  | "m4a"
  | "aac"
  | "ogg";

export default function CustomerAudioConverterPage() {
  const inputRef =
    useRef<HTMLInputElement | null>(
      null
    );

  const [
    user,
    setUser,
  ] =
    useState<User | null>(
      null
    );

  const [
    authReady,
    setAuthReady,
  ] =
    useState(false);

  const [
    file,
    setFile,
  ] =
    useState<File | null>(
      null
    );

  const [
    format,
    setFormat,
  ] =
    useState<OutputFormat>(
      "mp3"
    );

  const [
    balance,
    setBalance,
  ] =
    useState(0);

  const [
    busy,
    setBusy,
  ] =
    useState(false);

  const [
    message,
    setMessage,
  ] =
    useState("");

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    resultUrl,
    setResultUrl,
  ] =
    useState("");

  const [
    resultName,
    setResultName,
  ] =
    useState("");

  useEffect(() => {
    return onAuthStateChanged(
      firebaseAuth,
      currentUser => {
        setUser(
          currentUser
        );

        setAuthReady(
          true
        );
      }
    );
  }, []);

  async function loadBalance(
    currentUser: User
  ) {
    const token =
      await currentUser.getIdToken();

    const response =
      await fetch(
        "/api/audio-credits/status",
        {
          headers: {
            Authorization:
              `Bearer ${token}`,
          },

          cache:
            "no-store",
        }
      );

    const data =
      await response.json();

    if (
      response.ok &&
      data.success
    ) {
      setBalance(
        Number(
          data.balance ||
          0
        )
      );
    }
  }

  useEffect(() => {
    if (
      user
    ) {
      void loadBalance(
        user
      );
    } else {
      setBalance(
        0
      );
    }
  }, [
    user,
  ]);

  async function convert() {
    const currentUser =
      firebaseAuth.currentUser;

    if (!currentUser) {
      setError(
        "Sign in before using Audio Conversion."
      );
      return;
    }

    if (
      !currentUser.emailVerified
    ) {
      setError(
        "Verify your email before using Audio Conversion."
      );
      return;
    }

    if (!file) {
      setError(
        "Choose an audio file first."
      );
      return;
    }

    if (
      balance <
      1
    ) {
      setError(
        "You need at least 1 Audio Credit."
      );
      return;
    }

    setBusy(
      true
    );

    setError(
      ""
    );

    setMessage(
      "Uploading audio..."
    );

    setResultUrl(
      ""
    );

    try {
      const token =
        await currentUser.getIdToken();

      const uploaded =
        await upload(
          `customer-audio-input/${file.name}`,
          file,
          {
            access:
              "public",

            handleUploadUrl:
              "/api/audio-tools/converter-upload",

            headers: {
              Authorization:
                `Bearer ${token}`,
            },

            multipart:
              true,
          }
        );

      setMessage(
        "Converting audio..."
      );

      const response =
        await fetch(
          "/api/audio-tools/converter",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${token}`,
            },

            body:
              JSON.stringify({
                blobUrl:
                  uploaded.url,

                originalName:
                  file.name,

                format,
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
          "Audio conversion failed."
        );
      }

      setResultUrl(
        data.url ||
        ""
      );

      setResultName(
        data.filename ||
        `converted.${format}`
      );

      setBalance(
        Number(
          data.balance ||
          0
        )
      );

      setMessage(
        `Conversion complete. 1 Audio Credit used. ${data.balance} remaining.`
      );
    } catch (convertError) {
      setError(
        convertError instanceof Error
          ? convertError.message
          : "Audio conversion failed."
      );

      setMessage(
        ""
      );
    } finally {
      setBusy(
        false
      );
    }
  }

  if (
    !authReady
  ) {
    return (
      <main className="min-h-screen px-5 pb-32 pt-52 text-white">
        <div className="mx-auto max-w-5xl">
          Loading Audio Converter...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-5 pb-32 pt-52 text-white sm:px-8">
      <div className="mx-auto max-w-5xl">

        <section className="rounded-[2rem] border border-cyan-300/15 bg-gradient-to-br from-cyan-500/15 via-white/[0.03] to-violet-500/15 p-7 sm:p-10">

          <p className="text-sm font-black uppercase tracking-[0.24em] text-cyan-300">
            SOLO BEATS ENGINE MUSIC
          </p>

          <h1 className="mt-3 text-4xl font-black sm:text-6xl">
            Audio Converter
          </h1>

          <p className="mt-4 max-w-3xl text-lg leading-8 text-white/60">
            Convert your audio between professional formats.
          </p>

          <div className="mt-6 inline-flex rounded-2xl border border-emerald-300/20 bg-emerald-300/10 px-6 py-4">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-emerald-200/60">
                Your Balance
              </p>

              <p className="mt-1 text-4xl font-black text-emerald-200">
                {balance}
              </p>

              <p className="text-sm text-white/45">
                Audio Credits
              </p>
            </div>
          </div>

        </section>

        {!user ? (
          <section className="mt-8 rounded-[2rem] border border-white/10 bg-white/[0.04] p-7">

            <p className="text-lg font-black">
              Sign in required
            </p>

            <Link
              href="/account?mode=signin"
              className="mt-5 inline-flex rounded-2xl bg-white px-6 py-3 font-black text-black"
            >
              Sign in
            </Link>

          </section>
        ) : (
          <section className="mt-8 rounded-[2rem] border border-white/10 bg-white/[0.04] p-7">

            <div className="flex flex-wrap items-center justify-between gap-4">

              <div>
                <p className="text-sm font-black uppercase tracking-[0.2em] text-violet-300">
                  1 CREDIT PER CONVERSION
                </p>

                <h2 className="mt-2 text-3xl font-black">
                  Convert Audio
                </h2>
              </div>

              <Link
                href="/audio-tools"
                className="rounded-xl border border-white/10 px-4 py-2 text-sm font-black text-white/70"
              >
                Buy Credits
              </Link>

            </div>

            <input
              ref={inputRef}
              hidden
              type="file"
              accept=".wav,.mp3,.flac,.m4a,.aac,.ogg,audio/*"
              onChange={event => {
                const next =
                  event.target
                    .files?.[0] ||
                  null;

                setFile(
                  next
                );

                setResultUrl(
                  ""
                );

                setMessage(
                  next
                    ? `${next.name} selected.`
                    : ""
                );
              }}
            />

            <div className="mt-7 grid gap-5 md:grid-cols-2">

              <div className="rounded-2xl border border-white/10 bg-black/20 p-5">

                <p className="text-xs font-black uppercase tracking-widest text-white/40">
                  Audio File
                </p>

                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    inputRef.current?.click()
                  }
                  className="mt-4 w-full rounded-xl bg-blue-600 px-5 py-4 font-black disabled:opacity-40"
                >
                  {file
                    ? "Change File"
                    : "Choose Audio File"}
                </button>

                {file ? (
                  <p className="mt-3 break-all text-sm text-white/55">
                    {file.name}
                  </p>
                ) : null}

              </div>

              <div className="rounded-2xl border border-white/10 bg-black/20 p-5">

                <p className="text-xs font-black uppercase tracking-widest text-white/40">
                  Output Format
                </p>

                <select
                  value={format}
                  disabled={busy}
                  onChange={event =>
                    setFormat(
                      event.target.value as OutputFormat
                    )
                  }
                  className="mt-4 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-4 font-black text-white"
                >
                  <option value="mp3">MP3</option>
                  <option value="wav">WAV 24-BIT</option>
                  <option value="flac">FLAC</option>
                  <option value="m4a">M4A</option>
                  <option value="aac">AAC</option>
                  <option value="ogg">OGG</option>
                </select>

              </div>

            </div>

            <button
              type="button"
              disabled={
                busy ||
                !file ||
                balance < 1
              }
              onClick={() =>
                void convert()
              }
              className="mt-6 w-full rounded-2xl bg-emerald-400 px-6 py-4 text-lg font-black text-black disabled:opacity-35"
            >
              {busy
                ? "CONVERTING..."
                : "CONVERT AUDIO — 1 CREDIT"}
            </button>

            {balance < 1 ? (
              <p className="mt-4 text-sm text-amber-200">
                You need at least 1 Audio Credit to run a conversion.
              </p>
            ) : null}

            {resultUrl ? (
              <a
                href={resultUrl}
                download={resultName}
                className="mt-5 block rounded-2xl border border-cyan-300/20 bg-cyan-300/10 px-6 py-4 text-center font-black text-cyan-100"
              >
                DOWNLOAD {resultName}
              </a>
            ) : null}

            {message ? (
              <p className="mt-5 rounded-xl border border-emerald-300/20 bg-emerald-300/10 p-4 text-sm text-emerald-200">
                {message}
              </p>
            ) : null}

            {error ? (
              <p className="mt-5 rounded-xl border border-red-300/20 bg-red-400/10 p-4 text-sm text-red-200">
                {error}
              </p>
            ) : null}

          </section>
        )}

      </div>
    </main>
  );
}
