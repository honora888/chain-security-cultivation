import type { GuardianHybridPublicResponse } from "../guardian-llm/hybrid-analysis-types";

export const GUARDIAN_DRAFT_DOMAIN =
  "chain-security-cultivation:guardian-draft:v1" as const;
export const GUARDIAN_SIGNED_DRAFT_SCHEMA_VERSION =
  "guardian-signed-draft-v1" as const;
export const GUARDIAN_DRAFT_MAX_TTL_MS = 15 * 60 * 1_000;
export const GUARDIAN_DRAFT_MAX_FUTURE_SKEW_MS = 60 * 1_000;

export interface GuardianDraftSourceHashesV1 {
  readonly algorithm: "sha256";
  readonly vulnerableSource: string;
  readonly attackSource: string;
  readonly fixedSource: string;
}

export interface GuardianDraftContentV1 {
  readonly analysis: GuardianHybridPublicResponse;
  readonly selectedBestiaryName: string;
}

export interface GuardianDraftClaimsV1 {
  readonly domain: typeof GUARDIAN_DRAFT_DOMAIN;
  readonly schemaVersion: typeof GUARDIAN_SIGNED_DRAFT_SCHEMA_VERSION;
  readonly draftId: string;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly walletAddress: string;
  readonly caseName: string;
  readonly sourceHashes: GuardianDraftSourceHashesV1;
  readonly draft: GuardianDraftContentV1;
}

export interface SignedGuardianDraftV1 {
  readonly claims: GuardianDraftClaimsV1;
  readonly signature: string;
}
