import type {
  HydratedBattleData,
  MotionMode,
  StableCheckpoint,
} from "./battle-types";

const PROGRESS_KEY = "chain-security-cultivation:quest-1:v1";
const MOTION_KEY = "chain-security-cultivation:motion-preference:v1";

const CHECKPOINTS: StableCheckpoint[] = [
  "ENTRY",
  "ACT1_READY",
  "ACT2_LOCATE",
  "ACT2_HIT",
];
const MOTION_MODES: MotionMode[] = ["system", "full", "reduced"];

function isCheckpoint(value: unknown): value is StableCheckpoint {
  return CHECKPOINTS.includes(value as StableCheckpoint);
}

function isMotionMode(value: unknown): value is MotionMode {
  return MOTION_MODES.includes(value as MotionMode);
}

export function loadBattleData(): HydratedBattleData {
  let checkpoint: StableCheckpoint = "ENTRY";
  let motionMode: MotionMode = "system";

  try {
    const storedProgress = window.localStorage.getItem(PROGRESS_KEY);
    if (storedProgress) {
      const parsed = JSON.parse(storedProgress) as {
        version?: unknown;
        checkpoint?: unknown;
      };
      if (parsed.version === 1 && isCheckpoint(parsed.checkpoint)) {
        checkpoint = parsed.checkpoint;
      }
    }

    const storedMotion = window.localStorage.getItem(MOTION_KEY);
    if (isMotionMode(storedMotion)) {
      motionMode = storedMotion;
    }
  } catch {
    // Corrupt or unavailable storage falls back to the safe initial checkpoint.
  }

  return { checkpoint, motionMode };
}

export function saveCheckpoint(checkpoint: StableCheckpoint): void {
  try {
    window.localStorage.setItem(
      PROGRESS_KEY,
      JSON.stringify({ version: 1, checkpoint }),
    );
  } catch {
    // The battle remains usable when storage is blocked.
  }
}

export function saveMotionMode(mode: MotionMode): void {
  try {
    window.localStorage.setItem(MOTION_KEY, mode);
  } catch {
    // Motion preference falls back to the current session.
  }
}

export function clearBattleProgress(): void {
  try {
    window.localStorage.removeItem(PROGRESS_KEY);
  } catch {
    // Reset still applies to in-memory state.
  }
}
