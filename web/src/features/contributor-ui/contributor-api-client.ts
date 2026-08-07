import type { SignedGuardianDraftV1 } from "@/features/guardian-draft/contracts";

export type ContributionStatus = "pending_review" | "changes_requested" | "approved" | "rejected";

export type ContributionSummary = {
  caseId: string;
  caseName: string;
  proposedBestiaryName: string | null;
  formalType: string | null;
  primaryElement: string | null;
  secondaryElements: readonly string[];
  severity: { label: string | null; score: number | null };
  confidence: { label: string | null; score: number | null };
  status: ContributionStatus;
  createdAt: string;
  updatedAt?: string;
};

export type ContributionDetail = ContributionSummary & {
  vulnerableSource: string;
  attackSource: string;
  fixedSource: string;
  analysisJson: unknown;
};

export type MeritEntry = {
  caseId: string;
  amount: number;
  reason: string;
  idempotencyKey: string;
  createdAt: string;
};

export type MeritSummary = {
  walletAddress: string;
  totalMerit: number;
  entries: readonly MeritEntry[];
};

export type ContributionSubmission = {
  caseName: string;
  vulnerableSource: string;
  attackSource: string;
  fixedSource: string;
};

export class ContributorApiError extends Error {
  constructor(readonly code: string, message: string, readonly status: number) {
    super(message);
    this.name = "ContributorApiError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asStrings(value: unknown): readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string") ? value : [];
}

function contributionStatus(value: unknown): ContributionStatus | null {
  return value === "pending_review" || value === "changes_requested" || value === "approved" || value === "rejected"
    ? value
    : null;
}

function parseSummary(value: unknown): ContributionSummary | null {
  if (!isRecord(value)) return null;
  const caseId = asString(value.caseId);
  const caseName = asString(value.caseName);
  const status = contributionStatus(value.status);
  const createdAt = asString(value.createdAt);
  if (!caseId || !caseName || !status || !createdAt || !isRecord(value.severity) || !isRecord(value.confidence)) return null;
  return {
    caseId,
    caseName,
    proposedBestiaryName: asString(value.proposedBestiaryName),
    formalType: asString(value.formalType),
    primaryElement: asString(value.primaryElement),
    secondaryElements: asStrings(value.secondaryElements),
    severity: { label: asString(value.severity.label), score: asNumber(value.severity.score) },
    confidence: { label: asString(value.confidence.label), score: asNumber(value.confidence.score) },
    status,
    createdAt,
    updatedAt: asString(value.updatedAt) ?? undefined,
  };
}

function parseDetail(value: unknown): ContributionDetail | null {
  const summary = parseSummary(value);
  if (!summary || !isRecord(value)) return null;
  const vulnerableSource = asString(value.vulnerableSource);
  const attackSource = asString(value.attackSource);
  const fixedSource = asString(value.fixedSource);
  if (vulnerableSource === null || attackSource === null || fixedSource === null || !("analysisJson" in value)) return null;
  return { ...summary, vulnerableSource, attackSource, fixedSource, analysisJson: value.analysisJson };
}

function parseMerit(value: unknown): MeritSummary | null {
  if (!isRecord(value) || !Array.isArray(value.entries)) return null;
  const walletAddress = asString(value.walletAddress);
  const totalMerit = asNumber(value.totalMerit);
  if (!walletAddress || totalMerit === null) return null;
  const entries: MeritEntry[] = [];
  for (const item of value.entries) {
    if (!isRecord(item)) return null;
    const caseId = asString(item.caseId);
    const amount = asNumber(item.amount);
    const reason = asString(item.reason);
    const idempotencyKey = asString(item.idempotencyKey);
    const createdAt = asString(item.createdAt);
    if (!caseId || amount === null || !reason || !idempotencyKey || !createdAt) return null;
    entries.push({ caseId, amount, reason, idempotencyKey, createdAt });
  }
  return { walletAddress, totalMerit, entries };
}

async function request(path: string, init: RequestInit = {}, signal?: AbortSignal): Promise<Record<string, unknown>> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      signal,
      cache: "no-store",
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
    });
  } catch {
    throw new ContributorApiError("NETWORK_UNAVAILABLE", "网络暂时不可用，请检查连接后重试。", 0);
  }
  const body: unknown = await response.json().catch(() => null);
  if (!isRecord(body)) throw new ContributorApiError("INVALID_RESPONSE", "服务返回了无法识别的响应，请稍后重试。", response.status);
  if (!response.ok || body.ok !== true) {
    const error = isRecord(body.error) ? body.error : {};
    const code = asString(error.code) ?? "REQUEST_FAILED";
    const message = asString(error.message) ?? "服务暂时无法完成请求，请稍后重试。";
    throw new ContributorApiError(code, message, response.status);
  }
  return body;
}

export async function createContribution(input: ContributionSubmission, analysisDigest: string): Promise<{
  summary: ContributionSummary;
  analysis: unknown;
}> {
  const response = await request("/api/contributions/cases", {
    method: "POST",
    headers: { "X-Guardian-Analysis-Digest": analysisDigest },
    body: JSON.stringify(input),
  });
  const parsed = parseSummary(response.case);
  if (!parsed || !("analysis" in response)) throw new ContributorApiError("INVALID_RESPONSE", "服务返回了无法识别的案例信息，请稍后重试。", 200);
  return { summary: parsed, analysis: response.analysis };
}

export async function createSignedContribution(
  input: ContributionSubmission,
  signedDraft: SignedGuardianDraftV1,
): Promise<ContributionSummary> {
  const response = await request("/api/contributions/cases", {
    method: "POST",
    body: JSON.stringify({ ...input, signedDraft }),
  });
  const parsed = parseSummary(response.case);
  if (!parsed) {
    throw new ContributorApiError(
      "INVALID_RESPONSE",
      "服务返回了无法识别的案例信息，请稍后重试。",
      200,
    );
  }
  return parsed;
}

export async function getContributions(signal?: AbortSignal): Promise<readonly ContributionSummary[]> {
  const response = await request("/api/contributions/cases", {}, signal);
  if (!Array.isArray(response.cases)) throw new ContributorApiError("INVALID_RESPONSE", "服务返回了无法识别的案例列表，请稍后重试。", 200);
  const parsed = response.cases.map(parseSummary);
  if (parsed.some((item) => item === null)) throw new ContributorApiError("INVALID_RESPONSE", "服务返回了无法识别的案例列表，请稍后重试。", 200);
  return parsed as ContributionSummary[];
}

export async function getContribution(caseId: string, signal?: AbortSignal): Promise<ContributionDetail> {
  const response = await request(`/api/contributions/cases/${encodeURIComponent(caseId)}`, {}, signal);
  const parsed = parseDetail(response.case);
  if (!parsed) throw new ContributorApiError("INVALID_RESPONSE", "服务返回了无法识别的案例详情，请稍后重试。", 200);
  return parsed;
}

export async function getMerit(signal?: AbortSignal): Promise<MeritSummary> {
  const response = await request("/api/merit/me", {}, signal);
  const parsed = parseMerit(response);
  if (!parsed) throw new ContributorApiError("INVALID_RESPONSE", "服务返回了无法识别的贡献值信息，请稍后重试。", 200);
  return parsed;
}
