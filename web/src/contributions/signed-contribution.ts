import {
  CONTRIBUTION_RESERVED_BESTIARY_NAMES,
  ContributionHttpError,
} from "@/contributions/constants";
import type { SignedContributionInput } from "@/contributions/http";
import { normalizeBestiaryName, normalizeSourceForHash } from "@/contributions/normalize";
import type { SignedGuardianDraftV1 } from "@/features/guardian-draft/contracts";
import type { GuardianCandidateOnlyAnalysisSuccess } from "@/features/guardian-llm/hybrid-analysis-types";
import {
  GuardianDraftError,
  verifySignedGuardianDraftV1,
} from "@/lib/guardian-draft-signing";
import { hashSecret } from "@/auth/crypto";

export const SIGNED_CONTRIBUTION_SCHEMA_VERSION =
  "guardian-signed-contribution-v1" as const;

export interface SignedContributionPersistence {
  readonly schemaVersion: typeof SIGNED_CONTRIBUTION_SCHEMA_VERSION;
  readonly signedDraft: SignedGuardianDraftV1;
}

export interface PreparedSignedContribution {
  readonly caseHash: string;
  readonly caseName: string;
  readonly contributorAddress: string;
  readonly vulnerableSource: string;
  readonly attackSource: string;
  readonly fixedSource: string;
  readonly proposedBestiaryName: string;
  readonly normalizedBestiaryName: string;
  readonly storedAnalysis: SignedContributionPersistence;
  readonly formalType: string | null;
  readonly primaryElement: string | null;
  readonly secondaryElements: readonly string[];
  readonly severityLabel: string | null;
  readonly severityScore: number | null;
  readonly confidenceLabel: string | null;
  readonly confidenceScore: number | null;
}

const DRAFT_ERROR_CODES = {
  NOT_CONFIGURED: "DRAFT_SIGNING_NOT_CONFIGURED",
  MALFORMED: "SIGNED_DRAFT_MALFORMED",
  SIGNATURE_MALFORMED: "SIGNED_DRAFT_SIGNATURE_MALFORMED",
  SIGNATURE_INVALID: "SIGNED_DRAFT_SIGNATURE_INVALID",
  WALLET_MISMATCH: "SIGNED_DRAFT_WALLET_MISMATCH",
  EXPIRED: "SIGNED_DRAFT_EXPIRED",
  SOURCE_MISMATCH: "SIGNED_DRAFT_SOURCE_MISMATCH",
  CASE_NAME_MISMATCH: "SIGNED_DRAFT_CASE_NAME_MISMATCH",
  VERSION_UNSUPPORTED: "SIGNED_DRAFT_VERSION_UNSUPPORTED",
  INVALID_TIME: "SIGNED_DRAFT_MALFORMED",
} as const;

export function isSignedContributionPersistence(
  value: unknown,
): value is SignedContributionPersistence {
  return Boolean(
    typeof value === "object" &&
      value !== null &&
      !Array.isArray(value) &&
      Object.keys(value).length === 2 &&
      "schemaVersion" in value &&
      value.schemaVersion === SIGNED_CONTRIBUTION_SCHEMA_VERSION &&
      "signedDraft" in value &&
      typeof value.signedDraft === "object" &&
      value.signedDraft !== null,
  );
}

export function signedCandidateAnalysis(
  value: unknown,
): GuardianCandidateOnlyAnalysisSuccess | null {
  if (!isSignedContributionPersistence(value)) return null;
  const draft = value.signedDraft as unknown as Record<string, unknown>;
  const claims = draft.claims;
  if (typeof claims !== "object" || claims === null || Array.isArray(claims)) return null;
  const content = (claims as Record<string, unknown>).draft;
  if (typeof content !== "object" || content === null || Array.isArray(content)) return null;
  const analysis = (content as Record<string, unknown>).analysis;
  if (
    typeof analysis !== "object" ||
    analysis === null ||
    Array.isArray(analysis) ||
    (analysis as Record<string, unknown>).schemaVersion !==
      "guardian-security-candidate-analysis-v1"
  ) return null;
  return analysis as GuardianCandidateOnlyAnalysisSuccess;
}

export function isCandidateSignedContribution(value: unknown): boolean {
  return signedCandidateAnalysis(value) !== null;
}

export function prepareSignedContribution(input: {
  readonly submission: SignedContributionInput;
  readonly authenticatedWallet: string;
  readonly secret: string | null | undefined;
  readonly now?: () => Date;
}): PreparedSignedContribution {
  let signedDraft: SignedGuardianDraftV1;
  try {
    signedDraft = verifySignedGuardianDraftV1({
      value: input.submission.signedDraft,
      authenticatedWallet: input.authenticatedWallet,
      caseName: input.submission.caseName,
      vulnerableSource: input.submission.vulnerableSource,
      attackSource: input.submission.attackSource,
      fixedSource: input.submission.fixedSource,
      secret: input.secret,
      now: input.now,
    });
  } catch (error) {
    if (error instanceof GuardianDraftError) {
      throw new ContributionHttpError(DRAFT_ERROR_CODES[error.code]);
    }
    throw new ContributionHttpError("SIGNED_DRAFT_MALFORMED");
  }

  const proposedBestiaryName = signedDraft.claims.draft.selectedBestiaryName;
  const normalizedBestiaryName = normalizeBestiaryName(proposedBestiaryName);
  if (CONTRIBUTION_RESERVED_BESTIARY_NAMES.has(normalizedBestiaryName)) {
    throw new ContributionHttpError("BESTIARY_NAME_UNAVAILABLE");
  }
  const normalizedSources = [
    normalizeSourceForHash(input.submission.vulnerableSource),
    normalizeSourceForHash(input.submission.attackSource),
    normalizeSourceForHash(input.submission.fixedSource),
  ];
  const signedAnalysis = signedDraft.claims.draft.analysis;
  const candidateOnly = signedAnalysis.schemaVersion === "guardian-security-candidate-analysis-v1";

  return {
    caseHash: hashSecret(JSON.stringify(normalizedSources)),
    caseName: signedDraft.claims.caseName,
    contributorAddress: input.authenticatedWallet.toLowerCase(),
    vulnerableSource: input.submission.vulnerableSource,
    attackSource: input.submission.attackSource,
    fixedSource: input.submission.fixedSource,
    proposedBestiaryName,
    normalizedBestiaryName,
    storedAnalysis: {
      schemaVersion: SIGNED_CONTRIBUTION_SCHEMA_VERSION,
      signedDraft,
    },
    formalType: candidateOnly ? null : signedAnalysis.analysis.formalType,
    primaryElement: candidateOnly ? null : signedAnalysis.classification.elements.primaryElement,
    secondaryElements: candidateOnly ? [] : signedAnalysis.classification.elements.secondaryElements,
    severityLabel: candidateOnly ? null : signedAnalysis.severity.level,
    severityScore: candidateOnly ? null : signedAnalysis.severity.score,
    confidenceLabel: candidateOnly ? null : signedAnalysis.confidence.label,
    confidenceScore: candidateOnly ? null : signedAnalysis.confidence.score,
  };
}
