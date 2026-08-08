import { NextResponse } from "next/server";

import { AuthHttpError } from "@/auth/http";
import { DatabaseConfigurationError } from "@/db/client";

import { CULTIVATION_COMPLETION_SCHEMA_VERSION } from "./contracts";
import { CultivationHttpError } from "./errors";

const REQUEST_BODY_MAX_BYTES = 8 * 1024;

export function noStoreCultivationJson<T>(body: T, status = 200): NextResponse<T> {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function readCultivationJsonBody(request: Request): Promise<unknown> {
  const contentType = request.headers.get("content-type")?.trim() ?? "";
  if (!/^application\/json(?:\s*;.*)?$/i.test(contentType)) {
    throw new CultivationHttpError("INVALID_REQUEST");
  }
  const text = await request.text();
  if (!text || new TextEncoder().encode(text).byteLength > REQUEST_BODY_MAX_BYTES) {
    throw new CultivationHttpError("INVALID_REQUEST");
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new CultivationHttpError("INVALID_REQUEST");
  }
}

export function mapCultivationError(error: unknown): CultivationHttpError {
  if (error instanceof CultivationHttpError) return error;
  if (error instanceof DatabaseConfigurationError) {
    return new CultivationHttpError("DATABASE_NOT_CONFIGURED");
  }
  if (error instanceof AuthHttpError) {
    if (error.code === "DATABASE_NOT_CONFIGURED") return new CultivationHttpError("DATABASE_NOT_CONFIGURED");
    if (error.code === "DATABASE_UNAVAILABLE") return new CultivationHttpError("DATABASE_UNAVAILABLE");
    return new CultivationHttpError("AUTH_REQUIRED");
  }
  return new CultivationHttpError("DATABASE_UNAVAILABLE");
}

export function cultivationErrorResponse(error: unknown): NextResponse {
  const mapped = mapCultivationError(error);
  return noStoreCultivationJson({
    ok: false,
    schemaVersion: CULTIVATION_COMPLETION_SCHEMA_VERSION,
    error: { code: mapped.code, message: mapped.message },
  }, mapped.status);
}
