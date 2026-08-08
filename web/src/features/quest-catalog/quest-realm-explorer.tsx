"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState, type KeyboardEvent } from "react";

import {
  QUEST_CATALOG,
  QUEST_REALMS,
  RARE_ATTRIBUTES,
  questsForCategory,
} from "@/features/quest-catalog/quest-catalog";
import type {
  FiveElement,
  QuestCatalogCategory,
  QuestCatalogItem,
  QuestRealmDefinition,
} from "@/features/quest-catalog/quest-catalog-types";
import type { RealmName } from "@/features/guardian-security/analysis-types";
import {
  canChallengeRealm,
  challengeRelationship,
  challengeRelationshipLabel,
} from "@/features/cultivation/progression";

import styles from "./quest-catalog.module.css";

const ELEMENT_LABELS: Record<FiveElement, string> = {
  Metal: "金",
  Wood: "木",
  Water: "水",
  Fire: "火",
  Earth: "土",
};

const REALM_ART_PATHS: Record<QuestCatalogCategory, string> = {
  Metal: "/quests/realms/realm-metal-v2.webp",
  Wood: "/quests/realms/realm-wood-v2.webp",
  Water: "/quests/realms/realm-water-v2.webp",
  Fire: "/quests/realms/realm-fire-v2.webp",
  Earth: "/quests/realms/realm-earth-v2.webp",
  Rare: "/quests/realms/realm-rare-v2.webp",
};

function questNumber(value: number) {
  return value.toString().padStart(2, "0");
}

function RealmTab({
  realm,
  selected,
  openQuestCount,
  tabRef,
  onSelect,
  onKeyDown,
}: {
  realm: QuestRealmDefinition;
  selected: boolean;
  openQuestCount: number;
  tabRef: (node: HTMLButtonElement | null) => void;
  onSelect: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      ref={tabRef}
      className={styles.realmTab}
      data-realm={realm.id}
      type="button"
      role="tab"
      id={`realm-tab-${realm.id.toLowerCase()}`}
      aria-controls="quest-realm-panel"
      aria-selected={selected}
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={onKeyDown}
    >
      <span className={styles.realmArt} aria-hidden="true">
        <Image
          src={REALM_ART_PATHS[realm.id]}
          alt=""
          width={480}
          height={320}
          sizes="(max-width: 760px) 30vw, 15vw"
        />
      </span>
      <span className={styles.realmLabel}>
        <strong>{realm.label}</strong>
        <span>{realm.englishLabel}</span>
      </span>
      <small>{realm.keywords}</small>
      <em>
        {openQuestCount > 0
          ? `已开放 ${openQuestCount} 个 Quest`
          : "暂无已开放 Quest"}
      </em>
      <b>{selected ? "当前秘境" : "选择此境"}</b>
    </button>
  );
}

function QuestCard({ quest, cultivatorRealm }: { quest: QuestCatalogItem; cultivatorRealm: RealmName }) {
  const secondaryLabels = quest.secondaryElements?.map(
    (element) => ELEMENT_LABELS[element],
  );
  const relationship = challengeRelationship(cultivatorRealm, quest.realm);
  const eligible = canChallengeRealm(cultivatorRealm, quest.realm);

  return (
    <article className={styles.questCard} data-realm={quest.category}>
      <div className={styles.questIdentityColumn}>
        <div className={styles.questCardHeader}>
          <p>Quest {questNumber(quest.questNumber)}</p>
          <span className={styles.openStatus}>已开放</span>
        </div>
        <strong className={styles.challengeStatus} data-relationship={relationship}>
          {challengeRelationshipLabel(relationship)}
        </strong>
        <p className={styles.questType}>{quest.formalType}</p>
        <h3>{quest.title}</h3>
        <p className={styles.questSummary}>{quest.summary}</p>
      </div>

      <dl className={styles.questFacts}>
        <div>
          <dt>主分类</dt>
          <dd>{ELEMENT_LABELS[quest.primaryElement ?? "Water"]}之境</dd>
        </div>
        <div>
          <dt>次属性</dt>
          <dd>{secondaryLabels?.join("、") ?? "无"}</dd>
        </div>
        <div>
          <dt>境界</dt>
          <dd>{quest.realmLabel}</dd>
        </div>
        <div data-severity={quest.severity.toLowerCase()}>
          <dt>风险</dt>
          <dd>{quest.severity}</dd>
        </div>
      </dl>

      <div className={styles.learningPath}>
        <h4>修炼路径</h4>
        <ol>
          {quest.learningPath.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </div>

      <div className={styles.questReward}>
        <span>修炼所得</span>
        <strong>{quest.reward.exp} EXP</strong>
        <small>
          {ELEMENT_LABELS[quest.reward.masteryElement]}属性熟练度 +{quest.reward.mastery}<br />
          {quest.reward.badgeLabel}
        </small>
      </div>

      {eligible ? (
        <Link className={styles.enterQuestLink} href={quest.href}>
          进入秘境
          <span aria-hidden="true">→</span>
        </Link>
      ) : <span className={styles.lockedQuest}>境界不足</span>}
    </article>
  );
}

function FutureQuestPage({ realm }: { realm: QuestRealmDefinition }) {
  return (
    <aside className={styles.futureQuestPage} aria-label="卷宗延展说明">
      <p>FUTURE ARCHIVES</p>
      <h3>更多卷宗待收录</h3>
      <span>
        新的漏洞案例经过 Guardian Security Agent 分析、人工审核与协议收录后，
        将在{realm.label}之境展开为新的修炼卷宗。
      </span>
      <Link href="/contribute">
        贡献安全案例
        <span aria-hidden="true">→</span>
      </Link>
    </aside>
  );
}

function EmptyRealm({ realm }: { realm: QuestRealmDefinition }) {
  const isRare = realm.id === "Rare";

  return (
    <div className={styles.emptyRealm} data-realm={realm.id}>
      <p>{isRare ? "SPECIAL MECHANISMS" : "AWAITING REVIEWED QUESTS"}</p>
      <h3>此境暂无已收录 Quest</h3>
      <span>
        {isRare
          ? "复杂安全案例经过 Guardian Security Agent 分析、人工审核和协议收录后，将在此开放为新的安全秘境。"
          : "新的漏洞案例经过 Guardian Security Agent 分析、人工审核与协议收录后，将在此开放为新的安全秘境。"}
      </span>
      <Link href="/contribute">
        {isRare ? "贡献特殊安全案例" : "贡献此类安全案例"}
        <span aria-hidden="true">→</span>
      </Link>
    </div>
  );
}

export function QuestRealmExplorer({ cultivatorRealm = "Qi Refining" }: { cultivatorRealm?: RealmName }) {
  const [selectedCategory, setSelectedCategory] =
    useState<QuestCatalogCategory>("Water");
  const tabRefs = useRef<
    Partial<Record<QuestCatalogCategory, HTMLButtonElement | null>>
  >({});

  const selectedRealm =
    QUEST_REALMS.find((realm) => realm.id === selectedCategory) ??
    QUEST_REALMS[2];
  const selectedQuests = questsForCategory(selectedCategory);

  function selectTabAt(index: number) {
    const nextRealm = QUEST_REALMS[index];

    if (!nextRealm) {
      return;
    }

    setSelectedCategory(nextRealm.id);
    tabRefs.current[nextRealm.id]?.focus();
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const currentIndex = QUEST_REALMS.findIndex(
      (realm) => realm.id === selectedCategory,
    );
    let nextIndex: number | null = null;

    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        nextIndex = (currentIndex + 1) % QUEST_REALMS.length;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        nextIndex =
          (currentIndex - 1 + QUEST_REALMS.length) % QUEST_REALMS.length;
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = QUEST_REALMS.length - 1;
        break;
      default:
        return;
    }

    event.preventDefault();
    selectTabAt(nextIndex);
  }

  return (
    <>
      <section
        className={styles.realmNavigation}
        aria-labelledby="realm-nav-title"
      >
        <div className={styles.realmNavigationHeading}>
          <div>
            <p>Six security mechanism realms</p>
            <h2 id="realm-nav-title">六境择修</h2>
          </div>
          <span>五行为机制分类，境界为学习复杂度，风险为真实安全影响。</span>
        </div>

        <div className={styles.realmTabs} role="tablist" aria-label="秘境分类">
          {QUEST_REALMS.map((realm) => (
            <RealmTab
              key={realm.id}
              realm={realm}
              selected={selectedCategory === realm.id}
              openQuestCount={
                QUEST_CATALOG.filter((quest) => quest.category === realm.id)
                  .length
              }
              tabRef={(node) => {
                tabRefs.current[realm.id] = node;
              }}
              onSelect={() => setSelectedCategory(realm.id)}
              onKeyDown={handleTabKeyDown}
            />
          ))}
        </div>
      </section>

      <section
        className={styles.realmPanel}
        data-realm={selectedCategory}
        role="tabpanel"
        id="quest-realm-panel"
        aria-labelledby={`realm-tab-${selectedCategory.toLowerCase()}`}
      >
        <header className={styles.realmPanelHeader}>
          <div>
            <p>{selectedRealm.eyebrow}</p>
            <h2>
              {selectedCategory === "Rare"
                ? "稀有秘境"
                : `${selectedRealm.label}之境`}
            </h2>
          </div>
          <p>{selectedRealm.description}</p>
        </header>

        {selectedCategory === "Rare" ? (
          <aside
            className={styles.rareAttributes}
            aria-labelledby="rare-attributes-title"
          >
            <div>
              <p>Rare realm attributes</p>
              <h3 id="rare-attributes-title">特殊机制标签</h3>
            </div>
            <ul>
              {RARE_ATTRIBUTES.map((attribute) => (
                <li key={attribute.id}>
                  <strong>{attribute.label}</strong>
                  <span>{attribute.id}</span>
                </li>
              ))}
            </ul>
            <p>
              这些只是稀有秘境内部的未来机制标签，不代表更高品阶、奖励或价值。
            </p>
          </aside>
        ) : null}

        <div className={styles.realmContents} key={selectedCategory}>
          {selectedQuests.length > 0 ? (
            <div className={styles.questScrollShell}>
              <div
                className={styles.questScrollViewport}
                tabIndex={0}
                aria-label={`${selectedRealm.label}之境卷宗，可横向浏览`}
              >
                <div className={styles.questScrollTrack}>
                  {selectedQuests.map((quest) => (
                    <QuestCard key={quest.id} quest={quest} cultivatorRealm={cultivatorRealm} />
                  ))}
                  <FutureQuestPage realm={selectedRealm} />
                </div>
              </div>
              <p className={styles.scrollHint} aria-hidden="true">
                横向展开卷宗 · 尚有后卷 →
              </p>
            </div>
          ) : (
            <EmptyRealm realm={selectedRealm} />
          )}
        </div>
      </section>

      <section
        className={styles.classificationGuide}
        aria-labelledby="classification-guide-title"
      >
        <div>
          <p>Classification guide</p>
          <h2 id="classification-guide-title">如何阅读秘境图鉴</h2>
        </div>
        <dl>
          <div>
            <dt>五行与稀有</dt>
            <dd>漏洞机制分类</dd>
          </div>
          <div>
            <dt>特殊属性</dt>
            <dd>稀有秘境内部的机制标签</dd>
          </div>
          <div>
            <dt>境界</dt>
            <dd>学习与理解复杂度</dd>
          </div>
          <div>
            <dt>风险</dt>
            <dd>真实安全影响等级</dd>
          </div>
        </dl>
        <p>
          分类、境界与 Severity 各自描述不同维度；当前规则无法识别的漏洞不会自动归入稀有秘境。
        </p>
      </section>
    </>
  );
}
