import "server-only";

import type {
  ChainStatusErrorCode,
  ChainStatusSuccess,
} from "../features/quest-1/chain-status-types";
import {
  decodeBoolean,
  decodeBytes32,
  decodeCode,
  decodeQuantity,
  decodeUint256,
  parseRpcEnvelope,
  RpcProtocolError,
  isValidEvmAddress as isValidEvmAddressValue,
} from "./quest-1-json-rpc";

export const QUEST_ONE_CHAIN = {
  chainId: 10143,
  contractAddress: "0x131DEbd042208A327841128e5800dd4a833032ab",
  name: "Monad Testnet",
  questId: 1,
} as const;

const RPC_TIMEOUT_MS = 10_000;
const METHOD_SELECTORS = {
  completed: "ffc4ed25",
  reportHashes: "67ac1437",
  balanceOf: "00fdd58e",
} as const;

type RpcMethod = "eth_chainId" | "eth_blockNumber" | "eth_getCode" | "eth_call";
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

export class ChainStatusQueryError extends Error {
  public readonly code: ChainStatusErrorCode;

  constructor(code: ChainStatusErrorCode) {
    super(publicMessageForCode(code));
    this.code = code;
    this.name = "ChainStatusQueryError";
  }
}

export function isValidEvmAddress(value: unknown): value is string {
  return isValidEvmAddressValue(value);
}

export function publicMessageForCode(code: ChainStatusErrorCode): string {
  switch (code) {
    case "INVALID_ADDRESS": return "请输入有效的 EVM 地址。";
    case "INVALID_QUERY": return "查询参数无效。";
    case "CHAIN_NOT_CONFIGURED": return "链上验证尚未配置，本地学习结果不受影响。";
    case "RPC_TIMEOUT": return "Monad Testnet 请求超时，请稍后手动重试。";
    case "RPC_UNAVAILABLE": return "Monad Testnet 暂时无法访问，请稍后手动重试。";
    case "RPC_HTTP_ERROR": return "Monad Testnet 返回了暂时不可用的响应。";
    case "RPC_CONTENT_TYPE_ERROR": return "链上验证返回了无法识别的响应格式。";
    case "RPC_JSON_PARSE_ERROR": return "链上验证返回了无法解析的响应。";
    case "RPC_PROTOCOL_ERROR": return "链上验证返回了无效的 JSON-RPC 响应。";
    case "RPC_REMOTE_ERROR": return "Monad Testnet 拒绝了只读查询。";
    case "CHAIN_ID_MISMATCH": return "RPC 返回的网络不是已核验的 Monad Testnet，查询已停止。";
    case "CONTRACT_NOT_DEPLOYED": return "GuardianQuest 合约未在目标网络部署。";
    case "MALFORMED_RESULT": return "链上验证返回了格式错误的结果。";
    case "ABI_DECODE_ERROR": return "GuardianQuest 只读结果无法按 ABI 解码。";
    case "CONTRACT_CALL_FAILED": return "GuardianQuest 只读合约查询失败，请稍后重试。";
    case "INTERNAL_ERROR": return "链上验证暂时不可用，本地学习结果不受影响。";
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
    !rpcUrl || !isValidEvmAddress(contractAddress) ||
    contractAddress.toLowerCase() !== QUEST_ONE_CHAIN.contractAddress.toLowerCase() ||
    !Number.isInteger(chainId) || chainId !== QUEST_ONE_CHAIN.chainId
  ) {
    throw new ChainStatusQueryError("CHAIN_NOT_CONFIGURED");
  }

  try {
    const parsedUrl = new URL(rpcUrl);
    if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") throw new Error();
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

function makeCallData(method: keyof typeof METHOD_SELECTORS, parameters: readonly string[]): string {
  return `0x${METHOD_SELECTORS[method]}${parameters.join("")}`;
}

export async function queryQuestOneChainStatus(
  learnerAddress: string,
  options: QueryOptions = {},
): Promise<ChainStatusSuccess> {
  if (!isValidEvmAddress(learnerAddress)) {
    throw new ChainStatusQueryError("INVALID_ADDRESS");
  }

  const { contractAddress, rpcUrl } = readEnvironment(options.env);
  const fetcher = options.fetcher ?? fetch;
  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, options.timeoutMs ?? RPC_TIMEOUT_MS);
  let requestId = 0;

  async function rpc(method: RpcMethod, params: unknown[]): Promise<unknown> {
    const id = ++requestId;
    let response: Response;
    try {
      response = await fetcher(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
        cache: "no-store",
        signal: controller.signal,
      });
    } catch (error) {
      if (timedOut || (error instanceof DOMException && error.name === "AbortError")) {
        throw new ChainStatusQueryError("RPC_TIMEOUT");
      }
      throw new ChainStatusQueryError("RPC_UNAVAILABLE");
    }

    if (!response.ok) throw new ChainStatusQueryError("RPC_HTTP_ERROR");
    const contentType = response.headers.get("content-type");
    if (!contentType || (!contentType.toLowerCase().includes("application/json") && !contentType.toLowerCase().includes("+json"))) {
      throw new ChainStatusQueryError("RPC_CONTENT_TYPE_ERROR");
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new ChainStatusQueryError("RPC_JSON_PARSE_ERROR");
    }

    try {
      const envelope = parseRpcEnvelope(payload, id);
      if ("error" in envelope) throw new ChainStatusQueryError("RPC_REMOTE_ERROR");
      return envelope.result;
    } catch (error) {
      if (error instanceof ChainStatusQueryError) throw error;
      if (error instanceof RpcProtocolError) throw new ChainStatusQueryError(error.code);
      throw new ChainStatusQueryError("RPC_PROTOCOL_ERROR");
    }
  }

  try {
    const chainId = decodeQuantity(await rpc("eth_chainId", []));
    if (chainId !== BigInt(QUEST_ONE_CHAIN.chainId)) throw new ChainStatusQueryError("CHAIN_ID_MISMATCH");

    const blockNumber = decodeQuantity(await rpc("eth_blockNumber", []));
    const blockTag = `0x${blockNumber.toString(16)}`;
    decodeCode(await rpc("eth_getCode", [contractAddress, blockTag]));

    const questWord = encodeUint256(QUEST_ONE_CHAIN.questId);
    const addressWord = encodeAddress(learnerAddress);
    const call = (data: string) => [{ to: contractAddress, data }, blockTag];
    const [completed, reportHash, badgeBalance] = await Promise.all([
      rpc("eth_call", call(makeCallData("completed", [questWord, addressWord]))),
      rpc("eth_call", call(makeCallData("reportHashes", [questWord, addressWord]))),
      rpc("eth_call", call(makeCallData("balanceOf", [addressWord, questWord]))),
    ]);

    return {
      ok: true,
      schemaVersion: "quest-1-chain-status-v1",
      dataSource: "monad-testnet-rpc",
      queriedAt: new Date().toISOString(),
      network: { name: QUEST_ONE_CHAIN.name, chainId: QUEST_ONE_CHAIN.chainId },
      contract: { address: contractAddress },
      query: { address: learnerAddress, questId: QUEST_ONE_CHAIN.questId },
      status: {
        completed: decodeBoolean(completed),
        reportHash: decodeBytes32(reportHash),
        badgeBalance: decodeUint256(badgeBalance),
      },
      blockNumber: blockNumber.toString(10),
    };
  } catch (error) {
    if (error instanceof ChainStatusQueryError) throw error;
    if (error instanceof RpcProtocolError) throw new ChainStatusQueryError(error.code);
    throw error;
  } finally {
    controller.abort();
    clearTimeout(timeout);
  }
}
