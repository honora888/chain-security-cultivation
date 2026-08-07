import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const sourceRoot = new URL("../src/", import.meta.url);
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") return { shortCircuit: true, url: "data:text/javascript,export%20{}" };
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

const { GuardianSecurityError } = await import("../src/features/guardian-security/analysis-types.ts");
const { runHybridGuardianAnalysis } = await import("../src/features/guardian-llm/hybrid-analysis.ts");
const { issueGuardianDraftForAuthenticatedSample } = await import("../src/features/guardian-draft/issuance.ts");
const { parseContributionInput, resolveContributionCredential } = await import("../src/contributions/http.ts");
const { ContributionHttpError } = await import("../src/contributions/constants.ts");
const {
  prepareSignedContribution,
  isCandidateSignedContribution,
  signedCandidateAnalysis,
} = await import("../src/contributions/signed-contribution.ts");
const { persistPreparedSignedContribution } = await import("../src/contributions/server.ts");
const { createSignedContribution } = await import("../src/features/contributor-ui/contributor-api-client.ts");
const { parseReviewerCandidateAnalysis } = await import("../src/features/reviewer-ui/reviewer-api-client.ts");
const { assertReviewDecisionAllowedForStoredAnalysis } = await import("../src/reviews/candidate-gate.ts");

const NOW = new Date("2026-08-08T00:00:00.000Z");
const SECRET = Buffer.alloc(32, 0x64).toString("base64url");
const WALLET = "0x0A31d11Fd14029c12Ef07c2c200085aE622c1541";
const SOURCES = {
  vulnerableSource: "contract Vault { address owner; function setOwner(address next) external { owner = next; } }",
  attackSource: "",
  fixedSource: "",
};
const CASE_NAME = "Access Control Candidate";

function llmResponse() {
  return {
    candidateFindings: [{
      candidateId: "candidate-1",
      category: "access-control",
      title: "未授权所有者变更候选",
      verification: "llm_candidate",
      suggestedSeverity: "High",
      suggestedConfidence: { label: "Medium", score: 74 },
      explanation: "状态变更可能缺少调用者授权检查。",
      attackPath: ["未授权地址调用所有者变更函数。"],
      affectedCode: [{ source: "vulnerableSource", location: "Vault.setOwner", explanation: "未观察到权限条件。" }],
      evidence: [{ source: "vulnerableSource", description: "函数直接写入 owner。", locations: ["Vault.setOwner"], provenance: "llm_candidate" }],
      suggestedFix: ["增加明确的授权检查。"],
      limitations: ["尚未完成确定性验证。"],
    }],
    publicSummary: "发现一个需要人工验证的访问控制候选。",
    bestiaryNameCandidates: ["越权夺印兽", "无门守印兽", "盗令影兽", "夺主潜兽"],
  };
}

async function candidateFixture() {
  const outcome = await runHybridGuardianAnalysis({
    request: { mode: "sample", sample: { name: CASE_NAME, ...SOURCES } },
    mode: "hybrid",
    provider: { providerName: "fake-stage34-4", async enhance() { return llmResponse(); } },
    runDeterministic: async () => { throw new GuardianSecurityError("UNSUPPORTED_VULNERABILITY"); },
    now: () => new Date(NOW),
  });
  assert.equal(outcome.kind, "candidate-only");
  const signedDraft = issueGuardianDraftForAuthenticatedSample({
    analysis: outcome.response,
    authenticatedWallet: WALLET,
    caseName: CASE_NAME,
    ...SOURCES,
    secret: SECRET,
    now: () => new Date(NOW),
    randomBytes: () => Buffer.alloc(16, 0x34),
  });
  assert.ok(signedDraft);
  return { analysis: outcome.response, signedDraft };
}

const tests = [];
function test(name, run) { tests.push({ name, run }); }
function expectCode(run, code) {
  assert.throws(run, (error) => error instanceof ContributionHttpError && error.code === code);
}

const fixture = await candidateFixture();
const submission = { caseName: CASE_NAME, ...SOURCES, signedDraft: fixture.signedDraft };
const prepare = (overrides = {}) => prepareSignedContribution({
  submission: overrides.submission ?? submission,
  authenticatedWallet: overrides.wallet ?? WALLET,
  secret: Object.hasOwn(overrides, "secret") ? overrides.secret : SECRET,
  now: overrides.now ?? (() => new Date(NOW.getTime() + 1_000)),
});

test("valid signed candidate prepares pending-review persistence input", () => assert.equal(prepare().caseName, CASE_NAME));
test("authenticated server wallet is canonical persistence authority", () => assert.equal(prepare().contributorAddress, WALLET.toLowerCase()));
test("strict parser rejects body wallet injection", () => expectCode(() => parseContributionInput({ ...submission, walletAddress: WALLET }), "INVALID_REQUEST"));
test("tampered signed analysis rejects", () => { const value = structuredClone(submission); value.signedDraft.claims.draft.analysis.llmEnhancement.publicSummary += "tamper"; expectCode(() => prepare({ submission: value }), "SIGNED_DRAFT_SIGNATURE_INVALID"); });
test("wrong wallet rejects", () => expectCode(() => prepare({ wallet: "0x000000000000000000000000000000000000dEaD" }), "SIGNED_DRAFT_WALLET_MISMATCH"));
for (const field of ["vulnerableSource", "attackSource", "fixedSource"]) {
  test(`changed ${field} rejects`, () => expectCode(() => prepare({ submission: { ...submission, [field]: `${submission[field]}changed` } }), "SIGNED_DRAFT_SOURCE_MISMATCH"));
}
test("changed case name rejects", () => expectCode(() => prepare({ submission: { ...submission, caseName: "Changed" } }), "SIGNED_DRAFT_CASE_NAME_MISMATCH"));
test("expired draft rejects", () => expectCode(() => prepare({ now: () => new Date(NOW.getTime() + 16 * 60_000) }), "SIGNED_DRAFT_EXPIRED"));
test("malformed signature rejects", () => expectCode(() => prepare({ submission: { ...submission, signedDraft: { ...fixture.signedDraft, signature: "bad" } } }), "SIGNED_DRAFT_SIGNATURE_MALFORMED"));
test("unsupported version rejects", () => { const value = structuredClone(fixture.signedDraft); value.claims.schemaVersion = "guardian-signed-draft-v2"; expectCode(() => prepare({ submission: { ...submission, signedDraft: value } }), "SIGNED_DRAFT_VERSION_UNSUPPORTED"); });
test("missing signing secret fails safely", () => expectCode(() => prepare({ secret: undefined }), "DRAFT_SIGNING_NOT_CONFIGURED"));
test("persistence wrapper deep-equals issued draft", () => assert.deepEqual(prepare().storedAnalysis.signedDraft, fixture.signedDraft));
test("persistence schema is versioned", () => assert.equal(prepare().storedAnalysis.schemaVersion, "guardian-signed-contribution-v1"));
test("selected Bestiary name is exactly signed", () => assert.equal(prepare().proposedBestiaryName, fixture.signedDraft.claims.draft.selectedBestiaryName));
test("candidate formal type remains null", () => assert.equal(prepare().formalType, null));
test("candidate element remains null", () => assert.equal(prepare().primaryElement, null));
test("candidate severity remains null", () => assert.equal(prepare().severityLabel, null));
test("candidate confidence remains null", () => assert.equal(prepare().confidenceLabel, null));
test("candidate detector recognizes stored wrapper", () => assert.equal(isCandidateSignedContribution(prepare().storedAnalysis), true));
test("candidate reader returns exact signed analysis", () => assert.deepEqual(signedCandidateAnalysis(prepare().storedAnalysis), fixture.analysis));
test("reviewer parser reads candidate wrapper", () => assert.equal(parseReviewerCandidateAnalysis(prepare().storedAnalysis)?.findings[0]?.verification, "llm_candidate"));
test("reviewer parser preserves selected name", () => assert.equal(parseReviewerCandidateAnalysis(prepare().storedAnalysis)?.selectedBestiaryName, "越权夺印兽"));
test("reviewer approve is server rejected", () => assert.throws(() => assertReviewDecisionAllowedForStoredAnalysis(prepare().storedAnalysis, "approved"), /需先完成/u));
test("reviewer changes_requested remains allowed", () => assert.doesNotThrow(() => assertReviewDecisionAllowedForStoredAnalysis(prepare().storedAnalysis, "changes_requested")));
test("reviewer rejected remains allowed", () => assert.doesNotThrow(() => assertReviewDecisionAllowedForStoredAnalysis(prepare().storedAnalysis, "rejected")));
test("legacy parser still accepts exact four-field body", () => assert.equal(parseContributionInput({ caseName: CASE_NAME, ...SOURCES }).caseName, CASE_NAME));
test("legacy digest credential resolves legacy mode", () => assert.equal(resolveContributionCredential(parseContributionInput({ caseName: CASE_NAME, ...SOURCES }), "a".repeat(64)).mode, "legacy"));
test("signed credential resolves signed mode", () => assert.equal(resolveContributionCredential(parseContributionInput(submission), null).mode, "signed"));
test("ambiguous signed plus digest rejects", () => expectCode(() => resolveContributionCredential(parseContributionInput(submission), "a".repeat(64)), "INVALID_REQUEST"));
test("neither credential rejects", () => expectCode(() => resolveContributionCredential(parseContributionInput({ caseName: CASE_NAME, ...SOURCES }), null), "INVALID_REQUEST"));
test("unexpected signed body field rejects", () => expectCode(() => parseContributionInput({ ...submission, mode: "signed" }), "INVALID_REQUEST"));

test("atomic CTE persists case and reservation in one query", async () => {
  let captured;
  const row = { case_id: "case-00000000-0000-4000-8000-000000000001", case_hash: "hash", case_name: CASE_NAME, contributor_address: WALLET.toLowerCase(), formal_type: null, primary_element: null, secondary_elements: [], severity_label: null, severity_score: null, confidence_label: null, confidence_score: null, proposed_bestiary_name: "越权夺印兽", status: "pending_review", created_at: NOW.toISOString() };
  const sql = { async query(query, params) { captured = { query, params }; return [row]; } };
  const result = await persistPreparedSignedContribution(sql, prepare(), row.case_id);
  assert.equal(result.case.status, "pending_review");
  assert.match(captured.query, /WITH inserted_case[\s\S]+reserved_name/u);
  assert.equal(captured.params[15], "越权夺印兽");
});
test("occupied exact name maps to unavailable without rename", async () => {
  const sql = { async query() { const error = new Error("collision"); error.constraint = "bestiary_name_reservations_active_name_unique"; throw error; } };
  await assert.rejects(() => persistPreparedSignedContribution(sql, prepare()), (error) => error.code === "BESTIARY_NAME_UNAVAILABLE");
});
test("transaction failure uses one atomic call and cannot leave application-level orphan", async () => {
  let calls = 0;
  const sql = { async query() { calls += 1; throw new Error("failure"); } };
  await assert.rejects(() => persistPreparedSignedContribution(sql, prepare()), (error) => error.code === "DATABASE_UNAVAILABLE");
  assert.equal(calls, 1);
});

test("signed client sends no wallet and no legacy digest", async () => {
  const originalFetch = globalThis.fetch;
  let request;
  globalThis.fetch = async (url, init) => {
    request = { url, init };
    return new Response(JSON.stringify({ ok: true, case: { caseId: "case-00000000-0000-4000-8000-000000000001", caseName: CASE_NAME, proposedBestiaryName: "越权夺印兽", formalType: null, primaryElement: null, secondaryElements: [], severity: { label: null, score: null }, confidence: { label: null, score: null }, status: "pending_review", createdAt: NOW.toISOString() } }), { status: 201, headers: { "Content-Type": "application/json" } });
  };
  try {
    const result = await createSignedContribution({ caseName: CASE_NAME, ...SOURCES }, fixture.signedDraft);
    assert.equal(result.status, "pending_review");
    const body = JSON.parse(request.init.body);
    assert.equal("walletAddress" in body, false);
    assert.equal(new Headers(request.init.headers).has("X-Guardian-Analysis-Digest"), false);
    assert.deepEqual(body.signedDraft, fixture.signedDraft);
  } finally { globalThis.fetch = originalFetch; }
});

test("signed contribution server has no Guardian LLM provider import", () => {
  const source = readFileSync(new URL("../src/contributions/server.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /guardian-llm|gemini|runHybridGuardianAnalysis/u);
});
test("signed branch is selected before legacy analysis", () => {
  const route = readFileSync(new URL("../src/app/api/contributions/cases/route.ts", import.meta.url), "utf8");
  assert.match(route, /credential\.mode === "signed"[\s\S]+createSignedContribution/u);
});
test("legacy deterministic analysis and digest comparison remain present", () => {
  const server = readFileSync(new URL("../src/contributions/server.ts", import.meta.url), "utf8");
  assert.match(server, /analyzeContribution\(input\)/u);
  assert.match(server, /guardianAnalysisDigest\(analysis\) !== expectedAnalysisDigest/u);
});
test("candidate publication remains impossible in public query without bestiary row", () => {
  const server = readFileSync(new URL("../src/reviews/server.ts", import.meta.url), "utf8");
  const gate = readFileSync(new URL("../src/reviews/candidate-gate.ts", import.meta.url), "utf8");
  assert.match(server, /publication_status[\s\S]+published/u);
  assert.match(server, /assertReviewDecisionAllowedForStoredAnalysis/u);
  assert.match(gate, /CANDIDATE_REQUIRES_VERIFICATION/u);
});
test("errors never contain signing secret or source", () => {
  try { prepare({ secret: undefined }); } catch (error) {
    assert.doesNotMatch(error.message, new RegExp(SECRET, "u"));
    assert.doesNotMatch(error.message, /contract Vault/u);
  }
});

let passed = 0;
for (const { name, run } of tests) {
  try { await run(); passed += 1; console.log(`PASS ${passed}: ${name}`); }
  catch (error) { console.error(`FAIL: ${name}`); throw error; }
}
console.log(`${passed}/${tests.length} PASS`);
