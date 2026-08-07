import { isCandidateSignedContribution } from "@/contributions/signed-contribution";
import type { ReviewDecision } from "@/reviews/constants";
import { ReviewHttpError } from "@/reviews/http";

export function assertReviewDecisionAllowedForStoredAnalysis(
  analysisJson: unknown,
  decision: ReviewDecision,
): void {
  if (decision === "approved" && isCandidateSignedContribution(analysisJson)) {
    throw new ReviewHttpError("CANDIDATE_REQUIRES_VERIFICATION");
  }
}
