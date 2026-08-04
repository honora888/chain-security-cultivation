import { NextResponse } from "next/server";

import {
  GuardianAgentError,
  guardianAgentFailure,
  parseGuardianPrepareRequest,
  prepareGuardianFunding,
} from "@/lib/guardian-agent-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;
const MAX_REQUEST_BODY_LENGTH = 2_048;

async function readJsonBody(request: Request): Promise<unknown> {
  const contentType = request.headers.get("content-type")?.toLowerCase();
  if (!contentType?.includes("application/json")) {
    throw new GuardianAgentError("INVALID_BODY");
  }

  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    const parsedLength = Number(contentLength);
    if (
      !Number.isSafeInteger(parsedLength) ||
      parsedLength < 0 ||
      parsedLength > MAX_REQUEST_BODY_LENGTH
    ) {
      throw new GuardianAgentError("INVALID_BODY");
    }
  }

  const text = await request.text();
  if (text.length === 0 || text.length > MAX_REQUEST_BODY_LENGTH) {
    throw new GuardianAgentError("INVALID_BODY");
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new GuardianAgentError("INVALID_BODY");
  }
}

export async function POST(request: Request) {
  try {
    const input = parseGuardianPrepareRequest(await readJsonBody(request));
    return NextResponse.json(await prepareGuardianFunding(input), {
      status: 200,
      headers: NO_STORE_HEADERS,
    });
  } catch (error) {
    const failure = guardianAgentFailure(error);
    return NextResponse.json(failure.body, {
      status: failure.status,
      headers: NO_STORE_HEADERS,
    });
  }
}
