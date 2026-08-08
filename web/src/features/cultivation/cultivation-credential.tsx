"use client";

import Image from "next/image";
import { useRef } from "react";

import type {
  CultivationCredential,
  CultivationCredentialState,
} from "./contracts";
import styles from "./cultivation-credential.module.css";

const ASSET_ROOT = "/assets/credential-stage37";

const STATE_VISUALS: Record<Exclude<CultivationCredentialState, "not_earned">, {
  english: string;
  frame: string;
  seal: string;
  support: string;
  title: string;
}> = {
  legacy_credential: {
    english: "LEGACY ON-CHAIN CREDENTIAL",
    frame: `${ASSET_ROOT}/09-seal-frame-legacy.svg`,
    seal: "古契",
    support: "历史链上凭证",
    title: "古 契",
  },
  ready_for_onchain: {
    english: "READY FOR ON-CHAIN",
    frame: `${ASSET_ROOT}/10-seal-frame-ready.svg`,
    seal: "待印",
    support: "修炼功证已成 · Monad 道印未落",
    title: "待 结 印",
  },
  verified: {
    english: "FORMAL CHAIN ATTESTATION",
    frame: `${ASSET_ROOT}/11-seal-frame-verified.svg`,
    seal: "已证",
    support: "SOULBOUND VERIFIED",
    title: "链 上 已 证",
  },
  inconsistent: {
    english: "INSCRIPTION REQUIRES REVIEW",
    frame: `${ASSET_ROOT}/12-seal-frame-inconsistent.svg`,
    seal: "有异",
    support: "链上状态待核验",
    title: "道 印 有 异",
  },
};

function compactHash(value: string | null): string {
  if (!value) return "尚未生成";
  return value.length > 18 ? `${value.slice(0, 8)}...${value.slice(-5)}` : value;
}

function stateVisual(credential: CultivationCredential) {
  return credential.credential.state === "not_earned"
    ? null
    : STATE_VISUALS[credential.credential.state];
}

function Seal({ credential }: { credential: CultivationCredential }) {
  const visual = stateVisual(credential);
  if (!visual) return null;
  return (
    <span className={styles.stateSeal} aria-hidden="true">
      <Image src={visual.frame} alt="" width={180} height={240} />
      <span>{visual.seal}</span>
    </span>
  );
}

function ProofFlow({ credential }: { credential: CultivationCredential }) {
  const state = credential.credential.state;
  const completionHash = compactHash(credential.cultivation.completionHash);
  const reportHash = compactHash(credential.chain.reportHash);

  if (state === "legacy_credential") {
    return (
      <div className={styles.proofFlow}>
        <HashEntry label="古 · 链上道印" field="historical reportHash" value={reportHash} />
        <div className={styles.proofBridge} aria-hidden="true"><span>↓</span></div>
        <HashEntry label="今 · 修炼印记" field="completionHash" value={completionHash} />
        <p className={styles.proofCaption}>「旧契已铭 Monad，新印另存修途。」</p>
      </div>
    );
  }

  const bridge = state === "verified"
    ? "MATCH"
    : state === "ready_for_onchain"
      ? "Monad 道印未落"
      : "MISMATCH · 待核";
  const chainValue = state === "ready_for_onchain" ? "○ 待结印" : reportHash;
  return (
    <div className={styles.proofFlow}>
      <HashEntry label="今 · 修炼印记" field="completionHash" value={completionHash} />
      <div className={styles.proofBridge}><strong>{bridge}</strong></div>
      <HashEntry label="Monad · 链上道印" field="on-chain reportHash" value={chainValue} />
    </div>
  );
}

function HashEntry({ field, label, value }: { field: string; label: string; value: string }) {
  return (
    <div className={styles.hashEntry}>
      <span>{label}</span>
      <small>{field}</small>
      <code>{value}</code>
    </div>
  );
}

function FullCredential({ credential }: { credential: CultivationCredential }) {
  const visual = stateVisual(credential);
  if (!visual) return null;
  const integrity = credential.credential.state === "legacy_credential"
    ? "修炼已录 · 古契存世 · Monad 有印"
    : credential.credential.state === "ready_for_onchain"
      ? "修炼已录 · 功证已成 · Monad 待印"
      : credential.credential.state === "verified"
        ? "修炼已录 · 功证已成 · Monad 已印"
        : "修炼已录 · 链文间断 · 道印待核";

  return (
    <article className={styles.scrollArtifact} data-state={credential.credential.state} aria-labelledby="credential-title">
      <div className={`${styles.scrollRod} ${styles.scrollRodTop}`} aria-hidden="true"><span /></div>
      <div className={styles.credential}>
        <Image className={`${styles.tornEdge} ${styles.tornEdgeTop}`} src={`${ASSET_ROOT}/07-torn-edge-a_transparent.png`} alt="" width={1320} height={150} aria-hidden="true" />
        <Image className={`${styles.tornEdge} ${styles.tornEdgeBottom}`} src={`${ASSET_ROOT}/08-torn-edge-b_transparent.png`} alt="" width={1320} height={150} aria-hidden="true" />
        <div className={styles.paperAge} aria-hidden="true" />
        <header className={styles.credentialHead}>
          <p>MONAD · GUARDIAN QUEST · 001</p>
        </header>

        <section className={styles.beastField} aria-label="噬灵回环兽灵契">
          <h2 id="credential-title" className={styles.verticalTitle}>镇兽灵契</h2>
          <Image className={styles.cloudArt} src={`${ASSET_ROOT}/06-ink-cloud-accent_transparent.png`} alt="" width={960} height={1419} aria-hidden="true" />
          <Image className={styles.beastArt} src={`${ASSET_ROOT}/03-beast-ink-soul_transparent.png`} alt="" width={900} height={1368} aria-hidden="true" priority />
          <Image className={styles.loopArt} src={`${ASSET_ROOT}/04-beast-loop-accent_transparent.png`} alt="" width={1200} height={1200} aria-hidden="true" />
          <Image className={styles.waterArt} src={`${ASSET_ROOT}/05-water-ink-accent_transparent.png`} alt="" width={1200} height={723} aria-hidden="true" />
          <div className={styles.beastName}><strong>噬灵回环兽 · 水</strong><small>CLASSIC REENTRANCY · WATER</small></div>
          <span className={styles.identitySeal} aria-hidden="true">
            <Image src={`${ASSET_ROOT}/17-water-mark.svg`} alt="" width={180} height={240} />
            <span>水</span>
          </span>
        </section>

        <section className={styles.identity} aria-label="灵契身份">
          <h3>水 系 守 护 者</h3>
          <blockquote>「斩回环之兽，得水行之印。」</blockquote>
        </section>

        <dl className={styles.metadata}>
          <div><dt>境界</dt><dd>{credential.quest.realm}</dd></div>
          <div><dt>五行</dt><dd>{credential.quest.element}</dd></div>
          <div><dt>秘境</dt><dd>QUEST I</dd></div>
          <div><dt>凭证</dt><dd>TOKEN #1</dd></div>
        </dl>

        <section className={styles.stateZone} aria-label={`凭证状态：${visual.title.replaceAll(" ", "")}`}>
          <Seal credential={credential} />
          <div className={styles.stateCopy}>
            <small>{visual.english}</small>
            <h3>{visual.title}</h3>
            <p>{visual.support}</p>
          </div>
          <Image className={styles.monadSeal} src={`${ASSET_ROOT}/13-seal-monad.svg`} alt="" width={200} height={200} aria-hidden="true" />
        </section>

        <section className={styles.proof} aria-labelledby="credential-proof-title">
          <small>ARCHIVAL PROVENANCE</small>
          <h3 id="credential-proof-title">链 上 存 证</h3>
          <ProofFlow credential={credential} />
          <div className={styles.chainMeta}>
            <span>{credential.network.name.toUpperCase()} · CHAIN {credential.network.chainId}</span>
            <span>GuardianQuest · {compactHash(credential.network.contractAddress)} · TOKEN #{credential.chain.badgeTokenId}</span>
            <span>ERC-1155 · SOULBOUND</span>
          </div>
          <p className={styles.integrity}>{integrity}</p>
        </section>

        <footer className={styles.credentialFoot}>
          <span>壹号镇兽灵契 · 不可转移凭证</span>
          <span>READ ONLY · ARCHIVE COPY</span>
        </footer>
      </div>
      <div className={`${styles.scrollRod} ${styles.scrollRodBottom}`} aria-hidden="true"><span /></div>
    </article>
  );
}

export function CultivationCredentialCard({
  credential,
  error,
  loading,
}: {
  credential: CultivationCredential | null;
  error: string | null;
  loading: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const visual = credential ? stateVisual(credential) : null;

  if (loading) return <div className={styles.miniPlaceholder}>正在读取镇兽灵契……</div>;
  if (error) return <div className={styles.miniPlaceholder} role="status">镇兽灵契暂时无法读取。<small>{error}</small></div>;
  if (!credential || !visual) {
    return <div className={styles.miniPlaceholder}>完成秘境 Quest 001 后，镇兽灵契将在此归档。</div>;
  }

  function openCredential() {
    dialogRef.current?.showModal();
  }

  function closeCredential() {
    dialogRef.current?.close();
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={styles.miniCredential}
        onClick={openCredential}
        aria-haspopup="dialog"
      >
        <Image className={styles.miniBeast} src={`${ASSET_ROOT}/03-beast-ink-soul_transparent.png`} alt="" width={900} height={1368} aria-hidden="true" />
        <strong className={styles.miniTitle}>镇兽灵契</strong>
        <span className={styles.miniCopy}>
          <strong>水系守护者</strong>
          <span>噬灵回环兽 · 金丹期 · 水</span>
          <em>{visual.title.replaceAll(" ", "")} · 当前状态</em>
          <b>查看镇兽灵契 →</b>
        </span>
      </button>
      <dialog
        ref={dialogRef}
        className={styles.dialog}
        aria-labelledby="credential-dialog-title"
        onClose={() => triggerRef.current?.focus()}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            closeCredential();
          }
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) closeCredential();
        }}
      >
        <div className={styles.dialogHeader}>
          <span id="credential-dialog-title">镇兽灵契 · GuardianQuest Credential</span>
          <button type="button" onClick={closeCredential}>关闭</button>
        </div>
        <div className={styles.dialogStage}>
          <FullCredential credential={credential} />
        </div>
      </dialog>
    </>
  );
}
