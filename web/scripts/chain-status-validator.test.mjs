import test from "node:test";
import assert from "node:assert/strict";
import {
  decodeBoolean,
  decodeBytes32,
  decodeCode,
  decodeQuantity,
  decodeUint256,
  isHexData,
  isHexQuantity,
  isJsonContentType,
  isValidEvmAddress,
  parseRpcEnvelope,
  RpcProtocolError,
} from "../src/lib/quest-1-json-rpc.ts";

const word0 = `0x${"0".repeat(64)}`;
const word1 = `0x${"0".repeat(63)}1`;
const word2 = `0x${"0".repeat(63)}2`;
const bytes32 = `0x${"ab".repeat(32)}`;

function protocol(fn, code = "RPC_PROTOCOL_ERROR") {
  assert.throws(fn, (error) => error instanceof RpcProtocolError && error.code === code);
}

test("EVM addresses, data and quantities are strict", () => {
  assert.equal(isValidEvmAddress("0x000000000000000000000000000000000000dEaD"), true);
  assert.equal(isValidEvmAddress("0x123"), false);
  assert.equal(isValidEvmAddress(" 0x000000000000000000000000000000000000dEaD"), false);
  assert.equal(isHexData("0x"), true);
  assert.equal(isHexData("0xabc"), false);
  assert.equal(isHexData("0xgg"), false);
  assert.equal(isHexQuantity("0x0"), true);
  assert.equal(isHexQuantity("0x01"), false);
  assert.equal(isHexQuantity("0x"), false);
  assert.equal(decodeQuantity("0x123456789abcdef0123456789").toString(), "90144042682896311822508713865");
});

test("JSON-RPC result envelope validates version, id and exclusivity", () => {
  assert.deepEqual(parseRpcEnvelope({ jsonrpc: "2.0", id: 7, result: word0 }, 7), {
    jsonrpc: "2.0", id: 7, result: word0,
  });
  protocol(() => parseRpcEnvelope({ jsonrpc: "1.0", id: 7, result: word0 }, 7));
  protocol(() => parseRpcEnvelope({ jsonrpc: "2.0", id: 8, result: word0 }, 7));
  protocol(() => parseRpcEnvelope({ jsonrpc: "2.0", id: 7, result: word0, error: null }, 7));
  protocol(() => parseRpcEnvelope({ jsonrpc: "2.0", id: 7 }, 7));
  protocol(() => parseRpcEnvelope({ jsonrpc: "2.0", id: 7, error: { code: "-1", message: "bad" } }, 7));
  protocol(() => parseRpcEnvelope([], 7));
});

test("JSON-RPC error shape is validated without exposing data", () => {
  const envelope = parseRpcEnvelope({ jsonrpc: "2.0", id: 1, error: { code: -32000, message: "denied", data: { secret: true } } }, 1);
  assert.equal("error" in envelope, true);
  if ("error" in envelope) {
    assert.deepEqual(envelope.error, { code: -32000, message: "denied" });
    assert.equal("data" in envelope.error, false);
  }
  protocol(() => parseRpcEnvelope({ jsonrpc: "2.0", id: 1, error: { code: -32000, message: "" } }, 1));
});

test("content type accepts JSON media types only", () => {
  assert.equal(isJsonContentType("application/json"), true);
  assert.equal(isJsonContentType("application/json; charset=utf-8"), true);
  assert.equal(isJsonContentType("application/problem+json"), true);
  assert.equal(isJsonContentType("text/html"), false);
  assert.equal(isJsonContentType(null), false);
});

test("ABI decoders require exact words and valid bool values", () => {
  assert.equal(decodeBoolean(word0), false);
  assert.equal(decodeBoolean(word1), true);
  protocol(() => decodeBoolean(word2), "ABI_DECODE_ERROR");
  protocol(() => decodeBoolean("0x"), "ABI_DECODE_ERROR");
  assert.equal(decodeBytes32(bytes32), bytes32);
  protocol(() => decodeBytes32("0x12"), "ABI_DECODE_ERROR");
  assert.equal(decodeUint256(word1), "1");
  protocol(() => decodeUint256("0x"), "ABI_DECODE_ERROR");
});

test("contract bytecode distinguishes empty code from malformed code", () => {
  assert.equal(decodeCode("0x6000"), "0x6000");
  protocol(() => decodeCode("0x"), "CONTRACT_NOT_DEPLOYED");
  protocol(() => decodeCode("0xabc"), "MALFORMED_RESULT");
});
