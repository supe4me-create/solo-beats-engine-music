"use client";

import "../../../lib/firebaseClient";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  getAuth,
  onAuthStateChanged,
  type User,
} from "firebase/auth";

import JSZip from "jszip";
import { upload } from "@vercel/blob/client";

const OWNER_EMAIL = "supe4.me@gmail.com";
const MAX_STEMS = 20;

// SOLO_STEM_BATCH_SAFETY_V1
// Client-side ZIP creation keeps converted audio in browser memory.
// 750 MB is a practical protection limit for this version.
const MAX_BATCH_BYTES =
  750 * 1024 * 1024;

type OutputFormat =
  | "mp3"
  | "wav"
  | "flac"
  | "m4a"
  | "aac"
  | "ogg";

type StemStatus =
  | "ready"
  | "converting"
  | "done"
  | "error";

type StemItem = {
  id: string;
  file: File;
  outputFormat: OutputFormat;
  quality: string;

  // SOLO_STEM_METADATA_V1
  metadataTitle: string;
  metadataArtist: string;
  metadataAlbum: string;

  status: StemStatus;
  message: string;
};

function createId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random()}`;
}

function baseName(name: string) {
  const dot =
    name.lastIndexOf(".");

  if (dot <= 0) {
    return name;
  }

  return name.slice(0, dot);
}

function prettyBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const kb =
    bytes / 1024;

  if (kb < 1024) {
    return `${kb.toFixed(1)} KB`;
  }

  return `${(kb / 1024).toFixed(1)} MB`;
}

function uniqueOutputName(
  wanted: string,
  used: Set<string>
) {
  const normalized =
    wanted.toLowerCase();

  if (!used.has(normalized)) {
    used.add(normalized);
    return wanted;
  }

  const dot =
    wanted.lastIndexOf(".");

  const stem =
    dot >= 0
      ? wanted.slice(0, dot)
      : wanted;

  const extension =
    dot >= 0
      ? wanted.slice(dot)
      : "";

  let number = 2;

  while (true) {
    const candidate =
      `${stem} (${number})${extension}`;

    if (
      !used.has(
        candidate.toLowerCase()
      )
    ) {
      used.add(
        candidate.toLowerCase()
      );

      return candidate;
    }

    number += 1;
  }
}

// SOLO_STEM_EXPORT_NAMING_V1
function safeExportNamePart(
  value: string
) {
  return value
    .replace(
      /[<>:"/\\|?*\x00-\x1F]/g,
      "_"
    )
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function makeExportBaseName(
  stem: StemItem,
  index: number,
  preserveOriginalNames: boolean,
  autoNumberExports: boolean,
  exportPrefix: string,
  exportSuffix: string
) {
  const original =
    safeExportNamePart(
      baseName(stem.file.name)
    ) || "stem";

  if (preserveOriginalNames) {
    return original;
  }

  const title =
    safeExportNamePart(
      stem.metadataTitle
    ) || original;

  const prefix =
    safeExportNamePart(
      exportPrefix
    );

  const suffix =
    safeExportNamePart(
      exportSuffix
    );

  const parts: string[] = [];

  if (autoNumberExports) {
    parts.push(
      String(index + 1).padStart(
        2,
        "0"
      )
    );
  }

  if (prefix) {
    parts.push(prefix);
  }

  parts.push(title);

  if (suffix) {
    parts.push(suffix);
  }

  return parts.join(" - ");
}
export default function OwnerBulkStemLab() {
  const inputRef =
    useRef<HTMLInputElement | null>(
      null
    );

  // SOLO_STEM_COVER_ART_V1
  const coverInputRef =
    useRef<HTMLInputElement | null>(
      null
    );

  const [authReady, setAuthReady] =
    useState(false);

  const [user, setUser] =
    useState<User | null>(null);

  const [stems, setStems] =
    useState<StemItem[]>([]);

  const [outputFormat, setOutputFormat] =
    useState<OutputFormat>("mp3");

  const [bitrate, setBitrate] =
    useState("320");

  const [
    stripMetadata,
    setStripMetadata,
  ] = useState(true);

  // SOLO_STEM_METADATA_V1
  const [batchArtist, setBatchArtist] =
    useState("");

  const [batchAlbum, setBatchAlbum] =
    useState("");

  const [coverFile, setCoverFile] =
    useState<File | null>(null);

  const [coverPreview, setCoverPreview] =
    useState("");
  // SOLO_STEM_EXPORT_NAMING_V1
  const [
    exportProjectName,
    setExportProjectName,
  ] = useState("");

  const [
    preserveOriginalNames,
    setPreserveOriginalNames,
  ] = useState(true);

  const [
    exportPrefix,
    setExportPrefix,
  ] = useState("");

  const [
    exportSuffix,
    setExportSuffix,
  ] = useState("");

  const [
    autoNumberExports,
    setAutoNumberExports,
  ] = useState(false);
  const [busy, setBusy] =
    useState(false);

  const [message, setMessage] =
    useState("");

  useEffect(() => {
    const auth =
      getAuth();

    return onAuthStateChanged(
      auth,
      nextUser => {
        setUser(nextUser);
        setAuthReady(true);
      }
    );
  }, []);

  const owner =
    user?.email?.toLowerCase() ===
    OWNER_EMAIL.toLowerCase();

  const totalSize =
    useMemo(
      () =>
        stems.reduce(
          (total, stem) =>
            total + stem.file.size,
          0
        ),
      [stems]
    );

  const remainingBatchBytes =
    Math.max(
      0,
      MAX_BATCH_BYTES - totalSize
    );

  const batchTooLarge =
    totalSize > MAX_BATCH_BYTES;

  function updateStem(
    id: string,
    patch: Partial<StemItem>
  ) {
    setStems(current =>
      current.map(stem =>
        stem.id === id
          ? {
              ...stem,
              ...patch,
            }
          : stem
      )
    );
  }

  function setStemMetadata(
    id: string,
    field:
      | "metadataTitle"
      | "metadataArtist"
      | "metadataAlbum",
    value: string
  ) {
    if (busy) {
      return;
    }

    setStems(current =>
      current.map(stem =>
        stem.id === id
          ? {
              ...stem,
              [field]: value,
              status:
                stem.status === "done"
                  ? "ready"
                  : stem.status,
              message:
                stem.status === "done"
                  ? "READY"
                  : stem.message,
            }
          : stem
      )
    );
  }

  function applyBatchMetadata() {
    if (busy) {
      return;
    }

    setStems(current =>
      current.map(stem => ({
        ...stem,
        metadataArtist: batchArtist,
        metadataAlbum: batchAlbum,
        status:
          stem.status === "done"
            ? "ready"
            : stem.status,
        message:
          stem.status === "done"
            ? "READY"
            : stem.message,
      }))
    );

    setMessage(
      "Batch Artist / Album metadata applied."
    );
  }
  function selectCover(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    if (busy) return;

    const file =
      event.target.files?.[0] || null;

    event.target.value = "";

    if (!file) return;

    if (
      ![
        "image/jpeg",
        "image/png",
        "image/webp",
      ].includes(file.type)
    ) {
      setMessage(
        "Cover art must be JPG, PNG or WEBP."
      );
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setMessage(
        "Cover art must be 10 MB or smaller."
      );
      return;
    }

    if (coverPreview) {
      URL.revokeObjectURL(
        coverPreview
      );
    }

    setCoverFile(file);

    setCoverPreview(
      URL.createObjectURL(file)
    );

    setMessage(
      "Album cover selected."
    );
  }

  function removeCover() {
    if (busy) return;

    if (coverPreview) {
      URL.revokeObjectURL(
        coverPreview
      );
    }

    setCoverFile(null);
    setCoverPreview("");

    setMessage(
      "Album cover removed."
    );
  }

  function addFiles(
    event:
      React.ChangeEvent<HTMLInputElement>
  ) {
    const incoming =
      Array.from(
        event.target.files || []
      );

    event.target.value = "";

    if (!incoming.length) {
      return;
    }

    const room =
      MAX_STEMS - stems.length;

    if (room <= 0) {
      setMessage(
        "Maximum 20 stems already loaded."
      );

      return;
    }

    const selectedByCount =
      incoming.slice(0, room);

    const accepted: File[] = [];

    let projectedBytes =
      totalSize;

    for (
      const file of selectedByCount
    ) {
      if (
        projectedBytes +
          file.size >
        MAX_BATCH_BYTES
      ) {
        break;
      }

      accepted.push(file);

      projectedBytes +=
        file.size;
    }

    if (!accepted.length) {
      setMessage(
        "BATCH SIZE LIMIT REACHED. Remove files before adding more."
      );

      return;
    }

    const items =
      accepted.map(
        (file): StemItem => ({
          id: createId(),
          file,
          outputFormat,
          quality: "high",

          metadataTitle:
            baseName(file.name),
          metadataArtist:
            batchArtist,
          metadataAlbum:
            batchAlbum,
          status: "ready",
          message: "READY",
        })
      );

    setStems(current => [
      ...current,
      ...items,
    ]);

    if (
      incoming.length > accepted.length
    ) {
      setMessage(
        `${accepted.length} file(s) added. Some files were skipped because the 20-stem or 750 MB batch limit was reached.`
      );
    } else {
      setMessage(
        `${accepted.length} stem(s) loaded.`
      );
    }
  }

  function removeStem(
    id: string
  ) {
    if (busy) {
      return;
    }

    setStems(current =>
      current.filter(
        stem => stem.id !== id
      )
    );
  }

  function setStemFormat(
    id: string,
    nextFormat: OutputFormat
  ) {
    if (busy) {
      return;
    }

    setStems(current =>
      current.map(stem =>
        stem.id === id
          ? {
              ...stem,
              outputFormat: nextFormat,
              quality: "high",
              status:
                stem.status === "done"
                  ? "ready"
                  : stem.status,
              message:
                stem.status === "done"
                  ? "READY"
                  : stem.message,
            }
          : stem
      )
    );
  }

  function setStemQuality(
    id: string,
    quality: string
  ) {
    if (busy) {
      return;
    }

    setStems(current =>
      current.map(stem =>
        stem.id === id
          ? {
              ...stem,
              quality,
              status:
                stem.status === "done"
                  ? "ready"
                  : stem.status,
              message:
                stem.status === "done"
                  ? "READY"
                  : stem.message,
            }
          : stem
      )
    );
  }

  function applyQualityToAll(
    quality: string
  ) {
    if (busy) {
      return;
    }

    setStems(current =>
      current.map(stem => ({
        ...stem,
        quality,
        status:
          stem.status === "done"
            ? "ready"
            : stem.status,
        message:
          stem.status === "done"
            ? "READY"
            : stem.message,
      }))
    );
  }

  function qualityLabel(
    stem: StemItem
  ) {
    if (stem.outputFormat === "wav") {
      return "24-BIT LOSSLESS";
    }

    if (stem.outputFormat === "flac") {
      if (stem.quality === "max") {
        return "FLAC LEVEL 12";
      }

      if (stem.quality === "standard") {
        return "FLAC LEVEL 5";
      }

      return "FLAC LEVEL 8";
    }

    if (stem.outputFormat === "ogg") {
      if (stem.quality === "max") {
        return "OGG Q10";
      }

      if (stem.quality === "standard") {
        return "OGG Q5";
      }

      return "OGG Q7";
    }

    if (stem.quality === "max") {
      return "320 KBPS";
    }

    if (stem.quality === "standard") {
      return "192 KBPS";
    }

    return "256 KBPS";
  }

  function clearAll() {
    if (busy) {
      return;
    }

    setStems([]);
    setMessage("");
  }

  async function convertAll() {
    if (!user || !owner) {
      setMessage("OWNER ONLY.");
      return;
    }

    if (!stems.length) {
      setMessage(
        "Load at least one stem."
      );

      return;
    }

    if (
      totalSize > MAX_BATCH_BYTES
    ) {
      setMessage(
        "BATCH TOO LARGE. Maximum total batch size is 750 MB."
      );

      return;
    }

    setBusy(true);

    const zip =
      new JSZip();

    const usedNames =
      new Set<string>();

    let completed = 0;
    let failed = 0;

    try {
      let uploadedCoverUrl = "";

      if (coverFile) {

        setMessage(
          "Uploading album cover..."
        );

        const coverToken =
          await user.getIdToken(true);

        const uploadedCover =
          await upload(
            `solo-stem-cover/${createId()}-${coverFile.name}`,
            coverFile,
            {
              access: "public",
              handleUploadUrl:
                "/api/owner/stem-upload",
              clientPayload:
                JSON.stringify({
                  token: coverToken,
                }),
              multipart: false,
            }
          );

        uploadedCoverUrl =
          uploadedCover.url;
      }

      for (const [stemIndex, stem] of stems.entries()) {

        // Always force a fresh Firebase ID token for each stem.
        // This prevents long batch jobs from reusing an expired token
        // when Vercel Blob requests its client upload token.
        const token =
          await user.getIdToken(true);

        updateStem(
          stem.id,
          {
            status: "converting",
            message: "CONVERTING...",
          }
        );

        try {
          updateStem(
            stem.id,
            {
              status: "converting",
              message: "UPLOADING TO BLOB...",
            }
          );

          let uploadedInput;

          try {
            uploadedInput =
              await upload(
                `solo-stem-input/${createId()}-${stem.file.name}`,
                stem.file,
                {
                  access: "public",
                  handleUploadUrl:
                    "/api/owner/stem-upload",
                  clientPayload:
                    JSON.stringify({
                      token,
                    }),
                  multipart: true,
                }
              );
          } catch (error) {
            throw new Error(
              `BLOB UPLOAD FAILED: ${
                error instanceof Error
                  ? error.message
                  : String(error)
              }`
            );
          }

          updateStem(
            stem.id,
            {
              status: "converting",
              message: "BLOB UPLOAD DONE - CONVERTING...",
            }
          );

          const response =
            await fetch(
              "/api/owner/stem-convert",
              {
                method: "POST",

                headers: {
                  Authorization:
                    `Bearer ${token}`,
                  "Content-Type":
                    "application/json",
                },

                body:
                  JSON.stringify({
                    blobUrl:
                      uploadedInput.url,

                    originalName:
                      stem.file.name,

                    format:
                      stem.outputFormat,

                    bitrate:
                      stem.quality === "max"
                        ? "320"
                        : stem.quality === "standard"
                        ? "192"
                        : "256",

                    flacCompression:
                      stem.quality === "max"
                        ? "12"
                        : stem.quality === "standard"
                        ? "5"
                        : "8",

                    oggQuality:
                      stem.quality === "max"
                        ? "10"
                        : stem.quality === "standard"
                        ? "5"
                        : "7",

                    metadata:
                      stripMetadata
                        ? "strip"
                        : "preserve",

                    metadataTitle:
                      stem.metadataTitle,

                    metadataArtist:
                      stem.metadataArtist,

                    metadataAlbum:
                      stem.metadataAlbum,

                    coverUrl:
                      uploadedCoverUrl,
                  }),
              }
            );

          if (!response.ok) {
            let reason =
              `HTTP ${response.status}`;

            try {
              const data =
                await response.json();

              if (data?.error) {
                reason =
                  String(
                    data.error
                  );
              }
            } catch {}

            throw new Error(
              `CONVERT FAILED: ${reason}`
            );
          }

          const convertedData =
            await response.json();

          const convertedUrl =
            String(
              convertedData?.url ||
                ""
            );

          if (!convertedUrl) {
            throw new Error(
              "CONVERTED_BLOB_URL_MISSING"
            );
          }

          const convertedResponse =
            await fetch(
              convertedUrl,
              {
                cache: "no-store",
              }
            );

          if (
            !convertedResponse.ok
          ) {
            throw new Error(
              `DOWNLOAD FAILED: HTTP ${convertedResponse.status}`
            );
          }

          const blob =
            await convertedResponse.blob();

          void fetch(
            "/api/owner/stem-cleanup",
            {
              method: "POST",

              headers: {
                Authorization:
                  `Bearer ${token}`,
                "Content-Type":
                  "application/json",
              },

              body:
                JSON.stringify({
                  urls: [
                    convertedUrl,
                  ],
                }),
            }
          ).catch(() => {});

          const wantedBase =
              makeExportBaseName(
                stem,
                stemIndex,
                preserveOriginalNames,
                autoNumberExports,
                exportPrefix,
                exportSuffix
              );

          const wanted =
            `${wantedBase}.${stem.outputFormat}`;

          const finalName =
            uniqueOutputName(
              wanted,
              usedNames
            );

          zip.file(
            finalName,
            blob
          );

          completed += 1;

          updateStem(
            stem.id,
            {
              status: "done",
              message:
                `DONE → ${finalName}`,
            }
          );
        } catch (error) {
          failed += 1;

          updateStem(
            stem.id,
            {
              status: "error",

              message:
                error instanceof Error
                  ? error.message
                  : String(error),
            }
          );
        }
      }

      if (!completed) {
        setMessage(
          "No stems converted successfully."
        );

        return;
      }

      setMessage(
        "Creating ZIP..."
      );

      const zipBlob =
        await zip.generateAsync({
          type: "blob",
          compression: "DEFLATE",
          compressionOptions: {
            level: 6,
          },
        });

      const stamp =
        new Date()
          .toISOString()
          .replace(
            /[:.]/g,
            "-"
          );

      const formatsUsed =
        Array.from(
          new Set(
            stems.map(
              stem => stem.outputFormat
            )
          )
        );

      const zipLabel =
        formatsUsed.length > 1
          ? "MIXED"
          : formatsUsed[0]?.toUpperCase() ||
            outputFormat.toUpperCase();

      const projectLabel =
        safeExportNamePart(
          exportProjectName
        );

      const filename =
        projectLabel
          ? `${projectLabel}-${zipLabel}-STEMS-${stamp}.zip`
          : `SOLO-BEATS-${zipLabel}-STEMS-${stamp}.zip`;

      const url =
        URL.createObjectURL(
          zipBlob
        );

      const link =
        document.createElement(
          "a"
        );

      link.href = url;
      link.download = filename;

      document.body.appendChild(
        link
      );

      link.click();
      link.remove();

      window.setTimeout(
        () => {
          URL.revokeObjectURL(
            url
          );
        },
        30000
      );

      setMessage(
        failed
          ? `${completed} converted / ${failed} failed. ZIP downloaded.`
          : `${completed} stems converted successfully. ZIP downloaded.`
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : String(error)
      );
    } finally {
      setBusy(false);
    }
  }

  if (!authReady) {
    return (
      <main className="min-h-screen bg-[#080b15] p-8 text-white">
        <div className="mx-auto max-w-4xl rounded-3xl border border-white/10 bg-white/5 p-8">
          <h1 className="text-3xl font-black">
            OWNER BULK STEM LAB
          </h1>

          <p className="mt-4 text-white/60">
            Checking owner access...
          </p>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-[#080b15] p-8 text-white">
        <div className="mx-auto max-w-4xl rounded-3xl border border-red-400/20 bg-white/5 p-8">
          <h1 className="text-3xl font-black">
            OWNER BULK STEM LAB
          </h1>

          <p className="mt-5 font-black text-red-300">
            SIGN IN REQUIRED
          </p>
        </div>
      </main>
    );
  }

  if (!owner) {
    return (
      <main className="min-h-screen bg-[#080b15] p-8 text-white">
        <div className="mx-auto max-w-4xl rounded-3xl border border-red-400/20 bg-white/5 p-8">
          <h1 className="text-3xl font-black">
            OWNER BULK STEM LAB
          </h1>

          <p className="mt-5 font-black text-red-300">
            OWNER ONLY
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#080b15] px-5 py-10 text-white">
      <div className="mx-auto max-w-6xl">

        <div className="mb-8 flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-xs font-black tracking-[0.25em] text-cyan-300">
              SOLO BEATS ENGINE MUSIC
            </p>

            <h1 className="mt-2 text-4xl font-black md:text-5xl">
              OWNER BULK STEM LAB
            </h1>

            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/55">
              Load up to 20 stems, preserve their
              titles and bulk-convert them.
            </p>
          </div>

          <div className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-4 py-2 text-xs font-black text-emerald-200">
            OWNER ACCESS
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-xs font-black text-white/50">
              DEFAULT OUTPUT FORMAT
            </p>

            <select
              value={
                outputFormat
              }
              disabled={busy}
              onChange={event =>
                setOutputFormat(
                  event.target
                    .value as OutputFormat
                )
              }
              className="mt-3 w-full rounded-xl border border-white/15 bg-black/30 p-3 font-black"
            >
              <option value="mp3">
                MP3
              </option>

              <option value="wav">
                WAV
              </option>

              <option value="flac">
                FLAC
              </option>

              <option value="m4a">
                M4A
              </option>

              <option value="aac">
                AAC
              </option>

              <option value="ogg">
                OGG
              </option>
            </select>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-xs font-black text-white/50">
              MP3 QUALITY
            </p>

            <select
              value={bitrate}
              disabled={
                busy ||
                outputFormat !== "mp3"
              }
              onChange={event =>
                setBitrate(
                  event.target.value
                )
              }
              className="mt-3 w-full rounded-xl border border-white/15 bg-black/30 p-3 font-black"
            >
              <option value="128">
                128 kbps
              </option>

              <option value="160">
                160 kbps
              </option>

              <option value="192">
                192 kbps
              </option>

              <option value="256">
                256 kbps
              </option>

              <option value="320">
                320 kbps
              </option>
            </select>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-xs font-black text-white/50">
              METADATA
            </p>

            <label className="mt-4 flex items-center gap-3 text-sm font-bold">
              <input
                type="checkbox"
                checked={
                  stripMetadata
                }
                disabled={busy}
                onChange={event =>
                  setStripMetadata(
                    event.target.checked
                  )
                }
              />

              Strip ordinary metadata
            </label>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-5">

          <input
            ref={inputRef}
            hidden
            multiple
            type="file"
            accept=".wav,.mp3,.flac,.m4a,.aac,.ogg,audio/*"
            onChange={addFiles}
          />

          <button
            type="button"
            disabled={
              busy ||
              stems.length >= MAX_STEMS
            }
            onClick={() =>
              inputRef.current?.click()
            }
            className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-black disabled:opacity-40"
          >
            ADD STEMS
          </button>

          <button
            type="button"
            disabled={
              busy ||
              !stems.length
            }
            onClick={clearAll}
            className="rounded-xl border border-white/15 bg-white/5 px-5 py-3 text-sm font-black disabled:opacity-40"
          >
            CLEAR ALL
          </button>

          <div className="ml-auto font-black text-cyan-300">
            {stems.length} / 20 STEMS
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-3">

          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-[10px] font-black text-white/40">
              FILES
            </p>

            <p className="mt-1 text-xl font-black">
              {stems.length}
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-[10px] font-black text-white/40">
              TOTAL SIZE
            </p>

            <p className="mt-1 text-xl font-black">
              {prettyBytes(
                totalSize
              )}
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-[10px] font-black text-white/40">
              EXPORT
            </p>

            <p className="mt-1 text-xl font-black">
              {stems.length ? (new Set(stems.map(stem => stem.outputFormat)).size > 1 ? "MIXED" : stems[0].outputFormat.toUpperCase()) : outputFormat.toUpperCase()}
            </p>
          </div>
        </div>

        <div
          className={
            "mt-3 rounded-xl border p-4 text-sm font-bold " +
            (
              batchTooLarge
                ? "border-red-400/30 bg-red-400/10 text-red-200"
                : "border-cyan-300/20 bg-cyan-300/5 text-cyan-100"
            )
          }
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>
              BATCH MEMORY PROTECTION
            </span>

            <span>
              {prettyBytes(totalSize)}
              {" / "}
              {prettyBytes(MAX_BATCH_BYTES)}
            </span>
          </div>

          <p className="mt-2 text-xs opacity-70">
            Remaining capacity:
            {" "}
            {prettyBytes(
              remainingBatchBytes
            )}
          </p>
        </div>

                {/* SOLO_STEM_METADATA_V1 */}
        <div className="mt-5 rounded-2xl border border-cyan-300/15 bg-cyan-300/5 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-black text-cyan-200">
                BATCH METADATA MANAGER
              </p>

              <p className="mt-1 text-xs text-white/45">
                Apply one Artist and Album to every loaded stem.
              </p>
            </div>

            <button
              type="button"
              disabled={
                busy ||
                !stems.length
              }
              onClick={applyBatchMetadata}
              className="rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-5 py-3 text-xs font-black text-cyan-100 disabled:opacity-40"
            >
              APPLY TO ALL STEMS
            </button>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label>
              <span className="text-[10px] font-black text-white/40">
                ARTIST
              </span>

              <input
                type="text"
                value={batchArtist}
                disabled={busy}
                maxLength={200}
                onChange={event =>
                  setBatchArtist(
                    event.target.value
                  )
                }
                placeholder="Artist / Producer"
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-bold text-white outline-none"
              />
            </label>

            <label>
              <span className="text-[10px] font-black text-white/40">
                ALBUM
              </span>

              <input
                type="text"
                value={batchAlbum}
                disabled={busy}
                maxLength={200}
                onChange={event =>
                  setBatchAlbum(
                    event.target.value
                  )
                }
                placeholder="Album / Project"
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-bold text-white outline-none"
              />
            </label>
          </div>
        </div>
        {/* SOLO_STEM_COVER_ART_V1 */}
        <div className="mt-5 rounded-2xl border border-purple-300/20 bg-purple-300/5 p-5">

          <div className="flex flex-wrap items-start justify-between gap-5">

            <div>
              <p className="font-black text-purple-200">
                ALBUM COVER ART
              </p>

              <p className="mt-1 max-w-2xl text-xs text-white/45">
                Attach one cover to this batch.
                MP3 and M4A exports receive embedded artwork.
                WAV remains 24-bit lossless.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">

              <input
                ref={coverInputRef}
                hidden
                type="file"
                accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                onChange={selectCover}
              />

              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  coverInputRef.current?.click()
                }
                className="rounded-xl border border-purple-300/30 bg-purple-300/10 px-5 py-3 text-xs font-black text-purple-100 disabled:opacity-40"
              >
                {coverFile
                  ? "REPLACE COVER"
                  : "UPLOAD COVER"}
              </button>

              {coverFile ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={removeCover}
                  className="rounded-xl border border-red-300/30 bg-red-300/10 px-5 py-3 text-xs font-black text-red-200 disabled:opacity-40"
                >
                  REMOVE
                </button>
              ) : null}

            </div>
          </div>

          {coverFile && coverPreview ? (

            <div className="mt-5 flex flex-wrap items-center gap-5">

              <img
                src={coverPreview}
                alt="Album cover preview"
                className="h-40 w-40 rounded-2xl border border-white/10 object-cover"
              />

              <div>

                <p className="text-sm font-black">
                  {coverFile.name}
                </p>

                <p className="mt-1 text-xs text-white/45">
                  {prettyBytes(
                    coverFile.size
                  )}
                </p>

                <p className="mt-3 text-xs font-black text-emerald-300">
                  COVER READY FOR BATCH
                </p>

              </div>
            </div>

          ) : (

            <div className="mt-5 rounded-xl border border-dashed border-white/15 bg-black/20 p-6 text-center text-xs font-bold text-white/35">
              NO COVER SELECTED
            </div>

          )}

        </div>
<div className="mt-5 rounded-2xl border border-emerald-300/15 bg-emerald-300/5 p-5">

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-black text-emerald-200">
                BATCH QUALITY CONTROL
              </p>

              <p className="mt-1 text-xs text-white/45">
                Apply one quality preset to every loaded stem.
                WAV stays 24-bit lossless.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">

              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  applyQualityToAll(
                    "standard"
                  )
                }
                className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-xs font-black text-white disabled:opacity-40"
              >
                STANDARD
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  applyQualityToAll(
                    "high"
                  )
                }
                className="rounded-lg border border-emerald-300/20 bg-emerald-400/10 px-4 py-2 text-xs font-black text-emerald-200 disabled:opacity-40"
              >
                HIGH
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  applyQualityToAll(
                    "max"
                  )
                }
                className="rounded-lg border border-amber-300/20 bg-amber-400/10 px-4 py-2 text-xs font-black text-amber-200 disabled:opacity-40"
              >
                MAX
              </button>

            </div>
          </div>

        </div>

        <div className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">

          {!stems.length ? (
            <div className="p-14 text-center text-sm text-white/40">
              No stems loaded.
              <br />
              Click ADD STEMS.
            </div>
          ) : (
            stems.map(
              (stem, index) => (
                <div
                  key={stem.id}
                  className="flex flex-wrap items-center gap-4 border-b border-white/10 p-4 last:border-b-0"
                >
                  <div className="grid h-9 w-9 place-items-center rounded-lg bg-white/10 font-black text-cyan-300">
                    {index + 1}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate font-black">
                      {stem.file.name}
                    </p>

                    <p className="mt-1 text-xs text-white/40">
                      {prettyBytes(
                        stem.file.size
                      )}
                      {" • "}
                      {stem.message}
                    </p>
                  </div>

                  <div
                    className={
                      "rounded-full px-3 py-1 text-[10px] font-black " +
                      (
                        stem.status === "done"
                          ? "bg-emerald-300/10 text-emerald-300"
                          : stem.status === "error"
                          ? "bg-red-300/10 text-red-300"
                          : stem.status === "converting"
                          ? "bg-yellow-300/10 text-yellow-300"
                          : "bg-white/10 text-white/60"
                      )
                    }
                  >
                    {stem.status.toUpperCase()}
                  </div>

                                    <div className="w-full">
                    <p className="mb-2 text-[10px] font-black text-cyan-200/70">
                      STEM METADATA
                    </p>

                    <div className="grid gap-2 md:grid-cols-3">
                      <label>
                        <span className="text-[9px] font-black text-white/35">
                          TITLE
                        </span>

                        <input
                          type="text"
                          value={stem.metadataTitle}
                          disabled={busy}
                          maxLength={200}
                          onChange={event =>
                            setStemMetadata(
                              stem.id,
                              "metadataTitle",
                              event.target.value
                            )
                          }
                          placeholder="Title"
                          className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs font-bold text-white outline-none"
                        />
                      </label>

                      <label>
                        <span className="text-[9px] font-black text-white/35">
                          ARTIST
                        </span>

                        <input
                          type="text"
                          value={stem.metadataArtist}
                          disabled={busy}
                          maxLength={200}
                          onChange={event =>
                            setStemMetadata(
                              stem.id,
                              "metadataArtist",
                              event.target.value
                            )
                          }
                          placeholder="Artist"
                          className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs font-bold text-white outline-none"
                        />
                      </label>

                      <label>
                        <span className="text-[9px] font-black text-white/35">
                          ALBUM
                        </span>

                        <input
                          type="text"
                          value={stem.metadataAlbum}
                          disabled={busy}
                          maxLength={200}
                          onChange={event =>
                            setStemMetadata(
                              stem.id,
                              "metadataAlbum",
                              event.target.value
                            )
                          }
                          placeholder="Album"
                          className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs font-bold text-white outline-none"
                        />
                      </label>
                    </div>
                  </div>
<div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-white/40">
                      PER-STEM FORMAT
                    </span>

                    <select
                      value={stem.outputFormat}
                      disabled={busy}
                      onChange={event =>
                        setStemFormat(
                          stem.id,
                          event.target.value as OutputFormat
                        )
                      }
                      className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs font-black text-white outline-none"
                    >
                      <option value="mp3">MP3</option>
                      <option value="wav">WAV</option>
                      <option value="flac">FLAC</option>
                      <option value="m4a">M4A</option>
                      <option value="aac">AAC</option>
                      <option value="ogg">OGG</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-white/40">
                      PER-STEM QUALITY
                    </span>

                    {stem.outputFormat === "wav" ? (
                      <div className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs font-black text-emerald-300">
                        24-BIT LOSSLESS
                      </div>
                    ) : (
                      <select
                        value={stem.quality}
                        disabled={busy}
                        onChange={event =>
                          setStemQuality(
                            stem.id,
                            event.target.value
                          )
                        }
                        className="rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs font-black text-white outline-none"
                      >
                        <option value="standard">
                          STANDARD
                        </option>

                        <option value="high">
                          HIGH
                        </option>

                        <option value="max">
                          MAX
                        </option>
                      </select>
                    )}

                    <span className="min-w-[105px] text-[10px] font-black text-emerald-300">
                      {qualityLabel(stem)}
                    </span>
                  </div>

                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      removeStem(
                        stem.id
                      )
                    }
                    className="rounded-lg border border-red-300/20 px-3 py-2 text-[10px] font-black text-red-300 disabled:opacity-30"
                  >
                    REMOVE
                  </button>
                </div>
              )
            )
          )}
        </div>

                {/* SOLO_STEM_EXPORT_NAMING_V1 */}
        <div className="mt-5 rounded-2xl border border-violet-300/15 bg-violet-300/5 p-5">
          <div>
            <p className="font-black text-violet-200">
              BULK ORGANIZATION + EXPORT NAMING
            </p>

            <p className="mt-1 text-xs text-white/45">
              Original filenames stay protected by default.
              Turn preservation off only when you want custom export names.
            </p>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="md:col-span-2">
              <span className="text-[10px] font-black text-white/40">
                PROJECT / ZIP NAME
              </span>

              <input
                type="text"
                value={exportProjectName}
                disabled={busy}
                maxLength={120}
                onChange={event =>
                  setExportProjectName(
                    event.target.value
                  )
                }
                placeholder="Example: SOLO BEATS STEM PACK"
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-bold text-white outline-none"
              />
            </label>

            <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-4">
              <input
                type="checkbox"
                checked={preserveOriginalNames}
                disabled={busy}
                onChange={event =>
                  setPreserveOriginalNames(
                    event.target.checked
                  )
                }
                className="h-5 w-5"
              />

              <div>
                <p className="text-xs font-black text-white">
                  PRESERVE ORIGINAL FILENAMES
                </p>

                <p className="mt-1 text-[10px] text-white/40">
                  Recommended default.
                </p>
              </div>
            </label>

            <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 p-4">
              <input
                type="checkbox"
                checked={autoNumberExports}
                disabled={
                  busy ||
                  preserveOriginalNames
                }
                onChange={event =>
                  setAutoNumberExports(
                    event.target.checked
                  )
                }
                className="h-5 w-5"
              />

              <div>
                <p className="text-xs font-black text-white">
                  AUTO NUMBER 01 / 02 / 03
                </p>

                <p className="mt-1 text-[10px] text-white/40">
                  Available when custom naming is enabled.
                </p>
              </div>
            </label>

            <label>
              <span className="text-[10px] font-black text-white/40">
                PREFIX
              </span>

              <input
                type="text"
                value={exportPrefix}
                disabled={
                  busy ||
                  preserveOriginalNames
                }
                maxLength={120}
                onChange={event =>
                  setExportPrefix(
                    event.target.value
                  )
                }
                placeholder="Example: SOLO BEATS"
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-bold text-white outline-none disabled:opacity-40"
              />
            </label>

            <label>
              <span className="text-[10px] font-black text-white/40">
                SUFFIX
              </span>

              <input
                type="text"
                value={exportSuffix}
                disabled={
                  busy ||
                  preserveOriginalNames
                }
                maxLength={120}
                onChange={event =>
                  setExportSuffix(
                    event.target.value
                  )
                }
                placeholder="Example: STEM"
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-bold text-white outline-none disabled:opacity-40"
              />
            </label>
          </div>

          <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4">
            <p className="text-[10px] font-black text-white/40">
              CURRENT NAMING MODE
            </p>

            <p className="mt-1 text-sm font-black text-violet-200">
              {preserveOriginalNames
                ? "ORIGINAL FILENAMES"
                : "CUSTOM EXPORT NAMES"}
            </p>

            {!preserveOriginalNames ? (
              <p className="mt-2 text-xs text-white/45">
                Custom exports use each stem's Title plus
                your optional numbering, prefix and suffix.
              </p>
            ) : null}
          </div>
        </div>
<div className="mt-5 flex flex-wrap items-center justify-between gap-5 rounded-2xl border border-cyan-300/20 bg-cyan-300/5 p-5">

          <div>
            <p className="font-black text-cyan-200">
              BULK STEM EXPORT
            </p>

            <p className="mt-1 text-xs leading-5 text-white/45">
              Each stem is converted individually,
              keeps its original basename, then all
              successful files are placed into one ZIP.
            </p>
          </div>

          <button
            type="button"
            disabled={
              busy ||
              !stems.length ||
              batchTooLarge
            }
            onClick={() =>
              void convertAll()
            }
            className="rounded-xl border border-emerald-300/30 bg-emerald-400/15 px-6 py-4 text-sm font-black text-emerald-100 disabled:opacity-40"
          >
            {busy
              ? "CONVERTING..."
              : "CONVERT ALL STEMS"}
          </button>
        </div>

        {message ? (
          <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4 text-sm font-bold">
            {message}
          </div>
        ) : null}

      </div>
    </main>
  );
}










