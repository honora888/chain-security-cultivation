export const BESTIARY_SEVERITIES = [
  "Critical",
  "High",
  "Medium",
  "Low",
  "Informational",
] as const;

export type BestiarySeverity = (typeof BESTIARY_SEVERITIES)[number];
export type BestiarySeverityFilter = "All" | BestiarySeverity;

export type BestiaryQuestConversionStatus =
  | "not_started"
  | "candidate"
  | "ready"
  | "registered_on_monad";

export type BestiarySourceDisclosure =
  | "summary_only"
  | "reviewed_excerpt"
  | "full_source";

export interface PublishedBestiaryEntry {
  caseId: string;
  displayName: string;
  formalType: string;
  primaryElement: string | null;
  secondaryElements: readonly string[];
  realm: string;
  severity: BestiarySeverity;
  confidence: string;
  contributorAddress: string;
  approvedAt: string | null;
  publicationStatus: "published";
  questConversionStatus: BestiaryQuestConversionStatus;
  summary: string;
  attackPattern: readonly string[];
  prerequisites: readonly string[];
  impact: string;
  mitigations: readonly string[];
  knownLimitations: readonly string[];
  sourceDisclosure: BestiarySourceDisclosure;
}

export interface UnifiedBestiaryEntry {
  entryId: string;
  identityKind: "published-case" | "canonical-quest";
  caseId: string | null;
  displayName: string;
  formalType: string;
  primaryElement: string | null;
  secondaryElements: readonly string[];
  realm: string;
  realmLabel: string | null;
  severity: BestiarySeverity;
  confidence: string;
  contributorAddress: string | null;
  reviewerAddress: string | null;
  approvedAt: string | null;
  publicationStatus: "published";
  questConversionStatus: BestiaryQuestConversionStatus;
  summary: string;
  attackPattern: readonly string[];
  prerequisites: readonly string[];
  impact: string;
  mitigations: readonly string[];
  knownLimitations: readonly string[];
  sourceDisclosure: BestiarySourceDisclosure;
  questNumber: number | null;
  questHref: string | null;
}
