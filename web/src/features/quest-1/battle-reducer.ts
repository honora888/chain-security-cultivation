import {
  QUEST_ONE_CLASSIFICATION_CORRECT,
  QUEST_ONE_CODE_LINES,
} from "@/data/quest-1";

import type {
  BattleEvent,
  BattleState,
  ClassificationAnswers,
  ClassificationResults,
  HydratedBattleData,
  MotionMode,
} from "./battle-types";

function createEmptyClassificationAnswers(): ClassificationAnswers {
  return {
    vulnerability: null,
    element: null,
    risk: null,
  };
}

function createEmptyClassificationResults(): ClassificationResults {
  return {
    vulnerability: null,
    element: null,
    risk: null,
  };
}

export function createInitialBattleState(
  motionMode: MotionMode = "system",
): BattleState {
  return {
    phase: "ENTRY",
    checkpoint: "ENTRY",
    bossHp: 100,
    selectedCodeLineId: null,
    codeFeedback: null,
    classificationAnswers: createEmptyClassificationAnswers(),
    classificationResults: createEmptyClassificationResults(),
    classificationFeedback: null,
    transitionLocked: false,
    hydrated: false,
    motionMode,
  };
}

function restoreCheckpoint(payload: HydratedBattleData): BattleState {
  const base = {
    ...createInitialBattleState(payload.motionMode),
    hydrated: true,
  };

  switch (payload.checkpoint) {
    case "ACT1_READY":
      return {
        ...base,
        phase: "ACT1_READY",
        checkpoint: "ACT1_READY",
      };
    case "ACT2_LOCATE":
      return {
        ...base,
        phase: "ACT2_LOCATE",
        checkpoint: "ACT2_LOCATE",
      };
    case "ACT2_HIT":
      return {
        ...base,
        phase: "ACT2_HIT",
        checkpoint: "ACT2_HIT",
        bossHp: 75,
        selectedCodeLineId: "external-call",
        codeFeedback: "correct",
      };
    case "ACT3_CLASSIFY":
      return {
        ...base,
        phase: "ACT3_CLASSIFY",
        checkpoint: "ACT3_CLASSIFY",
        bossHp: 75,
        selectedCodeLineId: "external-call",
        codeFeedback: "correct",
        classificationAnswers: payload.classificationAnswers,
      };
    case "ACT3_FORMATION":
      return {
        ...base,
        phase: "ACT3_FORMATION",
        checkpoint: "ACT3_FORMATION",
        bossHp: 50,
        selectedCodeLineId: "external-call",
        codeFeedback: "correct",
        classificationAnswers: { ...QUEST_ONE_CLASSIFICATION_CORRECT },
        classificationResults: {
          vulnerability: true,
          element: true,
          risk: true,
        },
        classificationFeedback: "correct",
      };
    case "ENTRY":
    default:
      return base;
  }
}

export function battleReducer(
  state: BattleState,
  event: BattleEvent,
): BattleState {
  switch (event.type) {
    case "HYDRATE":
      return restoreCheckpoint(event.payload);

    case "ENTER_QUEST":
      if (!state.hydrated || state.phase !== "ENTRY") return state;
      return {
        ...state,
        phase: "ACT1_APPEARING",
        transitionLocked: true,
      };

    case "ANIMATION_FINISHED":
      if (
        event.animation === "beast-entry" &&
        state.phase === "ACT1_APPEARING"
      ) {
        return {
          ...state,
          phase: "ACT1_READY",
          checkpoint: "ACT1_READY",
          transitionLocked: false,
        };
      }

      if (event.animation === "code-strike" && state.phase === "ACT2_HIT") {
        return {
          ...state,
          checkpoint: "ACT2_HIT",
          transitionLocked: false,
        };
      }

      return state;

    case "START_BATTLE":
      if (state.phase !== "ACT1_READY" || state.transitionLocked) return state;
      return {
        ...state,
        phase: "ACT2_LOCATE",
        checkpoint: "ACT2_LOCATE",
        selectedCodeLineId: null,
        codeFeedback: null,
      };

    case "SELECT_CODE_LINE":
      if (state.phase !== "ACT2_LOCATE" || state.transitionLocked) return state;
      return {
        ...state,
        selectedCodeLineId: event.lineId,
        codeFeedback: null,
      };

    case "CONFIRM_CODE_LINE": {
      if (
        state.phase !== "ACT2_LOCATE" ||
        !state.selectedCodeLineId ||
        state.transitionLocked
      ) {
        return state;
      }

      const selectedLine = QUEST_ONE_CODE_LINES.find(
        (line) => line.id === state.selectedCodeLineId,
      );
      if (!selectedLine) return state;

      if (selectedLine.verdict === "correct") {
        return {
          ...state,
          phase: "ACT2_HIT",
          bossHp: 75,
          codeFeedback: "correct",
          transitionLocked: true,
        };
      }

      return {
        ...state,
        phase:
          selectedLine.verdict === "partial" ? "ACT2_PARTIAL" : "ACT2_WRONG",
        codeFeedback: selectedLine.verdict,
        transitionLocked: true,
      };
    }

    case "CODE_FEEDBACK_FINISHED":
      if (state.phase !== "ACT2_WRONG" && state.phase !== "ACT2_PARTIAL") {
        return state;
      }
      return {
        ...state,
        phase: "ACT2_LOCATE",
        transitionLocked: false,
      };

    case "ENTER_CLASSIFICATION":
      if (state.phase !== "ACT2_HIT" || state.transitionLocked) return state;
      return {
        ...state,
        phase: "ACT3_CLASSIFY",
        checkpoint: "ACT3_CLASSIFY",
        classificationFeedback: null,
        classificationResults: createEmptyClassificationResults(),
      };

    case "SET_CLASSIFICATION":
      if (state.phase !== "ACT3_CLASSIFY" || state.transitionLocked) {
        return state;
      }
      return {
        ...state,
        classificationAnswers: {
          ...state.classificationAnswers,
          [event.field]: event.value,
        },
        classificationResults: {
          ...state.classificationResults,
          [event.field]: null,
        },
        classificationFeedback: null,
      };

    case "SUBMIT_CLASSIFICATION": {
      if (state.phase !== "ACT3_CLASSIFY" || state.transitionLocked) {
        return state;
      }

      const { vulnerability, element, risk } = state.classificationAnswers;
      if (!vulnerability || !element || !risk) {
        return {
          ...state,
          classificationFeedback: "incomplete",
        };
      }

      const classificationResults: ClassificationResults = {
        vulnerability:
          vulnerability === QUEST_ONE_CLASSIFICATION_CORRECT.vulnerability,
        element: element === QUEST_ONE_CLASSIFICATION_CORRECT.element,
        risk: risk === QUEST_ONE_CLASSIFICATION_CORRECT.risk,
      };
      const allCorrect = Object.values(classificationResults).every(Boolean);

      if (!allCorrect) {
        return {
          ...state,
          classificationResults,
          classificationFeedback: "incorrect",
        };
      }

      return {
        ...state,
        phase: "ACT3_FORMATION",
        bossHp: 50,
        classificationResults,
        classificationFeedback: "correct",
        transitionLocked: true,
      };
    }

    case "CLASSIFICATION_FEEDBACK_FINISHED":
      if (
        state.phase !== "ACT3_FORMATION" ||
        state.checkpoint === "ACT3_FORMATION"
      ) {
        return state;
      }
      return {
        ...state,
        checkpoint: "ACT3_FORMATION",
        transitionLocked: false,
      };

    case "SET_MOTION_MODE":
      return { ...state, motionMode: event.mode };

    case "RESET_QUEST":
      return {
        ...createInitialBattleState(state.motionMode),
        hydrated: true,
      };

    default:
      return state;
  }
}
