import type { ElementName, RealmName } from "@/features/guardian-security/analysis-types";

export const CULTIVATION_COMPLETION_SCHEMA_VERSION = "cultivation-completion-v1" as const;
export const CULTIVATION_PROFILE_SCHEMA_VERSION = "cultivation-profile-v1" as const;
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
