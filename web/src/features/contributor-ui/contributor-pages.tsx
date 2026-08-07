"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AUTH_CHAIN_ID, AUTH_CHAIN_NAME, useWalletAuth } from "@/features/wallet-auth/wallet-auth-provider";
import { WalletIdentityControl } from "@/features/wallet-auth/wallet-identity-controls";

import {
  ContributorApiError,
  getContribution,
  getContributions,
  getMerit,
  type ContributionDetail,
  type ContributionStatus,
  type ContributionSummary,
  type MeritSummary,
} from "./contributor-api-client";
import styles from "./contributor-ui.module.css";

const STATUS_COPY: Record<ContributionStatus, string> = {
  pending_review: "待审核",
  changes_requested: "需要修改",
  approved: "已收录",
  rejected: "未通过",
};

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
  return (
    <dl className={styles.facts}>
      <div><dt>异兽名</dt><dd>{item.proposedBestiaryName ?? "未记录"}</dd></div>
      <div><dt>正式类型</dt><dd>{item.formalType ?? "待分析"}</dd></div>
      <div><dt>风险</dt><dd>{item.severity.label ?? "待分析"}</dd></div>
      <div><dt>置信度</dt><dd>{item.confidence.label ?? "待分析"}</dd></div>
    </dl>
  );
}

export function ProfilePageClient() {
  const wallet = useWalletAuth();
  const { authenticated, refreshSession } = wallet;
  const [cases, setCases] = useState<readonly ContributionSummary[] | null>(null);
  const [merit, setMerit] = useState<MeritSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authenticated) return;
    const controller = new AbortController();
    void Promise.all([getContributions(controller.signal), getMerit(controller.signal)])
      .then(([nextCases, nextMerit]) => { setCases(nextCases); setMerit(nextMerit); setError(null); })
      .catch((requestError) => {
        if (!controller.signal.aborted) {
          if (requestError instanceof ContributorApiError && requestError.status === 401) void refreshSession();
          setError(errorText(requestError));
        }
      });
    return () => controller.abort();
  }, [authenticated, refreshSession]);

  const statusCounts = useMemo(() => {
    const initial: Record<ContributionStatus, number> = { pending_review: 0, changes_requested: 0, approved: 0, rejected: 0 };
    for (const item of cases ?? []) initial[item.status] += 1;
    return initial;
  }, [cases]);

  return <ContributorShell current="profile">
    <section className={styles.hero}><p className={styles.eyebrow}>CULTIVATOR PROFILE</p><h1>我的修仙档案</h1><p>仅显示当前 HttpOnly Session 所属钱包的异兽献策与 Merit 记录。</p></section>
    <WalletStatusCard />
    {!wallet.authenticated ? <section className={styles.emptyState}><h2>完成钱包签名后查看档案</h2><p>连接 Monad Testnet 钱包并签名登录后，系统才会读取你的贡献与 Merit。</p></section> : null}
    {wallet.authenticated && error ? <p className={styles.errorMessage} role="status">{error}</p> : null}
    {wallet.authenticated && !cases ? <p className={styles.loading}>正在读取我的贡献与 Merit…</p> : null}
    {wallet.authenticated && cases && merit ? <>
      <section className={styles.profileSummary}>
        <div><span>当前钱包</span><strong>{compactAddress(wallet.walletAddress)}</strong></div>
        <div><span>网络</span><strong>{AUTH_CHAIN_NAME}</strong></div>
        <div><span>贡献值</span><strong>{merit.totalMerit}</strong></div>
        <div><span>贡献总数</span><strong>{cases.length}</strong></div>
      </section>
      <section className={styles.statusGrid} aria-label="案例状态统计">{(Object.keys(STATUS_COPY) as ContributionStatus[]).map((status) => <div key={status}><span>{STATUS_COPY[status]}</span><strong>{statusCounts[status]}</strong></div>)}</section>
      <section className={styles.cultivationProgress} aria-labelledby="cultivation-progress-title"><h2 id="cultivation-progress-title">修炼进度</h2><p>秘境修为记录将在 Quest 完成验证接入后开放。</p></section>
      <section className={styles.caseList} aria-labelledby="my-cases-title"><div className={styles.sectionHeader}><h2 id="my-cases-title">我的异兽献策</h2><Link href="/contribute">前往异兽献策</Link></div>
        {cases.length ? cases.map((item) => <article className={styles.caseCard} key={item.caseId}><div><p className={styles.statusPill} data-status={item.status}>{STATUS_COPY[item.status]}</p><h3>{item.caseName}</h3><p>{item.proposedBestiaryName ?? "未命名异兽"} · {item.formalType ?? "等待分析"}</p></div><CaseFacts item={item}/><div><time dateTime={item.createdAt}>{dateText(item.createdAt)}</time><Link href={`/profile/cases/${item.caseId}`}>查看详情</Link></div></article>) : <div className={styles.emptyState}><h3>尚未完成异兽献策</h3><Link href="/contribute">前往异兽献策</Link></div>}
      </section>
      <section className={styles.meritSection}><h2>Merit 明细</h2>{merit.entries.length ? <ul>{merit.entries.map((entry) => <li key={entry.idempotencyKey}><strong>+{entry.amount}</strong><span>{entry.reason}</span><time dateTime={entry.createdAt}>{dateText(entry.createdAt)}</time></li>)}</ul> : <p className={styles.mutedCopy}>审核收录后结算贡献值。</p>}</section>
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
      <dl className={styles.detailFacts}><div><dt>案例编号</dt><dd><code>{item.caseId}</code></dd></div><div><dt>主属性</dt><dd>{item.primaryElement ?? "待分析"}</dd></div><div><dt>次属性</dt><dd>{item.secondaryElements.join(" · ") || "无"}</dd></div><div><dt>提交时间</dt><dd>{dateText(item.createdAt)}</dd></div><div><dt>更新时间</dt><dd>{dateText(item.updatedAt)}</dd></div></dl>
      {item.status === "changes_requested" ? <p className={styles.notice}>该案例需要修改。贡献者修改提交功能将在后续阶段开放。</p> : null}
      {item.status === "approved" ? <p className={styles.notice}>案例已收录。公开异兽志页面将在后续阶段开放；当前不假设公开条目一定存在。</p> : null}
      <SafeAnalysis analysis={item.analysisJson} />
      <section className={styles.sourceDetails}><h3>源码卷宗</h3><SourceDetails title="漏洞合约源码" source={item.vulnerableSource}/><SourceDetails title="攻击样例源码" source={item.attackSource}/><SourceDetails title="修复合约源码" source={item.fixedSource}/></section>
    </section> : null}
  </ContributorShell>;
}

function SourceDetails({ title, source }: { title: string; source: string }) {
  return <details><summary>{title}</summary>{source ? <pre><code>{source}</code></pre> : <p className={styles.mutedCopy}>本案例未提交此源码。</p>}</details>;
}
