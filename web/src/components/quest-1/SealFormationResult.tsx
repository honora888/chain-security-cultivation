"use client";

import type {
  AnimationEvent,
  CSSProperties,
} from "react";

import {
  QUEST_ONE_COPY,
  QUEST_ONE_REPAIR_DIFF,
  QUEST_ONE_SEAL_TIMING,
} from "@/data/quest-1";

import styles from "./quest-1.module.css";

interface SealFormationResultProps {
  complete: boolean;
  reducedMotion: boolean;
  onAnimationEnd: (event: AnimationEvent<HTMLElement>) => void;
}

const sealTimingStyle = {
  "--seal-sequence-duration": `${QUEST_ONE_SEAL_TIMING.sequence}ms`,
  "--seal-stagger-duration": `${QUEST_ONE_SEAL_TIMING.sealStagger}ms`,
  "--seal-diff-duration": `${QUEST_ONE_SEAL_TIMING.diffMove}ms`,
} as CSSProperties;

const seals = [
  {
    english: "Checks",
    chinese: "前置检查",
    conclusion: "先读取并验证 balances[msg.sender]。",
  },
  {
    english: "Effects",
    chinese: "内部生效",
    conclusion: "在外部调用前清零余额并记录 Withdrawn。",
  },
  {
    english: "Interactions",
    chinese: "外部交互",
    conclusion: "最后执行 call；失败时整笔交易回滚。",
  },
] as const;

export function SealFormationResult({
  complete,
  reducedMotion,
  onAnimationEnd,
}: SealFormationResultProps) {
  return (
    <section
      className={`${styles.sealResult} ${
        complete ? styles.sealResultComplete : styles.sealSequence
      }`}
      data-reduced-motion={reducedMotion ? "true" : "false"}
      onAnimationEnd={onAnimationEnd}
      style={sealTimingStyle}
      aria-labelledby="seal-result-title"
    >
      <div
        className={styles.sealStatus}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <span>{complete ? "三印闭合" : "封印进行中"}</span>
        <h2 id="seal-result-title">
          {complete ? "封印完成" : "CEI 阵印正在闭合"}
        </h2>
        <p>
          {complete
            ? QUEST_ONE_COPY.act5.success
            : "Checks、Effects、Interactions 三枚阵印将依次点亮。"}
        </p>
      </div>

      <div className={styles.sealFormation}>
        <svg
          className={styles.sealFormationLines}
          viewBox="0 0 900 180"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M150 90 H450 H750" />
        </svg>
        <ol aria-label="Checks、Effects、Interactions 封印顺序">
          {seals.map((seal, index) => (
            <li key={seal.english} style={{ "--seal-index": index } as CSSProperties}>
              <span className={styles.sealIndex}>{index + 1}</span>
              <strong>{seal.english}</strong>
              <span>{seal.chinese}</span>
            </li>
          ))}
        </ol>
        <dl className={styles.sealConclusions}>
          {seals.map((seal) => (
            <div key={`${seal.english}-conclusion`}>
              <dt>{seal.english}</dt>
              <dd>{seal.conclusion}</dd>
            </div>
          ))}
        </dl>
      </div>

      {complete ? (
        <section
          className={styles.repairDiff}
          aria-labelledby="repair-diff-title"
        >
          <header>
            <span>真实源码关键 Diff</span>
            <h2 id="repair-diff-title">外部调用移至状态更新之后</h2>
            <p>
              call 失败会令整个交易回滚，因此先清零的余额不会被永久错误清除。
            </p>
          </header>

          <div className={styles.repairDiffGrid}>
            <article>
              <header>
                <span>漏洞版</span>
                <strong>VulnerableCharityVault.sol</strong>
                <small>Checks → 外部 call → Effects</small>
              </header>
              <div
                className={styles.diffCodeScroll}
                tabIndex={0}
                aria-label="漏洞版关键代码"
              >
                <pre>
                  <code>
                    {QUEST_ONE_REPAIR_DIFF.vulnerable.map((line, index) => (
                      <span
                        data-marker={line.marker}
                        key={`vulnerable-${index}-${line.code}`}
                      >
                        <span className={styles.diffMarker}>
                          {line.label ?? "  保留"}
                        </span>
                        <span>{line.code}</span>
                      </span>
                    ))}
                  </code>
                </pre>
              </div>
            </article>

            <article>
              <header>
                <span>修复版</span>
                <strong>FixedCharityVault.sol</strong>
                <small>Checks → Effects → Interactions</small>
              </header>
              <div
                className={styles.diffCodeScroll}
                tabIndex={0}
                aria-label="修复版关键代码"
              >
                <pre>
                  <code>
                    {QUEST_ONE_REPAIR_DIFF.fixed.map((line, index) => (
                      <span
                        data-marker={line.marker}
                        key={`fixed-${index}-${line.code}`}
                      >
                        <span className={styles.diffMarker}>
                          {line.label ?? "  保留"}
                        </span>
                        <span>{line.code}</span>
                      </span>
                    ))}
                  </code>
                </pre>
              </div>
            </article>
          </div>
        </section>
      ) : null}
    </section>
  );
}
