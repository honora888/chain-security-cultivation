import type {
  GuardianHeuristicFinding,
  GuardianLlmCandidateFinding,
  GuardianVerifiedFinding,
} from "./contracts";

export type HybridGuardianFinding =
  | GuardianVerifiedFinding
  | GuardianHeuristicFinding
  | GuardianLlmCandidateFinding;

export interface HybridGuardianResult {
  readonly verifiedFindings: readonly GuardianVerifiedFinding[];
  readonly heuristicFindings: readonly GuardianHeuristicFinding[];
  readonly candidateFindings: readonly GuardianLlmCandidateFinding[];
  readonly primaryFinding: HybridGuardianFinding | null;
  readonly secondaryFindings: readonly HybridGuardianFinding[];
}