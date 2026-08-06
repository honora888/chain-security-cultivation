CREATE TYPE "public"."bestiary_publication_status" AS ENUM('unpublished', 'published', 'withdrawn');--> statement-breakpoint
CREATE TYPE "public"."case_status" AS ENUM('draft', 'pending_review', 'changes_requested', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."name_reservation_status" AS ENUM('reserved', 'approved', 'released');--> statement-breakpoint
CREATE TYPE "public"."quest_conversion_status" AS ENUM('not_started', 'candidate', 'ready', 'registered_on_monad');--> statement-breakpoint
CREATE TYPE "public"."review_decision" AS ENUM('approved', 'changes_requested', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."source_disclosure" AS ENUM('summary_only', 'reviewed_excerpt', 'full_source');--> statement-breakpoint
CREATE TABLE "bestiary_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"display_name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"formal_type" text NOT NULL,
	"primary_element" text,
	"secondary_elements" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"realm" text NOT NULL,
	"severity_label" text NOT NULL,
	"confidence_label" text NOT NULL,
	"public_summary" text NOT NULL,
	"public_attack_pattern" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"public_prerequisites" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"public_impact" text NOT NULL,
	"public_mitigations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"public_known_limitations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"public_code_excerpt" text,
	"source_disclosure" "source_disclosure" DEFAULT 'summary_only' NOT NULL,
	"contributor_address" text NOT NULL,
	"reviewer_address" text NOT NULL,
	"publication_status" "bestiary_publication_status" DEFAULT 'unpublished' NOT NULL,
	"quest_conversion_status" "quest_conversion_status" DEFAULT 'not_started' NOT NULL,
	"published_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bestiary_name_reservations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"normalized_name" text NOT NULL,
	"display_name" text NOT NULL,
	"case_id" uuid,
	"status" "name_reservation_status" DEFAULT 'reserved' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"released_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "case_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"reviewer_address" text NOT NULL,
	"decision" "review_decision" NOT NULL,
	"review_notes" text NOT NULL,
	"final_bestiary_name" text,
	"normalized_final_name" text,
	"final_quest_title" text,
	"evidence_score" integer NOT NULL,
	"reproducibility_score" integer NOT NULL,
	"fix_quality_score" integer NOT NULL,
	"educational_value_score" integer NOT NULL,
	"novelty_score" integer NOT NULL,
	"merit_total" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "case_reviews_evidence_score_range" CHECK ("case_reviews"."evidence_score" BETWEEN 0 AND 25),
	CONSTRAINT "case_reviews_reproducibility_score_range" CHECK ("case_reviews"."reproducibility_score" BETWEEN 0 AND 25),
	CONSTRAINT "case_reviews_fix_quality_score_range" CHECK ("case_reviews"."fix_quality_score" BETWEEN 0 AND 20),
	CONSTRAINT "case_reviews_educational_value_score_range" CHECK ("case_reviews"."educational_value_score" BETWEEN 0 AND 20),
	CONSTRAINT "case_reviews_novelty_score_range" CHECK ("case_reviews"."novelty_score" BETWEEN 0 AND 10),
	CONSTRAINT "case_reviews_merit_total_range" CHECK ("case_reviews"."merit_total" BETWEEN 0 AND 100)
);
--> statement-breakpoint
CREATE TABLE "merit_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet_address" text NOT NULL,
	"case_id" uuid NOT NULL,
	"review_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"amount" integer NOT NULL,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "merit_ledger_amount_non_negative" CHECK ("merit_ledger"."amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE "security_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" text NOT NULL,
	"case_hash" text NOT NULL,
	"contributor_address" text NOT NULL,
	"case_name" text NOT NULL,
	"vulnerable_source" text NOT NULL,
	"attack_source" text DEFAULT '' NOT NULL,
	"fixed_source" text DEFAULT '' NOT NULL,
	"analysis_json" jsonb,
	"formal_type" text,
	"primary_element" text,
	"secondary_elements" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"severity_label" text,
	"severity_score" integer,
	"confidence_label" text,
	"confidence_score" integer,
	"proposed_bestiary_name" text,
	"normalized_bestiary_name" text,
	"status" "case_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "security_cases_severity_score_range" CHECK ("security_cases"."severity_score" IS NULL OR ("security_cases"."severity_score" BETWEEN 0 AND 12)),
	CONSTRAINT "security_cases_confidence_score_range" CHECK ("security_cases"."confidence_score" IS NULL OR ("security_cases"."confidence_score" BETWEEN 0 AND 100))
);
--> statement-breakpoint
CREATE TABLE "wallet_nonces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet_address" text NOT NULL,
	"nonce_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wallet_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet_address" text NOT NULL,
	"session_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bestiary_entries" ADD CONSTRAINT "bestiary_entries_case_id_security_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."security_cases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bestiary_name_reservations" ADD CONSTRAINT "bestiary_name_reservations_case_id_security_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."security_cases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_reviews" ADD CONSTRAINT "case_reviews_case_id_security_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."security_cases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merit_ledger" ADD CONSTRAINT "merit_ledger_case_id_security_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."security_cases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merit_ledger" ADD CONSTRAINT "merit_ledger_review_id_case_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."case_reviews"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bestiary_entries_case_id_unique" ON "bestiary_entries" USING btree ("case_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bestiary_entries_normalized_name_unique" ON "bestiary_entries" USING btree ("normalized_name");--> statement-breakpoint
CREATE INDEX "bestiary_entries_publication_status_idx" ON "bestiary_entries" USING btree ("publication_status");--> statement-breakpoint
CREATE INDEX "bestiary_entries_quest_conversion_status_idx" ON "bestiary_entries" USING btree ("quest_conversion_status");--> statement-breakpoint
CREATE INDEX "bestiary_entries_formal_type_idx" ON "bestiary_entries" USING btree ("formal_type");--> statement-breakpoint
CREATE INDEX "bestiary_entries_primary_element_idx" ON "bestiary_entries" USING btree ("primary_element");--> statement-breakpoint
CREATE INDEX "bestiary_entries_published_at_idx" ON "bestiary_entries" USING btree ("published_at");--> statement-breakpoint
CREATE UNIQUE INDEX "bestiary_name_reservations_normalized_name_unique" ON "bestiary_name_reservations" USING btree ("normalized_name");--> statement-breakpoint
CREATE INDEX "bestiary_name_reservations_case_id_idx" ON "bestiary_name_reservations" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX "bestiary_name_reservations_status_idx" ON "bestiary_name_reservations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "case_reviews_case_id_idx" ON "case_reviews" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX "case_reviews_reviewer_address_idx" ON "case_reviews" USING btree ("reviewer_address");--> statement-breakpoint
CREATE INDEX "case_reviews_decision_idx" ON "case_reviews" USING btree ("decision");--> statement-breakpoint
CREATE INDEX "case_reviews_created_at_idx" ON "case_reviews" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "merit_ledger_idempotency_key_unique" ON "merit_ledger" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "merit_ledger_wallet_address_idx" ON "merit_ledger" USING btree ("wallet_address");--> statement-breakpoint
CREATE INDEX "merit_ledger_case_id_idx" ON "merit_ledger" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX "merit_ledger_review_id_idx" ON "merit_ledger" USING btree ("review_id");--> statement-breakpoint
CREATE INDEX "merit_ledger_created_at_idx" ON "merit_ledger" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "security_cases_case_id_unique" ON "security_cases" USING btree ("case_id");--> statement-breakpoint
CREATE UNIQUE INDEX "security_cases_case_hash_unique" ON "security_cases" USING btree ("case_hash");--> statement-breakpoint
CREATE INDEX "security_cases_contributor_address_idx" ON "security_cases" USING btree ("contributor_address");--> statement-breakpoint
CREATE INDEX "security_cases_status_idx" ON "security_cases" USING btree ("status");--> statement-breakpoint
CREATE INDEX "security_cases_created_at_idx" ON "security_cases" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "wallet_nonces_nonce_hash_unique" ON "wallet_nonces" USING btree ("nonce_hash");--> statement-breakpoint
CREATE INDEX "wallet_nonces_wallet_address_idx" ON "wallet_nonces" USING btree ("wallet_address");--> statement-breakpoint
CREATE INDEX "wallet_nonces_expires_at_idx" ON "wallet_nonces" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "wallet_sessions_session_hash_unique" ON "wallet_sessions" USING btree ("session_hash");--> statement-breakpoint
CREATE INDEX "wallet_sessions_wallet_address_idx" ON "wallet_sessions" USING btree ("wallet_address");--> statement-breakpoint
CREATE INDEX "wallet_sessions_expires_at_idx" ON "wallet_sessions" USING btree ("expires_at");--> statement-breakpoint
INSERT INTO "bestiary_name_reservations" ("normalized_name", "display_name", "status") VALUES ('噬灵回环兽', '噬灵回环兽', 'approved') ON CONFLICT ("normalized_name") DO NOTHING;
