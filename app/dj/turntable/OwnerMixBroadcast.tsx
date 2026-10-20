"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";

import { getAuth } from "firebase/auth";

import {
  Room,
  RoomEvent,
} from "livekit-client";

type BroadcastStatus = {
  success?: boolean;
  liveMicOnAir?: boolean;
  liveMicRoom?: string;
  liveMicMode?: "duck" | "takeover";
};

type TokenResponse = {
  success?: boolean;
  token?: string;
  url?: string;
  room?: string;
  error?: string;
};

export default function OwnerMixBroadcast({
  getMixTrack,
  onLiveStarted,
  onLiveEnded,
  micLive,
  onToggleMic,
  owner = false,
  getAuthToken,
}: {
  getMixTrack: () => Promise<MediaStreamTrack>;
  onLiveStarted?: () => void | Promise<void>;
  onLiveEnded?: () => void | Promise<void>;
  micLive?: boolean;
  onToggleMic?: () => void | Promise<void>;
  owner?: boolean;
  getAuthToken?: () => Promise<string>;
}) {
  const broadcastApi =
    owner
      ? "/api/owner/broadcast"
      : "/api/dj/broadcast";

  const tokenApi =
    owner
      ? "/api/owner/radio/live-token"
      : "/api/dj/radio/live-token";
  // SOLO_OWNER_MIX_TEST_V1
  const mixTrackRef = useRef<MediaStreamTrack | null>(null);
  const roomRef =
    useRef<Room | null>(null);

  // Prevent a delayed status request from overwriting
  // a mode that the owner has just selected.
  const modeSelectionDirtyRef =
    useRef(false);

  const liveMicModeRef =
    useRef<"duck" | "takeover">("duck");

  const [live, setLive] =
    useState(false);

  const [liveMicMode, setLiveMicMode] =
    useState<"duck" | "takeover">("duck");

  const [busy, setBusy] =
    useState(false);

  const [message, setMessage] =
    useState(
      "Turntable mix broadcast is offline."
    );

  const [level, setLevel] =
    useState("OFF AIR");

  async function authToken() {
    if (getAuthToken) {
      return await getAuthToken();
    }

    const currentUser =
      getAuth().currentUser;

    if (!currentUser) {
      throw new Error(
        "Sign in is required."
      );
    }

    return await currentUser.getIdToken(true);
  }

  async function loadStatus() {
    try {
      const token =
        await authToken();

      const response =
        await fetch(
          broadcastApi,
          {
            cache: "no-store",
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          }
        );

      const data =
        (await response.json()) as
        BroadcastStatus;

      if (!response.ok) {
        return;
      }

      const isLive =
        data.liveMicOnAir === true;

      setLive(isLive);

      if (!modeSelectionDirtyRef.current) {
        const storedMode =
          data.liveMicMode === "takeover"
            ? "takeover"
            : "duck";

        liveMicModeRef.current =
          storedMode;

        setLiveMicMode(
          storedMode
        );
      }

      if (isLive) {
        setLevel("ON AIR");
        setMessage(
          "Live Mix is marked ON AIR."
        );
      }
    } catch {
      // Owner auth may still be initializing.
    }
  }

  useEffect(() => {
    void loadStatus();

    return () => {
      const room =
        roomRef.current;

      roomRef.current = null;

      if (room) {
        (mixTrackRef.current as MediaStreamTrack | null)?.stop();
        mixTrackRef.current = null;
        room.disconnect();

        const currentUser =
          getAuth().currentUser;

        if (currentUser) {
          void currentUser
            .getIdToken()
            .then(token =>
              fetch(
                broadcastApi,
                {
                  method: "PATCH",
                  keepalive: true,
                  headers: {
                    "Content-Type":
                      "application/json",
                    Authorization:
                      `Bearer ${token}`,
                  },
                  body:
                    JSON.stringify({
                      liveMicOnAir:
                        false,
                    }),
                }
              )
            )
            .catch(() => {
              // Best-effort page-exit cleanup.
            });
        }
      }
    };
  }, []);

  async function saveLiveMicMode(
    mode: "duck" | "takeover"
  ) {
    modeSelectionDirtyRef.current =
      true;

    liveMicModeRef.current =
      mode;

    const token =
      await authToken();

    const response =
      await fetch(
        broadcastApi,
        {
          method: "PATCH",

          headers: {
            "Content-Type":
              "application/json",

            Authorization:
              `Bearer ${token}`,
          },

          body: JSON.stringify({
            liveMicMode: mode,
          }),
        }
      );

    const data =
      await response.json();

    if (!response.ok) {
      throw new Error(
        data?.error ||
          "Live music mode could not be saved."
      );
    }

    setLiveMicMode(mode);
  }
  async function updateBroadcastStatus(
    nextLive: boolean
  ) {
    const token =
      await authToken();

    const response =
      await fetch(
        broadcastApi,
        {
          method: "PATCH",

          headers: {
            "Content-Type":
              "application/json",

            Authorization:
              `Bearer ${token}`,
          },

          body: JSON.stringify({
            liveMicOnAir:
              nextLive,
            liveMicMode:
              liveMicModeRef.current,
          }),
        }
      );

    const data =
      await response.json();

    if (!response.ok) {
      throw new Error(
        data?.error ||
          "Live Mix status could not be updated."
      );
    }
  }

  async function goLive() {
    if (busy) {
      return;
    }

    setBusy(true);
    setMessage(
      "Connecting turntable mix..."
    );

    let room: Room | null = null;
    let statusAttempted = false;

    try {
      mixTrackRef.current = await getMixTrack();
      const idToken = await authToken();

      const statusResponse = await fetch(broadcastApi, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const statusData = await statusResponse.json();

      if (!statusResponse.ok || !statusData.success) {
        throw new Error(statusData.error || "Could not check broadcast status.");
      }
      if (statusData.radioOnAir === false) {
        throw new Error("Turn Radio ON in Developer Radio first.");
      }
      if (statusData.liveMicOnAir === true) {
        throw new Error("End the existing broadcast in its original tab first.");
      }

      const tokenResponse =
        await fetch(
          tokenApi,
          {
            method: "POST",

            headers: {
              Authorization:
                `Bearer ${idToken}`,
            },
          }
        );

      const tokenData =
        (await tokenResponse.json()) as
        TokenResponse;

      if (
        !tokenResponse.ok ||
        !tokenData.token ||
        !tokenData.url
      ) {
        throw new Error(
          tokenData.error ||
            "Live Mix token could not be created."
        );
      }

      if (!owner) {
        statusAttempted = true;
      }

      room =
        new Room({
          adaptiveStream: true,
          dynacast: true,
        });

      roomRef.current =
        room;

      room.on(
        RoomEvent.Disconnected,
        () => {
          setLive(false);
          setLevel("OFF AIR");
        }
      );

      await room.connect(
        tokenData.url,
        tokenData.token
      );

      setMessage(
        "Requesting turntable mix access..."
      );

      const mixTrack = mixTrackRef.current;
      if (!mixTrack || mixTrack.readyState !== "live") {
        throw new Error("The turntable audio output is unavailable.");
      }

      await room.localParticipant.publishTrack(mixTrack, {
        name: "solo-beats-turntable-mix",
        forceStereo: true,
        dtx: false,
      });

      if (onLiveStarted) {
        await onLiveStarted();
      }

      statusAttempted = true;
      await updateBroadcastStatus(true);

      setLive(true);
      setLevel("ON AIR");

      setMessage(
        "YOU ARE LIVE  your turntable mix is broadcasting."
      );
    } catch (error) {
      mixTrackRef.current?.stop();
      mixTrackRef.current = null;

      if (room) {
        (mixTrackRef.current as MediaStreamTrack | null)?.stop(); mixTrackRef.current = null; room.disconnect();
      }

      roomRef.current =
        null;

      setLive(false);
      setLevel("OFF AIR");

      setMessage(
        error instanceof Error
          ? error.message
          : "Live Mix could not start."
      );

      try {
        if (statusAttempted) {
          await updateBroadcastStatus(false);
        }
      } catch {
        // Ignore cleanup status failure.
      }
    } finally {
      setBusy(false);
    }
  }

  async function endLive() {
    if (onLiveEnded) {
      await onLiveEnded();
    }
    if (busy) {
      return;
    }

    setBusy(true);
    setMessage(
      "Ending Live Mix..."
    );

    try {
      try {
        const room =
          roomRef.current;

        if (room) {
          const track = mixTrackRef.current;
          if (track) {
            await room.localParticipant.unpublishTrack(track);
            track.stop();
            mixTrackRef.current = null;
          }

          (mixTrackRef.current as MediaStreamTrack | null)?.stop(); mixTrackRef.current = null; room.disconnect();

          roomRef.current =
            null;
        }
      } finally {
        await updateBroadcastStatus(
          false
        );
      }

      setLive(false);
      setLevel("OFF AIR");

      setMessage(
        "Live Mix broadcast ended."
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Live Mix could not be ended."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      style={{
        marginTop: 24,
        marginBottom: 24,
        padding: 24,
        borderRadius: 24,
        border:
          live
            ? "1px solid rgba(239,68,68,.65)"
            : "1px solid rgba(255,255,255,.14)",
        background:
          live
            ? "linear-gradient(135deg, rgba(127,29,29,.38), rgba(15,23,42,.96))"
            : "linear-gradient(135deg, rgba(15,23,42,.96), rgba(2,6,23,.96))",
        boxShadow:
          live
            ? "0 0 42px rgba(239,68,68,.20)"
            : "0 18px 60px rgba(0,0,0,.25)",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 18,
          alignItems: "center",
          justifyContent:
            "space-between",
          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginBottom: 8,
            }}
          >
            <span
              style={{
                width: 12,
                height: 12,
                borderRadius: 999,
                background:
                  live
                    ? "#ef4444"
                    : "#64748b",
                boxShadow:
                  live
                    ? "0 0 18px #ef4444"
                    : "none",
              }}
            />

            <strong
              style={{
                letterSpacing: 2,
                color:
                  live
                    ? "#fca5a5"
                    : "#94a3b8",
              }}
            >
              {level}
            </strong>
          </div>

          <h2
            style={{
              margin: 0,
              fontSize: 26,
              fontWeight: 900,
            }}
          >
             SOLO BEATS LIVE MIX
          </h2>

          <p
            style={{
              marginTop: 8,
              marginBottom: 0,
              opacity: 0.78,
            }}
          >
            Broadcast your complete master mix to Premium Radio. MIC LIVE is included.
          </p>

          <p
            style={{
              marginTop: 8,
              marginBottom: 0,
              fontSize: 14,
              opacity: 0.68,
            }}
          >
            {message}
          </p>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            minWidth: 260,
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 900,
              letterSpacing: 1.5,
              opacity: 0.72,
            }}
          >
            LIVE MUSIC MODE
          </div>

          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              disabled={live || busy}
              onClick={() => {
                setLiveMicMode("duck");

                void saveLiveMicMode(
                  "duck"
                ).catch((error) => {
                  setMessage(
                    error instanceof Error
                      ? error.message
                      : "Duck Mode could not be saved."
                  );
                });
              }}
              style={{
                border:
                  liveMicMode === "duck"
                    ? "1px solid #22d3ee"
                    : "1px solid rgba(255,255,255,.15)",
                borderRadius: 10,
                padding: "10px 14px",
                cursor:
                  live || busy
                    ? "not-allowed"
                    : "pointer",
                background:
                  liveMicMode === "duck"
                    ? "rgba(34,211,238,.18)"
                    : "rgba(255,255,255,.05)",
                color: "#fff",
                fontWeight: 900,
                opacity:
                  live || busy
                    ? 0.6
                    : 1,
              }}
            >
              DUCK MODE
            </button>

            <button
              type="button"
              disabled={live || busy}
              onClick={() => {
                setLiveMicMode("takeover");

                void saveLiveMicMode(
                  "takeover"
                ).catch((error) => {
                  setMessage(
                    error instanceof Error
                      ? error.message
                      : "Full Takeover could not be saved."
                  );
                });
              }}
              style={{
                border:
                  liveMicMode === "takeover"
                    ? "1px solid #f97316"
                    : "1px solid rgba(255,255,255,.15)",
                borderRadius: 10,
                padding: "10px 14px",
                cursor:
                  live || busy
                    ? "not-allowed"
                    : "pointer",
                background:
                  liveMicMode === "takeover"
                    ? "rgba(249,115,22,.18)"
                    : "rgba(255,255,255,.05)",
                color: "#fff",
                fontWeight: 900,
                opacity:
                  live || busy
                    ? 0.6
                    : 1,
              }}
            >
              FULL TAKEOVER
            </button>
          </div>

          <div
            style={{
              fontSize: 12,
              opacity: 0.65,
            }}
          >
            {liveMicMode === "duck"
              ? "Station music stays underneath your turntable mix at reduced volume."
              : "Station music pauses for your turntable mix and resumes after END MIX."}
          </div>
        </div>

        {onToggleMic && (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              void Promise.resolve(onToggleMic()).catch((error) => {
                setMessage(
                  error instanceof Error
                    ? error.message
                    : "Microphone could not be changed."
                );
              });
            }}
            style={{
              minWidth: 190,
              padding: "15px 22px",
              border: micLive
                ? "1px solid rgba(248,113,113,.75)"
                : "1px solid rgba(251,191,36,.55)",
              borderRadius: 14,
              cursor: busy ? "not-allowed" : "pointer",
              fontWeight: 900,
              fontSize: 16,
              background: micLive
                ? "rgba(220,38,38,.35)"
                : "rgba(245,158,11,.16)",
              color: micLive ? "#fecaca" : "#fde68a",
              opacity: busy ? 0.6 : 1,
            }}
          >
            {micLive
              ? "MIC LIVE - TURN OFF"
              : "GO LIVE MIC"}
          </button>
        )}

        {!live ? (
          <button
            type="button"
            onClick={goLive}
            disabled={busy}
            style={{
              minWidth: 190,
              padding:
                "15px 22px",
              border: 0,
              borderRadius: 14,
              cursor:
                busy
                  ? "not-allowed"
                  : "pointer",
              fontWeight: 900,
              fontSize: 16,
              background:
                "#dc2626",
              color: "#fff",
              opacity:
                busy
                  ? 0.6
                  : 1,
            }}
          >
            {busy
              ? "CONNECTING..."
              : " GO LIVE MIX"}
          </button>
        ) : (
          <button
            type="button"
            onClick={endLive}
            disabled={busy}
            style={{
              minWidth: 190,
              padding:
                "15px 22px",
              border:
                "1px solid rgba(255,255,255,.18)",
              borderRadius: 14,
              cursor:
                busy
                  ? "not-allowed"
                  : "pointer",
              fontWeight: 900,
              fontSize: 16,
              background:
                "#111827",
              color: "#fff",
              opacity:
                busy
                  ? 0.6
                  : 1,
            }}
          >
            {busy
              ? "ENDING..."
              : " END MIX"}
          </button>
        )}
      </div>
    </section>
  );
}









