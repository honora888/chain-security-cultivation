import { NextResponse } from "next/server";

import {
  AUTH_REQUEST_BODY_MAX_BYTES,
  AUTH_SCHEMA_VERSION,
} from "@/auth/constants";

export type AuthErrorCode =
  | "INVALID_REQUEST"
  | "ORIGIN_NOT_ALLOWED"
  | "INVALID_WALLET_ADDRESS"
  | "NONCE_INVALID"
  | "NONCE_EXPIRED"
  | "NONCE_ALREADY_USED"
  | "INVALID_SIGNATURE"
  | "DATABASE_NOT_CONFIGURED"
  | "DATABASE_UNAVAILABLE";

const AUTH_ERROR_MESSAGES: Record<AuthErrorCode, string> = {
  INVALID_REQUEST: "The authentication request is invalid.",
  ORIGIN_NOT_ALLOWED: "The request origin is not allowed.",
  INVALID_WALLET_ADDRESS: "The wallet address is invalid.",
  NONCE_INVALID: "The authentication nonce is invalid.",
  NONCE_EXPIRED: "The authentication nonce has expired.",
  NONCE_ALREADY_USED: "The authentication nonce has already been used.",
  INVALID_SIGNATURE: "The wallet signature is invalid.",
  DATABASE_NOT_CONFIGURED: "Authentication is not configured on this server.",
  DATABASE_UNAVAILABLE: "Authentication is temporarily unavailable.",
};

const AUTH_ERROR_STATUS: Record<AuthErrorCode, number> = {
  INVALID_REQUEST: 400,
  ORIGIN_NOT_ALLOWED: 403,
  INVALID_WALLET_ADDRESS: 422,
  NONCE_INVALID: 401,
  NONCE_EXPIRED: 401,
  NONCE_ALREADY_USED: 401,
  INVALID_SIGNATURE: 401,
  DATABASE_NOT_CONFIGURED: 503,
  DATABASE_UNAVAILABLE: 503,
};

export class AuthHttpError extends Error {
  readonly code: AuthErrorCode;
  readonly status: number;

  constructor(code: AuthErrorCode) {
    super(AUTH_ERROR_MESSAGES[code]);
    this.name = "AuthHttpError";
    this.code = code;
    this.status = AUTH_ERROR_STATUS[code];
  }
}

export function noStoreJson<T>(body: T, status = 200): NextResponse<T> {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function readJsonBody(request: Request): Promise<unknown> {
  const contentType = request.headers.get("content-type")?.trim() ?? "";
  if (!/^application\/json(?:\s*;.*)?$/i.test(contentType)) {
    throw new AuthHttpError("INVALID_REQUEST");
  }

  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    const parsedLength = Number(contentLength);
    if (
      !Number.isSafeInteger(parsedLength) ||
      parsedLength < 0 ||
      parsedLength > AUTH_REQUEST_BODY_MAX_BYTES
    ) {
      throw new AuthHttpError("INVALID_REQUEST");
    }
  }

  const text = await request.text();
  if (
    text.length === 0 ||
    new TextEncoder().encode(text).byteLength > AUTH_REQUEST_BODY_MAX_BYTES
  ) {
    throw new AuthHttpError("INVALID_REQUEST");
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new AuthHttpError("INVALID_REQUEST");
  }
}

export function assertExactObject(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new AuthHttpError("INVALID_REQUEST");
  }

  const object = value as Record<string, unknown>;
  const actualKeys = Object.keys(object).sort();
  const expectedKeys = [...keys].sort();
  if (
    actualKeys.length !== expectedKeys.length ||
    actualKeys.some((key, index) => key !== expectedKeys[index])
  ) {
    throw new AuthHttpError("INVALID_REQUEST");
  }
  return object;
}

export function requireString(value: unknown): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new AuthHttpError("INVALID_REQUEST");
  }
  return value;
}

export function assertAllowedOrigin(request: Request): string {
  const requestOrigin = new URL(request.url).origin;
  const origin = request.headers.get("origin");
  if (!origin || origin !== requestOrigin) {
    throw new AuthHttpError("ORIGIN_NOT_ALLOWED");
  }
  return requestOrigin;
}

export function authErrorResponse(error: unknown): NextResponse {
  const authError =
    error instanceof AuthHttpError
      ? error
      : new AuthHttpError("DATABASE_UNAVAILABLE");
  return noStoreJson(
    {
      ok: false,
      schemaVersion: AUTH_SCHEMA_VERSION,
      error: {
        code: authError.code,
        message: authError.message,
      },
    },
    authError.status,
  );
}
