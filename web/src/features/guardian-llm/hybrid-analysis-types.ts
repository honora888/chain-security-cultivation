import type { GuardianSecuritySuccess } from "../guardian-security/analysis-types";

import type {
  GuardianLlmCandidateFinding,
  GuardianLlmResponse,
} from "./contracts";

export interface GuardianPublicLlmEnhancement {
  readonly status: "enhanced";
  readonly candidateFindings: readonly GuardianLlmCandidateFinding[];
  readonly publicSummary: string;
  readonly bestiaryNameCandidates: readonly [string, string, string, string];
}

export type GuardianDeterministicEnhancedSuccess = GuardianSecuritySuccess & {
  readonly llmEnhancement: GuardianPublicLlmEnhancement;
};

export interface GuardianCandidateOnlyAnalysisSuccess {
  readonly ok: true;
  readonly schemaVersion: "guardian-security-candidate-analysis-v1";
  readonly analyzedAt: string;
  readonly agent: {
    readonly mode: "hybrid-llm-candidate";
    readonly externalModelConnected: true;
  };
  readonly inputMode: "sample";
  readonly case: {
    readonly caseId: "user-sample";
    readonly displayName: string;
    readonly provenance: "user-provided-unverified";
  };
  readonly deterministic: null;
  readonly llmEnhancement: GuardianPublicLlmEnhancement;
  readonly submission: {
    readonly allowed: false;
    readonly reason: "LLM_CANDIDATE_REQUIRES_SIGNED_DRAFT_OR_VERIFICATION";
  };
  readonly review: {
    readonly requiresHumanApproval: true;
    readonly publishAllowed: false;
  };
  readonly limitations: readonly string[];
}

export type GuardianHybridPublicResponse =
  | GuardianSecuritySuccess
  | GuardianDeterministicEnhancedSuccess
  | GuardianCandidateOnlyAnalysisSuccess;

export type GuardianHybridAnalysisOutcome =
  | {
      readonly kind: "deterministic";
      readonly response:
        | GuardianSecuritySuccess
        | GuardianDeterministicEnhancedSuccess;
      readonly deterministicResult: GuardianSecuritySuccess;
    }
  | {
      readonly kind: "candidate-only";
      readonly response: GuardianCandidateOnlyAnalysisSuccess;
      readonly deterministicResult: null;
    };

export function toPublicLlmEnhancement(
  response: GuardianLlmResponse,
): GuardianPublicLlmEnhancement {
  return {
    status: "enhanced",
    candidateFindings: response.candidateFindings,
    publicSummary: response.publicSummary,
    bestiaryNameCandidates: response.bestiaryNameCandidates,
  };
}
