import type {
  ConfidenceAssessment,
  MossEvidence,
  ReentrancySignal,
  SeverityAssessment,
  SeverityLevel,
} from "./analysis-types";
import { signalMatched } from "./reentrancy-rules";

function severityLevel(score: number): SeverityLevel {
  if (score <= 2) return "Informational";
  if (score <= 4) return "Low";
  if (score <= 7) return "Medium";
  if (score <= 10) return "High";
  return "Critical";
}

export function assessSeverity(
  signals: readonly ReentrancySignal[],
): SeverityAssessment {
  const hasValueFlow = signalMatched(signals, "fund-flow");
  const hasMismatch = signalMatched(
    signals,
    "state-update-after-external-call",
  );
  const hasCallback = signalMatched(signals, "callback-entry");
  const hasReentry = signalMatched(signals, "callback-reentry");
  const hasAccessSignal = signalMatched(signals, "access-control");

  const impact = hasValueFlow && hasMismatch ? 4 : hasValueFlow ? 2 : 1;
  const exploitability =
    hasCallback && hasReentry && hasMismatch
      ? 4
      : hasMismatch
        ? 3
        : hasCallback
          ? 2
          : 1;
  const repeatability = hasReentry ? 2 : hasCallback ? 1 : 0;
  const privilegeExposure = hasAccessSignal ? 1 : 0;
  const score = impact + exploitability + repeatability + privilegeExposure;

  return {
    level: severityLevel(score),
    score,
    maxScore: 12,
    breakdown: {
      impact,
      exploitability,
      repeatability,
      privilegeExposure,
    },
    rationale: [
      `影响评分 ${impact}/4：反映原生资产流动与潜在记账失配。`,
      `可利用性评分 ${exploitability}/4：反映已观察到的回调、重入与执行顺序结构。`,
      `可重复性评分 ${repeatability}/2：反映回调能否重复调用目标函数。`,
      `权限暴露评分 ${privilegeExposure}/2：与资金损失路径独立计算。`,
    ],
  };
}

export function assessConfidence(
  signals: readonly ReentrancySignal[],
  inputMode: "builtin" | "sample",
  mossEvidence: MossEvidence,
): ConfidenceAssessment {
  const factors: readonly [string, boolean, number][] = [
    [
      "漏洞源码模式证据较强",
      signalMatched(signals, "external-native-value-call") &&
        signalMatched(signals, "state-update-after-external-call"),
      15,
    ],
    ["存在回调结构", signalMatched(signals, "callback-entry"), 15],
    ["存在回调重入", signalMatched(signals, "callback-reentry"), 15],
    [
      "存在修复代码的执行顺序对照",
      signalMatched(signals, "fixed-state-before-call"),
      15,
    ],
    ["攻击测试已经验证", signalMatched(signals, "verified-attack-test"), 10],
    [
      "修复回归已经验证",
      signalMatched(signals, "verified-fixed-regression"),
      10,
    ],
    ["Invariant 证据已经验证", signalMatched(signals, "verified-invariant"), 5],
    [
      "Slither 对照已经验证",
      signalMatched(signals, "verified-slither-contrast"),
      5,
    ],
    ["具备冻结 commit 与 Content Hash", inputMode === "builtin", 5],
    [
      "冻结结论已经人工复核",
      signalMatched(signals, "verified-human-conclusion"),
      3,
    ],
    ["Moss 已匹配注册内容身份", mossEvidence.status === "verified", 2],
  ];
  const supportingFactors = factors
    .filter(([, matched]) => matched)
    .map(([name]) => name);
  const missingEvidence = factors
    .filter(([, matched]) => !matched)
    .map(([name]) => name);
  const score = factors.reduce(
    (total, [, matched, points]) => total + (matched ? points : 0),
    0,
  );
  const label = score >= 80 ? "High" : score >= 50 ? "Medium" : "Low";

  let evidenceLevel: ConfidenceAssessment["evidenceLevel"] =
    "PATTERN_MATCHED";
  if (
    signalMatched(signals, "callback-entry") &&
    signalMatched(signals, "callback-reentry")
  ) {
    evidenceLevel = "ATTACK_STRUCTURE_PRESENT";
  }
  if (signalMatched(signals, "fixed-state-before-call")) {
    evidenceLevel = "FIX_CONTRAST_PRESENT";
  }
  if (inputMode === "builtin" && signalMatched(signals, "verified-attack-test")) {
    evidenceLevel = "POC_VERIFIED";
  }
  if (
    inputMode === "builtin" &&
    signalMatched(signals, "verified-fixed-regression")
  ) {
    evidenceLevel = "FIX_VERIFIED";
  }
  if (
    inputMode === "builtin" &&
    mossEvidence.status === "verified" &&
    signalMatched(signals, "verified-human-conclusion")
  ) {
    evidenceLevel = "HUMAN_REVIEWED";
  }

  return { score, label, evidenceLevel, supportingFactors, missingEvidence };
}
