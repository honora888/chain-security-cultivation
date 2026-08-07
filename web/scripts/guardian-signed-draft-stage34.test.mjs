import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const sourceRoot = new URL("../src/", import.meta.url);

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "server-only") {
      return {
        shortCircuit: true,
        url: "data:text/javascript,export%20{}",
      };
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

const {
  GuardianDraftError,
  canonicalizeGuardianDraftValue,
  constantTimeGuardianDraftSignaturesMatch,
  hashExactGuardianDraftSource,
  issueSignedGuardianDraftV1,
  verifySignedGuardianDraftV1,
} = await import("../src/lib/guardian-draft-signing.ts");
const {
  GUARDIAN_DRAFT_DOMAIN,
  GUARDIAN_SIGNED_DRAFT_SCHEMA_VERSION,
} = await import("../src/features/guardian-draft/contracts.ts");

const NOW = new Date("2026-08-07T00:00:00.000Z");
const SECRET = Buffer.alloc(32, 0x5a).toString("base64url");
const WALLET = "0x0A31d11Fd14029c12Ef07c2c200085aE622c1541";
const OTHER_WALLET = "0x000000000000000000000000000000000000dEaD";
const CASE_NAME = "回调状态错位样例";
const SOURCES = {
  vulnerableSource: "contract Vault {\r\n  // vulnerable  \r\n}\r\n",
  attackSource: "contract Attack { /* callback */ }\n",
  fixedSource: "contract Fixed { /* CEI */ }\n",
};

const ANALYSIS = {
  ok: true,
  schemaVersion: "guardian-security-candidate-analysis-v1",
  analyzedAt: "2026-08-07T00:00:00.000Z",
  agent: {
    mode: "hybrid-llm-candidate",
    externalModelConnected: true,
  },
  inputMode: "sample",
  case: {
    caseId: "user-sample",
    displayName: CASE_NAME,
    provenance: "user-provided-unverified",
  },
  deterministic: null,
  llmEnhancement: {
    status: "enhanced",
    candidateFindings: [
      {
        candidateId: "llm-candidate-1",
        category: "access-control",
        title: "候选发现",
        verification: "llm_candidate",
        suggestedSeverity: "High",
        suggestedConfidence: { label: "Medium", score: 72 },
        explanation: "仅供人工审核的候选解释。",
        attackPath: ["调用入口", "触发回调"],
        affectedCode: [
          {
            source: "vulnerableSource",
            location: "withdraw()",
            explanation: "外部调用发生在状态更新前。",
          },
        ],
        evidence: [
          {
            source: "vulnerableSource",
            description: "候选证据",
            locations: ["withdraw()"],
            provenance: "llm_candidate",
          },
        ],
        suggestedFix: ["先更新状态，再执行外部交互。"],
        limitations: ["未经确定性验证与人工审核。"],
      },
    ],
    publicSummary: "这是模型发现的待审核候选，不代表漏洞已验证。",
    bestiaryNameCandidates: ["回澜兽", "逆流兽", "旧态兽", "复潮兽"],
  },
  submission: {
    allowed: false,
    reason: "LLM_CANDIDATE_REQUIRES_SIGNED_DRAFT_OR_VERIFICATION",
  },
  review: {
    requiresHumanApproval: true,
    publishAllowed: false,
  },
  limitations: ["候选结果必须经过人工审核。"],
};

function clone(value) {
  return structuredClone(value);
}

function issue(overrides = {}) {
  return issueSignedGuardianDraftV1({
    analysis: clone(ANALYSIS),
    selectedBestiaryName: "回澜兽",
    caseName: CASE_NAME,
    authenticatedWallet: WALLET,
    ...SOURCES,
    secret: SECRET,
    now: () => new Date(NOW),
    randomBytes: () => Buffer.alloc(16, 0x21),
    ...overrides,
  });
}

function verify(value, overrides = {}) {
  return verifySignedGuardianDraftV1({
    value,
    authenticatedWallet: WALLET,
    caseName: CASE_NAME,
    ...SOURCES,
    secret: SECRET,
    now: () => new Date(NOW.getTime() + 1_000),
    ...overrides,
  });
}

function resign(envelope, secret = SECRET) {
  envelope.signature = createHmac(
    "sha256",
    Buffer.from(secret, "base64url"),
  )
    .update(canonicalizeGuardianDraftValue(envelope.claims), "utf8")
    .digest("base64url");
  return envelope;
}

function expectCode(callback, code) {
  assert.throws(callback, (error) => {
    assert.ok(error instanceof GuardianDraftError);
    assert.equal(error.code, code);
    assert.equal(error.message, code);
    return true;
  });
}

const tests = [];
function test(name, callback) {
  tests.push({ name, callback });
}

test("valid signed candidate verifies", () => {
  const verified = verify(issue());
  assert.equal(verified.claims.domain, GUARDIAN_DRAFT_DOMAIN);
  assert.equal(
    verified.claims.schemaVersion,
    GUARDIAN_SIGNED_DRAFT_SCHEMA_VERSION,
  );
  assert.equal(verified.claims.walletAddress, WALLET.toLowerCase());
});

test("verification returns the exact issued draft content", () => {
  const signed = issue();
  assert.deepEqual(verify(signed).claims.draft, signed.claims.draft);
});

test("tampered public summary is rejected", () => {
  const signed = clone(issue());
  signed.claims.draft.analysis.llmEnhancement.publicSummary = "篡改";
  expectCode(() => verify(signed), "SIGNATURE_INVALID");
});

test("tampered candidate explanation is rejected", () => {
  const signed = clone(issue());
  signed.claims.draft.analysis.llmEnhancement.candidateFindings[0].explanation =
    "篡改";
  expectCode(() => verify(signed), "SIGNATURE_INVALID");
});

test("changed vulnerable source is rejected", () => {
  expectCode(
    () => verify(issue(), { vulnerableSource: `${SOURCES.vulnerableSource} ` }),
    "SOURCE_MISMATCH",
  );
});

test("changed attack source is rejected", () => {
  expectCode(
    () => verify(issue(), { attackSource: `${SOURCES.attackSource} ` }),
    "SOURCE_MISMATCH",
  );
});

test("changed fixed source is rejected", () => {
  expectCode(
    () => verify(issue(), { fixedSource: `${SOURCES.fixedSource} ` }),
    "SOURCE_MISMATCH",
  );
});

test("changed case name is rejected", () => {
  expectCode(() => verify(issue(), { caseName: "另一案例" }), "CASE_NAME_MISMATCH");
});

test("wrong authenticated wallet is rejected", () => {
  expectCode(
    () => verify(issue(), { authenticatedWallet: OTHER_WALLET }),
    "WALLET_MISMATCH",
  );
});

test("expired draft is rejected", () => {
  const signed = issue();
  expectCode(
    () => verify(signed, { now: () => new Date(signed.claims.expiresAt) }),
    "EXPIRED",
  );
});

test("issuedAt beyond future skew is rejected", () => {
  const signed = clone(issue());
  signed.claims.issuedAt = new Date(NOW.getTime() + 62_000).toISOString();
  signed.claims.expiresAt = new Date(NOW.getTime() + 2 * 60_000).toISOString();
  resign(signed);
  expectCode(() => verify(signed), "INVALID_TIME");
});

test("expiresAt equal to issuedAt is rejected", () => {
  const signed = clone(issue());
  signed.claims.expiresAt = signed.claims.issuedAt;
  resign(signed);
  expectCode(() => verify(signed), "INVALID_TIME");
});

test("TTL over fifteen minutes is rejected", () => {
  const signed = clone(issue());
  signed.claims.expiresAt = new Date(
    Date.parse(signed.claims.issuedAt) + 15 * 60_000 + 1,
  ).toISOString();
  resign(signed);
  expectCode(() => verify(signed), "INVALID_TIME");
});

test("missing signing secret is rejected safely", () => {
  expectCode(() => issue({ secret: undefined }), "NOT_CONFIGURED");
});

test("malformed signing secret is rejected safely", () => {
  expectCode(() => issue({ secret: "not+base64url" }), "NOT_CONFIGURED");
});

test("signing secret shorter than 32 decoded bytes is rejected", () => {
  expectCode(
    () => issue({ secret: Buffer.alloc(31).toString("base64url") }),
    "NOT_CONFIGURED",
  );
});

test("malformed signature encoding is rejected", () => {
  const signed = clone(issue());
  signed.signature = "not-a-signature!";
  expectCode(() => verify(signed), "SIGNATURE_MALFORMED");
});

test("altered valid-length signature is rejected", () => {
  const signed = clone(issue());
  signed.signature = `${signed.signature[0] === "A" ? "B" : "A"}${signed.signature.slice(1)}`;
  expectCode(() => verify(signed), "SIGNATURE_INVALID");
});

test("unsupported domain is rejected", () => {
  const signed = clone(issue());
  signed.claims.domain = "other-domain";
  expectCode(() => verify(signed), "VERSION_UNSUPPORTED");
});

test("unsupported schema version is rejected", () => {
  const signed = clone(issue());
  signed.claims.schemaVersion = "guardian-signed-draft-v2";
  expectCode(() => verify(signed), "VERSION_UNSUPPORTED");
});

test("extra envelope field is rejected", () => {
  const signed = { ...clone(issue()), clientAuthority: true };
  expectCode(() => verify(signed), "MALFORMED");
});

test("extra claims field is rejected", () => {
  const signed = clone(issue());
  signed.claims.clientAuthority = true;
  expectCode(() => verify(signed), "MALFORMED");
});

test("source hashes are lowercase SHA-256 hexadecimal", () => {
  const hashes = issue().claims.sourceHashes;
  for (const key of ["vulnerableSource", "attackSource", "fixedSource"]) {
    assert.match(hashes[key], /^[0-9a-f]{64}$/u);
  }
});

test("exact source whitespace changes the source hash", () => {
  assert.notEqual(
    hashExactGuardianDraftSource("line\n"),
    hashExactGuardianDraftSource("line \n"),
  );
});

test("CRLF and LF sources produce different hashes", () => {
  assert.notEqual(
    hashExactGuardianDraftSource("line\r\n"),
    hashExactGuardianDraftSource("line\n"),
  );
});

test("optional absent sources bind to the empty string", () => {
  const signed = issue({ attackSource: undefined, fixedSource: undefined });
  const emptyHash = hashExactGuardianDraftSource("");
  assert.equal(signed.claims.sourceHashes.attackSource, emptyHash);
  assert.equal(signed.claims.sourceHashes.fixedSource, emptyHash);
});

test("model-controlled authoritative field is rejected", () => {
  const analysis = clone(ANALYSIS);
  analysis.llmEnhancement.candidateFindings[0].published = true;
  expectCode(() => issue({ analysis }), "MALFORMED");
});

test("model-controlled severity authority field is rejected", () => {
  const analysis = clone(ANALYSIS);
  analysis.llmEnhancement.candidateFindings[0].severity = "Critical";
  expectCode(() => issue({ analysis }), "MALFORMED");
});

test("LLM candidate verification remains llm_candidate", () => {
  const signed = issue();
  assert.equal(
    signed.claims.draft.analysis.llmEnhancement.candidateFindings[0]
      .verification,
    "llm_candidate",
  );
});

test("non-candidate verification is rejected before signing", () => {
  const analysis = clone(ANALYSIS);
  analysis.llmEnhancement.candidateFindings[0].verification = "verified";
  expectCode(() => issue({ analysis }), "MALFORMED");
});

test("LLM evidence provenance remains llm_candidate", () => {
  const signed = issue();
  assert.equal(
    signed.claims.draft.analysis.llmEnhancement.candidateFindings[0].evidence[0]
      .provenance,
    "llm_candidate",
  );
});

test("non-candidate evidence provenance is rejected before signing", () => {
  const analysis = clone(ANALYSIS);
  analysis.llmEnhancement.candidateFindings[0].evidence[0].provenance =
    "verified";
  expectCode(() => issue({ analysis }), "MALFORMED");
});

test("candidate analysis visible case name must equal signed case name", () => {
  const analysis = clone(ANALYSIS);
  analysis.case.displayName = "不一致案例";
  expectCode(() => issue({ analysis }), "MALFORMED");
});

test("candidate analysis requires exactly four unique bestiary names", () => {
  const analysis = clone(ANALYSIS);
  analysis.llmEnhancement.bestiaryNameCandidates[3] = "回澜兽";
  expectCode(() => issue({ analysis }), "MALFORMED");
});

test("draft ID is 128-bit base64url data", () => {
  const draftId = issue().claims.draftId;
  assert.match(draftId, /^[A-Za-z0-9_-]{22}$/u);
  assert.equal(Buffer.from(draftId, "base64url").length, 16);
});

test("canonical JSON is stable across object insertion order", () => {
  const left = { z: 1, a: { y: 2, x: [3, 4] } };
  const right = { a: { x: [3, 4], y: 2 }, z: 1 };
  assert.equal(
    canonicalizeGuardianDraftValue(left),
    canonicalizeGuardianDraftValue(right),
  );
});

test("canonical JSON preserves array order", () => {
  assert.notEqual(
    canonicalizeGuardianDraftValue([1, 2]),
    canonicalizeGuardianDraftValue([2, 1]),
  );
});

for (const [label, value] of [
  ["NaN", Number.NaN],
  ["Infinity", Number.POSITIVE_INFINITY],
  ["undefined", undefined],
  ["non-plain object", new Date(0)],
]) {
  test(`canonical JSON rejects ${label}`, () => {
    expectCode(() => canonicalizeGuardianDraftValue(value), "MALFORMED");
  });
}

test("constant-time signature helper accepts equal byte sequences", () => {
  assert.equal(
    constantTimeGuardianDraftSignaturesMatch(
      Buffer.alloc(32, 1),
      Buffer.alloc(32, 1),
    ),
    true,
  );
});

test("constant-time signature helper rejects unequal byte sequences", () => {
  assert.equal(
    constantTimeGuardianDraftSignaturesMatch(
      Buffer.alloc(32, 1),
      Buffer.alloc(32, 2),
    ),
    false,
  );
});

test("valid-length signature path uses crypto.timingSafeEqual", () => {
  const source = readFileSync(
    new URL("../src/lib/guardian-draft-signing.ts", import.meta.url),
    "utf8",
  );
  assert.match(source, /timingSafeEqual\(expectedBytes, actualBytes\)/u);
});

test("signing secret never appears in thrown errors", () => {
  const signed = clone(issue());
  signed.signature = `${signed.signature[0] === "A" ? "B" : "A"}${signed.signature.slice(1)}`;
  assert.throws(() => verify(signed), (error) => {
    assert.ok(error instanceof GuardianDraftError);
    assert.equal(String(error).includes(SECRET), false);
    return true;
  });
});

let passed = 0;
for (const { name, callback } of tests) {
  try {
    await callback();
    passed += 1;
    console.log(`PASS ${passed}: ${name}`);
  } catch (error) {
    console.error(`FAIL: ${name}`);
    throw error;
  }
}

console.log(`\n${passed}/${tests.length} Guardian signed draft Stage 34 tests passed.`);
