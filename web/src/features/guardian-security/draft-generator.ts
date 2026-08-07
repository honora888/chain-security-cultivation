import type {
  BestiaryDraft,
  ConfidenceAssessment,
  ElementClassification,
  FormalAnalysis,
  QuestDraft,
  RealmClassification,
  ReentrancySignal,
  SeverityAssessment,
} from "./analysis-types";
import { createSampleBestiaryDraftName } from "./sample-draft-name";
import {
  CLASSIC_REENTRANCY_PUBLIC_COPY,
  QUEST_ONE_PUBLIC_KNOWN_LIMITATIONS,
  SAMPLE_PUBLIC_KNOWN_LIMITATIONS,
} from "./public-bestiary-copy";

interface DraftContext {
  inputMode: "builtin" | "sample";
  displayName: string;
  signals: readonly ReentrancySignal[];
  analysis: FormalAnalysis;
  elements: ElementClassification;
  realm: RealmClassification;
  severity: SeverityAssessment;
  confidence: ConfidenceAssessment;
  limitations: readonly string[];
  sourceFingerprint: string;
}

export function createBestiaryDraft(context: DraftContext): BestiaryDraft {
  const evidenceSummary = context.signals
    .filter((entry) => entry.matched)
    .map((entry) => `${entry.id}: ${entry.explanation}`);

  return {
    name: context.inputMode === "builtin"
      ? context.elements.primaryElement === "Water"
        ? "噬灵回环兽"
        : `${context.displayName}异兽草案`
      : createSampleBestiaryDraftName(
          context.elements.primaryElement,
          context.sourceFingerprint,
        ),
    formalType: "Classic Reentrancy",
    primaryElement: context.elements.primaryElement,
    secondaryElements: context.elements.secondaryElements,
    realm: context.realm.realm,
    severity: context.severity.level,
    confidence: context.confidence.label,
    summary: CLASSIC_REENTRANCY_PUBLIC_COPY.summary,
    attackPattern: CLASSIC_REENTRANCY_PUBLIC_COPY.attackPattern,
    prerequisites: CLASSIC_REENTRANCY_PUBLIC_COPY.prerequisites,
    impact: CLASSIC_REENTRANCY_PUBLIC_COPY.impact,
    evidenceSummary,
    mitigations: CLASSIC_REENTRANCY_PUBLIC_COPY.mitigations,
    knownLimitations:
      context.inputMode === "builtin"
        ? QUEST_ONE_PUBLIC_KNOWN_LIMITATIONS
        : SAMPLE_PUBLIC_KNOWN_LIMITATIONS,
    reviewStatus: "draft",
  };
}

export function createQuestDraft(context: DraftContext): QuestDraft {
  const sampleQualification =
    context.inputMode === "sample"
      ? "本草案来自未验证的用户源码文本，仅用于人工复核。"
      : "本草案基于冻结教学证据与已核验的 Quest 身份。";

  return {
    title: "回环噬灵 · 重入防御修炼草案",
    formalType: "Classic Reentrancy",
    realm: context.realm.realm,
    primaryElement: context.elements.primaryElement,
    learningObjectives: [
      "识别状态更新之前发生的危险外部价值调用。",
      "理解 receive/fallback 回调如何再次进入提款函数。",
      "使用 Checks-Effects-Interactions 重排状态与外部交互。",
    ],
    scenario: `${sampleQualification} 学习者需要沿资金回环定位重入根因，并以明确的状态顺序完成修复。`,
    dangerousCodeFocus: [
      "提款函数中的低级 native-value call",
      "外部调用之后才更新的内部余额",
      "攻击回调中的重复提款调用",
    ],
    attackReplaySteps: [
      "攻击合约建立可提款余额。",
      "目标在内部余额尚未更新时执行外部价值调用。",
      "攻击回调再次调用提款函数。",
      "同一旧余额可在状态更新前被重复读取。",
    ],
    classificationChallenge:
      "判断该路径是否同时具备外部调用、回调重入与延迟状态更新。",
    repairSequence: ["Checks", "Effects", "Interactions"],
    verificationChecklist: [
      "状态更新发生在外部调用之前。",
      "同类回调重入不再重复提款。",
      "正常提款路径仍可工作。",
      "人工复核证据来源、局限和严重度分项。",
    ],
    evidenceReferences: context.signals
      .filter((entry) => entry.matched)
      .map((entry) => entry.id),
    knownLimitations: context.limitations,
    rewardDraft: "120 EXP · 水属性熟练度 +1 · 水系守护者徽记（待人工审批）",
    reviewStatus: "draft",
  };
}
