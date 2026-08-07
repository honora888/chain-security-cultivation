import type { GuardianLlmRequest, GuardianLlmResponse } from "./contracts";
import type { GuardianLlmMode } from "./config";
import {
  type GuardianLlmProvider,
  GuardianLlmProviderError,
  type GuardianLlmProviderErrorCode,
} from "./provider";

export type GuardianLlmRunResult =
  | {
      readonly status: "disabled";
      readonly response: null;
    }
  | {
      readonly status: "enhanced";
      readonly response: GuardianLlmResponse;
    }
  | {
      readonly status: "fallback";
      readonly response: null;
      readonly errorCode: GuardianLlmProviderErrorCode;
    };

export interface RunGuardianLlmOptions {
  readonly mode: GuardianLlmMode;
  readonly input: GuardianLlmRequest;
  readonly provider?: GuardianLlmProvider;
}

export async function runGuardianLlmEnhancement(
  options: RunGuardianLlmOptions,
): Promise<GuardianLlmRunResult> {
  if (options.mode === "disabled") {
    return { status: "disabled", response: null };
  }

  if (options.provider === undefined) {
    return {
      status: "fallback",
      response: null,
      errorCode: "NOT_CONFIGURED",
    };
  }

  try {
    return {
      status: "enhanced",
      response: await options.provider.enhance(options.input),
    };
  } catch (error: unknown) {
    return {
      status: "fallback",
      response: null,
      errorCode:
        error instanceof GuardianLlmProviderError
          ? error.code
          : "REQUEST_FAILED",
    };
  }
}
