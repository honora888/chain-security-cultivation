CREATE TABLE "quest_completions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wallet_address" text NOT NULL,
	"quest_id" integer NOT NULL,
	"exp_awarded" integer NOT NULL,
	"mastery_element" text NOT NULL,
	"mastery_awarded" integer NOT NULL,
	"badge_key" text NOT NULL,
	"completion_hash" text NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quest_completions_exp_awarded_non_negative" CHECK ("quest_completions"."exp_awarded" >= 0),
	CONSTRAINT "quest_completions_mastery_awarded_non_negative" CHECK ("quest_completions"."mastery_awarded" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX "quest_completions_wallet_quest_unique" ON "quest_completions" USING btree ("wallet_address", "quest_id");
--> statement-breakpoint
CREATE INDEX "quest_completions_wallet_address_idx" ON "quest_completions" USING btree ("wallet_address");
--> statement-breakpoint
CREATE INDEX "quest_completions_completed_at_idx" ON "quest_completions" USING btree ("completed_at");
