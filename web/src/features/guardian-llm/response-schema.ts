import type {
  GuardianFindingSeverity,
  GuardianVulnerabilityCategory,
} from "./contracts";
import {
  CULTIVATION_ELEMENT_VALUES,
  CULTIVATION_REALM_VALUES,
} from "../guardian-security/cultivation-labels";

export const MAX_LLM_CANDIDATE_FINDINGS = 8;
export const MAX_LLM_TITLE_LENGTH = 120;
export const MAX_LLM_EXPLANATION_LENGTH = 4_000;
export const MAX_LLM_PUBLIC_SUMMARY_LENGTH = 4_000;
export const MAX_LLM_BESTIARY_NAME_LENGTH = 80;
export const MAX_LLM_LIST_ITEMS = 16;
export const MAX_LLM_AFFECTED_CODE_ITEMS = 24;
export const MAX_LLM_EVIDENCE_ITEMS = 24;
export const MAX_LLM_TEXT_ITEM_LENGTH = 1_500;
export const MAX_LLM_EVIDENCE_LOCATIONS = 20;
export const MAX_LLM_LOCATION_LENGTH = 300;
export const MAX_LLM_BESTIARY_BEHAVIOR_ITEMS = 8;

export const GUARDIAN_VULNERABILITY_CATEGORIES: readonly GuardianVulnerabilityCategory[] = [
  "reentrancy",
  "access-control",
  "unchecked-external-call",
  "delegatecall",
  "oracle-manipulation",
  "economic-attack",
  "signature-replay",
  "authentication",
  "denial-of-service",
  "accounting",
  "state-logic",
  "initialization",
  "upgradeability",
  "arithmetic",
  "precision-rounding",
  "timestamp-dependence",
  "randomness",
  "frontrunning-mev",
  "other",
];

export const GUARDIAN_FINDING_SEVERITIES: readonly GuardianFindingSeverity[] = [
  "Informational",
  "Low",
  "Medium",
  "High",
  "Critical",
];

export const GUARDIAN_CONFIDENCE_LABELS = ["Low", "Medium", "High"];
export const GUARDIAN_CONFIDENCE_MIN_SCORE = 0;
export const GUARDIAN_CONFIDENCE_MAX_SCORE = 100;
export const GUARDIAN_AFFECTED_CODE_SOURCES = [
  "vulnerableSource",
  "attackSource",
  "fixedSource",
];

const stringArraySchema = {
  type: "array",
  items: { type: "string" },
};

const evidenceSchema = {
  type: "object",
  properties: {
    source: { type: "string" },
    description: { type: "string" },
    locations: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: ["source", "description", "locations"],
};

const affectedCodeSchema = {
  type: "object",
  properties: {
    source: {
      type: "string",
      enum: GUARDIAN_AFFECTED_CODE_SOURCES,
    },
    location: { type: "string" },
    explanation: { type: "string" },
  },
  required: ["source", "location", "explanation"],
};

const candidateFindingSchema = {
  type: "object",
  properties: {
    category: {
      type: "string",
      enum: GUARDIAN_VULNERABILITY_CATEGORIES,
    },
    title: { type: "string" },
    suggestedSeverity: {
      type: "string",
      enum: GUARDIAN_FINDING_SEVERITIES,
    },
    suggestedConfidence: {
      type: "object",
      properties: {
        label: { type: "string", enum: GUARDIAN_CONFIDENCE_LABELS },
        score: {
          type: "number",
          minimum: GUARDIAN_CONFIDENCE_MIN_SCORE,
          maximum: GUARDIAN_CONFIDENCE_MAX_SCORE,
        },
      },
      required: ["label", "score"],
    },
    explanation: { type: "string" },
    attackPath: stringArraySchema,
    affectedCode: {
      type: "array",
      items: affectedCodeSchema,
    },
    evidence: {
      type: "array",
      items: evidenceSchema,
    },
    suggestedFix: stringArraySchema,
    limitations: stringArraySchema,
  },
  required: [
    "category",
    "title",
    "suggestedSeverity",
    "suggestedConfidence",
    "explanation",
    "attackPath",
    "affectedCode",
    "evidence",
    "suggestedFix",
    "limitations",
  ],
};

const candidateBestiarySuggestionSchema = {
  type: "object",
  properties: {
    candidateFindingIndex: { type: "number" },
    suggestedPrimaryElement: {
      type: "string",
      enum: CULTIVATION_ELEMENT_VALUES,
    },
    suggestedSecondaryElements: {
      type: "array",
      items: { type: "string", enum: CULTIVATION_ELEMENT_VALUES },
    },
    suggestedCultivationRealm: {
      type: "string",
      enum: CULTIVATION_REALM_VALUES,
    },
    lore: { type: "string" },
    behavior: { type: "array", items: { type: "string" } },
    attackTechnique: { type: "string" },
    countermeasure: { type: "string" },
    cultivationLesson: { type: "string" },
  },
  required: [
    "candidateFindingIndex",
    "suggestedPrimaryElement",
    "suggestedSecondaryElements",
    "suggestedCultivationRealm",
    "lore",
    "behavior",
    "attackTechnique",
    "countermeasure",
    "cultivationLesson",
  ],
};

/**
 * Gemini structured output schema. Runtime validation in response-parser.ts
 * remains authoritative and independently enforces every size and key bound.
 */
export const GUARDIAN_LLM_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    candidateFindings: {
      type: "array",
      items: candidateFindingSchema,
    },
    candidateBestiarySuggestion: candidateBestiarySuggestionSchema,
    publicSummary: { type: "string" },
    bestiaryNameCandidates: {
    type: "array",
    minItems: 4,
    maxItems: 4,
    items: { type: "string" },
    },
  },
  required: [
    "candidateFindings",
    "publicSummary",
    "bestiaryNameCandidates",
  ],
};
