import type { GuardianSecurityErrorCode } from "@/features/guardian-security/analysis-types";

export const MAX_CASE_NAME_LENGTH = 100;
export const MAX_SOURCE_LENGTH = 50_000;
export const MAX_TOTAL_SOURCE_LENGTH = 120_000;

export const ERROR_COPY: Record<GuardianSecurityErrorCode, string> = {
  INVALID_CONTENT_TYPE: "请求格式不受支持，请刷新页面后重试。",
  INVALID_JSON: "提交内容无法解析，请检查后重试。",
  INVALID_BODY: "提交内容格式不正确，请检查案例名称和源码字段。",
  UNSUPPORTED_CASE: "当前贡献工作台只接受新的安全案例样例。",
  SOURCE_TOO_LARGE: "源码内容超过允许长度，请精简后重新提交。",
  UNSUPPORTED_VULNERABILITY:
    "当前规则尚未识别出受支持的 Classic Reentrancy 模式。这不代表源码一定安全。",
  EVIDENCE_INCOMPLETE: "当前证据不足以生成草案，请补充攻击样例或修复对照。",
  CHAIN_NOT_CONFIGURED: "服务的链上证据配置暂时不可用，请稍后重试。",
  CHAIN_ID_MISMATCH: "服务的链上网络配置不一致，请稍后重试。",
  CHAIN_EVIDENCE_UNAVAILABLE: "链上证据暂时不可用，请稍后重试。",
  CHAIN_EVIDENCE_MISMATCH: "链上证据与案例身份不一致，请稍后重试。",
  ANALYSIS_FAILED: "本次分析未能完成，请检查输入后重试。",
  INTERNAL_ERROR: "服务暂时无法完成分析，请稍后重试。",
};

export const STRENGTH_LABELS = {
  weak: "弱信号",
  moderate: "中等信号",
  strong: "强信号",
} as const;

export const SOURCE_LABELS = {
  vulnerableSource: "漏洞源码",
  attackSource: "攻击样例",
  fixedSource: "修复对照",
  frozenEvidence: "冻结证据",
} as const;

export const PROVENANCE_LABELS = {
  "frozen-repository-evidence": "仓库冻结证据",
  "human-reviewed": "人工复核证据",
  "on-chain-fact": "链上事实",
  "generated-inference": "规则推断",
  "user-provided-unverified": "用户提交 · 未验证",
  "known-limitation": "已知局限",
} as const;
