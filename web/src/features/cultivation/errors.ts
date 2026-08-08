export type CultivationErrorCode =
  | "AUTH_REQUIRED"
  | "INVALID_REQUEST"
  | "EVIDENCE_INVALID"
  | "DATABASE_NOT_CONFIGURED"
  | "DATABASE_UNAVAILABLE";

const ERROR_DETAILS: Record<CultivationErrorCode, { message: string; status: number }> = {
  AUTH_REQUIRED: { message: "请先完成钱包签名入世，再结算修炼所得。", status: 401 },
  INVALID_REQUEST: { message: "修炼结算请求格式不正确。", status: 400 },
  EVIDENCE_INVALID: { message: "修炼证据未通过校验，请完成当前秘境后重试。", status: 422 },
  DATABASE_NOT_CONFIGURED: { message: "修炼结算服务尚未完成配置。", status: 503 },
  DATABASE_UNAVAILABLE: { message: "修炼结算服务暂时不可用，请稍后重试。", status: 503 },
};

export class CultivationHttpError extends Error {
  readonly status: number;

  constructor(readonly code: CultivationErrorCode) {
    super(ERROR_DETAILS[code].message);
    this.name = "CultivationHttpError";
    this.status = ERROR_DETAILS[code].status;
  }
}
