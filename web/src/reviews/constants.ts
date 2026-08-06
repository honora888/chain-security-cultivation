export const REVIEW_SCHEMA_VERSION = "contribution-review-v1" as const;
export const REVIEW_BODY_MAX_BYTES = 32 * 1024;
export const REVIEW_LIST_LIMIT = 100;
export const REVIEW_SUMMARY_MAX_CHARS = 500;
export const REVIEW_NOTES_MAX_CHARS = 4_000;

export const REVIEW_STATUS_VALUES = [
  "pending_review",
  "changes_requested",
  "approved",
  "rejected",
] as const;

export type ReviewCaseStatus = (typeof REVIEW_STATUS_VALUES)[number];
export type ReviewDecision = "approved" | "changes_requested" | "rejected";

export const REVIEW_SCORE_LIMITS = {
  evidenceQuality: 25,
  reproducibility: 25,
  technicalAccuracy: 20,
  remediationQuality: 20,
  contributionValue: 10,
} as const;

export const REVIEW_CASE_ID_PATTERN =
  /^case-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const REVIEW_IDEMPOTENCY_PREFIX = "case-review-approved:";
