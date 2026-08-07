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

const { parseReviewDecision } = await import("../src/reviews/http.ts");
const { assertReviewDecisionAllowedForStoredAnalysis } = await import("../src/reviews/candidate-gate.ts");
const { applyReviewDecisionWithContext } = await import("../src/reviews/server.ts");
const { cultivationElementLabel, cultivationRealmLabel } = await import("../src/features/guardian-security/cultivation-labels.ts");

const CASE_ID = "case-00000000-0000-4000-8000-000000000001";
const REVIEWER = "0x1111111111111111111111111111111111111111";
const guardianSuggestion = {
  formalType: "access-control",
  primaryElement: "Earth",
  secondaryElements: ["Metal"],
  realm: "Qi Refining",
  severity: { label: "Critical", score: 11 },
  confidence: { label: "High", score: 95 },
};
const reviewerClassification = {
  formalType: "signature-replay",
  primaryElement: "Water",
  secondaryElements: ["Fire"],
  realm: "Core Formation",
  severity: { label: "High", score: 9 },
  confidence: { label: "Medium", score: 72 },
};
const candidateStored = {
  schemaVersion: "guardian-signed-contribution-v1",
  signedDraft: {
    signature: "audit-signature-is-opaque-here",
    claims: {
      draft: {
        selectedBestiaryName: "无门金兽",
        analysis: {
          schemaVersion: "guardian-security-candidate-analysis-v1",
          llmEnhancement: {
            publicSummary: "Guardian 候选摘要。",
            candidateFindings: [{
              category: guardianSuggestion.formalType,
              suggestedSeverity: guardianSuggestion.severity.label,
              suggestedConfidence: guardianSuggestion.confidence,
              explanation: "候选说明",
              attackPath: ["候选路径"],
              suggestedFix: ["候选修复"],
              limitations: ["候选局限"],
            }],
            candidateBestiarySuggestion: {
              candidateFindingIndex: 0,
              suggestedPrimaryElement: guardianSuggestion.primaryElement,
              suggestedSecondaryElements: guardianSuggestion.secondaryElements,
              suggestedCultivationRealm: guardianSuggestion.realm,
              lore: "候选异兽设定",
              behavior: ["候选行为"],
              attackTechnique: "候选招式",
              countermeasure: "候选破阵之法",
              cultivationLesson: "候选修炼启示",
            },
          },
        },
      },
    },
  },
};

function body(overrides = {}) {
  return {
    decision: "approved",
    evidenceQuality: 23,
    reproducibility: 22,
    technicalAccuracy: 18,
    remediationQuality: 17,
    contributionValue: 9,
    reviewSummary: "人工鉴定完成。",
    reviewNotes: "仅审核员可见。",
    classification: structuredClone(reviewerClassification),
    ...overrides,
  };
}

function expectCode(run, code) {
  assert.throws(run, (error) => error?.code === code);
}

function invalidClassification(mutate) {
  const value = body();
  mutate(value.classification);
  return value;
}

const tests = [];
function test(name, run) { tests.push({ name, run }); }

test("candidate approve without classification rejects", () => expectCode(() => assertReviewDecisionAllowedForStoredAnalysis(candidateStored, "approved"), "CANDIDATE_REQUIRES_VERIFICATION"));
test("incomplete classification rejects", () => { const value = body(); delete value.classification.realm; expectCode(() => parseReviewDecision(value), "INVALID_REQUEST"); });
test("invalid formal type rejects", () => expectCode(() => parseReviewDecision(invalidClassification((value) => { value.formalType = "made-up"; })), "INVALID_REQUEST"));
test("invalid primary element rejects", () => expectCode(() => parseReviewDecision(invalidClassification((value) => { value.primaryElement = "Air"; })), "INVALID_REQUEST"));
test("invalid secondary element rejects", () => expectCode(() => parseReviewDecision(invalidClassification((value) => { value.secondaryElements = ["Air"]; })), "INVALID_REQUEST"));
test("duplicate secondary element rejects", () => expectCode(() => parseReviewDecision(invalidClassification((value) => { value.secondaryElements = ["Fire", "Fire"]; })), "INVALID_REQUEST"));
test("primary repeated in secondary rejects", () => expectCode(() => parseReviewDecision(invalidClassification((value) => { value.secondaryElements = [value.primaryElement]; })), "INVALID_REQUEST"));
test("invalid severity rejects", () => expectCode(() => parseReviewDecision(invalidClassification((value) => { value.severity.label = "Extreme"; })), "INVALID_REQUEST"));
test("severity label and score must agree", () => expectCode(() => parseReviewDecision(invalidClassification((value) => { value.severity.score = 2; })), "INVALID_REQUEST"));
test("invalid confidence rejects", () => expectCode(() => parseReviewDecision(invalidClassification((value) => { value.confidence.label = "Certain"; })), "INVALID_REQUEST"));
test("confidence label and score must agree", () => expectCode(() => parseReviewDecision(invalidClassification((value) => { value.confidence.score = 95; })), "INVALID_REQUEST"));
test("invalid realm rejects", () => expectCode(() => parseReviewDecision(invalidClassification((value) => { value.realm = "Immortal"; })), "INVALID_REQUEST"));
test("unknown classification authority key rejects", () => expectCode(() => parseReviewDecision(invalidClassification((value) => { value.published = true; })), "INVALID_REQUEST"));
test("unknown top-level authority key rejects", () => expectCode(() => parseReviewDecision({ ...body(), approvedByLlm: true }), "INVALID_REQUEST"));
function nonApprovalBody(decision) { const value = body({ decision }); delete value.classification; return value; }
test("changes_requested without classification remains allowed", () => assert.equal(parseReviewDecision(nonApprovalBody("changes_requested")).classification, null));
test("rejected without classification remains allowed", () => assert.equal(parseReviewDecision(nonApprovalBody("rejected")).classification, null));
test("non-approval cannot carry authority fields", () => expectCode(() => parseReviewDecision(body({ decision: "rejected" })), "INVALID_REQUEST"));
test("candidate changes_requested gate remains allowed", () => assert.doesNotThrow(() => assertReviewDecisionAllowedForStoredAnalysis(candidateStored, "changes_requested")));
test("candidate rejected gate remains allowed", () => assert.doesNotThrow(() => assertReviewDecisionAllowedForStoredAnalysis(candidateStored, "rejected")));
test("deterministic approve remains backward compatible", () => assert.doesNotThrow(() => assertReviewDecisionAllowedForStoredAnalysis({ schemaVersion: "guardian-security-analysis-v1" }, "approved")));
test("valid formal classification parses exactly", () => assert.deepEqual(parseReviewDecision(body()).classification, reviewerClassification));
test("valid candidate human classification passes gate", () => assert.doesNotThrow(() => assertReviewDecisionAllowedForStoredAnalysis(candidateStored, "approved", reviewerClassification)));

let approvalCapture;
let approvalResult;
const signedBefore = structuredClone(candidateStored.signedDraft);
test("valid candidate approval completes", async () => {
  const calls = [];
  const sql = { async query(query, params) {
    calls.push({ query, params });
    if (calls.length === 1) return [{ analysis_json: candidateStored }];
    return [{ case_id: CASE_ID, status: "approved", review_id: "review-1", merit_amount: 89, bestiary_case_id: CASE_ID }];
  } };
  approvalResult = await applyReviewDecisionWithContext(CASE_ID, parseReviewDecision(body()), { reviewerAddress: REVIEWER, sql });
  approvalCapture = calls;
  assert.equal(approvalResult.status, "approved");
});
test("reviewer type is the authoritative SQL parameter", () => assert.equal(approvalCapture[1].params[12], reviewerClassification.formalType));
test("reviewer elements are authoritative SQL parameters", () => assert.deepEqual([approvalCapture[1].params[13], JSON.parse(approvalCapture[1].params[14])], ["Water", ["Fire"]]));
test("reviewer realm is the publication SQL parameter", () => assert.equal(approvalCapture[1].params[19], "Core Formation"));
test("reviewer severity and confidence are authoritative SQL parameters", () => assert.deepEqual(approvalCapture[1].params.slice(15, 19), ["High", 9, "Medium", 72]));
test("Guardian suggestions are not auto-promoted", () => assert.notDeepEqual(approvalCapture[1].params.slice(12, 20), [guardianSuggestion.formalType, guardianSuggestion.primaryElement, JSON.stringify(guardianSuggestion.secondaryElements), guardianSuggestion.severity.label, guardianSuggestion.severity.score, guardianSuggestion.confidence.label, guardianSuggestion.confidence.score, guardianSuggestion.realm]));
test("Signed Draft remains claim-equivalent after review", () => assert.deepEqual(candidateStored.signedDraft, signedBefore));
test("selected Bestiary name stays reservation-bound without fallback rename", () => { assert.match(approvalCapture[1].query, /ur\.display_name, ur\.normalized_name/u); assert.doesNotMatch(approvalCapture[1].query, /display_name\s*\|\||regenerate|rename/u); });
test("classification and publication remain in one atomic CTE", () => assert.match(approvalCapture[1].query, /WITH target[\s\S]+updated_case[\s\S]+inserted_review[\s\S]+inserted_bestiary/u));
test("candidate is not public before approval and publication is approval-gated", () => assert.match(approvalCapture[1].query, /inserted_bestiary[\s\S]+WHERE \$2 = 'approved'/u));
test("candidate becomes public after valid approval", () => assert.equal(approvalResult.bestiaryCreated, true));
test("public cultivation labels are Chinese while machine enums stay unchanged", () => assert.deepEqual([cultivationElementLabel("Water"), cultivationRealmLabel("Core Formation")], ["水", "金丹期"]));
test("stale signed-draft-disabled copy is removed", () => { const source = readFileSync(new URL("../src/features/guardian-llm/hybrid-analysis.ts", import.meta.url), "utf8"); assert.doesNotMatch(source, /Contribution submission is disabled until a signed draft/u); assert.match(source, /Guardian 签名草案已绑定本次分析内容/u); });
test("server SQL retains an atomic candidate classification guard", () => assert.match(approvalCapture[1].query, /guardian-security-candidate-analysis-v1[\s\S]+\$20::text IS NOT NULL/u));
test("confidence normalization, candidate enrichment, and no-second-Gemini guarantees remain", () => { const server = readFileSync(new URL("../src/reviews/server.ts", import.meta.url), "utf8"); assert.doesNotMatch(server, /gemini|runHybridGuardianAnalysis|guardian-llm\/provider/u); assert.match(server, /candidateBestiarySuggestion,lore/u); assert.equal(parseReviewDecision(body()).classification.confidence.label, "Medium"); });

assert.equal(tests.length, 37);
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
console.log(`Reviewer Human Classification Stage 34.5B: ${passed}/${tests.length} PASS`);
