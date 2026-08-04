import { NextResponse } from "next/server";

import {
  guardianAgentFailure,
  queryGuardianQuest,
} from "@/lib/guardian-agent-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

export async function GET() {
  try {
    return NextResponse.json(await queryGuardianQuest(), {
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
