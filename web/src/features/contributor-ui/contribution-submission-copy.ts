import { ContributorApiError } from "./contributor-api-client";

const FALLBACK_MESSAGE = "异兽献策提交失败，请检查网络后重试。";

const CONTRIBUTION_SUBMISSION_ERROR_COPY: Readonly<Record<string, string>> = {
  CASE_ALREADY_EXISTS: "相同源码的安全案例已经提交，请修改案例内容后重新鉴定。",
  BESTIARY_NAME_UNAVAILABLE: "此异兽名已被其他修士占用，请重新运行 Guardian 获取新的异兽名后再提交。",
  SIGNED_DRAFT_EXPIRED: "Guardian 签名草案已过期，请重新运行 Guardian 后再提交。",
  SIGNED_DRAFT_SOURCE_MISMATCH: "源码已发生变化，请重新运行 Guardian 后再提交。",
  SIGNED_DRAFT_CASE_NAME_MISMATCH: "案例名称已发生变化，请重新运行 Guardian 后再提交。",
  DATABASE_UNAVAILABLE: "献策服务暂时不可用，请稍后重试。",
  NETWORK_UNAVAILABLE: FALLBACK_MESSAGE,
};

export function contributionSubmissionErrorMessage(error: unknown): string {
  if (!(error instanceof ContributorApiError)) return FALLBACK_MESSAGE;
  return CONTRIBUTION_SUBMISSION_ERROR_COPY[error.code] ?? FALLBACK_MESSAGE;
}
