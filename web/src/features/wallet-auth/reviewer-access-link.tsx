"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useWalletAuth } from "./wallet-auth-provider";
import styles from "./wallet-identity-controls.module.css";

/** Shows the restricted reviewer route only after the server confirms the role. */
export function ReviewerAccessLink() {
  const wallet = useWalletAuth();
  const [reviewer, setReviewer] = useState(false);

  useEffect(() => {
    let active = true;
    if (!wallet.authenticated || !wallet.walletAddress) {
      return () => { active = false; };
    }

    void fetch("/api/reviews/capability", {
      credentials: "include",
      cache: "no-store",
      headers: { Accept: "application/json" },
    }).then(async (response) => {
      const value: unknown = await response.json().catch(() => null);
      if (!active || !response.ok || typeof value !== "object" || value === null || Array.isArray(value)) return;
      const body = value as Record<string, unknown>;
      setReviewer(body.ok === true && body.authenticated === true && body.reviewer === true);
    }).catch(() => {
      if (active) setReviewer(false);
    });

    return () => { active = false; };
  }, [wallet.authenticated, wallet.walletAddress]);

  return wallet.authenticated && wallet.walletAddress && reviewer
    ? <>
      <span className={styles.reviewerBadge} title="守阁权限：已验证">守阁人</span>
      <Link className={styles.action} href="/review" aria-label="守阁权限：已验证，进入守阁人审核台">守阁人审核台</Link>
    </>
    : null;
}
