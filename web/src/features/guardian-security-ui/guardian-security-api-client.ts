import type {
  GuardianSecurityErrorCode,
  GuardianSecurityFailure,
  GuardianSecuritySuccess,
} from "@/features/guardian-security/analysis-types";

export interface GuardianSampleSubmission {
  name: string;
  vulnerableSource: string;
  attackSource: string;
  fixedSource: string;
}

type GuardianSecurityUiErrorCode =
  | GuardianSecurityErrorCode
  | "INVALID_RESPONSE"
  | "UNEXPECTED_MOSS_EVIDENCE";

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

function optionalSource(value: string): string | undefined {
  return value.trim().length > 0 ? value : undefined;
}

export async function analyzeGuardianSample(
  submission: GuardianSampleSubmission,
): Promise<{ result: GuardianSecuritySuccess; digest: string }> {
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

  if (!isGuardianSampleSuccess(payload)) {
    throw new GuardianSecurityApiError("INVALID_RESPONSE");
  }
  if (payload.mossEvidence.status !== "not-applicable") {
    throw new GuardianSecurityApiError("UNEXPECTED_MOSS_EVIDENCE");
  }

  const digest = response.headers.get("X-Guardian-Analysis-Digest")?.trim() ?? "";
  if (!/^[0-9a-f]{64}$/u.test(digest)) {
    throw new GuardianSecurityApiError("INVALID_RESPONSE");
  }

  return { result: payload, digest };
}
