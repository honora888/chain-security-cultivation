import { NextResponse } from "next/server";

import { DatabaseConfigurationError } from "@/db/client";
import { DATABASE_SCHEMA_VERSION } from "@/db/constants";
import { checkDatabaseHealth } from "@/db/health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

export async function GET() {
  const checkedAt = new Date().toISOString();

  try {
    const result = await checkDatabaseHealth();

    if (result.ok) {
      return NextResponse.json(
        {
          ...result,
          checkedAt,
        },
        {
          status: 200,
          headers: NO_STORE_HEADERS,
        },
      );
    }

    return NextResponse.json(
      {
        ok: false,
        schemaVersion: result.schemaVersion,
        error: {
          code: result.code,
        },
        database: result.database,
        checkedAt,
      },
      {
        status: 503,
        headers: NO_STORE_HEADERS,
      },
    );
  } catch (error) {
    const code =
      error instanceof DatabaseConfigurationError
        ? "DATABASE_NOT_CONFIGURED"
        : "DATABASE_UNAVAILABLE";

    return NextResponse.json(
      {
        ok: false,
        schemaVersion: DATABASE_SCHEMA_VERSION,
        error: {
          code,
        },
        checkedAt,
      },
      {
        status: 503,
        headers: NO_STORE_HEADERS,
      },
    );
  }
}