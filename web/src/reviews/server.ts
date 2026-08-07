import { DatabaseConfigurationError, getNeonSql, type NeonSql } from "@/db/client";
import {
  CONTRIBUTION_CASE_ID_PATTERN,
} from "@/contributions/constants";
import {
  REVIEW_CASE_ID_PATTERN,
  REVIEW_IDEMPOTENCY_PREFIX,
  REVIEW_STATUS_VALUES,
  type ReviewCaseStatus,
} from "@/reviews/constants";
import {
  getAuthenticatedSession,
  requireReviewerSession,
} from "@/reviews/authorization";
import {
  ReviewHttpError,
  type ReviewDecisionInput,
} from "@/reviews/http";

type CaseRow = {
  id: string;
  case_id: string;
  case_hash: string;
  contributor_address: string;
  case_name: string;
  vulnerable_source: string;
  attack_source: string;
  fixed_source: string;
  analysis_json: unknown;
  formal_type: string | null;
  primary_element: string | null;
  secondary_elements: unknown;
  severity_label: string | null;
  severity_score: number | null;
  confidence_label: string | null;
  confidence_score: number | null;
  proposed_bestiary_name: string | null;
  normalized_bestiary_name: string | null;
  status: string;
  created_at: string | Date;
  updated_at: string | Date;
  reservation_display_name?: string | null;
  reservation_normalized_name?: string | null;
};

type ReviewRow = {
  id: string;
  reviewer_address: string;
  decision: string;
  review_notes: string;
  final_bestiary_name: string | null;
  normalized_final_name: string | null;
  final_quest_title: string | null;
  evidence_score: number;
  reproducibility_score: number;
  fix_quality_score: number;
  educational_value_score: number;
  novelty_score: number;
  merit_total: number;
  created_at: string | Date;
};

type MeritRow = {
  case_id: string;
  amount: number;
  reason: string;
  idempotency_key: string;
  created_at: string | Date;
};

type BestiaryRow = {
  case_id: string;
  display_name: string;
  normalized_name: string;
  formal_type: string;
  primary_element: string | null;
  secondary_elements: unknown;
  realm: string;
  severity_label: string;
  confidence_label: string;
  public_summary: string;
  public_attack_pattern: unknown;
  public_prerequisites: unknown;
  public_impact: string;
  public_mitigations: unknown;
  public_known_limitations: unknown;
  source_disclosure: string;
  contributor_address: string;
  reviewer_address: string;
  publication_status: string;
  quest_conversion_status: string;
  published_at: string | Date | null;
};

async function queryRows<T>(sql: NeonSql, query: string, params: unknown[]): Promise<T[]> {
  return (await sql.query(query, params)) as unknown as T[];
}

function mapDatabaseError(error: unknown): never {
  if (error instanceof DatabaseConfigurationError) {
    throw new ReviewHttpError("DATABASE_NOT_CONFIGURED");
  }
  const constraint =
    typeof error === "object" && error !== null && "constraint" in error &&
    typeof error.constraint === "string" ? error.constraint : "";
  if (constraint === "merit_ledger_idempotency_key_unique") {
    throw new ReviewHttpError("REVIEW_ALREADY_APPLIED");
  }
  if (constraint === "bestiary_entries_case_id_unique") {
    throw new ReviewHttpError("REVIEW_ALREADY_APPLIED");
  }
  if (constraint === "bestiary_entries_normalized_name_unique") {
    throw new ReviewHttpError("BESTIARY_NAME_UNAVAILABLE");
  }
  throw new ReviewHttpError("DATABASE_UNAVAILABLE");
}

function toArray(value: unknown): readonly string[] {
  if (typeof value === "string") {
    try {
      return toArray(JSON.parse(value) as unknown);
    } catch {
      return [];
    }
  }
  return Array.isArray(value) && value.every((entry) => typeof entry === "string")
    ? value
    : [];
}

function iso(value: string | Date | null): string | null {
  return value === null ? null : new Date(value).toISOString();
}

function metadata(row: CaseRow) {
  return {
    caseId: row.case_id,
    caseHash: row.case_hash,
    caseName: row.case_name,
    contributorAddress: row.contributor_address,
    formalType: row.formal_type,
    primaryElement: row.primary_element,
    secondaryElements: toArray(row.secondary_elements),
    severity: { label: row.severity_label, score: row.severity_score },
    confidence: { label: row.confidence_label, score: row.confidence_score },
    proposedBestiaryName: row.proposed_bestiary_name,
    status: row.status,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function parseStoredReviewNotes(value: string): { reviewSummary: string; reviewNotes: string } {
  try {
    const parsed: unknown = JSON.parse(value);
    if (
      typeof parsed === "object" && parsed !== null &&
      "summary" in parsed && "notes" in parsed &&
      typeof parsed.summary === "string" && typeof parsed.notes === "string"
    ) {
      return { reviewSummary: parsed.summary, reviewNotes: parsed.notes };
    }
  } catch {
    // Older rows may contain plain review notes.
  }
  return { reviewSummary: "", reviewNotes: value };
}

function reviewDetails(row: ReviewRow) {
  const notes = parseStoredReviewNotes(row.review_notes);
  return {
    reviewId: row.id,
    reviewerAddress: row.reviewer_address,
    decision: row.decision,
    reviewSummary: notes.reviewSummary,
    reviewNotes: notes.reviewNotes,
    finalBestiaryName: row.final_bestiary_name,
    normalizedFinalName: row.normalized_final_name,
    finalQuestTitle: row.final_quest_title,
    scores: {
      evidenceQuality: row.evidence_score,
      reproducibility: row.reproducibility_score,
      technicalAccuracy: row.fix_quality_score,
      remediationQuality: row.educational_value_score,
      contributionValue: row.novelty_score,
      total: row.merit_total,
    },
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function meritDetails(row: MeritRow) {
  return {
    caseId: row.case_id,
    amount: row.amount,
    reason: row.reason,
    idempotencyKey: row.idempotency_key,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function publicBestiary(row: BestiaryRow) {
  return {
    caseId: row.case_id,
    displayName: row.display_name,
    normalizedName: row.normalized_name,
    formalType: row.formal_type,
    primaryElement: row.primary_element,
    secondaryElements: toArray(row.secondary_elements),
    realm: row.realm,
    severity: row.severity_label,
    confidence: row.confidence_label,
    contributorAddress: row.contributor_address,
    approvedAt: iso(row.published_at),
    publicationStatus: row.publication_status,
    questConversionStatus: row.quest_conversion_status,
    summary: row.public_summary,
    attackPattern: toArray(row.public_attack_pattern),
    prerequisites: toArray(row.public_prerequisites),
    impact: row.public_impact,
    mitigations: toArray(row.public_mitigations),
    knownLimitations: toArray(row.public_known_limitations),
    sourceDisclosure: row.source_disclosure,
  };
}

function assertCaseId(caseId: string): void {
  if (!REVIEW_CASE_ID_PATTERN.test(caseId) || !CONTRIBUTION_CASE_ID_PATTERN.test(caseId)) {
    throw new ReviewHttpError("INVALID_CASE_ID");
  }
}

export async function listReviewCases(status: ReviewCaseStatus) {
  await requireReviewerSession();
  if (!REVIEW_STATUS_VALUES.includes(status)) throw new ReviewHttpError("INVALID_REQUEST");
  let rows: CaseRow[];
  try {
    rows = await queryRows<CaseRow>(
      getNeonSql(),
      `SELECT case_id, case_hash, case_name, contributor_address,
        formal_type, primary_element, secondary_elements, severity_label,
        severity_score, confidence_label, confidence_score,
        proposed_bestiary_name, status, created_at, updated_at
       FROM security_cases
       WHERE status = $1::case_status
       ORDER BY created_at ASC
       LIMIT 100`,
      [status],
    );
  } catch (error) {
    return mapDatabaseError(error);
  }
  return {
    ok: true as const,
    schemaVersion: "contribution-review-v1" as const,
    status,
    cases: rows.map(metadata),
  };
}

export async function getReviewCase(caseId: string) {
  await requireReviewerSession();
  assertCaseId(caseId);
  let rows: CaseRow[];
  try {
    rows = await queryRows<CaseRow>(
      getNeonSql(),
      `SELECT id, case_id, case_hash, contributor_address, case_name,
        vulnerable_source, attack_source, fixed_source, analysis_json,
        formal_type, primary_element, secondary_elements, severity_label,
        severity_score, confidence_label, confidence_score,
        proposed_bestiary_name, normalized_bestiary_name, status,
        created_at, updated_at
       FROM security_cases WHERE case_id = $1 LIMIT 1`,
      [caseId],
    );
  } catch (error) {
    return mapDatabaseError(error);
  }
  const row = rows[0];
  if (!row) throw new ReviewHttpError("CASE_NOT_FOUND");

  let reviews: ReviewRow[];
  let merits: MeritRow[];
  let bestiaryRows: BestiaryRow[];
  try {
    const sql = getNeonSql();
    reviews = await queryRows<ReviewRow>(
      sql,
      `SELECT id, reviewer_address, decision, review_notes,
        final_bestiary_name, normalized_final_name, final_quest_title,
        evidence_score, reproducibility_score, fix_quality_score,
        educational_value_score, novelty_score, merit_total, created_at
       FROM case_reviews WHERE case_id = $1 ORDER BY created_at DESC`,
      [row.id],
    );
    merits = await queryRows<MeritRow>(
      sql,
      `SELECT sc.case_id, ml.amount, ml.reason, ml.idempotency_key, ml.created_at
       FROM merit_ledger ml
       JOIN security_cases sc ON sc.id = ml.case_id
       WHERE ml.case_id = $1
       ORDER BY ml.created_at DESC`,
      [row.id],
    );
    bestiaryRows = await queryRows<BestiaryRow>(
      sql,
      `SELECT case_id, display_name, normalized_name, formal_type,
        primary_element, secondary_elements, realm, severity_label,
        confidence_label, public_summary, public_attack_pattern,
        public_prerequisites, public_impact, public_mitigations,
        public_known_limitations, source_disclosure, contributor_address,
        reviewer_address, publication_status, quest_conversion_status,
        published_at
       FROM bestiary_entries WHERE case_id = $1 LIMIT 1`,
      [row.id],
    );
  } catch (error) {
    return mapDatabaseError(error);
  }

  return {
    ok: true as const,
    schemaVersion: "contribution-review-v1" as const,
    case: {
      ...metadata(row),
      vulnerableSource: row.vulnerable_source,
      attackSource: row.attack_source,
      fixedSource: row.fixed_source,
      analysisJson: row.analysis_json,
      reviews: reviews.map(reviewDetails),
      merit: {
        entries: merits.map(meritDetails),
        totalMerit: merits.reduce((total, entry) => total + entry.amount, 0),
      },
      bestiary: bestiaryRows[0] ? publicBestiary(bestiaryRows[0]) : null,
    },
  };
}

export async function applyReviewDecision(caseId: string, input: ReviewDecisionInput) {
  const { reviewerAddress } = await requireReviewerSession();
  assertCaseId(caseId);
  const total =
    input.evidenceQuality +
    input.reproducibility +
    input.technicalAccuracy +
    input.remediationQuality +
    input.contributionValue;
  const storedNotes = JSON.stringify({ summary: input.reviewSummary, notes: input.reviewNotes });
  const reason = JSON.stringify({
    type: "case-review-approved",
    caseId,
    reviewerAddress,
    decision: input.decision,
    scoreBreakdown: {
      evidenceQuality: input.evidenceQuality,
      reproducibility: input.reproducibility,
      technicalAccuracy: input.technicalAccuracy,
      remediationQuality: input.remediationQuality,
      contributionValue: input.contributionValue,
    },
  });
  const idempotencyKey = `${REVIEW_IDEMPOTENCY_PREFIX}${caseId}`;

  type ResultRow = {
    case_id: string;
    status: string;
    review_id: string;
    merit_amount: number | null;
    bestiary_case_id: string | null;
  };
  let result: ResultRow[];
  try {
    result = await queryRows<ResultRow>(
      getNeonSql(),
      `WITH target AS (
         SELECT sc.*, r.display_name AS reservation_display_name,
           r.normalized_name AS reservation_normalized_name
         FROM security_cases sc
         LEFT JOIN bestiary_name_reservations r ON r.case_id = sc.id
         WHERE sc.case_id = $1
         FOR UPDATE OF sc
       ), updated_case AS (
         UPDATE security_cases sc
         SET status = $2::case_status, updated_at = now()
         FROM target t
         WHERE sc.id = t.id
           AND t.status IN ('pending_review', 'changes_requested')
           AND ($2 <> 'approved' OR t.reservation_normalized_name IS NOT NULL)
         RETURNING sc.*, t.reservation_display_name, t.reservation_normalized_name
       ), inserted_review AS (
         INSERT INTO case_reviews (
           case_id, reviewer_address, decision, review_notes,
           final_bestiary_name, normalized_final_name, final_quest_title,
           evidence_score, reproducibility_score, fix_quality_score,
           educational_value_score, novelty_score, merit_total
         )
         SELECT id, $3, $2::review_decision, $4,
           reservation_display_name, reservation_normalized_name, NULL,
           $5, $6, $7, $8, $9, $10
         FROM updated_case
         RETURNING id, case_id
       ), inserted_merit AS (
         INSERT INTO merit_ledger (
           wallet_address, case_id, review_id, reason, amount, idempotency_key
         )
         SELECT uc.contributor_address, uc.id, ir.id, $11, $10, $12
         FROM updated_case uc
         JOIN inserted_review ir ON ir.case_id = uc.id
         WHERE $2 = 'approved'
         RETURNING case_id, amount
       ), updated_reservation AS (
         UPDATE bestiary_name_reservations r
         SET status = CASE
             WHEN $2 = 'approved' THEN 'approved'::name_reservation_status
             WHEN $2 = 'rejected' THEN 'released'::name_reservation_status
             ELSE r.status
           END,
           released_at = CASE WHEN $2 = 'rejected' THEN now() ELSE r.released_at END
         FROM updated_case uc
         WHERE r.case_id = uc.id
         RETURNING r.case_id, r.display_name, r.normalized_name, r.status
       ), inserted_bestiary AS (
         INSERT INTO bestiary_entries (
           case_id, display_name, normalized_name, formal_type,
           primary_element, secondary_elements, realm, severity_label,
           confidence_label, public_summary, public_attack_pattern,
           public_prerequisites, public_impact, public_mitigations,
           public_known_limitations, public_code_excerpt, source_disclosure,
           contributor_address, reviewer_address, publication_status,
           quest_conversion_status, published_at
         )
         SELECT uc.id, ur.display_name, ur.normalized_name, uc.formal_type,
           uc.primary_element, uc.secondary_elements,
           uc.analysis_json #>> '{classification,realm,realm}',
           uc.severity_label, uc.confidence_label,
           COALESCE(
             uc.analysis_json #>> '{bestiaryDraft,summary}',
             uc.analysis_json #>> '{analysis,impact}'
           ),
           COALESCE(
             uc.analysis_json #> '{bestiaryDraft,attackPattern}',
             uc.analysis_json #> '{analysis,attackPath}',
             '[]'::jsonb
           ),
           COALESCE(
             uc.analysis_json #> '{bestiaryDraft,prerequisites}',
             uc.analysis_json #> '{analysis,prerequisites}',
             '[]'::jsonb
           ),
           COALESCE(
             uc.analysis_json #>> '{bestiaryDraft,impact}',
             uc.analysis_json #>> '{analysis,impact}'
           ),
           COALESCE(
             uc.analysis_json #> '{bestiaryDraft,mitigations}',
             uc.analysis_json #> '{analysis,mitigations}',
             '[]'::jsonb
           ),
           COALESCE(
             uc.analysis_json #> '{bestiaryDraft,knownLimitations}',
             uc.analysis_json #> '{limitations}',
             '[]'::jsonb
           ),
           NULL, 'summary_only'::source_disclosure,
           uc.contributor_address, $3, 'published'::bestiary_publication_status,
           'not_started'::quest_conversion_status, now()
         FROM updated_case uc
         JOIN updated_reservation ur ON ur.case_id = uc.id
         WHERE $2 = 'approved'
         RETURNING case_id
       )
       SELECT uc.case_id, uc.status, ir.id AS review_id,
         im.amount AS merit_amount, ib.case_id AS bestiary_case_id
       FROM updated_case uc
       JOIN inserted_review ir ON ir.case_id = uc.id
       LEFT JOIN inserted_merit im ON im.case_id = uc.id
       LEFT JOIN inserted_bestiary ib ON ib.case_id = uc.id`,
      [
        caseId,
        input.decision,
        reviewerAddress,
        storedNotes,
        input.evidenceQuality,
        input.reproducibility,
        input.technicalAccuracy,
        input.remediationQuality,
        input.contributionValue,
        total,
        reason,
        idempotencyKey,
      ],
    );
  } catch (error) {
    return mapDatabaseError(error);
  }

  const row = result[0];
  if (!row) {
    let existing: { status: string }[];
    try {
      existing = await queryRows<{ status: string }>(
        getNeonSql(),
        "SELECT status FROM security_cases WHERE case_id = $1 LIMIT 1",
        [caseId],
      );
    } catch (error) {
      return mapDatabaseError(error);
    }
    if (!existing[0]) throw new ReviewHttpError("CASE_NOT_FOUND");
    throw new ReviewHttpError("CASE_STATE_CONFLICT");
  }

  return {
    ok: true as const,
    schemaVersion: "contribution-review-v1" as const,
    caseId: row.case_id,
    status: row.status,
    reviewId: row.review_id,
    meritAmount: row.merit_amount ?? 0,
    bestiaryCreated: row.bestiary_case_id !== null,
    totalScore: total,
  };
}

export async function getCurrentMerit() {
  const { walletAddress } = await requireReviewerOrUserSession();
  let rows: MeritRow[];
  let totalRows: { total_merit: number | string | null }[];
  try {
    const sql = getNeonSql();
    totalRows = await queryRows<{ total_merit: number | string | null }>(
      sql,
      "SELECT COALESCE(SUM(amount), 0) AS total_merit FROM merit_ledger WHERE wallet_address = $1",
      [walletAddress.toLowerCase()],
    );
    rows = await queryRows<MeritRow>(
      sql,
      `SELECT sc.case_id, ml.amount, ml.reason, ml.idempotency_key, ml.created_at
       FROM merit_ledger ml
       JOIN security_cases sc ON sc.id = ml.case_id
       WHERE ml.wallet_address = $1
       ORDER BY ml.created_at DESC LIMIT 100`,
      [walletAddress.toLowerCase()],
    );
  } catch (error) {
    return mapDatabaseError(error);
  }
  return {
    ok: true as const,
    schemaVersion: "contribution-review-v1" as const,
    walletAddress: walletAddress.toLowerCase(),
    totalMerit: Number(totalRows[0]?.total_merit ?? 0),
    entries: rows.map(meritDetails),
  };
}

async function requireReviewerOrUserSession() {
  const session = await getAuthenticatedSession();
  if (!session) throw new ReviewHttpError("AUTH_REQUIRED");
  return session;
}

export async function listBestiary() {
  let rows: BestiaryRow[];

  try {
    rows = await queryRows<BestiaryRow>(
      getNeonSql(),
      `SELECT sc.case_id AS case_id,
        be.display_name, be.normalized_name, be.formal_type,
        be.primary_element, be.secondary_elements, be.realm,
        be.severity_label, be.confidence_label,
        be.public_summary, be.public_attack_pattern,
        be.public_prerequisites, be.public_impact,
        be.public_mitigations, be.public_known_limitations,
        be.source_disclosure, be.contributor_address,
        be.reviewer_address, be.publication_status,
        be.quest_conversion_status, be.published_at
       FROM bestiary_entries be
       JOIN security_cases sc ON sc.id = be.case_id
       WHERE be.publication_status =
         'published'::bestiary_publication_status
       ORDER BY be.published_at DESC NULLS LAST,
         be.updated_at DESC
       LIMIT 100`,
      [],
    );
  } catch (error) {
    return mapDatabaseError(error);
  }

  return {
    ok: true as const,
    schemaVersion: "contribution-review-v1" as const,
    entries: rows.map(publicBestiary),
  };
}

export async function getPublishedBestiary(caseId: string) {
  if (
    !REVIEW_CASE_ID_PATTERN.test(caseId) ||
    !CONTRIBUTION_CASE_ID_PATTERN.test(caseId)
  ) {
    throw new ReviewHttpError("BESTIARY_ENTRY_NOT_FOUND");
  }

  let rows: BestiaryRow[];

  try {
    rows = await queryRows<BestiaryRow>(
      getNeonSql(),
      `SELECT sc.case_id AS case_id,
        be.display_name, be.normalized_name, be.formal_type,
        be.primary_element, be.secondary_elements, be.realm,
        be.severity_label, be.confidence_label,
        be.public_summary, be.public_attack_pattern,
        be.public_prerequisites, be.public_impact,
        be.public_mitigations, be.public_known_limitations,
        be.source_disclosure, be.contributor_address,
        be.reviewer_address, be.publication_status,
        be.quest_conversion_status, be.published_at
       FROM bestiary_entries be
       JOIN security_cases sc ON sc.id = be.case_id
       WHERE sc.case_id = $1
         AND be.publication_status =
           'published'::bestiary_publication_status
       LIMIT 1`,
      [caseId],
    );
  } catch (error) {
    return mapDatabaseError(error);
  }

  if (!rows[0]) {
    throw new ReviewHttpError("BESTIARY_ENTRY_NOT_FOUND");
  }

  return {
    ok: true as const,
    schemaVersion: "contribution-review-v1" as const,
    entry: publicBestiary(rows[0]),
  };
}
