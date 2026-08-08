import type { RealmName } from "@/features/guardian-security/analysis-types";
import { CULTIVATION_REALM_VALUES } from "@/features/guardian-security/cultivation-labels";

export const CULTIVATOR_REALM_THRESHOLDS = [
  { realm: "Qi Refining", exp: 0 },
  { realm: "Foundation Establishment", exp: 1_000 },
  { realm: "Core Formation", exp: 3_000 },
  { realm: "Nascent Soul", exp: 7_000 },
  { realm: "Spirit Transformation", exp: 15_000 },
  { realm: "Mahayana", exp: 30_000 },
  { realm: "Tribulation", exp: 60_000 },
] as const satisfies readonly { realm: RealmName; exp: number }[];

export type CultivatorProgression = {
  totalExp: number;
  realm: RealmName;
  realmStartExp: number;
  nextRealm: RealmName | null;
  nextRealmExp: number | null;
  expIntoRealm: number;
  expToNextRealm: number;
  progressPercent: number;
};

export type ChallengeRelationship = "available" | "one-above" | "two-above" | "insufficient";

function normalizedExp(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.floor(value);
}

export function cultivatorProgression(value: number): CultivatorProgression {
  const totalExp = normalizedExp(value);
  let index = 0;
  for (let candidate = 1; candidate < CULTIVATOR_REALM_THRESHOLDS.length; candidate += 1) {
    if (totalExp < CULTIVATOR_REALM_THRESHOLDS[candidate].exp) break;
    index = candidate;
  }

  const current = CULTIVATOR_REALM_THRESHOLDS[index];
  const next = CULTIVATOR_REALM_THRESHOLDS[index + 1] ?? null;
  const expIntoRealm = totalExp - current.exp;
  const expToNextRealm = next ? Math.max(0, next.exp - totalExp) : 0;
  const span = next ? next.exp - current.exp : 0;
  const progressPercent = next
    ? Math.min(100, Math.max(0, (expIntoRealm / span) * 100))
    : 100;

  return {
    totalExp,
    realm: current.realm,
    realmStartExp: current.exp,
    nextRealm: next?.realm ?? null,
    nextRealmExp: next?.exp ?? null,
    expIntoRealm,
    expToNextRealm,
    progressPercent,
  };
}

function realmIndex(realm: RealmName): number {
  return CULTIVATION_REALM_VALUES.indexOf(realm);
}

export function challengeRelationship(
  cultivatorRealm: RealmName,
  beastRealm: RealmName,
): ChallengeRelationship {
  const difference = realmIndex(beastRealm) - realmIndex(cultivatorRealm);
  if (difference <= 0) return "available";
  if (difference === 1) return "one-above";
  if (difference === 2) return "two-above";
  return "insufficient";
}

export function canChallengeRealm(cultivatorRealm: RealmName, beastRealm: RealmName): boolean {
  return challengeRelationship(cultivatorRealm, beastRealm) !== "insufficient";
}

export function challengeRelationshipLabel(value: ChallengeRelationship): string {
  if (value === "one-above") return "越一阶挑战";
  if (value === "two-above") return "越二阶挑战";
  if (value === "insufficient") return "境界不足";
  return "可挑战";
}
