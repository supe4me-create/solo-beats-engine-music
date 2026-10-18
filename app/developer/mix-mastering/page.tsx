"use client";

import {
  ChangeEvent,
  useEffect,
  useState,
} from "react";

import Link from "next/link";

import {
  firebaseAuth,
} from "../../../lib/firebaseClient";

type MixOrder = {
  id: string;
  orderId: string;
  songTitle: string;
  artistName: string;
  genre: string;
  notes: string;
  serviceType: string;
  stemCount: number;
  userEmail: string;
  status: string;
  processingStatus: string;
  createdAt: string;
  submittedAt: string;
  wavUrl: string;
  mp3Url: string;
  wavDownloadUrl: string;
  mp3DownloadUrl: string;

  // SOLO_MM_OWNER_PAID_DISPLAY_V1
  paymentStatus?: string;
  priceUsd?: number;
  currency?: string;
  paypalOrderId?: string;
  paypalCaptureId?: string;
  paidAt?: string;
  ownerDirect?: boolean;

  autoMixMaster?: {
    state?: string;
    version?: string;
    targetLufs?: number;
    truePeakDb?: number;

    recipe?: Array<{
      index: number;
      name: string;
      role: string;
    }>;
  } | null;
};

type DirectService =
  | "MASTER_ONLY"
  | "MIX_MASTER";

export default function OwnerMixMasteringPage() {
  const [
    orders,
    setOrders,
  ] =
    useState<MixOrder[]>(
      []
    );

  const [
    message,
    setMessage,
  ] =
    useState(
      "Loading Mix & Mastering orders..."
    );

  const [
    busyOrder,
    setBusyOrder,
  ] =
    useState("");

  const [
    directService,
    setDirectService,
  ] =
    useState<DirectService>(
      "MASTER_ONLY"
    );

  const [
    directTitle,
    setDirectTitle,
  ] =
    useState("");

  const [
    directArtist,
    setDirectArtist,
  ] =
    useState("Solo Beats");

  const [
    directGenre,
    setDirectGenre,
  ] =
    useState("");

  const [
    directNotes,
    setDirectNotes,
  ] =
    useState("");

  const [
    directFiles,
    setDirectFiles,
  ] =
    useState<File[]>([]);

  const [
    directBusy,
    setDirectBusy,
  ] =
    useState(false);

  const [
    deletingOrder,
    setDeletingOrder,
  ] =
    useState("");

  const [
    directFileInputKey,
    setDirectFileInputKey,
  ] =
    useState(0);

  async function ownerToken() {
    const user =
      firebaseAuth.currentUser;

    if (!user) {
      throw new Error(
        "Sign in with the SOLO BEATS owner account first."
      );
    }

    return user.getIdToken();
  }

  async function loadOrders() {
    try {
      const token =
        await ownerToken();

      const response =
        await fetch(
          "/api/owner/mix-mastering/orders",
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
            "Orders could not be loaded."
        );
      }

      setOrders(
        Array.isArray(
          data.orders
        )
          ? data.orders
          : []
      );

      setMessage(
        `${data.orders?.length || 0} Mix & Mastering order(s) loaded.`
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Orders could not be loaded."
      );
    }
  }

  async function autoProcess(
    orderId: string
  ) {
    if (busyOrder) {
      return;
    }

    try {
      setBusyOrder(
        orderId
      );

      setMessage(
        `AUTO processing order ${orderId}...`
      );

      const token =
        await ownerToken();

      const response =
        await fetch(
          "/api/owner/mix-mastering/auto-process",
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
                orderId,
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
            "AUTO MIX & MASTER failed."
        );
      }

      setMessage(
        `AUTO PROCESS COMPLETE — ${orderId}`
      );

      await loadOrders();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "AUTO MIX & MASTER failed."
      );
    } finally {
      setBusyOrder("");
    }
  }

  function handleDirectFiles(
    event:
      ChangeEvent<HTMLInputElement>
  ) {
    const selected =
      Array.from(
        event.target.files || []
      );

    if (
      directService ===
      "MASTER_ONLY"
    ) {
      setDirectFiles(
        selected.slice(
          0,
          1
        )
      );
    } else {
      setDirectFiles(
        selected.slice(
          0,
          20
        )
      );
    }
  }

  function changeDirectService(
    value: DirectService
  ) {
    setDirectService(
      value
    );

    setDirectFiles(
      []
    );
  }

  async function submitDirectJob() {
    if (directBusy) {
      return;
    }

    if (
      directService ===
        "MASTER_ONLY" &&
      directFiles.length !== 1
    ) {
      setMessage(
        "MASTER ONLY requires one finished stereo song."
      );

      return;
    }

    if (
      directService ===
        "MIX_MASTER" &&
      (
        directFiles.length < 1 ||
        directFiles.length > 20
      )
    ) {
      setMessage(
        "MIX & MASTER requires 1 to 20 stems."
      );

      return;
    }

    try {
      setDirectBusy(
        true
      );

      setMessage(
        directService ===
          "MASTER_ONLY"
          ? "Uploading owner MASTER ONLY source..."
          : `Uploading ${directFiles.length} owner stem(s)...`
      );

      const token =
        await ownerToken();

      const form =
        new FormData();

      form.append(
        "serviceType",
        directService
      );

      form.append(
        "songTitle",
        directTitle
      );

      form.append(
        "artistName",
        directArtist
      );

      form.append(
        "genre",
        directGenre
      );

      form.append(
        "notes",
        directNotes
      );

      directFiles.forEach(
        file => {
          form.append(
            "files",
            file
          );
        }
      );

      const response =
        await fetch(
          "/api/owner/mix-mastering/direct-upload",
          {
            method:
              "POST",

            headers: {
              Authorization:
                `Bearer ${token}`,
            },

            body:
              form,
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
            "OWNER DIRECT UPLOAD FAILED"
        );
      }

      setMessage(
        `${
          directService ===
          "MASTER_ONLY"
            ? "OWNER MASTER ONLY"
            : "OWNER MIX & MASTER"
        } READY — ${data.orderId}`
      );

      setDirectFiles(
        []
      );

      await loadOrders();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "OWNER DIRECT UPLOAD FAILED"
      );
    } finally {
      setDirectBusy(
        false
      );
    }
  }


  function clearDirectForm() {
    setDirectTitle("");
    setDirectArtist("Solo Beats");
    setDirectGenre("");
    setDirectNotes("");
    setDirectFiles([]);

    setDirectFileInputKey(
      value => value + 1
    );

    setMessage(
      "OWNER DIRECT FORM CLEARED."
    );
  }

  async function resetDirectForm() {
    setDirectService(
      "MASTER_ONLY"
    );

    setDirectTitle("");
    setDirectArtist("Solo Beats");
    setDirectGenre("");
    setDirectNotes("");
    setDirectFiles([]);

    setDirectFileInputKey(
      value => value + 1
    );

    setMessage(
      "OWNER DIRECT PROCESSING RESET."
    );

    await loadOrders();
  }

  async function deleteOrder(
    orderId: string
  ) {
    if (
      deletingOrder ||
      busyOrder
    ) {
      return;
    }

    const approved =
      window.confirm(
        `DELETE COMPLETED ORDER ${orderId}?\n\nThis permanently removes the order, uploaded audio, WAV and MP3.`
      );

    if (!approved) {
      return;
    }

    try {
      setDeletingOrder(
        orderId
      );

      setMessage(
        `Deleting completed order ${orderId}...`
      );

      const token =
        await ownerToken();

      const response =
        await fetch(
          "/api/owner/mix-mastering/orders",
          {
            method: "DELETE",

            headers: {
              "Content-Type":
                "application/json",

              Authorization:
                `Bearer ${token}`,
            },

            body:
              JSON.stringify({
                orderId,
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
          "ORDER_DELETE_FAILED"
        );
      }

      setOrders(
        current =>
          current.filter(
            order =>
              order.orderId !==
              orderId
          )
      );

      setMessage(
        `ORDER DELETED — ${orderId}`
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "ORDER_DELETE_FAILED"
      );
    } finally {
      setDeletingOrder("");
    }
  }
  useEffect(() => {
    const timer =
      setTimeout(
        () => {
          loadOrders();
        },
        900
      );

    return () =>
      clearTimeout(timer);
  }, []);

  return (
    <main className="min-h-screen bg-black px-5 py-10 text-white md:px-10">
      <section className="mx-auto max-w-7xl">

        <Link
          href="/developer"
          className="text-sm font-black uppercase tracking-[0.2em] text-cyan-300"
        >
          ← DEVELOPER
        </Link>

        {/* SOLO_MM_OWNER_QUICK_ACCESS_V1 */}
        <div className="mt-6 rounded-[2rem] border border-white/10 bg-zinc-950 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.25em] text-cyan-300">
                OWNER QUICK ACCESS
              </p>

              <h2 className="mt-2 text-2xl font-black md:text-3xl">
                MIX & MASTERING CONTROL CENTER
              </h2>

              <p className="mt-2 text-sm text-white/50">
                Fast access to owner processing, customer payments,
                completed masters and all Mix & Mastering orders.
              </p>
            </div>

            <button
              type="button"
              onClick={loadOrders}
              className="rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-5 py-3 font-black text-cyan-200"
            >
              REFRESH
            </button>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-white/10 bg-black p-4">
              <p className="text-xs font-black text-white/40">
                ALL ORDERS
              </p>

              <p className="mt-1 text-3xl font-black">
                {orders.length}
              </p>
            </div>

            <div className="rounded-xl border border-emerald-300/20 bg-emerald-950/20 p-4">
              <p className="text-xs font-black text-emerald-300/70">
                PAID CUSTOMERS
              </p>

              <p className="mt-1 text-3xl font-black text-emerald-300">
                {
                  orders.filter(
                    order =>
                      !order.ownerDirect &&
                      order.paymentStatus === "PAID"
                  ).length
                }
              </p>
            </div>

            <div className="rounded-xl border border-fuchsia-300/20 bg-fuchsia-950/20 p-4">
              <p className="text-xs font-black text-fuchsia-300/70">
                OWNER JOBS
              </p>

              <p className="mt-1 text-3xl font-black text-fuchsia-300">
                {
                  orders.filter(
                    order =>
                      order.ownerDirect
                  ).length
                }
              </p>
            </div>

            <div className="rounded-xl border border-cyan-300/20 bg-cyan-950/20 p-4">
              <p className="text-xs font-black text-cyan-300/70">
                AUTO COMPLETE
              </p>

              <p className="mt-1 text-3xl font-black text-cyan-300">
                {
                  orders.filter(
                    order =>
                      order.processingStatus === "AUTO_COMPLETE" ||
                      order.status === "AUTO_COMPLETE"
                  ).length
                }
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">

            <button
              type="button"
              onClick={() =>
                document
                  .getElementById("mm-owner-direct")
                  ?.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                  })
              }
              className="rounded-xl bg-gradient-to-r from-cyan-300 to-fuchsia-400 px-5 py-3 font-black text-black"
            >
              OWNER DIRECT
            </button>

            <button
              type="button"
              onClick={() =>
                document
                  .getElementById("mm-orders")
                  ?.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                  })
              }
              className="rounded-xl border border-white/15 bg-black px-5 py-3 font-black text-white"
            >
              ALL ORDERS
            </button>

            <button
              type="button"
              onClick={() =>
                document
                  .querySelector(
                    '[data-paid-order="true"]'
                  )
                  ?.scrollIntoView({
                    behavior: "smooth",
                    block: "center",
                  })
              }
              className="rounded-xl border border-emerald-300/30 bg-emerald-950/30 px-5 py-3 font-black text-emerald-300"
            >
              PAID CUSTOMERS
            </button>

            <button
              type="button"
              onClick={() =>
                document
                  .querySelector(
                    '[data-complete-order="true"]'
                  )
                  ?.scrollIntoView({
                    behavior: "smooth",
                    block: "center",
                  })
              }
              className="rounded-xl border border-cyan-300/30 bg-cyan-950/30 px-5 py-3 font-black text-cyan-300"
            >
              COMPLETED
            </button>

          </div>
        </div>

        <div className="mt-6 rounded-[2rem] border border-cyan-300/25 bg-gradient-to-br from-cyan-950/40 via-black to-fuchsia-950/30 p-7">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-cyan-300">
            SOLO BEATS ENGINE
          </p>

          <h1 className="mt-3 text-4xl font-black md:text-6xl">
            AUTO MIX & MASTERING
          </h1>

          <p className="mt-4 max-w-3xl text-white/60">
            Automatic stem balancing,
            stem-specific processing,
            master compression,
            loudness normalization,
            true-peak limiting,
            24-bit WAV and 320 kbps MP3.
          </p>

          <button
            type="button"
            onClick={
              loadOrders
            }
            className="mt-5 rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-5 py-3 font-black text-cyan-200"
          >
            REFRESH ORDERS
          </button>

          <div className="mt-5 rounded-xl border border-white/10 bg-black p-4 text-sm text-white/70">
            {message}
          </div>
        </div>

        <div
          id="mm-owner-direct"
          className="mt-8 scroll-mt-6 rounded-[2rem] border border-fuchsia-300/25 bg-gradient-to-br from-fuchsia-950/30 via-zinc-950 to-cyan-950/30 p-7"
        >

          {/* SOLO_BEATS_MM_CLEAR_RESET_V4 */}
          <div className="mb-5 flex flex-wrap justify-end gap-3">

            <button
              type="button"
              disabled={
                directBusy ||
                Boolean(deletingOrder)
              }
              onClick={
                clearDirectForm
              }
              className="rounded-xl border border-red-400/40 bg-red-950/60 px-5 py-3 font-black text-red-200 disabled:opacity-50"
            >
              CLEAR
            </button>

            <button
              type="button"
              disabled={
                directBusy ||
                Boolean(deletingOrder)
              }
              onClick={
                resetDirectForm
              }
              className="rounded-xl border border-white/20 bg-zinc-900 px-5 py-3 font-black text-white disabled:opacity-50"
            >
              RESET
            </button>

          </div>

          <p className="text-xs font-black uppercase tracking-[0.25em] text-fuchsia-300">
            OWNER ONLY
          </p>

          <h2 className="mt-2 text-3xl font-black md:text-4xl">
            OWNER DIRECT PROCESSING
          </h2>

          <p className="mt-3 max-w-3xl text-white/60">
            Process your own music directly without waiting for a customer order.
            Owner jobs use the same SOLO BEATS processing engine and appear below
            with the regular processing controls.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">

            <button
              type="button"
              onClick={() =>
                changeDirectService(
                  "MASTER_ONLY"
                )
              }
              className={`rounded-xl px-5 py-4 font-black ${
                directService ===
                "MASTER_ONLY"
                  ? "bg-gradient-to-r from-cyan-300 to-fuchsia-400 text-black"
                  : "border border-white/15 bg-black text-white"
              }`}
            >
              MASTER ONLY
            </button>

            <button
              type="button"
              onClick={() =>
                changeDirectService(
                  "MIX_MASTER"
                )
              }
              className={`rounded-xl px-5 py-4 font-black ${
                directService ===
                "MIX_MASTER"
                  ? "bg-gradient-to-r from-cyan-300 to-fuchsia-400 text-black"
                  : "border border-white/15 bg-black text-white"
              }`}
            >
              MIX & MASTER
            </button>

          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">

            <label className="block">
              <span className="text-xs font-black uppercase tracking-[0.15em] text-white/50">
                SONG TITLE
              </span>

              <input
                value={
                  directTitle
                }
                onChange={
                  event =>
                    setDirectTitle(
                      event.target.value
                    )
                }
                placeholder="Song title"
                className="mt-2 w-full rounded-xl border border-white/10 bg-black px-4 py-3 outline-none focus:border-cyan-300/50"
              />
            </label>

            <label className="block">
              <span className="text-xs font-black uppercase tracking-[0.15em] text-white/50">
                ARTIST
              </span>

              <input
                value={
                  directArtist
                }
                onChange={
                  event =>
                    setDirectArtist(
                      event.target.value
                    )
                }
                placeholder="Solo Beats"
                className="mt-2 w-full rounded-xl border border-white/10 bg-black px-4 py-3 outline-none focus:border-cyan-300/50"
              />
            </label>

            <label className="block">
              <span className="text-xs font-black uppercase tracking-[0.15em] text-white/50">
                GENRE
              </span>

              <input
                value={
                  directGenre
                }
                onChange={
                  event =>
                    setDirectGenre(
                      event.target.value
                    )
                }
                placeholder="Electronic, Hip-Hop, Rock..."
                className="mt-2 w-full rounded-xl border border-white/10 bg-black px-4 py-3 outline-none focus:border-cyan-300/50"
              />
            </label>

            <label className="block">
              <span className="text-xs font-black uppercase tracking-[0.15em] text-white/50">
                {
                  directService ===
                  "MASTER_ONLY"
                    ? "FINISHED STEREO SONG"
                    : "STEMS — UP TO 20"
                }
              </span>

              <input
                key={`${directService}-${directFileInputKey}`}
                type="file"
                accept="audio/*"
                multiple={
                  directService ===
                  "MIX_MASTER"
                }
                onChange={
                  handleDirectFiles
                }
                className="mt-2 block w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-sm"
              />
            </label>

          </div>

          <label className="mt-4 block">
            <span className="text-xs font-black uppercase tracking-[0.15em] text-white/50">
              OWNER NOTES
            </span>

            <textarea
              value={
                directNotes
              }
              onChange={
                event =>
                  setDirectNotes(
                    event.target.value
                  )
              }
              placeholder="Optional processing notes"
              rows={3}
              className="mt-2 w-full rounded-xl border border-white/10 bg-black px-4 py-3 outline-none focus:border-cyan-300/50"
            />
          </label>

          <div className="mt-4 rounded-xl border border-white/10 bg-black p-4">
            <p className="text-xs font-black uppercase tracking-[0.15em] text-white/40">
              SELECTED AUDIO
            </p>

            {directFiles.length ? (
              <div className="mt-3 space-y-2">
                {directFiles.map(
                  (
                    file,
                    index
                  ) => (
                    <div
                      key={`${file.name}-${index}`}
                      className="rounded-lg border border-cyan-300/15 bg-cyan-300/5 px-3 py-2 text-sm"
                    >
                      {index + 1}.{" "}
                      {file.name}
                    </div>
                  )
                )}
              </div>
            ) : (
              <p className="mt-2 text-sm text-white/40">
                No audio selected.
              </p>
            )}
          </div>

          <button
            type="button"
            disabled={
              directBusy
            }
            onClick={
              submitDirectJob
            }
            className="mt-5 rounded-xl bg-gradient-to-r from-cyan-300 to-fuchsia-400 px-6 py-4 font-black text-black disabled:opacity-50"
          >
            {directBusy
              ? "UPLOADING..."
              : directService ===
                  "MASTER_ONLY"
                ? "UPLOAD OWNER MASTER"
                : "UPLOAD OWNER MIX & MASTER"}
          </button>

        </div>

        <div
          id="mm-orders"
          className="mt-8 scroll-mt-6 space-y-6"
        >
          {orders.map(
            order => (
              <article
                key={
                  order.id
                }
                data-paid-order={
                  !order.ownerDirect &&
                  order.paymentStatus === "PAID"
                    ? "true"
                    : "false"
                }
                data-owner-order={
                  order.ownerDirect
                    ? "true"
                    : "false"
                }
                data-complete-order={
                  order.processingStatus === "AUTO_COMPLETE" ||
                  order.status === "AUTO_COMPLETE"
                    ? "true"
                    : "false"
                }
                className="rounded-[2rem] border border-white/10 bg-zinc-950 p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">

                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
                      ORDER {order.orderId}
                    </p>

                    <h2 className="mt-2 text-3xl font-black">
                      {order.songTitle || "Untitled"}
                    </h2>

                    <p className="mt-1 text-white/60">
                      {order.artistName || "Unknown Artist"}
                    </p>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-black px-4 py-3 text-right">
                    <p className="text-xs text-white/40">
                      STATUS
                    </p>

                    <p className="font-black text-cyan-300">
                      {order.processingStatus || order.status}
                    </p>
                  </div>
                </div>

                {/* SOLO_MM_OWNER_PAYMENT_PANEL_V1 */}
                {order.ownerDirect ? (
                  <div className="mt-5 rounded-2xl border border-fuchsia-300/30 bg-fuchsia-950/20 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.2em] text-fuchsia-300">
                          PAYMENT
                        </p>

                        <p className="mt-2 text-2xl font-black text-white">
                          OWNER DIRECT
                        </p>

                        <p className="mt-1 text-sm text-white/55">
                          PAYMENT NOT REQUIRED
                        </p>
                      </div>

                      <div className="rounded-xl border border-fuchsia-300/30 bg-fuchsia-300/10 px-4 py-3 font-black text-fuchsia-200">
                        OWNER JOB
                      </div>
                    </div>
                  </div>
                ) : order.paymentStatus === "PAID" ? (
                  <div className="mt-5 rounded-2xl border border-emerald-300/40 bg-emerald-950/25 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-5">

                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-300">
                          CUSTOMER PAYMENT
                        </p>

                        <p className="mt-2 text-3xl font-black text-emerald-300">
                          ✓ PAID
                        </p>

                        <p className="mt-1 text-sm font-black text-white">
                          PAYPAL CONFIRMED
                        </p>
                      </div>

                      <div className="text-left sm:text-right">
                        <p className="text-xs font-black uppercase tracking-[0.15em] text-white/40">
                          AMOUNT PAID
                        </p>

                        <p className="mt-1 text-3xl font-black text-white">
                          ${Number(order.priceUsd || 0).toFixed(2)}
                        </p>

                        <p className="text-sm font-black text-emerald-300">
                          {order.currency || "USD"}
                        </p>
                      </div>

                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">

                      <div className="rounded-xl border border-white/10 bg-black/50 p-3">
                        <p className="text-xs text-white/40">
                          PAYPAL CONFIRMATION
                        </p>

                        <p className="mt-1 break-all text-sm font-black text-white/80">
                          {order.paypalCaptureId ||
                            order.paypalOrderId ||
                            "CONFIRMED"}
                        </p>
                      </div>

                      <div className="rounded-xl border border-white/10 bg-black/50 p-3">
                        <p className="text-xs text-white/40">
                          PAID DATE
                        </p>

                        <p className="mt-1 text-sm font-black text-white/80">
                          {order.paidAt
                            ? new Date(
                                order.paidAt
                              ).toLocaleString()
                            : "PAYMENT CONFIRMED"}
                        </p>
                      </div>

                    </div>
                  </div>
                ) : (
                  <div className="mt-5 rounded-2xl border border-amber-300/30 bg-amber-950/20 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-4">

                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-300">
                          CUSTOMER PAYMENT
                        </p>

                        <p className="mt-2 text-2xl font-black text-amber-200">
                          {order.paymentStatus || "NOT PAID"}
                        </p>
                      </div>

                      {Number(order.priceUsd || 0) > 0 ? (
                        <div className="text-right">
                          <p className="text-xs text-white/40">
                            AMOUNT
                          </p>

                          <p className="mt-1 text-2xl font-black">
                            ${Number(order.priceUsd || 0).toFixed(2)}
                          </p>
                        </div>
                      ) : null}

                    </div>
                  </div>
                )}

                <div className="mt-5 grid gap-3 md:grid-cols-5">

                  <div className="rounded-xl border border-white/10 bg-black p-4">
                    <p className="text-xs text-white/40">
                      SERVICE
                    </p>

                    <p className="mt-1 text-sm font-black text-fuchsia-300">
                      {order.serviceType === "MASTER_ONLY"
                        ? "MASTER ONLY"
                        : "MIX & MASTER"}
                    </p>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-black p-4">
                    <p className="text-xs text-white/40">
                      {order.serviceType === "MASTER_ONLY"
                        ? "STEREO FILE"
                        : "STEMS"}
                    </p>

                    <p className="mt-1 text-xl font-black">
                      {order.stemCount}
                    </p>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-black p-4">
                    <p className="text-xs text-white/40">
                      GENRE
                    </p>

                    <p className="mt-1 font-black">
                      {order.genre || "—"}
                    </p>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-black p-4">
                    <p className="text-xs text-white/40">
                      CUSTOMER / OWNER
                    </p>

                    <p className="mt-1 break-all text-sm">
                      {order.userEmail || "—"}
                    </p>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-black p-4">
                    <p className="text-xs text-white/40">
                      ENGINE
                    </p>

                    <p className="mt-1 text-sm font-black">
                      {order.autoMixMaster?.version || "Not processed"}
                    </p>
                  </div>

                </div>

                {order.notes ? (
                  <div className="mt-4 rounded-xl border border-white/10 bg-black p-4">
                    <p className="text-xs font-black text-white/40">
                      NOTES
                    </p>

                    <p className="mt-2 whitespace-pre-wrap text-sm text-white/70">
                      {order.notes}
                    </p>
                  </div>
                ) : null}

                {order.serviceType !== "MASTER_ONLY" &&
                order.autoMixMaster?.recipe?.length ? (
                  <div className="mt-4 rounded-xl border border-white/10 bg-black p-4">
                    <p className="text-xs font-black text-white/40">
                      AUTO STEM DETECTION
                    </p>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {order.autoMixMaster.recipe.map(
                        item => (
                          <span
                            key={`${item.index}-${item.name}`}
                            className="rounded-lg border border-cyan-300/20 bg-cyan-300/5 px-3 py-2 text-xs"
                          >
                            {item.name} →{" "}
                            <strong className="text-cyan-300">
                              {item.role}
                            </strong>
                          </span>
                        )
                      )}
                    </div>
                  </div>
                ) : null}

                <div className="mt-5 flex flex-wrap gap-3">

                  <button
                    type="button"
                    disabled={
                      Boolean(
                        busyOrder
                      )
                    }
                    onClick={() =>
                      autoProcess(
                        order.orderId
                      )
                    }
                    className="rounded-xl bg-gradient-to-r from-cyan-300 to-fuchsia-400 px-5 py-4 font-black text-black disabled:opacity-50"
                  >
                    {busyOrder ===
                    order.orderId
                      ? order.serviceType === "MASTER_ONLY"
                        ? "AUTO MASTERING..."
                        : "AUTO PROCESSING..."
                      : order.processingStatus === "AUTO_COMPLETE"
                        ? order.serviceType === "MASTER_ONLY"
                          ? "RE-RUN AUTO MASTER"
                          : "RE-RUN AUTO MIX & MASTER"
                        : order.serviceType === "MASTER_ONLY"
                          ? "AUTO MASTER"
                          : "AUTO MIX & MASTER"}
                  </button>


                  {(order.processingStatus === "AUTO_COMPLETE" ||
                    order.status === "AUTO_COMPLETE") ? (
                    <button
                      type="button"
                      disabled={
                        Boolean(busyOrder) ||
                        Boolean(deletingOrder)
                      }
                      onClick={() =>
                        deleteOrder(
                          order.orderId
                        )
                      }
                      className="rounded-xl border border-red-400/40 bg-red-950/60 px-5 py-4 font-black text-red-200 disabled:opacity-50"
                    >
                      {deletingOrder ===
                      order.orderId
                        ? "DELETING..."
                        : "DELETE ORDER"}
                    </button>
                  ) : null}
                  {order.wavUrl ? (
                    <a
                      href={order.wavUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-xl border border-white/15 bg-white/5 px-5 py-4 font-black"
                    >
                      PLAY WAV
                    </a>
                  ) : null}

                  {order.wavDownloadUrl ? (
                    <a
                      href={order.wavDownloadUrl}
                      className="rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-5 py-4 font-black text-cyan-200"
                    >
                      DOWNLOAD WAV
                    </a>
                  ) : null}

                  {order.mp3Url ? (
                    <a
                      href={order.mp3Url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-xl border border-white/15 bg-white/5 px-5 py-4 font-black"
                    >
                      PLAY MP3
                    </a>
                  ) : null}

                  {order.mp3DownloadUrl ? (
                    <a
                      href={order.mp3DownloadUrl}
                      className="rounded-xl border border-fuchsia-300/30 bg-fuchsia-300/10 px-5 py-4 font-black text-fuchsia-200"
                    >
                      DOWNLOAD MP3
                    </a>
                  ) : null}

                </div>
              </article>
            )
          )}

          {orders.length === 0 ? (
            <div className="rounded-[2rem] border border-white/10 bg-zinc-950 p-8 text-white/50">
              No Mix & Mastering orders loaded yet.
            </div>
          ) : null}
        </div>

      </section>
      </main>
  );
}






