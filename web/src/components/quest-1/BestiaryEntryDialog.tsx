"use client";

import { useEffect } from "react";

import { QUEST_ONE_BESTIARY_ENTRY } from "@/data/quest-1";

import { TemporaryVisualPlaceholder } from "./TemporaryVisualPlaceholder";
import styles from "./quest-1.module.css";

interface BestiaryEntryDialogProps {
  onClose: () => void;
}

export function BestiaryEntryDialog({
  onClose,
}: BestiaryEntryDialogProps) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <div className={styles.bestiaryOverlay}>
      <section
        className={styles.bestiaryDialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bestiary-title"
        aria-describedby="bestiary-description"
      >
        <header className={styles.bestiaryHeader}>
          <div>
            <span>漏洞异兽志 · Quest 1</span>
            <h2 id="bestiary-title">{QUEST_ONE_BESTIARY_ENTRY.name}</h2>
            <p id="bestiary-description">
              本地异兽志条目 · 已收录并封印
            </p>
          </div>
          <button onClick={onClose} type="button">
            关闭异兽志
          </button>
        </header>

        <div className={styles.bestiaryContent}>
          <div className={styles.bestiaryVisual}>
            <TemporaryVisualPlaceholder compact />
            <p>正式异兽志水墨画像资产待补充。</p>
          </div>

          <dl className={styles.bestiaryFacts}>
            <div>
              <dt>境界</dt>
              <dd>{QUEST_ONE_BESTIARY_ENTRY.realm}</dd>
            </div>
            <div>
              <dt>五行属性</dt>
              <dd>{QUEST_ONE_BESTIARY_ENTRY.element}</dd>
            </div>
            <div>
              <dt>漏洞类型</dt>
              <dd>{QUEST_ONE_BESTIARY_ENTRY.vulnerability}</dd>
            </div>
            <div>
              <dt>风险等级</dt>
              <dd>{QUEST_ONE_BESTIARY_ENTRY.risk}</dd>
            </div>
            <div>
              <dt>封印术</dt>
              <dd>{QUEST_ONE_BESTIARY_ENTRY.sealMethod}</dd>
            </div>
            <div>
              <dt>状态</dt>
              <dd>{QUEST_ONE_BESTIARY_ENTRY.status}</dd>
            </div>
            <div>
              <dt>本地徽记</dt>
              <dd>{QUEST_ONE_BESTIARY_ENTRY.badge}</dd>
            </div>
          </dl>
        </div>

        <footer>
          <p>
            此条目属于本地学习记录，不代表 Monad Testnet
            链上通关或徽记铸造状态。
          </p>
        </footer>
      </section>
    </div>
  );
}
