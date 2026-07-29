"use client";

import Image from "next/image";
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
import { QUEST_ONE_BEAST_VISUAL_ASSETS } from "./quest-1-beast-visuals";

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
    kind: "checks",
  },
  {
    english: "Effects",
    chinese: "先清零状态",
    kind: "effects",
  },
  {
    english: "Interactions",
    chinese: "最后外部调用",
    kind: "interactions",
  },
] as const;

function SealGlyph({ kind }: { kind: (typeof seals)[number]["kind"] }) {
  if (kind === "checks") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
        <path d="M12 38V15l12-6 12 6v23" />
        <path d="M17 25l5 5 10-12" />
      </svg>
    );
  }

  if (kind === "effects") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
        <rect x="9" y="9" width="30" height="30" rx="2" />
        <rect x="15" y="15" width="18" height="18" rx="1" />
        <path d="M19 24h10M24 19v10" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path d="M23 35c-8-1-13-6-13-15 8 0 13 5 13 15Z" />
      <path d="M25 35c8-1 13-6 13-15-8 0-13 5-13 15Z" />
      <path d="M24 11v26M19 15l5-5 5 5" />
    </svg>
  );
}

export function SealFormationResult({
  complete,
  reducedMotion,
  onAnimationEnd,
}: SealFormationResultProps) {
  const sealedVisual = QUEST_ONE_BEAST_VISUAL_ASSETS.sealed;

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

      <div className={styles.sealCeremonyStage}>
        <div
          className={styles.sealedBeastVisual}
          data-complete={complete ? "true" : "false"}
          aria-hidden="true"
        >
          <Image
            alt=""
            aria-hidden="true"
            height={sealedVisual.height}
            sizes="(max-width: 640px) 72vw, (max-width: 960px) 48vw, 420px"
            src={sealedVisual.src}
            unoptimized
            width={sealedVisual.width}
          />
        </div>
        <div className={styles.sealFormation}>
          <svg
            className={styles.sealFormationLines}
            viewBox="0 0 900 220"
            aria-hidden="true"
            focusable="false"
          >
            <defs>
              <linearGradient id="cei-water-vein" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#80d7d2" stopOpacity=".18" />
                <stop offset=".5" stopColor="#267f87" stopOpacity=".9" />
                <stop offset="1" stopColor="#d5c384" stopOpacity=".3" />
              </linearGradient>
            </defs>
            <path
              className={styles.sealVeinBase}
              d="M150 110 C245 75 255 145 350 110 S455 75 550 110 S655 145 750 110"
            />
            <path
              className={styles.sealVeinFlow}
              d="M150 110 C245 75 255 145 350 110 S455 75 550 110 S655 145 750 110"
            />
            <path className={styles.sealVeinArrow} d="m332 99 18 11-18 11" />
            <path className={styles.sealVeinArrow} d="m632 99 18 11-18 11" />
          </svg>
          <ol aria-label="Checks、Effects、Interactions 封印顺序">
            {seals.map((seal, index) => (
              <li
                data-seal={seal.kind}
                key={seal.english}
                style={{ "--seal-index": index } as CSSProperties}
              >
                <div className={styles.ceiSeal}>
                  <span className={styles.ceiSealNotch} aria-hidden="true" />
                  <span className={styles.ceiSealFace}>
                    <span className={styles.sealIndex}>{index + 1}</span>
                    <span className={styles.ceiSealGlyph}>
                      <SealGlyph kind={seal.kind} />
                    </span>
                    <strong>{seal.english}</strong>
                    <span>{seal.chinese}</span>
                  </span>
                </div>
              </li>
            ))}
          </ol>
          <p className={styles.sealPrincipleLine}>
            <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">
              <path d="M5 7c5-1 8 0 11 3v16c-3-3-6-4-11-3V7Z" />
              <path d="M27 7c-5-1-8 0-11 3v16c3-3 6-4 11-3V7Z" />
            </svg>
            <span>
              <strong>Checks</strong> 先验条件
              <b aria-hidden="true">→</b>
              <strong>Effects</strong> 先清零并记录状态
              <b aria-hidden="true">→</b>
              <strong>Interactions</strong> 最后执行外部调用
            </span>
          </p>
        </div>
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
