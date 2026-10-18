"use client";

import Link from "next/link";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  useAuth,
} from "../../auth/AuthContext";

type Report = {
  id: string;
  reporterEmail: string;
  reportType: string;
  postId: string;
  targetUid: string;
  username: string;
  reason: string;
  details: string;
  status: string;
  ownerNote: string;
  createdAt: string | null;
};

export default function ConnectModerationPage() {
  const {
    user,
    loading:
      authLoading,
  } = useAuth();

  const [
    reports,
    setReports,
  ] = useState<Report[]>(
    []
  );

  const [
    openCount,
    setOpenCount,
  ] = useState(0);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const load =
    useCallback(
      async () => {
        if (!user) {
          setLoading(false);
          return;
        }

        try {
          const token =
            await user.getIdToken();

          const response =
            await fetch(
              "/api/owner/connect-moderation",
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
            !response.ok ||
            !data.success
          ) {
            throw new Error(
              data.error ||
                "Moderation reports could not be loaded."
            );
          }

          setReports(
            Array.isArray(
              data.reports
            )
              ? data.reports
              : []
          );

          setOpenCount(
            Number(
              data.openCount ||
                0
            )
          );
        }
        catch (loadError) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Moderation reports could not be loaded."
          );
        }
        finally {
          setLoading(false);
        }
      },
      [user]
    );

  useEffect(() => {
    if (
      !authLoading
    ) {
      void load();
    }
  }, [
    authLoading,
    load,
  ]);

  async function action(
    report: Report,
    moderationAction:
      "resolve" |
      "dismiss" |
      "reopen" |
      "remove-post"
  ) {
    if (!user) {
      return;
    }

    if (
      moderationAction ===
        "remove-post" &&
      !window.confirm(
        "Permanently remove this reported post and its media?"
      )
    ) {
      return;
    }

    const ownerNote =
      window.prompt(
        "Optional moderation note:",
        report.ownerNote ||
          ""
      );

    if (
      ownerNote === null
    ) {
      return;
    }

    try {
      const token =
        await user.getIdToken();

      const response =
        await fetch(
          "/api/owner/connect-moderation",
          {
            method:
              "PATCH",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${token}`,
            },

            body:
              JSON.stringify({
                reportId:
                  report.id,

                action:
                  moderationAction,

                ownerNote,
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
            "Moderation action failed."
        );
      }

      await load();
    }
    catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Moderation action failed."
      );
    }
  }

  if (
    loading ||
    authLoading
  ) {
    return (
      <main className="grid min-h-screen place-items-center">
        Loading moderation...
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 pb-28 pt-12 sm:px-8">
      <div className="mx-auto max-w-6xl">

        <section className="rounded-[2rem] border border-red-400/20 bg-gradient-to-br from-red-500/15 via-black to-violet-500/15 p-8">
          <p className="text-sm font-black tracking-[0.22em] text-red-300">
            OWNER CONTROL
          </p>

          <h1 className="mt-3 text-4xl font-black sm:text-6xl">
            CONNECT MODERATION
          </h1>

          <p className="mt-4 text-white/55">
            Reports, copyright claims and content removal.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/developer"
              className="rounded-xl bg-white px-5 py-3 font-black text-black"
            >
              DEVELOPER
            </Link>

            <Link
              href="/connect"
              className="rounded-xl border border-white/10 px-5 py-3 font-black"
            >
              SOLO CONNECT
            </Link>
          </div>
        </section>

        <section className="mt-8 rounded-3xl border border-red-300/20 bg-red-300/[0.06] p-7">
          <p className="text-red-200">
            OPEN REPORTS
          </p>

          <p className="mt-2 text-5xl font-black">
            {openCount}
          </p>
        </section>

        {error ? (
          <p className="mt-6 rounded-2xl border border-red-400/20 bg-red-400/10 p-4 text-red-200">
            {error}
          </p>
        ) : null}

        <section className="mt-8 space-y-4">
          {reports.map(
            report => (
              <article
                key={report.id}
                className="rounded-3xl border border-white/10 bg-white/[0.035] p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-5">

                  <div>
                    <p className="font-black uppercase text-red-300">
                      {report.reportType}
                    </p>

                    <h2 className="mt-2 text-xl font-black">
                      {report.reason}
                    </h2>

                    {report.username ? (
                      <p className="mt-1 text-cyan-300">
                        @{report.username}
                      </p>
                    ) : null}

                    {report.postId ? (
                      <p className="mt-2 text-xs text-white/35">
                        Post: {report.postId}
                      </p>
                    ) : null}

                    <p className="mt-2 text-sm text-white/45">
                      Reporter: {report.reporterEmail || "Member"}
                    </p>

                    {report.details ? (
                      <p className="mt-4 max-w-3xl whitespace-pre-wrap leading-7 text-white/65">
                        {report.details}
                      </p>
                    ) : null}

                    {report.ownerNote ? (
                      <p className="mt-4 rounded-xl bg-white/5 p-3 text-sm text-white/50">
                        Owner note: {report.ownerNote}
                      </p>
                    ) : null}
                  </div>

                  <div className="text-right">
                    <p
                      className={
                        report.status ===
                        "open"
                          ? "font-black text-amber-300"
                          : report.status ===
                            "resolved"
                            ? "font-black text-emerald-300"
                            : "font-black text-white/40"
                      }
                    >
                      {report.status.toUpperCase()}
                    </p>

                    {report.createdAt ? (
                      <p className="mt-2 text-xs text-white/35">
                        {new Date(
                          report.createdAt
                        ).toLocaleString()}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap gap-3 border-t border-white/10 pt-5">

                  {report.postId &&
                  report.status ===
                    "open" ? (
                    <button
                      type="button"
                      onClick={() =>
                        void action(
                          report,
                          "remove-post"
                        )
                      }
                      className="rounded-xl bg-red-400 px-5 py-3 font-black text-black"
                    >
                      REMOVE POST
                    </button>
                  ) : null}

                  {report.status ===
                  "open" ? (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          void action(
                            report,
                            "resolve"
                          )
                        }
                        className="rounded-xl bg-emerald-400 px-5 py-3 font-black text-black"
                      >
                        RESOLVE
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          void action(
                            report,
                            "dismiss"
                          )
                        }
                        className="rounded-xl border border-white/10 px-5 py-3 font-black"
                      >
                        DISMISS
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        void action(
                          report,
                          "reopen"
                        )
                      }
                      className="rounded-xl border border-amber-300/20 px-5 py-3 font-black text-amber-200"
                    >
                      REOPEN
                    </button>
                  )}
                </div>
              </article>
            )
          )}

          {reports.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-white/15 p-10 text-center text-white/40">
              No SOLO CONNECT reports.
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}