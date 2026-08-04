import type {
  ConfidenceAssessment,
  MossEvidence,
  ReentrancySignal,
  SeverityAssessment,
  SeverityLevel,
} from "./analysis-types";
import { signalMatched } from "./reentrancy-rules";

function severityLevel(score: number): SeverityLevel {
  if (score <= 2) return "Informational";
  if (score <= 4) return "Low";
  if (score <= 7) return "Medium";
  if (score <= 10) return "High";
  return "Critical";
}

export function assessSeverity(
  signals: readonly ReentrancySignal[],
): SeverityAssessment {
  const hasValueFlow = signalMatched(signals, "fund-flow");
  const hasMismatch = signalMatched(
    signals,
    "state-update-after-external-call",
  );
  const hasCallback = signalMatched(signals, "callback-entry");
  const hasReentry = signalMatched(signals, "callback-reentry");
  const hasAccessSignal = signalMatched(signals, "access-control");

  const impact = hasValueFlow && hasMismatch ? 4 : hasValueFlow ? 2 : 1;
  const exploitability =
    hasCallback && hasReentry && hasMismatch
      ? 4
      : hasMismatch
        ? 3
        : hasCallback
          ? 2
          : 1;
  const repeatability = hasReentry ? 2 : hasCallback ? 1 : 0;
  const privilegeExposure = hasAccessSignal ? 1 : 0;
  const score = impact + exploitability + repeatability + privilegeExposure;

  return {
    level: severityLevel(score),
    score,
    maxScore: 12,
    breakdown: {
      impact,
      exploitability,
      repeatability,
      privilegeExposure,
    },
    rationale: [
      `Impact ${impact}/4 reflects native-fund flow and the possible accounting mismatch.`,
      `Exploitability ${exploitability}/4 reflects the observed callback, re-entry, and ordering structure.`,
      `Repeatability ${repeatability}/2 reflects whether the callback can invoke the target repeatedly.`,
      `Privilege exposure ${privilegeExposure}/2 is scored independently from the fund-loss path.`,
    ],
  };
}

export function assessConfidence(
  signals: readonly ReentrancySignal[],
  inputMode: "builtin" | "sample",
  mossEvidence: MossEvidence,
): ConfidenceAssessment {
  const factors: readonly [string, boolean, number][] = [
    [
      "Strong vulnerable-source pattern quality",
      signalMatched(signals, "external-native-value-call") &&
        signalMatched(signals, "state-update-after-external-call"),
      15,
    ],
    ["Callback structure present", signalMatched(signals, "callback-entry"), 15],
    ["Callback re-entry present", signalMatched(signals, "callback-reentry"), 15],
    [
      "Fixed-code ordering contrast present",
      signalMatched(signals, "fixed-state-before-call"),
      15,
    ],
    ["Verified attack test", signalMatched(signals, "verified-attack-test"), 10],
    [
      "Verified fixed regression",
      signalMatched(signals, "verified-fixed-regression"),
      10,
    ],
    ["Verified invariant evidence", signalMatched(signals, "verified-invariant"), 5],
    [
      "Verified Slither contrast",
      signalMatched(signals, "verified-slither-contrast"),
      5,
    ],
    ["Fixed commit and content hash", inputMode === "builtin", 5],
    [
      "Human-reviewed frozen conclusion",
      signalMatched(signals, "verified-human-conclusion"),
      3,
    ],
    ["Moss registered-content identity match", mossEvidence.status === "verified", 2],
  ];
  const supportingFactors = factors
    .filter(([, matched]) => matched)
    .map(([name]) => name);
  const missingEvidence = factors
    .filter(([, matched]) => !matched)
    .map(([name]) => name);
  const score = factors.reduce(
    (total, [, matched, points]) => total + (matched ? points : 0),
    0,
  );
  const label = score >= 80 ? "High" : score >= 50 ? "Medium" : "Low";

  let evidenceLevel: ConfidenceAssessment["evidenceLevel"] =
    "PATTERN_MATCHED";
  if (
    signalMatched(signals, "callback-entry") &&
    signalMatched(signals, "callback-reentry")
  ) {
    evidenceLevel = "ATTACK_STRUCTURE_PRESENT";
  }
  if (signalMatched(signals, "fixed-state-before-call")) {
    evidenceLevel = "FIX_CONTRAST_PRESENT";
  }
  if (inputMode === "builtin" && signalMatched(signals, "verified-attack-test")) {
    evidenceLevel = "POC_VERIFIED";
  }
  if (
    inputMode === "builtin" &&
    signalMatched(signals, "verified-fixed-regression")
  ) {
    evidenceLevel = "FIX_VERIFIED";
  }
  if (
    inputMode === "builtin" &&
    mossEvidence.status === "verified" &&
    signalMatched(signals, "verified-human-conclusion")
  ) {
    evidenceLevel = "HUMAN_REVIEWED";
  }

  return { score, label, evidenceLevel, supportingFactors, missingEvidence };
}
