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
import {
  QUEST_ONE_REWARD_VISUAL_ASSETS,
  type QuestOneRewardVisualState,
} from "./quest-1-reward-visuals";

interface WaterGuardianBadgeProps {
  reducedMotion: boolean;
  revealDelayMs?: number;
  shouldAnimate?: boolean;
  state: QuestOneRewardVisualState;
}

const BADGE_UNLOCK_DURATION_MS = 1700;
const BADGE_UNLOCK_FALLBACK_DELAY_MS = BADGE_UNLOCK_DURATION_MS + 100;

let badgeUnlockPlayedInSession = false;

const badgeUnlockStyle = {
  "--badge-unlock-duration": `${BADGE_UNLOCK_DURATION_MS}ms`,
} as CSSProperties;

export function WaterGuardianBadge({
  reducedMotion,
  revealDelayMs = 0,
  shouldAnimate = false,
  state,
}: WaterGuardianBadgeProps) {
  const [mayAnimate] = useState(
    () =>
      state === "unlocked" &&
      shouldAnimate &&
      !reducedMotion &&
      !badgeUnlockPlayedInSession,
  );
  const completionLockedRef = useRef(false);
  const [animationState, setAnimationState] = useState<
    "waiting" | "playing" | "complete"
  >(() => (mayAnimate ? "waiting" : "complete"));

  const finishAnimation = useCallback(() => {
    if (completionLockedRef.current) return;

    completionLockedRef.current = true;
    badgeUnlockPlayedInSession = true;
    setAnimationState("complete");
  }, []);

  useEffect(() => {
    if (!mayAnimate) {
      badgeUnlockPlayedInSession = true;
      return;
    }

    const startTimer = window.setTimeout(() => {
      badgeUnlockPlayedInSession = true;
      setAnimationState("playing");
    }, revealDelayMs);

    return () => window.clearTimeout(startTimer);
  }, [mayAnimate, revealDelayMs]);

  useEffect(() => {
    if (animationState !== "playing") return;

    const fallbackTimer = window.setTimeout(
      finishAnimation,
      BADGE_UNLOCK_FALLBACK_DELAY_MS,
    );

    return () => window.clearTimeout(fallbackTimer);
  }, [animationState, finishAnimation]);

  function handleAnimationEnd(event: AnimationEvent<HTMLDivElement>) {
    if (
      event.target === event.currentTarget &&
      animationState === "playing"
    ) {
      finishAnimation();
    }
  }

  const showUnlocked = state === "unlocked";
  const showColorBadge = showUnlocked && animationState !== "waiting";
  const unlockedAsset = QUEST_ONE_REWARD_VISUAL_ASSETS.unlocked;
  const lockedAsset = QUEST_ONE_REWARD_VISUAL_ASSETS.locked;

  return (
    <div
      className={styles.waterGuardianBadge}
      data-animation-state={animationState}
      data-reward-state={state}
      onAnimationEnd={handleAnimationEnd}
      role="img"
      aria-label={
        showUnlocked
          ? "本地奖励展示：水系守护者徽记，不代表 Monad 链上凭证"
          : "水系守护者徽记尚未获得"
      }
      style={badgeUnlockStyle}
    >
      <Image
        alt=""
        aria-hidden="true"
        className={styles.waterGuardianBadgeSilhouette}
        height={lockedAsset.height}
        loading="eager"
        sizes="96px"
        src={lockedAsset.src}
        unoptimized
        width={lockedAsset.width}
      />
      {showColorBadge ? (
        <Image
          alt=""
          aria-hidden="true"
          className={styles.waterGuardianBadgeColor}
          height={unlockedAsset.height}
          loading="eager"
          sizes="96px"
          src={unlockedAsset.src}
          unoptimized
          width={unlockedAsset.width}
        />
      ) : null}
    </div>
  );
}
