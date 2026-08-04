import { NextResponse } from "next/server";

import { GuardianSecurityError } from "@/features/guardian-security/analysis-types";
import {
  guardianSecurityFailure,
  parseGuardianSecurityRequest,
  runGuardianSecurityAnalysis,
} from "@/lib/guardian-security-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;
const MAX_REQUEST_BODY_BYTES = 1_000_000;
const JSON_CONTENT_TYPE = /^application\/json(?:\s*;.*)?$/i;

async function readJsonBody(request: Request): Promise<unknown> {
  const contentType = request.headers.get("content-type")?.trim() ?? "";
  if (!JSON_CONTENT_TYPE.test(contentType)) {
    throw new GuardianSecurityError("INVALID_CONTENT_TYPE");
  }

  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    const parsedLength = Number(contentLength);
    if (
      !Number.isSafeInteger(parsedLength) ||
      parsedLength < 0 ||
      parsedLength > MAX_REQUEST_BODY_BYTES
    ) {
      throw new GuardianSecurityError("SOURCE_TOO_LARGE");
    }
  }

  const text = await request.text();
  if (text.length === 0) {
    throw new GuardianSecurityError("INVALID_JSON");
  }
  if (text.length > MAX_REQUEST_BODY_BYTES) {
    throw new GuardianSecurityError("SOURCE_TOO_LARGE");
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new GuardianSecurityError("INVALID_JSON");
  }
}

export async function POST(request: Request) {
  try {
    const input = parseGuardianSecurityRequest(await readJsonBody(request));
    return NextResponse.json(await runGuardianSecurityAnalysis(input), {
      status: 200,
      headers: NO_STORE_HEADERS,
    });
  } catch (error) {
    const failure = guardianSecurityFailure(error);
    return NextResponse.json(failure.body, {
      status: failure.status,
      headers: NO_STORE_HEADERS,
    });
  }
}
