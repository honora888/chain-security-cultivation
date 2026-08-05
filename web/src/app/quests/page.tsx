import type { Metadata } from "next";
import Link from "next/link";

import { QuestRealmExplorer } from "@/features/quest-catalog/quest-realm-explorer";

import styles from "@/features/quest-catalog/quest-catalog.module.css";

export const metadata: Metadata = {
  title: "五行秘境图鉴｜链安修仙录",
  description:
    "循五行查异兽，选择已收录的安全 Quest，复现攻击、完成修复并提交验证证据。",
};

export default function QuestCatalogPage() {
  return (
    <div className={styles.catalogPage}>
      <picture className={styles.realmBackdrop}>
        <source
          media="(max-width: 760px)"
          srcSet="/quests/realms/realm-cloudscape-mobile.webp"
        />
        <img
          src="/quests/realms/realm-cloudscape-desktop.webp"
          alt=""
          draggable={false}
        />
      </picture>

      <header className={styles.catalogHeader}>
        <Link
          className={styles.catalogBrand}
          href="/"
          aria-label="返回链安修仙录首页"
        >
          <span aria-hidden="true">链安</span>
          <span>
            <strong>链安修仙录</strong>
            <small>五行秘境图鉴</small>
          </span>
        </Link>

        <nav className={styles.catalogNav} aria-label="主要导航">
          <Link href="/quests" aria-current="page">
            秘境图鉴
          </Link>
          <Link href="/guardian-agent">异兽献策</Link>
        </nav>
      </header>

      <main className={styles.catalogMain}>
        <section className={styles.catalogHero} aria-labelledby="catalog-title">
          <p className={styles.eyebrow}>SECURITY QUEST REALMS</p>
          <h1 id="catalog-title">五行秘境图鉴</h1>
          <p>
            循五行查异兽，入秘境证修为。
            <br />
            选择已收录的安全 Quest，复现攻击、完成修复，并通过证据与链上验证证明你的理解。
          </p>
        </section>

        <QuestRealmExplorer />
      </main>
    </div>
  );
}
