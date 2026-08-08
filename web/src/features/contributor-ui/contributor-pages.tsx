"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AUTH_CHAIN_ID, AUTH_CHAIN_NAME, useWalletAuth } from "@/features/wallet-auth/wallet-auth-provider";
import { WalletIdentityControl } from "@/features/wallet-auth/wallet-identity-controls";
import {
  CultivationApiError,
  getCultivationCredential,
  getCultivationProfile,
} from "@/features/cultivation/cultivation-api-client";
import { CultivationCredentialCard } from "@/features/cultivation/cultivation-credential";
import type {
  CultivationCredential,
  CultivationProfile,
} from "@/features/cultivation/contracts";
import {
  guardianConfidenceLabelZh,
  guardianFindingSeverityLabelZh,
} from "@/features/guardian-llm/confidence";
import {
  cultivationElementLabel,
  cultivationRealmLabel,
  isCultivationElement,
} from "@/features/guardian-security/cultivation-labels";
import { formalVulnerabilityTypeLabelZh } from "@/reviews/formal-classification";

import {
  ContributorApiError,
  getContribution,
  getContributions,
  getMerit,
  type ContributionDetail,
  type ContributionStatus,
  type ContributionSummary,
  type ContributorReviewSummary,
  type MeritSummary,
} from "./contributor-api-client";
import { deriveContributorReputation } from "./contributor-reputation";
import styles from "./contributor-ui.module.css";

const STATUS_COPY: Record<ContributionStatus, string> = {
  pending_review: "待守阁人审核",
  changes_requested: "待返修",
  approved: "已通过 / 已收录",
  rejected: "未通过",
};

const CULTIVATION_ELEMENTS = ["Metal", "Wood", "Water", "Fire", "Earth"] as const;

const ERROR_COPY: Record<string, string> = {
  AUTH_REQUIRED: "请先完成钱包签名登录。",
  INVALID_REQUEST: "提交内容格式不正确，请检查案例名称与源码字段。",
  PAYLOAD_TOO_LARGE: "源码内容超过允许长度，请精简后重新提交。",
  CASE_ALREADY_EXISTS: "这组三份源码已经提交过，请检查是否重复。",
  BESTIARY_NAME_UNAVAILABLE: "Guardian 暂时无法生成可用的唯一异兽名称，请稍后重试。",
  ANALYSIS_CHANGED: "Guardian 鉴定结果已变化，请重新查看草案后再确认。",
  DATABASE_UNAVAILABLE: "贡献服务暂时不可用，请稍后重试。",
  DATABASE_NOT_CONFIGURED: "贡献服务尚未完成配置，请稍后重试。",
  CASE_NOT_FOUND: "未找到该安全案例，或它不属于当前钱包。",
  NETWORK_UNAVAILABLE: "网络暂时不可用，请检查连接后重试。",
};

function compactAddress(value: string | null): string {
  return value && value.length > 12 ? `${value.slice(0, 6)}…${value.slice(-4)}` : value ?? "未连接";
}

function dateText(value: string | undefined): string {
  if (!value) return "未记录";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "未记录" : date.toLocaleString("zh-CN");
}

function errorText(error: unknown): string {
  if (error instanceof ContributorApiError) return ERROR_COPY[error.code] ?? "请求未能完成，请稍后重试。";
  if (error instanceof CultivationApiError) {
    if (error.code === "AUTH_REQUIRED") return "请先完成钱包签名登录。";
    return "修炼档案暂时无法读取，请稍后重试。";
  }
  return "请求未能完成，请稍后重试。";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function strings(value: unknown): readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string") ? value : [];
}

function SafeAnalysis({ analysis }: { analysis: unknown }) {
  const root = asRecord(analysis);
  const details = root ? asRecord(root.analysis) : null;
  if (!details) {
    return <p className={styles.mutedCopy}>本次提交已保存；详细分析将在个人案例详情中以服务端返回内容为准。</p>;
  }
  const rootCause = typeof details.rootCause === "string" ? details.rootCause : null;
  const impact = typeof details.impact === "string" ? details.impact : null;
  const attackPath = strings(details.attackPath);
  const mitigations = strings(details.mitigations);
  return (
    <div className={styles.analysisBrief}>
      {rootCause ? <p><strong>分析摘要</strong>{rootCause}</p> : null}
      {impact ? <p><strong>影响</strong>{impact}</p> : null}
      {attackPath.length ? <ListBlock title="攻击路径" values={attackPath} /> : null}
      {mitigations.length ? <ListBlock title="修复建议" values={mitigations} /> : null}
    </div>
  );
}

function ListBlock({ title, values }: { title: string; values: readonly string[] }) {
  return (
    <section className={styles.listBlock}>
      <h3>{title}</h3>
      <ul>{values.map((value) => <li key={value}>{value}</li>)}</ul>
    </section>
  );
}

const REVIEW_SCORE_FIELDS = [
  ["evidenceQuality", "证据完整性", 25],
  ["reproducibility", "攻击可复现性", 25],
  ["technicalAccuracy", "修复质量", 20],
  ["remediationQuality", "教育价值", 20],
  ["contributionValue", "案例新颖性", 10],
] as const;

function ReviewSummary({ review, historical = false }: { review: ContributorReviewSummary; historical?: boolean }) {
  const classification = review.formalClassification;
  return <section className={styles.reviewSummary}>
    <div className={styles.sectionHeader}><div><p className={styles.eyebrow}>{historical ? "历史审核" : "最新审核"}</p><h3>{STATUS_COPY[review.decision]}</h3></div><time dateTime={review.reviewedAt}>{dateText(review.reviewedAt)}</time></div>
    <div className={styles.reviewScoreGrid}>{REVIEW_SCORE_FIELDS.map(([key, label, maximum]) => <div key={key}><span>{label}</span><strong>{review.score[key]} / {maximum}</strong></div>)}<div><span>总分</span><strong>{review.score.total} / 100</strong></div></div>
    <div className={styles.guardianFeedback}><h4>守阁人意见</h4><p>{review.guardianFeedback || "守阁人未填写公开意见。"}</p></div>
    {classification ? <div className={styles.formalClassification}><h4>正式鉴定</h4><dl className={styles.detailFacts}>
      <div><dt>漏洞类型</dt><dd>{formalVulnerabilityTypeLabelZh(classification.formalType)}</dd></div>
      <div><dt>主属性</dt><dd>{cultivationElementLabel(classification.primaryElement)}</dd></div>
      <div><dt>次属性</dt><dd>{classification.secondaryElements.map(cultivationElementLabel).join("、") || "无"}</dd></div>
      <div><dt>境界</dt><dd>{cultivationRealmLabel(classification.realm)}</dd></div>
      <div><dt>严重度</dt><dd>{guardianFindingSeverityLabelZh(classification.severity.label)} · {classification.severity.score} / 12</dd></div>
      <div><dt>置信度</dt><dd>{guardianConfidenceLabelZh(classification.confidence.label)} · {classification.confidence.score} / 100</dd></div>
    </dl></div> : null}
    <p className={styles.privacyNotice}>内部审核备注不会向提交人公开。</p>
  </section>;
}

export function WalletStatusCard({ compact = false }: { compact?: boolean }) {
  const wallet = useWalletAuth();
  const wrongNetwork = wallet.walletAddress !== null && wallet.chainId !== AUTH_CHAIN_ID;
  return (
    <section className={`${styles.walletCard} ${compact ? styles.walletCardCompact : ""}`} aria-label="钱包认证状态">
      <div>
        <p className={styles.eyebrow}>修仙身份</p>
        <strong>{wallet.authenticated ? "已签名登录" : wrongNetwork ? "网络需要切换" : wallet.walletAddress ? "等待签名登录" : "未连接钱包"}</strong>
        <span>{wallet.walletAddress ? compactAddress(wallet.walletAddress) : "使用钱包签名建立 HttpOnly Session"}</span>
      </div>
      <div className={styles.walletActions}>
        {!wallet.providerAvailable ? <span className={styles.statusPill}>未检测到钱包</span> : null}
        {!wallet.walletAddress ? <button type="button" onClick={() => void wallet.connect()} disabled={wallet.loading}>连接钱包</button> : null}
        {wrongNetwork ? <button type="button" onClick={() => void wallet.switchNetwork()} disabled={wallet.loading}>切换 {AUTH_CHAIN_NAME}</button> : null}
        {wallet.walletAddress && !wrongNetwork && !wallet.authenticated ? <button type="button" onClick={() => void wallet.signIn()} disabled={wallet.loading}>签名入世</button> : null}
        {wallet.authenticated ? <Link href="/profile" className={styles.profileLink}>查看修仙档案</Link> : null}
        {wallet.authenticated ? <button type="button" className={styles.quietButton} onClick={() => void wallet.logout()} disabled={wallet.loading}>退出登录</button> : null}
      </div>
      <p className={styles.walletHint}>{wallet.loading ? "正在处理钱包请求…" : `${AUTH_CHAIN_NAME} · Chain ID ${AUTH_CHAIN_ID}`}</p>
      {wallet.error ? <p className={styles.errorMessage} role="status">{wallet.error}</p> : null}
    </section>
  );
}

function ContributorShell({ children, current }: { children: React.ReactNode; current: "profile" | "case" }) {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand}>链安修仙录 <span>Security cultivation</span></Link>
        <nav className={styles.navigation} aria-label="主要导航">
          <Link href="/quests">秘境修炼</Link>
          <Link href="/bestiary">异兽志</Link>
          <Link href="/contribute">异兽献策</Link>
          <Link href="/profile" aria-current={current === "profile" || current === "case" ? "page" : undefined}>我的修仙档案</Link>
        </nav>
        <WalletIdentityControl />
      </header>
      <main className={styles.main}>{children}</main>
    </div>
  );
}

function CaseFacts({ item }: { item: ContributionSummary }) {
  const primaryElement = item.primaryElement && isCultivationElement(item.primaryElement)
    ? cultivationElementLabel(item.primaryElement)
    : item.primaryElement;
  const severity = item.severity.label;
  const confidence = item.confidence.label;
  return (
    <dl className={styles.facts}>
      <div><dt>异兽名</dt><dd>{item.proposedBestiaryName ?? "未记录"}</dd></div>
      <div><dt>正式类型</dt><dd>{item.formalType ? formalVulnerabilityTypeLabelZh(item.formalType) : "待分析"}</dd></div>
      <div><dt>主属性</dt><dd>{primaryElement ?? "待分析"}</dd></div>
      <div><dt>风险</dt><dd>{severity === "Informational" || severity === "Low" || severity === "Medium" || severity === "High" || severity === "Critical" ? guardianFindingSeverityLabelZh(severity) : "待分析"}</dd></div>
      <div><dt>置信度</dt><dd>{confidence === "Low" || confidence === "Medium" || confidence === "High" ? guardianConfidenceLabelZh(confidence) : "待分析"}</dd></div>
    </dl>
  );
}

function ProfileIdentityHeader({ walletAddress }: { walletAddress: string | null }) {
  return (
    <section className={styles.profileIdentityHeader} aria-labelledby="profile-identity-title">
      <div>
        <p className={styles.eyebrow}>CULTIVATOR IDENTITY</p>
        <h2 id="profile-identity-title">修仙档案</h2>
      </div>
      <dl>
        <div><dt>当前钱包</dt><dd>{compactAddress(walletAddress)}</dd></div>
        <div><dt>修炼网络</dt><dd>{AUTH_CHAIN_NAME}</dd></div>
      </dl>
    </section>
  );
}

function CultivationProfileCard({
  credential,
  credentialError,
  credentialLoading,
  profile,
}: {
  credential: CultivationCredential | null;
  credentialError: string | null;
  credentialLoading: boolean;
  profile: CultivationProfile;
}) {
  const progression = profile.progression;
  const expDisplay = progression.nextRealmExp === null
    ? `${profile.totalExp} EXP`
    : `${profile.totalExp} / ${progression.nextRealmExp} EXP`;

  return (
    <section className={styles.profileCard} data-profile="cultivation" aria-labelledby="cultivation-profile-title">
      <header className={styles.profileCardHeader}>
        <p>SECRET REALM CULTIVATION</p>
        <h2 id="cultivation-profile-title">修炼档案</h2>
      </header>
      <div className={styles.profileLeadStats}>
        <div><span>当前境界</span><strong>{cultivationRealmLabel(progression.realm)}</strong></div>
        <div><span>修为</span><strong>{expDisplay}</strong></div>
      </div>
      <div className={styles.profileProgress}>
        <div
          role="progressbar"
          aria-label="当前境界修为进度"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progression.progressPercent)}
        >
          <span style={{ width: `${progression.progressPercent}%` }} />
        </div>
        <p>{progression.nextRealm
          ? `距离${cultivationRealmLabel(progression.nextRealm)} ${progression.expToNextRealm} EXP`
          : "当前已达渡劫期"}</p>
      </div>
      <div className={styles.profileSingleStat}>
        <span>已降伏异兽</span>
        <strong>{profile.completedQuestCount}</strong>
      </div>
      <section className={styles.profileDetailSection} aria-labelledby="profile-mastery-title">
        <h3 id="profile-mastery-title">五行熟练度</h3>
        <dl className={styles.masteryGrid}>
          {CULTIVATION_ELEMENTS.map((element) => (
            <div key={element}>
              <dt>{cultivationElementLabel(element)}</dt>
              <dd>{profile.mastery[element]}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section className={styles.profileDetailSection} aria-labelledby="profile-badges-title">
        <h3 id="profile-badges-title">修炼徽记</h3>
        <p>{profile.badges.length
          ? profile.badges.map((badge) => badge.label).join("、")
          : "尚未获得修炼徽记"}</p>
      </section>
      <section className={styles.profileDetailSection} aria-labelledby="profile-credential-title">
        <h3 id="profile-credential-title">镇兽灵契</h3>
        <CultivationCredentialCard
          credential={credential}
          error={credentialError}
          loading={credentialLoading}
        />
      </section>
    </section>
  );
}

function ContributionProfileCard({
  merit,
  statusCounts,
}: {
  merit: MeritSummary;
  statusCounts: Record<ContributionStatus, number>;
}) {
  const reputation = deriveContributorReputation(merit.totalMerit);
  const meritDisplay = reputation.nextTitleMerit === null
    ? `${reputation.totalMerit} 功德`
    : `${reputation.totalMerit} / ${reputation.nextTitleMerit} 功德`;

  return (
    <section className={styles.profileCard} data-profile="contribution" aria-labelledby="contribution-profile-title">
      <header className={styles.profileCardHeader}>
        <p>COMMUNITY CONTRIBUTION</p>
        <h2 id="contribution-profile-title">贡献档案</h2>
      </header>
      <div className={styles.profileLeadStats}>
        <div><span>当前贡献称号</span><strong>{reputation.title}</strong></div>
        <div><span>累计功德</span><strong>{meritDisplay}</strong></div>
      </div>
      <div className={styles.profileProgress}>
        <div
          role="progressbar"
          aria-label="当前贡献称号功德进度"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(reputation.progressPercent)}
        >
          <span style={{ width: `${reputation.progressPercent}%` }} />
        </div>
        <p>{reputation.nextTitle
          ? `距离${reputation.nextTitle} ${reputation.meritToNextTitle} 功德`
          : "当前已达最高贡献称号"}</p>
      </div>
      <dl className={styles.contributionStatusGrid}>
        <div><dt>已收录贡献</dt><dd>{statusCounts.approved}</dd></div>
        <div><dt>待守阁人审核</dt><dd>{statusCounts.pending_review}</dd></div>
        <div><dt>待返修</dt><dd>{statusCounts.changes_requested}</dd></div>
        <div><dt>未通过</dt><dd>{statusCounts.rejected}</dd></div>
      </dl>
    </section>
  );
}

export function ProfilePageClient() {
  const wallet = useWalletAuth();
  const { authenticated, refreshSession, walletAddress } = wallet;
  const [cases, setCases] = useState<readonly ContributionSummary[] | null>(null);
  const [merit, setMerit] = useState<MeritSummary | null>(null);
  const [cultivation, setCultivation] = useState<CultivationProfile | null>(null);
  const [credentialResult, setCredentialResult] = useState<{
    credential: CultivationCredential | null;
    error: string | null;
    walletAddress: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authenticated) return;
    const controller = new AbortController();
    void Promise.all([
      getContributions(controller.signal),
      getMerit(controller.signal),
      getCultivationProfile(controller.signal),
    ])
      .then(([nextCases, nextMerit, nextCultivation]) => {
        setCases(nextCases);
        setMerit(nextMerit);
        setCultivation(nextCultivation);
        setError(null);
      })
      .catch((requestError) => {
        if (!controller.signal.aborted) {
          if (
            (requestError instanceof ContributorApiError || requestError instanceof CultivationApiError) &&
            requestError.status === 401
          ) void refreshSession();
          setError(errorText(requestError));
        }
      });
    return () => controller.abort();
  }, [authenticated, refreshSession]);

  useEffect(() => {
    if (!authenticated || !walletAddress) return;
    const controller = new AbortController();
    const requestedWallet = walletAddress;
    void getCultivationCredential(controller.signal)
      .then((nextCredential) => {
        setCredentialResult({
          credential: nextCredential,
          error: null,
          walletAddress: requestedWallet,
        });
      })
      .catch((requestError) => {
        if (controller.signal.aborted) return;
        if (requestError instanceof CultivationApiError && requestError.status === 401) {
          void refreshSession();
        }
        setCredentialResult({
          credential: null,
          error: requestError instanceof CultivationApiError
            ? requestError.message
            : "链上灵契暂时无法读取，请稍后重试。",
          walletAddress: requestedWallet,
        });
      });
    return () => controller.abort();
  }, [authenticated, refreshSession, walletAddress]);

  const currentCredentialResult = credentialResult?.walletAddress === walletAddress
    ? credentialResult
    : null;
  const credential = currentCredentialResult?.credential ?? null;
  const credentialError = currentCredentialResult?.error ?? null;
  const credentialLoading = authenticated && walletAddress !== null && currentCredentialResult === null;

  const statusCounts = useMemo(() => {
    const initial: Record<ContributionStatus, number> = { pending_review: 0, changes_requested: 0, approved: 0, rejected: 0 };
    for (const item of cases ?? []) initial[item.status] += 1;
    return initial;
  }, [cases]);

  return <ContributorShell current="profile">
    <section className={styles.hero}><p className={styles.eyebrow}>CULTIVATOR PROFILE</p><h1>我的修仙档案</h1><p>秘境修为与社区功德各自独立归档，均以当前认证钱包的服务端记录为准。</p></section>
    {wallet.authenticated ? <ProfileIdentityHeader walletAddress={wallet.walletAddress} /> : <WalletStatusCard />}
    {!wallet.authenticated ? <section className={styles.emptyState}><h2>完成钱包签名后查看档案</h2><p>连接 Monad Testnet 钱包并签名登录后，系统才会读取你的贡献与 Merit。</p></section> : null}
    {wallet.authenticated && error ? <p className={styles.errorMessage} role="status">{error}</p> : null}
    {wallet.authenticated && (!cases || !merit || !cultivation) && !error ? <p className={styles.loading}>正在读取修炼与贡献档案…</p> : null}
    {wallet.authenticated && cases && merit && cultivation ? <>
      <div className={styles.dualProfileGrid}>
        <CultivationProfileCard
          profile={cultivation}
          credential={credential}
          credentialError={credentialError}
          credentialLoading={credentialLoading}
        />
        <ContributionProfileCard merit={merit} statusCounts={statusCounts} />
      </div>
      <section className={styles.caseList} aria-labelledby="my-cases-title"><div className={styles.sectionHeader}><h2 id="my-cases-title">我的异兽献策</h2><Link href="/contribute">前往异兽献策</Link></div>
        {cases.length ? cases.map((item) => <article className={styles.caseCard} key={item.caseId}><div><p className={styles.statusPill} data-status={item.status}>{STATUS_COPY[item.status]}</p><h3>{item.caseName}</h3><p>{item.proposedBestiaryName ?? "未命名异兽"} · {item.formalType ?? "等待分析"}</p></div><CaseFacts item={item}/><div><time dateTime={item.createdAt}>{dateText(item.createdAt)}</time><Link href={`/profile/cases/${item.caseId}`}>查看详情</Link></div></article>) : <div className={styles.emptyState}><h3>尚未完成异兽献策</h3><Link href="/contribute">前往异兽献策</Link></div>}
      </section>
      <section className={styles.meritSection}><h2>功德明细</h2>{merit.entries.length ? <ul>{merit.entries.map((entry) => <li key={entry.idempotencyKey}><strong>+{entry.amount}</strong><span>{entry.reason}</span><time dateTime={entry.createdAt}>{dateText(entry.createdAt)}</time></li>)}</ul> : <p className={styles.mutedCopy}>审核收录后结算功德。</p>}</section>
    </> : null}
  </ContributorShell>;
}

export function CaseDetailPageClient({ caseId }: { caseId: string }) {
  const wallet = useWalletAuth();
  const { authenticated, refreshSession } = wallet;
  const [item, setItem] = useState<ContributionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!authenticated) return;
    const controller = new AbortController();
    void getContribution(caseId, controller.signal).then((nextItem) => { setItem(nextItem); setError(null); }).catch((requestError) => {
      if (!controller.signal.aborted) {
        if (requestError instanceof ContributorApiError && requestError.status === 401) void refreshSession();
        setError(errorText(requestError));
      }
    });
    return () => controller.abort();
  }, [authenticated, caseId, refreshSession]);
  return <ContributorShell current="case">
    <section className={styles.hero}><p className={styles.eyebrow}>PERSONAL CONTRIBUTION DOSSIER</p><h1>异兽献策详情</h1><p>源码与完整案例内容仅由服务端按当前 Session 所属钱包返回。</p></section>
    {!wallet.authenticated ? <><WalletStatusCard /><section className={styles.emptyState}><h2>请先签名登录</h2><p>完成认证后才能查看个人案例详情。</p></section></> : null}
    {wallet.authenticated && !item && !error ? <p className={styles.loading}>正在读取案例详情…</p> : null}
    {error ? <p className={styles.errorMessage} role="status">{error}</p> : null}
    {item ? <section className={styles.detailCard}>
      <div className={styles.sectionHeader}><div><p className={styles.statusPill} data-status={item.status}>{STATUS_COPY[item.status]}</p><h2>{item.caseName}</h2></div><Link href="/profile">返回我的档案</Link></div>
      <CaseFacts item={item} />
      <dl className={styles.detailFacts}><div><dt>案例编号</dt><dd><code>{item.caseId}</code></dd></div><div><dt>次属性</dt><dd>{item.secondaryElements.map((element) => isCultivationElement(element) ? cultivationElementLabel(element) : element).join("、") || "无"}</dd></div><div><dt>提交时间</dt><dd>{dateText(item.createdAt)}</dd></div><div><dt>更新时间</dt><dd>{dateText(item.updatedAt)}</dd></div></dl>
      {item.latestReview ? <ReviewSummary review={item.latestReview} /> : null}
      {(item.latestReview ? item.reviewHistory.slice(0, -1) : item.reviewHistory).map((review) => <ReviewSummary key={review.reviewId} review={review} historical />)}
      {item.status === "changes_requested" ? <div className={styles.revisionAction}><p>守阁人已要求返修。修改源码后必须重新运行 Guardian，再提交新的鉴定结果。</p><Link href={`/contribute?revision=${encodeURIComponent(item.caseId)}`}>返修此案例</Link></div> : null}
      {item.status === "approved" ? <p className={styles.notice}>案例已收录。公开异兽志页面将在后续阶段开放；当前不假设公开条目一定存在。</p> : null}
      <SafeAnalysis analysis={item.analysis} />
      <section className={styles.sourceDetails}><h3>源码卷宗</h3><SourceDetails title="漏洞合约源码" source={item.vulnerableSource}/><SourceDetails title="攻击样例源码" source={item.attackSource}/><SourceDetails title="修复合约源码" source={item.fixedSource}/></section>
    </section> : null}
  </ContributorShell>;
}

function SourceDetails({ title, source }: { title: string; source: string }) {
  return <details><summary>{title}</summary>{source ? <pre><code>{source}</code></pre> : <p className={styles.mutedCopy}>本案例未提交此源码。</p>}</details>;
}
