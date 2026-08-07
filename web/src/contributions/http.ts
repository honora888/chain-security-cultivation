import { NextResponse } from "next/server";

import { AuthHttpError } from "@/auth/http";
import { DatabaseConfigurationError } from "@/db/client";
import {
  CONTRIBUTION_CASE_NAME_MAX_CHARS,
  CONTRIBUTION_REQUEST_BODY_MAX_BYTES,
  CONTRIBUTION_SCHEMA_VERSION,
  CONTRIBUTION_SOURCE_MAX_CHARS,
  CONTRIBUTION_TOTAL_SOURCE_MAX_CHARS,
  ContributionHttpError,
} from "@/contributions/constants";
import { normalizeCaseName } from "@/contributions/normalize";
import { GUARDIAN_ANALYSIS_DIGEST_PATTERN } from "@/lib/guardian-analysis-digest";

export function noStoreJson<T>(body: T, status = 200): NextResponse<T> {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function readJsonBody(request: Request): Promise<unknown> {
  const contentType = request.headers.get("content-type")?.trim() ?? "";
  if (!/^application\/json(?:\s*;.*)?$/i.test(contentType)) {
    throw new ContributionHttpError("INVALID_REQUEST");
  }
  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    const parsed = Number(contentLength);
    if (!Number.isSafeInteger(parsed) || parsed < 0) {
      throw new ContributionHttpError("INVALID_REQUEST");
    }
    if (parsed > CONTRIBUTION_REQUEST_BODY_MAX_BYTES) {
      throw new ContributionHttpError("PAYLOAD_TOO_LARGE");
    }
  }

  const text = await request.text();
  if (text.length === 0) {
    throw new ContributionHttpError("INVALID_REQUEST");
  }
  if (new TextEncoder().encode(text).byteLength > CONTRIBUTION_REQUEST_BODY_MAX_BYTES) {
    throw new ContributionHttpError("PAYLOAD_TOO_LARGE");
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ContributionHttpError("INVALID_REQUEST");
  }
}

function exactObject(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ContributionHttpError("INVALID_REQUEST");
  }
  const object = value as Record<string, unknown>;
  const actual = Object.keys(object).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new ContributionHttpError("INVALID_REQUEST");
  }
  return object;
}

function requiredString(value: unknown): string {
  if (typeof value !== "string") {
    throw new ContributionHttpError("INVALID_REQUEST");
  }
  if (value.includes("\u0000")) {
    throw new ContributionHttpError("INVALID_REQUEST");
  }
  return value;
}

export type ContributionInput = {
  caseName: string;
  vulnerableSource: string;
  attackSource: string;
  fixedSource: string;
};

export type SignedContributionInput = ContributionInput & {
  signedDraft: unknown;
};

export type ParsedContributionInput = ContributionInput | SignedContributionInput;

export function hasSignedDraft(input: ParsedContributionInput): input is SignedContributionInput {
  return "signedDraft" in input;
}

export type ContributionCredential =
  | { readonly mode: "signed"; readonly input: SignedContributionInput }
  | { readonly mode: "legacy"; readonly input: ContributionInput; readonly analysisDigest: string };

export function resolveContributionCredential(
  input: ParsedContributionInput,
  rawAnalysisDigest: string | null,
): ContributionCredential {
  const analysisDigest = rawAnalysisDigest?.trim() ?? "";
  if (hasSignedDraft(input)) {
    if (analysisDigest.length > 0) throw new ContributionHttpError("INVALID_REQUEST");
    return { mode: "signed", input };
  }
  if (!GUARDIAN_ANALYSIS_DIGEST_PATTERN.test(analysisDigest)) {
    throw new ContributionHttpError("INVALID_REQUEST");
  }
  return { mode: "legacy", input, analysisDigest };
}

export function parseContributionInput(value: unknown): ParsedContributionInput {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ContributionHttpError("INVALID_REQUEST");
  }
  const hasDraft = Object.hasOwn(value, "signedDraft");
  const object = exactObject(value, [
    "caseName",
    "vulnerableSource",
    "attackSource",
    "fixedSource",
    ...(hasDraft ? ["signedDraft"] : []),
  ]);
  const caseName = normalizeCaseName(requiredString(object.caseName));
  const vulnerableSource = requiredString(object.vulnerableSource);
  const attackSource = requiredString(object.attackSource);
  const fixedSource = requiredString(object.fixedSource);

  if (Array.from(caseName).length < 1 || Array.from(caseName).length > CONTRIBUTION_CASE_NAME_MAX_CHARS) {
    throw new ContributionHttpError("INVALID_REQUEST");
  }
  const sourceLengths = [vulnerableSource.length, attackSource.length, fixedSource.length];
  if (vulnerableSource.length < 1) {
    throw new ContributionHttpError("INVALID_REQUEST");
  }
  if (sourceLengths.some((length) => length > CONTRIBUTION_SOURCE_MAX_CHARS)) {
    throw new ContributionHttpError("PAYLOAD_TOO_LARGE");
  }
  if (sourceLengths.reduce((total, length) => total + length, 0) > CONTRIBUTION_TOTAL_SOURCE_MAX_CHARS) {
    throw new ContributionHttpError("PAYLOAD_TOO_LARGE");
  }

  const input: ContributionInput = {
    caseName,
    vulnerableSource,
    attackSource,
    fixedSource,
  };
  return hasDraft ? { ...input, signedDraft: object.signedDraft } : input;
}

export function contributionErrorResponse(error: unknown): NextResponse {
  const mapped = mapContributionError(error);
  return noStoreJson(
    {
      ok: false,
      schemaVersion: CONTRIBUTION_SCHEMA_VERSION,
      error: { code: mapped.code, message: mapped.message },
    },
    mapped.status,
  );
}

export function mapContributionError(error: unknown): ContributionHttpError {
  if (error instanceof ContributionHttpError) return error;
  if (error instanceof AuthHttpError) {
    if (error.code === "DATABASE_NOT_CONFIGURED") return new ContributionHttpError("DATABASE_NOT_CONFIGURED");
    if (error.code === "DATABASE_UNAVAILABLE") return new ContributionHttpError("DATABASE_UNAVAILABLE");
    return new ContributionHttpError("AUTH_REQUIRED");
  }
  if (error instanceof DatabaseConfigurationError) return new ContributionHttpError("DATABASE_NOT_CONFIGURED");
  return new ContributionHttpError("DATABASE_UNAVAILABLE");
}
