import "server-only";

import type {
  ChainStatusErrorCode,
  ChainStatusSuccess,
} from "@/features/quest-1/chain-status-types";

export const QUEST_ONE_CHAIN = {
  chainId: 10143,
  contractAddress: "0x131DEbd042208A327841128e5800dd4a833032ab",
  name: "Monad Testnet",
  questId: 1,
} as const;

const RPC_TIMEOUT_MS = 10_000;
const HEX_WORD_PATTERN = /^0x[0-9a-fA-F]{64}$/;
const EVM_ADDRESS_PATTERN = /^0x[0-9a-fA-F]{40}$/;

/*
 * These selectors come from out/GuardianQuest.sol/GuardianQuest.json
 * methodIdentifiers. The helper intentionally implements only the fixed view
 * calls required by the Quest 1 verification panel.
 */
const METHOD_SELECTORS = {
  completed: "ffc4ed25",
  reportHashes: "67ac1437",
  balanceOf: "00fdd58e",
} as const;

type RpcMethod = "eth_chainId" | "eth_blockNumber" | "eth_call";
type Fetcher = typeof fetch;

interface ChainEnvironment {
  MONAD_RPC_URL?: string;
  GUARDIAN_QUEST_ADDRESS?: string;
  MONAD_CHAIN_ID?: string;
}

interface QueryOptions {
  env?: ChainEnvironment;
  fetcher?: Fetcher;
  timeoutMs?: number;
}

interface RpcResponse {
  jsonrpc?: string;
  id?: number;
  result?: unknown;
  error?: unknown;
}

export class ChainStatusQueryError extends Error {
  constructor(
    public readonly code: Exclude<
      ChainStatusErrorCode,
      "INVALID_ADDRESS" | "INTERNAL_ERROR"
    >,
  ) {
    super(publicMessageForCode(code));
    this.name = "ChainStatusQueryError";
  }
}

export function isValidEvmAddress(value: unknown): value is string {
  return typeof value === "string" && EVM_ADDRESS_PATTERN.test(value);
}

export function publicMessageForCode(code: ChainStatusErrorCode): string {
  switch (code) {
    case "INVALID_ADDRESS":
      return "请输入 0x 开头、包含 40 个十六进制字符的 EVM 地址。";
    case "CHAIN_NOT_CONFIGURED":
      return "链上验证尚未配置，本地学习结果不受影响。";
    case "RPC_UNAVAILABLE":
      return "Monad Testnet 暂时无法访问，请稍后手动重试。";
    case "CHAIN_ID_MISMATCH":
      return "RPC 返回的网络不是已核验的 Monad Testnet，查询已停止。";
    case "CONTRACT_CALL_FAILED":
      return "GuardianQuest 只读合约查询失败，请稍后手动重试。";
    case "INTERNAL_ERROR":
      return "链上验证暂时不可用，本地学习结果不受影响。";
  }
}

function readEnvironment(env?: ChainEnvironment) {
  const source = env ?? {
    MONAD_RPC_URL: process.env.MONAD_RPC_URL,
    GUARDIAN_QUEST_ADDRESS: process.env.GUARDIAN_QUEST_ADDRESS,
    MONAD_CHAIN_ID: process.env.MONAD_CHAIN_ID,
  };
  const rpcUrl = source.MONAD_RPC_URL;
  const contractAddress = source.GUARDIAN_QUEST_ADDRESS;
  const chainId = Number(source.MONAD_CHAIN_ID);

  if (
    !rpcUrl ||
    !isValidEvmAddress(contractAddress) ||
    contractAddress.toLowerCase() !==
      QUEST_ONE_CHAIN.contractAddress.toLowerCase() ||
    !Number.isInteger(chainId) ||
    chainId !== QUEST_ONE_CHAIN.chainId
  ) {
    throw new ChainStatusQueryError("CHAIN_NOT_CONFIGURED");
  }

  try {
    const parsedUrl = new URL(rpcUrl);
    if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
      throw new Error("Unsupported RPC protocol");
    }
  } catch {
    throw new ChainStatusQueryError("CHAIN_NOT_CONFIGURED");
  }

  return { contractAddress, rpcUrl };
}

function encodeUint256(value: number): string {
  return value.toString(16).padStart(64, "0");
}

function encodeAddress(address: string): string {
  return address.slice(2).toLowerCase().padStart(64, "0");
}

function makeCallData(
  method: keyof typeof METHOD_SELECTORS,
  parameters: readonly string[],
): string {
  return `0x${METHOD_SELECTORS[method]}${parameters.join("")}`;
}

function decodeBoolean(value: unknown): boolean {
  if (
    typeof value !== "string" ||
    !HEX_WORD_PATTERN.test(value) ||
    (value !== `0x${"0".repeat(64)}` &&
      value !== `0x${"0".repeat(63)}1`)
  ) {
    throw new ChainStatusQueryError("CONTRACT_CALL_FAILED");
  }
  return value.endsWith("1");
}

function decodeBytes32(value: unknown): string {
  if (typeof value !== "string" || !HEX_WORD_PATTERN.test(value)) {
    throw new ChainStatusQueryError("CONTRACT_CALL_FAILED");
  }
  return value.toLowerCase();
}

function decodeUint256(value: unknown): string {
  if (typeof value !== "string" || !HEX_WORD_PATTERN.test(value)) {
    throw new ChainStatusQueryError("CONTRACT_CALL_FAILED");
  }
  return BigInt(value).toString(10);
}

function decodeQuantity(value: unknown): bigint {
  if (
    typeof value !== "string" ||
    !/^0x(?:0|[1-9a-fA-F][0-9a-fA-F]*)$/.test(value)
  ) {
    throw new ChainStatusQueryError("RPC_UNAVAILABLE");
  }
  return BigInt(value);
}

export async function queryQuestOneChainStatus(
  learnerAddress: string,
  options: QueryOptions = {},
): Promise<ChainStatusSuccess> {
  if (!isValidEvmAddress(learnerAddress)) {
    throw new TypeError("A valid EVM address is required.");
  }

  const { contractAddress, rpcUrl } = readEnvironment(options.env);
  const fetcher = options.fetcher ?? fetch;
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? RPC_TIMEOUT_MS,
  );
  let requestId = 0;

  async function rpc(method: RpcMethod, params: unknown[]): Promise<unknown> {
    let response: Response;
    try {
      response = await fetcher(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: ++requestId,
          method,
          params,
        }),
        cache: "no-store",
        signal: controller.signal,
      });
    } catch {
      throw new ChainStatusQueryError("RPC_UNAVAILABLE");
    }

    if (!response.ok) {
      throw new ChainStatusQueryError("RPC_UNAVAILABLE");
    }

    let payload: RpcResponse;
    try {
      payload = (await response.json()) as RpcResponse;
    } catch {
      throw new ChainStatusQueryError("RPC_UNAVAILABLE");
    }

    if (payload.error !== undefined || payload.result === undefined) {
      throw new ChainStatusQueryError(
        method === "eth_call"
          ? "CONTRACT_CALL_FAILED"
          : "RPC_UNAVAILABLE",
      );
    }
    return payload.result;
  }

  try {
    const chainId = decodeQuantity(await rpc("eth_chainId", []));
    if (chainId !== BigInt(QUEST_ONE_CHAIN.chainId)) {
      throw new ChainStatusQueryError("CHAIN_ID_MISMATCH");
    }

    const blockNumber = decodeQuantity(
      await rpc("eth_blockNumber", []),
    );
    const blockTag = `0x${blockNumber.toString(16)}`;
    const questWord = encodeUint256(QUEST_ONE_CHAIN.questId);
    const addressWord = encodeAddress(learnerAddress);
    const call = (data: string) => [
      { to: contractAddress, data },
      blockTag,
    ];

    const [completed, reportHash, badgeBalance] = await Promise.all([
      rpc(
        "eth_call",
        call(makeCallData("completed", [questWord, addressWord])),
      ),
      rpc(
        "eth_call",
        call(makeCallData("reportHashes", [questWord, addressWord])),
      ),
      rpc(
        "eth_call",
        call(makeCallData("balanceOf", [addressWord, questWord])),
      ),
    ]);

    return {
      ok: true,
      network: {
        name: QUEST_ONE_CHAIN.name,
        chainId: QUEST_ONE_CHAIN.chainId,
      },
      contract: { address: contractAddress },
      query: {
        address: learnerAddress,
        questId: QUEST_ONE_CHAIN.questId,
      },
      status: {
        completed: decodeBoolean(completed),
        reportHash: decodeBytes32(reportHash),
        badgeBalance: decodeUint256(badgeBalance),
      },
      blockNumber: blockNumber.toString(10),
    };
  } finally {
    controller.abort();
    clearTimeout(timeout);
  }
}
