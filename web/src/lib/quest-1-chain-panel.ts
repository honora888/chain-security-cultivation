import type {
  ChainStatusErrorCode,
  ChainStatusResponse,
  ChainStatusSuccess,
} from "../features/quest-1/chain-status-types";

export const QUEST_ONE_CHAIN_CLIENT_TIMEOUT_MS = 12_000;
export const QUEST_ONE_CHAIN_STALE_AFTER_MS = 5 * 60 * 1_000;

const EVM_ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;
const DECIMAL_PATTERN = /^(?:0|[1-9][0-9]*)$/;
const BYTES32_PATTERN = /^0x[0-9a-fA-F]{64}$/;
const ERROR_CODES = new Set<ChainStatusErrorCode>([
  "INVALID_ADDRESS",
  "INVALID_QUERY",
  "CHAIN_NOT_CONFIGURED",
  "RPC_TIMEOUT",
  "RPC_UNAVAILABLE",
  "RPC_HTTP_ERROR",
  "RPC_CONTENT_TYPE_ERROR",
  "RPC_JSON_PARSE_ERROR",
  "RPC_PROTOCOL_ERROR",
  "RPC_REMOTE_ERROR",
  "CHAIN_ID_MISMATCH",
  "CONTRACT_NOT_DEPLOYED",
  "MALFORMED_RESULT",
  "ABI_DECODE_ERROR",
  "CONTRACT_CALL_FAILED",
  "INTERNAL_ERROR",
]);

type Fetcher = typeof fetch;

interface ChainStatusRequestOptions {
  fetcher?: Fetcher;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export type ChainStatusClientErrorKind =
  | "aborted"
  | "invalid-address"
  | "network"
  | "response"
  | "timeout";

export class ChainStatusClientError extends Error {
  public readonly kind: ChainStatusClientErrorKind;

  constructor(kind: ChainStatusClientErrorKind) {
    super(kind);
    this.kind = kind;
    this.name = "ChainStatusClientError";
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function normalizeLearnerAddress(value: string): string {
  return value.trim();
}

export function isValidLearnerAddress(value: string): boolean {
  return EVM_ADDRESS_PATTERN.test(value);
}

function isChainStatusSuccess(value: unknown): value is ChainStatusSuccess {
  if (!isObject(value) || value.ok !== true) return false;
  if (
    value.schemaVersion !== "quest-1-chain-status-v1" ||
    value.dataSource !== "monad-testnet-rpc" ||
    typeof value.queriedAt !== "string" ||
    !Number.isFinite(Date.parse(value.queriedAt)) ||
    !isObject(value.network) ||
    value.network.name !== "Monad Testnet" ||
    value.network.chainId !== 10143 ||
    !isObject(value.contract) ||
    typeof value.contract.address !== "string" ||
    !isValidLearnerAddress(value.contract.address) ||
    !isObject(value.query) ||
    typeof value.query.address !== "string" ||
    !isValidLearnerAddress(value.query.address) ||
    value.query.questId !== 1 ||
    !isObject(value.status) ||
    typeof value.status.completed !== "boolean" ||
    typeof value.status.reportHash !== "string" ||
    !BYTES32_PATTERN.test(value.status.reportHash) ||
    typeof value.status.badgeBalance !== "string" ||
    !DECIMAL_PATTERN.test(value.status.badgeBalance) ||
    typeof value.blockNumber !== "string" ||
    !DECIMAL_PATTERN.test(value.blockNumber)
  ) {
    return false;
  }
  return true;
}

function isChainStatusFailure(value: unknown): value is ChainStatusResponse {
  return (
    isObject(value) &&
    value.ok === false &&
    isObject(value.error) &&
    typeof value.error.code === "string" &&
    ERROR_CODES.has(value.error.code as ChainStatusErrorCode) &&
    typeof value.error.message === "string"
  );
}

export function parseChainStatusResponse(value: unknown): ChainStatusResponse {
  if (isChainStatusSuccess(value) || isChainStatusFailure(value)) return value;
  throw new ChainStatusClientError("response");
}

export async function requestQuestOneChainStatus(
  rawAddress: string,
  options: ChainStatusRequestOptions = {},
): Promise<ChainStatusResponse> {
  const address = normalizeLearnerAddress(rawAddress);
  if (!isValidLearnerAddress(address)) {
    throw new ChainStatusClientError("invalid-address");
  }

  const controller = new AbortController();
  let timedOut = false;
  let abortedByCaller = false;
  const abortFromCaller = () => {
    abortedByCaller = true;
    controller.abort();
  };

  if (options.signal?.aborted) abortFromCaller();
  options.signal?.addEventListener("abort", abortFromCaller, { once: true });

  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, options.timeoutMs ?? QUEST_ONE_CHAIN_CLIENT_TIMEOUT_MS);

  try {
    const response = await (options.fetcher ?? fetch)(
      `/api/quest-1/chain-status?address=${encodeURIComponent(address)}`,
      {
        cache: "no-store",
        headers: { Accept: "application/json" },
        signal: controller.signal,
      },
    );

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new ChainStatusClientError("response");
    }

    const envelope = parseChainStatusResponse(payload);
    if (!response.ok && envelope.ok) {
      throw new ChainStatusClientError("response");
    }
    return envelope;
  } catch (error) {
    if (error instanceof ChainStatusClientError) throw error;
    if (timedOut) throw new ChainStatusClientError("timeout");
    if (abortedByCaller) throw new ChainStatusClientError("aborted");
    throw new ChainStatusClientError("network");
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", abortFromCaller);
  }
}

export function getChainDataSourceLabel(
  dataSource: ChainStatusSuccess["dataSource"],
): string {
  return dataSource === "monad-testnet-rpc" ? "Monad Testnet RPC" : dataSource;
}

export function getChainStatusFreshness(
  queriedAt: string,
  now: number = Date.now(),
): { isStale: boolean; label: string; staleAt: number } {
  const queriedAtMs = Date.parse(queriedAt);
  if (!Number.isFinite(queriedAtMs)) {
    return {
      isStale: true,
      label: "查询时间不可用，请刷新链上证据",
      staleAt: now,
    };
  }

  const staleAt = queriedAtMs + QUEST_ONE_CHAIN_STALE_AFTER_MS;
  const isStale = now >= staleAt;
  return {
    isStale,
    label: isStale ? "数据可能已过期，请刷新" : "刚刚查询",
    staleAt,
  };
}
