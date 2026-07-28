"use client";

import Image from "next/image";
import {
  type AnimationEvent,
  type CSSProperties,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import styles from "./quest-1.module.css";
import { QUEST_ONE_BEAST_VISUAL_ASSETS } from "./quest-1-beast-visuals";

interface DynamicDefeatedSequenceProps {
  reducedMotion: boolean;
  shouldPlay: boolean;
}

const DEFEATED_SEQUENCE_DURATION_MS = 3000;
const DEFEATED_SEQUENCE_FALLBACK_DELAY_MS =
  DEFEATED_SEQUENCE_DURATION_MS + 100;

let defeatedSequencePlayedInSession = false;

const DEFEATED_SEQUENCE_FRAMES = [
  {
    id: "sealed",
    asset: QUEST_ONE_BEAST_VISUAL_ASSETS.sealed,
  },
  {
    id: "defeated-frame-1",
    asset: QUEST_ONE_BEAST_VISUAL_ASSETS["defeated-frame-1"],
  },
  {
    id: "defeated-frame-2",
    asset: QUEST_ONE_BEAST_VISUAL_ASSETS["defeated-frame-2"],
  },
  {
    id: "defeated",
    asset: QUEST_ONE_BEAST_VISUAL_ASSETS.defeated,
  },
] as const;

const defeatedSequenceStyle = {
  "--defeated-sequence-duration": `${DEFEATED_SEQUENCE_DURATION_MS}ms`,
} as CSSProperties;

export function DynamicDefeatedSequence({
  reducedMotion,
  shouldPlay,
}: DynamicDefeatedSequenceProps) {
  const [mayPlay] = useState(
    () =>
      shouldPlay &&
      !reducedMotion &&
      !defeatedSequencePlayedInSession,
  );
  const completionLockedRef = useRef(false);
  const [sequenceState, setSequenceState] = useState<{
    loadedFrames: ReadonlySet<string>;
    playbackState: "loading" | "playing" | "complete";
  }>(() => ({
    loadedFrames: new Set(),
    playbackState: mayPlay ? "loading" : "complete",
  }));
  const { playbackState } = sequenceState;

  const finishPlayback = useCallback(() => {
    if (completionLockedRef.current) return;

    completionLockedRef.current = true;
    defeatedSequencePlayedInSession = true;
    setSequenceState((current) => ({
      ...current,
      playbackState: "complete",
    }));
  }, []);

  useEffect(() => {
    if (!mayPlay) {
      defeatedSequencePlayedInSession = true;
    }
  }, [mayPlay]);

  useEffect(() => {
    if (playbackState !== "playing") return;

    const fallbackTimer = window.setTimeout(
      finishPlayback,
      DEFEATED_SEQUENCE_FALLBACK_DELAY_MS,
    );

    return () => window.clearTimeout(fallbackTimer);
  }, [finishPlayback, playbackState]);

  function markLoaded(src: string) {
    setSequenceState((current) => {
      if (current.loadedFrames.has(src)) return current;

      const next = new Set(current.loadedFrames);
      next.add(src);

      if (
        mayPlay &&
        current.playbackState === "loading" &&
        next.size === DEFEATED_SEQUENCE_FRAMES.length
      ) {
        defeatedSequencePlayedInSession = true;
        return {
          loadedFrames: next,
          playbackState: "playing",
        };
      }

      return {
        ...current,
        loadedFrames: next,
      };
    });
  }

  function handleAnimationEnd(event: AnimationEvent<HTMLDivElement>) {
    if (
      event.target === event.currentTarget &&
      playbackState === "playing"
    ) {
      finishPlayback();
    }
  }

  const frames =
    playbackState === "complete"
      ? DEFEATED_SEQUENCE_FRAMES.slice(-1)
      : DEFEATED_SEQUENCE_FRAMES;

  return (
    <div
      className={styles.defeatedSequenceStage}
      data-playback-state={playbackState}
      onAnimationEnd={handleAnimationEnd}
      role="img"
      aria-label="噬灵回环兽的递归回路被 CEI 封印，低伏进入受控战败状态"
      style={defeatedSequenceStyle}
    >
      <div className={styles.defeatedSequenceLayers} aria-hidden="true">
        {frames.map(({ id, asset }) => (
          <Image
            alt=""
            aria-hidden="true"
            className={styles.defeatedSequenceFrame}
            data-frame={id}
            height={asset.height}
            key={asset.src}
            loading="eager"
            onLoad={() => markLoaded(asset.src)}
            sizes="(max-width: 640px) 68vw, (max-width: 1023px) 38vw, 300px"
            src={asset.src}
            unoptimized
            width={asset.width}
          />
        ))}
      </div>

      {playbackState === "loading" ? (
        <p className={styles.defeatedSequenceLoading}>
          封印余波正在收束
        </p>
      ) : null}
    </div>
  );
}
