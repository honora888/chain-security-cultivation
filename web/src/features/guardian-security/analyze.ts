import { createHash } from "node:crypto";

import {
  GuardianSecurityError,
  type FormalAnalysis,
  type GuardianSecurityRequest,
  type GuardianSecuritySuccess,
  type MossEvidence,
  type ReentrancySignal,
} from "./analysis-types";
import { classifyElements, classifyRealm } from "./classification";
import { createBestiaryDraft, createQuestDraft } from "./draft-generator";
import {
  QUEST_ONE_BUILTIN_SOURCES,
  QUEST_ONE_EVIDENCE_PROFILE,
} from "./quest-one-evidence";
import {
  analyzeReentrancySignals,
  signalMatched,
  supportsClassicReentrancy,
} from "./reentrancy-rules";
import { assessConfidence, assessSeverity } from "./severity";

function normalizeDraftSource(value: string | undefined): string {
  return (value ?? "")
    .replace(/\r\n?/gu, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/gu, ""))
    .join("\n")
    .trim();
}

function sourceFingerprint(sources: {
  vulnerableSource: string;
  attackSource?: string;
  fixedSource?: string;
}): string {
  return createHash("sha256")
    .update(JSON.stringify([
      normalizeDraftSource(sources.vulnerableSource),
      normalizeDraftSource(sources.attackSource),
      normalizeDraftSource(sources.fixedSource),
    ]), "utf8")
    .digest("hex");
}

function buildFormalAnalysis(
  signals: readonly ReentrancySignal[],
  inputMode: "builtin" | "sample",
): FormalAnalysis {
  const sourceProvenance =
    inputMode === "builtin"
      ? "frozen-repository-evidence"
      : "user-provided-unverified";
  const matchedEvidence = signals
    .filter((entry) => entry.matched)
    .map((entry) => ({
      text: entry.explanation,
      provenance: entry.evidenceType,
    }));
  const attackStructurePresent =
    signalMatched(signals, "callback-entry") &&
    signalMatched(signals, "callback-reentry");

  return {
    formalType: "Classic Reentrancy",
    category: "Reentrancy",
    rootCause:
      "提款类函数在完成调用者内部记账状态更新之前先执行原生资产外部调用；接收方可在旧状态仍可见时通过 receive()/fallback() 回调重新进入同一提款路径。",
    affectedFunctions: ["匹配到的提款类支付函数"],
    prerequisites: [
      "目标合约持有原生资产，并按调用者记录可提款的内部余额。",
      "收款地址能够在外部价值调用期间执行 receive() 或 fallback() 代码。",
      "内部余额完成更新之前，同一提款路径仍可再次调用。",
    ],
    attackPath: [
      "攻击者先建立可提款的内部余额。",
      "攻击者调用匹配到的提款类函数。",
      "目标合约在完成内部记账之前先向攻击合约发送原生资产。",
      "转账触发攻击合约的 receive()/fallback()，回调再次进入同一提款函数。",
      "旧余额仍然可见时，攻击者可重复执行提款路径。",
    ],
    impact:
      "重复支付可能使合约的实际原生资产余额与内部记账失配，并可能耗尽合约托管的资金。",
    repeatability: attackStructurePresent
      ? "已观察到的回调结构可在目标合约余额允许时重复进入提款路径。"
      : "当前仅根据危险执行顺序推断可重复性，仍需独立执行证据确认。",
    privilegeRequired:
      "匹配到的经典模式不要求特权角色；攻击者需要可提款余额，以及能够执行回调的收款合约。",
    mitigations: [
      "采用 Checks-Effects-Interactions（检查-效果-交互）原则，在外部价值调用之前完成内部状态更新。",
      "同时验证正常提款路径与恶意 receive()/fallback() 回调的回归路径。",
      "可按需使用 nonReentrant / Reentrancy Guard（重入保护）作为补充防线，但不能替代正确的记账顺序。",
    ],
    evidence: matchedEvidence,
    inferences: [
      {
        text: "组合源码模式与经典重入漏洞（Classic Reentrancy）一致。",
        provenance: "generated-inference",
      },
      {
        text: "潜在资金损失源于价值流与旧记账状态并存；当前规则不会估算具体损失金额。",
        provenance: "generated-inference",
      },
    ],
    limitations: [
      {
        text:
          inputMode === "sample"
            ? "用户提交的源码文本未经验证，当前未对其进行编译或执行。"
            : "该结论仅适用于冻结教学案例及其已记录证据。",
        provenance:
          inputMode === "sample" ? sourceProvenance : "known-limitation",
      },
      {
        text: "确定性文本模式匹配不等同于完整的正式安全审计。",
        provenance: "known-limitation",
      },
    ],
  };
}

export function analyzeGuardianSecurityCase(
  request: GuardianSecurityRequest,
  mossEvidence: MossEvidence,
): GuardianSecuritySuccess {
  const isBuiltin = request.mode === "builtin";
  const sources = isBuiltin ? QUEST_ONE_BUILTIN_SOURCES : request.sample;
  const signals = analyzeReentrancySignals(
    sources,
    isBuiltin
      ? "frozen-repository-evidence"
      : "user-provided-unverified",
    isBuiltin,
  );

  if (!supportsClassicReentrancy(signals)) {
    throw new GuardianSecurityError("UNSUPPORTED_VULNERABILITY");
  }

  const analysis = buildFormalAnalysis(signals, request.mode);
  const elements = classifyElements(signals);
  const realm = classifyRealm(signals);
  const severity = assessSeverity(signals);
  const confidence = assessConfidence(signals, request.mode, mossEvidence);
  const displayName = isBuiltin
    ? QUEST_ONE_EVIDENCE_PROFILE.displayName
    : request.sample.name;
  const limitations = isBuiltin
    ? QUEST_ONE_EVIDENCE_PROFILE.knownLimitations.map((entry) => entry.value)
    : [
        "用户提交的源码文本未经验证。",
        "当前未执行攻击 PoC、Foundry 测试、Invariant 或 Slither 扫描。",
        "用户样例尚未注册为 Guardian Quest，因此没有适用的链上 Quest 身份。",
      ];
  const draftContext = {
    inputMode: request.mode,
    displayName,
    signals,
    analysis,
    elements,
    realm,
    severity,
    confidence,
    limitations,
    sourceFingerprint: sourceFingerprint(sources),
  } as const;
  const reviewReasons = [
    "确定性规则分析不等同于正式安全审计。",
    "生成的草案仍需进行内容编辑与人工安全复核。",
    ...(isBuiltin
      ? [
          "Moss 只核验已注册的 Quest 身份，不核验完整安全结论。",
        ]
      : [
          "源码文本由用户提供，尚未经过验证。",
          "当前未执行攻击 PoC、Slither、Foundry 或 Invariant。",
        ]),
  ];

  return {
    ok: true,
    schemaVersion: "guardian-security-analysis-v1",
    analyzedAt: new Date().toISOString(),
    agent: {
      mode: "deterministic-rules",
      externalModelConnected: false,
    },
    inputMode: request.mode,
    case: {
      caseId: isBuiltin ? QUEST_ONE_EVIDENCE_PROFILE.caseId : "user-sample",
      displayName,
      provenance: isBuiltin
        ? "frozen-repository-evidence"
        : "user-provided-unverified",
      ...(isBuiltin ? { evidenceProfile: QUEST_ONE_EVIDENCE_PROFILE } : {}),
    },
    mossEvidence,
    signals,
    analysis,
    classification: { elements, realm },
    severity,
    confidence,
    bestiaryDraft: createBestiaryDraft(draftContext),
    questDraft: createQuestDraft(draftContext),
    review: {
      status: "draft",
      requiresHumanApproval: true,
      publishAllowed: false,
      reasons: reviewReasons,
    },
    limitations,
  };
}
