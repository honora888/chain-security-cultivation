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
    if (specifier === "next/server") return nextResolve("next/server.js", context);
    if (specifier === "next/headers") return nextResolve("next/headers.js", context);
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
        compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
        fileName: filename,
      });
      return { format: "module", shortCircuit: true, source: output.outputText };
    }
    return nextLoad(url, context);
  },
});

const { GuardianLlmProviderError } = await import("../src/features/guardian-llm/provider.ts");
const { parseGuardianLlmResponse } = await import("../src/features/guardian-llm/response-parser.ts");
const { buildGuardianLlmPrompt } = await import("../src/features/guardian-llm/prompt.ts");
const { runHybridGuardianAnalysis } = await import("../src/features/guardian-llm/hybrid-analysis.ts");
const { GuardianSecurityError } = await import("../src/features/guardian-security/analysis-types.ts");
const { issueGuardianDraftForAuthenticatedSample } = await import("../src/features/guardian-draft/issuance.ts");
const { verifySignedGuardianDraftV1 } = await import("../src/lib/guardian-draft-signing.ts");
const { prepareSignedContribution } = await import("../src/contributions/signed-contribution.ts");
const { assertReviewDecisionAllowedForStoredAnalysis } = await import("../src/reviews/candidate-gate.ts");

const NOW = new Date("2026-08-08T00:00:00.000Z");
const SECRET = Buffer.alloc(32, 0x35).toString("base64url");
const WALLET = "0x0A31d11Fd14029c12Ef07c2c200085aE622c1541";
const CASE_NAME = "Stage 35 Candidate";
const SOURCES = {
  vulnerableSource: "contract Vault { address owner; function setOwner(address next) external { owner = next; } }",
  attackSource: "",
  fixedSource: "",
};

function rawResponse() {
  return {
    candidateFindings: [{
      category: "access-control",
      title: "未授权主印变更候选",
      suggestedSeverity: "High",
      suggestedConfidence: { label: "High", score: 92 },
      explanation: "关键所有者状态可能缺少调用者权限校验。",
      attackPath: ["未授权调用 setOwner。"],
      affectedCode: [{ source: "vulnerableSource", location: "Vault.setOwner", explanation: "直接写入 owner。" }],
      evidence: [{ source: "vulnerableSource", description: "未观察到权限守卫。", locations: ["Vault.setOwner"] }],
      suggestedFix: ["在写入前验证调用者权限。"],
      limitations: ["尚未完成确定性验证。"],
    }],
    candidateBestiarySuggestion: {
      candidateFindingIndex: 0,
      suggestedPrimaryElement: "Metal",
      suggestedSecondaryElements: ["Fire"],
      suggestedCultivationRealm: "Core Formation",
      lore: "无门之兽窥伺失守的主印边界。",
      behavior: ["常在关键权限变更附近出没。", "会追随未经授权的状态写入。"],
      attackTechnique: "趁守卫缺位时夺取主印。",
      countermeasure: "在关键状态变更前完成权限校验。",
      cultivationLesson: "修炼应先守权限边界，再允许状态流转。",
    },
    publicSummary: "发现一个需要人工审核的访问控制候选。",
    bestiaryNameCandidates: ["无门之兽", "夺主妖", "噬权兽", "锁魂魇"],
  };
}

function expectInvalid(mutator) {
  const value = rawResponse();
  mutator(value);
  assert.throws(
    () => parseGuardianLlmResponse(value),
    (error) => error instanceof GuardianLlmProviderError && error.code === "INVALID_RESPONSE",
  );
}

let providerCalls = 0;
const candidateOutcome = await runHybridGuardianAnalysis({
  request: { mode: "sample", sample: { name: CASE_NAME, ...SOURCES } },
  mode: "hybrid",
  provider: {
    providerName: "fake-stage35-2",
    async enhance() { providerCalls += 1; return parseGuardianLlmResponse(rawResponse()); },
  },
  runDeterministic: async () => { throw new GuardianSecurityError("UNSUPPORTED_VULNERABILITY"); },
  now: () => new Date(NOW),
});
assert.equal(candidateOutcome.kind, "candidate-only");
const analysis = candidateOutcome.response;
const signedDraft = issueGuardianDraftForAuthenticatedSample({
  analysis,
  authenticatedWallet: WALLET,
  caseName: CASE_NAME,
  ...SOURCES,
  secret: SECRET,
  now: () => new Date(NOW),
  randomBytes: () => Buffer.alloc(16, 0x35),
});
assert.ok(signedDraft);

const tests = [];
function test(name, run) { tests.push({ name, run }); }

test("valid candidate Bestiary suggestion parses", () => assert.equal(parseGuardianLlmResponse(rawResponse()).candidateBestiarySuggestion?.suggestedPrimaryElement, "Metal"));
test("invalid primary element rejects", () => expectInvalid((value) => { value.candidateBestiarySuggestion.suggestedPrimaryElement = "metal"; }));
test("invalid secondary element rejects", () => expectInvalid((value) => { value.candidateBestiarySuggestion.suggestedSecondaryElements = ["Void"]; }));
test("duplicate secondary element rejects", () => expectInvalid((value) => { value.candidateBestiarySuggestion.suggestedSecondaryElements = ["Fire", "Fire"]; }));
test("primary duplicated in secondary rejects", () => expectInvalid((value) => { value.candidateBestiarySuggestion.suggestedSecondaryElements = ["Metal"]; }));
test("invalid realm rejects", () => expectInvalid((value) => { value.candidateBestiarySuggestion.suggestedCultivationRealm = "golden_core"; }));
test("bad candidateFindingIndex rejects", () => expectInvalid((value) => { value.candidateBestiarySuggestion.candidateFindingIndex = 1; }));
test("empty lore rejects", () => expectInvalid((value) => { value.candidateBestiarySuggestion.lore = ""; }));
test("empty behavior rejects", () => expectInvalid((value) => { value.candidateBestiarySuggestion.behavior = []; }));
test("malformed attackTechnique rejects", () => expectInvalid((value) => { value.candidateBestiarySuggestion.attackTechnique = ""; }));
test("malformed countermeasure rejects", () => expectInvalid((value) => { value.candidateBestiarySuggestion.countermeasure = ""; }));
test("malformed cultivationLesson rejects", () => expectInvalid((value) => { value.candidateBestiarySuggestion.cultivationLesson = ""; }));
test("authority field injection rejects", () => expectInvalid((value) => { value.candidateBestiarySuggestion.published = true; }));
test("trusted prompt requires Chinese candidate presentation and review semantics", () => {
  const prompt = buildGuardianLlmPrompt({ schemaVersion: "guardian-llm-v1", verifiedFindings: [], untrustedSources: { vulnerableSource: SOURCES.vulnerableSource } });
  assert.match(prompt.systemInstruction, /presentation suggestions only/u);
  assert.match(prompt.systemInstruction, /Simplified Chinese/u);
  assert.match(prompt.systemInstruction, /human reviewer must confirm/u);
});
test("exact existing ElementName values are reused", () => assert.equal(parseGuardianLlmResponse(rawResponse()).candidateBestiarySuggestion?.suggestedPrimaryElement, "Metal"));
test("exact existing RealmName values are reused", () => assert.equal(parseGuardianLlmResponse(rawResponse()).candidateBestiarySuggestion?.suggestedCultivationRealm, "Core Formation"));
test("signed draft contains the suggestion before HMAC issuance", () => assert.deepEqual(signedDraft.claims.draft.analysis.llmEnhancement.candidateBestiarySuggestion, rawResponse().candidateBestiarySuggestion));
test("tampering the signed suggestion invalidates the signature", () => {
  const tampered = structuredClone(signedDraft);
  tampered.claims.draft.analysis.llmEnhancement.candidateBestiarySuggestion.lore = "篡改设定。";
  assert.throws(() => verifySignedGuardianDraftV1({ value: tampered, authenticatedWallet: WALLET, caseName: CASE_NAME, ...SOURCES, secret: SECRET, now: () => new Date(NOW) }));
});
test("old signed draft without suggestion remains parseable", () => {
  const legacyAnalysis = structuredClone(analysis);
  delete legacyAnalysis.llmEnhancement.candidateBestiarySuggestion;
  const legacy = issueGuardianDraftForAuthenticatedSample({ analysis: legacyAnalysis, authenticatedWallet: WALLET, caseName: CASE_NAME, ...SOURCES, secret: SECRET, now: () => new Date(NOW), randomBytes: () => Buffer.alloc(16, 0x36) });
  assert.ok(legacy);
  assert.doesNotThrow(() => verifySignedGuardianDraftV1({ value: legacy, authenticatedWallet: WALLET, caseName: CASE_NAME, ...SOURCES, secret: SECRET, now: () => new Date(NOW) }));
});
test("contribution persistence wrapper preserves the suggestion unchanged", () => {
  const prepared = prepareSignedContribution({ submission: { caseName: CASE_NAME, ...SOURCES, signedDraft }, authenticatedWallet: WALLET, secret: SECRET, now: () => new Date(NOW) });
  assert.deepEqual(prepared.storedAnalysis.signedDraft.claims.draft.analysis.llmEnhancement.candidateBestiarySuggestion, analysis.llmEnhancement.candidateBestiarySuggestion);
});
test("candidate persistence leaves authoritative DB metadata null", () => {
  const prepared = prepareSignedContribution({ submission: { caseName: CASE_NAME, ...SOURCES, signedDraft }, authenticatedWallet: WALLET, secret: SECRET, now: () => new Date(NOW) });
  assert.equal(prepared.formalType, null);
  assert.equal(prepared.primaryElement, null);
  assert.equal(prepared.severityLabel, null);
  assert.equal(prepared.confidenceLabel, null);
});
test("contributor UI maps machine elements to Chinese", () => {
  const source = readFileSync(new URL("../src/features/guardian-security-ui/guardian-candidate-results.tsx", import.meta.url), "utf8");
  assert.match(source, /cultivationElementLabel\(suggestion\.suggestedPrimaryElement\)/u);
});
test("contributor UI maps machine realms to Chinese", () => {
  const source = readFileSync(new URL("../src/features/guardian-security-ui/guardian-candidate-results.tsx", import.meta.url), "utf8");
  assert.match(source, /cultivationRealmLabel\(suggestion\.suggestedCultivationRealm\)/u);
});
test("reviewer UI maps machine values to Chinese only", () => {
  const source = readFileSync(new URL("../src/features/reviewer-ui/reviewer-pages.tsx", import.meta.url), "utf8");
  assert.match(source, /cultivationElementLabel\(analysis\.candidateBestiarySuggestion\.suggestedPrimaryElement\)/u);
  assert.match(source, /cultivationRealmLabel\(analysis\.candidateBestiarySuggestion\.suggestedCultivationRealm\)/u);
});
test("candidate cultivation fields do not concatenate Metal into user output", () => {
  const source = readFileSync(new URL("../src/features/guardian-security-ui/guardian-candidate-results.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /suggestedPrimaryElement\}\s*·/u);
});
test("candidate cultivation fields do not concatenate Core Formation into user output", () => {
  const source = readFileSync(new URL("../src/features/guardian-security-ui/guardian-candidate-results.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /suggestedCultivationRealm\}\s*·/u);
});
test("confidence normalization remains correct", () => assert.deepEqual(parseGuardianLlmResponse({ ...rawResponse(), candidateFindings: [{ ...rawResponse().candidateFindings[0], suggestedConfidence: { label: "High", score: 1 } }] }).candidateFindings[0].suggestedConfidence, { label: "Low", score: 1 }));
test("candidate approval gate remains blocked", () => {
  const stored = { schemaVersion: "guardian-signed-contribution-v1", signedDraft };
  assert.throws(() => assertReviewDecisionAllowedForStoredAnalysis(stored, "approved"));
});
test("one fake provider call creates the candidate analysis", () => assert.equal(providerCalls, 1));
test("candidate-only analysis remains non-authoritative", () => {
  assert.equal(analysis.deterministic, null);
  assert.equal(analysis.submission.allowed, false);
  assert.equal(analysis.review.publishAllowed, false);
});

let passed = 0;
for (const { name, run } of tests) {
  await run();
  passed += 1;
  console.log(`PASS ${passed}: ${name}`);
}
console.log(`Guardian Candidate Bestiary Stage 35.2: ${passed}/${tests.length} PASS`);
