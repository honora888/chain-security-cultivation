import nextEnv from "@next/env";
import { neon } from "@neondatabase/serverless";

const { loadEnvConfig } = nextEnv;

loadEnvConfig(process.cwd());

const DELETE_CONFIRMATION = "DELETE_CONFIRMED";
const QUEST_ONE_NAME = "噬灵回环兽";
const CASE_ID_PATTERN =
  /^case-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

const CONTRIBUTION_MARKER = String.raw`substring(sc.vulnerable_source from '^// contribution-smoke-run:([0-9a-f]{16})')`;
const ATTACK_CONTRIBUTION_MARKER = String.raw`substring(sc.attack_source from '^// contribution-smoke-run:([0-9a-f]{16})')`;
const FIXED_CONTRIBUTION_MARKER = String.raw`substring(sc.fixed_source from '^// contribution-smoke-run:([0-9a-f]{16})')`;
const REVIEW_MARKER = String.raw`substring(sc.vulnerable_source from '^// review-smoke-run:([0-9a-f]{16})')`;
const ATTACK_REVIEW_MARKER = String.raw`substring(sc.attack_source from '^// review-smoke-run:([0-9a-f]{16})')`;
const FIXED_REVIEW_MARKER = String.raw`substring(sc.fixed_source from '^// review-smoke-run:([0-9a-f]{16})')`;

const CONTRIBUTION_SMOKE_MATCH = `(
  sc.case_name ~ '^Sample contribution [0-9a-f]{8}$'
  AND ${CONTRIBUTION_MARKER} IS NOT NULL
  AND ${CONTRIBUTION_MARKER} = ${ATTACK_CONTRIBUTION_MARKER}
  AND ${CONTRIBUTION_MARKER} = ${FIXED_CONTRIBUTION_MARKER}
  AND substring(sc.case_name from '^Sample contribution ([0-9a-f]{8})$') =
    left(${CONTRIBUTION_MARKER}, 8)
)`;

const REVIEW_CASE_SUFFIX = `COALESCE(
  substring(sc.case_name from '^REVIEW SMOKE · ([0-9a-f]{16})$'),
  substring(sc.case_name from '^REVIEW SMOKE rejected ([0-9a-f]{16})$'),
  substring(sc.case_name from '^REVIEW SMOKE reused ([0-9a-f]{16})$')
)`;

const REVIEW_SMOKE_MATCH = `(
  ${REVIEW_CASE_SUFFIX} IS NOT NULL
  AND ${REVIEW_MARKER} IS NOT NULL
  AND ${REVIEW_MARKER} = ${ATTACK_REVIEW_MARKER}
  AND ${REVIEW_MARKER} = ${FIXED_REVIEW_MARKER}
  AND ${REVIEW_CASE_SUFFIX} = ${REVIEW_MARKER}
)`;

const AUTOMATIC_MATCH = `(${CONTRIBUTION_SMOKE_MATCH} OR ${REVIEW_SMOKE_MATCH})`;
const MANUAL_MATCH = `(
  sc.case_name IN ('人工鉴兽测试', '奖励池重复领取攻击')
  OR sc.case_name ~ '^UI MANUAL · [0-9A-Za-z_-]{1,64}$'
  OR sc.case_name ~ '^SMOKE TEST · [0-9A-Za-z_-]{1,64}$'
)`;

function protectionMatch(questNamePlaceholder) {
  return `(
    strpos(COALESCE(sc.case_name, ''), ${questNamePlaceholder}) > 0
    OR strpos(COALESCE(sc.proposed_bestiary_name, ''), ${questNamePlaceholder}) > 0
    OR strpos(COALESCE(sc.normalized_bestiary_name, ''), ${questNamePlaceholder}) > 0
    OR EXISTS (
      SELECT 1 FROM bestiary_name_reservations protected_reservation
      WHERE protected_reservation.case_id = sc.id
        AND (
          strpos(protected_reservation.display_name, ${questNamePlaceholder}) > 0
          OR strpos(protected_reservation.normalized_name, ${questNamePlaceholder}) > 0
        )
    )
    OR EXISTS (
      SELECT 1 FROM bestiary_entries protected_entry
      WHERE protected_entry.case_id = sc.id
        AND (
          strpos(protected_entry.display_name, ${questNamePlaceholder}) > 0
          OR strpos(protected_entry.normalized_name, ${questNamePlaceholder}) > 0
        )
    )
  )`;
}

const CANDIDATE_QUERY = `
  SELECT
    sc.id AS internal_id,
    sc.case_id,
    sc.case_name,
    sc.status::text AS status,
    sc.proposed_bestiary_name,
    sc.created_at,
    (SELECT COUNT(*)::int FROM case_reviews cr WHERE cr.case_id = sc.id) AS review_count,
    (SELECT COUNT(*)::int FROM merit_ledger ml WHERE ml.case_id = sc.id) AS merit_count,
    COALESCE((SELECT SUM(ml.amount)::bigint FROM merit_ledger ml WHERE ml.case_id = sc.id), 0) AS merit_amount,
    (SELECT COUNT(*)::int FROM bestiary_entries be WHERE be.case_id = sc.id) AS bestiary_count,
    (SELECT COUNT(*)::int FROM bestiary_name_reservations bnr WHERE bnr.case_id = sc.id) AS reservation_count,
    COALESCE((
      SELECT string_agg(bnr.status::text, ', ' ORDER BY bnr.status::text)
      FROM bestiary_name_reservations bnr
      WHERE bnr.case_id = sc.id
    ), 'none') AS reservation_status,
    ${AUTOMATIC_MATCH} AS automatic_match,
    ${MANUAL_MATCH} AS manual_match,
    ${protectionMatch("$1")} AS protected
  FROM security_cases sc
  WHERE ${AUTOMATIC_MATCH}
    OR ${MANUAL_MATCH}
    OR sc.case_id = ANY($2::text[])
  ORDER BY sc.created_at ASC, sc.case_id ASC`;

function numberValue(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function publicSummary(row) {
  return {
    caseId: row.case_id,
    caseName: row.case_name,
    status: row.status,
    proposedBestiaryName: row.proposed_bestiary_name,
    createdAt: new Date(row.created_at).toISOString(),
    hasReviews: numberValue(row.review_count) > 0,
    meritAmount: numberValue(row.merit_amount),
    hasBestiaryEntry: numberValue(row.bestiary_count) > 0,
    reservationStatus: row.reservation_status,
  };
}

function printGroup(title, rows) {
  console.log(`\n${title}`);
  if (rows.length === 0) {
    console.log("(none)");
    return;
  }
  console.table(rows.map(publicSummary));
}

function parseCaseIdAllowlist(environmentName) {
  const values = (process.env[environmentName] ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (values.some((value) => !CASE_ID_PATTERN.test(value))) {
    throw new Error(`INVALID_${environmentName}`);
  }
  return new Set(values);
}

function deletionCounts(rows) {
  return {
    cases: rows.length,
    reviews: rows.reduce((total, row) => total + numberValue(row.review_count), 0),
    merits: rows.reduce((total, row) => total + numberValue(row.merit_count), 0),
    bestiary: rows.reduce((total, row) => total + numberValue(row.bestiary_count), 0),
    reservations: rows.reduce((total, row) => total + numberValue(row.reservation_count), 0),
  };
}

function printCounts(counts) {
  console.log(`\nCandidate cases: ${counts.cases}`);
  console.log(`Candidate reviews: ${counts.reviews}`);
  console.log(`Candidate merit entries: ${counts.merits}`);
  console.log(`Candidate bestiary entries: ${counts.bestiary}`);
  console.log(`Candidate reservations: ${counts.reservations}`);
}

async function deleteCandidates(
  sql,
  rows,
  manualAllowlist,
  legacyReviewAllowlist,
) {
  if (rows.length === 0) {
    console.log("\nNo confirmed candidates; nothing was deleted.");
    return;
  }

  const internalIds = rows.map((row) => row.internal_id);
  const manualCaseIds = [...manualAllowlist];
  const legacyReviewCaseIds = [...legacyReviewAllowlist];
  const guardQuery = `
    WITH locked_candidates AS MATERIALIZED (
      SELECT sc.id
      FROM security_cases sc
      WHERE sc.id = ANY($1::uuid[])
        AND (
          ${AUTOMATIC_MATCH}
          OR (${MANUAL_MATCH} AND sc.case_id = ANY($2::text[]))
          OR sc.case_id = ANY($3::text[])
        )
        AND NOT ${protectionMatch("$4")}
      FOR UPDATE
    )
    SELECT 1 / CASE WHEN COUNT(*) = $5::int THEN 1 ELSE 0 END AS safety_guard
    FROM locked_candidates`;

  const results = await sql.transaction(
    (transaction) => [
      transaction.query(guardQuery, [
        internalIds,
        manualCaseIds,
        legacyReviewCaseIds,
        QUEST_ONE_NAME,
        internalIds.length,
      ]),
      transaction.query(
        "DELETE FROM merit_ledger WHERE case_id = ANY($1::uuid[]) RETURNING id",
        [internalIds],
      ),
      transaction.query(
        "DELETE FROM bestiary_entries WHERE case_id = ANY($1::uuid[]) RETURNING id",
        [internalIds],
      ),
      transaction.query(
        `DELETE FROM bestiary_name_reservations
         WHERE case_id = ANY($1::uuid[])
           AND case_id IS NOT NULL
           AND strpos(display_name, $2) = 0
           AND strpos(normalized_name, $2) = 0
         RETURNING id`,
        [internalIds, QUEST_ONE_NAME],
      ),
      transaction.query(
        "DELETE FROM case_reviews WHERE case_id = ANY($1::uuid[]) RETURNING id",
        [internalIds],
      ),
      transaction.query(
        `DELETE FROM security_cases
         WHERE id = ANY($1::uuid[])
           AND strpos(case_name, $2) = 0
           AND strpos(COALESCE(proposed_bestiary_name, ''), $2) = 0
           AND strpos(COALESCE(normalized_bestiary_name, ''), $2) = 0
         RETURNING id`,
        [internalIds, QUEST_ONE_NAME],
      ),
    ],
    { isolationLevel: "Serializable" },
  );

  const [, merits, bestiary, reservations, reviews, cases] = results;
  console.log("\nDELETE CONFIRMED — transaction committed.");
  console.log(`Deleted cases: ${cases.length}`);
  console.log(`Deleted reviews: ${reviews.length}`);
  console.log(`Deleted merit entries: ${merits.length}`);
  console.log(`Deleted bestiary entries: ${bestiary.length}`);
  console.log(`Deleted reservations: ${reservations.length}`);
}

async function main() {
  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) throw new Error("DATABASE_NOT_CONFIGURED");

  const deleteMode = process.env.CLEANUP_TEST_DATA_CONFIRM === DELETE_CONFIRMATION;
  const manualAllowlist = parseCaseIdAllowlist("CLEANUP_TEST_CASE_IDS");
  const legacyReviewAllowlist = parseCaseIdAllowlist(
    "CLEANUP_LEGACY_TEST_CASE_IDS",
  );
  const sql = neon(connectionString);
  const legacyReviewCaseIds = [...legacyReviewAllowlist];
  const rows = await sql.query(CANDIDATE_QUERY, [
    QUEST_ONE_NAME,
    legacyReviewCaseIds,
  ]);

  const protectedRows = rows.filter((row) => row.protected === true);
  const automaticRows = rows.filter(
    (row) => row.automatic_match === true && row.protected !== true,
  );
  const manualRows = rows.filter(
    (row) => row.manual_match === true && row.automatic_match !== true && row.protected !== true,
  );
  const allowedManualRows = manualRows.filter((row) => manualAllowlist.has(row.case_id));
  const pendingManualRows = manualRows.filter((row) => !manualAllowlist.has(row.case_id));
  const legacyReviewRows = rows.filter(
    (row) => legacyReviewAllowlist.has(row.case_id) && row.protected !== true,
  );
  const knownManualIds = new Set(manualRows.map((row) => row.case_id));
  const foundLegacyReviewIds = new Set(
    rows
      .filter((row) => legacyReviewAllowlist.has(row.case_id))
      .map((row) => row.case_id),
  );

  if ([...manualAllowlist].some((caseId) => !knownManualIds.has(caseId))) {
    throw new Error("MANUAL_ALLOWLIST_NOT_A_STRICT_MANUAL_CANDIDATE");
  }
  if (
    [...legacyReviewAllowlist].some(
      (caseId) => !foundLegacyReviewIds.has(caseId),
    )
  ) {
    throw new Error("LEGACY_REVIEW_ALLOWLIST_CASE_NOT_FOUND");
  }
  if (
    rows.some(
      (row) => legacyReviewAllowlist.has(row.case_id) && row.protected === true,
    )
  ) {
    throw new Error("LEGACY_REVIEW_ALLOWLIST_PROTECTED_CASE");
  }

  const candidatesById = new Map(
    [...automaticRows, ...allowedManualRows, ...legacyReviewRows].map((row) => [
      row.case_id,
      row,
    ]),
  );
  const candidates = [...candidatesById.values()];
  const counts = deletionCounts(candidates);

  console.log(`Mode: ${deleteMode ? "DELETE" : "DRY RUN"}`);
  printGroup("Confirmed automatic candidates", automaticRows);
  printGroup("Allowlisted manual candidates", allowedManualRows);
  printGroup(
    "Allowlisted legacy review smoke candidates",
    legacyReviewRows,
  );
  printGroup("Manual candidates awaiting CLEANUP_TEST_CASE_IDS", pendingManualRows);
  printGroup("Protected matches excluded from cleanup", protectedRows);
  printCounts(counts);

  if (!deleteMode) {
    console.log("\nDRY RUN complete. No data was modified.");
    return;
  }

  await deleteCandidates(
    sql,
    candidates,
    manualAllowlist,
    legacyReviewAllowlist,
  );
}

main().catch(() => {
  console.error("Cleanup test-data operation failed safely; no sensitive details were printed.");
  process.exitCode = 1;
});
