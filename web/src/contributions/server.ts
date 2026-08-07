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
import { type ContributionInput, type SignedContributionInput } from "@/contributions/http";
import { normalizeBestiaryName, normalizeSourceForHash } from "@/contributions/normalize";
import { guardianAnalysisDigest } from "@/lib/guardian-analysis-digest";
import {
  prepareSignedContribution,
  type PreparedSignedContribution,
} from "@/contributions/signed-contribution";

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
  };
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

export async function listContributions() {
  const contributorAddress = await requireAuthenticatedWallet();
  let rows: CaseRow[];
  try {
    rows = await queryRows<CaseRow>(
      getNeonSql(),
      `SELECT case_id, case_hash, case_name, contributor_address,
        formal_type, primary_element, secondary_elements, severity_label,
        severity_score, confidence_label, confidence_score,
        proposed_bestiary_name, status, created_at
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
  if (!CONTRIBUTION_CASE_ID_PATTERN.test(caseId)) {
    throw new ContributionHttpError("INVALID_CASE_ID");
  }
  let rows: CaseRow[];
  try {
    rows = await queryRows<CaseRow>(
      getNeonSql(),
      `SELECT case_id, case_hash, case_name, contributor_address,
        formal_type, primary_element, secondary_elements, severity_label,
        severity_score, confidence_label, confidence_score,
        proposed_bestiary_name, status, created_at,
        vulnerable_source, attack_source, fixed_source, analysis_json
       FROM security_cases
       WHERE case_id = $1 AND contributor_address = $2
       LIMIT 1`,
      [caseId, contributorAddress],
    );
  } catch (error) {
    return mapDatabaseError(error);
  }
  const row = rows[0];
  if (!row) throw new ContributionHttpError("CASE_NOT_FOUND");
  return {
    ok: true as const,
    schemaVersion: CONTRIBUTION_SCHEMA_VERSION,
    case: {
      ...toCaseMetadata(row),
      vulnerableSource: row.vulnerable_source ?? "",
      attackSource: row.attack_source ?? "",
      fixedSource: row.fixed_source ?? "",
      analysisJson: row.analysis_json,
    },
  };
}
