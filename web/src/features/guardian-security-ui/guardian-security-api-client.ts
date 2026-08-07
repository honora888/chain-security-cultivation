import type {
  GuardianSecurityErrorCode,
  GuardianSecurityFailure,
  GuardianSecuritySuccess,
} from "@/features/guardian-security/analysis-types";
import {
  guardianDraftAnalysisMatchesVisible,
  parseSignedGuardianDraftV1,
} from "@/features/guardian-draft/client";
import type { SignedGuardianDraftV1 } from "@/features/guardian-draft/contracts";
import type {
  GuardianCandidateOnlyAnalysisSuccess,
  GuardianHybridPublicResponse,
  GuardianPublicLlmEnhancement,
} from "@/features/guardian-llm/hybrid-analysis-types";
import type {
  GuardianCandidateBestiarySuggestion,
  GuardianAffectedCode,
  GuardianFindingConfidence,
  GuardianFindingSeverity,
  GuardianLlmCandidateEvidence,
  GuardianLlmCandidateFinding,
  GuardianVulnerabilityCategory,
} from "@/features/guardian-llm/contracts";
import {
  isCultivationElement,
  isCultivationRealm,
} from "@/features/guardian-security/cultivation-labels";
import {
  isGuardianConfidenceScore,
  normalizeGuardianSuggestedConfidence,
} from "@/features/guardian-llm/confidence";
import {
  MAX_LLM_AFFECTED_CODE_ITEMS,
  MAX_LLM_BESTIARY_NAME_LENGTH,
  MAX_LLM_BESTIARY_BEHAVIOR_ITEMS,
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
import { CONTRIBUTION_CASE_NAME_MAX_CHARS } from "@/contributions/constants";

export interface GuardianSampleSubmission {
  name: string;
  vulnerableSource: string;
  attackSource: string;
  fixedSource: string;
}

type GuardianSecurityUiErrorCode =
  | GuardianSecurityErrorCode
  | "INVALID_RESPONSE"
  | "UNEXPECTED_MOSS_EVIDENCE"
  | "DRAFT_SIGNING_NOT_CONFIGURED"
  | "DRAFT_SIGNING_FAILED";

export class GuardianSecurityApiError extends Error {
  readonly code: GuardianSecurityUiErrorCode;

  constructor(code: GuardianSecurityUiErrorCode) {
    super(code);
    this.code = code;
    this.name = "GuardianSecurityApiError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFailure(value: unknown): value is GuardianSecurityFailure {
  return (
    isRecord(value) &&
    value.ok === false &&
    isRecord(value.error) &&
    typeof value.error.code === "string" &&
    typeof value.error.message === "string"
  );
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function exactObject(
  value: unknown,
  expectedKeys: readonly string[],
): Record<string, unknown> {
  if (!isRecord(value)) throw new GuardianSecurityApiError("INVALID_RESPONSE");
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index])
  ) {
    throw new GuardianSecurityApiError("INVALID_RESPONSE");
  }
  return value;
}

function trimmedString(value: unknown, maxLength: number): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > maxLength ||
    value.trim() !== value
  ) {
    throw new GuardianSecurityApiError("INVALID_RESPONSE");
  }
  return value;
}

function stringList(
  value: unknown,
  maxItems: number,
  maxLength = MAX_LLM_TEXT_ITEM_LENGTH,
): readonly string[] {
  if (!Array.isArray(value) || value.length > maxItems) {
    throw new GuardianSecurityApiError("INVALID_RESPONSE");
  }
  return value.map((item) => trimmedString(item, maxLength));
}

const CANDIDATE_CATEGORIES = [
  "reentrancy",
  "access-control",
  "unchecked-external-call",
  "delegatecall",
  "oracle-manipulation",
  "economic-attack",
  "signature-replay",
  "authentication",
  "denial-of-service",
  "accounting",
  "state-logic",
  "initialization",
  "upgradeability",
  "arithmetic",
  "precision-rounding",
  "timestamp-dependence",
  "randomness",
  "frontrunning-mev",
  "other",
] as const satisfies readonly GuardianVulnerabilityCategory[];

function candidateSeverity(value: unknown): GuardianFindingSeverity {
  if (!isOneOf(value, SEVERITY_VALUES)) {
    throw new GuardianSecurityApiError("INVALID_RESPONSE");
  }
  return value;
}

function candidateConfidence(value: unknown): GuardianFindingConfidence {
  const confidence = exactObject(value, ["label", "score"]);
  if (
    !isOneOf(confidence.label, CONFIDENCE_VALUES) ||
    !isGuardianConfidenceScore(confidence.score)
  ) {
    throw new GuardianSecurityApiError("INVALID_RESPONSE");
  }
  return normalizeGuardianSuggestedConfidence({
    label: confidence.label,
    score: confidence.score,
  });
}

function candidateAffectedCode(value: unknown): GuardianAffectedCode {
  const affected = exactObject(value, ["source", "location", "explanation"]);
  if (
    affected.source !== "vulnerableSource" &&
    affected.source !== "attackSource" &&
    affected.source !== "fixedSource"
  ) {
    throw new GuardianSecurityApiError("INVALID_RESPONSE");
  }
  return {
    source: affected.source,
    location: trimmedString(affected.location, MAX_LLM_LOCATION_LENGTH),
    explanation: trimmedString(affected.explanation, MAX_LLM_TEXT_ITEM_LENGTH),
  };
}

function candidateEvidence(value: unknown): GuardianLlmCandidateEvidence {
  const evidence = exactObject(value, [
    "source",
    "description",
    "locations",
    "provenance",
  ]);
  if (evidence.provenance !== "llm_candidate") {
    throw new GuardianSecurityApiError("INVALID_RESPONSE");
  }
  return {
    source: trimmedString(evidence.source, MAX_LLM_TEXT_ITEM_LENGTH),
    description: trimmedString(evidence.description, MAX_LLM_TEXT_ITEM_LENGTH),
    locations: stringList(
      evidence.locations,
      MAX_LLM_EVIDENCE_LOCATIONS,
      MAX_LLM_LOCATION_LENGTH,
    ),
    provenance: "llm_candidate",
  };
}

function candidateFinding(value: unknown, index: number): GuardianLlmCandidateFinding {
  const candidate = exactObject(value, [
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
  ]);
  if (
    candidate.candidateId !== `llm-candidate-${index + 1}` ||
    !isOneOf(candidate.category, CANDIDATE_CATEGORIES) ||
    candidate.verification !== "llm_candidate" ||
    !Array.isArray(candidate.affectedCode) ||
    candidate.affectedCode.length > MAX_LLM_AFFECTED_CODE_ITEMS ||
    !Array.isArray(candidate.evidence) ||
    candidate.evidence.length > MAX_LLM_EVIDENCE_ITEMS
  ) {
    throw new GuardianSecurityApiError("INVALID_RESPONSE");
  }
  return {
    candidateId: candidate.candidateId,
    category: candidate.category,
    title: trimmedString(candidate.title, MAX_LLM_TITLE_LENGTH),
    verification: "llm_candidate",
    suggestedSeverity: candidateSeverity(candidate.suggestedSeverity),
    suggestedConfidence: candidateConfidence(candidate.suggestedConfidence),
    explanation: trimmedString(candidate.explanation, MAX_LLM_EXPLANATION_LENGTH),
    attackPath: stringList(candidate.attackPath, MAX_LLM_LIST_ITEMS),
    affectedCode: candidate.affectedCode.map(candidateAffectedCode),
    evidence: candidate.evidence.map(candidateEvidence),
    suggestedFix: stringList(candidate.suggestedFix, MAX_LLM_LIST_ITEMS),
    limitations: stringList(candidate.limitations, MAX_LLM_LIST_ITEMS),
  };
}

function chinesePresentationString(value: unknown, maxLength: number): string {
  const text = trimmedString(value, maxLength);
  if (!/\p{Script=Han}/u.test(text)) {
    throw new GuardianSecurityApiError("INVALID_RESPONSE");
  }
  return text;
}

function candidateBestiarySuggestion(
  value: unknown,
  candidateCount: number,
): GuardianCandidateBestiarySuggestion {
  const suggestion = exactObject(value, [
    "candidateFindingIndex",
    "suggestedPrimaryElement",
    "suggestedSecondaryElements",
    "suggestedCultivationRealm",
    "lore",
    "behavior",
    "attackTechnique",
    "countermeasure",
    "cultivationLesson",
  ]);
  const primary = suggestion.suggestedPrimaryElement;
  const candidateFindingIndex = suggestion.candidateFindingIndex;
  const rawSecondary = suggestion.suggestedSecondaryElements;
  if (
    typeof candidateFindingIndex !== "number" ||
    !Number.isInteger(candidateFindingIndex) ||
    candidateFindingIndex < 0 ||
    candidateFindingIndex >= candidateCount ||
    !isCultivationElement(primary) ||
    !Array.isArray(rawSecondary) ||
    rawSecondary.length > 4 ||
    !rawSecondary.every(isCultivationElement) ||
    new Set(rawSecondary).size !== rawSecondary.length ||
    rawSecondary.includes(primary) ||
    !isCultivationRealm(suggestion.suggestedCultivationRealm) ||
    !Array.isArray(suggestion.behavior) ||
    suggestion.behavior.length === 0
  ) {
    throw new GuardianSecurityApiError("INVALID_RESPONSE");
  }
  const secondary = rawSecondary as readonly typeof primary[];

  return {
    candidateFindingIndex,
    suggestedPrimaryElement: primary,
    suggestedSecondaryElements: secondary,
    suggestedCultivationRealm: suggestion.suggestedCultivationRealm,
    lore: chinesePresentationString(suggestion.lore, MAX_LLM_EXPLANATION_LENGTH),
    behavior: stringList(
      suggestion.behavior,
      MAX_LLM_BESTIARY_BEHAVIOR_ITEMS,
    ).map((item) => chinesePresentationString(item, MAX_LLM_TEXT_ITEM_LENGTH)),
    attackTechnique: chinesePresentationString(
      suggestion.attackTechnique,
      MAX_LLM_TEXT_ITEM_LENGTH,
    ),
    countermeasure: chinesePresentationString(
      suggestion.countermeasure,
      MAX_LLM_TEXT_ITEM_LENGTH,
    ),
    cultivationLesson: chinesePresentationString(
      suggestion.cultivationLesson,
      MAX_LLM_TEXT_ITEM_LENGTH,
    ),
  };
}

function publicLlmEnhancement(value: unknown): GuardianPublicLlmEnhancement {
  const hasSuggestion = isRecord(value) && Object.hasOwn(value, "candidateBestiarySuggestion");
  const enhancement = exactObject(value, [
    "status",
    "candidateFindings",
    "publicSummary",
    "bestiaryNameCandidates",
    ...(hasSuggestion ? ["candidateBestiarySuggestion"] : []),
  ]);
  if (
    enhancement.status !== "enhanced" ||
    !Array.isArray(enhancement.candidateFindings) ||
    enhancement.candidateFindings.length > MAX_LLM_CANDIDATE_FINDINGS ||
    !Array.isArray(enhancement.bestiaryNameCandidates) ||
    enhancement.bestiaryNameCandidates.length !== 4
  ) {
    throw new GuardianSecurityApiError("INVALID_RESPONSE");
  }
  const names = enhancement.bestiaryNameCandidates.map((name) =>
    trimmedString(name, MAX_LLM_BESTIARY_NAME_LENGTH),
  );
  if (new Set(names).size !== 4) {
    throw new GuardianSecurityApiError("INVALID_RESPONSE");
  }
  const [first, second, third, fourth] = names;
  const candidateFindings = enhancement.candidateFindings.map(candidateFinding);
  return {
    status: "enhanced",
    candidateFindings,
    ...(hasSuggestion
      ? {
          candidateBestiarySuggestion: candidateBestiarySuggestion(
            enhancement.candidateBestiarySuggestion,
            candidateFindings.length,
          ),
        }
      : {}),
    publicSummary: trimmedString(
      enhancement.publicSummary,
      MAX_LLM_PUBLIC_SUMMARY_LENGTH,
    ),
    bestiaryNameCandidates: [first, second, third, fourth],
  };
}

function isOneOf<const T extends readonly string[]>(
  value: unknown,
  allowed: T,
): value is T[number] {
  return typeof value === "string" && allowed.includes(value);
}

const PROVENANCE_VALUES = [
  "frozen-repository-evidence",
  "human-reviewed",
  "on-chain-fact",
  "generated-inference",
  "user-provided-unverified",
  "known-limitation",
] as const;
const ELEMENT_VALUES = ["Metal", "Wood", "Water", "Fire", "Earth"] as const;
const REALM_VALUES = [
  "Qi Refining",
  "Foundation Establishment",
  "Core Formation",
  "Nascent Soul",
  "Spirit Transformation",
  "Mahayana",
  "Tribulation",
] as const;
const SEVERITY_VALUES = ["Informational", "Low", "Medium", "High", "Critical"] as const;
const CONFIDENCE_VALUES = ["Low", "Medium", "High"] as const;
const EVIDENCE_LEVEL_VALUES = [
  "PATTERN_MATCHED",
  "ATTACK_STRUCTURE_PRESENT",
  "FIX_CONTRAST_PRESENT",
  "POC_VERIFIED",
  "FIX_VERIFIED",
  "HUMAN_REVIEWED",
] as const;

function isAnalysisStatements(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        isRecord(item) &&
        typeof item.text === "string" &&
        isOneOf(item.provenance, PROVENANCE_VALUES),
    )
  );
}

function hasRenderedAnalysis(value: unknown): boolean {
  return (
    isRecord(value) &&
    value.formalType === "Classic Reentrancy" &&
    value.category === "Reentrancy" &&
    typeof value.rootCause === "string" &&
    isStringArray(value.affectedFunctions) &&
    isStringArray(value.prerequisites) &&
    isStringArray(value.attackPath) &&
    typeof value.impact === "string" &&
    typeof value.repeatability === "string" &&
    typeof value.privilegeRequired === "string" &&
    isStringArray(value.mitigations) &&
    isAnalysisStatements(value.evidence) &&
    isAnalysisStatements(value.inferences) &&
    isAnalysisStatements(value.limitations)
  );
}

function hasRenderedClassification(value: unknown): boolean {
  if (!isRecord(value) || !isRecord(value.elements) || !isRecord(value.realm)) {
    return false;
  }
  const { elements, realm } = value;
  const elementScores = elements.elementScores;
  return (
    isOneOf(elements.primaryElement, ELEMENT_VALUES) &&
    typeof elements.primaryElementLabel === "string" &&
    Array.isArray(elements.secondaryElements) &&
    elements.secondaryElements.every((element) => isOneOf(element, ELEMENT_VALUES)) &&
    isRecord(elementScores) &&
    ELEMENT_VALUES.every((element) => typeof elementScores[element] === "number") &&
    isStringArray(elements.rationale) &&
    isOneOf(realm.realm, REALM_VALUES) &&
    typeof realm.realmLabel === "string" &&
    typeof realm.realmScore === "number" &&
    Array.isArray(realm.complexityFactors) &&
    realm.complexityFactors.every(
      (factor) =>
        isRecord(factor) &&
        typeof factor.id === "string" &&
        typeof factor.matched === "boolean" &&
        typeof factor.points === "number" &&
        typeof factor.explanation === "string",
    ) &&
    isStringArray(realm.rationale)
  );
}

function hasRenderedSeverity(value: unknown): boolean {
  return (
    isRecord(value) &&
    isOneOf(value.level, SEVERITY_VALUES) &&
    typeof value.score === "number" &&
    value.maxScore === 12 &&
    isRecord(value.breakdown) &&
    typeof value.breakdown.impact === "number" &&
    typeof value.breakdown.exploitability === "number" &&
    typeof value.breakdown.repeatability === "number" &&
    typeof value.breakdown.privilegeExposure === "number" &&
    isStringArray(value.rationale)
  );
}

function hasRenderedConfidence(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.score === "number" &&
    isOneOf(value.label, CONFIDENCE_VALUES) &&
    isOneOf(value.evidenceLevel, EVIDENCE_LEVEL_VALUES) &&
    isStringArray(value.supportingFactors) &&
    isStringArray(value.missingEvidence)
  );
}

function hasRenderedBestiary(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.name === "string" &&
    value.formalType === "Classic Reentrancy" &&
    isOneOf(value.primaryElement, ELEMENT_VALUES) &&
    Array.isArray(value.secondaryElements) &&
    value.secondaryElements.every((element) => isOneOf(element, ELEMENT_VALUES)) &&
    isOneOf(value.realm, REALM_VALUES) &&
    isOneOf(value.severity, SEVERITY_VALUES) &&
    isOneOf(value.confidence, CONFIDENCE_VALUES) &&
    typeof value.summary === "string" &&
    isStringArray(value.attackPattern) &&
    isStringArray(value.prerequisites) &&
    typeof value.impact === "string" &&
    isStringArray(value.evidenceSummary) &&
    isStringArray(value.mitigations) &&
    isStringArray(value.knownLimitations) &&
    value.reviewStatus === "draft"
  );
}

function hasRenderedQuest(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.title === "string" &&
    value.formalType === "Classic Reentrancy" &&
    isOneOf(value.realm, REALM_VALUES) &&
    isOneOf(value.primaryElement, ELEMENT_VALUES) &&
    isStringArray(value.learningObjectives) &&
    typeof value.scenario === "string" &&
    isStringArray(value.dangerousCodeFocus) &&
    isStringArray(value.attackReplaySteps) &&
    typeof value.classificationChallenge === "string" &&
    Array.isArray(value.repairSequence) &&
    value.repairSequence.length === 3 &&
    value.repairSequence[0] === "Checks" &&
    value.repairSequence[1] === "Effects" &&
    value.repairSequence[2] === "Interactions" &&
    isStringArray(value.verificationChecklist) &&
    isStringArray(value.evidenceReferences) &&
    isStringArray(value.knownLimitations) &&
    typeof value.rewardDraft === "string" &&
    value.reviewStatus === "draft"
  );
}

export function isGuardianSampleSuccess(value: unknown): value is GuardianSecuritySuccess {
  return (
    isRecord(value) &&
    value.ok === true &&
    value.schemaVersion === "guardian-security-analysis-v1" &&
    value.inputMode === "sample" &&
    isRecord(value.agent) &&
    value.agent.mode === "deterministic-rules" &&
    value.agent.externalModelConnected === false &&
    isRecord(value.mossEvidence) &&
    value.mossEvidence.status === "not-applicable" &&
    value.mossEvidence.reason ===
      "User-provided samples are not registered Guardian quests." &&
    Array.isArray(value.signals) &&
    value.signals.every(
      (signal) =>
        isRecord(signal) &&
        typeof signal.id === "string" &&
        typeof signal.matched === "boolean" &&
        isOneOf(signal.strength, ["weak", "moderate", "strong"] as const) &&
        isOneOf(
          signal.source,
          ["vulnerableSource", "attackSource", "fixedSource", "frozenEvidence"] as const,
        ) &&
        isOneOf(signal.evidenceType, PROVENANCE_VALUES) &&
        typeof signal.explanation === "string",
    ) &&
    hasRenderedAnalysis(value.analysis) &&
    hasRenderedClassification(value.classification) &&
    hasRenderedSeverity(value.severity) &&
    hasRenderedConfidence(value.confidence) &&
    hasRenderedBestiary(value.bestiaryDraft) &&
    hasRenderedQuest(value.questDraft) &&
    isRecord(value.review) &&
    value.review.status === "draft" &&
    value.review.requiresHumanApproval === true &&
    value.review.publishAllowed === false &&
    isStringArray(value.review.reasons) &&
    isStringArray(value.limitations)
  );
}

const DETERMINISTIC_RESPONSE_KEYS = [
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

function parseCandidateOnlyAnalysis(
  value: unknown,
): GuardianCandidateOnlyAnalysisSuccess {
  const response = exactObject(value, [
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
  ]);
  const agent = exactObject(response.agent, ["mode", "externalModelConnected"]);
  const caseValue = exactObject(response.case, [
    "caseId",
    "displayName",
    "provenance",
  ]);
  const submission = exactObject(response.submission, ["allowed", "reason"]);
  const review = exactObject(response.review, [
    "requiresHumanApproval",
    "publishAllowed",
  ]);
  const analyzedAt = trimmedString(response.analyzedAt, 64);
  if (
    !Number.isFinite(Date.parse(analyzedAt)) ||
    new Date(Date.parse(analyzedAt)).toISOString() !== analyzedAt ||
    response.ok !== true ||
    response.schemaVersion !== "guardian-security-candidate-analysis-v1" ||
    response.inputMode !== "sample" ||
    response.deterministic !== null ||
    agent.mode !== "hybrid-llm-candidate" ||
    agent.externalModelConnected !== true ||
    caseValue.caseId !== "user-sample" ||
    caseValue.provenance !== "user-provided-unverified" ||
    submission.allowed !== false ||
    submission.reason !==
      "LLM_CANDIDATE_REQUIRES_SIGNED_DRAFT_OR_VERIFICATION" ||
    review.requiresHumanApproval !== true ||
    review.publishAllowed !== false
  ) {
    throw new GuardianSecurityApiError("INVALID_RESPONSE");
  }
  return {
    ok: true,
    schemaVersion: "guardian-security-candidate-analysis-v1",
    analyzedAt,
    agent: {
      mode: "hybrid-llm-candidate",
      externalModelConnected: true,
    },
    inputMode: "sample",
    case: {
      caseId: "user-sample",
      displayName: trimmedString(
        caseValue.displayName,
        CONTRIBUTION_CASE_NAME_MAX_CHARS,
      ),
      provenance: "user-provided-unverified",
    },
    deterministic: null,
    llmEnhancement: publicLlmEnhancement(response.llmEnhancement),
    submission: {
      allowed: false,
      reason: "LLM_CANDIDATE_REQUIRES_SIGNED_DRAFT_OR_VERIFICATION",
    },
    review: {
      requiresHumanApproval: true,
      publishAllowed: false,
    },
    limitations: stringList(response.limitations, MAX_LLM_LIST_ITEMS),
  };
}

export function parseGuardianHybridPublicResponse(
  value: unknown,
): GuardianHybridPublicResponse {
  if (
    isRecord(value) &&
    value.schemaVersion === "guardian-security-candidate-analysis-v1"
  ) {
    return parseCandidateOnlyAnalysis(value);
  }

  const hasEnhancement = isRecord(value) && Object.hasOwn(value, "llmEnhancement");
  exactObject(
    value,
    hasEnhancement
      ? [...DETERMINISTIC_RESPONSE_KEYS, "llmEnhancement"]
      : DETERMINISTIC_RESPONSE_KEYS,
  );
  if (!isGuardianSampleSuccess(value)) {
    throw new GuardianSecurityApiError("INVALID_RESPONSE");
  }
  if (!hasEnhancement) return value;
  return {
    ...value,
    llmEnhancement: publicLlmEnhancement(value.llmEnhancement),
  };
}

function optionalSource(value: string): string | undefined {
  return value.length > 0 ? value : undefined;
}

export interface GuardianSampleAnalysisResult {
  readonly result: GuardianHybridPublicResponse;
  readonly digest: string | null;
  readonly signedDraft: SignedGuardianDraftV1 | null;
}

export async function analyzeGuardianSample(
  submission: GuardianSampleSubmission,
): Promise<GuardianSampleAnalysisResult> {
  const attackSource = optionalSource(submission.attackSource);
  const fixedSource = optionalSource(submission.fixedSource);
  const response = await fetch("/api/guardian/analyze", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    cache: "no-store",
    body: JSON.stringify({
      mode: "sample",
      sample: {
        name: submission.name.trim(),
        vulnerableSource: submission.vulnerableSource,
        ...(attackSource !== undefined ? { attackSource } : {}),
        ...(fixedSource !== undefined ? { fixedSource } : {}),
      },
    }),
  });

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new GuardianSecurityApiError("INVALID_RESPONSE");
  }

  if (!response.ok) {
    if (isFailure(payload)) {
      throw new GuardianSecurityApiError(payload.error.code);
    }
    throw new GuardianSecurityApiError("INVALID_RESPONSE");
  }

  if (!isRecord(payload)) throw new GuardianSecurityApiError("INVALID_RESPONSE");
  const hasSignedDraft = Object.hasOwn(payload, "signedDraft");
  const basePayload = Object.fromEntries(
    Object.entries(payload).filter(([key]) => key !== "signedDraft"),
  );
  const visibleResult = parseGuardianHybridPublicResponse(basePayload);
  if (
    visibleResult.schemaVersion === "guardian-security-analysis-v1" &&
    visibleResult.mossEvidence.status !== "not-applicable"
  ) {
    throw new GuardianSecurityApiError("UNEXPECTED_MOSS_EVIDENCE");
  }

  let signedDraft: SignedGuardianDraftV1 | null = null;
  if (hasSignedDraft) {
    try {
      signedDraft = parseSignedGuardianDraftV1(
        payload.signedDraft,
        parseGuardianHybridPublicResponse,
      );
    } catch {
      throw new GuardianSecurityApiError("INVALID_RESPONSE");
    }
  }
  if (
    signedDraft !== null &&
    !guardianDraftAnalysisMatchesVisible(
      visibleResult,
      signedDraft.claims.draft.analysis,
    )
  ) {
    throw new GuardianSecurityApiError("INVALID_RESPONSE");
  }

  const digest = response.headers.get("X-Guardian-Analysis-Digest")?.trim() ?? "";
  if (visibleResult.schemaVersion === "guardian-security-candidate-analysis-v1") {
    if (digest.length > 0) throw new GuardianSecurityApiError("INVALID_RESPONSE");
  } else if (!/^[0-9a-f]{64}$/u.test(digest)) {
    throw new GuardianSecurityApiError("INVALID_RESPONSE");
  }

  return {
    result: signedDraft?.claims.draft.analysis ?? visibleResult,
    digest: digest.length > 0 ? digest : null,
    signedDraft,
  };
}
