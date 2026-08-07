import { isCandidateSignedContribution } from "@/contributions/signed-contribution";
import type { ReviewDecision } from "@/reviews/constants";
import { ReviewHttpError } from "@/reviews/http";
import type { ReviewerFormalClassification } from "@/reviews/formal-classification";

export function assertReviewDecisionAllowedForStoredAnalysis(
  analysisJson: unknown,
  decision: ReviewDecision,
  classification: ReviewerFormalClassification | null = null,
): void {
  if (
    decision === "approved" &&
    isCandidateSignedContribution(analysisJson) &&
    classification === null
  ) {
    throw new ReviewHttpError("CANDIDATE_REQUIRES_VERIFICATION");
  }
}
