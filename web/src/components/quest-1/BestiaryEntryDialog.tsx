"use client";

import Image from "next/image";
import { useEffect } from "react";

import { QUEST_ONE_BESTIARY_ENTRY } from "@/data/quest-1";

import styles from "./quest-1.module.css";
import { QUEST_ONE_BEAST_VISUAL_ASSETS } from "./quest-1-beast-visuals";

interface BestiaryEntryDialogProps {
  onClose: () => void;
}

export function BestiaryEntryDialog({
  onClose,
}: BestiaryEntryDialogProps) {
  const bestiaryVisual = QUEST_ONE_BEAST_VISUAL_ASSETS.bestiary;

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
            <div className={styles.bestiaryPortrait}>
              <Image
                alt="噬灵回环兽异兽志头像：楔形头部、三片额甲、冷青双眼与方形状态玉扣"
                height={bestiaryVisual.height}
                sizes="(max-width: 640px) 72vw, 320px"
                src={bestiaryVisual.src}
                unoptimized
                width={bestiaryVisual.width}
              />
            </div>
            <p>正式异兽志画像 · 本地学习收录</p>
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
