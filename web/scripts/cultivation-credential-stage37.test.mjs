import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const sourceRoot = new URL("../src/", import.meta.url);
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      const path = specifier.slice(2);
      return { shortCircuit: true, url: new URL(path.endsWith(".ts") ? path : `${path}.ts`, sourceRoot).href };
    }
    if (context.parentURL?.includes("/src/") && specifier.startsWith(".") && !specifier.endsWith(".ts")) {
      return { shortCircuit: true, url: new URL(`${specifier}.ts`, context.parentURL).href };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.endsWith(".ts")) {
      const filename = fileURLToPath(url);
      const output = ts.transpileModule(readFileSync(filename, "utf8"), {
        compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
        fileName: filename,
      });
      return { format: "module", shortCircuit: true, source: output.outputText };
    }
    return nextLoad(url, context);
  },
});

const {
  ZERO_BYTES32,
  deriveCompletionCredentialState,
  normalizeCredentialAddress,
  normalizeCredentialBadgeBalance,
  normalizeCredentialBytes32,
} = await import("../src/features/cultivation/credential-state.ts");

const HASH = `0x${"a1".repeat(32)}`;
const OTHER_HASH = `0x${"b2".repeat(32)}`;
const BASE = {
  hasCompletion: true,
  completionHash: HASH,
  chainCompleted: true,
  reportHash: HASH,
  badgeBalance: "1",
};

const sources = {
  api: readFileSync(new URL("../src/app/api/cultivation/quests/1/credential/route.ts", import.meta.url), "utf8"),
  client: readFileSync(new URL("../src/features/cultivation/cultivation-api-client.ts", import.meta.url), "utf8"),
  component: readFileSync(new URL("../src/features/cultivation/cultivation-credential.tsx", import.meta.url), "utf8"),
  credentialServer: readFileSync(new URL("../src/features/cultivation/credential-server.ts", import.meta.url), "utf8"),
  sessionServer: readFileSync(new URL("../src/features/cultivation/server.ts", import.meta.url), "utf8"),
  state: readFileSync(new URL("../src/features/cultivation/credential-state.ts", import.meta.url), "utf8"),
};

const tests = [];
function test(name, run) { tests.push({ name, run }); }

test("NOT_EARNED requires no Stage36 completion", () => {
  assert.equal(deriveCompletionCredentialState({ ...BASE, hasCompletion: false }), "NOT_EARNED");
});
test("READY_FOR_ONCHAIN requires local completion and empty chain state", () => {
  assert.equal(deriveCompletionCredentialState({ ...BASE, chainCompleted: false, reportHash: ZERO_BYTES32, badgeBalance: "0" }), "READY_FOR_ONCHAIN");
});
test("VERIFIED requires an exact current completionHash match", () => {
  assert.equal(deriveCompletionCredentialState(BASE), "VERIFIED");
});
test("LEGACY_CREDENTIAL preserves a historical mismatched on-chain credential", () => {
  assert.equal(deriveCompletionCredentialState({ ...BASE, reportHash: OTHER_HASH }), "LEGACY_CREDENTIAL");
});
test("INCONSISTENT covers invalid chain combinations", () => {
  assert.equal(deriveCompletionCredentialState({ ...BASE, chainCompleted: false, reportHash: HASH, badgeBalance: "1" }), "INCONSISTENT");
});
test("zero bytes32 normalizes safely", () => assert.equal(normalizeCredentialBytes32(ZERO_BYTES32), ZERO_BYTES32));
test("bytes32 comparison is case-insensitive", () => {
  assert.equal(deriveCompletionCredentialState({ ...BASE, reportHash: `0x${"A1".repeat(32)}` }), "VERIFIED");
});
test("malformed bytes32 is inconsistent", () => {
  assert.equal(deriveCompletionCredentialState({ ...BASE, reportHash: "0x1234" }), "INCONSISTENT");
});
test("badge balance decimal strings normalize to bigint", () => assert.equal(normalizeCredentialBadgeBalance("12"), BigInt(12)));
test("badge balance safe numbers normalize to bigint", () => assert.equal(normalizeCredentialBadgeBalance(1), BigInt(1)));
test("negative and fractional badge balances are rejected", () => {
  assert.equal(normalizeCredentialBadgeBalance(-1), null);
  assert.equal(normalizeCredentialBadgeBalance(0.5), null);
});
test("wallet addresses normalize to lowercase", () => {
  assert.equal(normalizeCredentialAddress("0x0A31d11Fd14029c12Ef07c2c200085aE622c1541"), "0x0a31d11fd14029c12ef07c2c200085ae622c1541");
});
test("Verified cannot be inferred from completion alone", () => {
  assert.notEqual(deriveCompletionCredentialState({ ...BASE, chainCompleted: false, reportHash: ZERO_BYTES32, badgeBalance: "0" }), "VERIFIED");
});
test("Legacy is not an error state", () => {
  const state = deriveCompletionCredentialState({ ...BASE, reportHash: OTHER_HASH });
  assert.equal(state, "LEGACY_CREDENTIAL");
  assert.notEqual(state, "INCONSISTENT");
});
test("Legacy is not ready", () => {
  assert.notEqual(deriveCompletionCredentialState({ ...BASE, reportHash: OTHER_HASH }), "READY_FOR_ONCHAIN");
});
test("Merit does not affect credential state", () => {
  assert.equal(deriveCompletionCredentialState({ ...BASE, merit: 5000 }), "VERIFIED");
});
test("EXP does not determine chain state", () => {
  assert.equal(deriveCompletionCredentialState({ ...BASE, exp: 0 }), "VERIFIED");
  assert.equal(deriveCompletionCredentialState({ ...BASE, exp: 999999, reportHash: OTHER_HASH }), "LEGACY_CREDENTIAL");
});
test("credential server reuses persisted completion_hash without rehashing", () => {
  assert.match(sources.credentialServer, /completion\?\.completion_hash/u);
  assert.doesNotMatch(sources.credentialServer, /keccak|contentHash|evidenceHash/u);
});
test("credential reads exactly the three approved GuardianQuest values", () => {
  const chain = readFileSync(new URL("../src/lib/quest-1-chain-status.ts", import.meta.url), "utf8");
  assert.match(chain, /makeCallData\("completed"/u);
  assert.match(chain, /makeCallData\("reportHashes"/u);
  assert.match(chain, /makeCallData\("balanceOf"/u);
});
test("authenticated identity is derived from the server session", () => {
  assert.match(sources.credentialServer, /requireAuthenticatedWallet\(\)/u);
  assert.match(sources.sessionServer, /cookies\(\)[\s\S]+readSession\(token\)[\s\S]+walletAddressForDatabase\(session\.walletAddress\)/u);
  assert.match(sources.api, /export async function GET\(\)/u);
});
test("production UI has no Mint Claim or write control", () => {
  assert.doesNotMatch(sources.component, /\bMint\b|\bClaim\b|verifyCompletion|writeContract|sendTransaction/u);
});
test("Stage37 introduces no signer or private-key environment", () => {
  const combined = Object.values(sources).join("\n");
  assert.doesNotMatch(combined, /PRIVATE_KEY|MNEMONIC|createWalletClient|privateKeyToAccount/u);
});
test("RPC failures return safe JSON instead of a credential state", () => {
  assert.match(sources.api, /ChainStatusQueryError[\s\S]+publicMessageForCode/u);
  assert.doesNotMatch(sources.api, /stack/u);
});
test("dialog is semantic and keyboard closable", () => {
  assert.match(sources.component, /<dialog/u);
  assert.match(sources.component, /\.showModal\(\)/u);
  assert.match(sources.component, /\.close\(\)/u);
});
test("credential endpoint is versioned and no-store", () => {
  assert.match(sources.api, /CULTIVATION_CREDENTIAL_SCHEMA_VERSION/u);
  assert.match(sources.api, /noStoreCultivationJson/u);
});

assert.ok(tests.length >= 25);
let passed = 0;
for (const { name, run } of tests) {
  try {
    await run();
    passed += 1;
    console.log(`PASS ${passed}: ${name}`);
  } catch (error) {
    console.error(`FAIL: ${name}`);
    throw error;
  }
}
console.log(`Cultivation Credential Stage 37: ${passed}/${tests.length} PASS`);
