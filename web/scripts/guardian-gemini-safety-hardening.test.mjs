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
      const source = readFileSync(filename, "utf8");
      const output = ts.transpileModule(source, {
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022,
        },
        fileName: filename,
      });
      return { format: "module", shortCircuit: true, source: output.outputText };
    }
    return nextLoad(url, context);
  },
});

const { analyzeGuardianSecurityCase } = await import(
  "../src/features/guardian-security/analyze.ts"
);
const { GuardianSecurityError } = await import(
  "../src/features/guardian-security/analysis-types.ts"
);
const { QUEST_ONE_BUILTIN_SOURCES } = await import(
  "../src/features/guardian-security/quest-one-evidence.ts"
);
const { runHybridGuardianAnalysis } = await import(
  "../src/features/guardian-llm/hybrid-analysis.ts"
);
const { runGuardianLlmEnhancement } = await import(
  "../src/features/guardian-llm/runner.ts"
);
const { parseGuardianLlmResponse } = await import(
  "../src/features/guardian-llm/response-parser.ts"
);
const { GuardianLlmProviderError } = await import(
  "../src/features/guardian-llm/provider.ts"
);
const { GeminiGuardianLlmProvider } = await import(
  "../src/features/guardian-llm/gemini-provider.ts"
);
const { filterGuardianLlmCandidates } = await import(
  "../src/features/guardian-llm/candidate-filter.ts"
);
const {
  scanGuardianLlmSources,
  scanGuardianSensitiveSource,
} = await import("../src/features/guardian-llm/sensitive-source.ts");
const { guardianSecuritySuccessToVerifiedFindings } = await import(
  "../src/features/guardian-llm/verified-finding-adapter.ts"
);
const { toPublicLlmEnhancement } = await import(
  "../src/features/guardian-llm/hybrid-analysis-types.ts"
);
const {
  GuardianDraftError,
  hashExactGuardianDraftSource,
  issueSignedGuardianDraftV1,
  verifySignedGuardianDraftV1,
} = await import("../src/lib/guardian-draft-signing.ts");

const NOW = new Date("2026-08-09T00:00:00.000Z");
const SECRET = Buffer.alloc(32, 0x53).toString("base64url");
const WALLET = "0x0A31d11Fd14029c12Ef07c2c200085aE622c1541";
const OTHER_WALLET = "0x1111111111111111111111111111111111111111";
const CASE_NAME = "Gemini 安全加固测试";
const SOURCES = {
  vulnerableSource: QUEST_ONE_BUILTIN_SOURCES.vulnerableSource,
  attackSource: QUEST_ONE_BUILTIN_SOURCES.attackSource,
  fixedSource: QUEST_ONE_BUILTIN_SOURCES.fixedSource,
};
const SAMPLE_REQUEST = {
  mode: "sample",
  sample: { name: CASE_NAME, ...SOURCES },
};
const NOT_APPLICABLE_MOSS = {
  status: "not-applicable",
  reason: "User-provided samples are not registered Guardian quests.",
};
const DETERMINISTIC = analyzeGuardianSecurityCase(
  SAMPLE_REQUEST,
  NOT_APPLICABLE_MOSS,
);

function rawCandidate(category = "access-control", title = "敏感操作缺少授权检查") {
  return {
    category,
    title,
    suggestedSeverity: "High",
    suggestedConfidence: { label: "Medium", score: 72 },
    explanation: "任意账户可能调用敏感函数并改变 owner 状态。",
    attackPath: ["攻击者调用 setOwner() 绕过预期授权。"],
    affectedCode: [
      {
        source: "vulnerableSource",
        location: "Vault.sol:setOwner():42",
        explanation: "setOwner() 前没有检查 msg.sender。",
      },
    ],
    evidence: [
      {
        source: "vulnerableSource",
        description: "函数直接写入 owner，未见 onlyOwner 等限制。",
        locations: ["Vault.sol:setOwner():42"],
      },
    ],
    suggestedFix: ["为 setOwner() 增加 onlyOwner 或等价授权检查。"],
    limitations: ["该候选尚未经过确定性验证，需人工复核。"],
  };
}

function rawResponse(candidates = [rawCandidate()]) {
  return {
    candidateFindings: candidates,
    ...(candidates.length > 0
      ? {
          candidateBestiarySuggestion: {
            candidateFindingIndex: 0,
            suggestedPrimaryElement: "Metal",
            suggestedSecondaryElements: ["Earth"],
            suggestedCultivationRealm: "Foundation Establishment",
            lore: "此兽借无主之印侵入守门法阵。",
            behavior: ["反复探测缺少授权检查的入口。"],
            attackTechnique: "调用 setOwner() 夺取控制权。",
            countermeasure: "使用 onlyOwner 或角色权限封印入口。",
            cultivationLesson: "每个敏感状态变更都应明确验证调用者身份。",
          },
        }
      : {}),
    publicSummary: "发现需要人类 Reviewer 复核的候选权限问题。",
    bestiaryNameCandidates: [
      "无界夺印兽",
      "洞门越权兽",
      "窃令潜行兽",
      "噬主换形兽",
    ],
  };
}

function providerInput(sources) {
  return {
    schemaVersion: "guardian-llm-request-v1",
    verifiedFindings: [],
    untrustedSources: sources,
  };
}

function fakeSecret(label = "PRIVATE_KEY") {
  return `// TEST-ONLY FAKE CREDENTIAL\n${label}=0x${"1".repeat(64)}`;
}

function expectInvalidResponse(value) {
  assert.throws(
    () => parseGuardianLlmResponse(value),
    (error) =>
      error instanceof GuardianLlmProviderError &&
      error.code === "INVALID_RESPONSE",
  );
}

function hybridAnalysis(response = parseGuardianLlmResponse(rawResponse())) {
  return {
    ...DETERMINISTIC,
    llmEnhancement: toPublicLlmEnhancement(response),
  };
}

function issue(analysis, overrides = {}) {
  return issueSignedGuardianDraftV1({
    analysis,
    selectedBestiaryName: analysis.bestiaryDraft.name,
    caseName: CASE_NAME,
    authenticatedWallet: WALLET,
    ...SOURCES,
    secret: SECRET,
    now: () => new Date(NOW),
    randomBytes: () => Buffer.alloc(16, 0x37),
    ...overrides,
  });
}

function expectDraftMalformed(analysis) {
  assert.throws(
    () => issue(analysis),
    (error) => error instanceof GuardianDraftError && error.code === "MALFORMED",
  );
}

const tests = [];
function test(name, run) {
  tests.push({ name, run });
}

test("ordinary Solidity bytes32 hash is not blocked", () => {
  const source = `bytes32 constant CONTENT_HASH = 0x${"a".repeat(64)};`;
  assert.deepEqual(scanGuardianSensitiveSource(source), { blocked: false });
});

test("transaction hash is not blocked", () => {
  assert.equal(scanGuardianSensitiveSource(`txHash: 0x${"b".repeat(64)}`).blocked, false);
});

test("contract address is not blocked", () => {
  assert.equal(scanGuardianSensitiveSource("address target = 0x131debd042208a327841128e5800dd4a833032ab;").blocked, false);
});

test("explicit PRIVATE_KEY assignment is blocked", () => {
  assert.deepEqual(scanGuardianSensitiveSource(fakeSecret()), {
    blocked: true,
    reason: "SENSITIVE_SOURCE",
  });
});

test("private-key-shaped value requires explicit context", () => {
  const bareValue = `bytes32 proof = 0x${"1".repeat(64)};`;
  assert.equal(scanGuardianSensitiveSource(bareValue).blocked, false);
  assert.equal(scanGuardianSensitiveSource(fakeSecret("PRIVATE KEY")).blocked, true);
});

test("mnemonic with explicit context is blocked", () => {
  const source = '// TEST-ONLY FAKE WORDS\nMNEMONIC="alpha beta gamma delta epsilon zeta eta theta"';
  assert.equal(scanGuardianSensitiveSource(source).blocked, true);
});

test("obvious API and token credential contexts are blocked", () => {
  assert.equal(scanGuardianSensitiveSource('API_KEY="fake_test_only_value_123"').blocked, true);
  assert.equal(scanGuardianSensitiveSource('ACCESS_TOKEN="fake_test_only_value_456"').blocked, true);
});

for (const field of ["vulnerableSource", "attackSource", "fixedSource"]) {
  test(`flagged ${field} prevents provider invocation`, async () => {
    let calls = 0;
    const sources = { vulnerableSource: "contract Safe {}", [field]: fakeSecret() };
    const result = await runGuardianLlmEnhancement({
      mode: "hybrid",
      input: providerInput(sources),
      provider: {
        providerName: "must-not-run",
        async enhance() {
          calls += 1;
          return parseGuardianLlmResponse(rawResponse());
        },
      },
    });
    assert.equal(calls, 0);
    assert.equal(result.status, "fallback");
    assert.equal(result.errorCode, "SENSITIVE_SOURCE");
  });
}

test("Gemini provider blocks sensitive source before fetch", async () => {
  let fetchCalls = 0;
  const provider = new GeminiGuardianLlmProvider(
    { apiKey: "fake-test-key-do-not-use", model: "gemini-test" },
    async () => {
      fetchCalls += 1;
      throw new Error("must not fetch");
    },
  );
  await assert.rejects(
    () => provider.enhance(providerInput({ vulnerableSource: fakeSecret() })),
    (error) => error instanceof GuardianLlmProviderError && error.code === "SENSITIVE_SOURCE",
  );
  assert.equal(fetchCalls, 0);
});

test("supported deterministic analysis remains exact when source is blocked", async () => {
  let calls = 0;
  const request = {
    ...SAMPLE_REQUEST,
    sample: { ...SAMPLE_REQUEST.sample, attackSource: fakeSecret("AUTH_TOKEN") },
  };
  const outcome = await runHybridGuardianAnalysis({
    request,
    mode: "hybrid",
    provider: {
      providerName: "must-not-run",
      async enhance() {
        calls += 1;
        return parseGuardianLlmResponse(rawResponse());
      },
    },
    runDeterministic: async () => DETERMINISTIC,
  });
  assert.equal(calls, 0);
  assert.strictEqual(outcome.response, DETERMINISTIC);
});

test("unsupported analysis keeps sanitized unsupported behavior when source is blocked", async () => {
  let calls = 0;
  await assert.rejects(
    () => runHybridGuardianAnalysis({
      request: {
        mode: "sample",
        sample: { name: "不支持的敏感样例", vulnerableSource: fakeSecret("PASSWORD") },
      },
      mode: "hybrid",
      provider: {
        providerName: "must-not-run",
        async enhance() {
          calls += 1;
          return parseGuardianLlmResponse(rawResponse());
        },
      },
      runDeterministic: async () => {
        throw new GuardianSecurityError("UNSUPPORTED_VULNERABILITY");
      },
    }),
    (error) =>
      error instanceof GuardianSecurityError &&
      error.code === "UNSUPPORTED_VULNERABILITY",
  );
  assert.equal(calls, 0);
});

test("source scan does not mutate sources, hashes, or deterministic analysis", () => {
  const sources = { ...SOURCES };
  const beforeHashes = Object.values(sources).map(hashExactGuardianDraftSource);
  const beforeAnalysis = JSON.stringify(DETERMINISTIC);
  assert.equal(scanGuardianLlmSources(sources).blocked, false);
  assert.deepEqual(Object.values(sources).map(hashExactGuardianDraftSource), beforeHashes);
  assert.equal(JSON.stringify(DETERMINISTIC), beforeAnalysis);
});

test("fully Chinese candidate and embedded technical literals pass", () => {
  const parsed = parseGuardianLlmResponse(rawResponse());
  assert.equal(parsed.candidateFindings[0].affectedCode[0].location, "Vault.sol:setOwner():42");
  assert.match(parsed.candidateFindings[0].explanation, /owner/u);
  assert.match(parsed.candidateFindings[0].suggestedFix[0], /onlyOwner/u);
});

const languageMutations = [
  ["English-only title", (value) => value.candidateFindings[0].title = "Missing authorization"],
  ["English-only explanation", (value) => value.candidateFindings[0].explanation = "Authorization is missing."],
  ["English-only attack path", (value) => value.candidateFindings[0].attackPath[0] = "Call setOwner()."],
  ["English-only affected-code explanation", (value) => value.candidateFindings[0].affectedCode[0].explanation = "No guard."],
  ["English-only evidence description", (value) => value.candidateFindings[0].evidence[0].description = "No guard."],
  ["English-only suggested fix", (value) => value.candidateFindings[0].suggestedFix[0] = "Add onlyOwner."],
  ["English-only limitation", (value) => value.candidateFindings[0].limitations[0] = "Needs review."],
  ["English-only public summary", (value) => value.publicSummary = "Needs human review."],
  ["English-only Bestiary name", (value) => value.bestiaryNameCandidates[0] = "Open Gate Beast"],
];

for (const [name, mutate] of languageMutations) {
  test(`${name} is rejected`, () => {
    const value = rawResponse();
    mutate(value);
    expectInvalidResponse(value);
  });
}

test("technical literals remain valid inside Chinese prose", () => {
  const value = rawResponse();
  value.candidateFindings[0].title = "Classic Reentrancy 候选问题";
  value.candidateFindings[0].explanation = "receive() 可回调 withdraw() 并再次进入。";
  value.candidateFindings[0].suggestedFix = ["采用 nonReentrant 与 Checks-Effects-Interactions。"];
  assert.equal(parseGuardianLlmResponse(value).candidateFindings.length, 1);
});

test("invalid candidate language produces exact deterministic fallback", async () => {
  const english = rawResponse();
  english.candidateFindings[0].title = "Missing authorization";
  const outcome = await runHybridGuardianAnalysis({
    request: SAMPLE_REQUEST,
    mode: "hybrid",
    provider: {
      providerName: "invalid-language-provider",
      async enhance() {
        return parseGuardianLlmResponse(english);
      },
    },
    runDeterministic: async () => DETERMINISTIC,
  });
  assert.strictEqual(outcome.response, DETERMINISTIC);
});

test("valid candidate Signed Draft verifies with exact hashes", () => {
  const exactSourcesBefore = structuredClone(SOURCES);
  const signed = issue(hybridAnalysis());
  const verified = verifySignedGuardianDraftV1({
    value: signed,
    authenticatedWallet: WALLET,
    caseName: CASE_NAME,
    ...SOURCES,
    secret: SECRET,
    now: () => new Date(NOW.getTime() + 1_000),
  });
  assert.deepEqual(verified.claims.sourceHashes, signed.claims.sourceHashes);
  assert.equal(verified.signature, signed.signature);
  assert.deepEqual(SOURCES, exactSourcesBefore);
});

test("Signed Draft issuance rejects invalid candidate language", () => {
  const analysis = structuredClone(hybridAnalysis());
  analysis.llmEnhancement.candidateFindings[0].title = "Missing authorization";
  expectDraftMalformed(analysis);
});

test("Signed Draft issuance rejects invalid candidate enum", () => {
  const analysis = structuredClone(hybridAnalysis());
  analysis.llmEnhancement.candidateFindings[0].suggestedSeverity = "Extreme";
  expectDraftMalformed(analysis);
});

test("Signed Draft issuance rejects oversized candidate list", () => {
  const analysis = structuredClone(hybridAnalysis());
  analysis.llmEnhancement.candidateFindings[0].attackPath = Array(17).fill("调用候选入口。");
  expectDraftMalformed(analysis);
});

test("Signed Draft issuance rejects oversized candidate field", () => {
  const analysis = structuredClone(hybridAnalysis());
  analysis.llmEnhancement.candidateFindings[0].title = "兽".repeat(121);
  expectDraftMalformed(analysis);
});

test("Signed Draft validation rejects prototype-bearing candidate object", () => {
  const analysis = structuredClone(hybridAnalysis());
  analysis.llmEnhancement.candidateFindings[0] = Object.assign(
    Object.create({ inherited: true }),
    analysis.llmEnhancement.candidateFindings[0],
  );
  expectDraftMalformed(analysis);
});

test("Signed Draft expiry behavior remains enforced", () => {
  const signed = issue(hybridAnalysis());
  assert.throws(
    () => verifySignedGuardianDraftV1({
      value: signed,
      authenticatedWallet: WALLET,
      caseName: CASE_NAME,
      ...SOURCES,
      secret: SECRET,
      now: () => new Date(NOW.getTime() + 15 * 60 * 1_000 + 1),
    }),
    (error) => error instanceof GuardianDraftError && error.code === "EXPIRED",
  );
});

test("Signed Draft wallet binding remains enforced", () => {
  const signed = issue(hybridAnalysis());
  assert.throws(
    () => verifySignedGuardianDraftV1({
      value: signed,
      authenticatedWallet: OTHER_WALLET,
      caseName: CASE_NAME,
      ...SOURCES,
      secret: SECRET,
      now: () => new Date(NOW.getTime() + 1_000),
    }),
    (error) => error instanceof GuardianDraftError && error.code === "WALLET_MISMATCH",
  );
});

test("exact duplicate candidates collapse safely", () => {
  const parsed = parseGuardianLlmResponse(rawResponse([rawCandidate(), rawCandidate()]));
  const filtered = filterGuardianLlmCandidates(parsed, []);
  assert.equal(filtered.candidateFindings.length, 1);
  assert.equal(filtered.candidateFindings[0].candidateId, "llm-candidate-1");
});

test("candidate restating verified deterministic category is removed", () => {
  const parsed = parseGuardianLlmResponse(rawResponse([
    rawCandidate("reentrancy", "重入漏洞重复候选"),
  ]));
  const verified = guardianSecuritySuccessToVerifiedFindings(DETERMINISTIC);
  assert.equal(filterGuardianLlmCandidates(parsed, verified).candidateFindings.length, 0);
});

test("distinct candidate remains llm_candidate", () => {
  const parsed = parseGuardianLlmResponse(rawResponse());
  const verified = guardianSecuritySuccessToVerifiedFindings(DETERMINISTIC);
  const [candidate] = filterGuardianLlmCandidates(parsed, verified).candidateFindings;
  assert.equal(candidate.category, "access-control");
  assert.equal(candidate.verification, "llm_candidate");
  assert.ok(candidate.evidence.every((entry) => entry.provenance === "llm_candidate"));
});

test("filtering preserves authoritative deterministic fields", async () => {
  const parsed = parseGuardianLlmResponse(rawResponse([
    rawCandidate("reentrancy", "重入漏洞重复候选"),
    rawCandidate("access-control", "敏感操作缺少授权检查"),
  ]));
  const outcome = await runHybridGuardianAnalysis({
    request: SAMPLE_REQUEST,
    mode: "hybrid",
    provider: { providerName: "filter-test", async enhance() { return parsed; } },
    runDeterministic: async () => DETERMINISTIC,
  });
  const authoritative = structuredClone(outcome.response);
  delete authoritative.llmEnhancement;
  assert.deepEqual(authoritative, DETERMINISTIC);
  assert.equal(outcome.response.llmEnhancement.candidateFindings.length, 1);
});

test("zero remaining candidates returns exact deterministic success", async () => {
  const parsed = parseGuardianLlmResponse(rawResponse([
    rawCandidate("reentrancy", "重入漏洞重复候选"),
  ]));
  const outcome = await runHybridGuardianAnalysis({
    request: SAMPLE_REQUEST,
    mode: "hybrid",
    provider: { providerName: "restatement-test", async enhance() { return parsed; } },
    runDeterministic: async () => DETERMINISTIC,
  });
  assert.strictEqual(outcome.response, DETERMINISTIC);
});

test("Guardian sample UI discloses optional external source processing", () => {
  const workbench = readFileSync(
    new URL("../src/features/guardian-security-ui/guardian-security-workbench.tsx", import.meta.url),
    "utf8",
  );
  assert.match(workbench, /外部模型增强为可选能力/u);
  assert.match(workbench, /Solidity\s*源码可能发送给外部模型提供商/u);
  assert.match(workbench, /请勿在源码中提交私钥、助记词/u);
  assert.match(workbench, /确定性 Guardian 无需外部模型也可独立工作/u);
});

let passed = 0;
for (const [index, entry] of tests.entries()) {
  try {
    await entry.run();
    passed += 1;
    console.log(`PASS ${index + 1}: ${entry.name}`);
  } catch (error) {
    console.error(`FAIL ${index + 1}: ${entry.name}`);
    throw error;
  }
}

console.log(`Guardian Gemini Safety Hardening: ${passed}/${tests.length} PASS`);
