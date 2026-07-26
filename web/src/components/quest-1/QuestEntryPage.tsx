import Link from "next/link";

import { QUEST_ONE } from "@/data/quest-1";

import { TemporaryVisualPlaceholder } from "./TemporaryVisualPlaceholder";
import styles from "./quest-1.module.css";

export function QuestEntryPage() {
  return (
    <div className={styles.entryPage}>
      <header className={styles.siteHeader}>
        <Link className={styles.brand} href="/" aria-label="链安修仙录首页">
          <span className={styles.brandSeal} aria-hidden="true">
            链安
          </span>
          <span>
            <strong>链安修仙录</strong>
            <small>智能合约安全试炼</small>
          </span>
        </Link>
        <span className={styles.headerStatus}>宗门试炼 · Quest 1</span>
      </header>

      <main className={styles.entryMain}>
        <section className={styles.entryCopy} aria-labelledby="quest-title">
          <p className={styles.eyebrow}>Quest 1 · 水灵秘境</p>
          <h1 id="quest-title">云海伏妖</h1>
          <p className={styles.entryLead}>
            以代码为剑，找出金库灵脉中的回环妖气，击败一只真实漏洞化成的妖兽。
          </p>

          <dl className={styles.questFacts}>
            <div>
              <dt>妖兽</dt>
              <dd>{QUEST_ONE.name}</dd>
            </div>
            <div>
              <dt>境界</dt>
              <dd>{QUEST_ONE.realm}</dd>
            </div>
            <div>
              <dt>五行</dt>
              <dd>{QUEST_ONE.element}</dd>
            </div>
            <div>
              <dt>妖法</dt>
              <dd>{QUEST_ONE.vulnerability}</dd>
            </div>
            <div>
              <dt>风险</dt>
              <dd className={styles.riskText}>{QUEST_ONE.risk}</dd>
            </div>
          </dl>
        </section>

        <section className={styles.entryVisual} aria-label="Quest 1 妖兽预览">
          <TemporaryVisualPlaceholder />
        </section>
      </main>

      <footer className={styles.entryAction}>
        <div>
          <span>本地学习奖励</span>
          <strong>
            {QUEST_ONE.exp} EXP · 水属性熟练度 +{QUEST_ONE.mastery}
          </strong>
        </div>
        <Link className={styles.primaryButton} href="/quests/1">
          踏入秘境
        </Link>
      </footer>
    </div>
  );
}
