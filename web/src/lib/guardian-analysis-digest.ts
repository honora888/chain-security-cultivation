import { createHash } from "node:crypto";

import type { GuardianSecuritySuccess } from "@/features/guardian-security/analysis-types";

export const GUARDIAN_ANALYSIS_DIGEST_HEADER = "X-Guardian-Analysis-Digest";
export const GUARDIAN_ANALYSIS_DIGEST_PATTERN = /^[0-9a-f]{64}$/u;

/** Excludes the observation timestamp while binding every substantive draft field. */
export function guardianAnalysisDigest(result: GuardianSecuritySuccess): string {
  return createHash("sha256")
    .update(JSON.stringify(result, (key, value: unknown) =>
      key === "analyzedAt" ? undefined : value), "utf8")
    .digest("hex");
}
