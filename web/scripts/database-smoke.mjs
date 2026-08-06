import nextEnv from "@next/env";

const { loadEnvConfig } = nextEnv;
import { neon } from "@neondatabase/serverless";

loadEnvConfig(process.cwd());

const requiredTables = [
  "wallet_nonces",
  "wallet_sessions",
  "security_cases",
  "case_reviews",
  "merit_ledger",
  "bestiary_name_reservations",
  "bestiary_entries",
];
const requiredIndexes = [
  "wallet_nonces_nonce_hash_unique",
  "wallet_sessions_session_hash_unique",
  "security_cases_case_id_unique",
  "security_cases_case_hash_unique",
  "bestiary_name_reservations_active_name_unique",
  "bestiary_entries_case_id_unique",
  "bestiary_entries_normalized_name_unique",
  "merit_ledger_idempotency_key_unique",
];
const questOneName = "噬灵回环兽";

function hasAll(required, rows, key) {
  const actual = new Set(rows.map((row) => row[key]));
  return required.every((value) => actual.has(value));
}

async function main() {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    throw new Error("not configured");
  }

  const sql = neon(connectionString);
  await sql.query("SELECT 1 AS ok");
  const tableRows = await sql.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ANY($1::text[])",
    [requiredTables],
  );
  if (!hasAll(requiredTables, tableRows, "table_name")) {
    throw new Error("schema incomplete");
  }

  const indexRows = await sql.query(
    "SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' AND indexname = ANY($1::text[]) AND indexdef LIKE 'CREATE UNIQUE INDEX%'",
    [requiredIndexes],
  );
  if (!hasAll(requiredIndexes, indexRows, "indexname")) {
    throw new Error("schema incomplete");
  }
  const activeReservationIndex = indexRows.find(
    (row) => row.indexname === "bestiary_name_reservations_active_name_unique",
  );
  const activeDefinition = String(activeReservationIndex?.indexdef ?? "").toLowerCase();
  if (!activeDefinition.includes(" where ") || !activeDefinition.includes("reserved") || !activeDefinition.includes("approved")) {
    throw new Error("schema incomplete");
  }

  const reservationRows = await sql.query(
    "SELECT status FROM bestiary_name_reservations WHERE normalized_name = $1 LIMIT 1",
    [questOneName],
  );
  if (reservationRows[0]?.status !== "approved") {
    throw new Error("seed incomplete");
  }

  console.log("Database smoke checks passed.");
}

main().catch(() => {
  console.error("Database smoke checks failed.");
  process.exitCode = 1;
});
