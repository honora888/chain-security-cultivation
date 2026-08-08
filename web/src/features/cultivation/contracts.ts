import type { ElementName, RealmName } from "@/features/guardian-security/analysis-types";

export const CULTIVATION_COMPLETION_SCHEMA_VERSION = "cultivation-completion-v1" as const;
export const CULTIVATION_PROFILE_SCHEMA_VERSION = "cultivation-profile-v1" as const;
export const CULTIVATION_CREDENTIAL_SCHEMA_VERSION = "cultivation-credential-v1" as const;
export const QUEST_ONE_COMPLETION_EVIDENCE_SCHEMA_VERSION = "quest-1-completion-evidence-v1" as const;

export type QuestOneCompletionEvidence = {
  schemaVersion: typeof QUEST_ONE_COMPLETION_EVIDENCE_SCHEMA_VERSION;
  selectedCodeLineId: string;
  classification: {
    vulnerability: string;
    element: string;
    risk: string;
  };
  viewedReplaySteps: number[];
  repairOrder: string[];
};

export type CultivationMastery = Record<ElementName, number>;

export type CultivationProfile = {
  totalExp: number;
  progression: {
    realm: RealmName;
    realmStartExp: number;
    nextRealm: RealmName | null;
    nextRealmExp: number | null;
    expIntoRealm: number;
    expToNextRealm: number;
    progressPercent: number;
  };
  completedQuestCount: number;
  mastery: CultivationMastery;
  badges: readonly { key: string; label: string }[];
  recentCompletions: readonly {
    questId: number;
    expAwarded: number;
    masteryElement: ElementName;
    masteryAwarded: number;
    badgeKey: string;
    badgeLabel: string;
    completionHash: string;
    completedAt: string;
  }[];
};

export type CultivationProfileResponse = {
  ok: true;
  schemaVersion: typeof CULTIVATION_PROFILE_SCHEMA_VERSION;
  profile: CultivationProfile;
};

export type CultivationCompletionResponse = {
  ok: true;
  schemaVersion: typeof CULTIVATION_COMPLETION_SCHEMA_VERSION;
  alreadyCompleted: boolean;
  completion: {
    questId: 1;
    completionHash: string;
    completedAt: string;
  };
  awardedThisRequest: {
    exp: number;
    masteryElement: "Water";
    mastery: number;
    badgeKey: "water-guardian";
    badgeLabel: string;
  };
  profile: CultivationProfile;
};

export type CultivationCredentialState =
  | "not_earned"
  | "ready_for_onchain"
  | "verified"
  | "legacy_credential"
  | "inconsistent";

export type CultivationCredential = {
  schema: typeof CULTIVATION_CREDENTIAL_SCHEMA_VERSION;
  quest: {
    id: 1;
    name: "噬灵回环兽";
    realm: "金丹期";
    element: "水";
    badgeKey: "water-guardian";
    badgeName: "水系守护者徽记";
  };
  network: {
    name: "Monad Testnet";
    chainId: 10143;
    contractAddress: string;
  };
  cultivation: {
    completed: boolean;
    completionHash: string | null;
    completedAt: string | null;
    expAwarded: number;
    masteryElement: "Water" | null;
    masteryAwarded: number;
  };
  chain: {
    completed: boolean;
    reportHash: string;
    badgeTokenId: "1";
    badgeBalance: string;
  };
  credential: {
    state: CultivationCredentialState;
    hashMatches: boolean;
  };
};

export type CultivationCredentialResponse = {
  ok: true;
  schemaVersion: typeof CULTIVATION_CREDENTIAL_SCHEMA_VERSION;
  credential: CultivationCredential;
};
