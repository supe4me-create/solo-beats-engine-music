"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { usePlayer } from "./usePlayer";
function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "0:00";
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);

  return `${minutes}:${remainingSeconds
    .toString()
    .padStart(2, "0")}`;
}

export default function GlobalPlayer() {
  const {
    currentTrack,
    queue,
    currentIndex,
    isPlaying,
    isShuffleOn,
    repeatMode,
    volume,
    isMuted,
    currentTime,
    duration,
    togglePlay,
    playNext,
    playPrevious,
    playQueue,
    toggleShuffle,
    cycleRepeatMode,
    seekTo,
    setPlayerVolume,
    toggleMute,
    clearQueue,
  } = usePlayer();

  const [isExpanded, setIsExpanded] = useState(false);
  const [isQueueOpen, setIsQueueOpen] = useState(false);

  const progressPercent = useMemo(() => {
    if (!duration || duration <= 0) {
      return 0;
    }

    return Math.min(
      Math.max((currentTime / duration) * 100, 0),
      100
    );
  }, [currentTime, duration]);

  const previewLimitReached =
    Boolean(
      currentTrack?.previewLimitSeconds &&
        currentTime >=
          currentTrack.previewLimitSeconds -
            0.1
    );

  const showPremiumPrompt =
    Boolean(
      currentTrack?.requiresPremium ||
        previewLimitReached
    );

  if (!currentTrack) {
    return null;
  }

  const repeatLabel =
    repeatMode === "one"
      ? "Repeat One"
      : repeatMode === "all"
        ? "Repeat All"
        : "Repeat Off";

  return (
    <>
      {showPremiumPrompt && (
        <div
          className="premium-preview-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Subscribe to SOLO BEATS PREMIUM"
        >
          <div className="premium-preview-card">
            <button
              type="button"
              className="premium-preview-close"
              onClick={clearQueue}
              aria-label="Close subscription prompt"
            >
              ✕
            </button>

            <p className="premium-preview-kicker">
              FREE PREVIEW COMPLETE
            </p>

            <h2>
              Keep Listening with SOLO BEATS PREMIUM
            </h2>

            <p className="premium-preview-copy">
              You received three free song previews and
              a 60-second preview of Track 4. Subscribe
              to unlock full albums, Premium Radio,
              Premium TV, early releases, and monthly
              downloads.
            </p>

            <div className="premium-preview-actions">
              <Link
                href="/premium"
                className="premium-preview-primary"
                onClick={clearQueue}
              >
                Subscribe to Premium
              </Link>

              <Link
                href="/premium"
                className="premium-preview-secondary"
                onClick={clearQueue}
              >
                View Premium Benefits
              </Link>
            </div>
          </div>
        </div>
      )}

      {isExpanded && (
        <div className="player-expanded">
          <button
            type="button"
            className="expanded-close"
            onClick={() => setIsExpanded(false)}
            aria-label="Close expanded player"
          >
            ✕
          </button>

          <div className="expanded-content">
            <img
              src={currentTrack.cover}
              alt={`${currentTrack.albumTitle} cover`}
              className="expanded-cover"
            />

            <div className="expanded-details">
              <p className="expanded-label">NOW PLAYING</p>

              <h2>{currentTrack.title}</h2>

              <p className="expanded-artist">
                {currentTrack.artist}
              </p>

              <p className="expanded-album">
                {currentTrack.albumTitle}
              </p>

              <div className="expanded-progress">
                <input
                  type="range"
                  min={0}
                  max={duration || 0}
                  step={0.1}
                  value={Math.min(currentTime, duration || 0)}
                  onChange={(event) =>
                    seekTo(Number(event.target.value))
                  }
                  aria-label="Track progress"
                  aria-valuetext={`${formatTime(currentTime)} of ${formatTime(duration)}`}
                />

                <div className="expanded-time">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              <div className="expanded-controls">
                <button
                  type="button"
                  className={
                    isShuffleOn
                      ? "control-button active"
                      : "control-button"
                  }
                  onClick={toggleShuffle}
                  aria-label="Toggle shuffle"
                  title={
                    isShuffleOn
                      ? "Shuffle On"
                      : "Shuffle Off"
                  }
                >
                  🔀
                </button>

                <button
                  type="button"
                  className="control-button"
                  onClick={playPrevious}
                  aria-label="Previous track"
                >
                  ⏮
                </button>

                <button
                  type="button"
                  className="main-play-button"
                  onClick={togglePlay}
                  aria-label={
                    isPlaying ? "Pause" : "Play"
                  }
                >
                  {isPlaying ? "⏸" : "▶"}
                </button>

                <button
                  type="button"
                  className="control-button"
                  onClick={playNext}
                  aria-label="Next track"
                >
                  ⏭
                </button>

                <button
                  type="button"
                  className={
                    repeatMode !== "off"
                      ? "control-button active"
                      : "control-button"
                  }
                  onClick={cycleRepeatMode}
                  aria-label={repeatLabel}
                  title={repeatLabel}
                >
                  {repeatMode === "one" ? "🔂" : "🔁"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isQueueOpen && (
        <div className="queue-panel">
          <div className="queue-header">
            <div>
              <p>UP NEXT</p>
              <h3>Playback Queue</h3>
            </div>

            <button
              type="button"
              onClick={() => setIsQueueOpen(false)}
              aria-label="Close queue"
            >
              ✕
            </button>
          </div>

          <div className="queue-list">
            {queue.map((track, index) => (
              <button
                type="button"
                key={`${track.id}-${index}`}
                className={
                  index === currentIndex
                    ? "queue-item current"
                    : "queue-item"
                }
                onClick={() => playQueue(queue, index)}
                aria-label={`Play ${track.title}`}
              >
                <img
                  src={track.cover}
                  alt=""
                  className="queue-cover"
                />

                <div className="queue-details">
                  <strong>{track.title}</strong>
                  <span>
                    {track.artist} · {track.albumTitle}
                  </span>
                </div>

                <span className="queue-number">
                  {index === currentIndex
                    ? isPlaying
                      ? "Playing"
                      : "Paused"
                    : index + 1}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <section className="global-player">
        <div
          className="progress-background"
          aria-hidden="true"
        >
          <div
            className="progress-filled"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <div className="track-information">
          <button
            type="button"
            className="cover-button"
            onClick={() => setIsExpanded(true)}
            aria-label="Open full player"
          >
            <img
              src={currentTrack.cover}
              alt={`${currentTrack.albumTitle} cover`}
              className="player-cover"
            />
          </button>

          <div className="track-text">
            <span className="compact-label">NOW PLAYING</span>
            <strong>{currentTrack.title}</strong>
            <span>{currentTrack.artist}</span>
            <small>{currentTrack.albumTitle}</small>
          </div>
        </div>

        <div className="main-controls">
          <div className="button-row">
            <button
              type="button"
              className={
                isShuffleOn
                  ? "icon-button active"
                  : "icon-button"
              }
              onClick={toggleShuffle}
              aria-label="Toggle shuffle"
              title={
                isShuffleOn
                  ? "Shuffle On"
                  : "Shuffle Off"
              }
            >
              🔀
            </button>

            <button
              type="button"
              className="icon-button"
              onClick={playPrevious}
              aria-label="Previous track"
              title="Previous"
            >
              ⏮
            </button>

            <button
              type="button"
              className="play-button"
              onClick={togglePlay}
              aria-label={isPlaying ? "Pause" : "Play"}
              title={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? "⏸" : "▶"}
            </button>

            <button
              type="button"
              className="icon-button"
              onClick={playNext}
              aria-label="Next track"
              title="Next"
            >
              ⏭
            </button>

            <button
              type="button"
              className={
                repeatMode !== "off"
                  ? "icon-button active"
                  : "icon-button"
              }
              onClick={cycleRepeatMode}
              aria-label={repeatLabel}
              title={repeatLabel}
            >
              {repeatMode === "one" ? "🔂" : "🔁"}
            </button>
          </div>

          <div className="seek-row">
            <span>{formatTime(currentTime)}</span>

            <input
              type="range"
              min={0}
              max={duration || 0}
              step={0.1}
              value={Math.min(currentTime, duration || 0)}
              onChange={(event) =>
                seekTo(Number(event.target.value))
              }
              aria-label="Track progress"
              aria-valuetext={`${formatTime(currentTime)} of ${formatTime(duration)}`}
            />

            <span>{formatTime(duration)}</span>
          </div>
        </div>

        <div className="secondary-controls">
          <button
            type="button"
            className="queue-button"
            onClick={() =>
              setIsQueueOpen((previous) => !previous)
            }
            aria-label="Open playback queue"
            title="Queue"
          >
            ☰
            <span>{queue.length}</span>
          </button>

          <button
            type="button"
            className="icon-button"
            onClick={toggleMute}
            aria-label={isMuted ? "Unmute" : "Mute"}
            title={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted || volume === 0 ? "🔇" : "🔊"}
          </button>

          <input
            className="volume-slider"
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={isMuted ? 0 : volume}
            onChange={(event) =>
              setPlayerVolume(Number(event.target.value))
            }
            aria-label="Volume"
          />

          <button
            type="button"
            className="expand-button"
            onClick={() => setIsExpanded(true)}
            aria-label="Open full player"
            title="Full Player"
          >
            ⛶
          </button>

          <button
            type="button"
            className="close-player-button"
            onClick={clearQueue}
            aria-label="Close player"
            title="Close Player"
          >
            ✕
          </button>
        </div>
      </section>

      <style jsx>{`
        .global-player {
          position: fixed;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 1000;
          min-height: 104px;
          display: grid;
          grid-template-columns:
            minmax(220px, 1fr)
            minmax(340px, 1.5fr)
            minmax(220px, 1fr);
          align-items: center;
          gap: 20px;
          padding: 14px 24px;
          color: white;
          background:
            linear-gradient(
              135deg,
              rgba(16, 7, 33, 0.98),
              rgba(4, 4, 12, 0.99)
            );
          border-top: 1px solid rgba(168, 85, 247, 0.5);
          box-shadow:
            0 -12px 50px rgba(0, 0, 0, 0.55),
            0 -2px 18px rgba(168, 85, 247, 0.16);
          backdrop-filter: blur(22px);
        }

        .progress-background {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: rgba(255, 255, 255, 0.12);
        }

        .progress-filled {
          height: 100%;
          background: linear-gradient(
            90deg,
            #7c3aed,
            #d946ef,
            #22d3ee
          );
          box-shadow: 0 0 14px rgba(217, 70, 239, 0.8);
          transition: width 0.1s linear;
        }

        .track-information {
          min-width: 0;
          display: flex;
          align-items: center;
          gap: 13px;
        }

        .cover-button {
          width: 70px;
          height: 70px;
          flex: 0 0 70px;
          padding: 0;
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.18);
          border-radius: 13px;
          background: transparent;
          cursor: pointer;
          box-shadow:
            0 8px 24px rgba(0, 0, 0, 0.45),
            0 0 20px rgba(124, 58, 237, 0.25);
        }

        .player-cover {
          width: 100%;
          height: 100%;
          display: block;
          object-fit: cover;
        }

        .track-text {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .compact-label {
          color: #e879f9 !important;
          font-size: 9px !important;
          font-weight: 900;
          letter-spacing: 0.16em;
        }

        .track-text strong,
        .track-text span,
        .track-text small {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .track-text strong {
          font-size: 15px;
          color: #ffffff;
        }

        .track-text span {
          font-size: 13px;
          color: #d8b4fe;
        }

        .track-text small {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.58);
        }

        .main-controls {
          min-width: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 9px;
        }

        .button-row {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 16px;
        }

        button {
          font: inherit;
        }

        button:focus-visible,
        input[type="range"]:focus-visible {
          outline: 2px solid #e879f9;
          outline-offset: 3px;
        }

        .icon-button,
        .expand-button,
        .close-player-button,
        .queue-button {
          border: none;
          color: rgba(255, 255, 255, 0.75);
          background: transparent;
          cursor: pointer;
          transition:
            color 0.2s ease,
            transform 0.2s ease,
            background 0.2s ease;
        }

        .icon-button {
          width: 34px;
          height: 34px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          font-size: 17px;
        }

        .icon-button:hover,
        .expand-button:hover,
        .queue-button:hover {
          color: white;
          transform: translateY(-1px);
        }

        .icon-button.active {
          color: #d946ef;
          background: rgba(217, 70, 239, 0.12);
          box-shadow: 0 0 16px rgba(217, 70, 239, 0.2);
        }

        .play-button {
          width: 48px;
          height: 48px;
          display: grid;
          place-items: center;
          padding-left: 3px;
          border: none;
          border-radius: 50%;
          color: white;
          background: linear-gradient(135deg, #7c3aed, #d946ef);
          cursor: pointer;
          box-shadow:
            0 8px 24px rgba(124, 58, 237, 0.38),
            0 0 22px rgba(217, 70, 239, 0.28);
          transition:
            transform 0.2s ease,
            box-shadow 0.2s ease;
        }

        .play-button:hover {
          transform: scale(1.06);
          box-shadow:
            0 10px 30px rgba(124, 58, 237, 0.5),
            0 0 28px rgba(217, 70, 239, 0.38);
        }

        .seek-row {
          width: 100%;
          display: grid;
          grid-template-columns: 42px 1fr 42px;
          align-items: center;
          gap: 9px;
        }

        .seek-row span {
          font-size: 10px;
          color: rgba(255, 255, 255, 0.56);
          text-align: center;
        }

        input[type="range"] {
          width: 100%;
          height: 4px;
          accent-color: #d946ef;
          cursor: pointer;
        }

        .secondary-controls {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 9px;
        }

        .queue-button {
          position: relative;
          width: 38px;
          height: 38px;
          display: grid;
          place-items: center;
          border-radius: 10px;
          font-size: 18px;
        }

        .queue-button span {
          position: absolute;
          top: 0;
          right: 0;
          min-width: 16px;
          height: 16px;
          display: grid;
          place-items: center;
          padding: 0 4px;
          border-radius: 999px;
          color: white;
          background: #d946ef;
          font-size: 9px;
          font-weight: 800;
        }

        .volume-slider {
          width: 88px !important;
        }

        .expand-button,
        .close-player-button {
          width: 35px;
          height: 35px;
          display: grid;
          place-items: center;
          border-radius: 9px;
          font-size: 17px;
        }

        .close-player-button:hover {
          color: #fca5a5;
          background: rgba(239, 68, 68, 0.12);
        }

        .player-expanded {
          position: fixed;
          inset: 0;
          z-index: 1200;
          display: grid;
          place-items: center;
          padding: 28px;
          color: white;
          background:
            radial-gradient(
              circle at top,
              rgba(124, 58, 237, 0.35),
              transparent 48%
            ),
            linear-gradient(
              145deg,
              rgba(7, 4, 18, 0.98),
              rgba(1, 1, 7, 0.995)
            );
          backdrop-filter: blur(28px);
        }

        .expanded-close {
          position: absolute;
          top: 24px;
          right: 28px;
          width: 42px;
          height: 42px;
          display: grid;
          place-items: center;
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 50%;
          color: white;
          background: rgba(255, 255, 255, 0.06);
          cursor: pointer;
        }

        .expanded-content {
          width: min(960px, 100%);
          display: grid;
          grid-template-columns: minmax(280px, 440px) 1fr;
          align-items: center;
          gap: clamp(34px, 7vw, 90px);
        }

        .expanded-cover {
          width: 100%;
          aspect-ratio: 1;
          object-fit: cover;
          border-radius: 26px;
          box-shadow:
            0 35px 90px rgba(0, 0, 0, 0.58),
            0 0 55px rgba(168, 85, 247, 0.26);
        }

        .expanded-details h2 {
          margin: 0;
          font-size: clamp(34px, 5vw, 64px);
          line-height: 1.03;
        }

        .expanded-label {
          margin-bottom: 15px;
          color: #d946ef;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.22em;
        }

        .expanded-artist {
          margin: 18px 0 5px;
          color: #d8b4fe;
          font-size: 20px;
          font-weight: 700;
        }

        .expanded-album {
          margin: 0;
          color: rgba(255, 255, 255, 0.58);
        }

        .expanded-progress {
          margin-top: 36px;
        }

        .expanded-time {
          display: flex;
          justify-content: space-between;
          margin-top: 8px;
          color: rgba(255, 255, 255, 0.52);
          font-size: 12px;
        }

        .expanded-controls {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 20px;
          margin-top: 28px;
        }

        .control-button {
          width: 46px;
          height: 46px;
          display: grid;
          place-items: center;
          border: none;
          border-radius: 50%;
          color: rgba(255, 255, 255, 0.75);
          background: rgba(255, 255, 255, 0.06);
          cursor: pointer;
        }

        .control-button.active {
          color: #f0abfc;
          background: rgba(217, 70, 239, 0.16);
        }

        .main-play-button {
          width: 74px;
          height: 74px;
          display: grid;
          place-items: center;
          padding-left: 4px;
          border: none;
          border-radius: 50%;
          color: white;
          background: linear-gradient(135deg, #7c3aed, #d946ef);
          cursor: pointer;
          font-size: 25px;
          box-shadow:
            0 14px 40px rgba(124, 58, 237, 0.42),
            0 0 35px rgba(217, 70, 239, 0.32);
        }

        .queue-panel {
          position: fixed;
          right: 18px;
          bottom: 122px;
          z-index: 1100;
          width: min(410px, calc(100vw - 36px));
          max-height: min(560px, calc(100vh - 160px));
          overflow: hidden;
          color: white;
          background: rgba(10, 6, 22, 0.98);
          border: 1px solid rgba(168, 85, 247, 0.34);
          border-radius: 20px;
          box-shadow: 0 28px 80px rgba(0, 0, 0, 0.58);
          backdrop-filter: blur(22px);
        }

        .queue-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 18px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        .premium-preview-overlay {
          position: fixed;
          inset: 0;
          z-index: 10000;
          display: grid;
          place-items: center;
          padding: 20px;
          background: rgba(2, 2, 10, 0.82);
          backdrop-filter: blur(16px);
        }

        .premium-preview-card {
          position: relative;
          width: min(660px, 100%);
          overflow: hidden;
          border: 1px solid rgba(217, 70, 239, 0.42);
          border-radius: 30px;
          padding: 42px;
          background:
            radial-gradient(circle at top left, rgba(217, 70, 239, 0.3), transparent 42%),
            radial-gradient(circle at bottom right, rgba(34, 211, 238, 0.22), transparent 38%),
            #070711;
          box-shadow:
            0 0 45px rgba(217, 70, 239, 0.24),
            0 28px 90px rgba(0, 0, 0, 0.62);
          color: white;
          text-align: center;
        }

        .premium-preview-close {
          position: absolute;
          top: 16px;
          right: 16px;
          width: 38px;
          height: 38px;
          border: 1px solid rgba(255, 255, 255, 0.14);
          border-radius: 50%;
          color: white;
          background: rgba(255, 255, 255, 0.08);
          cursor: pointer;
        }

        .premium-preview-kicker {
          margin: 0;
          color: #67e8f9;
          font-size: 12px;
          font-weight: 900;
          letter-spacing: 0.22em;
        }

        .premium-preview-card h2 {
          margin: 16px 0 0;
          font-size: clamp(32px, 6vw, 52px);
          line-height: 1.02;
        }

        .premium-preview-copy {
          max-width: 560px;
          margin: 20px auto 0;
          color: rgba(255, 255, 255, 0.72);
          font-size: 16px;
          line-height: 1.7;
        }

        .premium-preview-actions {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 12px;
          margin-top: 28px;
        }

        .premium-preview-primary,
        .premium-preview-secondary {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 210px;
          border-radius: 16px;
          padding: 15px 22px;
          font-weight: 900;
          text-decoration: none;
          transition:
            transform 0.18s ease,
            filter 0.18s ease;
        }

        .premium-preview-primary {
          color: #050510;
          background: linear-gradient(135deg, #67e8f9, #d946ef);
          box-shadow: 0 0 28px rgba(217, 70, 239, 0.3);
        }

        .premium-preview-secondary {
          border: 1px solid rgba(255, 255, 255, 0.18);
          color: white;
          background: rgba(255, 255, 255, 0.07);
        }

        .premium-preview-primary:hover,
        .premium-preview-secondary:hover {
          transform: translateY(-2px);
          filter: brightness(1.08);
        }

        .queue-header p,
        .queue-header h3 {
          margin: 0;
        }

        .queue-header p {
          color: #d946ef;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.18em;
        }

        .queue-header h3 {
          margin-top: 3px;
          font-size: 18px;
        }

        .queue-header button {
          width: 34px;
          height: 34px;
          border: none;
          border-radius: 50%;
          color: white;
          background: rgba(255, 255, 255, 0.07);
          cursor: pointer;
        }

        .queue-list {
          max-height: 470px;
          overflow-y: auto;
          padding: 8px;
        }

        .queue-item {
          width: 100%;
          display: grid;
          grid-template-columns: 48px 1fr auto;
          align-items: center;
          gap: 11px;
          padding: 9px;
          border: none;
          border-radius: 12px;
          color: white;
          background: transparent;
          text-align: left;
          cursor: pointer;
          transition:
            background 0.2s ease,
            transform 0.2s ease;
        }

        .queue-item:hover {
          background: rgba(255, 255, 255, 0.06);
          transform: translateX(2px);
        }

        .queue-item.current {
          background: rgba(168, 85, 247, 0.15);
        }

        .queue-cover {
          width: 48px;
          height: 48px;
          object-fit: cover;
          border-radius: 8px;
        }

        .queue-details {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .queue-details strong,
        .queue-details span {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .queue-details strong {
          font-size: 13px;
        }

        .queue-details span {
          color: rgba(255, 255, 255, 0.54);
          font-size: 10px;
        }

        .queue-number {
          color: #d8b4fe;
          font-size: 10px;
          font-weight: 700;
        }

        @media (max-width: 900px) {
          .global-player {
            grid-template-columns: 1fr auto;
            min-height: 118px;
            padding: 12px 16px;
          }

          .track-information {
            grid-column: 1;
          }

          .main-controls {
            grid-column: 1 / -1;
            grid-row: 2;
          }

          .secondary-controls {
            grid-column: 2;
            grid-row: 1;
          }

          .volume-slider,
          .secondary-controls > .icon-button {
            display: none;
          }

          .seek-row {
            width: min(620px, 100%);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .progress-filled,
          .icon-button,
          .play-button,
          .queue-item,
          .cover-button {
            transition: none;
          }
        }

        @media (max-width: 620px) {
          .premium-preview-card {
            padding: 38px 20px 24px;
            border-radius: 24px;
          }

          .premium-preview-actions {
            display: grid;
          }

          .premium-preview-primary,
          .premium-preview-secondary {
            width: 100%;
            min-width: 0;
          }

          .global-player {
            min-height: 128px;
            gap: 9px;
            padding: 10px 12px;
          }

          .cover-button {
            width: 54px;
            height: 54px;
            flex-basis: 54px;
            border-radius: 9px;
          }

          .track-text strong {
            font-size: 13px;
          }

          .track-text span {
            font-size: 11px;
          }

          .track-text small,
          .compact-label {
            display: none;
          }

          .button-row {
            gap: 9px;
          }

          .icon-button {
            width: 30px;
            height: 30px;
            font-size: 14px;
          }

          .play-button {
            width: 42px;
            height: 42px;
          }

          .expand-button,
          .close-player-button {
            display: none;
          }

          .seek-row {
            grid-template-columns: 35px 1fr 35px;
            gap: 5px;
          }

          .expanded-content {
            grid-template-columns: 1fr;
            gap: 28px;
            text-align: center;
          }

          .expanded-cover {
            width: min(310px, 78vw);
            margin: 0 auto;
            border-radius: 20px;
          }

          .expanded-details h2 {
            font-size: 34px;
          }

          .expanded-artist {
            margin-top: 12px;
          }

          .expanded-progress {
            margin-top: 24px;
          }

          .expanded-controls {
            gap: 10px;
          }

          .control-button {
            width: 40px;
            height: 40px;
          }

          .main-play-button {
            width: 62px;
            height: 62px;
          }

          .queue-panel {
            right: 10px;
            bottom: 140px;
            width: calc(100vw - 20px);
          }
        }
      `}</style>
    </>
  );
}