"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { WalletIdentityControl } from "@/features/wallet-auth/wallet-identity-controls";

import {
  BestiaryApiError,
  fetchPublishedBestiary,
  fetchPublishedBestiaryEntry,
} from "./bestiary-api-client";
import {
  getCanonicalBestiaryEntry,
  mergeBestiaryEntries,
} from "./canonical-bestiary";
import {
  BESTIARY_SEVERITIES,
  type BestiarySeverityFilter,
  type UnifiedBestiaryEntry,
} from "./bestiary-types";
import styles from "./bestiary-ui.module.css";

type LoadState = "loading" | "success" | "error";

const FILTERS: readonly BestiarySeverityFilter[] = [
  "All",
  ...BESTIARY_SEVERITIES,
];

const FILTER_LABELS: Record<BestiarySeverityFilter, string> = {
  All: "全部",
  Critical: "Critical",
  High: "High",
  Medium: "Medium",
  Low: "Low",
  Informational: "Informational",
};

const ELEMENT_LABELS: Readonly<Record<string, string>> = {
  Metal: "金",
  Wood: "木",
  Water: "水",
  Fire: "火",
  Earth: "土",
};

function compactAddress(address: string): string {
  return address.length > 12
    ? `${address.slice(0, 6)}…${address.slice(-4)}`
    : address;
}

function formatDate(value: string | null): string {
  if (!value) return "正式 Quest";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function conversionLabel(entry: UnifiedBestiaryEntry): string {
  if (entry.questConversionStatus === "registered_on_monad") return "已成秘境";
  if (
    entry.questConversionStatus === "candidate" ||
    entry.questConversionStatus === "ready"
  ) {
    return "秘境候选";
  }
  return "已收录";
}

function questNumber(entry: UnifiedBestiaryEntry): string | null {
  return entry.questNumber === null
    ? null
    : `Quest ${entry.questNumber.toString().padStart(2, "0")}`;
}

function BestiaryHeader() {
  return (
    <header className={styles.siteHeader}>
      <Link className={styles.brand} href="/" aria-label="返回链安修仙录首页">
        <span aria-hidden="true">链安</span>
        <span>
          <strong>链安修仙录</strong>
          <small>异兽志公共档案</small>
        </span>
      </Link>
      <nav className={styles.topNav} aria-label="主要导航">
        <Link href="/quests">秘境修炼</Link>
        <Link href="/bestiary" aria-current="page">异兽志</Link>
        <Link href="/contribute">异兽献策</Link>
        <Link href="/profile">我的修仙档案</Link>
      </nav>
      <WalletIdentityControl />
    </header>
  );
}

function EntryStatus({ entry }: { entry: UnifiedBestiaryEntry }) {
  return (
    <span
      className={styles.entryStatus}
      data-state={entry.questConversionStatus}
    >
      {conversionLabel(entry)}
    </span>
  );
}

function EntryActions({ entry }: { entry: UnifiedBestiaryEntry }) {
  const isCandidate =
    entry.questConversionStatus === "candidate" ||
    entry.questConversionStatus === "ready";
  const isQuest = entry.questConversionStatus === "registered_on_monad";

  return (
    <div className={styles.entryActions}>
      <Link href={`/bestiary/${encodeURIComponent(entry.entryId)}`}>
        查看异兽档案 <span aria-hidden="true">→</span>
      </Link>
      {isCandidate ? (
        <span className={styles.pendingQuest} aria-disabled="true">
          秘境筹备中
        </span>
      ) : null}
      {isQuest && entry.questHref ? (
        <Link className={styles.questLink} href={entry.questHref}>
          进入秘境修炼 <span aria-hidden="true">→</span>
        </Link>
      ) : null}
    </div>
  );
}

function BestiaryCard({ entry }: { entry: UnifiedBestiaryEntry }) {
  const number = questNumber(entry);
  return (
    <article className={styles.entryCard} data-severity={entry.severity.toLowerCase()}>
      <div className={styles.entryCardHeading}>
        <p>{number ?? "Published bestiary entry"}</p>
        <EntryStatus entry={entry} />
      </div>
      <div className={styles.entryIdentity}>
        <p>{entry.formalType}</p>
        <h2>{entry.displayName}</h2>
      </div>
      <dl className={styles.entryMetrics}>
        <div>
          <dt>风险 Severity</dt>
          <dd>{entry.severity}</dd>
        </div>
        <div>
          <dt>可信度 Confidence</dt>
          <dd>{entry.confidence}</dd>
        </div>
        <div>
          <dt>五行</dt>
          <dd>
            {entry.primaryElement
              ? ELEMENT_LABELS[entry.primaryElement] ?? entry.primaryElement
              : "跨机制"}
            {entry.secondaryElements.length > 0
              ? ` · 辅 ${entry.secondaryElements.map((item) => ELEMENT_LABELS[item] ?? item).join("、")}`
              : ""}
          </dd>
        </div>
        <div>
          <dt>境界</dt>
          <dd>{entry.realmLabel ?? entry.realm}</dd>
        </div>
      </dl>
      <p className={styles.entrySummary}>{entry.summary}</p>
      <div className={styles.entryProvenance}>
        {entry.contributorAddress ? (
          <span title={entry.contributorAddress}>
            献策者 {compactAddress(entry.contributorAddress)}
          </span>
        ) : (
          <span>来源 正式 Quest Catalog</span>
        )}
        <span>收录 {formatDate(entry.approvedAt)}</span>
      </div>
      <EntryActions entry={entry} />
    </article>
  );
}

function useUnifiedBestiary() {
  const [state, setState] = useState<LoadState>("loading");
  const [entries, setEntries] = useState<readonly UnifiedBestiaryEntry[]>(
    () => mergeBestiaryEntries([]),
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchPublishedBestiary(controller.signal)
      .then((published) => {
        setEntries(mergeBestiaryEntries(published));
        setState("success");
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setEntries(mergeBestiaryEntries([]));
        setState(error instanceof BestiaryApiError ? "error" : "error");
      });
    return () => controller.abort();
  }, []);

  return { state, entries };
}

export function BestiaryArchivePage() {
  const { state, entries } = useUnifiedBestiary();
  const [filter, setFilter] = useState<BestiarySeverityFilter>("All");
  const visibleEntries = useMemo(
    () => filter === "All"
      ? entries
      : entries.filter((entry) => entry.severity === filter),
    [entries, filter],
  );

  return (
    <div className={styles.archivePage}>
      <BestiaryHeader />
      <main className={styles.archiveMain}>
        <section className={styles.archiveHero} aria-labelledby="bestiary-title">
          <p className={styles.eyebrow}>BESTIARY ARCHIVE</p>
          <h1 id="bestiary-title">异兽志</h1>
          <p className={styles.heroLead}>记天下链上邪祟，录已证之漏洞异兽。</p>
          <p>
            此处汇集经 Guardian 鉴定、守阁人审核并正式发布的安全案例，
            也收录已经化为可修炼秘境的正式 Quest 异兽。
          </p>
        </section>

        <section className={styles.archiveLedger} aria-labelledby="archive-ledger-title">
          <div className={styles.ledgerHeading}>
            <div>
              <p className={styles.sectionIndex}>PUBLIC DOSSIERS</p>
              <h2 id="archive-ledger-title">正式收录</h2>
            </div>
            <div className={styles.severityFilters} aria-label="按风险等级筛选">
              {FILTERS.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value)}
                >
                  {FILTER_LABELS[value]}
                </button>
              ))}
            </div>
          </div>

          {state === "loading" ? (
            <p className={styles.loadMessage} role="status">
              正在展开异兽志……
            </p>
          ) : null}
          {state === "error" ? (
            <p className={styles.errorMessage} role="alert">
              异兽志的审核收录部分暂时无法展开；已成秘境的正式 Quest 档案仍可浏览。
            </p>
          ) : null}

          {visibleEntries.length > 0 ? (
            <div className={styles.entryGrid}>
              {visibleEntries.map((entry) => (
                <BestiaryCard key={`${entry.identityKind}:${entry.entryId}`} entry={entry} />
              ))}
            </div>
          ) : (
            <div className={styles.emptyArchive}>
              <p>Archive empty</p>
              <h2>此风险等级暂无已收录异兽</h2>
              <p>
                新的安全案例通过守阁人审核后，将在此留下正式异兽档案。
              </p>
              <Link href="/contribute">异兽献策 <span aria-hidden="true">→</span></Link>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function TextList({ items }: { items: readonly string[] }) {
  return items.length > 0 ? (
    <ul>
      {items.map((item, index) => <li key={`${index}:${item}`}>{item}</li>)}
    </ul>
  ) : <p>当前公开档案未记录此项。</p>;
}

function SourceDisclosure({ entry }: { entry: UnifiedBestiaryEntry }) {
  let copy = "本档案仅公开审核摘要，完整源码不对公众展示。";
  if (entry.sourceDisclosure === "reviewed_excerpt") {
    copy = "本档案允许公开经审核的代码片段，但当前公开 API 未返回可展示片段。";
  } else if (entry.sourceDisclosure === "full_source") {
    copy = "本档案标记为可公开完整源码，但当前公开 API 未返回源码正文。";
  }
  return (
    <section className={styles.disclosurePanel} aria-labelledby="source-disclosure-title">
      <p className={styles.sectionIndex}>SOURCE DISCLOSURE</p>
      <h2 id="source-disclosure-title">源码披露</h2>
      <p>{copy}</p>
      <small>披露策略：{entry.sourceDisclosure}</small>
    </section>
  );
}

function BestiaryDossier({ entry }: { entry: UnifiedBestiaryEntry }) {
  const number = questNumber(entry);
  return (
    <article className={styles.dossier}>
      <header className={styles.dossierHeader}>
        <div>
          <p className={styles.sectionIndex}>
            {number ?? "PUBLIC BESTIARY DOSSIER"}
          </p>
          <p className={styles.dossierType}>{entry.formalType}</p>
          <h1>{entry.displayName}</h1>
        </div>
        <EntryStatus entry={entry} />
      </header>

      <dl className={styles.dossierFacts}>
        <div><dt>风险 Severity</dt><dd>{entry.severity}</dd></div>
        <div><dt>可信度 Confidence</dt><dd>{entry.confidence}</dd></div>
        <div><dt>主五行</dt><dd>{entry.primaryElement ? ELEMENT_LABELS[entry.primaryElement] ?? entry.primaryElement : "跨机制"}</dd></div>
        <div><dt>辅五行</dt><dd>{entry.secondaryElements.length > 0 ? entry.secondaryElements.map((item) => ELEMENT_LABELS[item] ?? item).join("、") : "无"}</dd></div>
        <div><dt>境界</dt><dd>{entry.realmLabel ? `${entry.realmLabel} · ${entry.realm}` : entry.realm}</dd></div>
        <div><dt>状态</dt><dd>{conversionLabel(entry)}</dd></div>
      </dl>

      <div className={styles.dossierSections}>
        <section><p>01</p><h2>异兽形</h2><p>{entry.summary}</p></section>
        <section><p>02</p><h2>行凶之径</h2><TextList items={entry.attackPattern} /></section>
        <section><p>03</p><h2>出没条件</h2><TextList items={entry.prerequisites} /></section>
        <section><p>04</p><h2>危害</h2><p>{entry.impact}</p></section>
        <section><p>05</p><h2>镇压之法</h2><TextList items={entry.mitigations} /></section>
        <section><p>06</p><h2>已知局限</h2><TextList items={entry.knownLimitations} /></section>
      </div>

      <section className={styles.collectionPanel} aria-labelledby="collection-info-title">
        <p className={styles.sectionIndex}>ARCHIVE PROVENANCE</p>
        <h2 id="collection-info-title">收录信息</h2>
        <dl>
          {entry.caseId ? <div><dt>案例编号</dt><dd>{entry.caseId}</dd></div> : null}
          {entry.contributorAddress ? <div><dt>献策者</dt><dd>{entry.contributorAddress}</dd></div> : <div><dt>档案来源</dt><dd>Canonical Released Quest Catalog</dd></div>}
          {entry.reviewerAddress ? <div><dt>审核者</dt><dd>{entry.reviewerAddress}</dd></div> : null}
          <div><dt>收录时间</dt><dd>{formatDate(entry.approvedAt)}</dd></div>
          <div><dt>转化状态</dt><dd>{entry.questConversionStatus}</dd></div>
        </dl>
      </section>

      <SourceDisclosure entry={entry} />

      <div className={styles.dossierActions}>
        <Link href="/bestiary">返回异兽志</Link>
        {entry.questConversionStatus === "registered_on_monad" && entry.questHref ? (
          <Link className={styles.questLink} href={entry.questHref}>
            进入秘境修炼 <span aria-hidden="true">→</span>
          </Link>
        ) : null}
      </div>
    </article>
  );
}

export function BestiaryDetailPage({ entryId }: { entryId: string }) {
  const canonicalEntry = useMemo(() => getCanonicalBestiaryEntry(entryId), [entryId]);
  const [state, setState] = useState<LoadState>(canonicalEntry ? "success" : "loading");
  const [entry, setEntry] = useState<UnifiedBestiaryEntry | null>(canonicalEntry);

  useEffect(() => {
    if (canonicalEntry) return;
    const controller = new AbortController();
    fetchPublishedBestiaryEntry(entryId, controller.signal)
      .then((published) => {
        setEntry(mergeBestiaryEntries([published])[0] ?? null);
        setState("success");
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setEntry(null);
        setState("error");
      });
    return () => controller.abort();
  }, [canonicalEntry, entryId]);

  return (
    <div className={styles.archivePage}>
      <BestiaryHeader />
      <main className={styles.detailMain}>
        {state === "loading" ? <p className={styles.loadMessage} role="status">正在展开异兽档案……</p> : null}
        {state === "error" || state === "success" && !entry ? (
          <section className={styles.detailError} role="alert">
            <p>Archive unavailable</p>
            <h1>异兽档案暂时无法展开</h1>
            <p>请稍后重试，或返回异兽志浏览其他正式收录。</p>
            <Link href="/bestiary">返回异兽志</Link>
          </section>
        ) : null}
        {entry ? <BestiaryDossier entry={entry} /> : null}
      </main>
    </div>
  );
}

export function RecentBestiaryArchive() {
  const { state, entries } = useUnifiedBestiary();
  const recent = entries.slice(0, 3);
  return (
    <section className={styles.homeArchive} aria-labelledby="home-bestiary-title">
      <div className={styles.homeArchiveHeading}>
        <div>
          <p className={styles.sectionIndex}>BESTIARY ARCHIVE</p>
          <h2 id="home-bestiary-title">异兽志</h2>
          <p>守阁人审核收录的安全案例，与已经化为正式秘境的 Quest 异兽。</p>
        </div>
        <Link href="/bestiary">查看完整异兽志 <span aria-hidden="true">→</span></Link>
      </div>
      {state === "loading" ? <p className={styles.homeArchiveNotice} role="status">正在校对最新收录……</p> : null}
      {state === "error" ? <p className={styles.homeArchiveNotice} role="alert">审核收录条目暂时无法展开；正式 Quest 档案仍可浏览。</p> : null}
      {recent.length > 0 ? (
        <div className={styles.recentGrid}>
          {recent.map((entry) => (
            <Link key={`${entry.identityKind}:${entry.entryId}`} href={`/bestiary/${encodeURIComponent(entry.entryId)}`}>
              <span>{questNumber(entry) ?? conversionLabel(entry)}</span>
              <strong>{entry.displayName}</strong>
              <small>{entry.formalType}</small>
              <em>{entry.severity} · {entry.primaryElement ? ELEMENT_LABELS[entry.primaryElement] ?? entry.primaryElement : "跨机制"}</em>
              <time dateTime={entry.approvedAt ?? undefined}>{formatDate(entry.approvedAt)}</time>
            </Link>
          ))}
        </div>
      ) : (
        <div className={styles.homeArchiveEmpty}>
          <p>异兽志尚无正式收录。</p>
          <Link href="/contribute">异兽献策</Link>
        </div>
      )}
    </section>
  );
}
