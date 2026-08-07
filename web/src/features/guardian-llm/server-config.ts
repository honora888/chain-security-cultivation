import "server-only";

import { parseGuardianLlmMode, type GuardianLlmMode } from "./config";

export const DEFAULT_GUARDIAN_LLM_MODEL = "gemini-3.6-flash";

export interface GuardianLlmServerConfig {
  readonly mode: GuardianLlmMode;
  readonly apiKey: string | null;
  readonly model: string;
}

function nonEmpty(value: string | undefined): string | null {
  if (value === undefined || value.trim().length === 0) {
    return null;
  }

  return value.trim();
}

export function readGuardianLlmServerConfig(): GuardianLlmServerConfig {
  return {
    mode: parseGuardianLlmMode(process.env.GUARDIAN_LLM_MODE),
    apiKey: nonEmpty(process.env.GEMINI_API_KEY),
    model:
      nonEmpty(process.env.GUARDIAN_LLM_MODEL) ??
      DEFAULT_GUARDIAN_LLM_MODEL,
  };
}
