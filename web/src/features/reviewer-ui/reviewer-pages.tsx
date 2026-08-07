"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";

import {
  fetchAllReviewCases,
  fetchReviewCase,
  ReviewerApiError,
  submitReviewDecision,
} from "./reviewer-api-client";
import {
  REVIEW_STATUSES,
  type ReviewCaseDetail,
  type ReviewCaseSummary,
  type ReviewDecision,
  type ReviewDecisionPayload,
  type ReviewDecisionResult,
  type ReviewFilter,
  type ReviewStatus,
  type ReviewerAnalysis,
  type ReviewerCandidateAnalysis,
} from "./reviewer-types";
import { ReviewerAccessLink } from "@/features/wallet-auth/reviewer-access-link";
import { WalletIdentityControl } from "@/features/wallet-auth/wallet-identity-controls";
import {
  guardianConfidenceLabelZh,
  guardianFindingSeverityLabelZh,
} from "@/features/guardian-llm/confidence";
import {
  CULTIVATION_ELEMENT_VALUES,
  CULTIVATION_REALM_VALUES,
  cultivationElementLabel,
  cultivationRealmLabel,
  isCultivationElement,
  isCultivationRealm,
} from "@/features/guardian-security/cultivation-labels";
import {
  FORMAL_CONFIDENCE_VALUES,
  FORMAL_SEVERITY_VALUES,
  FORMAL_VULNERABILITY_TYPES,
  confidenceLabelForScore,
  formalVulnerabilityTypeLabelZh,
  severityLabelForScore,
  type ReviewerFormalClassification,
} from "@/reviews/formal-classification";
import styles from "./reviewer-ui.module.css";

function realmDisplay(realm: string, label: string): string {
  return isCultivationRealm(realm) ? cultivationRealmLabel(realm) : label || realm;
}

function elementDisplay(element: string): string {
  return isCultivationElement(element) ? cultivationElementLabel(element) : element;
}

const STATUS_COPY: Record<ReviewStatus, { label: string; description: string }> = {
  pending_review: { label: "待审核", description: "等待守阁人查验证据并作出裁定" },
  changes_requested: { label: "要求修改", description: "已给出返修意见，当前阶段只读" },
  approved: { label: "已收录", description: "已通过审核并收入《异兽志》" },
  rejected: { label: "已驳回", description: "审核终止，未发布且未发放 Merit" },
};

const FILTERS: readonly { value: ReviewFilter; label: string }[] = [
  { value: "pending_review", label: "待审核" },
  { value: "changes_requested", label: "要求修改" },
  { value: "approved", label: "已收录" },
  { value: "rejected", label: "已驳回" },
  { value: "all", label: "全部" },
];

const DECISION_COPY: Record<ReviewDecision, { label: string; description: string }> = {
  approved: { label: "通过收录", description: "发布异兽档案并按服务端总分写入唯一 Merit 记录。" },
  changes_requested: { label: "要求修改", description: "记录返修意见；贡献者返修入口将在下一阶段接入。" },
  rejected: { label: "驳回", description: "终结当前案例，不发放 Merit，也不发布异兽档案。" },
};

const SCORE_FIELDS = [
  { key: "evidenceQuality", label: "Evidence Completeness", hint: "证据完整性", maximum: 25 },
  { key: "reproducibility", label: "Reproducibility", hint: "攻击可复现性", maximum: 25 },
  { key: "technicalAccuracy", label: "Fix Quality", hint: "修复质量", maximum: 20 },
  { key: "remediationQuality", label: "Educational Value", hint: "教育价值", maximum: 20 },
  { key: "contributionValue", label: "Novelty", hint: "案例新颖性", maximum: 10 },
] as const;

type ScoreKey = (typeof SCORE_FIELDS)[number]["key"];
type ScoreDraft = Record<ScoreKey, string>;

const EMPTY_SCORES: ScoreDraft = {
  evidenceQuality: "",
  reproducibility: "",
  technicalAccuracy: "",
  remediationQuality: "",
  contributionValue: "",
};

type ClassificationDraft = {
  formalType: string;
  primaryElement: string;
  secondaryElements: readonly string[];
  realm: string;
  severityLabel: string;
  severityScore: string;
  confidenceLabel: string;
  confidenceScore: string;
};

function initialClassification(detail: ReviewCaseDetail): ClassificationDraft {
  const analysis = detail.candidateAnalysis;
  const suggestion = analysis?.candidateBestiarySuggestion;
  const finding = analysis?.findings[suggestion?.candidateFindingIndex ?? 0];
  const suggestedSeverity = finding?.suggestedSeverity ?? "";
  const severityDefaults = { Informational: 1, Low: 3, Medium: 6, High: 9, Critical: 11 } as const;
  return {
    formalType: finding?.category ?? "",
    primaryElement: suggestion?.suggestedPrimaryElement ?? "",
    secondaryElements: suggestion?.suggestedSecondaryElements ?? [],
    realm: suggestion?.suggestedCultivationRealm ?? "",
    severityLabel: suggestedSeverity,
    severityScore: suggestedSeverity ? String(severityDefaults[suggestedSeverity]) : "",
    confidenceLabel: finding?.suggestedConfidence.label ?? "",
    confidenceScore: finding ? String(finding.suggestedConfidence.score) : "",
  };
}

function parseClassification(draft: ClassificationDraft): ReviewerFormalClassification | null {
  const severityScore = Number(draft.severityScore);
  const confidenceScore = Number(draft.confidenceScore);
  if (
    !FORMAL_VULNERABILITY_TYPES.includes(draft.formalType as ReviewerFormalClassification["formalType"]) ||
    !isCultivationElement(draft.primaryElement) ||
    draft.secondaryElements.length > 4 ||
    !draft.secondaryElements.every(isCultivationElement) ||
    new Set(draft.secondaryElements).size !== draft.secondaryElements.length ||
    draft.secondaryElements.includes(draft.primaryElement) ||
    !isCultivationRealm(draft.realm) ||
    !FORMAL_SEVERITY_VALUES.includes(draft.severityLabel as ReviewerFormalClassification["severity"]["label"]) ||
    !Number.isInteger(severityScore) || severityScore < 0 || severityScore > 12 ||
    severityLabelForScore(severityScore) !== draft.severityLabel ||
    !FORMAL_CONFIDENCE_VALUES.includes(draft.confidenceLabel as ReviewerFormalClassification["confidence"]["label"]) ||
    !Number.isInteger(confidenceScore) || confidenceScore < 0 || confidenceScore > 100 ||
    confidenceLabelForScore(confidenceScore) !== draft.confidenceLabel
  ) return null;
  return {
    formalType: draft.formalType as ReviewerFormalClassification["formalType"],
    primaryElement: draft.primaryElement,
    secondaryElements: draft.secondaryElements,
    realm: draft.realm,
    severity: { label: draft.severityLabel as ReviewerFormalClassification["severity"]["label"], score: severityScore },
    confidence: { label: draft.confidenceLabel as ReviewerFormalClassification["confidence"]["label"], score: confidenceScore },
  };
}

function localTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "时间未记录" : date.toLocaleString();
}

function compactAddress(value: string): string {
  return value.length > 16 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value;
}

function TextList({ items, empty = "未记录" }: { items: readonly string[]; empty?: string }) {
  if (items.length === 0) return <p className={styles.emptyText}>{empty}</p>;
  return <ul className={styles.textList}>{items.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}</ul>;
}

function AccessError({ error, onRetry }: { error: ReviewerApiError; onRetry: () => void }) {
  const denied = error.code === "REVIEWER_REQUIRED";
  return (
    <section className={styles.accessPanel} role="alert">
      <span className={styles.seal} aria-hidden="true">止</span>
      <p className={styles.eyebrow}>{denied ? "RESTRICTED ARCHIVE" : "REVIEW ACCESS"}</p>
      <h2>{denied ? "当前身份不是守阁人" : "审核台暂未展开"}</h2>
      <p>{error.message}</p>
      <div className={styles.actionRow}>
        {error.code !== "REVIEWER_REQUIRED" ? <button type="button" onClick={onRetry}>重新检查</button> : null}
        <Link href="/bestiary">返回异兽志</Link>
        <Link href="/">返回首页</Link>
      </div>
    </section>
  );
}

function ReviewerShell({ children }: { children: ReactNode }) {
  return (
    <main className={styles.pageShell}>
      <div className={styles.realmGlow} aria-hidden="true" />
      <header className={styles.pageHeader}>
        <div>
          <p className={styles.eyebrow}>REVIEWER WORKBENCH</p>
          <Link className={styles.homeLink} href="/">← 返回山门</Link>
          <h1>守阁人审核台</h1>
          <p>查证异兽之实，裁定是否收入《异兽志》。</p>
        </div>
        <nav aria-label="审核台辅助导航">
          <Link href="/bestiary">异兽志</Link>
          <Link href="/profile">我的修仙档案</Link>
          <WalletIdentityControl />
          <ReviewerAccessLink />
        </nav>
      </header>
      {children}
    </main>
  );
}

function QueueCard({ entry }: { entry: ReviewCaseSummary }) {
  const status = STATUS_COPY[entry.status];
  return (
    <article className={styles.queueCard} data-status={entry.status}>
      <header>
        <div>
          <p>{entry.formalType ?? "待鉴定类型"}</p>
          <h2>{entry.caseName}</h2>
        </div>
        <span className={styles.statusBadge}>● {status.label}</span>
      </header>
      <dl className={styles.factGrid}>
        <div className={styles.wideFact}><dt>Case ID</dt><dd><code>{entry.caseId}</code></dd></div>
        <div><dt>贡献者</dt><dd title={entry.contributorAddress}>{compactAddress(entry.contributorAddress)}</dd></div>
        <div><dt>拟定异兽名</dt><dd>{entry.proposedBestiaryName ?? "未记录"}</dd></div>
        <div><dt>Severity</dt><dd>{entry.severity.label ?? "未记录"}{entry.severity.score !== null ? ` · ${entry.severity.score}/12` : ""}</dd></div>
        <div><dt>Confidence</dt><dd>{entry.confidence.label ?? "未记录"}{entry.confidence.score !== null ? ` · ${entry.confidence.score}/100` : ""}</dd></div>
        <div><dt>提交时间</dt><dd title={entry.createdAt}>{localTime(entry.createdAt)}</dd></div>
      </dl>
      <p className={styles.statusDescription}>{status.description}</p>
      <Link className={styles.primaryLink} href={`/review/${encodeURIComponent(entry.caseId)}`}>查看卷宗 <span aria-hidden="true">→</span></Link>
    </article>
  );
}

export function ReviewerQueuePage() {
  const [entries, setEntries] = useState<readonly ReviewCaseSummary[]>([]);
  const [filter, setFilter] = useState<ReviewFilter>("pending_review");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ReviewerApiError | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setEntries(await fetchAllReviewCases());
    } catch (loadError) {
      setError(loadError instanceof ReviewerApiError ? loadError : new ReviewerApiError("NETWORK_ERROR"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  const counts = useMemo(() => Object.fromEntries(
    REVIEW_STATUSES.map((status) => [status, entries.filter((entry) => entry.status === status).length]),
  ) as Record<ReviewStatus, number>, [entries]);
  const visible = filter === "all" ? entries : entries.filter((entry) => entry.status === filter);

  return (
    <ReviewerShell>
      {loading ? <p className={styles.loadingPanel} role="status">正在调取守阁卷宗…</p> : null}
      {!loading && error ? <AccessError error={error} onRetry={() => void load()} /> : null}
      {!loading && !error ? (
        <>
          <section className={styles.queueOverview} aria-labelledby="queue-heading">
            <div>
              <p className={styles.sectionIndex}>藏经阁 · 审核卷宗</p>
              <h2 id="queue-heading">待裁案例</h2>
              <p>所有数据来自受 Session 保护的 Review API；前端不会持有或推断审核员 allowlist。</p>
            </div>
            <strong><span>{counts.pending_review}</span> 份待审核</strong>
          </section>
          <div className={styles.filters} role="group" aria-label="按审核状态筛选">
            {FILTERS.map((item) => {
              const count = item.value === "all" ? entries.length : counts[item.value];
              return (
                <button key={item.value} type="button" aria-pressed={filter === item.value} onClick={() => setFilter(item.value)}>
                  {item.label}<span>{count}</span>
                </button>
              );
            })}
          </div>
          <section className={styles.queueGrid} aria-live="polite" aria-label="审核案例列表">
            {visible.length > 0 ? visible.map((entry) => <QueueCard key={entry.caseId} entry={entry} />) : (
              <div className={styles.emptyPanel}>
                <span aria-hidden="true">卷</span>
                <h2>当前筛选下暂无卷宗</h2>
                <p>切换状态可查看其他已提交、已裁定或要求修改的案例。</p>
              </div>
            )}
          </section>
        </>
      ) : null}
    </ReviewerShell>
  );
}

function AnalysisSection({ analysis }: { analysis: ReviewerAnalysis | null }) {
  if (!analysis) {
    return <section className={styles.dossierPanel}><h2>Guardian 证据</h2><p>该案例没有可识别的 deterministic analysis 记录。</p></section>;
  }
  const matchedSignals = analysis.signals.filter((signal) => signal.matched);
  return (
    <>
      <section className={styles.dossierPanel} aria-labelledby="guardian-finding">
        <div className={styles.panelHeading}><span>壹</span><div><p>GUARDIAN DETERMINATION</p><h2 id="guardian-finding">Guardian 鉴定</h2></div></div>
        <dl className={styles.factGrid}>
          <div><dt>正式类型</dt><dd>{analysis.formalType}</dd></div>
          <div><dt>五行</dt><dd>{elementDisplay(analysis.primaryElement)}{analysis.secondaryElements.length ? ` / ${analysis.secondaryElements.map(elementDisplay).join(" / ")}` : ""}</dd></div>
          <div><dt>境界</dt><dd>{realmDisplay(analysis.realm, analysis.realmLabel)}</dd></div>
          <div><dt>Severity</dt><dd>{analysis.severity.level}{analysis.severity.score !== null ? ` · ${analysis.severity.score}/${analysis.severity.maxScore ?? 12}` : ""}</dd></div>
          <div><dt>Confidence</dt><dd>{analysis.confidence.label}{analysis.confidence.score !== null ? ` · ${analysis.confidence.score}/100` : ""}</dd></div>
          <div><dt>证据级别</dt><dd>{analysis.confidence.evidenceLevel}</dd></div>
          <div className={styles.wideFact}><dt>Root Cause</dt><dd>{analysis.rootCause}</dd></div>
          <div className={styles.wideFact}><dt>Impact</dt><dd>{analysis.impact}</dd></div>
        </dl>
        <div className={styles.evidenceGrid}>
          <div><h3>受影响函数</h3><TextList items={analysis.affectedFunctions} /></div>
          <div><h3>攻击前提</h3><TextList items={analysis.prerequisites} /></div>
          <div><h3>攻击路径</h3><TextList items={analysis.attackPath} /></div>
          <div><h3>修复建议</h3><TextList items={analysis.mitigations} /></div>
        </div>
        <details className={styles.detailsBlock} open>
          <summary>规则信号 · 已匹配 {matchedSignals.length}/{analysis.signals.length}</summary>
          <ul className={styles.signalList}>
            {analysis.signals.map((signal) => (
              <li key={signal.id} data-matched={signal.matched}>
                <header><strong>{signal.matched ? "已匹配" : "未匹配"}</strong><code>{signal.id}</code></header>
                <p>{signal.explanation}</p>
                <small>{signal.strength} · {signal.source} · {signal.evidenceType}</small>
              </li>
            ))}
          </ul>
        </details>
        <div className={styles.limitations}>
          <h3>Known Limitations</h3>
          {analysis.limitations.length ? <ul>{analysis.limitations.map((item, index) => <li key={`${index}-${item.text}`}><span>{item.provenance}</span>{item.text}</li>)}</ul> : <p>未记录</p>}
        </div>
      </section>
      {analysis.bestiaryDraft ? <BestiaryDraftSection draft={analysis.bestiaryDraft} /> : (
        <section className={styles.dossierPanel} aria-labelledby="bestiary-draft-heading">
          <div className={styles.panelHeading}><span>卷</span><div><p>BESTIARY DRAFT</p><h2 id="bestiary-draft-heading">异兽志草案</h2></div><strong className={styles.draftStamp}>历史案例</strong></div>
          <p className={styles.legacyNotice}>历史案例：当前草案为旧版英文 Guardian 输出。未进行客户端翻译。</p>
        </section>
      )}
      {analysis.questDraft ? (
        <section className={styles.dossierPanel} aria-labelledby="quest-draft-heading">
          <div className={styles.panelHeading}><span>叁</span><div><p>QUEST DRAFT</p><h2 id="quest-draft-heading">Quest 草案</h2></div></div>
          <h3>{analysis.questDraft.title}</h3>
          <p>{analysis.questDraft.scenario}</p>
          <div className={styles.sequence}>{analysis.questDraft.repairSequence.map((step, index) => <span key={`${index}-${step}`}>{step}</span>)}</div>
          <div className={styles.evidenceGrid}>
            <div><h3>学习目标</h3><TextList items={analysis.questDraft.learningObjectives} /></div>
            <div><h3>危险代码焦点</h3><TextList items={analysis.questDraft.dangerousCodeFocus} /></div>
            <div><h3>攻击回放</h3><TextList items={analysis.questDraft.attackReplaySteps} /></div>
            <div><h3>验证清单</h3><TextList items={analysis.questDraft.verificationChecklist} /></div>
          </div>
          <p><strong>分类挑战：</strong>{analysis.questDraft.classificationChallenge}</p>
          <div className={styles.limitations}><h3>已知局限</h3><TextList items={analysis.questDraft.knownLimitations} /></div>
        </section>
      ) : null}
    </>
  );
}

function CandidateAnalysisSection({ analysis }: { analysis: ReviewerCandidateAnalysis }) {
  return (
    <section className={styles.dossierPanel} aria-labelledby="candidate-finding">
      <div className={styles.panelHeading}>
        <span>候</span>
        <div><p>LLM CANDIDATE · HUMAN VERIFICATION REQUIRED</p><h2 id="candidate-finding">Guardian 候选建议</h2></div>
        <strong className={styles.draftStamp}>候选 / Candidate</strong>
      </div>
      <p>{analysis.publicSummary}</p>
      <dl className={styles.factGrid}>
        <div><dt>签名选定异兽名</dt><dd>{analysis.selectedBestiaryName}</dd></div>
        <div><dt>验证状态</dt><dd>尚未完成确定性验证</dd></div>
        <div className={styles.wideFact}><dt>人工审核要求</dt><dd>需先完成人工验证与正式分类，暂不可发布。</dd></div>
      </dl>
      {analysis.candidateBestiarySuggestion ? (
        <section className={styles.dossierPanel} aria-labelledby="candidate-bestiary-suggestion">
          <div className={styles.panelHeading}>
            <span>异</span>
            <div>
              <p>LLM CANDIDATE · HUMAN REVIEW REQUIRED</p>
              <h3 id="candidate-bestiary-suggestion">Guardian 候选异兽设定</h3>
            </div>
            <strong className={styles.draftStamp}>建议 / Candidate</strong>
          </div>
          <p className={styles.legacyNotice}>以下内容为候选展示设定，不是正式属性、境界或发布依据。</p>
          <dl className={styles.factGrid}>
            <div><dt>Guardian 建议属性</dt><dd>{cultivationElementLabel(analysis.candidateBestiarySuggestion.suggestedPrimaryElement)}{analysis.candidateBestiarySuggestion.suggestedSecondaryElements.length ? ` / ${analysis.candidateBestiarySuggestion.suggestedSecondaryElements.map(cultivationElementLabel).join(" / ")}` : ""}</dd></div>
            <div><dt>Guardian 建议境界</dt><dd>{cultivationRealmLabel(analysis.candidateBestiarySuggestion.suggestedCultivationRealm)}</dd></div>
            <div className={styles.wideFact}><dt>妖兽特性</dt><dd>{analysis.candidateBestiarySuggestion.lore}</dd></div>
            <div className={styles.wideFact}><dt>攻击招式</dt><dd>{analysis.candidateBestiarySuggestion.attackTechnique}</dd></div>
            <div className={styles.wideFact}><dt>破阵之法</dt><dd>{analysis.candidateBestiarySuggestion.countermeasure}</dd></div>
            <div className={styles.wideFact}><dt>修炼启示</dt><dd>{analysis.candidateBestiarySuggestion.cultivationLesson}</dd></div>
          </dl>
          <div className={styles.reviewHistory}>
            <h3>出没特征</h3>
            <TextList items={analysis.candidateBestiarySuggestion.behavior} />
          </div>
        </section>
      ) : null}
      <div className={styles.reviewHistory}>
        {analysis.findings.map((finding) => (
          <article key={finding.candidateId}>
            <header><strong>{finding.title}</strong><span>LLM Candidate</span></header>
            <p><b>类别：</b>{finding.category}</p>
            <p><b>建议严重度：</b>{guardianFindingSeverityLabelZh(finding.suggestedSeverity)}</p>
            <p><b>LLM 建议置信度（非权威）：</b>{guardianConfidenceLabelZh(finding.suggestedConfidence.label)} · {finding.suggestedConfidence.score}/100</p>
            <p>{finding.explanation}</p>
            <div className={styles.evidenceGrid}>
              <div><h3>攻击路径</h3><TextList items={finding.attackPath} /></div>
              <div><h3>建议修复</h3><TextList items={finding.suggestedFix} /></div>
              <div><h3>候选证据</h3><TextList items={finding.evidence.map((entry) => `${entry.source}：${entry.description}${entry.locations.length ? `（${entry.locations.join("、")}）` : ""}`)} /></div>
              <div><h3>已知局限</h3><TextList items={finding.limitations} /></div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function BestiaryDraftSection({ draft }: { draft: NonNullable<ReviewerAnalysis["bestiaryDraft"]> }) {
  return (
    <section className={styles.dossierPanel} aria-labelledby="bestiary-draft-heading">
      <div className={styles.panelHeading}><span>贰</span><div><p>BESTIARY DRAFT</p><h2 id="bestiary-draft-heading">异兽志草案</h2></div><strong className={styles.draftStamp}>草案 / Draft</strong></div>
      {draft.legacyEnglish ? <p className={styles.legacyNotice}>历史案例：当前草案为旧版英文 Guardian 输出。未进行客户端翻译。</p> : null}
      <dl className={styles.factGrid}>
        <div><dt>草案异兽名</dt><dd>{draft.name}</dd></div>
        <div><dt>正式漏洞类型</dt><dd>{draft.formalType}</dd></div>
        <div><dt>五行</dt><dd>{draft.primaryElement}{draft.secondaryElements.length ? ` / ${draft.secondaryElements.join(" · ")}` : ""}</dd></div>
        <div><dt>境界</dt><dd>{realmDisplay(draft.realm, draft.realm)}</dd></div>
        <div><dt>Severity</dt><dd>{draft.severity}</dd></div>
        <div><dt>Confidence</dt><dd>{draft.confidence}</dd></div>
        <div className={styles.wideFact}><dt>异兽形</dt><dd>{draft.summary ?? draft.impact}</dd></div>
        <div className={styles.wideFact}><dt>危害</dt><dd>{draft.impact}</dd></div>
      </dl>
      <div className={styles.evidenceGrid}>
        <div><h3>行凶之径</h3><TextList items={draft.attackPattern} /></div>
        <div><h3>出没条件</h3><TextList items={draft.prerequisites} /></div>
        <div><h3>镇压之法</h3><TextList items={draft.mitigations} /></div>
        <div><h3>已知局限</h3><TextList items={draft.knownLimitations} /></div>
      </div>
    </section>
  );
}

function SourceDossier({ detail }: { detail: ReviewCaseDetail }) {
  const sources = [
    { title: "漏洞源码", value: detail.vulnerableSource },
    { title: "攻击样例", value: detail.attackSource },
    { title: "修复源码", value: detail.fixedSource },
  ];
  return (
    <section className={styles.dossierPanel} aria-labelledby="source-heading">
      <div className={styles.panelHeading}><span>肆</span><div><p>SOURCE DOSSIER</p><h2 id="source-heading">源码卷宗</h2></div></div>
      <p className={styles.panelNote}>源码仅供守阁人阅读；页面不会编译、执行、上传至第三方或写入控制台。</p>
      <div className={styles.sourceStack}>
        {sources.map((source) => (
          <details key={source.title}>
            <summary>{source.title}<span>{source.value.length.toLocaleString()} 字符</span></summary>
            {source.value ? <pre tabIndex={0}><code>{source.value}</code></pre> : <p>提交者未提供此项源码。</p>}
          </details>
        ))}
      </div>
    </section>
  );
}

function parseScores(scores: ScoreDraft): Record<ScoreKey, number> | null {
  const parsed = Object.fromEntries(SCORE_FIELDS.map((field) => [field.key, Number(scores[field.key])])) as Record<ScoreKey, number>;
  return SCORE_FIELDS.every((field) => Number.isInteger(parsed[field.key]) && parsed[field.key] >= 0 && parsed[field.key] <= field.maximum)
    ? parsed
    : null;
}

function DecisionForm({ detail, onComplete }: { detail: ReviewCaseDetail; onComplete: (result: ReviewDecisionResult) => Promise<void> }) {
  const [decision, setDecision] = useState<ReviewDecision | null>(null);
  const [scores, setScores] = useState<ScoreDraft>(EMPTY_SCORES);
  const [reviewSummary, setReviewSummary] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [rejectConfirmed, setRejectConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [classificationDraft, setClassificationDraft] = useState(() => initialClassification(detail));
  const parsedScores = parseScores(scores);
  const total = parsedScores ? Object.values(parsedScores).reduce((sum, value) => sum + value, 0) : null;
  const candidateOnly = detail.candidateAnalysis !== null;
  const classification = candidateOnly ? parseClassification(classificationDraft) : null;
  const valid = Boolean(
    decision && parsedScores && reviewSummary.trim() &&
    (decision !== "rejected" || rejectConfirmed) &&
    (!candidateOnly || decision !== "approved" || classification),
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!decision || !parsedScores || !valid || submitting) return;
    setSubmitting(true);
    setError(null);
    const payload: ReviewDecisionPayload = {
      decision,
      ...parsedScores,
      reviewSummary: reviewSummary.trim(),
      reviewNotes,
      ...(candidateOnly && decision === "approved" && classification ? { classification } : {}),
    };
    try {
      const result = await submitReviewDecision(detail.caseId, payload);
      await onComplete(result);
    } catch (submitError) {
      setError(submitError instanceof ReviewerApiError ? submitError.message : "审核提交未完成，请稍后重试。");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className={styles.decisionPanel} aria-labelledby="decision-heading">
      <div className={styles.panelHeading}><span>伍</span><div><p>HUMAN REVIEW GATE</p><h2 id="decision-heading">审核裁定</h2></div></div>
      <p>选择决定后填写正式审核表单。最终总分由服务端按冻结权重重新计算。</p>
      {candidateOnly ? (
        <section className={styles.classificationPanel} aria-labelledby="formal-classification-heading">
          <div className={styles.formHeading}>
            <h3 id="formal-classification-heading">人工鉴定</h3>
            <strong>{classification ? "正式分类完整" : "请完成全部正式分类"}</strong>
          </div>
          <p>以下控件可由 Guardian 建议预填，但只有审核员本次提交的值会成为正式分类。</p>
          <div className={styles.classificationGrid}>
            <label><span>正式漏洞类型</span><select value={classificationDraft.formalType} onChange={(event) => setClassificationDraft((current) => ({ ...current, formalType: event.target.value }))}><option value="">请选择</option>{FORMAL_VULNERABILITY_TYPES.map((value) => <option key={value} value={value}>{formalVulnerabilityTypeLabelZh(value)}</option>)}</select></label>
            <label><span>正式主属性</span><select value={classificationDraft.primaryElement} onChange={(event) => setClassificationDraft((current) => ({ ...current, primaryElement: event.target.value, secondaryElements: current.secondaryElements.filter((item) => item !== event.target.value) }))}><option value="">请选择</option>{CULTIVATION_ELEMENT_VALUES.map((value) => <option key={value} value={value}>{cultivationElementLabel(value)}</option>)}</select></label>
            <fieldset className={styles.secondaryElements}><legend>正式次属性</legend>{CULTIVATION_ELEMENT_VALUES.map((value) => <label key={value}><input type="checkbox" disabled={classificationDraft.primaryElement === value} checked={classificationDraft.secondaryElements.includes(value)} onChange={(event) => setClassificationDraft((current) => ({ ...current, secondaryElements: event.target.checked ? [...current.secondaryElements, value] : current.secondaryElements.filter((item) => item !== value) }))} /><span>{cultivationElementLabel(value)}</span></label>)}</fieldset>
            <label><span>正式境界</span><select value={classificationDraft.realm} onChange={(event) => setClassificationDraft((current) => ({ ...current, realm: event.target.value }))}><option value="">请选择</option>{CULTIVATION_REALM_VALUES.map((value) => <option key={value} value={value}>{cultivationRealmLabel(value)}</option>)}</select></label>
            <label><span>正式严重度</span><select value={classificationDraft.severityLabel} onChange={(event) => setClassificationDraft((current) => ({ ...current, severityLabel: event.target.value }))}><option value="">请选择</option>{FORMAL_SEVERITY_VALUES.map((value) => <option key={value} value={value}>{guardianFindingSeverityLabelZh(value)}</option>)}</select></label>
            <label><span>严重度评分（0—12）</span><input type="number" min={0} max={12} step={1} value={classificationDraft.severityScore} onChange={(event) => setClassificationDraft((current) => ({ ...current, severityScore: event.target.value }))} /></label>
            <label><span>正式置信度</span><select value={classificationDraft.confidenceLabel} onChange={(event) => setClassificationDraft((current) => ({ ...current, confidenceLabel: event.target.value }))}><option value="">请选择</option>{FORMAL_CONFIDENCE_VALUES.map((value) => <option key={value} value={value}>{guardianConfidenceLabelZh(value)}</option>)}</select></label>
            <label><span>置信度评分（0—100）</span><input type="number" min={0} max={100} step={1} value={classificationDraft.confidenceScore} onChange={(event) => setClassificationDraft((current) => ({ ...current, confidenceScore: event.target.value }))} /></label>
          </div>
        </section>
      ) : null}
      <div className={styles.decisionChoices} role="group" aria-label="选择审核决定">
        {(Object.keys(DECISION_COPY) as ReviewDecision[]).map((value) => (
          <button key={value} type="button" disabled={candidateOnly && value === "approved" && !classification} aria-pressed={decision === value} onClick={() => { setDecision(value); setError(null); setRejectConfirmed(false); }}>
            <strong>{DECISION_COPY[value].label}</strong><span>{DECISION_COPY[value].description}</span>
          </button>
        ))}
      </div>
      {candidateOnly ? <p className={styles.decisionNotice}>候选发现只有在人工鉴定完整并随“通过收录”一并提交后才可发布；要求修改与驳回无需正式分类。</p> : null}
      {decision ? (
        <form className={styles.reviewForm} onSubmit={submit} aria-busy={submitting}>
          <div className={styles.formHeading}><h3>{DECISION_COPY[decision].label} · 审核表</h3><strong>总 Merit：{total ?? "—"} / 100</strong></div>
          <div className={styles.scoreGrid}>
            {SCORE_FIELDS.map((field) => (
              <label key={field.key}>
                <span>{field.label}</span><small>{field.hint} · 0—{field.maximum}</small>
                <input
                  type="number"
                  min={0}
                  max={field.maximum}
                  step={1}
                  required
                  inputMode="numeric"
                  value={scores[field.key]}
                  onChange={(event) => setScores((current) => ({ ...current, [field.key]: event.target.value }))}
                  aria-label={`${field.hint}评分，最高 ${field.maximum} 分`}
                />
              </label>
            ))}
          </div>
          <label className={styles.fullField}>
            <span>守阁人意见 <strong>贡献者可见</strong></span>
            <textarea required maxLength={500} rows={4} value={reviewSummary} onChange={(event) => setReviewSummary(event.target.value)} />
            <small>{Array.from(reviewSummary).length} / 500</small>
          </label>
          <label className={styles.fullField}>
            <span>内部审核备注 <strong>仅审核员可见</strong></span>
            <textarea maxLength={4000} rows={4} value={reviewNotes} onChange={(event) => setReviewNotes(event.target.value)} />
            <small>{Array.from(reviewNotes).length} / 4000</small>
          </label>
          <div className={styles.nameNotice}>
            <span>当前保留异兽名</span><strong>{detail.proposedBestiaryName ?? "未记录"}</strong>
            <p>当前 Review API 不接受最终名称编辑；唯一性、归一化与 reservation 冲突继续由服务端负责。</p>
          </div>
          {decision === "changes_requested" ? <p className={styles.decisionNotice}>贡献者返修入口将在下一阶段接入。本次仅记录 `changes_requested` 与守阁人意见。</p> : null}
          {decision === "rejected" ? (
            <label className={styles.confirmRow}>
              <input type="checkbox" checked={rejectConfirmed} onChange={(event) => setRejectConfirmed(event.target.checked)} />
              <span>我确认驳回会终结当前案例，不发放 Merit，也不发布异兽档案。</span>
            </label>
          ) : null}
          {error ? <p className={styles.formError} role="alert">{error}</p> : null}
          <div className={styles.actionRow}>
            <button type="submit" disabled={!valid || submitting}>{submitting ? "正在提交裁定…" : `确认${DECISION_COPY[decision].label}`}</button>
            <button type="button" disabled={submitting} onClick={() => { setDecision(null); setError(null); }}>取消</button>
          </div>
        </form>
      ) : null}
    </section>
  );
}

function ReviewHistory({ detail }: { detail: ReviewCaseDetail }) {
  if (!detail.reviews.length) return null;
  return (
    <section className={styles.dossierPanel} aria-labelledby="history-heading">
      <div className={styles.panelHeading}><span>录</span><div><p>REVIEW RECORD</p><h2 id="history-heading">审核记录</h2></div></div>
      <div className={styles.reviewHistory}>
        {detail.reviews.map((review) => (
          <article key={review.reviewId}>
            <header><strong>{STATUS_COPY[review.decision].label}</strong><time title={review.createdAt}>{localTime(review.createdAt)}</time></header>
            <p><b>守阁人意见：</b>{review.reviewSummary || "未记录"}</p>
            <p><b>内部审核备注：</b>{review.reviewNotes || "无"}</p>
            <p>Merit {review.scores.total}/100 · Reviewer <code>{compactAddress(review.reviewerAddress)}</code></p>
          </article>
        ))}
      </div>
    </section>
  );
}

function DecisionOutcome({ result, detail }: { result: ReviewDecisionResult; detail: ReviewCaseDetail }) {
  const approved = result.status === "approved";
  const changes = result.status === "changes_requested";
  const latestReview = detail.reviews[0];
  return (
    <section className={styles.outcomePanel} role="status">
      <span className={styles.seal} aria-hidden="true">{approved ? "收" : changes ? "改" : "止"}</span>
      <p className={styles.eyebrow}>REVIEW RECORDED</p>
      <h2>{approved ? "已收入《异兽志》" : changes ? "已要求贡献者修改" : "此案例未通过审核"}</h2>
      <dl className={styles.factGrid}>
        <div className={styles.wideFact}><dt>Case</dt><dd><code>{result.caseId}</code></dd></div>
        <div><dt>状态</dt><dd>{result.status}</dd></div>
        <div><dt>Merit</dt><dd>{approved ? result.meritAmount : "未发放"}</dd></div>
        <div><dt>最终异兽名</dt><dd>{detail.bestiary?.displayName ?? detail.proposedBestiaryName ?? "未发布"}</dd></div>
        <div><dt>Quest 状态</dt><dd>{detail.bestiary?.questConversionStatus ?? "未发布"}</dd></div>
        {!approved ? <div className={styles.wideFact}><dt>守阁人意见</dt><dd>{latestReview?.reviewSummary || "已记录，详情刷新后可见"}</dd></div> : null}
      </dl>
      <div className={styles.actionRow}>
        {approved && result.bestiaryCreated ? <Link href={`/bestiary/${encodeURIComponent(result.caseId)}`}>查看公开异兽档案</Link> : null}
        <Link href="/review">返回审核队列</Link>
      </div>
    </section>
  );
}

export function ReviewerCasePage({ caseId }: { caseId: string }) {
  const [detail, setDetail] = useState<ReviewCaseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ReviewerApiError | null>(null);
  const [result, setResult] = useState<ReviewDecisionResult | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setDetail(await fetchReviewCase(caseId));
    } catch (loadError) {
      setError(loadError instanceof ReviewerApiError ? loadError : new ReviewerApiError("NETWORK_ERROR"));
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    void Promise.resolve().then(load);
  }, [load]);

  async function complete(nextResult: ReviewDecisionResult) {
    setResult(nextResult);
    try {
      setDetail(await fetchReviewCase(caseId));
    } catch {
      // The recorded decision remains authoritative; a later refresh can recover detail.
    }
  }

  return (
    <ReviewerShell>
      {loading ? <p className={styles.loadingPanel} role="status">正在展开守阁卷宗…</p> : null}
      {!loading && error ? <AccessError error={error} onRetry={() => void load()} /> : null}
      {!loading && !error && detail ? (
        <div className={styles.dossierStack}>
          <section className={styles.caseHero}>
            <div>
              <div className={styles.detailNavigation}>
                <Link href="/review">← 返回审核队列</Link>
                <Link href="/">返回山门</Link>
              </div>
              <p className={styles.eyebrow}>ARCHIVE DOSSIER</p>
              <h2>{detail.caseName}</h2>
              <p>{detail.formalType ?? "待鉴定类型"} · {detail.proposedBestiaryName ?? "异兽名未记录"}</p>
            </div>
            <span className={styles.statusBadge}>● {STATUS_COPY[detail.status].label}</span>
            <dl className={styles.factGrid}>
              <div className={styles.wideFact}><dt>Case ID</dt><dd><code>{detail.caseId}</code></dd></div>
              <div><dt>贡献者钱包</dt><dd title={detail.contributorAddress}>{compactAddress(detail.contributorAddress)}</dd></div>
              <div><dt>提交时间</dt><dd title={detail.createdAt}>{localTime(detail.createdAt)}</dd></div>
              <div><dt>Severity</dt><dd>{detail.severity.label ?? "未记录"}{detail.severity.score !== null ? ` · ${detail.severity.score}/12` : ""}</dd></div>
              <div><dt>Confidence</dt><dd>{detail.confidence.label ?? "未记录"}{detail.confidence.score !== null ? ` · ${detail.confidence.score}/100` : ""}</dd></div>
            </dl>
          </section>
          {result ? <DecisionOutcome result={result} detail={detail} /> : null}
          <AnalysisSection analysis={detail.analysis} />
          {detail.candidateAnalysis ? <CandidateAnalysisSection analysis={detail.candidateAnalysis} /> : null}
          <SourceDossier detail={detail} />
          <ReviewHistory detail={detail} />
          {!result && detail.status === "pending_review" ? <DecisionForm detail={detail} onComplete={complete} /> : null}
          {!result && detail.status !== "pending_review" ? (
            <section className={styles.readOnlyPanel}>
              <h2>卷宗已进入只读状态</h2>
              <p>{detail.status === "changes_requested" ? "当前已要求贡献者修改；返修入口尚未接入，因此不能再次裁定。" : "该案例已经形成终态，审核操作不再开放。"}</p>
              <Link href="/review">返回审核队列</Link>
            </section>
          ) : null}
        </div>
      ) : null}
    </ReviewerShell>
  );
}
