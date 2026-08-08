import "server-only";

import {
  GuardianSecurityError,
  type GuardianSecurityRequest,
  type GuardianSecuritySuccess,
} from "../guardian-security/analysis-types";

import type { GuardianLlmMode } from "./config";
import type { GuardianLlmProvider } from "./provider";
import { filterGuardianLlmCandidates } from "./candidate-filter";
import { runGuardianLlmEnhancement } from "./runner";
import {
  type GuardianCandidateOnlyAnalysisSuccess,
  type GuardianExternalModelSkippedStatus,
  type GuardianHybridAnalysisOutcome,
  toPublicLlmEnhancement,
} from "./hybrid-analysis-types";
import { guardianSecuritySuccessToVerifiedFindings } from "./verified-finding-adapter";

export type RunDeterministicGuardianAnalysis = (
  request: GuardianSecurityRequest,
) => Promise<GuardianSecuritySuccess>;

export interface RunHybridGuardianAnalysisOptions {
  readonly request: GuardianSecurityRequest;
  readonly mode: GuardianLlmMode;
  readonly provider?: GuardianLlmProvider;
  readonly runDeterministic: RunDeterministicGuardianAnalysis;
  readonly now?: () => Date;
}

const SENSITIVE_SOURCE_SKIPPED = {
  status: "skipped",
  reason: "SENSITIVE_SOURCE",
} as const satisfies GuardianExternalModelSkippedStatus;
const SENSITIVE_SOURCE_ERRORS = new WeakSet<GuardianSecurityError>();

export function externalModelStatusForHybridError(
  error: unknown,
): GuardianExternalModelSkippedStatus | null {
  return error instanceof GuardianSecurityError && SENSITIVE_SOURCE_ERRORS.has(error)
    ? SENSITIVE_SOURCE_SKIPPED
    : null;
}

function llmRequestForSample(
  request: Extract<GuardianSecurityRequest, { mode: "sample" }>,
  verifiedFindings: ReturnType<
    typeof guardianSecuritySuccessToVerifiedFindings
  >,
) {
  return {
    schemaVersion: "guardian-llm-request-v1",
    verifiedFindings,
    untrustedSources: {
      vulnerableSource: request.sample.vulnerableSource,
      ...(request.sample.attackSource !== undefined
        ? { attackSource: request.sample.attackSource }
        : {}),
      ...(request.sample.fixedSource !== undefined
        ? { fixedSource: request.sample.fixedSource }
        : {}),
    },
  } as const;
}

function candidateOnlyResponse(
  displayName: string,
  response: Parameters<typeof toPublicLlmEnhancement>[0],
  analyzedAt: string,
): GuardianCandidateOnlyAnalysisSuccess {
  return {
    ok: true,
    schemaVersion: "guardian-security-candidate-analysis-v1",
    analyzedAt,
    agent: {
      mode: "hybrid-llm-candidate",
      externalModelConnected: true,
    },
    inputMode: "sample",
    case: {
      caseId: "user-sample",
      displayName,
      provenance: "user-provided-unverified",
    },
    deterministic: null,
    llmEnhancement: toPublicLlmEnhancement(response),
    submission: {
      allowed: false,
      reason: "LLM_CANDIDATE_REQUIRES_SIGNED_DRAFT_OR_VERIFICATION",
    },
    review: {
      requiresHumanApproval: true,
      publishAllowed: false,
    },
    limitations: [
      "此发现由外部模型生成，尚未经过确定性验证。",
      "当前属性、境界、严重度与置信度均为 Guardian 候选建议，不构成正式分类。",
      "Guardian 签名草案已绑定本次分析内容，可提交人工审核。",
      "只有审核员完成人工鉴定后，候选异兽才能正式收录《异兽志》。",
    ],
  };
}

export async function runHybridGuardianAnalysis(
  options: RunHybridGuardianAnalysisOptions,
): Promise<GuardianHybridAnalysisOutcome> {
  if (options.request.mode === "builtin") {
    const deterministicResult = await options.runDeterministic(options.request);
    return {
      kind: "deterministic",
      response: deterministicResult,
      deterministicResult,
    };
  }

  let deterministicResult: GuardianSecuritySuccess;
  try {
    deterministicResult = await options.runDeterministic(options.request);
  } catch (error: unknown) {
    if (
      !(error instanceof GuardianSecurityError) ||
      error.code !== "UNSUPPORTED_VULNERABILITY"
    ) {
      throw error;
    }

    const llmResult = await runGuardianLlmEnhancement({
      mode: options.mode,
      input: llmRequestForSample(options.request, []),
      provider: options.provider,
    });

    if (llmResult.status !== "enhanced") {
      if (
        llmResult.status === "fallback" &&
        llmResult.errorCode === "SENSITIVE_SOURCE"
      ) {
        SENSITIVE_SOURCE_ERRORS.add(error);
      }
      throw error;
    }

    const filteredResponse = filterGuardianLlmCandidates(llmResult.response, []);

    return {
      kind: "candidate-only",
      response: candidateOnlyResponse(
        options.request.sample.name,
        filteredResponse,
        (options.now ?? (() => new Date()))().toISOString(),
      ),
      deterministicResult: null,
    };
  }

  const llmResult = await runGuardianLlmEnhancement({
    mode: options.mode,
    input: llmRequestForSample(
      options.request,
      guardianSecuritySuccessToVerifiedFindings(deterministicResult),
    ),
    provider: options.provider,
  });

  if (llmResult.status !== "enhanced") {
    return {
      kind: "deterministic",
      response: deterministicResult,
      deterministicResult,
      ...(llmResult.status === "fallback" &&
      llmResult.errorCode === "SENSITIVE_SOURCE"
        ? { externalModel: SENSITIVE_SOURCE_SKIPPED }
        : {}),
    };
  }

  const verifiedFindings = guardianSecuritySuccessToVerifiedFindings(deterministicResult);
  const filteredResponse = filterGuardianLlmCandidates(
    llmResult.response,
    verifiedFindings,
  );

  if (filteredResponse.candidateFindings.length === 0) {
    return {
      kind: "deterministic",
      response: deterministicResult,
      deterministicResult,
    };
  }

  return {
    kind: "deterministic",
    response: {
      ...deterministicResult,
      llmEnhancement: toPublicLlmEnhancement(filteredResponse),
    },
    deterministicResult,
  };
}
