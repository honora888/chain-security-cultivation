import { QUEST_ONE_CODE_LINES } from "@/data/quest-1";

import type {
  BattleEvent,
  BattleState,
  HydratedBattleData,
  MotionMode,
} from "./battle-types";

export function createInitialBattleState(
  motionMode: MotionMode = "system",
): BattleState {
  return {
    phase: "ENTRY",
    checkpoint: "ENTRY",
    bossHp: 100,
    selectedCodeLineId: null,
    codeFeedback: null,
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
