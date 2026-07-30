"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { albums, type Album } from "../../store/albums";

type TestStatus =
  | "idle"
  | "testing"
  | "passed"
  | "failed";

type TestResult = {
  key: string;
  itemId: string;
  itemType: "album" | "track";
  title: string;
  status: TestStatus;
  message: string;
  fileName?: string;
  downloadUrl?: string;
  expiresAt?: string;
};

type DownloadApiResponse = {
  success?: boolean;
  testMode?: boolean;
  itemId?: string;
  itemType?: "album" | "track";
  title?: string;
  fileName?: string;
  downloadUrl?: string;
  expiresAt?: string;
  message?: string;
  error?: string;
};

function makeResultKey(
  itemType: "album" | "track",
  itemId: string
) {
  return `${itemType}:${itemId}`;
}

export default function DeveloperDownloadTestingPage() {
  const [selectedAlbumId, setSelectedAlbumId] =
    useState(albums[0]?.id ?? "");

  const [results, setResults] = useState<
    Record<string, TestResult>
  >({});

  const [testingAll, setTestingAll] = useState(false);
  const [testingCatalog, setTestingCatalog] =
    useState(false);

  const selectedAlbum = useMemo(
    () =>
      albums.find(
        (album) => album.id === selectedAlbumId
      ) ?? albums[0],
    [selectedAlbumId]
  );

  const selectedAlbumResults = useMemo(() => {
    if (!selectedAlbum) {
      return [];
    }

    const albumResult =
      results[
        makeResultKey("album", selectedAlbum.id)
      ];

    const trackResults = selectedAlbum.tracks
      .map(
        (track) =>
          results[
            makeResultKey("track", track.id)
          ]
      )
      .filter(
        (result): result is TestResult =>
          Boolean(result)
      );

    return [
      ...(albumResult ? [albumResult] : []),
      ...trackResults,
    ];
  }, [results, selectedAlbum]);

  const passedCount = selectedAlbumResults.filter(
    (result) => result.status === "passed"
  ).length;

  const failedCount = selectedAlbumResults.filter(
    (result) => result.status === "failed"
  ).length;

  const testingCount = selectedAlbumResults.filter(
    (result) => result.status === "testing"
  ).length;

  async function testDownload(
    itemType: "album" | "track",
    itemId: string,
    title: string
  ): Promise<TestResult> {
    const key = makeResultKey(itemType, itemId);

    const testingResult: TestResult = {
      key,
      itemId,
      itemType,
      title,
      status: "testing",
      message: "Checking Firebase Storage...",
    };

    setResults((current) => ({
      ...current,
      [key]: testingResult,
    }));

    try {
      const response = await fetch("/api/download", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          testMode: true,
          itemType,
          itemId,
        }),
      });

      const data =
        (await response.json()) as DownloadApiResponse;

      if (!response.ok || !data.success) {
        const failedResult: TestResult = {
          key,
          itemId,
          itemType,
          title,
          status: "failed",
          message:
            data.error ||
            "The download test failed.",
        };

        setResults((current) => ({
          ...current,
          [key]: failedResult,
        }));

        return failedResult;
      }

      const passedResult: TestResult = {
        key,
        itemId,
        itemType,
        title: data.title || title,
        status: "passed",
        message:
          data.message ||
          "Secure download link generated.",
        fileName: data.fileName,
        downloadUrl: data.downloadUrl,
        expiresAt: data.expiresAt,
      };

      setResults((current) => ({
        ...current,
        [key]: passedResult,
      }));

      return passedResult;
    } catch (error) {
      const failedResult: TestResult = {
        key,
        itemId,
        itemType,
        title,
        status: "failed",
        message:
          error instanceof Error
            ? error.message
            : "An unexpected test error occurred.",
      };

      setResults((current) => ({
        ...current,
        [key]: failedResult,
      }));

      return failedResult;
    }
  }

  async function testSelectedAlbumZip() {
    if (!selectedAlbum) {
      return;
    }

    await testDownload(
      "album",
      selectedAlbum.id,
      `${selectedAlbum.title} — Full Album`
    );
  }

  async function testSelectedAlbumTracks() {
    if (!selectedAlbum || testingAll) {
      return;
    }

    setTestingAll(true);

    try {
      for (const track of selectedAlbum.tracks) {
        await testDownload(
          "track",
          track.id,
          track.title
        );
      }
    } finally {
      setTestingAll(false);
    }
  }

  async function testSelectedAlbumEverything() {
    if (!selectedAlbum || testingAll) {
      return;
    }

    setTestingAll(true);

    try {
      await testDownload(
        "album",
        selectedAlbum.id,
        `${selectedAlbum.title} — Full Album`
      );

      for (const track of selectedAlbum.tracks) {
        await testDownload(
          "track",
          track.id,
          track.title
        );
      }
    } finally {
      setTestingAll(false);
    }
  }

  async function testEntireCatalog() {
    if (testingCatalog) {
      return;
    }

    setTestingCatalog(true);

    try {
      for (const album of albums) {
        await testDownload(
          "album",
          album.id,
          `${album.title} — Full Album`
        );

        for (const track of album.tracks) {
          await testDownload(
            "track",
            track.id,
            track.title
          );
        }
      }
    } finally {
      setTestingCatalog(false);
    }
  }

  function clearSelectedAlbumResults() {
    if (!selectedAlbum) {
      return;
    }

    setResults((current) => {
      const updated = { ...current };

      delete updated[
        makeResultKey("album", selectedAlbum.id)
      ];

      for (const track of selectedAlbum.tracks) {
        delete updated[
          makeResultKey("track", track.id)
        ];
      }

      return updated;
    });
  }

  function clearAllResults() {
    setResults({});
  }

  if (process.env.NODE_ENV === "production") {
    return (
      <main style={styles.lockedPage}>
        <section style={styles.lockedCard}>
          <h1 style={styles.lockedTitle}>
            Developer Testing Disabled
          </h1>

          <p style={styles.lockedText}>
            This page is available only while the
            project is running in development mode.
          </p>

          <Link href="/store" style={styles.storeLink}>
            Return to Store
          </Link>
        </section>
      </main>
    );
  }

  if (!selectedAlbum) {
    return (
      <main style={styles.lockedPage}>
        <section style={styles.lockedCard}>
          <h1 style={styles.lockedTitle}>
            No Albums Found
          </h1>

          <p style={styles.lockedText}>
            Add albums to app/store/albums.ts before
            using the developer tester.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <header style={styles.header}>
        <div>
          <p style={styles.eyebrow}>
            SOLO BEATS ENGINE MUSIC
          </p>

          <h1 style={styles.title}>
            Developer Catalog Download Tester
          </h1>

          <p style={styles.subtitle}>
            Test Firebase album ZIPs and individual
            tracks without making a PayPal purchase.
          </p>
        </div>

        <div style={styles.headerLinks}>
          <Link href="/store" style={styles.linkButton}>
            Store
          </Link>

          <Link href="/" style={styles.linkButton}>
            Home
          </Link>
        </div>
      </header>

      <section style={styles.warning}>
        <strong>Development mode only.</strong>
        <span>
          {" "}
          These tests call the secure download API
          using testMode and are blocked in
          production.
        </span>
      </section>

      <section style={styles.controlsCard}>
        <label style={styles.label}>
          Select an album
        </label>

        <select
          value={selectedAlbum.id}
          onChange={(event) =>
            setSelectedAlbumId(event.target.value)
          }
          disabled={testingAll || testingCatalog}
          style={styles.select}
        >
          {albums.map((album) => (
            <option
              key={album.id}
              value={album.id}
            >
              {album.title} — {album.tracks.length}{" "}
              Tracks
            </option>
          ))}
        </select>

        <div style={styles.buttonGrid}>
          <button
            type="button"
            onClick={testSelectedAlbumZip}
            disabled={testingAll || testingCatalog}
            style={styles.primaryButton}
          >
            Test Album ZIP
          </button>

          <button
            type="button"
            onClick={testSelectedAlbumTracks}
            disabled={testingAll || testingCatalog}
            style={styles.primaryButton}
          >
            {testingAll
              ? "Testing..."
              : "Test All Tracks"}
          </button>

          <button
            type="button"
            onClick={testSelectedAlbumEverything}
            disabled={testingAll || testingCatalog}
            style={styles.successButton}
          >
            {testingAll
              ? "Testing Album..."
              : "Test Complete Album"}
          </button>

          <button
            type="button"
            onClick={testEntireCatalog}
            disabled={testingAll || testingCatalog}
            style={styles.catalogButton}
          >
            {testingCatalog
              ? "Testing Entire Catalog..."
              : "Test Entire Catalog"}
          </button>

          <button
            type="button"
            onClick={clearSelectedAlbumResults}
            disabled={testingAll || testingCatalog}
            style={styles.secondaryButton}
          >
            Clear Album Results
          </button>

          <button
            type="button"
            onClick={clearAllResults}
            disabled={testingAll || testingCatalog}
            style={styles.secondaryButton}
          >
            Clear All Results
          </button>
        </div>
      </section>

      <section style={styles.albumCard}>
        <img
          src={selectedAlbum.cover}
          alt={`${selectedAlbum.title} album cover`}
          style={styles.cover}
        />

        <div style={styles.albumInfo}>
          <div style={styles.badges}>
            <span style={styles.badge}>
              {selectedAlbum.status.toUpperCase()}
            </span>

            <span style={styles.badge}>
              {selectedAlbum.genre}
            </span>

            <span style={styles.badge}>
              {selectedAlbum.tracks.length} TRACKS
            </span>
          </div>

          <h2 style={styles.albumTitle}>
            {selectedAlbum.title}
          </h2>

          <p style={styles.artist}>
            {selectedAlbum.artist}
          </p>

          <p style={styles.description}>
            {selectedAlbum.description}
          </p>
        </div>
      </section>

      <section style={styles.summaryGrid}>
        <div style={styles.summaryCard}>
          <span style={styles.summaryNumber}>
            {passedCount}
          </span>
          <span style={styles.summaryLabel}>
            Passed
          </span>
        </div>

        <div style={styles.summaryCard}>
          <span style={styles.summaryNumber}>
            {failedCount}
          </span>
          <span style={styles.summaryLabel}>
            Failed
          </span>
        </div>

        <div style={styles.summaryCard}>
          <span style={styles.summaryNumber}>
            {testingCount}
          </span>
          <span style={styles.summaryLabel}>
            Testing
          </span>
        </div>

        <div style={styles.summaryCard}>
          <span style={styles.summaryNumber}>
            {selectedAlbum.tracks.length + 1}
          </span>
          <span style={styles.summaryLabel}>
            Total Files
          </span>
        </div>
      </section>

      <section style={styles.resultsSection}>
        <h2 style={styles.resultsTitle}>
          Album ZIP
        </h2>

        <ResultCard
          itemType="album"
          itemId={selectedAlbum.id}
          title={`${selectedAlbum.title} — Full Album`}
          result={
            results[
              makeResultKey(
                "album",
                selectedAlbum.id
              )
            ]
          }
          onTest={() =>
            testDownload(
              "album",
              selectedAlbum.id,
              `${selectedAlbum.title} — Full Album`
            )
          }
          disabled={testingAll || testingCatalog}
        />

        <h2 style={styles.resultsTitle}>
          Individual Tracks
        </h2>

        <div style={styles.trackList}>
          {selectedAlbum.tracks.map((track) => {
            const result =
              results[
                makeResultKey("track", track.id)
              ];

            return (
              <ResultCard
                key={track.id}
                itemType="track"
                itemId={track.id}
                title={`${track.number}. ${track.title}`}
                result={result}
                onTest={() =>
                  testDownload(
                    "track",
                    track.id,
                    track.title
                  )
                }
                disabled={
                  testingAll || testingCatalog
                }
              />
            );
          })}
        </div>
      </section>
    </main>
  );
}

type ResultCardProps = {
  itemType: "album" | "track";
  itemId: string;
  title: string;
  result?: TestResult;
  onTest: () => void;
  disabled: boolean;
};

function ResultCard({
  itemType,
  itemId,
  title,
  result,
  onTest,
  disabled,
}: ResultCardProps) {
  const status = result?.status ?? "idle";

  const statusLabel =
    status === "testing"
      ? "TESTING"
      : status === "passed"
        ? "PASSED"
        : status === "failed"
          ? "FAILED"
          : "NOT TESTED";

  const statusStyle =
    status === "passed"
      ? styles.statusPassed
      : status === "failed"
        ? styles.statusFailed
        : status === "testing"
          ? styles.statusTesting
          : styles.statusIdle;

  return (
    <article style={styles.resultCard}>
      <div style={styles.resultTop}>
        <div>
          <span
            style={{
              ...styles.status,
              ...statusStyle,
            }}
          >
            {statusLabel}
          </span>

          <h3 style={styles.resultTitle}>
            {title}
          </h3>

          <p style={styles.itemId}>
            {itemType}: {itemId}
          </p>
        </div>

        <button
          type="button"
          onClick={onTest}
          disabled={
            disabled || status === "testing"
          }
          style={styles.smallTestButton}
        >
          {status === "testing"
            ? "Testing..."
            : "Test"}
        </button>
      </div>

      {result && (
        <div style={styles.resultDetails}>
          <p style={styles.resultMessage}>
            {result.message}
          </p>

          {result.fileName && (
            <p style={styles.fileName}>
              File: {result.fileName}
            </p>
          )}

          {result.expiresAt && (
            <p style={styles.expires}>
              Link expires:{" "}
              {new Date(
                result.expiresAt
              ).toLocaleString()}
            </p>
          )}

          {result.downloadUrl && (
            <a
              href={result.downloadUrl}
              target="_blank"
              rel="noreferrer"
              style={styles.downloadButton}
            >
              Download Test File
            </a>
          )}
        </div>
      )}
    </article>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    padding: "32px",
    color: "#ffffff",
    background:
      "radial-gradient(circle at top left, #34206d 0%, #100d25 38%, #080711 100%)",
    fontFamily:
      "Arial, Helvetica, sans-serif",
  },
  header: {
    maxWidth: "1200px",
    margin: "0 auto 24px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "24px",
    flexWrap: "wrap",
  },
  eyebrow: {
    margin: "0 0 10px",
    color: "#82ffd3",
    fontSize: "13px",
    fontWeight: 800,
    letterSpacing: "0.15em",
  },
  title: {
    margin: "0",
    fontSize: "clamp(30px, 5vw, 58px)",
    lineHeight: 1.05,
  },
  subtitle: {
    maxWidth: "720px",
    margin: "16px 0 0",
    color: "#c8c3dd",
    fontSize: "17px",
    lineHeight: 1.6,
  },
  headerLinks: {
    display: "flex",
    gap: "10px",
  },
  linkButton: {
    padding: "12px 18px",
    border: "1px solid #7469a3",
    borderRadius: "999px",
    color: "#ffffff",
    textDecoration: "none",
    background: "rgba(255,255,255,0.06)",
    fontWeight: 700,
  },
  warning: {
    maxWidth: "1200px",
    margin: "0 auto 22px",
    padding: "15px 18px",
    border: "1px solid #e9b949",
    borderRadius: "14px",
    color: "#ffe19b",
    background: "rgba(233,185,73,0.10)",
    lineHeight: 1.5,
  },
  controlsCard: {
    maxWidth: "1200px",
    margin: "0 auto 24px",
    padding: "22px",
    border: "1px solid #493e75",
    borderRadius: "20px",
    background: "rgba(15,12,36,0.82)",
  },
  label: {
    display: "block",
    marginBottom: "8px",
    fontSize: "14px",
    fontWeight: 800,
    color: "#cfc8ef",
  },
  select: {
    width: "100%",
    padding: "14px",
    marginBottom: "18px",
    border: "1px solid #645b8e",
    borderRadius: "12px",
    color: "#ffffff",
    background: "#17132e",
    fontSize: "16px",
  },
  buttonGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(190px, 1fr))",
    gap: "12px",
  },
  primaryButton: {
    padding: "14px 18px",
    border: "1px solid #7b68ee",
    borderRadius: "12px",
    color: "#ffffff",
    background:
      "linear-gradient(135deg, #6147d9, #3579d8)",
    fontWeight: 800,
    cursor: "pointer",
  },
  successButton: {
    padding: "14px 18px",
    border: "1px solid #3ee6a0",
    borderRadius: "12px",
    color: "#07160f",
    background:
      "linear-gradient(135deg, #5af0af, #38c987)",
    fontWeight: 900,
    cursor: "pointer",
  },
  catalogButton: {
    padding: "14px 18px",
    border: "1px solid #f0a6ff",
    borderRadius: "12px",
    color: "#ffffff",
    background:
      "linear-gradient(135deg, #9b42d0, #e357a8)",
    fontWeight: 900,
    cursor: "pointer",
  },
  secondaryButton: {
    padding: "14px 18px",
    border: "1px solid #655d82",
    borderRadius: "12px",
    color: "#ffffff",
    background: "rgba(255,255,255,0.05)",
    fontWeight: 700,
    cursor: "pointer",
  },
  albumCard: {
    maxWidth: "1200px",
    margin: "0 auto 24px",
    padding: "20px",
    display: "grid",
    gridTemplateColumns:
      "minmax(180px, 270px) 1fr",
    gap: "26px",
    border: "1px solid #493e75",
    borderRadius: "22px",
    background: "rgba(17,14,39,0.82)",
  },
  cover: {
    width: "100%",
    aspectRatio: "1 / 1",
    objectFit: "cover",
    borderRadius: "16px",
  },
  albumInfo: {
    alignSelf: "center",
  },
  badges: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
  },
  badge: {
    padding: "7px 10px",
    border: "1px solid #5c527e",
    borderRadius: "999px",
    color: "#d8d3ec",
    fontSize: "12px",
    fontWeight: 800,
  },
  albumTitle: {
    margin: "18px 0 8px",
    fontSize: "clamp(30px, 5vw, 52px)",
  },
  artist: {
    margin: "0 0 14px",
    color: "#82ffd3",
    fontWeight: 900,
    letterSpacing: "0.12em",
  },
  description: {
    margin: 0,
    maxWidth: "760px",
    color: "#c8c3dd",
    lineHeight: 1.7,
  },
  summaryGrid: {
    maxWidth: "1200px",
    margin: "0 auto 24px",
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit, minmax(150px, 1fr))",
    gap: "12px",
  },
  summaryCard: {
    padding: "18px",
    border: "1px solid #493e75",
    borderRadius: "16px",
    background: "rgba(17,14,39,0.82)",
    textAlign: "center",
  },
  summaryNumber: {
    display: "block",
    fontSize: "32px",
    fontWeight: 900,
  },
  summaryLabel: {
    display: "block",
    marginTop: "5px",
    color: "#aaa4c4",
    fontSize: "13px",
    fontWeight: 700,
    textTransform: "uppercase",
  },
  resultsSection: {
    maxWidth: "1200px",
    margin: "0 auto",
  },
  resultsTitle: {
    margin: "28px 0 12px",
    fontSize: "24px",
  },
  trackList: {
    display: "grid",
    gap: "12px",
  },
  resultCard: {
    padding: "18px",
    border: "1px solid #493e75",
    borderRadius: "16px",
    background: "rgba(17,14,39,0.86)",
  },
  resultTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "16px",
  },
  status: {
    display: "inline-block",
    padding: "6px 9px",
    borderRadius: "999px",
    fontSize: "11px",
    fontWeight: 900,
  },
  statusPassed: {
    color: "#53f6ae",
    border: "1px solid #35d993",
    background: "rgba(53,217,147,0.12)",
  },
  statusFailed: {
    color: "#ff8585",
    border: "1px solid #ff6868",
    background: "rgba(255,104,104,0.12)",
  },
  statusTesting: {
    color: "#ffe08a",
    border: "1px solid #e9b949",
    background: "rgba(233,185,73,0.12)",
  },
  statusIdle: {
    color: "#bbb5cf",
    border: "1px solid #5a5272",
    background: "rgba(255,255,255,0.05)",
  },
  resultTitle: {
    margin: "10px 0 4px",
    fontSize: "19px",
  },
  itemId: {
    margin: 0,
    color: "#8f88a8",
    fontSize: "13px",
  },
  smallTestButton: {
    flexShrink: 0,
    padding: "10px 16px",
    border: "1px solid #6f63a0",
    borderRadius: "10px",
    color: "#ffffff",
    background: "#282044",
    fontWeight: 800,
    cursor: "pointer",
  },
  resultDetails: {
    marginTop: "15px",
    paddingTop: "15px",
    borderTop: "1px solid #3c3557",
  },
  resultMessage: {
    margin: "0 0 8px",
    color: "#d8d3e8",
  },
  fileName: {
    margin: "0 0 8px",
    color: "#aaa4c4",
    fontSize: "14px",
  },
  expires: {
    margin: "0 0 13px",
    color: "#e5c87a",
    fontSize: "13px",
  },
  downloadButton: {
    display: "inline-block",
    padding: "11px 15px",
    borderRadius: "10px",
    color: "#07160f",
    background: "#53e9a6",
    textDecoration: "none",
    fontWeight: 900,
  },
  lockedPage: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    padding: "24px",
    color: "#ffffff",
    background: "#090812",
    fontFamily:
      "Arial, Helvetica, sans-serif",
  },
  lockedCard: {
    width: "100%",
    maxWidth: "600px",
    padding: "34px",
    border: "1px solid #4b4369",
    borderRadius: "22px",
    textAlign: "center",
    background: "#151225",
  },
  lockedTitle: {
    margin: "0 0 14px",
    fontSize: "34px",
  },
  lockedText: {
    margin: "0 0 20px",
    color: "#bbb5cf",
    lineHeight: 1.6,
  },
  storeLink: {
    display: "inline-block",
    padding: "12px 18px",
    borderRadius: "999px",
    color: "#ffffff",
    background: "#644bd9",
    textDecoration: "none",
    fontWeight: 800,
  },
};