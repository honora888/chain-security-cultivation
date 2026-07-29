"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

import { JadeActionButton } from "./JadeActionButton";
import styles from "./quest-1.module.css";

const ENTRY_VIDEO = "/assets/quest-1/video/quest-1-entry-reveal.mp4";
const ENTRY_LOADING_POSTER =
  "/assets/quest-1/video/quest-1-entry-loading-poster.webp";
const ENTRY_COMPLETE_POSTER =
  "/assets/quest-1/video/quest-1-entry-poster.webp";

type MotionPreference = "pending" | "full" | "reduce";
type PlaybackState = "loading" | "playing" | "paused" | "ended";

export function QuestEntryVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const autoPlayAttemptedRef = useRef(false);
  const [motionPreference, setMotionPreference] =
    useState<MotionPreference>("pending");
  const [playbackState, setPlaybackState] =
    useState<PlaybackState>("loading");
  const [hasPlaybackStarted, setHasPlaybackStarted] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncPreference = () => {
      setMotionPreference(mediaQuery.matches ? "reduce" : "full");
    };

    syncPreference();
    mediaQuery.addEventListener("change", syncPreference);

    return () => mediaQuery.removeEventListener("change", syncPreference);
  }, []);

  useEffect(() => {
    const video = videoRef.current;

    if (
      !video ||
      videoFailed ||
      motionPreference !== "full" ||
      autoPlayAttemptedRef.current
    ) {
      return;
    }

    autoPlayAttemptedRef.current = true;
    void video.play().catch(() => setPlaybackState("paused"));
  }, [motionPreference, videoFailed]);

  const handleVideoToggle = async () => {
    const video = videoRef.current;

    if (!video || videoFailed) return;

    if (playbackState === "playing") {
      video.pause();
      return;
    }

    if (playbackState === "ended") {
      video.currentTime = 0;
    }

    try {
      await video.play();
    } catch {
      setPlaybackState("paused");
    }
  };

  const controlLabel =
    playbackState === "playing"
      ? "暂停封印影像"
      : playbackState === "ended"
        ? "重播封印影像"
        : hasPlaybackStarted
          ? "继续封印影像"
          : "播放封印影像";

  const statusLabel = videoFailed
    ? "封印影像暂不可用，已显示完整形态"
    : motionPreference === "reduce" && playbackState !== "playing"
      ? "减少动态：静态完整形态"
      : playbackState === "playing"
        ? "封印影像播放中"
        : playbackState === "ended"
          ? "封印影像播放完毕"
          : playbackState === "paused"
            ? "封印影像已暂停"
            : "封印影像准备中";

  return (
    <figure
      className={styles.entryVideoStage}
      data-playback={playbackState}
      data-reduced-motion={motionPreference === "reduce" ? "true" : "false"}
    >
      <div className={styles.entryVideoViewport}>
        {videoFailed ? (
          <Image
            className={styles.entryVideoFallback}
            src={ENTRY_COMPLETE_POSTER}
            alt="噬灵回环兽盘踞于水系封印之中"
            fill
            sizes="(max-width: 640px) 100vw, 720px"
            unoptimized
          />
        ) : (
          <video
            ref={videoRef}
            className={styles.entryVideo}
            src={ENTRY_VIDEO}
            poster={
              motionPreference === "reduce"
                ? ENTRY_COMPLETE_POSTER
                : ENTRY_LOADING_POSTER
            }
            muted
            playsInline
            preload="metadata"
            onCanPlay={() => {
              if (playbackState === "loading") setPlaybackState("paused");
            }}
            onEnded={() => setPlaybackState("ended")}
            onError={() => setVideoFailed(true)}
            onPause={() => {
              if (!videoRef.current?.ended) setPlaybackState("paused");
            }}
            onPlay={() => {
              setHasPlaybackStarted(true);
              setPlaybackState("playing");
            }}
          />
        )}
      </div>

      <figcaption className={styles.entryVideoCaption}>
        <div>
          <span>封印影像 · 妖气苏醒</span>
          <small aria-live="polite">{statusLabel}</small>
        </div>

        {videoFailed ? (
          <span className={styles.entryVideoUnavailable}>静态记录</span>
        ) : (
          <JadeActionButton
            className={styles.entryVideoControl}
            type="button"
            variant="secondary"
            aria-label={controlLabel}
            onClick={handleVideoToggle}
          >
            {playbackState === "playing"
              ? "暂停"
              : playbackState === "ended"
                ? "重播"
                : hasPlaybackStarted
                  ? "继续"
                  : "播放"}
          </JadeActionButton>
        )}
      </figcaption>
    </figure>
  );
}
