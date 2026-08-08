import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const caseStatus = pgEnum("case_status", [
  "draft",
  "pending_review",
  "changes_requested",
  "approved",
  "rejected",
]);

export const reviewDecision = pgEnum("review_decision", [
  "approved",
  "changes_requested",
  "rejected",
]);

export const nameReservationStatus = pgEnum("name_reservation_status", [
  "reserved",
  "approved",
  "released",
]);

export const bestiaryPublicationStatus = pgEnum("bestiary_publication_status", [
  "unpublished",
  "published",
  "withdrawn",
]);

export const questConversionStatus = pgEnum("quest_conversion_status", [
  "not_started",
  "candidate",
  "ready",
  "registered_on_monad",
]);

export const sourceDisclosure = pgEnum("source_disclosure", [
  "summary_only",
  "reviewed_excerpt",
  "full_source",
]);

export const walletNonces = pgTable(
  "wallet_nonces",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    walletAddress: text("wallet_address").notNull(),
    nonceHash: text("nonce_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    nonceHashUnique: uniqueIndex("wallet_nonces_nonce_hash_unique").on(table.nonceHash),
    walletAddressIndex: index("wallet_nonces_wallet_address_idx").on(table.walletAddress),
    expiresAtIndex: index("wallet_nonces_expires_at_idx").on(table.expiresAt),
  }),
);

export const walletSessions = pgTable(
  "wallet_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    walletAddress: text("wallet_address").notNull(),
    sessionHash: text("session_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    sessionHashUnique: uniqueIndex("wallet_sessions_session_hash_unique").on(table.sessionHash),
    walletAddressIndex: index("wallet_sessions_wallet_address_idx").on(table.walletAddress),
    expiresAtIndex: index("wallet_sessions_expires_at_idx").on(table.expiresAt),
  }),
);

export const questCompletions = pgTable(
  "quest_completions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    walletAddress: text("wallet_address").notNull(),
    questId: integer("quest_id").notNull(),
    expAwarded: integer("exp_awarded").notNull(),
    masteryElement: text("mastery_element").notNull(),
    masteryAwarded: integer("mastery_awarded").notNull(),
    badgeKey: text("badge_key").notNull(),
    completionHash: text("completion_hash").notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    walletQuestUnique: uniqueIndex("quest_completions_wallet_quest_unique").on(
      table.walletAddress,
      table.questId,
    ),
    walletAddressIndex: index("quest_completions_wallet_address_idx").on(table.walletAddress),
    completedAtIndex: index("quest_completions_completed_at_idx").on(table.completedAt),
    expAwardedCheck: check(
      "quest_completions_exp_awarded_non_negative",
      sql`${table.expAwarded} >= 0`,
    ),
    masteryAwardedCheck: check(
      "quest_completions_mastery_awarded_non_negative",
      sql`${table.masteryAwarded} >= 0`,
    ),
  }),
);

export const securityCases = pgTable(
  "security_cases",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    caseId: text("case_id").notNull(),
    caseHash: text("case_hash").notNull(),
    contributorAddress: text("contributor_address").notNull(),
    caseName: text("case_name").notNull(),
    vulnerableSource: text("vulnerable_source").notNull(),
    attackSource: text("attack_source").notNull().default(""),
    fixedSource: text("fixed_source").notNull().default(""),
    analysisJson: jsonb("analysis_json"),
    formalType: text("formal_type"),
    primaryElement: text("primary_element"),
    secondaryElements: jsonb("secondary_elements").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    severityLabel: text("severity_label"),
    severityScore: integer("severity_score"),
    confidenceLabel: text("confidence_label"),
    confidenceScore: integer("confidence_score"),
    proposedBestiaryName: text("proposed_bestiary_name"),
    normalizedBestiaryName: text("normalized_bestiary_name"),
    status: caseStatus("status").notNull().default("draft"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    caseIdUnique: uniqueIndex("security_cases_case_id_unique").on(table.caseId),
    caseHashUnique: uniqueIndex("security_cases_case_hash_unique").on(table.caseHash),
    contributorAddressIndex: index("security_cases_contributor_address_idx").on(table.contributorAddress),
    statusIndex: index("security_cases_status_idx").on(table.status),
    createdAtIndex: index("security_cases_created_at_idx").on(table.createdAt),
    severityScoreCheck: check(
      "security_cases_severity_score_range",
      sql`${table.severityScore} IS NULL OR (${table.severityScore} BETWEEN 0 AND 12)`,
    ),
    confidenceScoreCheck: check(
      "security_cases_confidence_score_range",
      sql`${table.confidenceScore} IS NULL OR (${table.confidenceScore} BETWEEN 0 AND 100)`,
    ),
  }),
);

export const caseReviews = pgTable(
  "case_reviews",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => securityCases.id, { onDelete: "restrict" }),
    reviewerAddress: text("reviewer_address").notNull(),
    decision: reviewDecision("decision").notNull(),
    reviewNotes: text("review_notes").notNull(),
    finalBestiaryName: text("final_bestiary_name"),
    normalizedFinalName: text("normalized_final_name"),
    finalQuestTitle: text("final_quest_title"),
    evidenceScore: integer("evidence_score").notNull(),
    reproducibilityScore: integer("reproducibility_score").notNull(),
    fixQualityScore: integer("fix_quality_score").notNull(),
    educationalValueScore: integer("educational_value_score").notNull(),
    noveltyScore: integer("novelty_score").notNull(),
    meritTotal: integer("merit_total").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    caseIdIndex: index("case_reviews_case_id_idx").on(table.caseId),
    reviewerAddressIndex: index("case_reviews_reviewer_address_idx").on(table.reviewerAddress),
    decisionIndex: index("case_reviews_decision_idx").on(table.decision),
    createdAtIndex: index("case_reviews_created_at_idx").on(table.createdAt),
    evidenceScoreCheck: check("case_reviews_evidence_score_range", sql`${table.evidenceScore} BETWEEN 0 AND 25`),
    reproducibilityScoreCheck: check("case_reviews_reproducibility_score_range", sql`${table.reproducibilityScore} BETWEEN 0 AND 25`),
    fixQualityScoreCheck: check("case_reviews_fix_quality_score_range", sql`${table.fixQualityScore} BETWEEN 0 AND 20`),
    educationalValueScoreCheck: check("case_reviews_educational_value_score_range", sql`${table.educationalValueScore} BETWEEN 0 AND 20`),
    noveltyScoreCheck: check("case_reviews_novelty_score_range", sql`${table.noveltyScore} BETWEEN 0 AND 10`),
    meritTotalCheck: check("case_reviews_merit_total_range", sql`${table.meritTotal} BETWEEN 0 AND 100`),
  }),
);

export const meritLedger = pgTable(
  "merit_ledger",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    walletAddress: text("wallet_address").notNull(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => securityCases.id, { onDelete: "restrict" }),
    reviewId: uuid("review_id")
      .notNull()
      .references(() => caseReviews.id, { onDelete: "restrict" }),
    reason: text("reason").notNull(),
    amount: integer("amount").notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    idempotencyKeyUnique: uniqueIndex("merit_ledger_idempotency_key_unique").on(table.idempotencyKey),
    walletAddressIndex: index("merit_ledger_wallet_address_idx").on(table.walletAddress),
    caseIdIndex: index("merit_ledger_case_id_idx").on(table.caseId),
    reviewIdIndex: index("merit_ledger_review_id_idx").on(table.reviewId),
    createdAtIndex: index("merit_ledger_created_at_idx").on(table.createdAt),
    amountCheck: check("merit_ledger_amount_non_negative", sql`${table.amount} >= 0`),
  }),
);

export const bestiaryNameReservations = pgTable(
  "bestiary_name_reservations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    normalizedName: text("normalized_name").notNull(),
    displayName: text("display_name").notNull(),
    caseId: uuid("case_id").references(() => securityCases.id, { onDelete: "restrict" }),
    status: nameReservationStatus("status").notNull().default("reserved"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    releasedAt: timestamp("released_at", { withTimezone: true }),
  },
  (table) => ({
    activeNameUnique: uniqueIndex("bestiary_name_reservations_active_name_unique")
      .on(table.normalizedName)
      .where(
        sql`${table.status} IN ('reserved'::name_reservation_status, 'approved'::name_reservation_status)`,
      ),
    caseIdIndex: index("bestiary_name_reservations_case_id_idx").on(table.caseId),
    statusIndex: index("bestiary_name_reservations_status_idx").on(table.status),
  }),
);

export const bestiaryEntries = pgTable(
  "bestiary_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => securityCases.id, { onDelete: "restrict" }),
    displayName: text("display_name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    formalType: text("formal_type").notNull(),
    primaryElement: text("primary_element"),
    secondaryElements: jsonb("secondary_elements").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    realm: text("realm").notNull(),
    severityLabel: text("severity_label").notNull(),
    confidenceLabel: text("confidence_label").notNull(),
    publicSummary: text("public_summary").notNull(),
    publicAttackPattern: jsonb("public_attack_pattern").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    publicPrerequisites: jsonb("public_prerequisites").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    publicImpact: text("public_impact").notNull(),
    publicMitigations: jsonb("public_mitigations").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    publicKnownLimitations: jsonb("public_known_limitations").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    publicCodeExcerpt: text("public_code_excerpt"),
    sourceDisclosure: sourceDisclosure("source_disclosure").notNull().default("summary_only"),
    contributorAddress: text("contributor_address").notNull(),
    reviewerAddress: text("reviewer_address").notNull(),
    publicationStatus: bestiaryPublicationStatus("publication_status").notNull().default("unpublished"),
    questConversionStatus: questConversionStatus("quest_conversion_status").notNull().default("not_started"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    caseIdUnique: uniqueIndex("bestiary_entries_case_id_unique").on(table.caseId),
    normalizedNameUnique: uniqueIndex("bestiary_entries_normalized_name_unique").on(table.normalizedName),
    publicationStatusIndex: index("bestiary_entries_publication_status_idx").on(table.publicationStatus),
    questConversionStatusIndex: index("bestiary_entries_quest_conversion_status_idx").on(table.questConversionStatus),
    formalTypeIndex: index("bestiary_entries_formal_type_idx").on(table.formalType),
    primaryElementIndex: index("bestiary_entries_primary_element_idx").on(table.primaryElement),
    publishedAtIndex: index("bestiary_entries_published_at_idx").on(table.publishedAt),
  }),
);
