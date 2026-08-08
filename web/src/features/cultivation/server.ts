import "server-only";

import { cookies } from "next/headers";

import { AUTH_COOKIE_NAME } from "@/auth/constants";
import { readSession, walletAddressForDatabase } from "@/auth/server";
import { DatabaseConfigurationError, getNeonSql, type NeonSql } from "@/db/client";
import { QUEST_ONE } from "@/data/quest-1";
import type { ElementName } from "@/features/guardian-security/analysis-types";

import {
  CULTIVATION_COMPLETION_SCHEMA_VERSION,
  CULTIVATION_PROFILE_SCHEMA_VERSION,
  type CultivationProfile,
  type QuestOneCompletionEvidence,
} from "./contracts";
import { CultivationHttpError } from "./errors";
import { cultivatorProgression } from "./progression";
import { prepareQuestOneCompletion } from "./quest-one-completion";

export type QuestCompletionRow = {
  id: string;
  wallet_address: string;
  quest_id: number;
  exp_awarded: number;
  mastery_element: string;
  mastery_awarded: number;
  badge_key: string;
  completion_hash: string;
  completed_at: string | Date;
};

type ProfileAggregateRow = {
  total_exp: number | string | null;
  completed_quest_count: number | string | null;
  metal_mastery: number | string | null;
  wood_mastery: number | string | null;
  water_mastery: number | string | null;
  fire_mastery: number | string | null;
  earth_mastery: number | string | null;
  badge_keys: string[] | null;
};

const COMPLETION_COLUMNS = `id, wallet_address, quest_id, exp_awarded, mastery_element,
  mastery_awarded, badge_key, completion_hash, completed_at`;

function badgeLabel(key: string): string {
  return key === QUEST_ONE.badgeKey ? QUEST_ONE.badge : key;
}

function elementValue(value: string): ElementName {
  if (value === "Metal" || value === "Wood" || value === "Water" || value === "Fire" || value === "Earth") {
    return value;
  }
  throw new CultivationHttpError("DATABASE_UNAVAILABLE");
}

function numberValue(value: number | string | null | undefined): number {
  const parsed = Number(value ?? 0);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new CultivationHttpError("DATABASE_UNAVAILABLE");
  return parsed;
}

async function queryRows<T>(sql: NeonSql, query: string, params: unknown[]): Promise<T[]> {
  return await sql.query(query, params) as unknown as T[];
}

function mapDatabaseError(error: unknown): never {
  if (error instanceof CultivationHttpError) throw error;
  if (error instanceof DatabaseConfigurationError) {
    throw new CultivationHttpError("DATABASE_NOT_CONFIGURED");
  }
  throw new CultivationHttpError("DATABASE_UNAVAILABLE");
}

async function requireAuthenticatedWallet(): Promise<string> {
  const token = (await cookies()).get(AUTH_COOKIE_NAME)?.value;
  if (!token) throw new CultivationHttpError("AUTH_REQUIRED");
  const session = await readSession(token);
  if (!session) throw new CultivationHttpError("AUTH_REQUIRED");
  return walletAddressForDatabase(session.walletAddress);
}

export async function persistQuestOneCompletion(
  sql: NeonSql,
  walletAddress: string,
  evidence: QuestOneCompletionEvidence,
): Promise<{ row: QuestCompletionRow; alreadyCompleted: boolean }> {
  const prepared = prepareQuestOneCompletion(walletAddress, evidence);
  let inserted: QuestCompletionRow[];
  try {
    inserted = await queryRows<QuestCompletionRow>(
      sql,
      `INSERT INTO quest_completions (
         wallet_address, quest_id, exp_awarded, mastery_element,
         mastery_awarded, badge_key, completion_hash
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (wallet_address, quest_id) DO NOTHING
       RETURNING ${COMPLETION_COLUMNS}`,
      [
        prepared.normalizedWallet,
        QUEST_ONE.id,
        QUEST_ONE.exp,
        QUEST_ONE.elementMachine,
        QUEST_ONE.mastery,
        QUEST_ONE.badgeKey,
        prepared.completionHash,
      ],
    );
  } catch (error) {
    return mapDatabaseError(error);
  }
  if (inserted[0]) return { row: inserted[0], alreadyCompleted: false };

  let existing: QuestCompletionRow[];
  try {
    existing = await queryRows<QuestCompletionRow>(
      sql,
      `SELECT ${COMPLETION_COLUMNS}
       FROM quest_completions
       WHERE wallet_address = $1 AND quest_id = $2
       LIMIT 1`,
      [prepared.normalizedWallet, QUEST_ONE.id],
    );
  } catch (error) {
    return mapDatabaseError(error);
  }
  if (!existing[0]) throw new CultivationHttpError("DATABASE_UNAVAILABLE");
  return { row: existing[0], alreadyCompleted: true };
}

export async function getCultivationProfileWithContext(
  sql: NeonSql,
  walletAddress: string,
): Promise<CultivationProfile> {
  const normalizedWallet = walletAddressForDatabase(walletAddress);
  let aggregateRows: ProfileAggregateRow[];
  let recentRows: QuestCompletionRow[];
  try {
    [aggregateRows, recentRows] = await Promise.all([
      queryRows<ProfileAggregateRow>(
        sql,
        `SELECT
           COALESCE(SUM(exp_awarded), 0) AS total_exp,
           COUNT(*) AS completed_quest_count,
           COALESCE(SUM(mastery_awarded) FILTER (WHERE mastery_element = 'Metal'), 0) AS metal_mastery,
           COALESCE(SUM(mastery_awarded) FILTER (WHERE mastery_element = 'Wood'), 0) AS wood_mastery,
           COALESCE(SUM(mastery_awarded) FILTER (WHERE mastery_element = 'Water'), 0) AS water_mastery,
           COALESCE(SUM(mastery_awarded) FILTER (WHERE mastery_element = 'Fire'), 0) AS fire_mastery,
           COALESCE(SUM(mastery_awarded) FILTER (WHERE mastery_element = 'Earth'), 0) AS earth_mastery,
           COALESCE(array_agg(DISTINCT badge_key) FILTER (WHERE badge_key <> ''), ARRAY[]::text[]) AS badge_keys
         FROM quest_completions WHERE wallet_address = $1`,
        [normalizedWallet],
      ),
      queryRows<QuestCompletionRow>(
        sql,
        `SELECT ${COMPLETION_COLUMNS}
         FROM quest_completions WHERE wallet_address = $1
         ORDER BY completed_at DESC LIMIT 20`,
        [normalizedWallet],
      ),
    ]);
  } catch (error) {
    return mapDatabaseError(error);
  }

  const aggregate = aggregateRows[0];
  if (!aggregate) throw new CultivationHttpError("DATABASE_UNAVAILABLE");
  const totalExp = numberValue(aggregate.total_exp);
  const progression = cultivatorProgression(totalExp);
  const badgeKeys = Array.isArray(aggregate.badge_keys) ? aggregate.badge_keys : [];
  return {
    totalExp,
    progression: {
      realm: progression.realm,
      realmStartExp: progression.realmStartExp,
      nextRealm: progression.nextRealm,
      nextRealmExp: progression.nextRealmExp,
      expIntoRealm: progression.expIntoRealm,
      expToNextRealm: progression.expToNextRealm,
      progressPercent: progression.progressPercent,
    },
    completedQuestCount: numberValue(aggregate.completed_quest_count),
    mastery: {
      Metal: numberValue(aggregate.metal_mastery),
      Wood: numberValue(aggregate.wood_mastery),
      Water: numberValue(aggregate.water_mastery),
      Fire: numberValue(aggregate.fire_mastery),
      Earth: numberValue(aggregate.earth_mastery),
    },
    badges: [...new Set(badgeKeys)].sort().map((key) => ({ key, label: badgeLabel(key) })),
    recentCompletions: recentRows.map((row) => ({
      questId: numberValue(row.quest_id),
      expAwarded: numberValue(row.exp_awarded),
      masteryElement: elementValue(row.mastery_element),
      masteryAwarded: numberValue(row.mastery_awarded),
      badgeKey: row.badge_key,
      badgeLabel: badgeLabel(row.badge_key),
      completionHash: row.completion_hash,
      completedAt: new Date(row.completed_at).toISOString(),
    })),
  };
}

export async function completeQuestOne(evidence: QuestOneCompletionEvidence) {
  const walletAddress = await requireAuthenticatedWallet();
  const sql = getNeonSql();
  const persisted = await persistQuestOneCompletion(sql, walletAddress, evidence);
  const profile = await getCultivationProfileWithContext(sql, walletAddress);
  return {
    ok: true as const,
    schemaVersion: CULTIVATION_COMPLETION_SCHEMA_VERSION,
    alreadyCompleted: persisted.alreadyCompleted,
    completion: {
      questId: 1 as const,
      completionHash: persisted.row.completion_hash,
      completedAt: new Date(persisted.row.completed_at).toISOString(),
    },
    awardedThisRequest: {
      exp: persisted.alreadyCompleted ? 0 : QUEST_ONE.exp,
      masteryElement: QUEST_ONE.elementMachine,
      mastery: persisted.alreadyCompleted ? 0 : QUEST_ONE.mastery,
      badgeKey: QUEST_ONE.badgeKey,
      badgeLabel: QUEST_ONE.badge,
    },
    profile,
  };
}

export async function getCurrentCultivationProfile() {
  const walletAddress = await requireAuthenticatedWallet();
  return {
    ok: true as const,
    schemaVersion: CULTIVATION_PROFILE_SCHEMA_VERSION,
    profile: await getCultivationProfileWithContext(getNeonSql(), walletAddress),
  };
}
