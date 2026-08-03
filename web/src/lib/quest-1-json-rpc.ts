export type RpcErrorCode =
  | "RPC_TIMEOUT"
  | "RPC_UNAVAILABLE"
  | "RPC_HTTP_ERROR"
  | "RPC_CONTENT_TYPE_ERROR"
  | "RPC_JSON_PARSE_ERROR"
  | "RPC_PROTOCOL_ERROR"
  | "RPC_REMOTE_ERROR"
  | "MALFORMED_RESULT"
  | "ABI_DECODE_ERROR"
  | "CONTRACT_NOT_DEPLOYED";

export interface RpcRemoteError {
  code: number;
  message: string;
}

export type RpcEnvelope<T> =
  | { jsonrpc: "2.0"; id: number; result: T }
  | { jsonrpc: "2.0"; id: number; error: RpcRemoteError };

export class RpcProtocolError extends Error {
  public readonly code: Exclude<RpcErrorCode, "RPC_TIMEOUT">;

  constructor(
    code: Exclude<RpcErrorCode, "RPC_TIMEOUT">,
    message: string = code,
  ) {
    super(message);
    this.code = code;
    this.name = "RpcProtocolError";
  }
}

export function isJsonObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isValidEvmAddress(value: unknown): value is string {
  return typeof value === "string" && /^0x[0-9a-fA-F]{40}$/.test(value);
}

export function isJsonContentType(value: string | null): boolean {
  if (!value) return false;
  const mediaType = value.split(";", 1)[0]?.trim().toLowerCase();
  return mediaType === "application/json" || mediaType.endsWith("+json");
}

export function isHexData(value: unknown): value is string {
  return typeof value === "string" && /^0x(?:[0-9a-fA-F]{2})*$/.test(value);
}

export function isHexQuantity(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^0x(?:0|[1-9a-fA-F][0-9a-fA-F]*)$/.test(value)
  );
}

export function parseRpcEnvelope<T>(
  value: unknown,
  expectedId: number,
): RpcEnvelope<T> {
  if (!isJsonObject(value)) {
    throw new RpcProtocolError("RPC_PROTOCOL_ERROR", "RPC response must be an object");
  }
  if (value.jsonrpc !== "2.0" || value.id !== expectedId) {
    throw new RpcProtocolError("RPC_PROTOCOL_ERROR", "RPC response envelope mismatch");
  }

  const hasResult = Object.prototype.hasOwnProperty.call(value, "result");
  const hasError = Object.prototype.hasOwnProperty.call(value, "error");
  if (hasResult === hasError) {
    throw new RpcProtocolError("RPC_PROTOCOL_ERROR", "RPC response must contain exactly one of result or error");
  }

  if (hasError) {
    const error = value.error;
    if (
      !isJsonObject(error) ||
      typeof error.code !== "number" ||
      !Number.isInteger(error.code) ||
      typeof error.message !== "string" ||
      error.message.trim().length === 0
    ) {
      throw new RpcProtocolError("RPC_PROTOCOL_ERROR", "Malformed RPC error");
    }
    return {
      jsonrpc: "2.0",
      id: expectedId,
      error: {
        code: error.code,
        message: error.message.trim(),
      },
    };
  }

  return { jsonrpc: "2.0", id: expectedId, result: value.result as T };
}

export function decodeQuantity(value: unknown): bigint {
  if (!isHexQuantity(value)) {
    throw new RpcProtocolError("MALFORMED_RESULT", "Malformed JSON-RPC quantity");
  }
  return BigInt(value);
}

export function decodeCode(value: unknown): string {
  if (!isHexData(value)) {
    throw new RpcProtocolError("MALFORMED_RESULT", "Malformed contract bytecode");
  }
  if (value === "0x") {
    throw new RpcProtocolError("CONTRACT_NOT_DEPLOYED", "Contract bytecode is empty");
  }
  return value.toLowerCase();
}

const ABI_WORD = /^0x[0-9a-fA-F]{64}$/;

export function decodeBoolean(value: unknown): boolean {
  if (!ABI_WORD.test(typeof value === "string" ? value : "")) {
    throw new RpcProtocolError("ABI_DECODE_ERROR", "Boolean result must be one ABI word");
  }
  if (value !== `0x${"0".repeat(64)}` && value !== `0x${"0".repeat(63)}1`) {
    throw new RpcProtocolError("ABI_DECODE_ERROR", "Boolean result is not 0 or 1");
  }
  return value.endsWith("1");
}

export function decodeBytes32(value: unknown): string {
  const hex = typeof value === "string" ? value : "";
  if (!ABI_WORD.test(hex)) {
    throw new RpcProtocolError("ABI_DECODE_ERROR", "bytes32 result must be one ABI word");
  }
  return hex.toLowerCase();
}

export function decodeUint256(value: unknown): string {
  const hex = typeof value === "string" ? value : "";
  if (!ABI_WORD.test(hex)) {
    throw new RpcProtocolError("ABI_DECODE_ERROR", "uint256 result must be one ABI word");
  }
  return BigInt(hex).toString(10);
}
