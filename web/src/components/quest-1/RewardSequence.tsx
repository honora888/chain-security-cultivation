"use client";

import Link from "next/link";

import type {
  AnimationEvent,
  CSSProperties,
} from "react";

import {
  QUEST_ONE,
  QUEST_ONE_COMPLETION_CONCLUSIONS,
  QUEST_ONE_REWARD_TIMING,
} from "@/data/quest-1";
import type { CultivationCompletionResponse } from "@/features/cultivation/contracts";

import { ChainStatusPanel } from "./ChainStatusPanel";
import { DynamicDefeatedSequence } from "./DynamicDefeatedSequence";
import { WaterGuardianBadge } from "./WaterGuardianBadge";
import styles from "./quest-1.module.css";

interface RewardSequenceProps {
  complete: boolean;
  reducedMotion: boolean;
  showChainStatus: boolean;
  onAnimationEnd: (event: AnimationEvent<HTMLElement>) => void;
  settlement: CultivationCompletionResponse | null;
}

const rewardTimingStyle = {
  "--reward-sequence-duration": `${QUEST_ONE_REWARD_TIMING.sequence}ms`,
  "--reward-reveal-duration": `${QUEST_ONE_REWARD_TIMING.reveal}ms`,
  "--reward-stamp-delay": `${QUEST_ONE_REWARD_TIMING.stampDelay}ms`,
  "--reward-exp-delay": `${QUEST_ONE_REWARD_TIMING.expDelay}ms`,
  "--reward-mastery-delay": `${QUEST_ONE_REWARD_TIMING.masteryDelay}ms`,
  "--reward-badge-delay": `${QUEST_ONE_REWARD_TIMING.badgeDelay}ms`,
} as CSSProperties;

export function RewardSequence({
  complete,
  reducedMotion,
  showChainStatus,
  onAnimationEnd,
  settlement,
}: RewardSequenceProps) {
  const replay = settlement?.alreadyCompleted === true;
  const waterMastery = settlement?.profile.mastery.Water ?? 0;
  const previousWaterMastery = replay ? waterMastery : Math.max(0, waterMastery - (settlement?.awardedThisRequest.mastery ?? 0));
  return (
    <section
      className={`${styles.rewardSequence} ${
        complete
          ? styles.rewardSequenceComplete
          : styles.rewardSequenceAnimating
      }`}
      data-reduced-motion={reducedMotion ? "true" : "false"}
      onAnimationEnd={onAnimationEnd}
      style={rewardTimingStyle}
      aria-labelledby="reward-title"
    >
      <div className={styles.rewardHero}>
        <DynamicDefeatedSequence
          reducedMotion={reducedMotion}
          shouldPlay={!complete}
        />
        <header
          className={styles.rewardHeader}
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <span className={styles.rewardStamp}>Quest 1 · 已完成</span>
          <h2 id="reward-title">
            {replay ? "重新修炼完成" : complete ? "修炼所得已入档" : "战利品正在显现"}
          </h2>
          <p>
            {replay
              ? "此秘境的首通修炼所得已经领取，本次为重新修炼。"
              : complete
              ? "噬灵回环兽已封印，首通所得已保存到修炼档案。"
              : "封印余波汇入修为、水属性熟练度与本地徽记。"}
          </p>
        </header>
      </div>

      <div className={styles.rewardCards} aria-label="本次本地学习奖励">
        <article className={styles.rewardExpCard}>
          <span>修炼经验</span>
          <strong>{replay ? "首通已领取" : `+${settlement?.awardedThisRequest.exp ?? 0} EXP`}</strong>
          <small>{replay ? "本次不重复增加修为" : "本次首通获得 · 服务端已保存"}</small>
        </article>

        <article className={styles.rewardMasteryCard}>
          <span>水属性熟练度</span>
          <strong>{replay ? waterMastery : `${previousWaterMastery} → ${waterMastery}`}</strong>
          <small>{replay ? "保持当前熟练度" : `本次首通获得 +${settlement?.awardedThisRequest.mastery ?? 0}`}</small>
        </article>

        <article className={styles.rewardBadgeCard}>
          <WaterGuardianBadge
            reducedMotion={reducedMotion}
            revealDelayMs={QUEST_ONE_REWARD_TIMING.badgeDelay}
            shouldAnimate={!complete}
            state="unlocked"
          />
          <strong>{settlement?.awardedThisRequest.badgeLabel ?? QUEST_ONE.badge}</strong>
          <small>{replay ? "首通徽记已持有" : "修炼档案徽记 · 已解锁"}</small>
        </article>
      </div>

      <section
        className={styles.completionSummary}
        aria-labelledby="completion-summary-title"
      >
        <header>
          <span>修炼总结</span>
          <h3 id="completion-summary-title">四道试炼结论</h3>
        </header>
        <ul>
          {QUEST_ONE_COMPLETION_CONCLUSIONS.map((conclusion) => (
            <li key={conclusion}>
              <span aria-hidden="true">已完成</span>
              <strong>{conclusion}</strong>
            </li>
          ))}
        </ul>
      </section>

      <p className={styles.rewardDataNote}>
        EXP、水属性熟练度与徽记保存在修炼档案中；Stage 36 不写入 Monad。
      </p>

      {complete && showChainStatus ? (
        <>
          <ChainStatusPanel />
          <section
            className={styles.guardianContributionCta}
            aria-labelledby="guardian-contribution-title"
          >
            <div>
              <span>安全案例贡献</span>
              <h3 id="guardian-contribution-title">召唤 Guardian 安全执事</h3>
              <p>
                将真实漏洞、攻击样例与修复对照提交给 Guardian Security
                Agent，生成待人工审核的异兽志与新 Quest 草案。
              </p>
            </div>
            <Link
              className={styles.guardianContributionLink}
              href="/contribute"
            >
              前往安全案例贡献工作台
            </Link>
          </section>
        </>
      ) : null}
    </section>
  );
}
