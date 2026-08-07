import type { GuardianSecuritySuccess } from "../guardian-security/analysis-types";

import type { GuardianVerifiedFinding } from "./contracts";

export function guardianSecuritySuccessToVerifiedFindings(
  result: GuardianSecuritySuccess,
): readonly GuardianVerifiedFinding[] {
  return [
    {
      findingId: "deterministic-primary-1",
      category: "reentrancy",
      title: result.analysis.formalType,
      verification: "verified",
      severity: result.severity.level,
      confidence: {
        label: result.confidence.label,
        score: result.confidence.score,
      },
      attackPath: result.analysis.attackPath,
      evidence: result.analysis.evidence.map((statement) => ({
        source: statement.provenance,
        description: statement.text,
        locations: [],
      })),
      mitigations: result.analysis.mitigations,
      limitations: [
        ...result.analysis.limitations.map((statement) => statement.text),
        ...result.limitations,
      ],
    },
  ];
}
