import {
  QUEST_ONE_ATTACK_REPLAY_STEPS,
  QUEST_ONE_CLASSIFICATION_CORRECT,
  QUEST_ONE_CODE_LINES,
  QUEST_ONE_REPAIR_CORRECT_ORDER,
  QUEST_ONE_REPAIR_INITIAL_ORDER,
} from "@/data/quest-1";

import type {
  BattleEvent,
  BattleState,
  ClassificationAnswers,
  ClassificationResults,
  HydratedBattleData,
  MotionMode,
  RepairBlockId,
  ReplayStatus,
} from "./battle-types";

const LAST_REPLAY_STEP = QUEST_ONE_ATTACK_REPLAY_STEPS.length - 1;

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

function addViewedReplayStep(viewedSteps: number[], step: number): number[] {
  return viewedSteps.includes(step)
    ? viewedSteps
    : [...viewedSteps, step].sort((a, b) => a - b);
}

function replayIsFullyViewed(viewedSteps: number[]): boolean {
  return QUEST_ONE_ATTACK_REPLAY_STEPS.every((step) =>
    viewedSteps.includes(step.id),
  );
}

function getReplayStatus(
  viewedSteps: number[],
  fallback: ReplayStatus,
): ReplayStatus {
  return replayIsFullyViewed(viewedSteps) ? "complete" : fallback;
}

function repairOrderIsCorrect(order: RepairBlockId[]): boolean {
  return QUEST_ONE_REPAIR_CORRECT_ORDER.every(
    (blockId, index) => order[index] === blockId,
  );
}

function createCompletedReplayState(): Pick<
  BattleState,
  | "selectedCodeLineId"
  | "codeFeedback"
  | "classificationAnswers"
  | "classificationResults"
  | "classificationFeedback"
  | "replayStep"
  | "replayStatus"
  | "viewedReplaySteps"
> {
  return {
    selectedCodeLineId: "external-call",
    codeFeedback: "correct",
    classificationAnswers: { ...QUEST_ONE_CLASSIFICATION_CORRECT },
    classificationResults: {
      vulnerability: true,
      element: true,
      risk: true,
    },
    classificationFeedback: "correct",
    replayStep: LAST_REPLAY_STEP,
    replayStatus: "complete",
    viewedReplaySteps: QUEST_ONE_ATTACK_REPLAY_STEPS.map((step) => step.id),
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
    replayStep: 0,
    replayStatus: "idle",
    viewedReplaySteps: [],
    repairOrder: [...QUEST_ONE_REPAIR_INITIAL_ORDER],
    repairFeedback: null,
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
    case "ACT4_REPLAY":
      return {
        ...base,
        phase: "ACT4_REPLAY",
        checkpoint: "ACT4_REPLAY",
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
        replayStep: payload.replayStep,
        replayStatus: payload.replayStatus,
        viewedReplaySteps: payload.viewedReplaySteps,
      };
    case "ACT4_COMPLETE":
      return {
        ...base,
        ...createCompletedReplayState(),
        phase: "ACT4_COMPLETE",
        checkpoint: "ACT4_COMPLETE",
        bossHp: 50,
      };
    case "ACT5_REPAIR":
      return {
        ...base,
        ...createCompletedReplayState(),
        phase: "ACT5_REPAIR",
        checkpoint: "ACT5_REPAIR",
        bossHp: 50,
        repairOrder: payload.repairOrder,
      };
    case "ACT5_COMPLETE":
      return {
        ...base,
        ...createCompletedReplayState(),
        phase: "ACT5_COMPLETE",
        checkpoint: "ACT5_COMPLETE",
        bossHp: 0,
        repairOrder: [...QUEST_ONE_REPAIR_CORRECT_ORDER],
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

    case "ENTER_ATTACK_REPLAY":
      if (
        state.phase !== "ACT3_FORMATION" ||
        state.checkpoint !== "ACT3_FORMATION" ||
        state.transitionLocked
      ) {
        return state;
      }
      return {
        ...state,
        phase: "ACT4_REPLAY",
        checkpoint: "ACT4_REPLAY",
        bossHp: 50,
        replayStep: 0,
        replayStatus: "idle",
        viewedReplaySteps: [0],
      };

    case "REPLAY_PLAY":
      if (
        state.phase !== "ACT4_REPLAY" ||
        state.transitionLocked ||
        state.replayStatus === "playing" ||
        state.replayStep >= LAST_REPLAY_STEP
      ) {
        return state;
      }
      return {
        ...state,
        bossHp: 50,
        replayStatus: "playing",
      };

    case "REPLAY_PAUSE":
      if (
        state.phase !== "ACT4_REPLAY" ||
        state.replayStatus !== "playing"
      ) {
        return state;
      }
      return {
        ...state,
        bossHp: 50,
        replayStatus: "paused",
      };

    case "REPLAY_NEXT": {
      if (
        state.phase !== "ACT4_REPLAY" ||
        state.transitionLocked ||
        state.replayStep >= LAST_REPLAY_STEP
      ) {
        return state;
      }
      const replayStep = state.replayStep + 1;
      const viewedReplaySteps = addViewedReplayStep(
        state.viewedReplaySteps,
        replayStep,
      );
      return {
        ...state,
        bossHp: 50,
        replayStep,
        replayStatus: getReplayStatus(viewedReplaySteps, "paused"),
        viewedReplaySteps,
      };
    }

    case "REPLAY_PREVIOUS": {
      if (
        state.phase !== "ACT4_REPLAY" ||
        state.transitionLocked ||
        state.replayStep <= 0
      ) {
        return state;
      }
      const replayStep = state.replayStep - 1;
      const viewedReplaySteps = addViewedReplayStep(
        state.viewedReplaySteps,
        replayStep,
      );
      return {
        ...state,
        bossHp: 50,
        replayStep,
        replayStatus: getReplayStatus(viewedReplaySteps, "paused"),
        viewedReplaySteps,
      };
    }

    case "REPLAY_RESTART":
      if (state.phase !== "ACT4_REPLAY" || state.transitionLocked) {
        return state;
      }
      return {
        ...state,
        bossHp: 50,
        replayStep: 0,
        replayStatus: replayIsFullyViewed(state.viewedReplaySteps)
          ? "complete"
          : "idle",
        viewedReplaySteps: addViewedReplayStep(state.viewedReplaySteps, 0),
      };

    case "REPLAY_STEP_FINISHED": {
      if (
        state.phase !== "ACT4_REPLAY" ||
        state.replayStatus !== "playing"
      ) {
        return state;
      }

      if (state.replayStep >= LAST_REPLAY_STEP) {
        return {
          ...state,
          bossHp: 50,
          replayStatus: getReplayStatus(
            state.viewedReplaySteps,
            "paused",
          ),
        };
      }

      const replayStep = state.replayStep + 1;
      const viewedReplaySteps = addViewedReplayStep(
        state.viewedReplaySteps,
        replayStep,
      );
      return {
        ...state,
        bossHp: 50,
        replayStep,
        replayStatus:
          replayStep === LAST_REPLAY_STEP
            ? getReplayStatus(viewedReplaySteps, "paused")
            : "playing",
        viewedReplaySteps,
      };
    }

    case "CONFIRM_ATTACK_REPLAY":
      if (
        state.phase !== "ACT4_REPLAY" ||
        state.transitionLocked ||
        !replayIsFullyViewed(state.viewedReplaySteps)
      ) {
        return state;
      }
      return {
        ...state,
        phase: "ACT4_COMPLETE",
        checkpoint: "ACT4_COMPLETE",
        bossHp: 50,
        replayStep: LAST_REPLAY_STEP,
        replayStatus: "complete",
        viewedReplaySteps: QUEST_ONE_ATTACK_REPLAY_STEPS.map(
          (step) => step.id,
        ),
      };

    case "ENTER_REPAIR_STAGE":
      if (
        state.phase !== "ACT4_COMPLETE" ||
        state.checkpoint !== "ACT4_COMPLETE" ||
        state.transitionLocked
      ) {
        return state;
      }
      return {
        ...state,
        phase: "ACT5_REPAIR",
        checkpoint: "ACT5_REPAIR",
        bossHp: 50,
        repairOrder: [...QUEST_ONE_REPAIR_INITIAL_ORDER],
        repairFeedback: null,
      };

    case "MOVE_REPAIR_BLOCK": {
      if (state.phase !== "ACT5_REPAIR" || state.transitionLocked) {
        return state;
      }

      const currentIndex = state.repairOrder.indexOf(event.blockId);
      if (currentIndex < 0) return state;

      const targetIndex =
        event.direction === "up" ? currentIndex - 1 : currentIndex + 1;
      if (targetIndex < 0 || targetIndex >= state.repairOrder.length) {
        return state;
      }

      const repairOrder = [...state.repairOrder];
      [repairOrder[currentIndex], repairOrder[targetIndex]] = [
        repairOrder[targetIndex],
        repairOrder[currentIndex],
      ];

      return {
        ...state,
        bossHp: 50,
        repairOrder,
        repairFeedback: null,
      };
    }

    case "RESET_REPAIR_ORDER":
      if (state.phase !== "ACT5_REPAIR" || state.transitionLocked) {
        return state;
      }
      return {
        ...state,
        bossHp: 50,
        repairOrder: [...QUEST_ONE_REPAIR_INITIAL_ORDER],
        repairFeedback: null,
      };

    case "SUBMIT_REPAIR":
      if (state.phase !== "ACT5_REPAIR" || state.transitionLocked) {
        return state;
      }

      if (!repairOrderIsCorrect(state.repairOrder)) {
        return {
          ...state,
          bossHp: 50,
          repairFeedback: "invalid",
        };
      }

      return {
        ...state,
        phase: "ACT5_SEALING",
        bossHp: 50,
        repairFeedback: null,
        transitionLocked: true,
      };

    case "SEAL_ANIMATION_FINISHED":
      if (state.phase !== "ACT5_SEALING" || !state.transitionLocked) {
        return state;
      }
      return {
        ...state,
        phase: "ACT5_COMPLETE",
        checkpoint: "ACT5_COMPLETE",
        bossHp: 0,
        repairOrder: [...QUEST_ONE_REPAIR_CORRECT_ORDER],
        repairFeedback: null,
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
