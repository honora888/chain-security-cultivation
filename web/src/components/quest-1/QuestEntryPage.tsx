"use client";

import Link from "next/link";

import { QUEST_ONE } from "@/data/quest-1";

import { QuestOneIcon, type QuestOneIconName } from "./QuestOneIcon";
import { QuestEntryVideo } from "./QuestEntryVideo";
import styles from "./quest-1.module.css";

const questFacts: Array<{
  icon: QuestOneIconName;
  label: string;
  value: string;
  danger?: boolean;
}> = [
  { icon: "boss", label: "妖兽", value: QUEST_ONE.name },
  { icon: "realm-jindan", label: "境界", value: QUEST_ONE.realm },
  { icon: "water-drop", label: "五行", value: QUEST_ONE.element },
  { icon: "reentry-loop", label: "妖法", value: QUEST_ONE.vulnerability },
  { icon: "risk-high", label: "风险", value: QUEST_ONE.risk, danger: true },
];

interface QuestEntryPageProps {
  onStartQuest: () => void;
}

export function QuestEntryPage({ onStartQuest }: QuestEntryPageProps) {
  return (
    <div className={styles.entryPage}>
      <div className={styles.entrySceneBackground} aria-hidden="true">
        <picture>
          <source
            media="(max-width: 640px)"
            srcSet="/assets/quest-1/ui/backgrounds/quest-1-act1-background-mobile.webp"
          />
          <img
            src="/assets/quest-1/ui/backgrounds/quest-1-act1-background-desktop.webp"
            alt=""
            draggable={false}
          />
        </picture>
      </div>

      <header className={styles.siteHeader}>
        <Link className={styles.brand} href="/" aria-label="链安修仙录首页">
          <span className={styles.brandSeal} aria-hidden="true">链安</span>
          <span>
            <strong>链安修仙录</strong>
            <small>智能合约安全试炼</small>
          </span>
        </Link>
        <span className={styles.headerStatus}>宗门试炼 · Quest 1</span>
      </header>

      <main className={styles.entryHero} aria-labelledby="quest-title">
        <section className={styles.entryHeroIntro}>
          <p className={styles.eyebrow}>◇ Quest 1 · 水灵秘境 ◇</p>
          <h1 id="quest-title">云海伏妖</h1>
          <p className={styles.entryLead}>
            以代码为剑，识破金库灵脉中的回环妖气，修复真实重入漏洞。
          </p>
        </section>

        <section className={styles.entryHeroVisual} aria-label="Quest 1 封印影像">
          <QuestEntryVideo />
        </section>

        <dl className={styles.entryIntelGrid}>
          {questFacts.map((fact) => (
            <div
              className={styles.entryIntelItem}
              key={fact.label}
              data-risk={fact.danger ? "high" : undefined}
            >
              <dt><QuestOneIcon name={fact.icon} aria-hidden="true" />{fact.label}</dt>
              <dd className={fact.danger ? styles.riskText : undefined}>{fact.value}</dd>
            </div>
          ))}
        </dl>

        <section className={styles.entryBriefing} aria-label="任务简报">
          <div className={styles.entryBriefingRow}>
            <h2><QuestOneIcon name="target" aria-hidden="true" />学习目标</h2>
            <p>
              识别危险外部调用，理解重入攻击，并以 Checks → Effects → Interactions 完成封印。
            </p>
          </div>
          <div className={styles.entryBriefingRow}>
            <h2><QuestOneIcon name="badge" aria-hidden="true" />修炼所得</h2>
            <p>{QUEST_ONE.exp} EXP · 水属性熟练度 +{QUEST_ONE.mastery} · 水系守护者徽记</p>
          </div>
        </section>

        <div className={styles.entryCtaGroup}>
          <button
            className={`${styles.primaryButton} ${styles.entryCta}`}
            type="button"
            onClick={onStartQuest}
          >
            踏入秘境
          </button>
          <small>从识破重入漏洞开始，完成六幕链安修炼。</small>
        </div>
      </main>
    </div>
  );
}
