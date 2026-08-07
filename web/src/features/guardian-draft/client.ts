import {
  CONTRIBUTION_BESTIARY_NAME_MAX_CHARS,
  CONTRIBUTION_CASE_NAME_MAX_CHARS,
} from "@/contributions/constants";

import {
  GUARDIAN_DRAFT_DOMAIN,
  GUARDIAN_DRAFT_MAX_TTL_MS,
  GUARDIAN_SIGNED_DRAFT_SCHEMA_VERSION,
  type GuardianDraftClaimsV1,
} from "./contracts";
import type { GuardianHybridPublicResponse } from "@/features/guardian-llm/hybrid-analysis-types";

const HASH_PATTERN = /^[0-9a-f]{64}$/u;
const DRAFT_ID_PATTERN = /^[A-Za-z0-9_-]{22}$/u;
const SIGNATURE_PATTERN = /^[A-Za-z0-9_-]{43}$/u;
const WALLET_PATTERN = /^0x[0-9a-f]{40}$/u;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f-\u009f]/u;

export interface GuardianDraftBoundInput {
  readonly name: string;
  readonly vulnerableSource: string;
  readonly attackSource: string;
  readonly fixedSource: string;
}

export class GuardianDraftClientError extends Error {
  constructor() {
    super("INVALID_SIGNED_DRAFT");
    this.name = "GuardianDraftClientError";
  }
}

function invalid(): never {
  throw new GuardianDraftClientError();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function exactObject(
  value: unknown,
  expectedKeys: readonly string[],
): Record<string, unknown> {
  if (!isRecord(value)) return invalid();
  const actual = Object.keys(value).sort();
  const expected = [...expectedKeys].sort();
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index])
  ) {
    return invalid();
  }
  return value;
}

function boundedString(value: unknown, maxCharacters: number): string {
  if (typeof value !== "string") return invalid();
  if (
    value.length === 0 ||
    value.trim() !== value ||
    CONTROL_CHARACTER_PATTERN.test(value) ||
    Array.from(value).length > maxCharacters
  ) {
    return invalid();
  }
  return value;
}

function isoTime(value: unknown): { value: string; milliseconds: number } {
  if (typeof value !== "string") return invalid();
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== value) {
    return invalid();
  }
  return { value, milliseconds };
}

export interface ParsedSignedGuardianDraftV1<
  TAnalysis extends GuardianHybridPublicResponse,
> {
  readonly claims: Omit<GuardianDraftClaimsV1, "draft"> & {
    readonly draft: {
      readonly analysis: TAnalysis;
      readonly selectedBestiaryName: string;
    };
  };
  readonly signature: string;
}

export function parseSignedGuardianDraftV1<
  TAnalysis extends GuardianHybridPublicResponse,
>(
  value: unknown,
  parseAnalysis: (analysis: unknown) => TAnalysis,
): ParsedSignedGuardianDraftV1<TAnalysis> {
  const envelope = exactObject(value, ["claims", "signature"]);
  const claims = exactObject(envelope.claims, [
    "domain",
    "schemaVersion",
    "draftId",
    "issuedAt",
    "expiresAt",
    "walletAddress",
    "caseName",
    "sourceHashes",
    "draft",
  ]);
  if (
    claims.domain !== GUARDIAN_DRAFT_DOMAIN ||
    claims.schemaVersion !== GUARDIAN_SIGNED_DRAFT_SCHEMA_VERSION ||
    typeof claims.draftId !== "string" ||
    !DRAFT_ID_PATTERN.test(claims.draftId) ||
    typeof claims.walletAddress !== "string" ||
    !WALLET_PATTERN.test(claims.walletAddress)
  ) {
    return invalid();
  }

  const issuedAt = isoTime(claims.issuedAt);
  const expiresAt = isoTime(claims.expiresAt);
  if (
    expiresAt.milliseconds <= issuedAt.milliseconds ||
    expiresAt.milliseconds - issuedAt.milliseconds > GUARDIAN_DRAFT_MAX_TTL_MS
  ) {
    return invalid();
  }

  const sourceHashes = exactObject(claims.sourceHashes, [
    "algorithm",
    "vulnerableSource",
    "attackSource",
    "fixedSource",
  ]);
  if (
    sourceHashes.algorithm !== "sha256" ||
    typeof sourceHashes.vulnerableSource !== "string" ||
    typeof sourceHashes.attackSource !== "string" ||
    typeof sourceHashes.fixedSource !== "string" ||
    !HASH_PATTERN.test(sourceHashes.vulnerableSource) ||
    !HASH_PATTERN.test(sourceHashes.attackSource) ||
    !HASH_PATTERN.test(sourceHashes.fixedSource)
  ) {
    return invalid();
  }

  const draft = exactObject(claims.draft, ["analysis", "selectedBestiaryName"]);
  const signature =
    typeof envelope.signature === "string" ? envelope.signature : invalid();
  if (!SIGNATURE_PATTERN.test(signature)) return invalid();

  return {
    claims: {
      domain: GUARDIAN_DRAFT_DOMAIN,
      schemaVersion: GUARDIAN_SIGNED_DRAFT_SCHEMA_VERSION,
      draftId: claims.draftId,
      issuedAt: issuedAt.value,
      expiresAt: expiresAt.value,
      walletAddress: claims.walletAddress,
      caseName: boundedString(claims.caseName, CONTRIBUTION_CASE_NAME_MAX_CHARS),
      sourceHashes: {
        algorithm: "sha256",
        vulnerableSource: sourceHashes.vulnerableSource,
        attackSource: sourceHashes.attackSource,
        fixedSource: sourceHashes.fixedSource,
      },
      draft: {
        analysis: parseAnalysis(draft.analysis),
        selectedBestiaryName: boundedString(
          draft.selectedBestiaryName,
          CONTRIBUTION_BESTIARY_NAME_MAX_CHARS,
        ),
      },
    },
    signature,
  };
}

function jsonValuesEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((item, index) => jsonValuesEqual(item, right[index]))
    );
  }
  if (!isRecord(left) || !isRecord(right)) return false;
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key, index) =>
        key === rightKeys[index] && jsonValuesEqual(left[key], right[key]),
    )
  );
}

export function guardianDraftAnalysisMatchesVisible(
  visibleAnalysis: unknown,
  signedAnalysis: unknown,
): boolean {
  return jsonValuesEqual(visibleAnalysis, signedAnalysis);
}

export function guardianDraftInputChanged(
  previous: GuardianDraftBoundInput,
  next: GuardianDraftBoundInput,
): boolean {
  return (
    previous.name !== next.name ||
    previous.vulnerableSource !== next.vulnerableSource ||
    previous.attackSource !== next.attackSource ||
    previous.fixedSource !== next.fixedSource
  );
}
