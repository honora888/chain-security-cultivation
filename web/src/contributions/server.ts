import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";

import {
  GuardianSecurityError,
  type GuardianSampleRequest,
  type GuardianSecuritySuccess,
  type MossNotApplicableEvidence,
} from "@/features/guardian-security/analysis-types";
import { analyzeGuardianSecurityCase } from "@/features/guardian-security/analyze";
import {
  createSampleBestiaryDraftName,
  SAMPLE_BESTIARY_NAME_ATTEMPTS,
} from "@/features/guardian-security/sample-draft-name";
import { AUTH_COOKIE_NAME } from "@/auth/constants";
import { readSession } from "@/auth/server";
import { DatabaseConfigurationError, getNeonSql, type NeonSql } from "@/db/client";
import { hashSecret } from "@/auth/crypto";
import {
  CONTRIBUTION_CASE_ID_PATTERN,
  CONTRIBUTION_RESERVED_BESTIARY_NAMES,
  CONTRIBUTION_SCHEMA_VERSION,
  ContributionHttpError,
} from "@/contributions/constants";
import {
  type ContributionCredential,
  type ContributionInput,
  type SignedContributionInput,
} from "@/contributions/http";
import { normalizeBestiaryName, normalizeSourceForHash } from "@/contributions/normalize";
import { guardianAnalysisDigest } from "@/lib/guardian-analysis-digest";
import {
  prepareSignedContribution,
  type PreparedSignedContribution,
} from "@/contributions/signed-contribution";
import {
  isCultivationElement,
  isCultivationRealm,
} from "@/features/guardian-security/cultivation-labels";
import {
  FORMAL_CONFIDENCE_VALUES,
  FORMAL_SEVERITY_VALUES,
  FORMAL_VULNERABILITY_TYPES,
} from "@/reviews/formal-classification";

type CaseRow = {
  case_id: string;
  case_hash: string;
  case_name: string;
  contributor_address: string;
  formal_type: string | null;
  primary_element: string | null;
  secondary_elements: unknown;
  severity_label: string | null;
  severity_score: number | null;
  confidence_label: string | null;
  confidence_score: number | null;
  proposed_bestiary_name: string | null;
  status: string;
  created_at: string | Date;
  vulnerable_source?: string;
  attack_source?: string;
  fixed_source?: string;
  analysis_json?: unknown;
  normalized_bestiary_name?: string | null;
  updated_at?: string | Date;
  latest_review_notes?: string | null;
};

type ContributorReviewRow = {
  id: string;
  decision: string;
  review_notes: string;
  evidence_score: number;
  reproducibility_score: number;
  fix_quality_score: number;
  educational_value_score: number;
  novelty_score: number;
  merit_total: number;
  created_at: string | Date;
};

type InsertedCaseRow = CaseRow;

async function queryRows<T>(sql: NeonSql, query: string, params: unknown[]): Promise<T[]> {
  const rows = await sql.query(query, params);
  return rows as unknown as T[];
}

function databaseConstraint(error: unknown): string {
  return typeof error === "object" && error !== null && "constraint" in error &&
    typeof error.constraint === "string" ? error.constraint : "";
}

function isBestiaryNameCollision(error: unknown): boolean {
  const constraint = databaseConstraint(error);
  return constraint === "bestiary_name_reservations_normalized_name_unique" ||
    constraint === "bestiary_name_reservations_active_name_unique" ||
    constraint === "bestiary_entries_normalized_name_unique";
}

function mapDatabaseError(error: unknown): never {
  if (error instanceof DatabaseConfigurationError) {
    throw new ContributionHttpError("DATABASE_NOT_CONFIGURED");
  }
  const constraint = databaseConstraint(error);
  if (constraint === "security_cases_case_hash_unique") {
    throw new ContributionHttpError("CASE_ALREADY_EXISTS");
  }
  if (
    constraint === "bestiary_name_reservations_normalized_name_unique" ||
    constraint === "bestiary_name_reservations_active_name_unique" ||
    constraint === "bestiary_entries_normalized_name_unique"
  ) {
    throw new ContributionHttpError("BESTIARY_NAME_UNAVAILABLE");
  }
  throw new ContributionHttpError("DATABASE_UNAVAILABLE");
}

function toArray(value: unknown): readonly string[] {
  if (typeof value === "string") {
    try {
      return toArray(JSON.parse(value) as unknown);
    } catch {
      return [];
    }
  }
  if (Array.isArray(value) && value.every((entry) => typeof entry === "string")) {
    return value;
  }
  return [];
}

function toCaseMetadata(row: CaseRow) {
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
    ...(row.updated_at ? { updatedAt: new Date(row.updated_at).toISOString() } : {}),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseReviewEnvelope(value: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(value);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function hasRevisionSnapshot(value: string | null | undefined): boolean {
  const envelope = value ? parseReviewEnvelope(value) : null;
  const snapshot = envelope?.revisionSnapshot;
  return Boolean(
    isRecord(snapshot) &&
    typeof snapshot.caseHash === "string" &&
    typeof snapshot.caseName === "string" &&
    typeof snapshot.vulnerableSource === "string" &&
    typeof snapshot.attackSource === "string" &&
    typeof snapshot.fixedSource === "string" &&
    Object.hasOwn(snapshot, "analysisJson"),
  );
}

function safeFormalClassification(value: unknown): Record<string, unknown> | null {
  if (!isRecord(value)) return null;
  const severity = isRecord(value.severity) ? value.severity : null;
  const confidence = isRecord(value.confidence) ? value.confidence : null;
  if (
    !FORMAL_VULNERABILITY_TYPES.includes(value.formalType as (typeof FORMAL_VULNERABILITY_TYPES)[number]) ||
    !isCultivationElement(value.primaryElement) ||
    !Array.isArray(value.secondaryElements) ||
    !value.secondaryElements.every(isCultivationElement) ||
    !isCultivationRealm(value.realm) ||
    !severity ||
    !FORMAL_SEVERITY_VALUES.includes(severity.label as (typeof FORMAL_SEVERITY_VALUES)[number]) ||
    typeof severity.score !== "number" ||
    !confidence ||
    !FORMAL_CONFIDENCE_VALUES.includes(confidence.label as (typeof FORMAL_CONFIDENCE_VALUES)[number]) ||
    typeof confidence.score !== "number"
  ) return null;
  return {
    formalType: value.formalType,
    primaryElement: value.primaryElement,
    secondaryElements: value.secondaryElements,
    realm: value.realm,
    severity: { label: severity.label, score: severity.score },
    confidence: { label: confidence.label, score: confidence.score },
  };
}

function contributorReview(row: ContributorReviewRow) {
  const envelope = parseReviewEnvelope(row.review_notes);
  return {
    reviewId: row.id,
    decision: row.decision,
    reviewedAt: new Date(row.created_at).toISOString(),
    score: {
      evidenceQuality: row.evidence_score,
      reproducibility: row.reproducibility_score,
      technicalAccuracy: row.fix_quality_score,
      remediationQuality: row.educational_value_score,
      contributionValue: row.novelty_score,
      total: row.merit_total,
    },
    guardianFeedback: typeof envelope?.summary === "string" ? envelope.summary : "",
    formalClassification: row.decision === "approved"
      ? safeFormalClassification(envelope?.classification)
      : null,
  };
}

function safeContributorAnalysis(value: unknown): unknown {
  if (isRecord(value) && value.schemaVersion === "guardian-signed-contribution-v1") {
    const draft = isRecord(value.signedDraft) && isRecord(value.signedDraft.claims) &&
      isRecord(value.signedDraft.claims.draft) ? value.signedDraft.claims.draft : null;
    return draft && Object.hasOwn(draft, "analysis") ? draft.analysis : null;
  }
  return value;
}

async function requireAuthenticatedWallet(): Promise<string> {
  const token = (await cookies()).get(AUTH_COOKIE_NAME)?.value;
  if (!token) throw new ContributionHttpError("AUTH_REQUIRED");
  const session = await readSession(token);
  if (!session) throw new ContributionHttpError("AUTH_REQUIRED");
  return session.walletAddress.toLowerCase();
}

function normalizeAnalysisResult(result: GuardianSecuritySuccess): GuardianSecuritySuccess {
  if (
    result.schemaVersion !== "guardian-security-analysis-v1" ||
    result.ok !== true ||
    result.inputMode !== "sample" ||
    result.review.requiresHumanApproval !== true ||
    result.review.publishAllowed !== false
  ) {
    throw new ContributionHttpError("ANALYSIS_FAILED");
  }
  return result;
}

async function analyzeContribution(input: ContributionInput): Promise<GuardianSecuritySuccess> {
  const request: GuardianSampleRequest = {
    mode: "sample",
    sample: {
      name: input.caseName,
      vulnerableSource: input.vulnerableSource,
      attackSource: input.attackSource,
      fixedSource: input.fixedSource,
    },
  };
  const mossEvidence: MossNotApplicableEvidence = {
    status: "not-applicable",
    reason: "User-provided samples are not registered Guardian quests.",
  };
  try {
    return normalizeAnalysisResult(analyzeGuardianSecurityCase(request, mossEvidence));
  } catch (error) {
    if (error instanceof ContributionHttpError) throw error;
    if (error instanceof GuardianSecurityError && error.code === "UNSUPPORTED_VULNERABILITY") {
      throw new ContributionHttpError("ANALYSIS_UNSUPPORTED");
    }
    throw new ContributionHttpError("ANALYSIS_FAILED");
  }
}

export async function createContribution(input: ContributionInput, expectedAnalysisDigest: string) {
  const contributorAddress = await requireAuthenticatedWallet();
  const normalizedSources = [
    normalizeSourceForHash(input.vulnerableSource),
    normalizeSourceForHash(input.attackSource),
    normalizeSourceForHash(input.fixedSource),
  ];
  const caseHash = hashSecret(JSON.stringify(normalizedSources));
  const analysis = await analyzeContribution(input);
  if (guardianAnalysisDigest(analysis) !== expectedAnalysisDigest) {
    throw new ContributionHttpError("ANALYSIS_CHANGED");
  }
  const caseId = `case-${randomUUID()}`;
  const elements = analysis.classification.elements;
  const draftNames = Array.from(
    { length: SAMPLE_BESTIARY_NAME_ATTEMPTS },
    (_, attempt) => createSampleBestiaryDraftName(
      elements.primaryElement,
      caseHash,
      attempt,
    ),
  ).filter((name) => !CONTRIBUTION_RESERVED_BESTIARY_NAMES.has(normalizeBestiaryName(name)));

  if (analysis.bestiaryDraft.name !== draftNames[0]) {
    throw new ContributionHttpError("ANALYSIS_FAILED");
  }

  for (const proposedBestiaryName of draftNames) {
    const normalizedBestiaryName = normalizeBestiaryName(proposedBestiaryName);
    const storedAnalysis = proposedBestiaryName === analysis.bestiaryDraft.name
      ? analysis
      : {
          ...analysis,
          bestiaryDraft: { ...analysis.bestiaryDraft, name: proposedBestiaryName },
        };
    let rows: InsertedCaseRow[];
    try {
      rows = await queryRows<InsertedCaseRow>(
      getNeonSql(),
      `WITH inserted_case AS (
         INSERT INTO security_cases (
           case_id, case_hash, contributor_address, case_name,
           vulnerable_source, attack_source, fixed_source, analysis_json,
           formal_type, primary_element, secondary_elements,
           severity_label, severity_score, confidence_label, confidence_score,
           proposed_bestiary_name, normalized_bestiary_name, status
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8::jsonb,
           $9, $10, $11::jsonb, $12, $13, $14, $15, $16, $17,
           'pending_review'::case_status
         )
         RETURNING id, case_id, case_hash, case_name, contributor_address,
           formal_type, primary_element, secondary_elements, severity_label,
           severity_score, confidence_label, confidence_score,
           proposed_bestiary_name, status, created_at
       ), reserved_name AS (
         INSERT INTO bestiary_name_reservations (
           normalized_name, display_name, case_id, status
         )
         SELECT $17, $16, inserted_case.id, 'reserved'::name_reservation_status
         FROM inserted_case
         UNION ALL
         SELECT $17, $16, inserted_case.id, 'reserved'::name_reservation_status
         FROM inserted_case
         WHERE EXISTS (
           SELECT 1 FROM bestiary_entries WHERE normalized_name = $17
         )
         RETURNING normalized_name
       )
       SELECT inserted_case.*
       FROM inserted_case
       INNER JOIN reserved_name ON reserved_name.normalized_name = $17`,
      [
        caseId,
        caseHash,
        contributorAddress,
        input.caseName,
        input.vulnerableSource,
        input.attackSource,
        input.fixedSource,
        JSON.stringify(storedAnalysis),
        storedAnalysis.analysis.formalType,
        elements.primaryElement,
        JSON.stringify(elements.secondaryElements),
        storedAnalysis.severity.level,
        storedAnalysis.severity.score,
        storedAnalysis.confidence.label,
        storedAnalysis.confidence.score,
        proposedBestiaryName,
        normalizedBestiaryName,
      ],
      );
    } catch (error) {
      if (isBestiaryNameCollision(error)) continue;
      return mapDatabaseError(error);
    }

    const row = rows[0];
    if (!row) throw new ContributionHttpError("DATABASE_UNAVAILABLE");
    return {
      ok: true as const,
      schemaVersion: CONTRIBUTION_SCHEMA_VERSION,
      case: toCaseMetadata(row),
      analysis: storedAnalysis,
    };
  }

  throw new ContributionHttpError("BESTIARY_NAME_UNAVAILABLE");
}

export async function persistPreparedSignedContribution(
  sql: NeonSql,
  prepared: PreparedSignedContribution,
  caseId = `case-${randomUUID()}`,
) {
  let rows: InsertedCaseRow[];
  try {
    rows = await queryRows<InsertedCaseRow>(
      sql,
      `WITH inserted_case AS (
         INSERT INTO security_cases (
           case_id, case_hash, contributor_address, case_name,
           vulnerable_source, attack_source, fixed_source, analysis_json,
           formal_type, primary_element, secondary_elements,
           severity_label, severity_score, confidence_label, confidence_score,
           proposed_bestiary_name, normalized_bestiary_name, status
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8::jsonb,
           $9, $10, $11::jsonb, $12, $13, $14, $15, $16, $17,
           'pending_review'::case_status
         )
         RETURNING id, case_id, case_hash, case_name, contributor_address,
           formal_type, primary_element, secondary_elements, severity_label,
           severity_score, confidence_label, confidence_score,
           proposed_bestiary_name, status, created_at
       ), reserved_name AS (
         INSERT INTO bestiary_name_reservations (
           normalized_name, display_name, case_id, status
         )
         SELECT $17, $16, inserted_case.id, 'reserved'::name_reservation_status
         FROM inserted_case
         UNION ALL
         SELECT $17, $16, inserted_case.id, 'reserved'::name_reservation_status
         FROM inserted_case
         WHERE EXISTS (
           SELECT 1 FROM bestiary_entries WHERE normalized_name = $17
         )
         RETURNING normalized_name
       )
       SELECT inserted_case.*
       FROM inserted_case
       INNER JOIN reserved_name ON reserved_name.normalized_name = $17`,
      [
        caseId,
        prepared.caseHash,
        prepared.contributorAddress,
        prepared.caseName,
        prepared.vulnerableSource,
        prepared.attackSource,
        prepared.fixedSource,
        JSON.stringify(prepared.storedAnalysis),
        prepared.formalType,
        prepared.primaryElement,
        JSON.stringify(prepared.secondaryElements),
        prepared.severityLabel,
        prepared.severityScore,
        prepared.confidenceLabel,
        prepared.confidenceScore,
        prepared.proposedBestiaryName,
        prepared.normalizedBestiaryName,
      ],
    );
  } catch (error) {
    return mapDatabaseError(error);
  }
  const row = rows[0];
  if (!row) throw new ContributionHttpError("DATABASE_UNAVAILABLE");
  return {
    ok: true as const,
    schemaVersion: CONTRIBUTION_SCHEMA_VERSION,
    case: toCaseMetadata(row),
    analysis: prepared.storedAnalysis,
  };
}

export async function createSignedContribution(input: SignedContributionInput) {
  const contributorAddress = await requireAuthenticatedWallet();
  const prepared = prepareSignedContribution({
    submission: input,
    authenticatedWallet: contributorAddress,
    secret: process.env.GUARDIAN_DRAFT_SIGNING_SECRET,
  });
  return persistPreparedSignedContribution(getNeonSql(), prepared);
}

type PreparedRevision = {
  readonly caseHash: string;
  readonly caseName: string;
  readonly vulnerableSource: string;
  readonly attackSource: string;
  readonly fixedSource: string;
  readonly analysisJson: unknown;
  readonly formalType: string | null;
  readonly primaryElement: string | null;
  readonly secondaryElements: readonly string[];
  readonly severityLabel: string | null;
  readonly severityScore: number | null;
  readonly confidenceLabel: string | null;
  readonly confidenceScore: number | null;
  readonly proposedBestiaryName: string;
  readonly normalizedBestiaryName: string;
};

async function prepareDeterministicRevision(
  input: ContributionInput,
  analysisDigest: string,
  preservedBestiaryName: string,
): Promise<PreparedRevision> {
  const normalizedSources = [
    normalizeSourceForHash(input.vulnerableSource),
    normalizeSourceForHash(input.attackSource),
    normalizeSourceForHash(input.fixedSource),
  ];
  const caseHash = hashSecret(JSON.stringify(normalizedSources));
  const analysis = await analyzeContribution(input);
  if (guardianAnalysisDigest(analysis) !== analysisDigest) {
    throw new ContributionHttpError("ANALYSIS_CHANGED");
  }
  const storedAnalysis = {
    ...analysis,
    bestiaryDraft: { ...analysis.bestiaryDraft, name: preservedBestiaryName },
  };
  return {
    caseHash,
    caseName: input.caseName,
    vulnerableSource: input.vulnerableSource,
    attackSource: input.attackSource,
    fixedSource: input.fixedSource,
    analysisJson: storedAnalysis,
    formalType: storedAnalysis.analysis.formalType,
    primaryElement: storedAnalysis.classification.elements.primaryElement,
    secondaryElements: storedAnalysis.classification.elements.secondaryElements,
    severityLabel: storedAnalysis.severity.level,
    severityScore: storedAnalysis.severity.score,
    confidenceLabel: storedAnalysis.confidence.label,
    confidenceScore: storedAnalysis.confidence.score,
    proposedBestiaryName: preservedBestiaryName,
    normalizedBestiaryName: normalizeBestiaryName(preservedBestiaryName),
  };
}

export async function resubmitContributionWithContext(
  sql: NeonSql,
  caseId: string,
  credential: ContributionCredential,
  authenticatedWallet: string,
  signingSecret: string | null | undefined,
) {
  if (!CONTRIBUTION_CASE_ID_PATTERN.test(caseId)) {
    throw new ContributionHttpError("INVALID_CASE_ID");
  }
  const wallet = authenticatedWallet.toLowerCase();
  let currentRows: CaseRow[];
  try {
    currentRows = await queryRows<CaseRow>(
      sql,
      `SELECT sc.*, latest.review_notes AS latest_review_notes
       FROM security_cases sc
       LEFT JOIN LATERAL (
         SELECT review_notes FROM case_reviews
         WHERE case_id = sc.id AND decision = 'changes_requested'
         ORDER BY created_at DESC LIMIT 1
       ) latest ON true
       WHERE sc.case_id = $1 AND sc.contributor_address = $2
       LIMIT 1`,
      [caseId, wallet],
    );
  } catch (error) {
    return mapDatabaseError(error);
  }
  const current = currentRows[0];
  if (!current) throw new ContributionHttpError("CASE_NOT_FOUND");
  if (current.status !== "changes_requested") {
    throw new ContributionHttpError("CASE_STATE_CONFLICT");
  }
  if (!hasRevisionSnapshot(current.latest_review_notes)) {
    throw new ContributionHttpError("REVISION_HISTORY_UNAVAILABLE");
  }
  if (credential.input.caseName !== current.case_name || !current.proposed_bestiary_name) {
    throw new ContributionHttpError("INVALID_REQUEST");
  }

  let prepared: PreparedRevision;
  if (credential.mode === "signed") {
    const signed = prepareSignedContribution({
      submission: credential.input,
      authenticatedWallet: wallet,
      secret: signingSecret,
    });
    prepared = {
      caseHash: signed.caseHash,
      caseName: signed.caseName,
      vulnerableSource: signed.vulnerableSource,
      attackSource: signed.attackSource,
      fixedSource: signed.fixedSource,
      analysisJson: signed.storedAnalysis,
      formalType: signed.formalType,
      primaryElement: signed.primaryElement,
      secondaryElements: signed.secondaryElements,
      severityLabel: signed.severityLabel,
      severityScore: signed.severityScore,
      confidenceLabel: signed.confidenceLabel,
      confidenceScore: signed.confidenceScore,
      proposedBestiaryName: signed.proposedBestiaryName,
      normalizedBestiaryName: signed.normalizedBestiaryName,
    };
  } else {
    prepared = await prepareDeterministicRevision(
      credential.input,
      credential.analysisDigest,
      current.proposed_bestiary_name,
    );
  }

  let rows: InsertedCaseRow[];
  try {
    rows = await queryRows<InsertedCaseRow>(
      sql,
      `WITH target AS (
         SELECT sc.*, r.id AS reservation_id,
           r.normalized_name AS reservation_normalized_name
         FROM security_cases sc
         JOIN bestiary_name_reservations r
           ON r.case_id = sc.id AND r.status = 'reserved'
         WHERE sc.case_id = $1 AND sc.contributor_address = $2
           AND sc.status = 'changes_requested'
         FOR UPDATE OF sc, r
       ), released_name AS (
         UPDATE bestiary_name_reservations r
         SET status = 'released'::name_reservation_status, released_at = now()
         FROM target t
         WHERE r.id = t.reservation_id
           AND t.reservation_normalized_name <> $16
         RETURNING r.case_id
       ), inserted_name AS (
         INSERT INTO bestiary_name_reservations (
           normalized_name, display_name, case_id, status
         )
         SELECT $16, $15, t.id, 'reserved'::name_reservation_status
         FROM target t JOIN released_name rn ON rn.case_id = t.id
         UNION ALL
         SELECT $16, $15, t.id, 'reserved'::name_reservation_status
         FROM target t JOIN released_name rn ON rn.case_id = t.id
         WHERE EXISTS (SELECT 1 FROM bestiary_entries WHERE normalized_name = $16)
         RETURNING case_id
       ), retained_name AS (
         UPDATE bestiary_name_reservations r
         SET display_name = $15
         FROM target t
         WHERE r.id = t.reservation_id
           AND t.reservation_normalized_name = $16
         RETURNING r.case_id
       ), updated_case AS (
         UPDATE security_cases sc
         SET case_hash = $3, vulnerable_source = $4, attack_source = $5,
           fixed_source = $6, analysis_json = $7::jsonb,
           formal_type = $8, primary_element = $9,
           secondary_elements = $10::jsonb, severity_label = $11,
           severity_score = $12, confidence_label = $13,
           confidence_score = $14, proposed_bestiary_name = $15,
           normalized_bestiary_name = $16,
           status = 'pending_review'::case_status, updated_at = now()
         FROM target t
         WHERE sc.id = t.id AND (
           t.reservation_normalized_name = $16
           OR EXISTS (SELECT 1 FROM inserted_name n WHERE n.case_id = t.id)
         )
         RETURNING sc.*
       )
       SELECT case_id, case_hash, case_name, contributor_address,
         formal_type, primary_element, secondary_elements, severity_label,
         severity_score, confidence_label, confidence_score,
         proposed_bestiary_name, status, created_at, updated_at
       FROM updated_case`,
      [
        caseId,
        wallet,
        prepared.caseHash,
        prepared.vulnerableSource,
        prepared.attackSource,
        prepared.fixedSource,
        JSON.stringify(prepared.analysisJson),
        prepared.formalType,
        prepared.primaryElement,
        JSON.stringify(prepared.secondaryElements),
        prepared.severityLabel,
        prepared.severityScore,
        prepared.confidenceLabel,
        prepared.confidenceScore,
        prepared.proposedBestiaryName,
        prepared.normalizedBestiaryName,
      ],
    );
  } catch (error) {
    return mapDatabaseError(error);
  }
  const row = rows[0];
  if (!row) throw new ContributionHttpError("CASE_STATE_CONFLICT");
  return { ok: true as const, schemaVersion: CONTRIBUTION_SCHEMA_VERSION, case: toCaseMetadata(row) };
}

export async function resubmitContribution(caseId: string, credential: ContributionCredential) {
  const contributorAddress = await requireAuthenticatedWallet();
  return resubmitContributionWithContext(
    getNeonSql(),
    caseId,
    credential,
    contributorAddress,
    process.env.GUARDIAN_DRAFT_SIGNING_SECRET,
  );
}

export async function listContributions() {
  const contributorAddress = await requireAuthenticatedWallet();
  let rows: CaseRow[];
  try {
    rows = await queryRows<CaseRow>(
      getNeonSql(),
      `SELECT case_id, case_hash, case_name, contributor_address,
        formal_type, primary_element, secondary_elements, severity_label,
        severity_score, confidence_label, confidence_score,
        proposed_bestiary_name, status, created_at, updated_at
       FROM security_cases
       WHERE contributor_address = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [contributorAddress],
    );
  } catch (error) {
    return mapDatabaseError(error);
  }
  return {
    ok: true as const,
    schemaVersion: CONTRIBUTION_SCHEMA_VERSION,
    cases: rows.map(toCaseMetadata),
  };
}

export async function getContribution(caseId: string) {
  const contributorAddress = await requireAuthenticatedWallet();
  return getContributionWithContext(getNeonSql(), caseId, contributorAddress);
}

export async function getContributionWithContext(
  sql: NeonSql,
  caseId: string,
  contributorAddress: string,
) {
  const wallet = contributorAddress.toLowerCase();
  if (!CONTRIBUTION_CASE_ID_PATTERN.test(caseId)) {
    throw new ContributionHttpError("INVALID_CASE_ID");
  }
  let rows: CaseRow[];
  let reviewRows: ContributorReviewRow[];
  try {
    rows = await queryRows<CaseRow>(
      sql,
      `SELECT case_id, case_hash, case_name, contributor_address,
        formal_type, primary_element, secondary_elements, severity_label,
        severity_score, confidence_label, confidence_score,
        proposed_bestiary_name, status, created_at, updated_at,
        vulnerable_source, attack_source, fixed_source, analysis_json
       FROM security_cases
       WHERE case_id = $1 AND contributor_address = $2
       LIMIT 1`,
      [caseId, wallet],
    );
    reviewRows = await queryRows<ContributorReviewRow>(
      sql,
      `SELECT cr.id, cr.decision, cr.review_notes,
         cr.evidence_score, cr.reproducibility_score, cr.fix_quality_score,
         cr.educational_value_score, cr.novelty_score, cr.merit_total,
         cr.created_at
       FROM case_reviews cr
       JOIN security_cases sc ON sc.id = cr.case_id
       WHERE sc.case_id = $1 AND sc.contributor_address = $2
       ORDER BY cr.created_at ASC, cr.id ASC`,
      [caseId, wallet],
    );
  } catch (error) {
    return mapDatabaseError(error);
  }
  const row = rows[0];
  if (!row) throw new ContributionHttpError("CASE_NOT_FOUND");
  const reviewHistory = reviewRows.map(contributorReview);
  const latestReview = row.status === "pending_review"
    ? null
    : reviewHistory.at(-1) ?? null;
  return {
    ok: true as const,
    schemaVersion: CONTRIBUTION_SCHEMA_VERSION,
    case: {
      ...toCaseMetadata(row),
      vulnerableSource: row.vulnerable_source ?? "",
      attackSource: row.attack_source ?? "",
      fixedSource: row.fixed_source ?? "",
      analysis: safeContributorAnalysis(row.analysis_json),
      latestReview,
      reviewHistory,
    },
  };
}
