import "server-only";

import {
  Registry,
  createRuntime,
  flattenCapabilityTree,
  toJsonSafe,
  type AddressValue,
  type CapabilityNode,
  type JsonSafeValue as MossJsonSafeValue,
  type Receipt,
  type UnsignedTx,
} from "@themoss/core";
import {
  GUARDIAN_PROTOCOL_NAME,
  GUARDIAN_QUEST_ADDRESS,
  Guardian,
  MONAD_TESTNET_CHAIN_ID,
  type GuardianQuestData,
} from "@themoss/protocol-guardian";
import {
  createTraceSimulator,
  type Warning,
} from "@themoss/simulator";
import {
  getAddress,
  isAddress,
  isHex,
  maxUint256,
  parseUnits,
} from "viem";

import type {
  GuardianAgentErrorCode,
  GuardianAgentFailure,
  GuardianPrepareRequest,
  GuardianPrepareSuccess,
  GuardianQuestSuccess,
  GuardianSimulationWarning,
  JsonSafeValue,
} from "@/features/guardian-agent/api-types";

const QUEST_ID = "1" as const;
const NETWORK_NAME = "Monad Testnet" as const;
const DATA_SOURCE = "moss-monad-testnet" as const;
const MOSS_SOURCE_COMMIT =
  "07b673844f8ca14e992c6dfe305c83018114a791" as const;
const QUERY_ACCOUNT =
  "0x0000000000000000000000000000000000000000" as AddressValue;
const MAX_REQUEST_ACCOUNT_LENGTH = 64;
const MAX_REQUEST_AMOUNT_LENGTH = 80;
const DECIMAL_AMOUNT_PATTERN = /^(?:0|[1-9]\d*)(?:\.\d{1,18})?$/;
const BYTES32_PATTERN = /^0x[0-9a-fA-F]{64}$/;

interface GuardianEnvironment {
  rpcUrl: string;
}

interface GuardianContext {
  registry: Registry;
}

interface QuestPair {
  quest: GuardianQuestData;
  funding: {
    questId: string;
    totalFunded: string;
  };
}

export class GuardianAgentError extends Error {
  readonly code: GuardianAgentErrorCode;

  constructor(code: GuardianAgentErrorCode) {
    super(publicMessageForGuardianAgentCode(code));
    this.code = code;
    this.name = "GuardianAgentError";
  }
}

export function publicMessageForGuardianAgentCode(
  code: GuardianAgentErrorCode,
): string {
  switch (code) {
    case "INVALID_BODY":
      return "请求体必须是只包含 account 和 amount 的 JSON 对象。";
    case "INVALID_ACCOUNT":
      return "请输入有效的 EVM 账户地址。";
    case "INVALID_AMOUNT":
      return "amount 必须是大于零的普通十进制 MON 字符串，且最多包含 18 位小数。";
    case "CHAIN_NOT_CONFIGURED":
      return "Guardian Agent 链配置不可用。";
    case "CHAIN_ID_MISMATCH":
      return "当前 RPC 网络不是已配置的 Monad Testnet。";
    case "QUEST_INACTIVE":
      return "Quest 1 当前未开放资助。";
    case "QUEST_QUERY_MISMATCH":
      return "Quest 1 链上查询结果不一致。";
    case "MOSS_CAPABILITY_INVALID":
      return "Guardian 资助能力无法安全构造。";
    case "SIMULATION_FAILED":
      return "Guardian 资助模拟未成功完成。";
    case "SIMULATION_EVIDENCE_INVALID":
      return "Guardian 资助模拟证据不完整或不一致。";
    case "RPC_UNAVAILABLE":
      return "Monad Testnet 暂时无法访问，请稍后重试。";
    case "INTERNAL_ERROR":
      return "Guardian Agent 暂时不可用。";
  }
}

export function guardianAgentFailure(error: unknown): {
  body: GuardianAgentFailure;
  status: number;
} {
  const code =
    error instanceof GuardianAgentError ? error.code : "INTERNAL_ERROR";

  return {
    body: {
      ok: false,
      error: {
        code,
        message: publicMessageForGuardianAgentCode(code),
      },
    },
    status: statusForGuardianAgentCode(code),
  };
}

function statusForGuardianAgentCode(code: GuardianAgentErrorCode): number {
  switch (code) {
    case "INVALID_BODY":
    case "INVALID_ACCOUNT":
    case "INVALID_AMOUNT":
      return 400;
    case "QUEST_INACTIVE":
    case "QUEST_QUERY_MISMATCH":
      return 409;
    case "CHAIN_NOT_CONFIGURED":
    case "CHAIN_ID_MISMATCH":
    case "SIMULATION_FAILED":
    case "RPC_UNAVAILABLE":
      return 503;
    case "MOSS_CAPABILITY_INVALID":
    case "SIMULATION_EVIDENCE_INVALID":
    case "INTERNAL_ERROR":
      return 500;
  }
}

function readEnvironment(): GuardianEnvironment {
  const rpcUrl = process.env.MONAD_RPC_URL?.trim();
  const configuredAddress = process.env.GUARDIAN_QUEST_ADDRESS?.trim();
  const configuredChainId = process.env.MONAD_CHAIN_ID?.trim();

  if (!rpcUrl || !configuredAddress || !configuredChainId) {
    throw new GuardianAgentError("CHAIN_NOT_CONFIGURED");
  }

  let parsedRpcUrl: URL;
  try {
    parsedRpcUrl = new URL(rpcUrl);
  } catch {
    throw new GuardianAgentError("CHAIN_NOT_CONFIGURED");
  }

  if (
    parsedRpcUrl.protocol !== "https:" &&
    parsedRpcUrl.protocol !== "http:"
  ) {
    throw new GuardianAgentError("CHAIN_NOT_CONFIGURED");
  }

  if (configuredChainId !== String(MONAD_TESTNET_CHAIN_ID)) {
    throw new GuardianAgentError("CHAIN_ID_MISMATCH");
  }

  if (
    !isAddress(configuredAddress) ||
    configuredAddress.toLowerCase() !== GUARDIAN_QUEST_ADDRESS.toLowerCase()
  ) {
    throw new GuardianAgentError("CHAIN_NOT_CONFIGURED");
  }

  return { rpcUrl };
}

function isRuntimeChainMismatch(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.startsWith(
      `Moss requires Monad chain ID ${MONAD_TESTNET_CHAIN_ID}; RPC reported `,
    )
  );
}

async function createGuardianContext(): Promise<GuardianContext> {
  const { rpcUrl } = readEnvironment();

  try {
    const runtime = await createRuntime({
      rpcUrl,
      expectedChainId: MONAD_TESTNET_CHAIN_ID,
    });
    return { registry: new Registry(runtime).use(Guardian) };
  } catch (error) {
    if (isRuntimeChainMismatch(error)) {
      throw new GuardianAgentError("CHAIN_ID_MISMATCH");
    }
    throw new GuardianAgentError("RPC_UNAVAILABLE");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function isDecimalIntegerString(value: unknown): value is string {
  return typeof value === "string" && /^(?:0|[1-9]\d*)$/.test(value);
}

function parseQuestData(value: MossJsonSafeValue): GuardianQuestData {
  if (
    !isRecord(value) ||
    value.questId !== QUEST_ID ||
    typeof value.contentHash !== "string" ||
    !BYTES32_PATTERN.test(value.contentHash) ||
    typeof value.metadataURI !== "string" ||
    typeof value.active !== "boolean" ||
    !isDecimalIntegerString(value.totalFunded)
  ) {
    throw new GuardianAgentError("QUEST_QUERY_MISMATCH");
  }

  return {
    questId: QUEST_ID,
    contentHash: value.contentHash as `0x${string}`,
    metadataURI: value.metadataURI,
    active: value.active,
    totalFunded: value.totalFunded,
  };
}

function parseFundingData(value: MossJsonSafeValue): QuestPair["funding"] {
  if (
    !isRecord(value) ||
    value.questId !== QUEST_ID ||
    !isDecimalIntegerString(value.totalFunded)
  ) {
    throw new GuardianAgentError("QUEST_QUERY_MISMATCH");
  }

  return {
    questId: QUEST_ID,
    totalFunded: value.totalFunded,
  };
}

async function readQuestPair(registry: Registry): Promise<QuestPair> {
  try {
    const [questResult, fundingResult] = await Promise.all([
      registry.action(GUARDIAN_PROTOCOL_NAME, "quest", QUERY_ACCOUNT, {
        questId: QUEST_ID,
      }),
      registry.action(GUARDIAN_PROTOCOL_NAME, "questFunding", QUERY_ACCOUNT, {
        questId: QUEST_ID,
      }),
    ]);

    if (questResult.kind !== "query" || fundingResult.kind !== "query") {
      throw new GuardianAgentError("QUEST_QUERY_MISMATCH");
    }

    const quest = parseQuestData(questResult.data);
    const funding = parseFundingData(fundingResult.data);

    if (quest.totalFunded !== funding.totalFunded) {
      throw new GuardianAgentError("QUEST_QUERY_MISMATCH");
    }

    return { quest, funding };
  } catch (error) {
    if (error instanceof GuardianAgentError) throw error;
    throw new GuardianAgentError("RPC_UNAVAILABLE");
  }
}

export async function queryGuardianQuest(): Promise<GuardianQuestSuccess> {
  const { registry } = await createGuardianContext();
  const { quest } = await readQuestPair(registry);

  return {
    ok: true,
    schemaVersion: "guardian-agent-quest-v1",
    dataSource: DATA_SOURCE,
    queriedAt: new Date().toISOString(),
    network: {
      name: NETWORK_NAME,
      chainId: MONAD_TESTNET_CHAIN_ID,
    },
    contract: { address: GUARDIAN_QUEST_ADDRESS },
    quest: {
      questId: QUEST_ID,
      contentHash: quest.contentHash,
      metadataURI: quest.metadataURI,
      active: quest.active,
      totalFunded: quest.totalFunded,
    },
    moss: {
      protocol: GUARDIAN_PROTOCOL_NAME,
      sourceCommit: MOSS_SOURCE_COMMIT,
      queries: ["quest", "questFunding"],
      capability: "fundQuest",
    },
  };
}

export function parseGuardianPrepareRequest(
  body: unknown,
): GuardianPrepareRequest {
  if (!isRecord(body)) {
    throw new GuardianAgentError("INVALID_BODY");
  }

  const keys = Object.keys(body).sort();
  if (
    keys.length !== 2 ||
    keys[0] !== "account" ||
    keys[1] !== "amount"
  ) {
    throw new GuardianAgentError("INVALID_BODY");
  }

  if (
    typeof body.account !== "string" ||
    body.account.length > MAX_REQUEST_ACCOUNT_LENGTH ||
    !isAddress(body.account)
  ) {
    throw new GuardianAgentError("INVALID_ACCOUNT");
  }

  if (
    typeof body.amount !== "string" ||
    body.amount.length === 0 ||
    body.amount.length > MAX_REQUEST_AMOUNT_LENGTH ||
    !DECIMAL_AMOUNT_PATTERN.test(body.amount)
  ) {
    throw new GuardianAgentError("INVALID_AMOUNT");
  }

  let amountWei: bigint;
  try {
    amountWei = parseUnits(body.amount, 18);
  } catch {
    throw new GuardianAgentError("INVALID_AMOUNT");
  }

  if (amountWei <= BigInt(0) || amountWei > maxUint256) {
    throw new GuardianAgentError("INVALID_AMOUNT");
  }

  return {
    account: getAddress(body.account),
    amount: body.amount,
  };
}

function isCapabilityNode(value: unknown): value is CapabilityNode {
  return isRecord(value) && value.kind === "capability";
}

function addressesEqual(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

function isNonEmptyHexData(value: string): boolean {
  return isHex(value, { strict: true }) && value.length > 2;
}

function readPositiveHexQuantity(value: string): bigint | null {
  if (!/^0x(?:0|[1-9a-fA-F][0-9a-fA-F]*)$/.test(value)) return null;

  try {
    const parsed = BigInt(value);
    return parsed > BigInt(0) ? parsed : null;
  } catch {
    return null;
  }
}

function safeWarningMessage(code: Warning["code"]): string {
  switch (code) {
    case "REVERTED":
      return "模拟交易发生回退。";
    case "TRACE_FAILED":
      return "调用轨迹模拟不可用。";
    case "CHANGE_ORDER_UNAVAILABLE":
      return "模拟结果无法证明变更顺序。";
    case "RECEIPT_FAILED":
      return "模拟回执解析失败。";
    case "CHANGE_COVERAGE_MISMATCH":
      return "模拟回执未覆盖全部链上变更。";
    case "STATE_CHAIN_FAILED":
      return "多笔模拟状态衔接失败。";
  }
}

function sanitizeWarnings(
  warnings: readonly Warning[],
): readonly GuardianSimulationWarning[] {
  return warnings.map((warning) => ({
    code: warning.code,
    message: safeWarningMessage(warning.code),
  }));
}

function parseFundingReceipt(
  receipt: Receipt,
  transaction: UnsignedTx,
  normalizedAccount: string,
): {
  outcome: GuardianPrepareSuccess["simulation"]["outcome"];
  receipt: GuardianPrepareSuccess["simulation"]["receipt"];
} {
  const outcome = receipt.outcome;
  if (
    !isRecord(outcome) ||
    outcome.operation !== "fundQuest" ||
    outcome.questId !== QUEST_ID ||
    typeof outcome.funder !== "string" ||
    !isAddress(outcome.funder) ||
    !addressesEqual(outcome.funder, normalizedAccount) ||
    !isDecimalIntegerString(outcome.amount)
  ) {
    throw new GuardianAgentError("SIMULATION_EVIDENCE_INVALID");
  }

  const transactionWei = readPositiveHexQuantity(transaction.value);
  if (transactionWei === null || outcome.amount !== transactionWei.toString()) {
    throw new GuardianAgentError("SIMULATION_EVIDENCE_INVALID");
  }

  let nativeTransferIndex = -1;
  let questFundedIndex = -1;

  const changes = receipt.changes.map((entry, index) => {
    if (entry.kind !== "change") {
      throw new GuardianAgentError("SIMULATION_EVIDENCE_INVALID");
    }

    if (entry.change.kind === "nativeTransfer") {
      if (
        nativeTransferIndex !== -1 ||
        !addressesEqual(entry.change.from, normalizedAccount) ||
        !addressesEqual(entry.change.to, GUARDIAN_QUEST_ADDRESS) ||
        entry.change.value !== outcome.amount
      ) {
        throw new GuardianAgentError("SIMULATION_EVIDENCE_INVALID");
      }
      nativeTransferIndex = index;
      return {
        kind: "nativeTransfer",
        text: `Native MON Transfer: ${entry.change.value} from ${entry.change.from} to ${entry.change.to}`,
        data: toJsonSafe(entry.data) as JsonSafeValue,
      };
    }

    if (
      questFundedIndex !== -1 ||
      !addressesEqual(entry.change.address, GUARDIAN_QUEST_ADDRESS) ||
      !isRecord(entry.data) ||
      entry.data.operation !== "fundQuest" ||
      entry.data.questId !== QUEST_ID ||
      entry.data.funder !== outcome.funder ||
      entry.data.amount !== outcome.amount
    ) {
      throw new GuardianAgentError("SIMULATION_EVIDENCE_INVALID");
    }
    questFundedIndex = index;
    return {
      kind: "event",
      text: `Guardian Quest Funded: Quest ${QUEST_ID} received ${outcome.amount} from ${outcome.funder}`,
      data: toJsonSafe(entry.data) as JsonSafeValue,
    };
  });

  if (
    nativeTransferIndex < 0 ||
    questFundedIndex < 0 ||
    nativeTransferIndex >= questFundedIndex
  ) {
    throw new GuardianAgentError("SIMULATION_EVIDENCE_INVALID");
  }

  return {
    outcome: {
      operation: "fundQuest",
      questId: QUEST_ID,
      funder: getAddress(outcome.funder),
      amount: outcome.amount,
    },
    receipt: {
      text: `Guardian Quest Funded: Quest ${QUEST_ID} received ${outcome.amount} from ${outcome.funder}`,
      changes,
    },
  };
}

function validatePreparedTransaction(
  transaction: UnsignedTx,
  normalizedAccount: string,
): bigint {
  if (
    !addressesEqual(transaction.from, normalizedAccount) ||
    !addressesEqual(transaction.to, GUARDIAN_QUEST_ADDRESS) ||
    !isNonEmptyHexData(transaction.data)
  ) {
    throw new GuardianAgentError("MOSS_CAPABILITY_INVALID");
  }

  const value = readPositiveHexQuantity(transaction.value);
  if (value === null) {
    throw new GuardianAgentError("MOSS_CAPABILITY_INVALID");
  }

  return value;
}

export async function prepareGuardianFunding(
  request: GuardianPrepareRequest,
): Promise<GuardianPrepareSuccess> {
  const { registry } = await createGuardianContext();
  const { quest } = await readQuestPair(registry);

  if (!quest.active) {
    throw new GuardianAgentError("QUEST_INACTIVE");
  }

  let capability: CapabilityNode;
  try {
    const result = await registry.action(
      GUARDIAN_PROTOCOL_NAME,
      "fundQuest",
      request.account as AddressValue,
      { questId: QUEST_ID, amount: request.amount },
    );
    if (!isCapabilityNode(result)) {
      throw new GuardianAgentError("MOSS_CAPABILITY_INVALID");
    }
    capability = result;
  } catch (error) {
    if (error instanceof GuardianAgentError) throw error;
    throw new GuardianAgentError("MOSS_CAPABILITY_INVALID");
  }

  let executable;
  try {
    executable = flattenCapabilityTree(capability);
  } catch {
    throw new GuardianAgentError("MOSS_CAPABILITY_INVALID");
  }

  if (executable.length !== 1) {
    throw new GuardianAgentError("MOSS_CAPABILITY_INVALID");
  }

  const transaction = executable[0].transaction;
  const transactionWei = validatePreparedTransaction(
    transaction,
    request.account,
  );
  const requestedWei = parseUnits(request.amount, 18);
  if (transactionWei !== requestedWei) {
    throw new GuardianAgentError("MOSS_CAPABILITY_INVALID");
  }

  let simulation;
  try {
    const simulator = createTraceSimulator(registry.runtime, {
      receipt: (node, changes) => registry.parseReceipt(node, changes),
    });
    simulation = await simulator.simulate(capability);
  } catch {
    throw new GuardianAgentError("SIMULATION_FAILED");
  }

  if (simulation.results.length !== 1) {
    throw new GuardianAgentError("SIMULATION_EVIDENCE_INVALID");
  }

  const result = simulation.results[0];
  if (simulation.halted || result.reverted) {
    throw new GuardianAgentError("SIMULATION_FAILED");
  }

  if (
    !addressesEqual(result.transaction.from, transaction.from) ||
    !addressesEqual(result.transaction.to, transaction.to) ||
    result.transaction.data !== transaction.data ||
    result.transaction.value !== transaction.value ||
    !result.receipt
  ) {
    throw new GuardianAgentError("SIMULATION_EVIDENCE_INVALID");
  }

  const parsed = parseFundingReceipt(
    result.receipt,
    transaction,
    request.account,
  );
  const warnings = sanitizeWarnings(result.warnings);
  const receiptComplete = parsed.receipt.changes.length >= 2;
  const evidenceConsistent =
    parsed.outcome.amount === transactionWei.toString() &&
    addressesEqual(parsed.outcome.funder, transaction.from);
  const signAllowed =
    !simulation.halted &&
    !result.reverted &&
    warnings.length === 0 &&
    receiptComplete &&
    evidenceConsistent &&
    executable.length === 1;

  return {
    ok: true,
    schemaVersion: "guardian-agent-prepare-v1",
    dataSource: DATA_SOURCE,
    preparedAt: new Date().toISOString(),
    network: {
      name: NETWORK_NAME,
      chainId: MONAD_TESTNET_CHAIN_ID,
    },
    contract: { address: GUARDIAN_QUEST_ADDRESS },
    request: {
      account: request.account,
      questId: QUEST_ID,
      amount: request.amount,
    },
    questBefore: {
      active: quest.active,
      totalFunded: quest.totalFunded,
    },
    risk: ["fundOut"],
    transaction: {
      from: transaction.from,
      to: transaction.to,
      data: transaction.data,
      value: transaction.value,
    },
    simulation: {
      halted: Boolean(simulation.halted),
      reverted: result.reverted,
      gas: result.gas,
      warnings,
      signAllowed,
      outcome: parsed.outcome,
      receipt: parsed.receipt,
    },
    moss: {
      protocol: GUARDIAN_PROTOCOL_NAME,
      sourceCommit: MOSS_SOURCE_COMMIT,
    },
  };
}
