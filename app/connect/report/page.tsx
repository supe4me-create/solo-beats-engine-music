"use client";

import Link from "next/link";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";

import {
  useAuth,
} from "../../auth/AuthContext";

export default function ConnectReportPage() {
  const {
    user,
    loading,
  } = useAuth();

  const [
    reportType,
    setReportType,
  ] = useState("profile");

  const [
    postId,
    setPostId,
  ] = useState("");

  const [
    targetUid,
    setTargetUid,
  ] = useState("");

  const [
    username,
    setUsername,
  ] = useState("");

  const [
    reason,
    setReason,
  ] = useState(
    "spam"
  );

  const [
    details,
    setDetails,
  ] = useState("");

  const [
    message,
    setMessage,
  ] = useState("");

  const [
    error,
    setError,
  ] = useState("");

  const [
    working,
    setWorking,
  ] = useState(false);

  useEffect(() => {
    const params =
      new URLSearchParams(
        window.location.search
      );

    const type =
      params.get("type") ||
      "profile";

    setReportType(
      [
        "post",
        "profile",
        "copyright",
      ].includes(type)
        ? type
        : "profile"
    );

    setPostId(
      params.get("postId") ||
        ""
    );

    setTargetUid(
      params.get("uid") ||
        ""
    );

    setUsername(
      params.get("username") ||
        ""
    );
  }, []);

  async function submitReport(
    event:
      FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!user) {
      return;
    }

    setWorking(true);
    setError("");
    setMessage("");

    try {
      const token =
        await user.getIdToken();

      const response =
        await fetch(
          "/api/connect/moderation",
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
                action:
                  "report",

                reportType,

                postId,

                targetUid,

                username,

                reason,

                details,
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
            "Report could not be submitted."
        );
      }

      setMessage(
        "Report submitted to SOLO BEATS moderation."
      );

      setDetails("");
    }
    catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Report could not be submitted."
      );
    }
    finally {
      setWorking(false);
    }
  }

  async function blockMember() {
    if (
      !user ||
      !targetUid
    ) {
      return;
    }

    if (
      !window.confirm(
        "Block this SOLO CONNECT member? Their posts will be hidden from your feed."
      )
    ) {
      return;
    }

    setWorking(true);
    setError("");
    setMessage("");

    try {
      const token =
        await user.getIdToken();

      const response =
        await fetch(
          "/api/connect/moderation",
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
                action:
                  "block",

                targetUid,
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
            "Member could not be blocked."
        );
      }

      setMessage(
        "Member blocked. Their posts will no longer appear in your SOLO CONNECT feed."
      );
    }
    catch (blockError) {
      setError(
        blockError instanceof Error
          ? blockError.message
          : "Member could not be blocked."
      );
    }
    finally {
      setWorking(false);
    }
  }

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center">
        Loading...
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen px-5 py-16">
        <div className="mx-auto max-w-xl rounded-3xl border border-white/10 p-8">
          <h1 className="text-3xl font-black">
            Sign in required
          </h1>

          <Link
            href="/account?mode=signin"
            className="mt-5 inline-flex rounded-xl bg-white px-5 py-3 font-black text-black"
          >
            SIGN IN
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 pb-28 pt-12 sm:px-8">
      <div className="mx-auto max-w-3xl">

        <Link
          href="/connect"
          className="font-black text-cyan-300"
        >
          ← SOLO CONNECT
        </Link>

        <section className="mt-5 rounded-[2rem] border border-red-400/20 bg-gradient-to-br from-red-500/15 via-black to-violet-500/10 p-8">
          <p className="text-sm font-black tracking-[0.22em] text-red-300">
            SAFETY & MODERATION
          </p>

          <h1 className="mt-3 text-4xl font-black">
            REPORT
          </h1>

          {username ? (
            <p className="mt-3 text-white/60">
              Reporting @{username}
            </p>
          ) : null}
        </section>

        {error ? (
          <p className="mt-6 rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-red-200">
            {error}
          </p>
        ) : null}

        {message ? (
          <p className="mt-6 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-emerald-200">
            {message}
          </p>
        ) : null}

        <form
          onSubmit={submitReport}
          className="mt-8 rounded-3xl border border-white/10 bg-white/[0.035] p-7"
        >
          <label className="font-black">
            REPORT TYPE
          </label>

          <select
            value={reportType}
            onChange={
              event =>
                setReportType(
                  event.target.value
                )
            }
            className="mt-3 w-full rounded-xl border border-white/10 bg-black px-4 py-3"
          >
            <option value="post">
              Post
            </option>

            <option value="profile">
              Profile / Member
            </option>

            <option value="copyright">
              Copyright / Ownership
            </option>
          </select>

          <label className="mt-6 block font-black">
            REASON
          </label>

          <select
            value={reason}
            onChange={
              event =>
                setReason(
                  event.target.value
                )
            }
            className="mt-3 w-full rounded-xl border border-white/10 bg-black px-4 py-3"
          >
            <option value="spam">
              Spam
            </option>

            <option value="harassment">
              Harassment
            </option>

            <option value="copyright">
              Copyright / stolen content
            </option>

            <option value="impersonation">
              Impersonation
            </option>

            <option value="unsafe">
              Unsafe or prohibited content
            </option>

            <option value="other">
              Other
            </option>
          </select>

          <label className="mt-6 block font-black">
            DETAILS
          </label>

          <textarea
            rows={6}
            value={details}
            onChange={
              event =>
                setDetails(
                  event.target.value
                )
            }
            placeholder="Explain what happened. For copyright reports, include ownership details."
            className="mt-3 w-full rounded-xl border border-white/10 bg-black px-4 py-3"
          />

          <button
            type="submit"
            disabled={working}
            className="mt-6 rounded-xl bg-red-400 px-6 py-3 font-black text-black disabled:opacity-50"
          >
            SUBMIT REPORT
          </button>
        </form>

        {targetUid ? (
          <section className="mt-6 rounded-3xl border border-white/10 p-7">
            <h2 className="text-xl font-black">
              BLOCK MEMBER
            </h2>

            <p className="mt-2 text-white/50">
              Blocking hides this member's posts from your SOLO CONNECT feed.
            </p>

            <button
              type="button"
              disabled={working}
              onClick={() =>
                void blockMember()
              }
              className="mt-5 rounded-xl border border-red-400/30 px-5 py-3 font-black text-red-300"
            >
              BLOCK MEMBER
            </button>
          </section>
        ) : null}
      </div>
    </main>
  );
}