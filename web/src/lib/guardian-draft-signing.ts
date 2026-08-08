import "server-only";

import {
  createHash,
  createHmac,
  randomBytes as nodeRandomBytes,
  timingSafeEqual,
} from "node:crypto";

import { walletAddressForDatabase } from "@/auth/server";
import {
  CONTRIBUTION_BESTIARY_NAME_MAX_CHARS,
  CONTRIBUTION_CASE_NAME_MAX_CHARS,
} from "@/contributions/constants";
import {
  GUARDIAN_DRAFT_DOMAIN,
  GUARDIAN_DRAFT_MAX_FUTURE_SKEW_MS,
  GUARDIAN_DRAFT_MAX_TTL_MS,
  GUARDIAN_SIGNED_DRAFT_SCHEMA_VERSION,
  type GuardianDraftClaimsV1,
  type GuardianDraftSourceHashesV1,
  type SignedGuardianDraftV1,
} from "@/features/guardian-draft/contracts";
import type { GuardianHybridPublicResponse } from "@/features/guardian-llm/hybrid-analysis-types";
import {
  GUARDIAN_AFFECTED_CODE_SOURCES,
  GUARDIAN_FINDING_SEVERITIES,
  GUARDIAN_VULNERABILITY_CATEGORIES,
  MAX_LLM_AFFECTED_CODE_ITEMS,
  MAX_LLM_BESTIARY_BEHAVIOR_ITEMS,
  MAX_LLM_BESTIARY_NAME_LENGTH,
  MAX_LLM_CANDIDATE_FINDINGS,
  MAX_LLM_EVIDENCE_ITEMS,
  MAX_LLM_EVIDENCE_LOCATIONS,
  MAX_LLM_EXPLANATION_LENGTH,
  MAX_LLM_LIST_ITEMS,
  MAX_LLM_LOCATION_LENGTH,
  MAX_LLM_PUBLIC_SUMMARY_LENGTH,
  MAX_LLM_TEXT_ITEM_LENGTH,
  MAX_LLM_TITLE_LENGTH,
} from "@/features/guardian-llm/response-schema";
import {
  guardianConfidenceLabelForScore,
  isGuardianConfidenceLabel,
  isGuardianConfidenceScore,
} from "@/features/guardian-llm/confidence";
import { isSimplifiedChineseOrientedText } from "@/features/guardian-llm/language-policy";
import {
  isCultivationElement,
  isCultivationRealm,
} from "@/features/guardian-security/cultivation-labels";

export type GuardianDraftErrorCode =
  | "NOT_CONFIGURED"
  | "MALFORMED"
  | "SIGNATURE_MALFORMED"
  | "SIGNATURE_INVALID"
  | "EXPIRED"
  | "WALLET_MISMATCH"
  | "SOURCE_MISMATCH"
  | "CASE_NAME_MISMATCH"
  | "VERSION_UNSUPPORTED"
  | "INVALID_TIME";

export class GuardianDraftError extends Error {
  readonly code: GuardianDraftErrorCode;

  constructor(code: GuardianDraftErrorCode) {
    super(code);
    this.name = "GuardianDraftError";
    this.code = code;
  }
}

export interface IssueSignedGuardianDraftV1Input {
  readonly analysis: GuardianHybridPublicResponse;
  readonly selectedBestiaryName: string;
  readonly caseName: string;
  readonly authenticatedWallet: string;
  readonly vulnerableSource: string;
  readonly attackSource?: string;
  readonly fixedSource?: string;
  readonly secret: string | null | undefined;
  readonly now?: () => Date;
  readonly randomBytes?: (size: number) => Uint8Array;
  readonly ttlMs?: number;
}

export interface VerifySignedGuardianDraftV1Input {
  readonly value: unknown;
  readonly authenticatedWallet: string;
  readonly caseName: string;
  readonly vulnerableSource: string;
  readonly attackSource?: string;
  readonly fixedSource?: string;
  readonly secret: string | null | undefined;
  readonly now?: () => Date;
}

const HASH_PATTERN = /^[0-9a-f]{64}$/u;
const DRAFT_ID_PATTERN = /^[A-Za-z0-9_-]{22}$/u;
const SIGNATURE_PATTERN = /^[A-Za-z0-9_-]{43}$/u;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f-\u009f]/u;

const CANDIDATE_ANALYSIS_KEYS = [
  "ok",
  "schemaVersion",
  "analyzedAt",
  "agent",
  "inputMode",
  "case",
  "deterministic",
  "llmEnhancement",
  "submission",
  "review",
  "limitations",
] as const;

const DETERMINISTIC_ANALYSIS_KEYS = [
  "ok",
  "schemaVersion",
  "analyzedAt",
  "agent",
  "inputMode",
  "case",
  "mossEvidence",
  "signals",
  "analysis",
  "classification",
  "severity",
  "confidence",
  "bestiaryDraft",
  "questDraft",
  "review",
  "limitations",
] as const;

const PUBLIC_LLM_ENHANCEMENT_KEYS = [
  "status",
  "candidateFindings",
  "publicSummary",
  "bestiaryNameCandidates",
] as const;

const CANDIDATE_BESTIARY_SUGGESTION_KEYS = [
  "candidateFindingIndex",
  "suggestedPrimaryElement",
  "suggestedSecondaryElements",
  "suggestedCultivationRealm",
  "lore",
  "behavior",
  "attackTechnique",
  "countermeasure",
  "cultivationLesson",
] as const;

const PUBLIC_CANDIDATE_KEYS = [
  "candidateId",
  "category",
  "title",
  "verification",
  "suggestedSeverity",
  "suggestedConfidence",
  "explanation",
  "attackPath",
  "affectedCode",
  "evidence",
  "suggestedFix",
  "limitations",
] as const;

const CANDIDATE_EVIDENCE_KEYS = [
  "source",
  "description",
  "locations",
  "provenance",
] as const;

const AFFECTED_CODE_KEYS = ["source", "location", "explanation"] as const;

function fail(code: GuardianDraftErrorCode): never {
  throw new GuardianDraftError(code);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function record(value: unknown): Record<string, unknown> {
  return isPlainRecord(value) ? value : fail("MALFORMED");
}

function exactRecord(
  value: unknown,
  expectedKeys: readonly string[],
): Record<string, unknown> {
  const object = record(value);
  const keys = Object.keys(object).sort();
  const expected = [...expectedKeys].sort();
  if (
    keys.length !== expected.length ||
    keys.some((key, index) => key !== expected[index])
  ) {
    return fail("MALFORMED");
  }
  return object;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : fail("MALFORMED");
}

function stringArray(value: unknown): readonly string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    return fail("MALFORMED");
  }
  return value;
}

function boundedStringArray(
  value: unknown,
  maxItems: number,
  maxCharacters: number,
  chinesePresentation: boolean,
): readonly string[] {
  const items = stringArray(value);
  if (items.length > maxItems) return fail("MALFORMED");
  return items.map((item) =>
    chinesePresentation
      ? validateChinesePresentationString(item, maxCharacters)
      : validateBoundedDisplayString(item, maxCharacters),
  );
}

function validateBoundedDisplayString(value: unknown, maxCharacters: number): string {
  const result = stringValue(value);
  if (
    result.length === 0 ||
    result.trim() !== result ||
    CONTROL_CHARACTER_PATTERN.test(result) ||
    result.length > maxCharacters ||
    Array.from(result).length > maxCharacters
  ) {
    return fail("MALFORMED");
  }
  return result;
}

function parseIsoTime(value: unknown): { iso: string; milliseconds: number } {
  const iso = stringValue(value);
  const milliseconds = Date.parse(iso);
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== iso) {
    return fail("INVALID_TIME");
  }
  return { iso, milliseconds };
}

function parseSigningSecret(value: string | null | undefined): Buffer {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.trim() !== value ||
    !/^[A-Za-z0-9_-]+$/u.test(value)
  ) {
    return fail("NOT_CONFIGURED");
  }

  const decoded = Buffer.from(value, "base64url");
  if (decoded.length < 32 || decoded.toString("base64url") !== value) {
    return fail("NOT_CONFIGURED");
  }
  return decoded;
}

function signatureBytes(value: unknown): Buffer {
  if (typeof value !== "string" || !SIGNATURE_PATTERN.test(value)) {
    return fail("SIGNATURE_MALFORMED");
  }
  const decoded = Buffer.from(value, "base64url");
  if (decoded.length !== 32 || decoded.toString("base64url") !== value) {
    return fail("SIGNATURE_MALFORMED");
  }
  return decoded;
}

function canonicalize(
  value: unknown,
  ancestors: Set<object>,
): string {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? JSON.stringify(value) : fail("MALFORMED");
  }
  if (
    value === undefined ||
    typeof value === "bigint" ||
    typeof value === "function" ||
    typeof value === "symbol"
  ) {
    return fail("MALFORMED");
  }

  if (typeof value !== "object" || value === null || ancestors.has(value)) {
    return fail("MALFORMED");
  }

  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      return `[${value.map((item) => canonicalize(item, ancestors)).join(",")}]`;
    }
    if (!isPlainRecord(value) || Object.getOwnPropertySymbols(value).length > 0) {
      return fail("MALFORMED");
    }
    const entries = Object.keys(value)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${canonicalize(value[key], ancestors)}`,
      );
    return `{${entries.join(",")}}`;
  } finally {
    ancestors.delete(value);
  }
}

export function canonicalizeGuardianDraftValue(value: unknown): string {
  return canonicalize(value, new Set<object>());
}

export function hashExactGuardianDraftSource(value: string): string {
  if (typeof value !== "string") return fail("MALFORMED");
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function exactSourceHashes(input: {
  vulnerableSource: string;
  attackSource?: string;
  fixedSource?: string;
}): GuardianDraftSourceHashesV1 {
  return {
    algorithm: "sha256",
    vulnerableSource: hashExactGuardianDraftSource(input.vulnerableSource),
    attackSource: hashExactGuardianDraftSource(input.attackSource ?? ""),
    fixedSource: hashExactGuardianDraftSource(input.fixedSource ?? ""),
  };
}

function validateChinesePresentationString(
  value: unknown,
  maxCharacters: number,
): string {
  const text = validateBoundedDisplayString(value, maxCharacters);
  if (!isSimplifiedChineseOrientedText(text)) return fail("MALFORMED");
  return text;
}

function validateCandidateBestiarySuggestion(
  value: unknown,
  candidateCount: number,
): void {
  const suggestion = exactRecord(value, CANDIDATE_BESTIARY_SUGGESTION_KEYS);
  const primary = suggestion.suggestedPrimaryElement;
  const secondary = suggestion.suggestedSecondaryElements;
  const candidateFindingIndex = suggestion.candidateFindingIndex;
  if (
    typeof candidateFindingIndex !== "number" ||
    !Number.isInteger(candidateFindingIndex) ||
    candidateFindingIndex < 0 ||
    candidateFindingIndex >= candidateCount ||
    !isCultivationElement(primary) ||
    !Array.isArray(secondary) ||
    secondary.length > 4 ||
    !secondary.every(isCultivationElement) ||
    new Set(secondary).size !== secondary.length ||
    secondary.includes(primary) ||
    !isCultivationRealm(suggestion.suggestedCultivationRealm) ||
    !Array.isArray(suggestion.behavior) ||
    suggestion.behavior.length === 0 ||
    suggestion.behavior.length > MAX_LLM_BESTIARY_BEHAVIOR_ITEMS
  ) {
    return fail("MALFORMED");
  }

  validateChinesePresentationString(suggestion.lore, MAX_LLM_EXPLANATION_LENGTH);
  suggestion.behavior.forEach((item) =>
    validateChinesePresentationString(item, MAX_LLM_TEXT_ITEM_LENGTH),
  );
  validateChinesePresentationString(
    suggestion.attackTechnique,
    MAX_LLM_TEXT_ITEM_LENGTH,
  );
  validateChinesePresentationString(
    suggestion.countermeasure,
    MAX_LLM_TEXT_ITEM_LENGTH,
  );
  validateChinesePresentationString(
    suggestion.cultivationLesson,
    MAX_LLM_TEXT_ITEM_LENGTH,
  );
}

function validatePublicLlmEnhancement(value: unknown): void {
  const hasSuggestion = isPlainRecord(value) && Object.hasOwn(value, "candidateBestiarySuggestion");
  const enhancement = exactRecord(value, [
    ...PUBLIC_LLM_ENHANCEMENT_KEYS,
    ...(hasSuggestion ? ["candidateBestiarySuggestion"] : []),
  ]);
  if (
    enhancement.status !== "enhanced" ||
    !Array.isArray(enhancement.candidateFindings) ||
    enhancement.candidateFindings.length > MAX_LLM_CANDIDATE_FINDINGS
  ) {
    return fail("MALFORMED");
  }
  validateChinesePresentationString(
    enhancement.publicSummary,
    MAX_LLM_PUBLIC_SUMMARY_LENGTH,
  );
  const names = stringArray(enhancement.bestiaryNameCandidates).map((name) =>
    validateChinesePresentationString(name, MAX_LLM_BESTIARY_NAME_LENGTH),
  );
  if (names.length !== 4 || new Set(names).size !== 4) {
    return fail("MALFORMED");
  }

  for (const [candidateIndex, candidateValue] of enhancement.candidateFindings.entries()) {
    const candidate = exactRecord(candidateValue, PUBLIC_CANDIDATE_KEYS);
    if (
      candidate.candidateId !== `llm-candidate-${candidateIndex + 1}` ||
      typeof candidate.category !== "string" ||
      !GUARDIAN_VULNERABILITY_CATEGORIES.includes(candidate.category as never) ||
      candidate.verification !== "llm_candidate" ||
      typeof candidate.suggestedSeverity !== "string" ||
      !GUARDIAN_FINDING_SEVERITIES.includes(candidate.suggestedSeverity as never) ||
      !Array.isArray(candidate.affectedCode) ||
      candidate.affectedCode.length > MAX_LLM_AFFECTED_CODE_ITEMS ||
      !Array.isArray(candidate.evidence) ||
      candidate.evidence.length > MAX_LLM_EVIDENCE_ITEMS
    ) {
      return fail("MALFORMED");
    }

    validateChinesePresentationString(candidate.title, MAX_LLM_TITLE_LENGTH);
    validateChinesePresentationString(
      candidate.explanation,
      MAX_LLM_EXPLANATION_LENGTH,
    );

    const confidence = exactRecord(candidate.suggestedConfidence, [
      "label",
      "score",
    ]);
    if (
      !isGuardianConfidenceLabel(confidence.label) ||
      !isGuardianConfidenceScore(confidence.score) ||
      confidence.label !== guardianConfidenceLabelForScore(confidence.score)
    ) {
      return fail("MALFORMED");
    }

    boundedStringArray(
      candidate.attackPath,
      MAX_LLM_LIST_ITEMS,
      MAX_LLM_TEXT_ITEM_LENGTH,
      true,
    );
    boundedStringArray(
      candidate.suggestedFix,
      MAX_LLM_LIST_ITEMS,
      MAX_LLM_TEXT_ITEM_LENGTH,
      true,
    );
    boundedStringArray(
      candidate.limitations,
      MAX_LLM_LIST_ITEMS,
      MAX_LLM_TEXT_ITEM_LENGTH,
      true,
    );

    for (const affectedValue of candidate.affectedCode) {
      const affected = exactRecord(affectedValue, AFFECTED_CODE_KEYS);
      if (
        typeof affected.source !== "string" ||
        !GUARDIAN_AFFECTED_CODE_SOURCES.includes(affected.source as never)
      ) {
        return fail("MALFORMED");
      }
      validateBoundedDisplayString(affected.location, MAX_LLM_LOCATION_LENGTH);
      validateChinesePresentationString(
        affected.explanation,
        MAX_LLM_TEXT_ITEM_LENGTH,
      );
    }

    for (const evidenceValue of candidate.evidence) {
      const evidence = exactRecord(evidenceValue, CANDIDATE_EVIDENCE_KEYS);
      if (
        evidence.provenance !== "llm_candidate"
      ) {
        return fail("MALFORMED");
      }
      validateBoundedDisplayString(evidence.source, MAX_LLM_TEXT_ITEM_LENGTH);
      validateChinesePresentationString(
        evidence.description,
        MAX_LLM_TEXT_ITEM_LENGTH,
      );
      boundedStringArray(
        evidence.locations,
        MAX_LLM_EVIDENCE_LOCATIONS,
        MAX_LLM_LOCATION_LENGTH,
        false,
      );
    }
  }

  if (hasSuggestion) {
    validateCandidateBestiarySuggestion(
      enhancement.candidateBestiarySuggestion,
      enhancement.candidateFindings.length,
    );
  }
}

function validateSampleCase(value: unknown, caseName: string): void {
  const caseValue = exactRecord(value, ["caseId", "displayName", "provenance"]);
  if (
    caseValue.caseId !== "user-sample" ||
    caseValue.displayName !== caseName ||
    caseValue.provenance !== "user-provided-unverified"
  ) {
    return fail("MALFORMED");
  }
}

function validateGuardianAnalysis(
  value: unknown,
  caseName: string,
): asserts value is GuardianHybridPublicResponse {
  const analysis = record(value);

  if (analysis.schemaVersion === "guardian-security-candidate-analysis-v1") {
    exactRecord(analysis, CANDIDATE_ANALYSIS_KEYS);
    if (
      analysis.ok !== true ||
      analysis.inputMode !== "sample" ||
      analysis.deterministic !== null
    ) {
      return fail("MALFORMED");
    }
    const agent = exactRecord(analysis.agent, [
      "mode",
      "externalModelConnected",
    ]);
    if (
      agent.mode !== "hybrid-llm-candidate" ||
      agent.externalModelConnected !== true
    ) {
      return fail("MALFORMED");
    }
    validateSampleCase(analysis.case, caseName);
    validatePublicLlmEnhancement(analysis.llmEnhancement);
    const submission = exactRecord(analysis.submission, ["allowed", "reason"]);
    if (
      submission.allowed !== false ||
      submission.reason !==
        "LLM_CANDIDATE_REQUIRES_SIGNED_DRAFT_OR_VERIFICATION"
    ) {
      return fail("MALFORMED");
    }
    const review = exactRecord(analysis.review, [
      "requiresHumanApproval",
      "publishAllowed",
    ]);
    if (
      review.requiresHumanApproval !== true ||
      review.publishAllowed !== false
    ) {
      return fail("MALFORMED");
    }
    stringArray(analysis.limitations);
    parseIsoTime(analysis.analyzedAt);
    return;
  }

  if (analysis.schemaVersion !== "guardian-security-analysis-v1") {
    return fail("MALFORMED");
  }

  const expectedKeys = Object.hasOwn(analysis, "llmEnhancement")
    ? [...DETERMINISTIC_ANALYSIS_KEYS, "llmEnhancement"]
    : DETERMINISTIC_ANALYSIS_KEYS;
  exactRecord(analysis, expectedKeys);
  if (analysis.ok !== true || analysis.inputMode !== "sample") {
    return fail("MALFORMED");
  }
  validateSampleCase(analysis.case, caseName);
  parseIsoTime(analysis.analyzedAt);
  if (Object.hasOwn(analysis, "llmEnhancement")) {
    validatePublicLlmEnhancement(analysis.llmEnhancement);
  }
}

function hmacForClaims(claims: GuardianDraftClaimsV1, secret: Buffer): Buffer {
  return createHmac("sha256", secret)
    .update(canonicalizeGuardianDraftValue(claims), "utf8")
    .digest();
}

export function constantTimeGuardianDraftSignaturesMatch(
  expected: Uint8Array,
  actual: Uint8Array,
): boolean {
  const expectedBytes = Buffer.from(expected);
  const actualBytes = Buffer.from(actual);
  return (
    expectedBytes.length === actualBytes.length &&
    timingSafeEqual(expectedBytes, actualBytes)
  );
}

function parseSignedDraftEnvelope(value: unknown): SignedGuardianDraftV1 {
  const envelope = exactRecord(value, ["claims", "signature"]);
  const claimsValue = exactRecord(envelope.claims, [
    "domain",
    "schemaVersion",
    "draftId",
    "issuedAt",
    "expiresAt",
    "walletAddress",
    "caseName",
    "sourceHashes",
    "draft",
  ]);

  if (
    claimsValue.domain !== GUARDIAN_DRAFT_DOMAIN ||
    claimsValue.schemaVersion !== GUARDIAN_SIGNED_DRAFT_SCHEMA_VERSION
  ) {
    return fail("VERSION_UNSUPPORTED");
  }

  const draftId = stringValue(claimsValue.draftId);
  if (!DRAFT_ID_PATTERN.test(draftId)) return fail("MALFORMED");
  const issuedAt = parseIsoTime(claimsValue.issuedAt).iso;
  const expiresAt = parseIsoTime(claimsValue.expiresAt).iso;
  const walletAddress = stringValue(claimsValue.walletAddress);
  const caseName = validateBoundedDisplayString(
    claimsValue.caseName,
    CONTRIBUTION_CASE_NAME_MAX_CHARS,
  );

  const hashesValue = exactRecord(claimsValue.sourceHashes, [
    "algorithm",
    "vulnerableSource",
    "attackSource",
    "fixedSource",
  ]);
  if (hashesValue.algorithm !== "sha256") return fail("MALFORMED");
  const vulnerableSourceHash = stringValue(hashesValue.vulnerableSource);
  const attackSourceHash = stringValue(hashesValue.attackSource);
  const fixedSourceHash = stringValue(hashesValue.fixedSource);
  if (
    !HASH_PATTERN.test(vulnerableSourceHash) ||
    !HASH_PATTERN.test(attackSourceHash) ||
    !HASH_PATTERN.test(fixedSourceHash)
  ) {
    return fail("MALFORMED");
  }

  const draftValue = exactRecord(claimsValue.draft, [
    "analysis",
    "selectedBestiaryName",
  ]);
  const selectedBestiaryName = validateBoundedDisplayString(
    draftValue.selectedBestiaryName,
    CONTRIBUTION_BESTIARY_NAME_MAX_CHARS,
  );
  validateGuardianAnalysis(draftValue.analysis, caseName);

  const signature = stringValue(envelope.signature);
  signatureBytes(signature);

  return {
    claims: {
      domain: GUARDIAN_DRAFT_DOMAIN,
      schemaVersion: GUARDIAN_SIGNED_DRAFT_SCHEMA_VERSION,
      draftId,
      issuedAt,
      expiresAt,
      walletAddress,
      caseName,
      sourceHashes: {
        algorithm: "sha256",
        vulnerableSource: vulnerableSourceHash,
        attackSource: attackSourceHash,
        fixedSource: fixedSourceHash,
      },
      draft: {
        analysis: draftValue.analysis,
        selectedBestiaryName,
      },
    },
    signature,
  };
}

function canonicalWallet(value: string, errorCode: GuardianDraftErrorCode): string {
  try {
    return walletAddressForDatabase(value);
  } catch {
    return fail(errorCode);
  }
}

function validateTimeWindow(
  claims: GuardianDraftClaimsV1,
  nowMilliseconds: number,
): void {
  const issuedAt = parseIsoTime(claims.issuedAt).milliseconds;
  const expiresAt = parseIsoTime(claims.expiresAt).milliseconds;
  if (
    expiresAt <= issuedAt ||
    expiresAt - issuedAt > GUARDIAN_DRAFT_MAX_TTL_MS ||
    issuedAt - nowMilliseconds > GUARDIAN_DRAFT_MAX_FUTURE_SKEW_MS
  ) {
    return fail("INVALID_TIME");
  }
  if (expiresAt <= nowMilliseconds) return fail("EXPIRED");
}

export function issueSignedGuardianDraftV1(
  input: IssueSignedGuardianDraftV1Input,
): SignedGuardianDraftV1 {
  const secret = parseSigningSecret(input.secret);
  const caseName = validateBoundedDisplayString(
    input.caseName,
    CONTRIBUTION_CASE_NAME_MAX_CHARS,
  );
  const selectedBestiaryName = validateBoundedDisplayString(
    input.selectedBestiaryName,
    CONTRIBUTION_BESTIARY_NAME_MAX_CHARS,
  );
  const walletAddress = canonicalWallet(input.authenticatedWallet, "MALFORMED");
  validateGuardianAnalysis(input.analysis, caseName);

  const ttlMs = input.ttlMs ?? GUARDIAN_DRAFT_MAX_TTL_MS;
  if (
    !Number.isInteger(ttlMs) ||
    ttlMs <= 0 ||
    ttlMs > GUARDIAN_DRAFT_MAX_TTL_MS
  ) {
    return fail("INVALID_TIME");
  }
  const now = (input.now ?? (() => new Date()))();
  const nowMilliseconds = now.getTime();
  if (!Number.isFinite(nowMilliseconds)) return fail("INVALID_TIME");

  const random = Buffer.from(
    (input.randomBytes ?? nodeRandomBytes)(16),
  );
  if (random.length !== 16) return fail("MALFORMED");

  const claims: GuardianDraftClaimsV1 = {
    domain: GUARDIAN_DRAFT_DOMAIN,
    schemaVersion: GUARDIAN_SIGNED_DRAFT_SCHEMA_VERSION,
    draftId: random.toString("base64url"),
    issuedAt: new Date(nowMilliseconds).toISOString(),
    expiresAt: new Date(nowMilliseconds + ttlMs).toISOString(),
    walletAddress,
    caseName,
    sourceHashes: exactSourceHashes(input),
    draft: {
      analysis: input.analysis,
      selectedBestiaryName,
    },
  };

  return {
    claims,
    signature: hmacForClaims(claims, secret).toString("base64url"),
  };
}

export function verifySignedGuardianDraftV1(
  input: VerifySignedGuardianDraftV1Input,
): SignedGuardianDraftV1 {
  const envelope = parseSignedDraftEnvelope(input.value);
  const actualSignature = signatureBytes(envelope.signature);
  const secret = parseSigningSecret(input.secret);
  const expectedSignature = hmacForClaims(envelope.claims, secret);
  if (
    !constantTimeGuardianDraftSignaturesMatch(
      expectedSignature,
      actualSignature,
    )
  ) {
    return fail("SIGNATURE_INVALID");
  }

  const now = (input.now ?? (() => new Date()))().getTime();
  if (!Number.isFinite(now)) return fail("INVALID_TIME");
  validateTimeWindow(envelope.claims, now);

  const authenticatedWallet = canonicalWallet(
    input.authenticatedWallet,
    "WALLET_MISMATCH",
  );
  const signedWallet = canonicalWallet(
    envelope.claims.walletAddress,
    "MALFORMED",
  );
  if (signedWallet !== authenticatedWallet) return fail("WALLET_MISMATCH");

  const expectedHashes = exactSourceHashes(input);
  if (
    envelope.claims.sourceHashes.vulnerableSource !==
      expectedHashes.vulnerableSource ||
    envelope.claims.sourceHashes.attackSource !== expectedHashes.attackSource ||
    envelope.claims.sourceHashes.fixedSource !== expectedHashes.fixedSource
  ) {
    return fail("SOURCE_MISMATCH");
  }

  const caseName = validateBoundedDisplayString(
    input.caseName,
    CONTRIBUTION_CASE_NAME_MAX_CHARS,
  );
  if (envelope.claims.caseName !== caseName) {
    return fail("CASE_NAME_MISMATCH");
  }

  validateGuardianAnalysis(
    envelope.claims.draft.analysis,
    envelope.claims.caseName,
  );
  return envelope;
}
