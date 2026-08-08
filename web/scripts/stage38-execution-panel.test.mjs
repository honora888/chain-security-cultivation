import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const [dataSource, panelSource] = await Promise.all([
  readFile(new URL("src/data/stage38-execution-evidence.ts", root), "utf8"),
  readFile(new URL("src/features/guardian-agent/stage38-execution-panel.tsx", root), "utf8"),
]);

for (const value of [
  "0x9858f3cc68f8324afda69be1d7d7dad4a49d9f5c052b53b8ae8bea7c598d2fad",
  'beforeTotalFundedWei: "0"',
  'fundedAmountWei: "1000000000000"',
  'afterTotalFundedWei: "1000000000000"',
  'verifiedDeltaWei: "1000000000000"',
  'receiptStatus: "SUCCESS"',
  "blockNumber: 51975967",
]) {
  assert.ok(dataSource.includes(value), `missing public Stage38 evidence: ${value}`);
}

for (const step of ["Discover", "Simulate", "Authorized", "Executed", "Read-back"]) {
  assert.ok(dataSource.includes(`"${step}"`), `missing lifecycle step: ${step}`);
}

assert.match(panelSource, /Verified Delta/);
assert.match(panelSource, /EXACT MATCH/);
assert.match(panelSource, /Agent 先模拟，授权后执行，并通过 Monad 状态回读确认实际结果。/);

const combinedSource = `${dataSource}\n${panelSource}`;
for (const forbidden of [
  /eth_sendTransaction/,
  /sendTransaction\s*\(/,
  /writeContract\s*\(/,
  /privateKey/i,
  /signer/i,
  /rpcUrl/i,
  /session/i,
  /<button/i,
]) {
  assert.doesNotMatch(combinedSource, forbidden, `read-only panel contains forbidden capability: ${forbidden}`);
}

console.log("Stage38 read-only execution panel assertions passed.");

