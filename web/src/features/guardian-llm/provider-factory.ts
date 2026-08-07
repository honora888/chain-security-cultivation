import "server-only";

import { GeminiGuardianLlmProvider } from "./gemini-provider";
import type { GuardianLlmProvider } from "./provider";
import {
  readGuardianLlmServerConfig,
  type GuardianLlmServerConfig,
} from "./server-config";

export interface GuardianLlmRuntime {
  readonly mode: GuardianLlmServerConfig["mode"];
  readonly provider?: GuardianLlmProvider;
}

export function createGuardianLlmRuntime(): GuardianLlmRuntime {
  const config = readGuardianLlmServerConfig();

  if (config.mode !== "hybrid" || config.apiKey === null) {
    return { mode: config.mode };
  }

  return {
    mode: config.mode,
    provider: new GeminiGuardianLlmProvider({
      apiKey: config.apiKey,
      model: config.model,
    }),
  };
}
