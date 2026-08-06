export const DATABASE_SCHEMA_VERSION = "contribution-review-database-v1" as const;

export const REQUIRED_DATABASE_TABLES = [
  "wallet_nonces",
  "wallet_sessions",
  "security_cases",
  "case_reviews",
  "merit_ledger",
  "bestiary_name_reservations",
  "bestiary_entries",
] as const;

export const REQUIRED_UNIQUE_INDEXES = [
  "wallet_nonces_nonce_hash_unique",
  "wallet_sessions_session_hash_unique",
  "security_cases_case_id_unique",
  "security_cases_case_hash_unique",
  "bestiary_name_reservations_normalized_name_unique",
  "bestiary_entries_case_id_unique",
  "bestiary_entries_normalized_name_unique",
  "merit_ledger_idempotency_key_unique",
] as const;

export const QUEST_ONE_BESTIARY_NAME = "噬灵回环兽" as const;
