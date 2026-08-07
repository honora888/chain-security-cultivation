import Link from "next/link";

import styles from "@/features/guardian-security-ui/guardian-security-ui.module.css";
import { WalletIdentityControl } from "@/features/wallet-auth/wallet-identity-controls";

/** Public explanation of Guardian's role; the only contribution form lives at /contribute. */
export function GuardianAgentOverview() {
  return (
    <div className={styles.workbenchPage}>
      <header className={styles.siteHeader}>
        <Link className={styles.brand} href="/" aria-label="返回链安修仙录首页">
          <span className={styles.brandSeal} aria-hidden="true">链安</span>
          <span className={styles.brandCopy}>
            <strong>链安修仙录</strong>
            <small>Guardian Security Agent</small>
          </span>
        </Link>
        <nav className={styles.topNav} aria-label="主要导航">
          <Link href="/quests">秘境修炼</Link>
          <Link href="/bestiary">异兽志</Link>
          <Link href="/contribute">异兽献策</Link>
          <Link href="/profile">我的修仙档案</Link>
        </nav>
        <WalletIdentityControl />
      </header>

      <main className={styles.workbenchMain}>
        <section className={styles.workbenchHero} aria-labelledby="guardian-agent-title">
          <div>
            <p className={styles.kicker}>Guardian Security Agent</p>
            <h1 id="guardian-agent-title">安全案例鉴定</h1>
            <p>Guardian 对提交的受限源码文本进行确定性模式分析，协助生成待人工审核的异兽志与 Quest 草案。</p>
          </div>
          <ul className={styles.statusTags} aria-label="Guardian 工作边界">
            <li>Deterministic Rules</li>
            <li>No External Model</li>
            <li>Source Text Only</li>
            <li>Human Review Required</li>
          </ul>
        </section>

        <section className={styles.guardianGuide} aria-labelledby="guardian-contribution-title">
          <h2 id="guardian-contribution-title">异兽献策</h2>
          <p>提交真实漏洞案例与证据，经 Guardian 鉴定和人工审核后，有机会收录进《异兽志》并获得 Merit。分析不编译、执行或广播提交的合约。</p>
          <ul>
            <li>提交漏洞源码、攻击样例与可选修复对照。</li>
            <li>生成待审核的分析与内容草案。</li>
            <li>由审核者决定是否收录及贡献值。</li>
          </ul>
          <Link className={styles.guardianGuideLink} href="/contribute">前往异兽献策</Link>
        </section>
      </main>
    </div>
  );
}
