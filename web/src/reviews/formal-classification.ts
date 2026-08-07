import type {
  GuardianFindingConfidence,
  GuardianFindingSeverity,
  GuardianVulnerabilityCategory,
} from "@/features/guardian-llm/contracts";
import type {
  ElementName,
  RealmName,
} from "@/features/guardian-security/analysis-types";

export const FORMAL_VULNERABILITY_TYPES = [
  "reentrancy",
  "access-control",
  "unchecked-external-call",
  "delegatecall",
  "oracle-manipulation",
  "economic-attack",
  "signature-replay",
  "authentication",
  "denial-of-service",
  "accounting",
  "state-logic",
  "initialization",
  "upgradeability",
  "arithmetic",
  "precision-rounding",
  "timestamp-dependence",
  "randomness",
  "frontrunning-mev",
  "other",
] as const satisfies readonly GuardianVulnerabilityCategory[];

export const FORMAL_SEVERITY_VALUES = [
  "Informational",
  "Low",
  "Medium",
  "High",
  "Critical",
] as const satisfies readonly GuardianFindingSeverity[];

export const FORMAL_CONFIDENCE_VALUES = [
  "Low",
  "Medium",
  "High",
] as const satisfies readonly GuardianFindingConfidence["label"][];

const FORMAL_TYPE_LABELS: Readonly<Record<GuardianVulnerabilityCategory, string>> = {
  reentrancy: "重入",
  "access-control": "访问控制",
  "unchecked-external-call": "未检查外部调用",
  delegatecall: "委托调用",
  "oracle-manipulation": "预言机操纵",
  "economic-attack": "经济攻击",
  "signature-replay": "签名重放",
  authentication: "身份认证",
  "denial-of-service": "拒绝服务",
  accounting: "账务核算",
  "state-logic": "状态逻辑",
  initialization: "初始化",
  upgradeability: "可升级性",
  arithmetic: "算术",
  "precision-rounding": "精度与舍入",
  "timestamp-dependence": "时间戳依赖",
  randomness: "随机数",
  "frontrunning-mev": "抢跑与 MEV",
  other: "其他已核实类型",
};

export function formalVulnerabilityTypeLabelZh(value: string): string {
  if (value === "Classic Reentrancy") return "经典重入";
  return FORMAL_VULNERABILITY_TYPES.includes(value as GuardianVulnerabilityCategory)
    ? FORMAL_TYPE_LABELS[value as GuardianVulnerabilityCategory]
    : value;
}

export interface ReviewerFormalClassification {
  readonly formalType: GuardianVulnerabilityCategory;
  readonly primaryElement: ElementName;
  readonly secondaryElements: readonly ElementName[];
  readonly realm: RealmName;
  readonly severity: {
    readonly label: GuardianFindingSeverity;
    readonly score: number;
  };
  readonly confidence: GuardianFindingConfidence;
}

export function severityLabelForScore(score: number): GuardianFindingSeverity {
  if (score <= 2) return "Informational";
  if (score <= 4) return "Low";
  if (score <= 7) return "Medium";
  if (score <= 10) return "High";
  return "Critical";
}

export function confidenceLabelForScore(
  score: number,
): GuardianFindingConfidence["label"] {
  if (score < 50) return "Low";
  if (score < 80) return "Medium";
  return "High";
}
