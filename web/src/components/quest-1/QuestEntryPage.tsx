import Image from "next/image";
import Link from "next/link";

import { QUEST_ONE } from "@/data/quest-1";

import { QuestOneBackdrop } from "./QuestOneBackdrop";
import { QuestOneIcon, type QuestOneIconName } from "./QuestOneIcon";
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

export function QuestEntryPage() {
  return (
    <div className={styles.entryPage}>
      <QuestOneBackdrop />
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

      <main className={styles.entryMain}>
        <section className={styles.entryCopy} aria-labelledby="quest-title">
          <p className={styles.eyebrow}>◇ Quest 1 · 水灵秘境 ◇</p>
          <h1 id="quest-title">云海伏妖</h1>
          <p className={styles.entryLead}>
            以代码为剑，找出金库灵脉中的回环妖气，击败一只真实漏洞化成的妖兽。
          </p>

          <dl className={styles.questFacts}>
            {questFacts.map((fact) => (
              <div key={fact.label} data-danger={fact.danger ? "true" : "false"}>
                <dt><QuestOneIcon name={fact.icon} aria-hidden="true" />{fact.label}</dt>
                <dd className={fact.danger ? styles.riskText : undefined}>{fact.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className={styles.entryVisual} aria-label="Quest 1 妖兽预览">
          <div className={styles.entryPortalFrame}>
            <span className={styles.entryPortalTitle}>噬灵回环兽 · 母版暂显</span>
            <Image
              alt="噬灵回环兽中性母版，断环缺口位于右下方"
              height={1024}
              priority
              sizes="(max-width: 760px) 78vw, 440px"
              src="/assets/quest-1/beast/reentry-devourer-master.webp"
              unoptimized
              width={1024}
            />
          </div>
        </section>
      </main>

      <footer className={styles.entryAction}>
        <div>
          <span><QuestOneIcon name="local-data" aria-hidden="true" />本地学习奖励</span>
          <strong>
            <QuestOneIcon name="exp" aria-hidden="true" />{QUEST_ONE.exp} EXP · <QuestOneIcon name="mastery" aria-hidden="true" />水属性熟练度 +{QUEST_ONE.mastery}
          </strong>
        </div>
        <Link className={styles.primaryButton} href="/quests/1">
          踏入秘境
        </Link>
      </footer>
    </div>
  );
}
