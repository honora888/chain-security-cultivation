import {
  DATABASE_SCHEMA_VERSION,
  QUEST_ONE_BESTIARY_NAME,
  REQUIRED_DATABASE_TABLES,
  REQUIRED_UNIQUE_INDEXES,
} from "@/db/constants";
import { getNeonSql, type NeonSql } from "@/db/client";

type TableRow = { table_name: string };
type IndexRow = { indexname: string };
type ReservationRow = { status: string };

export type DatabaseHealthSuccess = {
  ok: true;
  schemaVersion: typeof DATABASE_SCHEMA_VERSION;
  database: {
    connected: true;
    requiredTablesPresent: true;
    requiredUniqueIndexesPresent: true;
    questOneNameReserved: true;
  };
};

export type DatabaseHealthFailure = {
  ok: false;
  code: "DATABASE_UNAVAILABLE" | "DATABASE_SCHEMA_INCOMPLETE";
  schemaVersion: typeof DATABASE_SCHEMA_VERSION;
  database?: {
    connected: boolean;
    requiredTablesPresent: boolean;
    requiredUniqueIndexesPresent: boolean;
    questOneNameReserved: boolean;
  };
};

export type DatabaseHealthResult = DatabaseHealthSuccess | DatabaseHealthFailure;

function includesAll<T extends string>(required: readonly T[], actual: Set<string>): boolean {
  return required.every((value) => actual.has(value));
}

async function queryRows<T>(sql: NeonSql, query: string, params: unknown[]): Promise<T[]> {
  const rows = await sql.query(query, params);
  return rows as unknown as T[];
}

export async function checkDatabaseHealth(): Promise<DatabaseHealthResult> {
  const sql = getNeonSql();

  try {
    await sql.query("SELECT 1 AS ok");

    const tableRows = await queryRows<TableRow>(sql,
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ANY($1::text[])",
      [Array.from(REQUIRED_DATABASE_TABLES)],
    );
    const requiredTablesPresent = includesAll(
      REQUIRED_DATABASE_TABLES,
      new Set(tableRows.map((row) => row.table_name)),
    );
    if (!requiredTablesPresent) {
      return {
        ok: false,
        code: "DATABASE_SCHEMA_INCOMPLETE",
        schemaVersion: DATABASE_SCHEMA_VERSION,
        database: {
          connected: true,
          requiredTablesPresent: false,
          requiredUniqueIndexesPresent: false,
          questOneNameReserved: false,
        },
      };
    }

    const indexRows = await queryRows<IndexRow>(sql,
      "SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND indexname = ANY($1::text[]) AND indexdef LIKE 'CREATE UNIQUE INDEX%'",
      [Array.from(REQUIRED_UNIQUE_INDEXES)],
    );
    const requiredUniqueIndexesPresent = includesAll(
      REQUIRED_UNIQUE_INDEXES,
      new Set(indexRows.map((row) => row.indexname)),
    );
    if (!requiredUniqueIndexesPresent) {
      return {
        ok: false,
        code: "DATABASE_SCHEMA_INCOMPLETE",
        schemaVersion: DATABASE_SCHEMA_VERSION,
        database: {
          connected: true,
          requiredTablesPresent: true,
          requiredUniqueIndexesPresent: false,
          questOneNameReserved: false,
        },
      };
    }

    const reservationRows = await queryRows<ReservationRow>(sql,
      "SELECT status FROM bestiary_name_reservations WHERE normalized_name = $1 LIMIT 1",
      [QUEST_ONE_BESTIARY_NAME],
    );
    const questOneNameReserved = reservationRows[0]?.status === "approved";
    if (!questOneNameReserved) {
      return {
        ok: false,
        code: "DATABASE_SCHEMA_INCOMPLETE",
        schemaVersion: DATABASE_SCHEMA_VERSION,
        database: {
          connected: true,
          requiredTablesPresent: true,
          requiredUniqueIndexesPresent: true,
          questOneNameReserved: false,
        },
      };
    }

    return {
      ok: true,
      schemaVersion: DATABASE_SCHEMA_VERSION,
      database: {
        connected: true,
        requiredTablesPresent: true,
        requiredUniqueIndexesPresent: true,
        questOneNameReserved: true,
      },
    };
  } catch {
    return {
      ok: false,
      code: "DATABASE_UNAVAILABLE",
      schemaVersion: DATABASE_SCHEMA_VERSION,
    };
  }
}
