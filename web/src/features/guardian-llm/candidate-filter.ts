import type {
  GuardianLlmCandidateFinding,
  GuardianLlmResponse,
  GuardianVerifiedFinding,
} from "./contracts";

function candidateFingerprint(candidate: GuardianLlmCandidateFinding): string {
  return JSON.stringify({
    category: candidate.category,
    title: candidate.title,
    suggestedSeverity: candidate.suggestedSeverity,
    suggestedConfidence: candidate.suggestedConfidence,
    explanation: candidate.explanation,
    attackPath: candidate.attackPath,
    affectedCode: candidate.affectedCode,
    evidence: candidate.evidence.map((evidence) => ({
      source: evidence.source,
      description: evidence.description,
      locations: evidence.locations,
    })),
    suggestedFix: candidate.suggestedFix,
    limitations: candidate.limitations,
  });
}

export function filterGuardianLlmCandidates(
  response: GuardianLlmResponse,
  verifiedFindings: readonly GuardianVerifiedFinding[],
): GuardianLlmResponse {
  const verifiedCategories = new Set(
    verifiedFindings.map((finding) => finding.category),
  );
  const fingerprints = new Set<string>();
  const retained: { candidate: GuardianLlmCandidateFinding; originalIndex: number }[] = [];

  response.candidateFindings.forEach((candidate, originalIndex) => {
    if (verifiedCategories.has(candidate.category)) return;
    const fingerprint = candidateFingerprint(candidate);
    if (fingerprints.has(fingerprint)) return;
    fingerprints.add(fingerprint);
    retained.push({ candidate, originalIndex });
  });

  const candidateFindings = retained.map(({ candidate }, index) => ({
    ...candidate,
    candidateId: `llm-candidate-${index + 1}`,
    verification: "llm_candidate" as const,
    evidence: candidate.evidence.map((evidence) => ({
      ...evidence,
      provenance: "llm_candidate" as const,
    })),
  }));

  const suggestion = response.candidateBestiarySuggestion;
  const retainedSuggestionIndex = suggestion
    ? retained.findIndex(
        ({ originalIndex }) => originalIndex === suggestion.candidateFindingIndex,
      )
    : -1;

  return {
    candidateFindings,
    ...(suggestion && retainedSuggestionIndex >= 0
      ? {
          candidateBestiarySuggestion: {
            ...suggestion,
            candidateFindingIndex: retainedSuggestionIndex,
          },
        }
      : {}),
    publicSummary:
      retained.length === response.candidateFindings.length
        ? response.publicSummary
        : `Guardian 已过滤 ${response.candidateFindings.length - retained.length} 条重复或与确定性结论重述的候选；当前保留 ${retained.length} 条独立候选供人工复核。`,
    bestiaryNameCandidates: response.bestiaryNameCandidates,
  };
}
