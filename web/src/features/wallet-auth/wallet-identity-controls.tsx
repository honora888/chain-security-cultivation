"use client";

import Link from "next/link";

import { AUTH_CHAIN_ID, AUTH_CHAIN_NAME, useWalletAuth } from "./wallet-auth-provider";
import styles from "./wallet-identity-controls.module.css";

function compactAddress(value: string): string {
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function needsNetworkSwitch(walletAddress: string | null, chainId: number | null): boolean {
  return walletAddress !== null && chainId !== AUTH_CHAIN_ID;
}


/** A compact, shared consumer of the root wallet/session provider for page headers. */
export function WalletIdentityControl() {
  const wallet = useWalletAuth();
  const wrongNetwork = needsNetworkSwitch(wallet.walletAddress, wallet.chainId);

  if (wallet.loading) {
    return <p className={styles.status} aria-live="polite">修仙身份处理中…</p>;
  }

  if (!wallet.walletAddress) {
    return <button className={styles.action} type="button" onClick={() => void wallet.connect()}>连接钱包</button>;
  }

  if (wrongNetwork) {
    return <button className={styles.action} type="button" onClick={() => void wallet.switchNetwork()}>切换 Monad Testnet</button>;
  }

  if (!wallet.authenticated) {
    return (
      <div className={styles.identity}>
        <span>{compactAddress(wallet.walletAddress)}</span>
        <button className={styles.action} type="button" onClick={() => void wallet.signIn()}>签名入世</button>
      </div>
    );
  }

  return (
    <div className={styles.identity}>
      <span className={styles.identityState}>{compactAddress(wallet.walletAddress)} <span aria-hidden="true">·</span> {AUTH_CHAIN_NAME} ✓</span>
      <button className={styles.exit} type="button" onClick={() => void wallet.logout()}>退出登录</button>
    </div>
  );
}

/** Root-provider-powered homepage calls to action. It never opens a wallet until a user clicks. */
export function HomeWalletActions({ className }: { className?: string }) {
  const wallet = useWalletAuth();
  const wrongNetwork = needsNetworkSwitch(wallet.walletAddress, wallet.chainId);

  return (
    <div className={className} aria-label="修仙身份与入口">
      {wallet.loading ? <span aria-live="polite">修仙身份处理中…</span> : null}
      {!wallet.loading && !wallet.walletAddress ? <button type="button" onClick={() => void wallet.connect()}>连接钱包 · 开始修炼</button> : null}
      {!wallet.loading && wrongNetwork ? <button type="button" onClick={() => void wallet.switchNetwork()}>切换 Monad Testnet</button> : null}
      {!wallet.loading && wallet.walletAddress && !wrongNetwork && !wallet.authenticated ? <button type="button" onClick={() => void wallet.signIn()}>签名入世</button> : null}
      {!wallet.loading && wallet.authenticated ? <>
        <Link href="/quests">继续秘境修炼</Link>
        <Link href="/contribute">异兽献策</Link>
        <Link href="/profile">我的修仙档案</Link>
      </> : null}
      {wallet.error ? <p role="status">{wallet.error}</p> : null}
    </div>
  );
}
