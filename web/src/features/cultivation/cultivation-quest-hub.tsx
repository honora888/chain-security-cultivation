"use client";

import { useEffect, useState } from "react";

import { cultivationElementLabel, cultivationRealmLabel } from "@/features/guardian-security/cultivation-labels";
import { QuestRealmExplorer } from "@/features/quest-catalog/quest-realm-explorer";
import { useWalletAuth } from "@/features/wallet-auth/wallet-auth-provider";

import { getCultivationProfile } from "./cultivation-api-client";
import type { CultivationProfile } from "./contracts";
import { cultivatorProgression } from "./progression";
import styles from "./cultivation-ui.module.css";

const ELEMENTS = ["Metal", "Wood", "Water", "Fire", "Earth"] as const;

export function CultivationQuestHub() {
  const wallet = useWalletAuth();
  const [profileResult, setProfileResult] = useState<{
    walletAddress: string;
    profile: CultivationProfile;
  } | null>(null);
  const [errorResult, setErrorResult] = useState<{ walletAddress: string; message: string } | null>(null);
  const currentWallet = wallet.walletAddress?.toLowerCase() ?? "";
  const profile = wallet.authenticated && profileResult?.walletAddress === currentWallet
    ? profileResult.profile
    : null;
  const error = wallet.authenticated && errorResult?.walletAddress === currentWallet
    ? errorResult.message
    : null;
  const loading = wallet.authenticated && profile === null && error === null;
  const fallback = cultivatorProgression(0);
  const progression = profile?.progression ?? fallback;

  useEffect(() => {
    if (!wallet.authenticated || !currentWallet) return;
    const controller = new AbortController();
    void getCultivationProfile(controller.signal)
      .then((nextProfile) => {
        setProfileResult({ walletAddress: currentWallet, profile: nextProfile });
        setErrorResult(null);
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setErrorResult({ walletAddress: currentWallet, message: "修炼档案暂时无法载入，请稍后重试。" });
        }
      });
    return () => controller.abort();
  }, [currentWallet, wallet.authenticated]);

  return (
    <>
      <section className={styles.cultivationProfile} aria-labelledby="cultivation-profile-title">
        <div className={styles.profileHeading}>
          <div>
            <p>CULTIVATOR PROGRESSION</p>
            <h2 id="cultivation-profile-title">我的修炼</h2>
          </div>
          {!wallet.authenticated ? <span>签名入世后保存修炼所得</span> : null}
        </div>

        <div className={styles.realmSummary}>
          <div>
            <span>当前境界</span>
            <strong>{cultivationRealmLabel(progression.realm)}</strong>
          </div>
          <div>
            <span>修为</span>
            <strong>{profile?.totalExp ?? 0} / {progression.nextRealmExp ?? "圆满"} EXP</strong>
          </div>
          <div>
            <span>已降伏异兽</span>
            <strong>{profile?.completedQuestCount ?? 0}</strong>
          </div>
        </div>

        <div className={styles.expProgress}>
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
            ? `距离${cultivationRealmLabel(progression.nextRealm)}还需 ${progression.expToNextRealm} EXP`
            : "当前已达渡劫期"}</p>
        </div>

        <div className={styles.masterySummary}>
          <h3>五行熟练度</h3>
          <dl>
            {ELEMENTS.map((element) => (
              <div key={element}>
                <dt>{cultivationElementLabel(element)}</dt>
                <dd>{profile?.mastery[element] ?? 0}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className={styles.badgeSummary}>
          <h3>徽记</h3>
          <p>{profile?.badges.length
            ? profile.badges.map((badge) => badge.label).join("、")
            : "尚未获得徽记"}</p>
        </div>

        {loading ? <p className={styles.profileStatus} role="status">正在载入修炼档案…</p> : null}
        {error ? <p className={styles.profileError} role="alert">{error}</p> : null}
      </section>

      <QuestRealmExplorer cultivatorRealm={progression.realm} />
    </>
  );
}
