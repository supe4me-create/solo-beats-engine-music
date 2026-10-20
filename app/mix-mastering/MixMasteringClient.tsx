"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import {
  firebaseAuth,
} from "../../lib/firebaseClient";

const MAX_STEMS = 20;
const MAX_FILE_BYTES =
  250 * 1024 * 1024;

type ServiceType =
  | "MIX_MASTER"
  | "MASTER_ONLY";

type UploadTarget = {
  index: number;
  name: string;
  storagePath: string;
  contentType: string;
  uploadUrl: string;
};

type CreateOrderResponse = {
  success?: boolean;
  orderId?: string;
  uploads?: UploadTarget[];
  error?: string;
};

type PaymentResponse = {
  success?: boolean;
  alreadyPaid?: boolean;
  paymentStatus?: string;
  paypalOrderId?: string;
  orderId?: string;
  serviceType?: string;
  stemCount?: number;
  price?: string;
  error?: string;
};

export default function MixMasteringPage() {
  const [serviceType, setServiceType] =
    useState<ServiceType>("MIX_MASTER");

  const [songTitle, setSongTitle] =
    useState("");

  const [artistName, setArtistName] =
    useState("");

  const [genre, setGenre] =
    useState("");

  const [notes, setNotes] =
    useState("");

  const [files, setFiles] =
    useState<File[]>([]);

  const [message, setMessage] =
    useState(
      "Select your stems to begin."
    );

  const [uploading, setUploading] =
    useState(false);

  const [orderId, setOrderId] =
    useState("");

  // SOLO_MM_CUSTOMER_PAYPAL_CHECKOUT_V1
  const [paypalOrderId, setPaypalOrderId] =
    useState("");

  const [paymentAmount, setPaymentAmount] =
    useState("");

  const [paymentStatus, setPaymentStatus] =
    useState("");

  useEffect(() => {
    if (!paypalOrderId) return;

    let cancelled = false;

    async function loadPayPalCheckout() {
      try {
        setPaymentStatus(
          "Loading secure PayPal checkout..."
        );

        const configResponse =
          await fetch(
            "/api/mix-mastering/payment",
            {
              method: "GET",
              cache: "no-store",
            }
          );

        const configData =
          await configResponse.json();

        if (
          !configResponse.ok ||
          !configData?.success ||
          !configData?.clientId
        ) {
          throw new Error(
            configData?.error ||
            "PayPal checkout configuration could not be loaded."
          );
        }

        const paypalWindow =
          window as typeof window & {
            paypal?: any;
          };

        if (!paypalWindow.paypal) {
          await new Promise<void>(
            (resolve, reject) => {
              const existing =
                document.querySelector(
                  'script[data-solo-mm-paypal="true"]'
                ) as HTMLScriptElement | null;

              if (existing) {
                if (
                  (window as typeof window & {
                    paypal?: any;
                  }).paypal
                ) {
                  resolve();
                  return;
                }

                existing.addEventListener(
                  "load",
                  () => resolve(),
                  {
                    once: true,
                  }
                );

                existing.addEventListener(
                  "error",
                  () =>
                    reject(
                      new Error(
                        "PayPal checkout failed to load."
                      )
                    ),
                  {
                    once: true,
                  }
                );

                return;
              }

              const script =
                document.createElement(
                  "script"
                );

              script.src =
                `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(
                  String(
                    configData.clientId
                  )
                )}&currency=USD&intent=capture`;

              script.async = true;

              script.dataset.soloMmPaypal =
                "true";

              script.onload = () =>
                resolve();

              script.onerror = () =>
                reject(
                  new Error(
                    "PayPal checkout failed to load."
                  )
                );

              document.head.appendChild(
                script
              );
            }
          );
        }

        if (cancelled) return;

        const container =
          document.getElementById(
            "solo-mm-paypal-buttons"
          );

        if (!container) return;

        container.innerHTML = "";

        const paypal =
          (
            window as typeof window & {
              paypal?: any;
            }
          ).paypal;

        if (!paypal?.Buttons) {
          throw new Error(
            "PayPal checkout is unavailable."
          );
        }

        await paypal
          .Buttons({
            style: {
              layout: "vertical",
              shape: "rect",
              label: "paypal",
            },

            createOrder: async () => {
              return paypalOrderId;
            },

            onApprove: async (
              data: {
                orderID?: string;
              }
            ) => {
              const user =
                firebaseAuth.currentUser;

              if (!user) {
                throw new Error(
                  "Please sign in again before completing payment."
                );
              }

              setPaymentStatus(
                "Confirming your payment..."
              );

              const token =
                await user.getIdToken();

              const captureResponse =
                await fetch(
                  "/api/mix-mastering/payment",
                  {
                    method: "POST",
                    headers: {
                      "Content-Type":
                        "application/json",
                      Authorization:
                        `Bearer ${token}`,
                    },
                    body:
                      JSON.stringify({
                        action:
                          "capture",
                        orderId,
                        paypalOrderId:
                          data.orderID ||
                          paypalOrderId,
                      }),
                  }
                );

              const captureData =
                (await captureResponse.json()) as
                  PaymentResponse;

              if (
                !captureResponse.ok ||
                !captureData.success ||
                captureData.paymentStatus !==
                  "PAID"
              ) {
                throw new Error(
                  captureData.error ||
                  "PayPal payment could not be confirmed."
                );
              }

              setPaypalOrderId("");

              setPaymentStatus(
                "PAYMENT COMPLETE. Your SOLO BEATS MIX & MASTERING project is paid and ready for processing."
              );
            },

            onCancel: () => {
              setPaymentStatus(
                "Payment was cancelled. Your project is still saved and you can try again."
              );
            },

            onError: (
              error: unknown
            ) => {
              console.error(
                "PAYPAL CHECKOUT ERROR",
                error
              );

              setPaymentStatus(
                "PayPal checkout encountered an error. Please try again."
              );
            },
          })
          .render(
            "#solo-mm-paypal-buttons"
          );

        if (!cancelled) {
          setPaymentStatus(
            "Secure PayPal checkout is ready."
          );
        }
      } catch (error) {
        console.error(
          "PAYPAL DISPLAY ERROR",
          error
        );

        if (!cancelled) {
          setPaymentStatus(
            error instanceof Error
              ? error.message
              : "PayPal checkout could not be loaded."
          );
        }
      }
    }

    loadPayPalCheckout();

    return () => {
      cancelled = true;
    };
  }, [
    paypalOrderId,
    orderId,
  ]);

  function chooseFiles(
    selected: FileList | null
  ) {
    if (!selected || uploading) return;

    const incoming =
      Array.from(selected);

    if (
      serviceType === "MASTER_ONLY" &&
      incoming.length !== 1
    ) {
      setMessage(
        "MASTER ONLY requires exactly one finished stereo mix."
      );
      return;
    }

    if (
      serviceType === "MIX_MASTER" &&
      incoming.length > MAX_STEMS
    ) {
      setMessage(
        `Maximum ${MAX_STEMS} stems per project.`
      );
      return;
    }

    const tooLarge =
      incoming.find(
        file =>
          file.size >
          MAX_FILE_BYTES
      );

    if (tooLarge) {
      setMessage(
        `${tooLarge.name} exceeds the 250 MB per-file limit.`
      );
      return;
    }

    setFiles(incoming);
    setOrderId("");
    setPaypalOrderId("");
    setPaymentAmount("");
    setPaymentStatus("");

    setMessage(
      serviceType === "MASTER_ONLY"
        ? `${incoming[0]?.name || "Stereo mix"} selected for mastering.`
        : `${incoming.length} stem${
            incoming.length === 1
              ? ""
              : "s"
          } selected.`
    );
  }

  async function continueProject() {
    if (uploading) return;

    const cleanTitle =
      songTitle.trim();

    const cleanArtist =
      artistName.trim();

    if (!cleanTitle) {
      setMessage(
        "Enter the song title first."
      );
      return;
    }

    if (!cleanArtist) {
      setMessage(
        "Enter the artist name first."
      );
      return;
    }

    if (files.length < 1) {
      setMessage(
        serviceType === "MASTER_ONLY"
          ? "Select your finished stereo mix first."
          : "Select at least one stem first."
      );
      return;
    }

    if (
      serviceType === "MASTER_ONLY" &&
      files.length !== 1
    ) {
      setMessage(
        "MASTER ONLY requires exactly one stereo mix."
      );
      return;
    }

    const user =
      firebaseAuth.currentUser;

    if (!user) {
      setMessage(
        "Please sign in to SOLO BEATS ENGINE MUSIC before submitting your Mix & Mastering project."
      );
      return;
    }

    setUploading(true);
    setOrderId("");
    setPaypalOrderId("");
    setPaymentAmount("");
    setPaymentStatus("");

    try {
      setMessage(
        serviceType === "MASTER_ONLY"
          ? "Creating your Master Only order..."
          : "Creating your Mix & Mastering order..."
      );

      const token =
        await user.getIdToken();

      const createResponse =
        await fetch(
          "/api/mix-mastering/orders",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
              Authorization:
                `Bearer ${token}`,
            },
            body:
              JSON.stringify({
                action: "create",
                serviceType:
                  serviceType,
                songTitle:
                  cleanTitle,
                artistName:
                  cleanArtist,
                genre:
                  genre.trim(),
                notes:
                  notes.trim(),
                stems:
                  files.map(file => ({
                    name:
                      file.name,
                    size:
                      file.size,
                    type:
                      file.type ||
                      "application/octet-stream",
                  })),
              }),
          }
        );

      const createData =
        (await createResponse.json()) as
          CreateOrderResponse;

      if (
        !createResponse.ok ||
        !createData.success ||
        !createData.orderId ||
        !Array.isArray(
          createData.uploads
        )
      ) {
        throw new Error(
          createData.error ||
          "The Mix & Mastering order could not be created."
        );
      }

      const newOrderId =
        createData.orderId;

      for (
        let i = 0;
        i < createData.uploads.length;
        i += 1
      ) {
        const target =
          createData.uploads[i];

        const file =
          files[target.index];

        if (!file) {
          throw new Error(
            `Stem ${target.index + 1} is missing from the browser upload list.`
          );
        }

        setMessage(
          `Uploading stem ${i + 1} of ${createData.uploads.length}: ${file.name}`
        );

        const uploadResponse =
          await fetch(
            target.uploadUrl,
            {
              method: "PUT",
              headers: {
                "Content-Type":
                  target.contentType ||
                  file.type ||
                  "application/octet-stream",
              },
              body: file,
            }
          );

        if (!uploadResponse.ok) {
          throw new Error(
            `Upload failed for ${file.name}.`
          );
        }
      }

      setMessage(
        serviceType === "MASTER_ONLY"
          ? "Verifying stereo master file..."
          : "Verifying uploaded stems..."
      );

      const completeResponse =
        await fetch(
          "/api/mix-mastering/orders",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
              Authorization:
                `Bearer ${token}`,
            },
            body:
              JSON.stringify({
                action: "complete",
                orderId:
                  newOrderId,
              }),
          }
        );

      const completeData =
        await completeResponse.json();

      if (
        !completeResponse.ok ||
        !completeData.success
      ) {
        throw new Error(
          completeData.error ||
          "The uploaded stems could not be verified."
        );
      }

      setOrderId(
        newOrderId
      );

      setMessage(
        serviceType === "MASTER_ONLY"
          ? `MASTER ONLY PROJECT SUBMITTED. Order ${newOrderId} is ready for payment.`
          : `PROJECT SUBMITTED. Order ${newOrderId} contains ${files.length} stem${
              files.length === 1
                ? ""
                : "s"
            } and is ready for payment.`
      );

      setPaymentStatus(
        "Calculating your final payment..."
      );

      const paymentResponse =
        await fetch(
          "/api/mix-mastering/payment",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
              Authorization:
                `Bearer ${token}`,
            },
            body:
              JSON.stringify({
                action:
                  "create",
                orderId:
                  newOrderId,
              }),
          }
        );

      const paymentData =
        (await paymentResponse.json()) as
          PaymentResponse;

      if (
        !paymentResponse.ok ||
        !paymentData.success ||
        !paymentData.price
      ) {
        throw new Error(
          paymentData.error ||
          "Your project was uploaded, but PayPal checkout could not be prepared."
        );
      }

      setPaymentAmount(
        paymentData.price
      );

      if (
        paymentData.alreadyPaid ||
        paymentData.paymentStatus ===
          "PAID"
      ) {
        setPaypalOrderId("");

        setPaymentStatus(
          "PAYMENT ALREADY COMPLETE. Your project is ready for processing."
        );
      }
      else {
        if (
          !paymentData.paypalOrderId
        ) {
          throw new Error(
            "PayPal did not return a checkout order."
          );
        }

        setPaypalOrderId(
          paymentData.paypalOrderId
        );

        setPaymentStatus(
          "Secure PayPal checkout is loading..."
        );
      }
    } catch (error) {
      console.error(
        "MIX MASTERING UPLOAD ERROR",
        error
      );

      setMessage(
        error instanceof Error
          ? error.message
          : "Mix & Mastering upload failed."
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <main className="min-h-screen bg-black px-5 py-12 pb-32 text-white md:px-10">
      {/* SOLO_MM_PER_STEM_PRICING_V1 */}
      <section className="mx-auto mb-8 max-w-6xl rounded-[2rem] border border-cyan-300/20 bg-gradient-to-br from-cyan-950/30 via-black to-fuchsia-950/20 p-6 sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">
          SOLO BEATS MIX & MASTERING PRICING
        </p>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-black/40 p-5">
            <p className="text-sm font-black text-fuchsia-300">
              MASTER ONLY
            </p>

            <p className="mt-2 text-4xl font-black">
              $49.99
            </p>

            <p className="mt-2 text-sm text-white/55">
              Flat price for one finished stereo song.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/40 p-5">
            <p className="text-sm font-black text-cyan-300">
              MIX & MASTER
            </p>

            <p className="mt-2 text-4xl font-black">
              $99.99
            </p>

            <p className="mt-2 font-black text-emerald-300">
              + $10.00 PER STEM
            </p>

            <p className="mt-3 text-sm text-white/55">
              Your final price is calculated automatically from the number of stems you upload.
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <p className="text-xs text-white/40">5 STEMS</p>
            <p className="mt-1 font-black">$149.99</p>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <p className="text-xs text-white/40">10 STEMS</p>
            <p className="mt-1 font-black">$199.99</p>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <p className="text-xs text-white/40">15 STEMS</p>
            <p className="mt-1 font-black">$249.99</p>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <p className="text-xs text-white/40">20 STEMS</p>
            <p className="mt-1 font-black">$299.99</p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl">

        <Link
          href="/"
          className="text-sm font-black uppercase tracking-[0.2em] text-cyan-300"
        >
          ← SOLO BEATS ENGINE MUSIC
        </Link>

        <section className="mt-8 overflow-hidden rounded-[2.5rem] border border-cyan-300/25 bg-gradient-to-br from-cyan-950/40 via-black to-fuchsia-950/30 p-7 md:p-12">
          <p className="text-sm font-black uppercase tracking-[0.28em] text-cyan-300">
            Premium Studio Service
          </p>

          <h1 className="mt-4 text-5xl font-black leading-none md:text-7xl">
            SOLO BEATS
            <br />
            MIX & MASTERING
          </h1>

          <p className="mt-6 max-w-3xl text-lg leading-8 text-white/65">
            Upload your stems and submit your project for professional mixing
            and mastering. Every completed project receives final quality
            approval before delivery.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-xs font-black text-cyan-300">01</p>
              <h2 className="mt-2 font-black">UPLOAD STEMS</h2>
              <p className="mt-2 text-sm leading-6 text-white/50">
                Send your individual song stems.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-xs font-black text-cyan-300">02</p>
              <h2 className="mt-2 font-black">MIX & MASTER</h2>
              <p className="mt-2 text-sm leading-6 text-white/50">
                Your project moves through the complete studio processing workflow.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-xs font-black text-cyan-300">03</p>
              <h2 className="mt-2 font-black">FINAL APPROVAL</h2>
              <p className="mt-2 text-sm leading-6 text-white/50">
                The completed result is quality checked before delivery.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-[2rem] border border-white/10 bg-zinc-950 p-6 md:p-8">
          <p className="text-sm font-black uppercase tracking-[0.22em] text-cyan-300">
            Project Submission
          </p>

          <h2 className="mt-2 text-3xl font-black">
            START YOUR PROJECT
          </h2>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <button
              type="button"
              disabled={uploading}
              onClick={() => {
                setServiceType("MIX_MASTER");
                setFiles([]);
                setOrderId("");
                setMessage(
                  "MIX & MASTER selected. Upload your individual stems."
                );
              }}
              className={`rounded-2xl border p-5 text-left ${
                serviceType === "MIX_MASTER"
                  ? "border-cyan-300 bg-cyan-300/10"
                  : "border-white/10 bg-black"
              }`}
            >
              <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
                FULL STUDIO SERVICE
              </p>

              <h3 className="mt-2 text-2xl font-black">
                MIX & MASTER
              </h3>

              <p className="mt-2 text-sm leading-6 text-white/55">
                Upload your individual stems. We balance, mix and master the complete song.
              </p>
            </button>

            <button
              type="button"
              disabled={uploading}
              onClick={() => {
                setServiceType("MASTER_ONLY");
                setFiles([]);
                setOrderId("");
                setMessage(
                  "MASTER ONLY selected. Upload one finished stereo mix."
                );
              }}
              className={`rounded-2xl border p-5 text-left ${
                serviceType === "MASTER_ONLY"
                  ? "border-fuchsia-300 bg-fuchsia-300/10"
                  : "border-white/10 bg-black"
              }`}
            >
              <p className="text-xs font-black uppercase tracking-[0.2em] text-fuchsia-300">
                MASTERING SERVICE
              </p>

              <h3 className="mt-2 text-2xl font-black">
                MASTER ONLY
              </h3>

              <p className="mt-2 text-sm leading-6 text-white/55">
                Upload one finished stereo mix and receive the final mastered WAV and MP3.
              </p>
            </button>
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-2">

            <label>
              <span className="text-sm font-black">
                Song Title *
              </span>

              <input
                value={songTitle}
                disabled={uploading}
                onChange={event =>
                  setSongTitle(
                    event.target.value
                  )
                }
                placeholder="Song title"
                className="mt-2 w-full rounded-xl border border-white/10 bg-black px-4 py-4 outline-none focus:border-cyan-300 disabled:opacity-50"
              />
            </label>

            <label>
              <span className="text-sm font-black">
                Artist Name *
              </span>

              <input
                value={artistName}
                disabled={uploading}
                onChange={event =>
                  setArtistName(
                    event.target.value
                  )
                }
                placeholder="Artist / producer name"
                className="mt-2 w-full rounded-xl border border-white/10 bg-black px-4 py-4 outline-none focus:border-cyan-300 disabled:opacity-50"
              />
            </label>

            <label>
              <span className="text-sm font-black">
                Genre
              </span>

              <input
                value={genre}
                disabled={uploading}
                onChange={event =>
                  setGenre(
                    event.target.value
                  )
                }
                placeholder="Electronic, Hip-Hop, R&B..."
                className="mt-2 w-full rounded-xl border border-white/10 bg-black px-4 py-4 outline-none focus:border-cyan-300 disabled:opacity-50"
              />
            </label>

            <div>
              <span className="text-sm font-black">
                {serviceType === "MASTER_ONLY"
                  ? "Stereo Mix"
                  : "Stems"}
              </span>

              <label
                className={`mt-2 flex min-h-14 items-center justify-center rounded-xl border border-dashed border-cyan-300/40 bg-cyan-300/5 px-4 py-4 text-center font-black text-cyan-200 ${
                  uploading
                    ? "cursor-not-allowed opacity-50"
                    : "cursor-pointer"
                }`}
              >
                {serviceType === "MASTER_ONLY"
                  ? "SELECT STEREO MIX"
                  : "SELECT STEMS"}

                <input
                  type="file"
                  multiple={
                    serviceType === "MIX_MASTER"
                  }
                  disabled={uploading}
                  accept="audio/*,.wav,.mp3,.flac,.m4a,.aac,.ogg"
                  className="hidden"
                  onChange={event =>
                    chooseFiles(
                      event.target.files
                    )
                  }
                />
              </label>
            </div>
          </div>

          <label className="mt-5 block">
            <span className="text-sm font-black">
              Project Notes
            </span>

            <textarea
              value={notes}
              disabled={uploading}
              onChange={event =>
                setNotes(
                  event.target.value
                )
              }
              rows={5}
              placeholder="Tell us how you want the song to feel. Reference tracks, vocal balance, bass level, loudness, special requests..."
              className="mt-2 w-full rounded-xl border border-white/10 bg-black px-4 py-4 outline-none focus:border-cyan-300 disabled:opacity-50"
            />
          </label>

          <div className="mt-6 rounded-2xl border border-white/10 bg-black/60 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-black">
                {serviceType === "MASTER_ONLY"
                  ? "Selected Stereo Mix"
                  : "Selected Stems"}
              </p>

              <p className="text-cyan-300">
                {files.length} / {
                  serviceType === "MASTER_ONLY"
                    ? 1
                    : MAX_STEMS
                }
              </p>
            </div>

            {files.length > 0 ? (
              <div className="mt-4 space-y-2">
                {files.map(
                  (file, index) => (
                    <div
                      key={`${file.name}-${index}`}
                      className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm"
                    >
                      {index + 1}. {file.name}
                    </div>
                  )
                )}
              </div>
            ) : (
              <p className="mt-3 text-sm text-white/40">
                {serviceType === "MASTER_ONLY"
                  ? "No stereo mix selected yet."
                  : "No stems selected yet."}
              </p>
            )}
          </div>

          <button
            type="button"
            disabled={uploading}
            onClick={
              continueProject
            }
            className="mt-6 w-full rounded-2xl bg-gradient-to-r from-cyan-300 to-fuchsia-400 px-6 py-5 text-lg font-black text-black disabled:cursor-not-allowed disabled:opacity-50"
          >
            {uploading
              ? serviceType === "MASTER_ONLY"
                ? "UPLOADING STEREO MIX..."
                : "UPLOADING STEMS..."
              : serviceType === "MASTER_ONLY"
                ? "SUBMIT MASTER ONLY"
                : "CONTINUE MIX & MASTER"}
          </button>

          <div className="mt-5 rounded-xl border border-white/10 bg-black p-4 text-sm text-white/70">
            {message}

            {orderId ? (
              <div className="mt-2 font-black text-cyan-300">
                ORDER ID: {orderId}
              </div>
            ) : null}
          </div>

          {orderId && paymentAmount ? (
            <section className="mt-6 rounded-2xl border border-emerald-300/30 bg-emerald-950/20 p-6">
              <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-300">
                PAYMENT
              </p>

              <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-sm text-white/55">
                    Amount Due
                  </p>

                  <p className="mt-1 text-4xl font-black text-white">
                    ${paymentAmount}
                  </p>
                </div>

                <div className="text-right text-sm text-white/50">
                  <p>
                    {serviceType ===
                    "MASTER_ONLY"
                      ? "MASTER ONLY"
                      : `${files.length} STEM${
                          files.length ===
                          1
                            ? ""
                            : "S"
                        } MIX & MASTER`}
                  </p>

                  <p className="mt-1">
                    USD
                  </p>
                </div>
              </div>

              {paymentStatus ? (
                <div className="mt-4 rounded-xl border border-white/10 bg-black/50 p-3 text-sm text-white/70">
                  {paymentStatus}
                </div>
              ) : null}

              {paypalOrderId ? (
                <div className="mt-5 rounded-xl bg-white p-3">
                  <div
                    id="solo-mm-paypal-buttons"
                    className="min-h-[45px]"
                  />
                </div>
              ) : null}
            </section>
          ) : null}
        </section>

      </section>
    </main>
  );
}



