import {
  QUEST_ONE_ATTACK_REPLAY_STEPS,
  QUEST_ONE_REPAIR_BLOCKS,
} from "@/data/quest-1";
import { QUEST_CATALOG } from "@/features/quest-catalog/quest-catalog";
import { QUEST_ONE_PUBLIC_KNOWN_LIMITATIONS } from "@/features/guardian-security/public-bestiary-copy";

import type {
  BestiarySeverity,
  PublishedBestiaryEntry,
  UnifiedBestiaryEntry,
} from "./bestiary-types";
import { BESTIARY_SEVERITIES } from "./bestiary-types";

type CanonicalQuestProfile = {
  confidence: string;
  prerequisites: readonly string[];
  impact: string;
  knownLimitations: readonly string[];
  sourceCaseId?: string;
};

// Legacy Quest 1 predates the contribution database. This supplement binds
// reviewed Quest evidence to the real catalog identity without inventing a caseId.
const CANONICAL_QUEST_PROFILES: Readonly<Record<string, CanonicalQuestProfile>> = {
  "quest-1-reentrancy": {
    confidence: "High",
    prerequisites: [
      "金库为调用者记录可提款余额。",
      "提款在内部余额清零前向外部地址转移原生资产。",
      "接收方可在 receive 回调中再次进入 withdraw。",
    ],
    impact:
      "攻击回环可在账本清零前重复提款，使金库余额被持续抽离。",
    knownLimitations: QUEST_ONE_PUBLIC_KNOWN_LIMITATIONS,
  },
};

function canonicalEntries(): readonly (UnifiedBestiaryEntry & {
  canonicalCaseId: string | null;
})[] {
  return QUEST_CATALOG.flatMap((quest) => {
    const profile = CANONICAL_QUEST_PROFILES[quest.id];
    const severity = BESTIARY_SEVERITIES.find((item) => item === quest.severity);
    if (!profile || quest.status !== "open" || !severity) return [];

    return [{
      entryId: quest.id,
      identityKind: "canonical-quest" as const,
      caseId: null,
      canonicalCaseId: profile.sourceCaseId ?? null,
      displayName: quest.title,
      formalType: quest.formalType,
      primaryElement: quest.primaryElement ?? null,
      secondaryElements: quest.secondaryElements ?? [],
      realm: quest.realm,
      realmLabel: quest.realmLabel,
      severity: severity as BestiarySeverity,
      confidence: profile.confidence,
      contributorAddress: null,
      reviewerAddress: null,
      approvedAt: null,
      publicationStatus: "published" as const,
      questConversionStatus: "registered_on_monad" as const,
      summary: quest.summary,
      attackPattern: QUEST_ONE_ATTACK_REPLAY_STEPS.map(
        (step) => `${step.title}：${step.funds}`,
      ),
      prerequisites: profile.prerequisites,
      impact: profile.impact,
      mitigations: QUEST_ONE_REPAIR_BLOCKS.map(
        (block) => `${block.englishName}：${block.purpose}`,
      ),
      knownLimitations: profile.knownLimitations,
      sourceDisclosure: "summary_only" as const,
      questNumber: quest.questNumber,
      questHref: quest.href,
    }];
  });
}

function publishedEntry(
  entry: PublishedBestiaryEntry,
  quest: ReturnType<typeof canonicalEntries>[number] | undefined,
): UnifiedBestiaryEntry {
  return {
    ...entry,
    entryId: entry.caseId,
    identityKind: "published-case",
    realmLabel: null,
    reviewerAddress: null,
    questNumber: quest?.questNumber ?? null,
    questHref:
      quest?.questHref ??
      (entry.questConversionStatus === "registered_on_monad" ? "/quests" : null),
  };
}

export function getCanonicalBestiaryEntry(
  entryId: string,
): UnifiedBestiaryEntry | null {
  const entry = canonicalEntries().find((item) => item.entryId === entryId);
  if (!entry) return null;
  const { canonicalCaseId, ...publicEntry } = entry;
  void canonicalCaseId;
  return publicEntry;
}

export function mergeBestiaryEntries(
  published: readonly PublishedBestiaryEntry[],
): readonly UnifiedBestiaryEntry[] {
  const canonical = canonicalEntries();
  const canonicalByCaseId = new Map(
    canonical
      .filter((entry) => entry.canonicalCaseId !== null)
      .map((entry) => [entry.canonicalCaseId as string, entry] as const),
  );

  const publishedEntries = published.map((entry) =>
    publishedEntry(entry, canonicalByCaseId.get(entry.caseId)),
  );
  const publishedCaseIds = new Set(published.map((entry) => entry.caseId));
  const standaloneCanonical = canonical
    .filter(
      (entry) =>
        entry.canonicalCaseId === null ||
        !publishedCaseIds.has(entry.canonicalCaseId),
    )
    .map(({ canonicalCaseId, ...entry }) => {
      void canonicalCaseId;
      return entry;
    });

  return [...publishedEntries, ...standaloneCanonical];
}
