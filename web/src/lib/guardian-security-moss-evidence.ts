import "server-only";

import {
  Registry,
  createRuntime,
  type AddressValue,
  type JsonSafeValue,
} from "@themoss/core";
import {
  GUARDIAN_PROTOCOL_NAME,
  GUARDIAN_QUEST_ADDRESS,
  Guardian,
  MONAD_TESTNET_CHAIN_ID,
} from "@themoss/protocol-guardian";
import { isAddress } from "viem";

import {
  GuardianSecurityError,
  type MossVerifiedEvidence,
} from "@/features/guardian-security/analysis-types";
import { QUEST_ONE_CONTENT_HASH } from "@/features/guardian-security/quest-one-evidence";

const QUEST_ID = "1" as const;
const NETWORK_NAME = "Monad Testnet" as const;
const QUERY_ACCOUNT =
  "0x0000000000000000000000000000000000000000" as AddressValue;
const MOSS_SOURCE_COMMIT =
  "07b673844f8ca14e992c6dfe305c83018114a791" as const;
const BYTES32_PATTERN = /^0x[0-9a-fA-F]{64}$/;
const DECIMAL_INTEGER_PATTERN = /^(?:0|[1-9]\d*)$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function readRpcConfiguration(): string {
  const rpcUrl = process.env.MONAD_RPC_URL?.trim();
  const configuredChainId = process.env.MONAD_CHAIN_ID?.trim();
  const configuredAddress = process.env.GUARDIAN_QUEST_ADDRESS?.trim();

  if (!rpcUrl || !configuredChainId || !configuredAddress) {
    throw new GuardianSecurityError("CHAIN_NOT_CONFIGURED");
  }

  let parsedRpcUrl: URL;
  try {
    parsedRpcUrl = new URL(rpcUrl);
  } catch {
    throw new GuardianSecurityError("CHAIN_NOT_CONFIGURED");
  }

  if (
    (parsedRpcUrl.protocol !== "https:" && parsedRpcUrl.protocol !== "http:") ||
    !isAddress(configuredAddress) ||
    configuredAddress.toLowerCase() !== GUARDIAN_QUEST_ADDRESS.toLowerCase()
  ) {
    throw new GuardianSecurityError("CHAIN_NOT_CONFIGURED");
  }

  if (configuredChainId !== String(MONAD_TESTNET_CHAIN_ID)) {
    throw new GuardianSecurityError("CHAIN_ID_MISMATCH");
  }

  return rpcUrl;
}

function isRuntimeChainMismatch(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.startsWith(
      `Moss requires Monad chain ID ${MONAD_TESTNET_CHAIN_ID}; RPC reported `,
    )
  );
}

function parseQuestResult(data: JsonSafeValue): {
  questId: "1";
  contentHash: string;
  metadataURI: string;
  active: boolean;
} {
  if (
    !isRecord(data) ||
    data.questId !== QUEST_ID ||
    typeof data.contentHash !== "string" ||
    !BYTES32_PATTERN.test(data.contentHash) ||
    typeof data.metadataURI !== "string" ||
    typeof data.active !== "boolean" ||
    typeof data.totalFunded !== "string" ||
    !DECIMAL_INTEGER_PATTERN.test(data.totalFunded)
  ) {
    throw new GuardianSecurityError("CHAIN_EVIDENCE_MISMATCH");
  }

  if (data.contentHash.toLowerCase() !== QUEST_ONE_CONTENT_HASH.toLowerCase()) {
    throw new GuardianSecurityError("CHAIN_EVIDENCE_MISMATCH");
  }

  return {
    questId: QUEST_ID,
    contentHash: data.contentHash,
    metadataURI: data.metadataURI,
    active: data.active,
  };
}

export async function queryBuiltinGuardianEvidence(): Promise<MossVerifiedEvidence> {
  const rpcUrl = readRpcConfiguration();
  let registry: Registry;

  try {
    const runtime = await createRuntime({
      rpcUrl,
      expectedChainId: MONAD_TESTNET_CHAIN_ID,
    });
    registry = new Registry(runtime).use(Guardian);
  } catch (error) {
    if (isRuntimeChainMismatch(error)) {
      throw new GuardianSecurityError("CHAIN_ID_MISMATCH");
    }
    throw new GuardianSecurityError("CHAIN_EVIDENCE_UNAVAILABLE");
  }

  try {
    const result = await registry.action(
      GUARDIAN_PROTOCOL_NAME,
      "quest",
      QUERY_ACCOUNT,
      { questId: QUEST_ID },
    );
    if (result.kind !== "query") {
      throw new GuardianSecurityError("CHAIN_EVIDENCE_MISMATCH");
    }
    const quest = parseQuestResult(result.data);

    return {
      status: "verified",
      protocol: GUARDIAN_PROTOCOL_NAME,
      query: "guardian.quest",
      sourceCommit: MOSS_SOURCE_COMMIT,
      network: {
        name: NETWORK_NAME,
        chainId: MONAD_TESTNET_CHAIN_ID,
      },
      contract: { address: GUARDIAN_QUEST_ADDRESS },
      quest,
      expectedContentHash: QUEST_ONE_CONTENT_HASH,
      contentHashMatches: true,
      verifiedAt: new Date().toISOString(),
    };
  } catch (error) {
    if (error instanceof GuardianSecurityError) throw error;
    throw new GuardianSecurityError("CHAIN_EVIDENCE_UNAVAILABLE");
  }
}
