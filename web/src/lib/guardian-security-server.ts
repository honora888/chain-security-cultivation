import "server-only";

import {
  GuardianSecurityError,
  type GuardianSampleInput,
  type GuardianSecurityErrorCode,
  type GuardianSecurityFailure,
  type GuardianSecurityRequest,
  type GuardianSecuritySuccess,
  type MossNotApplicableEvidence,
} from "@/features/guardian-security/analysis-types";
import { analyzeGuardianSecurityCase } from "@/features/guardian-security/analyze";
import { queryBuiltinGuardianEvidence } from "@/lib/guardian-security-moss-evidence";

const MAX_NAME_LENGTH = 100;
const MAX_SOURCE_LENGTH = 50_000;
const MAX_TOTAL_SOURCE_LENGTH = 120_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function hasExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
): boolean {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return (
    actual.length === sortedExpected.length &&
    actual.every((key, index) => key === sortedExpected[index])
  );
}

function parseSample(value: unknown): GuardianSampleInput {
  if (!isRecord(value)) {
    throw new GuardianSecurityError("INVALID_BODY");
  }

  const permitted = [
    "name",
    "vulnerableSource",
    "attackSource",
    "fixedSource",
  ] as const;
  if (Object.keys(value).some((key) => !permitted.includes(key as never))) {
    throw new GuardianSecurityError("INVALID_BODY");
  }
  if (!Object.hasOwn(value, "name") || !Object.hasOwn(value, "vulnerableSource")) {
    throw new GuardianSecurityError("INVALID_BODY");
  }

  const name = typeof value.name === "string" ? value.name.trim() : "";
  if (name.length < 1 || name.length > MAX_NAME_LENGTH) {
    throw new GuardianSecurityError("INVALID_BODY");
  }
  if (
    typeof value.vulnerableSource !== "string" ||
    value.vulnerableSource.length < 1
  ) {
    throw new GuardianSecurityError("INVALID_BODY");
  }
  if (
    (value.attackSource !== undefined &&
      typeof value.attackSource !== "string") ||
    (value.fixedSource !== undefined && typeof value.fixedSource !== "string")
  ) {
    throw new GuardianSecurityError("INVALID_BODY");
  }

  const attackSource = value.attackSource as string | undefined;
  const fixedSource = value.fixedSource as string | undefined;
  const sourceLengths = [
    value.vulnerableSource.length,
    attackSource?.length ?? 0,
    fixedSource?.length ?? 0,
  ];
  if (
    sourceLengths.some((length) => length > MAX_SOURCE_LENGTH) ||
    sourceLengths.reduce((total, length) => total + length, 0) >
      MAX_TOTAL_SOURCE_LENGTH
  ) {
    throw new GuardianSecurityError("SOURCE_TOO_LARGE");
  }

  return {
    name,
    vulnerableSource: value.vulnerableSource,
    ...(attackSource !== undefined ? { attackSource } : {}),
    ...(fixedSource !== undefined ? { fixedSource } : {}),
  };
}

export function parseGuardianSecurityRequest(
  body: unknown,
): GuardianSecurityRequest {
  if (!isRecord(body) || typeof body.mode !== "string") {
    throw new GuardianSecurityError("INVALID_BODY");
  }

  if (body.mode === "builtin") {
    if (!hasExactKeys(body, ["mode", "caseId"])) {
      throw new GuardianSecurityError("INVALID_BODY");
    }
    if (body.caseId !== "quest-1-reentrancy") {
      throw new GuardianSecurityError("UNSUPPORTED_CASE");
    }
    return { mode: "builtin", caseId: "quest-1-reentrancy" };
  }

  if (body.mode === "sample") {
    if (!hasExactKeys(body, ["mode", "sample"])) {
      throw new GuardianSecurityError("INVALID_BODY");
    }
    return { mode: "sample", sample: parseSample(body.sample) };
  }

  throw new GuardianSecurityError("INVALID_BODY");
}

export async function runGuardianSecurityAnalysis(
  request: GuardianSecurityRequest,
): Promise<GuardianSecuritySuccess> {
  if (request.mode === "builtin") {
    const mossEvidence = await queryBuiltinGuardianEvidence();
    return analyzeGuardianSecurityCase(request, mossEvidence);
  }

  const mossEvidence: MossNotApplicableEvidence = {
    status: "not-applicable",
    reason: "User-provided samples are not registered Guardian quests.",
  };
  return analyzeGuardianSecurityCase(request, mossEvidence);
}

export function publicMessageForGuardianSecurityCode(
  code: GuardianSecurityErrorCode,
): string {
  switch (code) {
    case "INVALID_CONTENT_TYPE":
      return "请求必须使用 application/json。";
    case "INVALID_JSON":
      return "请求体不是有效 JSON。";
    case "INVALID_BODY":
      return "请求体不符合 Guardian Security Agent 的严格格式。";
    case "UNSUPPORTED_CASE":
      return "当前只支持内置案例 quest-1-reentrancy。";
    case "SOURCE_TOO_LARGE":
      return "源码文本超过允许的长度限制。";
    case "UNSUPPORTED_VULNERABILITY":
      return "当前规则没有足够证据识别 Classic Reentrancy。";
    case "EVIDENCE_INCOMPLETE":
      return "当前证据不足以形成分析草案。";
    case "CHAIN_NOT_CONFIGURED":
      return "Guardian 链上证据配置不可用。";
    case "CHAIN_ID_MISMATCH":
      return "当前 RPC 网络不是已配置的 Monad Testnet。";
    case "CHAIN_EVIDENCE_UNAVAILABLE":
      return "Monad 链上 Quest 证据暂时不可用。";
    case "CHAIN_EVIDENCE_MISMATCH":
      return "链上 Quest 身份与冻结证据不一致。";
    case "ANALYSIS_FAILED":
      return "确定性分析无法完成。";
    case "INTERNAL_ERROR":
      return "Guardian Security Agent 暂时不可用。";
  }
}

function statusForCode(code: GuardianSecurityErrorCode): number {
  switch (code) {
    case "INVALID_CONTENT_TYPE":
      return 415;
    case "INVALID_JSON":
    case "INVALID_BODY":
      return 400;
    case "SOURCE_TOO_LARGE":
      return 413;
    case "UNSUPPORTED_CASE":
    case "UNSUPPORTED_VULNERABILITY":
    case "EVIDENCE_INCOMPLETE":
    case "ANALYSIS_FAILED":
      return 422;
    case "CHAIN_EVIDENCE_MISMATCH":
      return 409;
    case "CHAIN_NOT_CONFIGURED":
    case "CHAIN_ID_MISMATCH":
    case "CHAIN_EVIDENCE_UNAVAILABLE":
      return 503;
    case "INTERNAL_ERROR":
      return 500;
  }
}

export function guardianSecurityFailure(error: unknown): {
  body: GuardianSecurityFailure;
  status: number;
} {
  const code =
    error instanceof GuardianSecurityError ? error.code : "INTERNAL_ERROR";
  return {
    body: {
      ok: false,
      error: { code, message: publicMessageForGuardianSecurityCode(code) },
    },
    status: statusForCode(code),
  };
}
