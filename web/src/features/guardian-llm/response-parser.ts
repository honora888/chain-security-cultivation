import type {
  GuardianAffectedCode,
  GuardianFindingConfidence,
  GuardianFindingSeverity,
  GuardianLlmCandidateEvidence,
  GuardianLlmCandidateFinding,
  GuardianLlmResponse,
  GuardianVulnerabilityCategory,
} from "./contracts";
import { GuardianLlmProviderError } from "./provider";
import {
  isGuardianConfidenceScore,
  normalizeGuardianSuggestedConfidence,
} from "./confidence";
import {
  MAX_LLM_AFFECTED_CODE_ITEMS,
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
} from "./response-schema";

const RESPONSE_KEYS = [
  "candidateFindings",
  "publicSummary",
  "bestiaryNameCandidates",
];

const CANDIDATE_KEYS = [
  "category",
  "title",
  "suggestedSeverity",
  "suggestedConfidence",
  "explanation",
  "attackPath",
  "affectedCode",
  "evidence",
  "suggestedFix",
  "limitations",
];

const CONFIDENCE_KEYS = ["label", "score"];
const AFFECTED_CODE_KEYS = ["source", "location", "explanation"];
const EVIDENCE_KEYS = ["source", "description", "locations"];

function invalidResponse(): never {
  throw new GuardianLlmProviderError("INVALID_RESPONSE");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseExactObject(
  value: unknown,
  expectedKeys: readonly string[],
): Record<string, unknown> {
  if (!isRecord(value)) {
    return invalidResponse();
  }

  const keys = Object.keys(value);
  if (
    keys.length !== expectedKeys.length ||
    !expectedKeys.every((key) => Object.hasOwn(value, key))
  ) {
    return invalidResponse();
  }

  return value;
}

function parseTrimmedString(value: unknown, maxLength: number): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > maxLength ||
    value.trim() !== value
  ) {
    return invalidResponse();
  }

  return value;
}

function parseStringArray(
  value: unknown,
  maxItems: number,
  maxItemLength = MAX_LLM_TEXT_ITEM_LENGTH,
): readonly string[] {
  if (!Array.isArray(value) || value.length > maxItems) {
    return invalidResponse();
  }

  return value.map((item) => parseTrimmedString(item, maxItemLength));
}

function parseCategory(value: unknown): GuardianVulnerabilityCategory {
  switch (value) {
    case "reentrancy":
    case "access-control":
    case "unchecked-external-call":
    case "delegatecall":
    case "oracle-manipulation":
    case "economic-attack":
    case "signature-replay":
    case "authentication":
    case "denial-of-service":
    case "accounting":
    case "state-logic":
    case "initialization":
    case "upgradeability":
    case "arithmetic":
    case "precision-rounding":
    case "timestamp-dependence":
    case "randomness":
    case "frontrunning-mev":
    case "other":
      return value;
    default:
      return invalidResponse();
  }
}

function parseSeverity(value: unknown): GuardianFindingSeverity {
  switch (value) {
    case "Informational":
    case "Low":
    case "Medium":
    case "High":
    case "Critical":
      return value;
    default:
      return invalidResponse();
  }
}

function parseConfidence(value: unknown): GuardianFindingConfidence {
  const confidence = parseExactObject(value, CONFIDENCE_KEYS);
  const label = confidence.label;

  if (label !== "Low" && label !== "Medium" && label !== "High") {
    return invalidResponse();
  }

  if (!isGuardianConfidenceScore(confidence.score)) {
    return invalidResponse();
  }

  return normalizeGuardianSuggestedConfidence({ label, score: confidence.score });
}

function parseAffectedCode(value: unknown): GuardianAffectedCode {
  const affectedCode = parseExactObject(value, AFFECTED_CODE_KEYS);
  const source = affectedCode.source;

  if (
    source !== "vulnerableSource" &&
    source !== "attackSource" &&
    source !== "fixedSource"
  ) {
    return invalidResponse();
  }

  return {
    source,
    location: parseTrimmedString(
      affectedCode.location,
      MAX_LLM_LOCATION_LENGTH,
    ),
    explanation: parseTrimmedString(
      affectedCode.explanation,
      MAX_LLM_TEXT_ITEM_LENGTH,
    ),
  };
}

function parseEvidence(value: unknown): GuardianLlmCandidateEvidence {
  const evidence = parseExactObject(value, EVIDENCE_KEYS);

  return {
    source: parseTrimmedString(evidence.source, MAX_LLM_TEXT_ITEM_LENGTH),
    description: parseTrimmedString(
      evidence.description,
      MAX_LLM_TEXT_ITEM_LENGTH,
    ),
    locations: parseStringArray(
      evidence.locations,
      MAX_LLM_EVIDENCE_LOCATIONS,
      MAX_LLM_LOCATION_LENGTH,
    ),
    provenance: "llm_candidate",
  };
}

function parseCandidateFinding(
  value: unknown,
  index: number,
): GuardianLlmCandidateFinding {
  const candidate = parseExactObject(value, CANDIDATE_KEYS);

  if (
    !Array.isArray(candidate.affectedCode) ||
    candidate.affectedCode.length > MAX_LLM_AFFECTED_CODE_ITEMS ||
    !Array.isArray(candidate.evidence) ||
    candidate.evidence.length > MAX_LLM_EVIDENCE_ITEMS
  ) {
    return invalidResponse();
  }

  return {
    candidateId: `llm-candidate-${index + 1}`,
    category: parseCategory(candidate.category),
    title: parseTrimmedString(candidate.title, MAX_LLM_TITLE_LENGTH),
    verification: "llm_candidate",
    suggestedSeverity: parseSeverity(candidate.suggestedSeverity),
    suggestedConfidence: parseConfidence(candidate.suggestedConfidence),
    explanation: parseTrimmedString(
      candidate.explanation,
      MAX_LLM_EXPLANATION_LENGTH,
    ),
    attackPath: parseStringArray(candidate.attackPath, MAX_LLM_LIST_ITEMS),
    affectedCode: candidate.affectedCode.map(parseAffectedCode),
    evidence: candidate.evidence.map(parseEvidence),
    suggestedFix: parseStringArray(candidate.suggestedFix, MAX_LLM_LIST_ITEMS),
    limitations: parseStringArray(candidate.limitations, MAX_LLM_LIST_ITEMS),
  };
}

function parseBestiaryNames(
  value: unknown,
): readonly [string, string, string, string] {
  if (!Array.isArray(value) || value.length !== 4) {
    return invalidResponse();
  }

  const names = value.map((name) =>
    parseTrimmedString(name, MAX_LLM_BESTIARY_NAME_LENGTH),
  );
  const uniqueNames = new Set(names);

  if (uniqueNames.size !== 4) {
    return invalidResponse();
  }

  const [first, second, third, fourth] = names;
  return [first, second, third, fourth];
}

export function parseGuardianLlmResponse(value: unknown): GuardianLlmResponse {
  const response = parseExactObject(value, RESPONSE_KEYS);

  if (
    !Array.isArray(response.candidateFindings) ||
    response.candidateFindings.length > MAX_LLM_CANDIDATE_FINDINGS
  ) {
    return invalidResponse();
  }

  return {
    candidateFindings: response.candidateFindings.map(parseCandidateFinding),
    publicSummary: parseTrimmedString(
      response.publicSummary,
      MAX_LLM_PUBLIC_SUMMARY_LENGTH,
    ),
    bestiaryNameCandidates: parseBestiaryNames(
      response.bestiaryNameCandidates,
    ),
  };
}
