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
        compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
        fileName: filename,
      });
      return { format: "module", shortCircuit: true, source: output.outputText };
    }
    return nextLoad(url, context);
  },
});

const {
  ContributorApiError,
  createSignedContribution,
} = await import("../src/features/contributor-ui/contributor-api-client.ts");
const { contributionSubmissionErrorMessage } = await import(
  "../src/features/contributor-ui/contribution-submission-copy.ts"
);

const workbenchSource = readFileSync(
  new URL("../src/features/guardian-security-ui/guardian-security-workbench.tsx", import.meta.url),
  "utf8",
);
const confirmStart = workbenchSource.indexOf("  async function confirmContribution()");
const confirmEnd = workbenchSource.indexOf("\n\n  return (", confirmStart);
const confirmSource = workbenchSource.slice(confirmStart, confirmEnd);

const EXPECTED_COPY = {
  CASE_ALREADY_EXISTS: "相同源码的安全案例已经提交，请修改案例内容后重新鉴定。",
  BESTIARY_NAME_UNAVAILABLE: "此异兽名已被其他修士占用，请重新运行 Guardian 获取新的异兽名后再提交。",
  SIGNED_DRAFT_EXPIRED: "Guardian 签名草案已过期，请重新运行 Guardian 后再提交。",
  SIGNED_DRAFT_SOURCE_MISMATCH: "源码已发生变化，请重新运行 Guardian 后再提交。",
  SIGNED_DRAFT_CASE_NAME_MISMATCH: "案例名称已发生变化，请重新运行 Guardian 后再提交。",
  DATABASE_UNAVAILABLE: "献策服务暂时不可用，请稍后重试。",
};
const FALLBACK = "异兽献策提交失败，请检查网络后重试。";
const SUBMISSION = {
  caseName: "Stage 35 UX",
  vulnerableSource: "contract Example {}",
  attackSource: "",
  fixedSource: "",
};

async function capturePostError(code, internalMessage) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    ok: false,
    error: { code, message: internalMessage },
  }), {
    status: code === "DATABASE_UNAVAILABLE" ? 503 : 409,
    headers: { "Content-Type": "application/json" },
  });
  try {
    await createSignedContribution(SUBMISSION, { signature: "must-not-render" });
    assert.fail("contribution POST should reject");
  } catch (error) {
    assert.ok(error instanceof ContributorApiError);
    return error;
  } finally {
    globalThis.fetch = originalFetch;
  }
}

const tests = [];
function test(name, run) { tests.push({ name, run }); }

test("failed contribution POST produces the safe visible fallback state", async () => {
  const error = await capturePostError("UNEXPECTED_BACKEND_FAILURE", "postgres password=secret-value");
  assert.equal(contributionSubmissionErrorMessage(error), FALLBACK);
  assert.match(confirmSource, /catch \(error\)[\s\S]+setContributionFeedback\(\{ kind: "error", message \}\)/u);
  assert.match(workbenchSource, /<ContributionFeedbackMessage feedback=\{contributionFeedback\} \/>/u);
});

test("CASE_ALREADY_EXISTS POST gets actionable copy", async () => {
  const error = await capturePostError("CASE_ALREADY_EXISTS", "duplicate key value violates unique constraint");
  assert.equal(contributionSubmissionErrorMessage(error), EXPECTED_COPY.CASE_ALREADY_EXISTS);
});

test("BESTIARY_NAME_UNAVAILABLE POST gets actionable copy", async () => {
  const error = await capturePostError("BESTIARY_NAME_UNAVAILABLE", "reservation collision: signed-secret");
  assert.equal(contributionSubmissionErrorMessage(error), EXPECTED_COPY.BESTIARY_NAME_UNAVAILABLE);
});

for (const [code, expected] of Object.entries(EXPECTED_COPY)) {
  test(`${code} has stable Simplified Chinese submission copy`, () => {
    assert.equal(contributionSubmissionErrorMessage(new ContributorApiError(code, "raw internal detail", 409)), expected);
  });
}

test("network and unexpected failures use one safe fallback", () => {
  assert.equal(contributionSubmissionErrorMessage(new ContributorApiError("NETWORK_UNAVAILABLE", "fetch failed", 0)), FALLBACK);
  assert.equal(contributionSubmissionErrorMessage(new Error("socket and credential details")), FALLBACK);
});

test("successful POST renders persistent success feedback near both actions", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    ok: true,
    case: {
      caseId: "case-stage35-ux",
      caseName: SUBMISSION.caseName,
      proposedBestiaryName: "照影鉴契兽",
      formalType: null,
      primaryElement: null,
      secondaryElements: [],
      severity: { label: null, score: null },
      confidence: { label: null, score: null },
      status: "pending_review",
      createdAt: "2026-08-08T00:00:00.000Z",
    },
  }), { status: 201, headers: { "Content-Type": "application/json" } });
  try {
    const summary = await createSignedContribution(SUBMISSION, { signature: "must-not-render" });
    assert.equal(summary.status, "pending_review");
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.match(workbenchSource, /kind: "success",\s+message: "异兽献策已提交，正在等待守阁人审核。"/u);
  assert.equal(workbenchSource.match(/<ContributionFeedbackMessage feedback=\{contributionFeedback\} \/>/gu)?.length, 2);
});

test("submitting state is visible and disables both submit actions", () => {
  assert.match(workbenchSource, /setContributionFeedback\(\{ kind: "submitting", message: "正在提交异兽献策…" \}\)/u);
  assert.equal(workbenchSource.match(/disabled=\{isBusy \|\| Boolean\(createdCase\)/gu)?.length, 2);
});

test("synchronous in-flight guard prevents concurrent double submission", () => {
  const guardIndex = confirmSource.indexOf("submissionInFlight.current\n    ) return");
  const lockIndex = confirmSource.indexOf("submissionInFlight.current = true");
  const requestIndex = confirmSource.indexOf("await createSignedContribution", lockIndex);
  const unlockIndex = confirmSource.indexOf("submissionInFlight.current = false", requestIndex);
  assert.ok(guardIndex >= 0 && lockIndex > guardIndex && requestIndex > lockIndex && unlockIndex > requestIndex);
  assert.match(confirmSource, /finally \{\s+submissionInFlight\.current = false;/u);
});

test("submission feedback is announced to assistive technology", () => {
  assert.match(workbenchSource, /role=\{feedback\.kind === "error" \? "alert" : "status"\}/u);
  assert.match(workbenchSource, /aria-live=\{feedback\.kind === "error" \? "assertive" : "polite"\}/u);
  assert.match(workbenchSource, /aria-atomic="true"/u);
});

test("backend details and signed credentials are never surfaced", async () => {
  const sensitive = "signature=wallet-secret; postgres password=db-secret";
  const error = await capturePostError("REQUEST_FAILED", sensitive);
  const visible = contributionSubmissionErrorMessage(error);
  assert.doesNotMatch(visible, /wallet-secret|db-secret|signature|postgres/u);
  assert.doesNotMatch(workbenchSource, /console\.(?:log|error)\(/u);
});

test("failure branch preserves form, Guardian result, and Signed Draft", () => {
  const failureBranch = confirmSource.match(/catch \(error\) \{([\s\S]+?)\n    \} finally/u)?.[1] ?? "";
  assert.doesNotMatch(failureBranch, /setForm|setResult|setSignedDraft|setAnalysisDigest/u);
});

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
console.log(`Guardian Contribution Submission UX Stage 35: ${passed}/${tests.length} PASS`);
