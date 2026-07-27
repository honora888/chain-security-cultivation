export type BattlePhase =
  | "ENTRY"
  | "ACT1_APPEARING"
  | "ACT1_READY"
  | "ACT2_LOCATE"
  | "ACT2_WRONG"
  | "ACT2_PARTIAL"
  | "ACT2_HIT"
  | "ACT3_CLASSIFY"
  | "ACT3_INCORRECT"
  | "ACT3_FORMATION"
  | "ACT4_REPLAY"
  | "ACT4_PAUSED"
  | "ACT4_COMPLETE"
  | "ACT5_REPAIR"
  | "ACT5_INVALID_ORDER"
  | "ACT5_SEALING"
  | "ACT6_REWARDING"
  | "ACT6_COMPLETE"
  | "BESTIARY_OPEN"
  | "CHAIN_DRAWER_OPEN";

export type StableCheckpoint =
  | "ENTRY"
  | "ACT1_READY"
  | "ACT2_LOCATE"
  | "ACT2_HIT"
  | "ACT3_CLASSIFY"
  | "ACT3_FORMATION";

export type BossHp = 100 | 75 | 50 | 0;
export type MotionMode = "system" | "full" | "reduced";
export type CodeVerdict = "wrong" | "partial" | "correct";
export type ClassificationField = "vulnerability" | "element" | "risk";
export type VulnerabilityAnswer =
  | "classic-reentrancy"
  | "access-control"
  | "integer-overflow";
export type ElementAnswer = "water" | "fire" | "metal";
export type RiskAnswer = "High" | "Medium" | "Low";
export type ClassificationFeedback =
  | "incomplete"
  | "incorrect"
  | "correct"
  | null;

export interface ClassificationAnswers {
  vulnerability: VulnerabilityAnswer | null;
  element: ElementAnswer | null;
  risk: RiskAnswer | null;
}

export type ClassificationResults = Record<
  ClassificationField,
  boolean | null
>;

export interface CodeLine {
  id: string;
  lineNumber: number;
  code: string;
  verdict: CodeVerdict;
}

export interface BattleState {
  phase: BattlePhase;
  checkpoint: StableCheckpoint;
  bossHp: BossHp;
  selectedCodeLineId: string | null;
  codeFeedback: CodeVerdict | null;
  classificationAnswers: ClassificationAnswers;
  classificationResults: ClassificationResults;
  classificationFeedback: ClassificationFeedback;
  transitionLocked: boolean;
  hydrated: boolean;
  motionMode: MotionMode;
}

export interface HydratedBattleData {
  checkpoint: StableCheckpoint;
  motionMode: MotionMode;
  classificationAnswers: ClassificationAnswers;
}

export type BattleEvent =
  | { type: "HYDRATE"; payload: HydratedBattleData }
  | { type: "ENTER_QUEST" }
  | {
      type: "ANIMATION_FINISHED";
      animation: "beast-entry" | "code-strike";
    }
  | { type: "START_BATTLE" }
  | { type: "SELECT_CODE_LINE"; lineId: string }
  | { type: "CONFIRM_CODE_LINE" }
  | { type: "CODE_FEEDBACK_FINISHED" }
  | { type: "ENTER_CLASSIFICATION" }
  | {
      type: "SET_CLASSIFICATION";
      field: ClassificationField;
      value: VulnerabilityAnswer | ElementAnswer | RiskAnswer;
    }
  | { type: "SUBMIT_CLASSIFICATION" }
  | { type: "CLASSIFICATION_FEEDBACK_FINISHED" }
  | { type: "SET_MOTION_MODE"; mode: MotionMode }
  | { type: "RESET_QUEST" };
