import "server-only";

import type { GuardianLlmRequest, GuardianLlmResponse } from "./contracts";
import { buildGuardianLlmPrompt } from "./prompt";
import {
  type GuardianLlmProvider,
  GuardianLlmProviderError,
} from "./provider";
import { parseGuardianLlmResponse } from "./response-parser";
import { GUARDIAN_LLM_RESPONSE_SCHEMA } from "./response-schema";
import { scanGuardianLlmSources } from "./sensitive-source";

const GEMINI_API_ORIGIN = "https://generativelanguage.googleapis.com";
export const GEMINI_REQUEST_TIMEOUT_MS = 30_000;
export const GEMINI_MAX_OUTPUT_TOKENS = 8_192;
export const GEMINI_MAX_ATTEMPTS = 3;
export const GEMINI_RETRY_DELAYS_MS = [1_000, 2_000] as const;
const GEMINI_MODEL_PATTERN = /^[A-Za-z0-9._-]+$/;

export type GuardianLlmFetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export type GuardianLlmRetryDelay = (delayMs: number) => Promise<void>;

export interface GeminiGuardianLlmProviderConfig {
  readonly apiKey: string | null;
  readonly model: string;
  readonly timeoutMs?: number;
  readonly retryDelay?: GuardianLlmRetryDelay;
}

function defaultRetryDelay(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

function isRetryableHttpStatus(status: number): boolean {
  return status === 429 || status === 502 || status === 503 || status === 504;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function extractGeminiResponseText(value: unknown): string {
  if (!isRecord(value) || !Array.isArray(value.candidates)) {
    throw new GuardianLlmProviderError("INVALID_RESPONSE");
  }

  for (const candidate of value.candidates) {
    if (!isRecord(candidate) || !isRecord(candidate.content)) {
      continue;
    }

    const parts = candidate.content.parts;
    if (!Array.isArray(parts) || parts.length === 0) {
      continue;
    }

    const textParts: string[] = [];
    for (const part of parts) {
      if (isRecord(part) && typeof part.text === "string") {
        textParts.push(part.text);
      }
    }

    const text = textParts.join("");
    if (text.trim().length > 0) {
      return text;
    }
  }

  throw new GuardianLlmProviderError("INVALID_RESPONSE");
}

function parseGeminiJsonText(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new GuardianLlmProviderError("INVALID_RESPONSE");
  }
}

export class GeminiGuardianLlmProvider implements GuardianLlmProvider {
  readonly providerName = "gemini";

  private readonly apiKey: string | null;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: GuardianLlmFetch;
  private readonly retryDelay: GuardianLlmRetryDelay;

  constructor(
    config: GeminiGuardianLlmProviderConfig,
    fetchImpl: GuardianLlmFetch = fetch,
  ) {
    this.apiKey = config.apiKey;
    this.model = config.model;
    this.timeoutMs = config.timeoutMs ?? GEMINI_REQUEST_TIMEOUT_MS;
    this.fetchImpl = fetchImpl;
    this.retryDelay = config.retryDelay ?? defaultRetryDelay;
  }

  async enhance(input: GuardianLlmRequest): Promise<GuardianLlmResponse> {
    if (
      this.apiKey === null ||
      this.apiKey.trim().length === 0 ||
      !GEMINI_MODEL_PATTERN.test(this.model) ||
      !Number.isFinite(this.timeoutMs) ||
      this.timeoutMs <= 0
    ) {
      throw new GuardianLlmProviderError("NOT_CONFIGURED");
    }

    if (scanGuardianLlmSources(input.untrustedSources).blocked) {
      throw new GuardianLlmProviderError("SENSITIVE_SOURCE");
    }

    const prompt = buildGuardianLlmPrompt(input);
    const endpoint = `${GEMINI_API_ORIGIN}/v1beta/models/${encodeURIComponent(this.model)}:generateContent`;
    const requestBody = JSON.stringify({
      systemInstruction: {
        parts: [{ text: prompt.systemInstruction }],
      },
      contents: [
        {
          role: "user",
          parts: [{ text: prompt.userContent }],
        },
      ],
      generationConfig: {
  thinkingConfig: {
    thinkingLevel: "low",
  },
  maxOutputTokens: GEMINI_MAX_OUTPUT_TOKENS,
  responseMimeType: "application/json",
  responseJsonSchema: GUARDIAN_LLM_RESPONSE_SCHEMA,
  },
    });

    for (let attempt = 0; attempt < GEMINI_MAX_ATTEMPTS; attempt += 1) {
      const controller = new AbortController();
      let timedOut = false;
      const timeout = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, this.timeoutMs);

      try {
        const response = await this.fetchImpl(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": this.apiKey,
          },
          body: requestBody,
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          if (
            isRetryableHttpStatus(response.status) &&
            attempt < GEMINI_MAX_ATTEMPTS - 1
          ) {
            clearTimeout(timeout);
            await this.retryDelay(GEMINI_RETRY_DELAYS_MS[attempt]);
            continue;
          }

          throw new GuardianLlmProviderError(
            response.status === 429 ? "RATE_LIMITED" : "REQUEST_FAILED",
          );
        }

        let envelope: unknown;
        try {
          envelope = await response.json();
        } catch {
          throw new GuardianLlmProviderError("INVALID_RESPONSE");
        }

        const text = extractGeminiResponseText(envelope);
        return parseGuardianLlmResponse(parseGeminiJsonText(text));
      } catch (error: unknown) {
        if (error instanceof GuardianLlmProviderError) {
          throw error;
        }

        const errorCode = timedOut ? "TIMEOUT" : "REQUEST_FAILED";

        if (attempt < GEMINI_MAX_ATTEMPTS - 1) {
          clearTimeout(timeout);
          await this.retryDelay(GEMINI_RETRY_DELAYS_MS[attempt]);
          continue;
        }

        throw new GuardianLlmProviderError(errorCode);
      } finally {
        clearTimeout(timeout);
      }
    }

    throw new GuardianLlmProviderError("REQUEST_FAILED");
  }
}
