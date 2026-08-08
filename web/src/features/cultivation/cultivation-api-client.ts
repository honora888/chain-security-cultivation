import {
  CULTIVATION_COMPLETION_SCHEMA_VERSION,
  CULTIVATION_PROFILE_SCHEMA_VERSION,
  type CultivationCompletionResponse,
  type CultivationProfile,
  type CultivationProfileResponse,
  type QuestOneCompletionEvidence,
} from "./contracts";

export class CultivationApiError extends Error {
  constructor(readonly code: string, message: string, readonly status: number) {
    super(message);
    this.name = "CultivationApiError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseProfile(value: unknown): CultivationProfile | null {
  if (!isRecord(value) || !isRecord(value.progression) || !isRecord(value.mastery)) return null;
  const numeric = [
    value.totalExp,
    value.completedQuestCount,
    value.progression.realmStartExp,
    value.progression.expIntoRealm,
    value.progression.expToNextRealm,
    value.progression.progressPercent,
    value.mastery.Metal,
    value.mastery.Wood,
    value.mastery.Water,
    value.mastery.Fire,
    value.mastery.Earth,
  ];
  if (numeric.some((item) => typeof item !== "number") || typeof value.progression.realm !== "string") return null;
  if (!Array.isArray(value.badges) || !Array.isArray(value.recentCompletions)) return null;
  return value as unknown as CultivationProfile;
}

async function request(path: string, init: RequestInit = {}, signal?: AbortSignal): Promise<Record<string, unknown>> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      signal,
      credentials: "include",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
    });
  } catch {
    throw new CultivationApiError("NETWORK_UNAVAILABLE", "网络暂时不可用，请检查连接后重试。", 0);
  }
  const body: unknown = await response.json().catch(() => null);
  if (!isRecord(body)) throw new CultivationApiError("INVALID_RESPONSE", "修炼服务返回了无法识别的响应。", response.status);
  if (!response.ok || body.ok !== true) {
    const error = isRecord(body.error) ? body.error : {};
    throw new CultivationApiError(
      typeof error.code === "string" ? error.code : "REQUEST_FAILED",
      typeof error.message === "string" ? error.message : "修炼服务暂时无法完成请求。",
      response.status,
    );
  }
  return body;
}

export async function getCultivationProfile(signal?: AbortSignal): Promise<CultivationProfile> {
  const body = await request("/api/cultivation/me", {}, signal);
  if (body.schemaVersion !== CULTIVATION_PROFILE_SCHEMA_VERSION) {
    throw new CultivationApiError("INVALID_RESPONSE", "修炼档案版本无法识别。", 200);
  }
  const profile = parseProfile(body.profile);
  if (!profile) throw new CultivationApiError("INVALID_RESPONSE", "修炼档案格式无法识别。", 200);
  return (body as unknown as CultivationProfileResponse).profile;
}

export async function completeQuestOne(evidence: QuestOneCompletionEvidence): Promise<CultivationCompletionResponse> {
  const body = await request("/api/cultivation/quests/1/complete", {
    method: "POST",
    body: JSON.stringify(evidence),
  });
  if (body.schemaVersion !== CULTIVATION_COMPLETION_SCHEMA_VERSION || typeof body.alreadyCompleted !== "boolean") {
    throw new CultivationApiError("INVALID_RESPONSE", "修炼结算结果无法识别。", 200);
  }
  const profile = parseProfile(body.profile);
  if (!profile || !isRecord(body.completion) || !isRecord(body.awardedThisRequest)) {
    throw new CultivationApiError("INVALID_RESPONSE", "修炼结算结果格式不完整。", 200);
  }
  return body as unknown as CultivationCompletionResponse;
}

export function cultivationApiErrorMessage(error: unknown): string {
  if (error instanceof CultivationApiError) {
    if (error.code === "AUTH_REQUIRED") return "请先完成钱包签名入世，再结算修炼所得。";
    if (error.code === "EVIDENCE_INVALID") return "修炼证据未通过校验，请确认四道试炼均已完成后重试。";
    if (error.code === "DATABASE_NOT_CONFIGURED" || error.code === "DATABASE_UNAVAILABLE") {
      return "修炼结算服务暂时不可用，请稍后重试。";
    }
  }
  return "修炼结算失败，请检查网络后重试。";
}
