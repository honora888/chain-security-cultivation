export const CONTRIBUTION_SCHEMA_VERSION = "security-contribution-v1" as const;
export const CONTRIBUTION_REQUEST_BODY_MAX_BYTES = 512 * 1024;
export const CONTRIBUTION_CASE_NAME_MAX_CHARS = 120;
export const CONTRIBUTION_BESTIARY_NAME_MIN_CHARS = 2;
export const CONTRIBUTION_BESTIARY_NAME_MAX_CHARS = 40;
export const CONTRIBUTION_SOURCE_MAX_CHARS = 100_000;
export const CONTRIBUTION_TOTAL_SOURCE_MAX_CHARS = 250_000;
export const CONTRIBUTION_CASE_ID_PATTERN =
  /^case-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const CONTRIBUTION_RESERVED_BESTIARY_NAMES = new Set(["噬灵回环兽"]);

export type ContributionErrorCode =
  | "INVALID_REQUEST"
  | "INVALID_CASE_ID"
  | "CASE_NOT_FOUND"
  | "AUTH_REQUIRED"
  | "CASE_ALREADY_EXISTS"
  | "BESTIARY_NAME_UNAVAILABLE"
  | "PAYLOAD_TOO_LARGE"
  | "INVALID_BESTIARY_NAME"
  | "ANALYSIS_UNSUPPORTED"
  | "ANALYSIS_FAILED"
  | "DATABASE_NOT_CONFIGURED"
  | "DATABASE_UNAVAILABLE";

const CONTRIBUTION_ERROR_MESSAGES: Record<ContributionErrorCode, string> = {
  INVALID_REQUEST: "提交内容格式不正确，请检查案例和源码字段。",
  INVALID_CASE_ID: "案例编号格式不正确。",
  CASE_NOT_FOUND: "未找到该安全案例。",
  AUTH_REQUIRED: "请先完成钱包身份认证。",
  CASE_ALREADY_EXISTS: "相同源码的安全案例已经提交。",
  BESTIARY_NAME_UNAVAILABLE: "该异兽名称已被占用。",
  PAYLOAD_TOO_LARGE: "提交内容超过允许大小。",
  INVALID_BESTIARY_NAME: "异兽名称格式不符合要求。",
  ANALYSIS_UNSUPPORTED: "当前规则未识别出受支持的 Classic Reentrancy 模式。",
  ANALYSIS_FAILED: "安全案例分析未能完成，请稍后重试。",
  DATABASE_NOT_CONFIGURED: "贡献服务尚未完成数据库配置。",
  DATABASE_UNAVAILABLE: "贡献服务暂时不可用，请稍后重试。",
};

const CONTRIBUTION_ERROR_STATUSES: Record<ContributionErrorCode, number> = {
  INVALID_REQUEST: 400,
  INVALID_CASE_ID: 400,
  CASE_NOT_FOUND: 404,
  AUTH_REQUIRED: 401,
  CASE_ALREADY_EXISTS: 409,
  BESTIARY_NAME_UNAVAILABLE: 409,
  PAYLOAD_TOO_LARGE: 413,
  INVALID_BESTIARY_NAME: 422,
  ANALYSIS_UNSUPPORTED: 422,
  ANALYSIS_FAILED: 500,
  DATABASE_NOT_CONFIGURED: 503,
  DATABASE_UNAVAILABLE: 503,
};

export class ContributionHttpError extends Error {
  readonly code: ContributionErrorCode;
  readonly status: number;

  constructor(code: ContributionErrorCode) {
    super(CONTRIBUTION_ERROR_MESSAGES[code]);
    this.name = "ContributionHttpError";
    this.code = code;
    this.status = CONTRIBUTION_ERROR_STATUSES[code];
  }
}
