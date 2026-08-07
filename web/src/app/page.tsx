import type { Metadata } from "next";
import Link from "next/link";

import { RecentBestiaryArchive } from "@/features/bestiary-ui/bestiary-pages";
import styles from "@/features/guardian-security-ui/guardian-security-ui.module.css";
import { WalletIdentityControl } from "@/features/wallet-auth/wallet-identity-controls";
import { ReviewerAccessLink } from "@/features/wallet-auth/reviewer-access-link";

export const metadata: Metadata = {
  title: "链安修仙录",
  description:
    "复现真实智能合约漏洞、完成修复与链上验证，或提交新的安全案例进入人工审核。",
};

const statusTags = [
  "Monad Testnet",
  "Evidence-driven",
  "Moss Protocol Guardrails",
  "Human-reviewed Contributions",
] as const;

export default function Home() {
  return (
    <div className={styles.homePage}>
      <header className={styles.siteHeader}>
        <Link className={styles.brand} href="/" aria-label="链安修仙录首页">
          <span className={styles.brandSeal} aria-hidden="true">
            链安
          </span>
          <span className={styles.brandCopy}>
            <strong>链安修仙录</strong>
            <small>智能合约安全修炼场</small>
          </span>
        </Link>
        <nav className={styles.topNav} aria-label="主要导航">
          <Link href="/quests">秘境修炼</Link>
          <Link href="/bestiary">异兽志</Link>
          <Link href="/contribute">异兽献策</Link>
          <Link href="/profile">我的修仙档案</Link>
        </nav>
        <div className={styles.identityCluster}>
          <WalletIdentityControl />
          <ReviewerAccessLink />
        </div>
      </header>

      <main className={styles.homeMain}>
        <section className={styles.homeHero} aria-labelledby="home-title">
          <p className={styles.kicker}>Smart Contract Security Cultivation</p>
          <h1 id="home-title">链安修仙录</h1>
          <p className={styles.homeMotto}>以攻为鉴，以修证道</p>
          <p className={styles.homeLead}>
            复现真实智能合约漏洞，完成修复与链上验证；也可以提交新的漏洞与攻击样例，共同扩充异兽志与安全 Quest。
          </p>
          <ul className={styles.statusTags} aria-label="平台能力">
            {statusTags.map((tag) => (
              <li key={tag}>{tag}</li>
            ))}
          </ul>
          <div className={styles.homeWalletActions} aria-label="产品入口">
            <Link href="/quests">开始秘境修炼</Link>
            <Link href="/contribute">异兽献策</Link>
            <Link href="/profile">我的修仙档案</Link>
          </div>
        </section>

        <section className={styles.pathGrid} aria-label="选择修炼路径">
          <article className={styles.pathCard} data-path="cultivation">
            <div className={styles.pathCardHeading}>
              <span>已收录 Quest</span>
              <strong aria-hidden="true">01</strong>
            </div>
            <h2>秘境修炼</h2>
            <p>
              进入已收录的安全 Quest，复现攻击、完成修复并验证你的理解。
            </p>
            <ol className={styles.pathSteps}>
              <li>识别危险代码</li>
              <li>回放攻击路径</li>
              <li>完成修复与凭证核验</li>
            </ol>
            <Link className={styles.primaryLink} href="/quests">
              开始修炼
              <span aria-hidden="true">→</span>
            </Link>
          </article>

          <article className={styles.pathCard} data-path="contribution">
            <div className={styles.pathCardHeading}>
              <span>安全贡献</span>
              <strong aria-hidden="true">02</strong>
            </div>
            <h2>异兽献策</h2>
            <p>
              提交漏洞合约、攻击样例与修复对照，由 Guardian Security Agent 生成待审核的安全案例草案。审核收录后结算贡献值。
            </p>
            <ol className={styles.pathSteps}>
              <li>提交受限源码文本</li>
              <li>生成异兽志与 Quest 草案</li>
              <li>进入人工证据审核</li>
            </ol>
            <Link className={styles.secondaryLink} href="/contribute">
              异兽献策
              <span aria-hidden="true">→</span>
            </Link>
          </article>
        </section>

        <RecentBestiaryArchive />
      </main>

      <footer className={styles.homeFooter}>
        <div className={styles.pathLoop} data-path="cultivation">
          <strong>修炼已有 Quest</strong>
          <span aria-hidden="true">→</span>
          <span>复现与修复</span>
          <span aria-hidden="true">→</span>
          <span>链上验证</span>
        </div>
        <div className={styles.pathLoop} data-path="contribution">
          <strong>异兽献策</strong>
          <span aria-hidden="true">→</span>
          <span>Agent 编纂草案</span>
          <span aria-hidden="true">→</span>
          <span>人工收录</span>
        </div>
      </footer>
    </div>
  );
}
