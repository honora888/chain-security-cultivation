import type {
  GuardianFindingConfidence,
  GuardianFindingSeverity,
} from "./contracts";
import {
  GUARDIAN_CONFIDENCE_MAX_SCORE,
  GUARDIAN_CONFIDENCE_MIN_SCORE,
} from "./response-schema";

export type GuardianConfidenceLabel = GuardianFindingConfidence["label"];

export function isGuardianConfidenceLabel(
  value: unknown,
): value is GuardianConfidenceLabel {
  return value === "Low" || value === "Medium" || value === "High";
}

/**
 * Candidate confidence uses the same percentage-like 0–100 scale as the
 * deterministic confidence assessment. This remains an LLM suggestion only.
 */
export function isGuardianConfidenceScore(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= GUARDIAN_CONFIDENCE_MIN_SCORE &&
    value <= GUARDIAN_CONFIDENCE_MAX_SCORE
  );
}

export function guardianConfidenceLabelForScore(
  score: number,
): GuardianConfidenceLabel {
  if (!isGuardianConfidenceScore(score)) {
    throw new RangeError("Guardian confidence score is outside the 0–100 scale.");
  }

  if (score >= 80) return "High";
  if (score >= 50) return "Medium";
  return "Low";
}

/**
 * The provider label is deliberately ignored after its enum shape is checked.
 * A numeric score has one canonical semantic label, preventing combinations
 * such as High · 1 / 100 without discarding an otherwise useful candidate.
 */
export function normalizeGuardianSuggestedConfidence(
  confidence: GuardianFindingConfidence,
): GuardianFindingConfidence {
  return {
    label: guardianConfidenceLabelForScore(confidence.score),
    score: confidence.score,
  };
}

export function guardianConfidenceLabelZh(label: GuardianConfidenceLabel): string {
  switch (label) {
    case "High":
      return "高";
    case "Medium":
      return "中";
    case "Low":
      return "低";
  }
}

export function isGuardianFindingSeverity(
  value: unknown,
): value is GuardianFindingSeverity {
  return (
    value === "Informational" ||
    value === "Low" ||
    value === "Medium" ||
    value === "High" ||
    value === "Critical"
  );
}

export function guardianFindingSeverityLabelZh(
  severity: GuardianFindingSeverity,
): string {
  switch (severity) {
    case "Informational": return "信息";
    case "Low": return "低";
    case "Medium": return "中";
    case "High": return "高";
    case "Critical": return "严重";
  }
}
