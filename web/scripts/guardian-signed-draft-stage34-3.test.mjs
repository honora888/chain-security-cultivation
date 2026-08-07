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
        url: new URL(path.endsWith(".ts") ? path : `${path}.ts`, sourceRoot)
          .href,
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
const { GuardianSecurityError } = await import(
  "../src/features/guardian-security/analysis-types.ts"
);
const { QUEST_ONE_BUILTIN_SOURCES } = await import(
  "../src/features/guardian-security/quest-one-evidence.ts"
);
const { runHybridGuardianAnalysis } = await import(
  "../src/features/guardian-llm/hybrid-analysis.ts"
);
const {
  issueGuardianDraftForAuthenticatedSample,
  selectedBestiaryNameForGuardianDraft,
} = await import("../src/features/guardian-draft/issuance.ts");
const {
  guardianDraftAnalysisMatchesVisible,
  guardianDraftInputChanged,
} = await import("../src/features/guardian-draft/client.ts");
const {
  analyzeGuardianSample,
  GuardianSecurityApiError,
  parseGuardianHybridPublicResponse,
} = await import(
  "../src/features/guardian-security-ui/guardian-security-api-client.ts"
);
const { normalizeCaseName } = await import(
  "../src/contributions/normalize.ts"
);
const { parseGuardianSecurityRequest } = await import(
  "../src/lib/guardian-security-server.ts"
);
const { guardianAnalysisDigest } = await import(
  "../src/lib/guardian-analysis-digest.ts"
);
const { GuardianDraftError, hashExactGuardianDraftSource } = await import(
  "../src/lib/guardian-draft-signing.ts"
);

const NOW = new Date("2026-08-08T00:00:00.000Z");
const SECRET = Buffer.alloc(32, 0x42).toString("base64url");
const SESSION_WALLET = "0x0A31d11Fd14029c12Ef07c2c200085aE622c1541";
const CANONICAL_NAME = "Guardian Sample Case";
const SOURCES = {
  vulnerableSource: QUEST_ONE_BUILTIN_SOURCES.vulnerableSource,
  attackSource: QUEST_ONE_BUILTIN_SOURCES.attackSource,
  fixedSource: QUEST_ONE_BUILTIN_SOURCES.fixedSource,
};
const SAMPLE_REQUEST = {
  mode: "sample",
  sample: { name: CANONICAL_NAME, ...SOURCES },
};
const NOT_APPLICABLE_MOSS = {
  status: "not-applicable",
  reason: "User-provided samples are not registered Guardian quests.",
};
const DETERMINISTIC = analyzeGuardianSecurityCase(
  SAMPLE_REQUEST,
  NOT_APPLICABLE_MOSS,
);

function llmResponse() {
  return {
    candidateFindings: [
      {
        candidateId: "llm-candidate-1",
        category: "access-control",
        title: "Authorization candidate",
        verification: "llm_candidate",
        suggestedSeverity: "High",
        suggestedConfidence: { label: "Medium", score: 74 },
        explanation: "A state transition may lack authorization.",
        attackPath: ["Call the state transition without authorization."],
        affectedCode: [
          {
            source: "vulnerableSource",
            location: "Vault.sol:setOwner",
            explanation: "No authorization condition is visible.",
          },
        ],
        evidence: [
          {
            source: "vulnerableSource",
            description: "The function changes owner state.",
            locations: ["Vault.sol:setOwner"],
            provenance: "llm_candidate",
          },
        ],
        suggestedFix: ["Require an authorized caller."],
        limitations: ["Not deterministically verified."],
      },
    ],
    publicSummary: "One candidate requires human security review.",
    bestiaryNameCandidates: [
      "Unbound Warden",
      "Open Gate Beast",
      "Seal Thief",
      "Owner Eater",
    ],
    candidateBestiarySuggestion: {
      candidateFindingIndex: 0,
      suggestedPrimaryElement: "Metal",
      suggestedSecondaryElements: ["Fire"],
      suggestedCultivationRealm: "Core Formation",
      lore: "\u517d",
      behavior: ["\u517d"],
      attackTechnique: "\u517d",
      countermeasure: "\u517d",
      cultivationLesson: "\u517d",
    },
  };
}

function provider(counter = { calls: 0 }) {
  return {
    providerName: "fake-stage34-3",
    async enhance() {
      counter.calls += 1;
      return llmResponse();
    },
  };
}

async function hybridAnalysis() {
  const outcome = await runHybridGuardianAnalysis({
    request: SAMPLE_REQUEST,
    mode: "hybrid",
    provider: provider(),
    runDeterministic: async () => DETERMINISTIC,
    now: () => new Date(NOW),
  });
  return outcome.response;
}

async function candidateAnalysis(counter = { calls: 0 }) {
  const request = {
    mode: "sample",
    sample: {
      name: CANONICAL_NAME,
      vulnerableSource: "contract Vault { function setOwner(address next) external { owner = next; } address owner; }",
    },
  };
  const outcome = await runHybridGuardianAnalysis({
    request,
    mode: "hybrid",
    provider: provider(counter),
    runDeterministic: async () => {
      throw new GuardianSecurityError("UNSUPPORTED_VULNERABILITY");
    },
    now: () => new Date(NOW),
  });
  assert.equal(outcome.kind, "candidate-only");
  return { response: outcome.response, request };
}

function issue(analysis, overrides = {}) {
  return issueGuardianDraftForAuthenticatedSample({
    analysis,
    authenticatedWallet: SESSION_WALLET,
    caseName: analysis.case.displayName,
    ...SOURCES,
    secret: SECRET,
    now: () => new Date(NOW),
    randomBytes: () => Buffer.alloc(16, 0x31),
    ...overrides,
  });
}

function expectDraftCode(callback, code) {
  assert.throws(callback, (error) => {
    assert.ok(error instanceof GuardianDraftError);
    assert.equal(error.code, code);
    return true;
  });
}

function expectApiCode(callback, code = "INVALID_RESPONSE") {
  assert.throws(callback, (error) => {
    assert.ok(error instanceof GuardianSecurityApiError);
    assert.equal(error.code, code);
    return true;
  });
}

async function withFakeFetch(responseFactory, callback) {
  const originalFetch = globalThis.fetch;
  let request;
  globalThis.fetch = async (input, init) => {
    request = { input, init };
    return responseFactory();
  };
  try {
    return await callback(() => request);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function apiResponse(analysis, signedDraft, digest) {
  return new Response(
    JSON.stringify(signedDraft ? { ...analysis, signedDraft } : analysis),
    {
      status: 200,
      headers: digest ? { "X-Guardian-Analysis-Digest": digest } : {},
    },
  );
}

const tests = [];
function test(name, run) {
  tests.push({ name, run });
}

test("anonymous sample issuance stays unsigned without a secret", () => {
  assert.equal(
    issueGuardianDraftForAuthenticatedSample({
      analysis: DETERMINISTIC,
      authenticatedWallet: null,
      caseName: CANONICAL_NAME,
      ...SOURCES,
      secret: undefined,
    }),
    null,
  );
});

test("authenticated deterministic sample receives a signed draft", () => {
  assert.ok(issue(DETERMINISTIC)?.signature);
});

test("authenticated hybrid sample receives a signed draft", async () => {
  assert.ok(issue(await hybridAnalysis())?.signature);
});

test("authenticated candidate-only sample receives a signed draft", async () => {
  const candidate = await candidateAnalysis();
  assert.ok(
    issue(candidate.response, {
      vulnerableSource: candidate.request.sample.vulnerableSource,
      attackSource: undefined,
      fixedSource: undefined,
    })?.signature,
  );
});

test("candidate-only client result carries no legacy digest", async () => {
  const candidate = await candidateAnalysis();
  const signed = issue(candidate.response, {
    vulnerableSource: candidate.request.sample.vulnerableSource,
    attackSource: undefined,
    fixedSource: undefined,
  });
  await withFakeFetch(
    () => apiResponse(candidate.response, signed, null),
    async () => {
      const result = await analyzeGuardianSample({
        name: CANONICAL_NAME,
        vulnerableSource: candidate.request.sample.vulnerableSource,
        attackSource: "",
        fixedSource: "",
      });
      assert.equal(result.digest, null);
    },
  );
});

test("deterministic legacy digest remains unchanged", () => {
  const before = guardianAnalysisDigest(DETERMINISTIC);
  issue(DETERMINISTIC);
  assert.equal(guardianAnalysisDigest(DETERMINISTIC), before);
});

test("signed wallet is the trusted session wallet in lowercase form", () => {
  assert.equal(issue(DETERMINISTIC).claims.walletAddress, SESSION_WALLET.toLowerCase());
});

test("client-provided wallet injection is rejected by strict request parsing", () => {
  assert.throws(
    () => parseGuardianSecurityRequest({
      ...SAMPLE_REQUEST,
      walletAddress: SESSION_WALLET,
    }),
    (error) => error instanceof GuardianSecurityError && error.code === "INVALID_BODY",
  );
});

for (const [label, field] of [
  ["vulnerable", "vulnerableSource"],
  ["attack", "attackSource"],
  ["fixed", "fixedSource"],
]) {
  test(`exact ${label} source reaches signed hashing unchanged`, () => {
    const signed = issue(DETERMINISTIC);
    assert.equal(
      signed.claims.sourceHashes[field],
      hashExactGuardianDraftSource(SOURCES[field]),
    );
  });
}

test("contribution canonical case name equals visible display name", () => {
  const canonical = normalizeCaseName("  Guardian　 Sample   Case  ");
  const result = analyzeGuardianSecurityCase(
    { ...SAMPLE_REQUEST, sample: { ...SAMPLE_REQUEST.sample, name: canonical } },
    NOT_APPLICABLE_MOSS,
  );
  assert.equal(canonical, CANONICAL_NAME);
  assert.equal(result.case.displayName, canonical);
  assert.equal(issue(result).claims.caseName, result.case.displayName);
});

test("deterministic selected name remains bestiaryDraft.name", () => {
  assert.equal(
    selectedBestiaryNameForGuardianDraft(DETERMINISTIC),
    DETERMINISTIC.bestiaryDraft.name,
  );
});

test("candidate selected name is the first server-parsed candidate", async () => {
  const { response } = await candidateAnalysis();
  assert.equal(
    selectedBestiaryNameForGuardianDraft(response),
    response.llmEnhancement.bestiaryNameCandidates[0],
  );
});

test("signed draft analysis is deeply equal to displayed base analysis", async () => {
  const analysis = await hybridAnalysis();
  const signed = issue(analysis);
  assert.equal(
    guardianDraftAnalysisMatchesVisible(analysis, signed.claims.draft.analysis),
    true,
  );
});

for (const field of [
  "name",
  "vulnerableSource",
  "attackSource",
  "fixedSource",
]) {
  test(`changing ${field} invalidates client signed-draft state`, () => {
    const before = { name: CANONICAL_NAME, ...SOURCES };
    assert.equal(
      guardianDraftInputChanged(before, { ...before, [field]: `${before[field]} ` }),
      true,
    );
  });
}

test("unchanged signed inputs retain client signed-draft state", () => {
  const input = { name: CANONICAL_NAME, ...SOURCES };
  assert.equal(guardianDraftInputChanged(input, { ...input }), false);
});

test("client accepts a valid candidate-only signed response", async () => {
  const candidate = await candidateAnalysis();
  const signed = issue(candidate.response, {
    vulnerableSource: candidate.request.sample.vulnerableSource,
    attackSource: undefined,
    fixedSource: undefined,
  });
  await withFakeFetch(
    () => apiResponse(candidate.response, signed, null),
    async () => {
      const result = await analyzeGuardianSample({
        name: CANONICAL_NAME,
        vulnerableSource: candidate.request.sample.vulnerableSource,
        attackSource: "",
        fixedSource: "",
      });
      assert.equal(result.result.schemaVersion, "guardian-security-candidate-analysis-v1");
      assert.deepEqual(result.result, signed.claims.draft.analysis);
    },
  );
});

test("client rejects malformed candidate-only response", async () => {
  const candidate = await candidateAnalysis();
  const malformed = structuredClone(candidate.response);
  malformed.llmEnhancement.candidateFindings[0].verification = "verified";
  await withFakeFetch(
    () => apiResponse(malformed, null, null),
    async () => assert.rejects(() => analyzeGuardianSample({
      name: CANONICAL_NAME,
      vulnerableSource: candidate.request.sample.vulnerableSource,
      attackSource: "",
      fixedSource: "",
    }), (error) => error instanceof GuardianSecurityApiError && error.code === "INVALID_RESPONSE"),
  );
});

test("client rejects malformed signed-draft envelope", async () => {
  const signed = structuredClone(issue(DETERMINISTIC));
  signed.signature = "malformed";
  await withFakeFetch(
    () => apiResponse(DETERMINISTIC, signed, guardianAnalysisDigest(DETERMINISTIC)),
    async () => assert.rejects(() => analyzeGuardianSample({
      name: CANONICAL_NAME,
      ...SOURCES,
    }), (error) => error instanceof GuardianSecurityApiError && error.code === "INVALID_RESPONSE"),
  );
});

test("client rejects visible and signed analysis mismatch", async () => {
  const candidate = await candidateAnalysis();
  const signed = issue(candidate.response, {
    vulnerableSource: candidate.request.sample.vulnerableSource,
    attackSource: undefined,
    fixedSource: undefined,
  });
  const visible = structuredClone(candidate.response);
  visible.llmEnhancement.publicSummary = "Different but structurally valid summary.";
  await withFakeFetch(
    () => apiResponse(visible, signed, null),
    async () => assert.rejects(() => analyzeGuardianSample({
      name: CANONICAL_NAME,
      vulnerableSource: candidate.request.sample.vulnerableSource,
      attackSource: "",
      fixedSource: "",
    }), (error) => error instanceof GuardianSecurityApiError && error.code === "INVALID_RESPONSE"),
  );
});

test("client preserves optional source whitespace in request carriage", async () => {
  await withFakeFetch(
    () => apiResponse(DETERMINISTIC, null, guardianAnalysisDigest(DETERMINISTIC)),
    async (getRequest) => {
      await analyzeGuardianSample({
        name: CANONICAL_NAME,
        vulnerableSource: SOURCES.vulnerableSource,
        attackSource: "  ",
        fixedSource: SOURCES.fixedSource,
      });
      const body = JSON.parse(getRequest().init.body);
      assert.equal(body.sample.attackSource, "  ");
    },
  );
});

test("candidate UI labels findings as non-verified", () => {
  const source = readFileSync(
    new URL("../src/features/guardian-security-ui/guardian-candidate-results.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /LLM Candidate · 未验证/u);
  assert.match(source, /未经确定性验证/u);
  assert.match(source, /Human Review Required/u);
});

test("candidate UI presents severity and confidence only as non-authoritative suggestions", () => {
  const source = readFileSync(
    new URL("../src/features/guardian-security-ui/guardian-candidate-results.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /LLM 建议严重度（非权威）/u);
  assert.match(source, /LLM 建议置信度（非权威）/u);
  assert.doesNotMatch(source, /finding\.severity/u);
  assert.doesNotMatch(source, /finding\.confidence/u);
});

test("authenticated issuance without signing secret fails safely", () => {
  expectDraftCode(() => issue(DETERMINISTIC, { secret: undefined }), "NOT_CONFIGURED");
});

test("anonymous issuance does not parse or require signing secret", () => {
  assert.equal(
    issueGuardianDraftForAuthenticatedSample({
      analysis: DETERMINISTIC,
      authenticatedWallet: null,
      caseName: CANONICAL_NAME,
      ...SOURCES,
      secret: "definitely malformed",
    }),
    null,
  );
});

test("signed-draft creation does not invoke the LLM provider again", async () => {
  const counter = { calls: 0 };
  const candidate = await candidateAnalysis(counter);
  issue(candidate.response, {
    vulnerableSource: candidate.request.sample.vulnerableSource,
    attackSource: undefined,
    fixedSource: undefined,
  });
  assert.equal(counter.calls, 1);
});

test("route obtains wallet only from the trusted HttpOnly session helper", () => {
  const source = readFileSync(
    new URL("../src/app/api/guardian/analyze/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /cookies\(\)/u);
  assert.match(source, /readSession\(token\)/u);
  assert.doesNotMatch(source, /input\.sample\.wallet/u);
});

test("route preserves candidate-only no-digest and deterministic digest branches", () => {
  const source = readFileSync(
    new URL("../src/app/api/guardian/analyze/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /outcome\.kind === "candidate-only"/u);
  assert.match(source, /guardianAnalysisDigest\(\s*outcome\.deterministicResult/u);
});

test("route maps signing configuration failure without exposing internals", () => {
  const source = readFileSync(
    new URL("../src/app/api/guardian/analyze/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /DRAFT_SIGNING_NOT_CONFIGURED/u);
  assert.match(source, /status: notConfigured \? 503 : 500/u);
  assert.doesNotMatch(source, /error\.message/u);
});

test("client parser rejects an extra candidate authority field", async () => {
  const candidate = await candidateAnalysis();
  const malformed = structuredClone(candidate.response);
  malformed.llmEnhancement.candidateFindings[0].published = true;
  expectApiCode(() => parseGuardianHybridPublicResponse(malformed));
});

test("signed selected Bestiary name is immutable carriage data", () => {
  const signed = issue(DETERMINISTIC);
  assert.equal(
    signed.claims.draft.selectedBestiaryName,
    DETERMINISTIC.bestiaryDraft.name,
  );
  assert.equal(Object.hasOwn(signed.claims.draft, "editableBestiaryName"), false);
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

console.log(`\nGuardian Signed Draft Stage 34.3: ${passed}/${tests.length} PASS`);
