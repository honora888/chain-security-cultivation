import type {
  ClassificationAnswers,
  HydratedBattleData,
  MotionMode,
  StableCheckpoint,
} from "./battle-types";

const PROGRESS_KEY = "chain-security-cultivation:quest-1:v1";
const MOTION_KEY = "chain-security-cultivation:motion-preference:v1";
const STORAGE_VERSION = 2;

const CHECKPOINTS: StableCheckpoint[] = [
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
const VULNERABILITY_ANSWERS = [
  "classic-reentrancy",
  "access-control",
  "integer-overflow",
] as const;
const ELEMENT_ANSWERS = ["water", "fire", "metal"] as const;
const RISK_ANSWERS = ["High", "Medium", "Low"] as const;

function emptyClassificationAnswers(): ClassificationAnswers {
  return {
    vulnerability: null,
    element: null,
    risk: null,
  };
}

function isCheckpoint(value: unknown): value is StableCheckpoint {
  return CHECKPOINTS.includes(value as StableCheckpoint);
}

function isMotionMode(value: unknown): value is MotionMode {
  return MOTION_MODES.includes(value as MotionMode);
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

export function loadBattleData(): HydratedBattleData {
  let checkpoint: StableCheckpoint = "ENTRY";
  let motionMode: MotionMode = "system";
  let classificationAnswers = emptyClassificationAnswers();

  try {
    const storedProgress = window.localStorage.getItem(PROGRESS_KEY);
    if (storedProgress) {
      const parsed = JSON.parse(storedProgress) as {
        version?: unknown;
        checkpoint?: unknown;
        classificationAnswers?: unknown;
      };

      if (
        parsed.version === 1 &&
        LEGACY_CHECKPOINTS.includes(parsed.checkpoint as StableCheckpoint)
      ) {
        checkpoint = parsed.checkpoint as StableCheckpoint;
      } else if (
        parsed.version === STORAGE_VERSION &&
        isCheckpoint(parsed.checkpoint)
      ) {
        const storedAnswers = readClassificationAnswers(
          parsed.classificationAnswers,
        );
        if (storedAnswers) {
          checkpoint = parsed.checkpoint;
          classificationAnswers = storedAnswers;

          if (
            checkpoint === "ACT3_FORMATION" &&
            !classificationIsCorrect(classificationAnswers)
          ) {
            checkpoint = "ACT3_CLASSIFY";
          }
        } else {
          checkpoint =
            parsed.checkpoint === "ACT3_CLASSIFY" ||
            parsed.checkpoint === "ACT3_FORMATION"
              ? "ACT2_HIT"
              : "ENTRY";
        }
      }
    }

    const storedMotion = window.localStorage.getItem(MOTION_KEY);
    if (isMotionMode(storedMotion)) {
      motionMode = storedMotion;
    }
  } catch {
    // Corrupt or unavailable storage falls back to the safe initial checkpoint.
  }

  return { checkpoint, motionMode, classificationAnswers };
}

export function saveBattleProgress(
  checkpoint: StableCheckpoint,
  classificationAnswers: ClassificationAnswers,
): void {
  try {
    window.localStorage.setItem(
      PROGRESS_KEY,
      JSON.stringify({
        version: STORAGE_VERSION,
        checkpoint,
        classificationAnswers,
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
