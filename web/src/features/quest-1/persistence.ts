import { QUEST_ONE_ATTACK_REPLAY_STEPS } from "@/data/quest-1";

import type {
  BattleState,
  ClassificationAnswers,
  HydratedBattleData,
  MotionMode,
  ReplayStatus,
  StableCheckpoint,
} from "./battle-types";

const PROGRESS_KEY = "chain-security-cultivation:quest-1:v1";
const MOTION_KEY = "chain-security-cultivation:motion-preference:v1";
const STORAGE_VERSION = 3;
const LAST_REPLAY_STEP = QUEST_ONE_ATTACK_REPLAY_STEPS.length - 1;

const CHECKPOINTS: StableCheckpoint[] = [
  "ENTRY",
  "ACT1_READY",
  "ACT2_LOCATE",
  "ACT2_HIT",
  "ACT3_CLASSIFY",
  "ACT3_FORMATION",
  "ACT4_REPLAY",
  "ACT4_COMPLETE",
];
const VERSION_TWO_CHECKPOINTS: StableCheckpoint[] = [
  "ENTRY",
  "ACT1_READY",
  "ACT2_LOCATE",
  "ACT2_HIT",
  "ACT3_CLASSIFY",
  "ACT3_FORMATION",
];
const LEGACY_CHECKPOINTS: StableCheckpoint[] = [
  "ENTRY",
  "ACT1_READY",
  "ACT2_LOCATE",
  "ACT2_HIT",
];
const MOTION_MODES: MotionMode[] = ["system", "full", "reduced"];
const REPLAY_STATUSES: ReplayStatus[] = [
  "idle",
  "playing",
  "paused",
  "complete",
];
const VULNERABILITY_ANSWERS = [
  "classic-reentrancy",
  "access-control",
  "integer-overflow",
] as const;
const ELEMENT_ANSWERS = ["water", "fire", "metal"] as const;
const RISK_ANSWERS = ["High", "Medium", "Low"] as const;

type PersistedBattleProgress = Pick<
  BattleState,
  | "checkpoint"
  | "classificationAnswers"
  | "replayStep"
  | "replayStatus"
  | "viewedReplaySteps"
>;

function emptyClassificationAnswers(): ClassificationAnswers {
  return {
    vulnerability: null,
    element: null,
    risk: null,
  };
}

function createSafeHydratedData(
  motionMode: MotionMode = "system",
): HydratedBattleData {
  return {
    checkpoint: "ENTRY",
    motionMode,
    classificationAnswers: emptyClassificationAnswers(),
    replayStep: 0,
    replayStatus: "idle",
    viewedReplaySteps: [],
  };
}

function isCheckpoint(value: unknown): value is StableCheckpoint {
  return CHECKPOINTS.includes(value as StableCheckpoint);
}

function isMotionMode(value: unknown): value is MotionMode {
  return MOTION_MODES.includes(value as MotionMode);
}

function isReplayStatus(value: unknown): value is ReplayStatus {
  return REPLAY_STATUSES.includes(value as ReplayStatus);
}

function readClassificationAnswers(
  value: unknown,
): ClassificationAnswers | null {
  if (!value || typeof value !== "object") {
    return emptyClassificationAnswers();
  }

  const candidate = value as Record<string, unknown>;
  const vulnerability = candidate.vulnerability;
  const element = candidate.element;
  const risk = candidate.risk;

  if (
    vulnerability !== null &&
    !VULNERABILITY_ANSWERS.includes(
      vulnerability as (typeof VULNERABILITY_ANSWERS)[number],
    )
  ) {
    return null;
  }
  if (
    element !== null &&
    !ELEMENT_ANSWERS.includes(element as (typeof ELEMENT_ANSWERS)[number])
  ) {
    return null;
  }
  if (
    risk !== null &&
    !RISK_ANSWERS.includes(risk as (typeof RISK_ANSWERS)[number])
  ) {
    return null;
  }

  return {
    vulnerability:
      vulnerability as ClassificationAnswers["vulnerability"],
    element: element as ClassificationAnswers["element"],
    risk: risk as ClassificationAnswers["risk"],
  };
}

function classificationIsCorrect(answers: ClassificationAnswers): boolean {
  return (
    answers.vulnerability === "classic-reentrancy" &&
    answers.element === "water" &&
    answers.risk === "High"
  );
}

function isValidReplayStep(value: unknown): value is number {
  return (
    Number.isInteger(value) &&
    Number(value) >= 0 &&
    Number(value) <= LAST_REPLAY_STEP
  );
}

function sanitizeViewedReplaySteps(value: unknown): number[] {
  if (!Array.isArray(value)) return [];

  return [...new Set(value)]
    .filter(isValidReplayStep)
    .sort((a, b) => a - b);
}

function replayIsFullyViewed(viewedSteps: number[]): boolean {
  return QUEST_ONE_ATTACK_REPLAY_STEPS.every((step) =>
    viewedSteps.includes(step.id),
  );
}

function migrateVersionTwo(
  parsed: Record<string, unknown>,
  hydrated: HydratedBattleData,
): void {
  if (
    !VERSION_TWO_CHECKPOINTS.includes(
      parsed.checkpoint as StableCheckpoint,
    )
  ) {
    return;
  }

  const checkpoint = parsed.checkpoint as StableCheckpoint;
  const storedAnswers = readClassificationAnswers(
    parsed.classificationAnswers,
  );

  if (!storedAnswers) {
    hydrated.checkpoint =
      checkpoint === "ACT3_CLASSIFY" || checkpoint === "ACT3_FORMATION"
        ? "ACT2_HIT"
        : "ENTRY";
    return;
  }

  hydrated.checkpoint = checkpoint;
  hydrated.classificationAnswers = storedAnswers;
  if (
    checkpoint === "ACT3_FORMATION" &&
    !classificationIsCorrect(storedAnswers)
  ) {
    hydrated.checkpoint = "ACT3_CLASSIFY";
  }
}

function restoreVersionThree(
  parsed: Record<string, unknown>,
  hydrated: HydratedBattleData,
): void {
  if (!isCheckpoint(parsed.checkpoint)) return;

  const checkpoint = parsed.checkpoint;
  const storedAnswers = readClassificationAnswers(
    parsed.classificationAnswers,
  );
  if (!storedAnswers) {
    hydrated.checkpoint =
      checkpoint === "ACT3_CLASSIFY" ||
      checkpoint === "ACT3_FORMATION" ||
      checkpoint === "ACT4_REPLAY" ||
      checkpoint === "ACT4_COMPLETE"
        ? "ACT2_HIT"
        : "ENTRY";
    return;
  }

  hydrated.checkpoint = checkpoint;
  hydrated.classificationAnswers = storedAnswers;

  if (
    (checkpoint === "ACT3_FORMATION" ||
      checkpoint === "ACT4_REPLAY" ||
      checkpoint === "ACT4_COMPLETE") &&
    !classificationIsCorrect(storedAnswers)
  ) {
    hydrated.checkpoint = "ACT3_CLASSIFY";
    return;
  }

  if (checkpoint !== "ACT4_REPLAY" && checkpoint !== "ACT4_COMPLETE") {
    return;
  }

  if (!isValidReplayStep(parsed.replayStep)) {
    hydrated.checkpoint = "ACT3_FORMATION";
    return;
  }

  const viewedReplaySteps = sanitizeViewedReplaySteps(
    parsed.viewedReplaySteps,
  );
  if (!viewedReplaySteps.includes(parsed.replayStep)) {
    viewedReplaySteps.push(parsed.replayStep);
    viewedReplaySteps.sort((a, b) => a - b);
  }

  hydrated.replayStep = parsed.replayStep;
  hydrated.viewedReplaySteps = viewedReplaySteps;

  if (
    checkpoint === "ACT4_COMPLETE" &&
    !replayIsFullyViewed(viewedReplaySteps)
  ) {
    hydrated.checkpoint = "ACT4_REPLAY";
    hydrated.replayStatus = "paused";
    return;
  }

  if (checkpoint === "ACT4_COMPLETE") {
    hydrated.replayStep = LAST_REPLAY_STEP;
    hydrated.replayStatus = "complete";
    return;
  }

  const storedStatus = isReplayStatus(parsed.replayStatus)
    ? parsed.replayStatus
    : "paused";
  hydrated.replayStatus =
    storedStatus === "playing"
      ? "paused"
      : storedStatus === "complete" &&
          !replayIsFullyViewed(viewedReplaySteps)
        ? "paused"
        : storedStatus;
}

export function loadBattleData(): HydratedBattleData {
  const hydrated = createSafeHydratedData();

  try {
    const storedProgress = window.localStorage.getItem(PROGRESS_KEY);
    if (storedProgress) {
      const parsed = JSON.parse(storedProgress) as Record<string, unknown>;

      if (
        parsed.version === 1 &&
        LEGACY_CHECKPOINTS.includes(parsed.checkpoint as StableCheckpoint)
      ) {
        hydrated.checkpoint = parsed.checkpoint as StableCheckpoint;
      } else if (parsed.version === 2) {
        migrateVersionTwo(parsed, hydrated);
      } else if (parsed.version === STORAGE_VERSION) {
        restoreVersionThree(parsed, hydrated);
      }
    }
  } catch {
    // Corrupt or unavailable progress falls back to the safe initial checkpoint.
  }

  try {
    const storedMotion = window.localStorage.getItem(MOTION_KEY);
    if (isMotionMode(storedMotion)) {
      hydrated.motionMode = storedMotion;
    }
  } catch {
    // Motion preference falls back to the system setting.
  }

  return hydrated;
}

export function saveBattleProgress(
  progress: PersistedBattleProgress,
): void {
  try {
    window.localStorage.setItem(
      PROGRESS_KEY,
      JSON.stringify({
        version: STORAGE_VERSION,
        checkpoint: progress.checkpoint,
        classificationAnswers: progress.classificationAnswers,
        replayStep: progress.replayStep,
        replayStatus: progress.replayStatus,
        viewedReplaySteps: progress.viewedReplaySteps,
      }),
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
