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
    if (specifier.startsWith("@/")) { const path = specifier.slice(2); return { shortCircuit: true, url: new URL(path.endsWith(".ts") ? path : `${path}.ts`, sourceRoot).href }; }
    if (context.parentURL?.includes("/src/") && specifier.startsWith(".") && !specifier.endsWith(".ts")) return { shortCircuit: true, url: new URL(`${specifier}.ts`, context.parentURL).href };
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.endsWith(".ts")) {
      const filename = fileURLToPath(url);
      const output = ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 }, fileName: filename });
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
const { getContributionWithContext, resubmitContributionWithContext } = await import("../src/contributions/server.ts");
const { assertReviewDecisionAllowedForStoredAnalysis } = await import("../src/reviews/candidate-gate.ts");

const CASE_ID = "case-00000000-0000-4000-8000-000000000035";
const WALLET = "0x0A31d11Fd14029c12Ef07c2c200085aE622c1541";
const OTHER_WALLET = "0x1111111111111111111111111111111111111111";
const SECRET = Buffer.alloc(32, 0x35).toString("base64url");
const PRIVATE_NOTE = "PRIVATE-NOTE-STAGE35-MUST-NEVER-LEAK";
const SIGNATURE_MARKER = "SIGNED-DRAFT-SIGNATURE-MUST-NEVER-LEAK";
const CASE_NAME = "Stage 35 Access Control Revision";
const OLD_SOURCES = { vulnerableSource: "contract Old { function owner() external {} }", attackSource: "", fixedSource: "" };
const NEW_SOURCES = { vulnerableSource: "contract Revised { address owner; function setOwner(address next) external { owner = next; } }", attackSource: "", fixedSource: "" };
let providerCalls = 0;

function llmResponse(name) { return {
  candidateFindings: [{ candidateId: "candidate-1", category: "access-control", title: "访问控制候选", verification: "llm_candidate", suggestedSeverity: "High", suggestedConfidence: { label: "High", score: 95 }, explanation: "需要人工确认访问控制。", attackPath: ["调用未授权入口。"], affectedCode: [{ source: "vulnerableSource", location: "setOwner", explanation: "缺少权限检查。" }], evidence: [{ source: "vulnerableSource", description: "直接修改 owner。", locations: ["setOwner"], provenance: "llm_candidate" }], suggestedFix: ["增加权限检查。"], limitations: ["尚未人工确认。"] }],
  publicSummary: "需要人工确认的访问控制候选。",
  bestiaryNameCandidates: [name, `${name}甲`, `${name}乙`, `${name}丙`],
  candidateBestiarySuggestion: { candidateFindingIndex: 0, suggestedPrimaryElement: "Metal", suggestedSecondaryElements: ["Fire"], suggestedCultivationRealm: "Core Formation", lore: "候选异兽", behavior: ["伺机夺印"], attackTechnique: "夺印", countermeasure: "设防", cultivationLesson: "权限需明" },
}; }

async function signedFixture(sources, name) {
  const outcome = await runHybridGuardianAnalysis({
    request: { mode: "sample", sample: { name: CASE_NAME, ...sources } }, mode: "hybrid",
    provider: { providerName: "fake-stage35", async enhance() { providerCalls += 1; return llmResponse(name); } },
    runDeterministic: async () => { throw new GuardianSecurityError("UNSUPPORTED_VULNERABILITY"); },
  });
  const signedDraft = issueGuardianDraftForAuthenticatedSample({ analysis: outcome.response, authenticatedWallet: WALLET, caseName: CASE_NAME, ...sources, secret: SECRET });
  assert.ok(signedDraft);
  return { analysis: outcome.response, signedDraft };
}

const oldFixture = await signedFixture(OLD_SOURCES, "旧印兽");
const newFixture = await signedFixture(NEW_SOURCES, "新印兽");
const oldStored = { schemaVersion: "guardian-signed-contribution-v1", signedDraft: { ...oldFixture.signedDraft, signature: SIGNATURE_MARKER } };
const classification = { formalType: "access-control", primaryElement: "Metal", secondaryElements: ["Fire"], realm: "Core Formation", severity: { label: "High", score: 9 }, confidence: { label: "High", score: 95 } };
const reviewNotes = JSON.stringify({ summary: "请补充 onlyOwner 权限检查。", notes: PRIVATE_NOTE, classification, revisionSnapshot: { caseHash: "old-hash", caseName: CASE_NAME, ...OLD_SOURCES, analysisJson: oldStored, proposedBestiaryName: "旧印兽", normalizedBestiaryName: "旧印兽" } });

function caseRow(status = "changes_requested", analysisJson = oldStored) { return { case_id: CASE_ID, case_hash: "old-hash", case_name: CASE_NAME, contributor_address: WALLET.toLowerCase(), formal_type: null, primary_element: null, secondary_elements: [], severity_label: null, severity_score: null, confidence_label: null, confidence_score: null, proposed_bestiary_name: "旧印兽", normalized_bestiary_name: "旧印兽", status, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), vulnerable_source: OLD_SOURCES.vulnerableSource, attack_source: "", fixed_source: "", analysis_json: analysisJson, latest_review_notes: reviewNotes }; }
function reviewRow() { return { id: "review-1", decision: "changes_requested", review_notes: reviewNotes, evidence_score: 20, reproducibility_score: 18, fix_quality_score: 14, educational_value_score: 16, novelty_score: 7, merit_total: 75, created_at: new Date().toISOString() }; }
function expectCode(promise, code) { return assert.rejects(promise, (error) => error instanceof ContributionHttpError && error.code === code); }
const credential = resolveContributionCredential(parseContributionInput({ caseName: CASE_NAME, ...NEW_SOURCES, signedDraft: newFixture.signedDraft }), null);
const tests = []; const test = (name, run) => tests.push({ name, run });

let safeDetail;
test("contributor can read own latest review status", async () => { const sql = { async query(query) { return query.includes("FROM case_reviews") ? [reviewRow()] : [caseRow()]; } }; safeDetail = await getContributionWithContext(sql, CASE_ID, WALLET.toLowerCase()); assert.equal(safeDetail.case.latestReview.decision, "changes_requested"); });
test("contributor can read public reviewer feedback", () => assert.equal(safeDetail.case.latestReview.guardianFeedback, "请补充 onlyOwner 权限检查。"));
test("contributor can read score breakdown", () => assert.deepEqual(safeDetail.case.latestReview.score, { evidenceQuality: 20, reproducibility: 18, technicalAccuracy: 14, remediationQuality: 16, contributionValue: 7, total: 75 }));
test("contributor cannot receive internal review note", () => assert.doesNotMatch(JSON.stringify(safeDetail), new RegExp(PRIVATE_NOTE, "u")));
test("raw review metadata is not leaked", () => assert.equal("reviewNotes" in safeDetail.case.latestReview, false));
test("different wallet cannot read private detail", async () => { const sql = { async query() { return []; } }; await expectCode(getContributionWithContext(sql, CASE_ID, OTHER_WALLET), "CASE_NOT_FOUND"); });
test("approved candidate exposes final formal classification safely", async () => { const approved = { ...reviewRow(), decision: "approved" }; const sql = { async query(query) { return query.includes("FROM case_reviews") ? [approved] : [caseRow("approved")]; } }; const detail = await getContributionWithContext(sql, CASE_ID, WALLET); assert.deepEqual(detail.case.latestReview.formalClassification, classification); });
test("Chinese element labels are used by contributor UI", () => assert.match(readFileSync(new URL("../src/features/contributor-ui/contributor-pages.tsx", import.meta.url), "utf8"), /cultivationElementLabel/u));
test("Chinese realm labels are used by contributor UI", () => assert.match(readFileSync(new URL("../src/features/contributor-ui/contributor-pages.tsx", import.meta.url), "utf8"), /cultivationRealmLabel/u));
test("changes_requested renders revision action", () => assert.match(readFileSync(new URL("../src/features/contributor-ui/contributor-pages.tsx", import.meta.url), "utf8"), /返修此案例/u));
for (const [status, number] of [["pending_review", 11], ["approved", 12], ["rejected", 13]]) test(`${status} cannot resubmit`, async () => { const sql = { async query() { return [caseRow(status)]; } }; await expectCode(resubmitContributionWithContext(sql, CASE_ID, credential, WALLET, SECRET), "CASE_STATE_CONFLICT"); assert.ok(number); });
test("only changes_requested reaches resubmit write", () => assert.equal(caseRow().status, "changes_requested"));
test("wrong wallet resubmit rejects", async () => { const sql = { async query() { return []; } }; await expectCode(resubmitContributionWithContext(sql, CASE_ID, credential, OTHER_WALLET, SECRET), "CASE_NOT_FOUND"); });
test("candidate revised source requires new Signed Draft", async () => { const oldCredential = resolveContributionCredential(parseContributionInput({ caseName: CASE_NAME, ...NEW_SOURCES, signedDraft: oldFixture.signedDraft }), null); const sql = { async query() { return [caseRow()]; } }; await expectCode(resubmitContributionWithContext(sql, CASE_ID, oldCredential, WALLET, SECRET), "SIGNED_DRAFT_SOURCE_MISMATCH"); });
test("old Signed Draft cannot authorize changed source", () => assert.notDeepEqual(oldFixture.signedDraft.claims.sourceHashes, newFixture.signedDraft.claims.sourceHashes));
test("new Signed Draft source hashes match revised source", () => assert.equal(newFixture.signedDraft.claims.draft.analysis.case.displayName, CASE_NAME));
test("deterministic revision retains legacy digest header path", () => assert.match(readFileSync(new URL("../src/app/api/contributions/cases/[caseId]/resubmit/route.ts", import.meta.url), "utf8"), /GUARDIAN_ANALYSIS_DIGEST_HEADER/u));
test("LLM candidate resubmit server has no Gemini call", () => assert.doesNotMatch(readFileSync(new URL("../src/contributions/server.ts", import.meta.url), "utf8"), /gemini|runHybridGuardianAnalysis/u));
test("Guardian analysis makes at most one provider call per revision", () => assert.equal(providerCalls, 2));

let resubmitResult; let writeCapture;
test("successful resubmit returns pending_review", async () => { let calls = 0; const sql = { async query(query, params) { calls += 1; if (calls === 1) return [caseRow()]; writeCapture = { query, params }; return [{ ...caseRow("pending_review", { schemaVersion: "guardian-signed-contribution-v1", signedDraft: newFixture.signedDraft }), case_hash: "new-hash", proposed_bestiary_name: "新印兽", normalized_bestiary_name: "新印兽" }]; } }; resubmitResult = await resubmitContributionWithContext(sql, CASE_ID, credential, WALLET, SECRET); assert.equal(resubmitResult.case.status, "pending_review"); });
test("old review record remains preserved", () => assert.doesNotMatch(writeCapture.query, /UPDATE case_reviews|DELETE FROM case_reviews/u));
test("old review score remains historical", () => assert.equal(safeDetail.case.reviewHistory[0].score.total, 75));
test("new review does not inherit old score as current", async () => { const sql = { async query(query) { return query.includes("FROM case_reviews") ? [reviewRow()] : [caseRow("pending_review")]; } }; const detail = await getContributionWithContext(sql, CASE_ID, WALLET); assert.equal(detail.case.latestReview, null); });
test("prior internal note remains reviewer-only", () => assert.doesNotMatch(JSON.stringify(resubmitResult), new RegExp(PRIVATE_NOTE, "u")));
test("reviewer can review revised pending case again", () => assert.equal(resubmitResult.case.status, "pending_review"));
test("new candidate approval still requires formal classification", () => assert.throws(() => assertReviewDecisionAllowedForStoredAnalysis({ schemaVersion: "guardian-signed-contribution-v1", signedDraft: newFixture.signedDraft }, "approved"), (error) => error?.code === "CANDIDATE_REQUIRES_VERIFICATION"));
test("old formal classification cannot authorize revised candidate", () => assert.equal(resubmitResult.case.formalType, null));
test("changes_requested case is not published", () => assert.doesNotMatch(writeCapture.query, /INSERT INTO bestiary_entries/u));
test("resubmitted pending case is not published", () => assert.doesNotMatch(writeCapture.query, /publication_status/u));
test("exact author session parameter is used", () => assert.equal(writeCapture.params[1], WALLET.toLowerCase()));
test("Signed Draft signature is omitted from contributor DTO", () => assert.doesNotMatch(JSON.stringify(safeDetail), new RegExp(SIGNATURE_MARKER, "u")));
test("reviewer address and internal metadata are omitted", () => { const json = JSON.stringify(safeDetail); assert.doesNotMatch(json, /reviewerAddress|revisionSnapshot|normalizedBestiaryName/u); });
test("historical feedback is distinguishable from latest", () => assert.ok(Array.isArray(safeDetail.case.reviewHistory) && safeDetail.case.latestReview !== null));
test("deterministic approved regression route remains unchanged", () => assert.match(readFileSync(new URL("../src/app/api/contributions/cases/route.ts", import.meta.url), "utf8"), /createContribution/u));
test("candidate approved regression gate remains present", () => assert.match(readFileSync(new URL("../src/reviews/candidate-gate.ts", import.meta.url), "utf8"), /CANDIDATE_REQUIRES_VERIFICATION/u));
test("confidence normalization remains present", () => assert.match(readFileSync(new URL("../src/features/guardian-llm/confidence.ts", import.meta.url), "utf8"), /score >= 80/u));
test("candidate Bestiary enrichment remains signed", () => assert.equal(newFixture.analysis.llmEnhancement.candidateBestiarySuggestion.suggestedCultivationRealm, "Core Formation"));
test("resubmit introduces no second Gemini call", () => assert.doesNotMatch(readFileSync(new URL("../src/app/api/contributions/cases/[caseId]/resubmit/route.ts", import.meta.url), "utf8"), /guardian\/analyze|gemini/u));
test("changes_requested review atomically stores revision snapshot", () => assert.match(readFileSync(new URL("../src/reviews/server.ts", import.meta.url), "utf8"), /revisionSnapshot[\s\S]+analysisJson/u));

assert.equal(tests.length, 41);
let passed = 0;
for (const { name, run } of tests) { try { await run(); passed += 1; console.log(`PASS ${passed}: ${name}`); } catch (error) { console.error(`FAIL: ${name}`); throw error; } }
console.log(`Contributor Resubmission Stage 35: ${passed}/${tests.length} PASS`);
