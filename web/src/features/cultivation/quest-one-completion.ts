import { getAddress, keccak256, stringToHex } from "viem";

import {
  QUEST_ONE,
  QUEST_ONE_ATTACK_REPLAY_STEPS,
  QUEST_ONE_CLASSIFICATION_CORRECT,
  QUEST_ONE_REPAIR_CORRECT_ORDER,
} from "@/data/quest-1";

import {
  CULTIVATION_COMPLETION_SCHEMA_VERSION,
  QUEST_ONE_COMPLETION_EVIDENCE_SCHEMA_VERSION,
  type QuestOneCompletionEvidence,
} from "./contracts";
import { CultivationHttpError } from "./errors";

function exactObject(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new CultivationHttpError("INVALID_REQUEST");
  }
  const object = value as Record<string, unknown>;
  const actual = Object.keys(object).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new CultivationHttpError("INVALID_REQUEST");
  }
  return object;
}

function stringValue(value: unknown): string {
  if (typeof value !== "string" || value.length === 0 || value.includes("\u0000")) {
    throw new CultivationHttpError("INVALID_REQUEST");
  }
  return value;
}

export function parseQuestOneCompletionEvidence(value: unknown): QuestOneCompletionEvidence {
  const root = exactObject(value, [
    "schemaVersion",
    "selectedCodeLineId",
    "classification",
    "viewedReplaySteps",
    "repairOrder",
  ]);
  if (root.schemaVersion !== QUEST_ONE_COMPLETION_EVIDENCE_SCHEMA_VERSION) {
    throw new CultivationHttpError("INVALID_REQUEST");
  }
  const classification = exactObject(root.classification, ["vulnerability", "element", "risk"]);
  if (!Array.isArray(root.viewedReplaySteps) || !root.viewedReplaySteps.every(Number.isSafeInteger)) {
    throw new CultivationHttpError("INVALID_REQUEST");
  }
  if (!Array.isArray(root.repairOrder) || !root.repairOrder.every((item) => typeof item === "string")) {
    throw new CultivationHttpError("INVALID_REQUEST");
  }
  return {
    schemaVersion: QUEST_ONE_COMPLETION_EVIDENCE_SCHEMA_VERSION,
    selectedCodeLineId: stringValue(root.selectedCodeLineId),
    classification: {
      vulnerability: stringValue(classification.vulnerability),
      element: stringValue(classification.element),
      risk: stringValue(classification.risk),
    },
    viewedReplaySteps: [...root.viewedReplaySteps] as number[],
    repairOrder: [...root.repairOrder] as string[],
  };
}

export function validateQuestOneCompletionEvidence(evidence: QuestOneCompletionEvidence): void {
  const expectedReplay = QUEST_ONE_ATTACK_REPLAY_STEPS.map((step) => step.id);
  const viewedReplay = [...new Set(evidence.viewedReplaySteps)].sort((a, b) => a - b);
  const valid =
    evidence.selectedCodeLineId === "external-call" &&
    evidence.classification.vulnerability === QUEST_ONE_CLASSIFICATION_CORRECT.vulnerability &&
    evidence.classification.element === QUEST_ONE_CLASSIFICATION_CORRECT.element &&
    evidence.classification.risk === QUEST_ONE_CLASSIFICATION_CORRECT.risk &&
    viewedReplay.length === expectedReplay.length &&
    viewedReplay.every((step, index) => step === expectedReplay[index]) &&
    evidence.repairOrder.length === QUEST_ONE_REPAIR_CORRECT_ORDER.length &&
    evidence.repairOrder.every((block, index) => block === QUEST_ONE_REPAIR_CORRECT_ORDER[index]);
  if (!valid) throw new CultivationHttpError("EVIDENCE_INVALID");
}

function canonicalEvidence(evidence: QuestOneCompletionEvidence) {
  return {
    schemaVersion: QUEST_ONE_COMPLETION_EVIDENCE_SCHEMA_VERSION,
    questId: QUEST_ONE.id,
    selectedCodeLineId: evidence.selectedCodeLineId,
    classification: {
      vulnerability: evidence.classification.vulnerability,
      element: evidence.classification.element,
      risk: evidence.classification.risk,
    },
    viewedReplaySteps: [...new Set(evidence.viewedReplaySteps)].sort((a, b) => a - b),
    repairOrder: [...evidence.repairOrder],
  };
}

export function questOneEvidenceHash(evidence: QuestOneCompletionEvidence): `0x${string}` {
  return keccak256(stringToHex(JSON.stringify(canonicalEvidence(evidence))));
}

export function prepareQuestOneCompletion(wallet: string, evidence: QuestOneCompletionEvidence) {
  validateQuestOneCompletionEvidence(evidence);
  const normalizedWallet = getAddress(wallet).toLowerCase();
  const evidenceHash = questOneEvidenceHash(evidence);
  const commitment = {
    schemaVersion: CULTIVATION_COMPLETION_SCHEMA_VERSION,
    wallet: normalizedWallet,
    questId: QUEST_ONE.id,
    questContentHash: QUEST_ONE.contentHash,
    evidenceHash,
    reward: {
      exp: QUEST_ONE.exp,
      masteryElement: QUEST_ONE.elementMachine,
      mastery: QUEST_ONE.mastery,
      badgeKey: QUEST_ONE.badgeKey,
    },
  } as const;
  return {
    normalizedWallet,
    evidenceHash,
    commitment,
    completionHash: keccak256(stringToHex(JSON.stringify(commitment))),
  };
}
