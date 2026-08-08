import "server-only";

import { getNeonSql, type NeonSql } from "@/db/client";
import {
  QUEST_ONE_CHAIN,
  queryQuestOneChainStatus,
} from "@/lib/quest-1-chain-status";

import {
  CULTIVATION_CREDENTIAL_SCHEMA_VERSION,
  type CultivationCredential,
  type CultivationCredentialResponse,
} from "./contracts";
import {
  credentialStateForDto,
  deriveCompletionCredentialState,
} from "./credential-state";
import { CultivationHttpError } from "./errors";
import {
  requireAuthenticatedWallet,
  type QuestCompletionRow,
} from "./server";

type ChainQuery = typeof queryQuestOneChainStatus;

function nonNegativeInteger(value: number | string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new CultivationHttpError("DATABASE_UNAVAILABLE");
  }
  return parsed;
}

export async function getQuestOneCompletionWithContext(
  sql: NeonSql,
  walletAddress: string,
): Promise<QuestCompletionRow | null> {
  try {
    const rows = await sql.query(
      `SELECT id, wallet_address, quest_id, exp_awarded, mastery_element,
        mastery_awarded, badge_key, completion_hash, completed_at
       FROM quest_completions
       WHERE wallet_address = $1 AND quest_id = $2
       LIMIT 1`,
      [walletAddress, QUEST_ONE_CHAIN.questId],
    ) as unknown as QuestCompletionRow[];
    return rows[0] ?? null;
  } catch {
    throw new CultivationHttpError("DATABASE_UNAVAILABLE");
  }
}

export async function getQuestOneCredentialWithContext(
  sql: NeonSql,
  walletAddress: string,
  queryChain: ChainQuery = queryQuestOneChainStatus,
): Promise<CultivationCredential> {
  const completion = await getQuestOneCompletionWithContext(sql, walletAddress);
  const chain = await queryChain(walletAddress);
  const state = deriveCompletionCredentialState({
    hasCompletion: completion !== null,
    completionHash: completion?.completion_hash,
    chainCompleted: chain.status.completed,
    reportHash: chain.status.reportHash,
    badgeBalance: chain.status.badgeBalance,
  });

  if (completion && completion.mastery_element !== "Water") {
    throw new CultivationHttpError("DATABASE_UNAVAILABLE");
  }

  return {
    schema: CULTIVATION_CREDENTIAL_SCHEMA_VERSION,
    quest: {
      id: 1,
      name: "噬灵回环兽",
      realm: "金丹期",
      element: "水",
      badgeKey: "water-guardian",
      badgeName: "水系守护者徽记",
    },
    network: {
      name: QUEST_ONE_CHAIN.name,
      chainId: QUEST_ONE_CHAIN.chainId,
      contractAddress: chain.contract.address,
    },
    cultivation: {
      completed: completion !== null,
      completionHash: completion?.completion_hash ?? null,
      completedAt: completion ? new Date(completion.completed_at).toISOString() : null,
      expAwarded: completion ? nonNegativeInteger(completion.exp_awarded) : 0,
      masteryElement: completion ? "Water" : null,
      masteryAwarded: completion ? nonNegativeInteger(completion.mastery_awarded) : 0,
    },
    chain: {
      completed: chain.status.completed,
      reportHash: chain.status.reportHash,
      badgeTokenId: "1",
      badgeBalance: chain.status.badgeBalance,
    },
    credential: {
      state: credentialStateForDto(state),
      hashMatches: state === "VERIFIED",
    },
  };
}

export async function getCurrentQuestOneCredential(): Promise<CultivationCredentialResponse> {
  const walletAddress = await requireAuthenticatedWallet();
  return {
    ok: true,
    schemaVersion: CULTIVATION_CREDENTIAL_SCHEMA_VERSION,
    credential: await getQuestOneCredentialWithContext(getNeonSql(), walletAddress),
  };
}
