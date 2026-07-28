"use client";

import Image from "next/image";
import {
  type AnimationEvent,
  type CSSProperties,
  useEffect,
  useRef,
  useState,
} from "react";

import styles from "./quest-1.module.css";

export type BeastVisualState =
  | "dormant"
  | "attack"
  | "sealed"
  | "defeated";

export type DormantBeastMotion = "idle" | "awakening" | "static";

interface DormantBeastLoopProps {
  compact?: boolean;
  motion?: DormantBeastMotion;
  reducedMotion: boolean;
  visualState?: BeastVisualState;
}

const DORMANT_LOOP_DURATION_MS = 5910;
const DORMANT_BREATH_DURATION_MS = 7200;
const AWAKENING_INTRO_DURATION_MS = 3000;
const DORMANT_ALT = "水属性重入漏洞妖兽噬灵回环兽处于潜伏状态";
const MASTER_ALT = "水属性重入漏洞妖兽噬灵回环兽标准母体";

let awakeningIntroPlayedInSession = false;

const DORMANT_FRAMES = [
  {
    id: "dormant-1",
    src: "/assets/quest-1/beast/reentry-devourer-dormant-1.webp",
    width: 1448,
    height: 1086,
  },
  {
    id: "dormant-2",
    src: "/assets/quest-1/beast/reentry-devourer-dormant-2.webp",
    width: 1448,
    height: 1086,
  },
  {
    id: "dormant-3",
    src: "/assets/quest-1/beast/reentry-devourer-dormant-3.webp",
    width: 1448,
    height: 1086,
  },
] as const;

const MASTER_FRAME = {
  id: "master",
  src: "/assets/quest-1/beast/reentry-devourer-master.webp",
  width: 1122,
  height: 1402,
} as const;

type DormantLoopStyle = CSSProperties & {
  "--awakening-intro-duration": string;
  "--dormant-breath-duration": string;
  "--dormant-loop-duration": string;
};

export function DormantBeastLoop({
  compact = false,
  motion = "idle",
  reducedMotion,
  visualState = "dormant",
}: DormantBeastLoopProps) {
  const [loadedFrames, setLoadedFrames] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [failedFrames, setFailedFrames] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [awakeningState, setAwakeningState] = useState<
    "idle" | "playing" | "complete"
  >(() =>
    motion === "awakening" &&
    (reducedMotion || awakeningIntroPlayedInSession)
      ? "complete"
      : "idle",
  );
  const awakeningStartedRef = useRef(false);

  const isDormant = visualState === "dormant";
  const isAwakening = isDormant && motion === "awakening";
  const effectiveAwakeningState = reducedMotion
    ? "complete"
    : awakeningState;
  const usesStaticDormantFrame =
    isDormant &&
    (motion === "static" ||
      (isAwakening && effectiveAwakeningState === "complete"));
  const frames = !isDormant
    ? [MASTER_FRAME]
    : usesStaticDormantFrame
      ? [DORMANT_FRAMES[1]]
      : motion === "idle"
        ? reducedMotion
          ? DORMANT_FRAMES.slice(0, 1)
          : DORMANT_FRAMES
        : DORMANT_FRAMES.slice(0, 2);
  const primaryFrame = frames[0];
  const primaryLoaded = loadedFrames.has(primaryFrame.src);
  const allFramesLoaded = frames.every((frame) =>
    loadedFrames.has(frame.src),
  );
  const hasFailedFrame = frames.some((frame) =>
    failedFrames.has(frame.src),
  );
  const loopActive =
    isDormant &&
    motion === "idle" &&
    !reducedMotion &&
    allFramesLoaded &&
    !hasFailedFrame;
  const accessibleLabel = isDormant ? DORMANT_ALT : MASTER_ALT;
  const loopStyle = {
    "--awakening-intro-duration": `${AWAKENING_INTRO_DURATION_MS}ms`,
    "--dormant-breath-duration": `${DORMANT_BREATH_DURATION_MS}ms`,
    "--dormant-loop-duration": `${DORMANT_LOOP_DURATION_MS}ms`,
  } as DormantLoopStyle;

  useEffect(() => {
    if (
      !isAwakening ||
      reducedMotion ||
      awakeningState !== "idle" ||
      !allFramesLoaded ||
      hasFailedFrame ||
      awakeningStartedRef.current ||
      awakeningIntroPlayedInSession
    ) {
      return;
    }

    awakeningStartedRef.current = true;
    awakeningIntroPlayedInSession = true;
    setAwakeningState("playing");
  }, [
    allFramesLoaded,
    awakeningState,
    hasFailedFrame,
    isAwakening,
    reducedMotion,
  ]);

  function markLoaded(src: string) {
    setLoadedFrames((current) => {
      if (current.has(src)) return current;
      const next = new Set(current);
      next.add(src);
      return next;
    });
  }

  function markFailed(src: string) {
    setFailedFrames((current) => {
      if (current.has(src)) return current;
      const next = new Set(current);
      next.add(src);
      return next;
    });
  }

  function handleAwakeningAnimationEnd(event: AnimationEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;

    if (
      awakeningState === "playing" &&
      target.dataset.frame === "dormant-2" &&
      event.animationName.endsWith("beast-awakening-frame-two")
    ) {
      setAwakeningState("complete");
    }
  }

  return (
    <div
      className={`${styles.dormantBeastLoop} ${
        compact ? styles.dormantBeastLoopCompact : ""
      }`}
      data-loop-active={loopActive ? "true" : "false"}
      data-awakening-state={
        isAwakening ? effectiveAwakeningState : "none"
      }
      data-dormant-motion={isDormant ? motion : "fallback"}
      data-primary-loaded={primaryLoaded ? "true" : "false"}
      data-visual-state={isDormant ? "dormant" : "fallback-master"}
      role="img"
      aria-label={accessibleLabel}
      style={loopStyle}
    >
      <div
        className={styles.dormantBeastLayers}
        aria-hidden="true"
        onAnimationEnd={handleAwakeningAnimationEnd}
      >
        {frames.map((frame, index) => (
          <Image
            alt=""
            aria-hidden="true"
            className={`${styles.dormantBeastFrame} ${
              index === 0 ? styles.dormantBeastFramePrimary : ""
            }`}
            data-frame={frame.id}
            fetchPriority={index === 0 ? "high" : "auto"}
            height={frame.height}
            key={frame.src}
            loading="eager"
            onError={() => markFailed(frame.src)}
            onLoad={() => markLoaded(frame.src)}
            sizes={
              compact
                ? "(max-width: 1023px) 72vw, 32vw"
                : "(max-width: 767px) 100vw, 72vw"
            }
            src={frame.src}
            unoptimized
            width={frame.width}
          />
        ))}
        {isAwakening && effectiveAwakeningState === "playing" ? (
          <span className={styles.dormantAwakeningGlow} />
        ) : null}
      </div>

      {!primaryLoaded ? (
        <p className={styles.dormantBeastLoading}>
          {hasFailedFrame ? "妖兽图像暂未载入" : "妖兽灵息正在显现"}
        </p>
      ) : null}
    </div>
  );
}
