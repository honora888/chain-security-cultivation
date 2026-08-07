import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { AUTH_COOKIE_NAME } from "@/auth/constants";
import { readSession } from "@/auth/server";
import { issueGuardianDraftForAuthenticatedSample } from "@/features/guardian-draft/issuance";
import { runHybridGuardianAnalysis } from "@/features/guardian-llm/hybrid-analysis";
import { createGuardianLlmRuntime } from "@/features/guardian-llm/provider-factory";
import { GuardianSecurityError } from "@/features/guardian-security/analysis-types";
import {
  guardianSecurityFailure,
  parseGuardianSecurityRequest,
  runGuardianSecurityAnalysis,
} from "@/lib/guardian-security-server";
import {
  GUARDIAN_ANALYSIS_DIGEST_HEADER,
  guardianAnalysisDigest,
} from "@/lib/guardian-analysis-digest";
import { GuardianDraftError } from "@/lib/guardian-draft-signing";
import { CONTRIBUTION_CASE_NAME_MAX_CHARS } from "@/contributions/constants";
import { normalizeCaseName } from "@/contributions/normalize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;
const MAX_REQUEST_BODY_BYTES = 1_000_000;
const JSON_CONTENT_TYPE = /^application\/json(?:\s*;.*)?$/i;

function draftSigningFailure(error: GuardianDraftError): NextResponse {
  const notConfigured = error.code === "NOT_CONFIGURED";
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: notConfigured
          ? "DRAFT_SIGNING_NOT_CONFIGURED"
          : "DRAFT_SIGNING_FAILED",
        message: notConfigured
          ? "Guardian 签名草案服务尚未配置。"
          : "Guardian 签名草案暂时无法生成。",
      },
    },
    {
      status: notConfigured ? 503 : 500,
      headers: NO_STORE_HEADERS,
    },
  );
}

async function authenticatedWalletFromSession(): Promise<string | null> {
  const token = (await cookies()).get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;
  const session = await readSession(token);
  return session?.walletAddress ?? null;
}

function canonicalizeSampleName(name: string): string {
  try {
    const canonical = normalizeCaseName(name);
    const length = Array.from(canonical).length;
    if (length < 1 || length > CONTRIBUTION_CASE_NAME_MAX_CHARS) {
      throw new GuardianSecurityError("INVALID_BODY");
    }
    return canonical;
  } catch (error) {
    if (error instanceof GuardianSecurityError) throw error;
    throw new GuardianSecurityError("INVALID_BODY");
  }
}

async function readJsonBody(request: Request): Promise<unknown> {
  const contentType = request.headers.get("content-type")?.trim() ?? "";
  if (!JSON_CONTENT_TYPE.test(contentType)) {
    throw new GuardianSecurityError("INVALID_CONTENT_TYPE");
  }

  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    const parsedLength = Number(contentLength);
    if (
      !Number.isSafeInteger(parsedLength) ||
      parsedLength < 0 ||
      parsedLength > MAX_REQUEST_BODY_BYTES
    ) {
      throw new GuardianSecurityError("SOURCE_TOO_LARGE");
    }
  }

  const text = await request.text();
  if (text.length === 0) {
    throw new GuardianSecurityError("INVALID_JSON");
  }
  if (text.length > MAX_REQUEST_BODY_BYTES) {
    throw new GuardianSecurityError("SOURCE_TOO_LARGE");
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new GuardianSecurityError("INVALID_JSON");
  }
}

export async function POST(request: Request) {
  try {
    const parsedInput = parseGuardianSecurityRequest(await readJsonBody(request));
    const input =
      parsedInput.mode === "sample"
        ? {
            ...parsedInput,
            sample: {
              ...parsedInput.sample,
              name: canonicalizeSampleName(parsedInput.sample.name),
            },
          }
        : parsedInput;

    if (input.mode === "builtin") {
      const result = await runGuardianSecurityAnalysis(input);
      return NextResponse.json(result, {
        status: 200,
        headers: {
          ...NO_STORE_HEADERS,
          [GUARDIAN_ANALYSIS_DIGEST_HEADER]: guardianAnalysisDigest(result),
        },
      });
    }

    const llmRuntime = createGuardianLlmRuntime();
    const outcome = await runHybridGuardianAnalysis({
      request: input,
      mode: llmRuntime.mode,
      provider: llmRuntime.provider,
      runDeterministic: runGuardianSecurityAnalysis,
    });

    if (outcome.kind === "candidate-only") {
      const signedDraft = issueGuardianDraftForAuthenticatedSample({
        analysis: outcome.response,
        authenticatedWallet: await authenticatedWalletFromSession(),
        caseName: input.sample.name,
        vulnerableSource: input.sample.vulnerableSource,
        attackSource: input.sample.attackSource,
        fixedSource: input.sample.fixedSource,
        secret: process.env.GUARDIAN_DRAFT_SIGNING_SECRET,
      });
      return NextResponse.json(
        signedDraft ? { ...outcome.response, signedDraft } : outcome.response,
        {
        status: 200,
        headers: NO_STORE_HEADERS,
        },
      );
    }

    const signedDraft = issueGuardianDraftForAuthenticatedSample({
      analysis: outcome.response,
      authenticatedWallet: await authenticatedWalletFromSession(),
      caseName: input.sample.name,
      vulnerableSource: input.sample.vulnerableSource,
      attackSource: input.sample.attackSource,
      fixedSource: input.sample.fixedSource,
      secret: process.env.GUARDIAN_DRAFT_SIGNING_SECRET,
    });

    return NextResponse.json(signedDraft ? { ...outcome.response, signedDraft } : outcome.response, {
      status: 200,
      headers: {
        ...NO_STORE_HEADERS,
        // The legacy contribution digest continues to bind only the
        // deterministic draft while the additive Signed Draft carries the
        // exact visible hybrid response.
        [GUARDIAN_ANALYSIS_DIGEST_HEADER]: guardianAnalysisDigest(
          outcome.deterministicResult,
        ),
      },
    });
  } catch (error) {
    if (error instanceof GuardianDraftError) {
      return draftSigningFailure(error);
    }
    const failure = guardianSecurityFailure(error);
    return NextResponse.json(failure.body, {
      status: failure.status,
      headers: NO_STORE_HEADERS,
    });
  }
}
