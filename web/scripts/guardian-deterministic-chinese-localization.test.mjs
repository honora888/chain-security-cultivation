import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const sourceRoot = new URL("../src/", import.meta.url);

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") {
      return { shortCircuit: true, url: "data:text/javascript,export%20{}" };
    }
    if (specifier === "next/server") {
      return nextResolve("next/server.js", context);
    }
    if (specifier.startsWith("@/")) {
      const path = specifier.slice(2);
      return {
        shortCircuit: true,
        url: new URL(path.endsWith(".ts") ? path : `${path}.ts`, sourceRoot).href,
      };
    }
    if (
      context.parentURL?.includes("/src/") &&
      specifier.startsWith(".") &&
      !specifier.endsWith(".ts")
    ) {
      return {
        shortCircuit: true,
        url: new URL(`${specifier}.ts`, context.parentURL).href,
      };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.endsWith(".ts")) {
      const filename = fileURLToPath(url);
      const output = ts.transpileModule(readFileSync(filename, "utf8"), {
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022,
        },
        fileName: filename,
      });
      return {
        format: "module",
        shortCircuit: true,
        source: output.outputText,
      };
    }
    return nextLoad(url, context);
  },
});

const { analyzeGuardianSecurityCase } = await import(
  "../src/features/guardian-security/analyze.ts"
);
const { runHybridGuardianAnalysis } = await import(
  "../src/features/guardian-llm/hybrid-analysis.ts"
);
const { issueGuardianDraftForAuthenticatedSample } = await import(
  "../src/features/guardian-draft/issuance.ts"
);
const {
  hashExactGuardianDraftSource,
  verifySignedGuardianDraftV1,
} = await import("../src/lib/guardian-draft-signing.ts");

const NOW = new Date("2026-08-09T00:00:00.000Z");
const SECRET = Buffer.alloc(32, 0x61).toString("base64url");
const WALLET = "0x0A31d11Fd14029c12Ef07c2c200085aE622c1541";
const CASE_NAME = "Guardian 中文确定性回归";
const SOURCES = {
  vulnerableSource: `// 用户原始注释必须逐字保留\ncontract Vault {\n  mapping(address => uint256) balances;\n  function withdraw() external {\n    uint256 amount = balances[msg.sender];\n    (bool ok,) = msg.sender.call{value: amount}("");\n    require(ok);\n    balances[msg.sender] = 0;\n  }\n}\n`,
  attackSource: `contract Attacker {\n  Vault target;\n  receive() external payable { target.withdraw(); }\n}\n`,
  fixedSource: `contract FixedVault {\n  mapping(address => uint256) balances;\n  function withdraw() external {\n    uint256 amount = balances[msg.sender];\n    balances[msg.sender] = 0;\n    (bool ok,) = msg.sender.call{value: amount}("");\n    require(ok);\n  }\n}\n`,
};
const sourceSnapshot = structuredClone(SOURCES);
const request = {
  mode: "sample",
  sample: { name: CASE_NAME, ...SOURCES },
};
const mossEvidence = {
  status: "not-applicable",
  reason: "User-provided samples are not registered Guardian quests.",
};
const deterministic = analyzeGuardianSecurityCase(request, mossEvidence);
let providerCalls = 0;
const disabledOutcome = await runHybridGuardianAnalysis({
  request,
  mode: "disabled",
  provider: {
    providerName: "must-not-run",
    async enhance() {
      providerCalls += 1;
      throw new Error("disabled provider was called");
    },
  },
  runDeterministic: async () => deterministic,
  now: () => NOW,
});
const result = disabledOutcome.response;

function hasChinese(value) {
  return /[\u3400-\u9fff]/u.test(value);
}

function assertChineseList(values, label) {
  assert.ok(values.length > 0, `${label} must not be empty`);
  for (const value of values) {
    assert.equal(hasChinese(value), true, `${label} must contain Chinese: ${value}`);
  }
}

assert.equal(disabledOutcome.kind, "deterministic");
assert.equal(providerCalls, 0);
assert.equal(result, deterministic);

assert.equal(hasChinese(result.analysis.rootCause), true);
assert.match(result.analysis.rootCause, /receive\(\)\/fallback\(\)/u);
assertChineseList(result.analysis.affectedFunctions, "affected functions");
assertChineseList(result.analysis.prerequisites, "analysis prerequisites");
assertChineseList(result.analysis.attackPath, "analysis attackPath");
assertChineseList(result.analysis.mitigations, "analysis mitigations");
assert.equal(hasChinese(result.analysis.impact), true);
assert.equal(hasChinese(result.analysis.repeatability), true);
assert.equal(hasChinese(result.analysis.privilegeRequired), true);
assertChineseList(
  result.analysis.inferences.map((entry) => entry.text),
  "analysis inferences",
);
assertChineseList(
  result.analysis.limitations.map((entry) => entry.text),
  "analysis limitations",
);
assertChineseList(result.limitations, "top-level limitations");
assertChineseList(result.review.reasons, "review reasons");
assertChineseList(
  result.signals.filter((entry) => entry.matched).map((entry) => entry.explanation),
  "matched signal explanations",
);
assertChineseList(result.classification.elements.rationale, "element rationale");
assertChineseList(result.classification.realm.rationale, "realm rationale");
assertChineseList(result.severity.rationale, "severity rationale");
assertChineseList(result.confidence.supportingFactors, "confidence factors");
assertChineseList(result.confidence.missingEvidence, "missing confidence evidence");
assertChineseList(result.bestiaryDraft.evidenceSummary, "evidence summary");
assertChineseList(result.bestiaryDraft.knownLimitations, "Bestiary limitations");
assertChineseList(result.questDraft.knownLimitations, "Quest limitations");

assert.equal(result.analysis.formalType, "Classic Reentrancy");
assert.equal(result.analysis.category, "Reentrancy");
assert.equal(result.classification.elements.primaryElement, "Water");
assert.ok(result.classification.elements.secondaryElements.includes("Earth"));
assert.equal(result.classification.realm.realm, "Core Formation");
assert.equal(result.severity.level, "High");
assert.equal(result.confidence.label, "Medium");
assert.equal(result.agent.mode, "deterministic-rules");
assert.equal(result.agent.externalModelConnected, false);
assert.equal(result.review.requiresHumanApproval, true);
assert.equal(result.review.publishAllowed, false);

const signedDraft = issueGuardianDraftForAuthenticatedSample({
  analysis: result,
  authenticatedWallet: WALLET,
  caseName: CASE_NAME,
  ...SOURCES,
  secret: SECRET,
  now: () => NOW,
  randomBytes: () => Buffer.alloc(16, 0x31),
});
assert.ok(signedDraft);
assert.deepEqual(signedDraft.claims.draft.analysis, result);
assert.equal(hasChinese(signedDraft.claims.draft.analysis.analysis.rootCause), true);

const verified = verifySignedGuardianDraftV1({
  value: signedDraft,
  authenticatedWallet: WALLET,
  caseName: CASE_NAME,
  ...SOURCES,
  secret: SECRET,
  now: () => new Date(NOW.getTime() + 1_000),
});
assert.deepEqual(verified, signedDraft);

assert.deepEqual(SOURCES, sourceSnapshot);
for (const field of ["vulnerableSource", "attackSource", "fixedSource"]) {
  assert.equal(
    signedDraft.claims.sourceHashes[field],
    hashExactGuardianDraftSource(sourceSnapshot[field]),
  );
}

console.log("Guardian deterministic Chinese localization checks PASS");
