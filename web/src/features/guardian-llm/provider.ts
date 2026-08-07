import type { GuardianLlmRequest, GuardianLlmResponse } from "./contracts";

export type GuardianLlmProviderErrorCode =
  | "NOT_CONFIGURED"
  | "REQUEST_FAILED"
  | "TIMEOUT"
  | "INVALID_RESPONSE"
  | "RATE_LIMITED";

export class GuardianLlmProviderError extends Error {
  readonly code: GuardianLlmProviderErrorCode;

  constructor(code: GuardianLlmProviderErrorCode) {
    super(code);
    this.code = code;
    this.name = "GuardianLlmProviderError";
  }
}

export interface GuardianLlmProvider {
  readonly providerName: string;
  enhance(input: GuardianLlmRequest): Promise<GuardianLlmResponse>;
}
