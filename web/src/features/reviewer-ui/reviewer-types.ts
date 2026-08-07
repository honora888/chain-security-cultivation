export const REVIEW_STATUSES = [
  "pending_review",
  "changes_requested",
  "approved",
  "rejected",
] as const;

export type ReviewStatus = (typeof REVIEW_STATUSES)[number];
export type ReviewFilter = ReviewStatus | "all";
export type ReviewDecision = "approved" | "changes_requested" | "rejected";

export type ReviewCaseSummary = {
  caseId: string;
  caseHash: string;
  caseName: string;
  contributorAddress: string;
  formalType: string | null;
  primaryElement: string | null;
  secondaryElements: readonly string[];
  severity: { label: string | null; score: number | null };
  confidence: { label: string | null; score: number | null };
  proposedBestiaryName: string | null;
  status: ReviewStatus;
  createdAt: string;
  updatedAt: string;
};

export type ReviewSignal = {
  id: string;
  matched: boolean;
  strength: string;
  source: string;
  evidenceType: string;
  explanation: string;
};

export type ReviewStatement = {
  text: string;
  provenance: string;
};

export type ReviewBestiaryDraft = {
  name: string;
  formalType: string;
  primaryElement: string;
  secondaryElements: readonly string[];
  realm: string;
  severity: string;
  confidence: string;
  summary: string | null;
  legacyEnglish: boolean;
  attackPattern: readonly string[];
  prerequisites: readonly string[];
  impact: string;
  mitigations: readonly string[];
  knownLimitations: readonly string[];
};

export type ReviewQuestDraft = {
  title: string;
  learningObjectives: readonly string[];
  scenario: string;
  dangerousCodeFocus: readonly string[];
  attackReplaySteps: readonly string[];
  classificationChallenge: string;
  repairSequence: readonly string[];
  verificationChecklist: readonly string[];
  knownLimitations: readonly string[];
};

export type ReviewerAnalysis = {
  formalType: string;
  rootCause: string;
  affectedFunctions: readonly string[];
  prerequisites: readonly string[];
  attackPath: readonly string[];
  impact: string;
  mitigations: readonly string[];
  limitations: readonly ReviewStatement[];
  signals: readonly ReviewSignal[];
  primaryElement: string;
  primaryElementLabel: string;
  secondaryElements: readonly string[];
  realm: string;
  realmLabel: string;
  severity: { level: string; score: number | null; maxScore: number | null };
  confidence: { label: string; score: number | null; evidenceLevel: string };
  bestiaryDraft: ReviewBestiaryDraft | null;
  questDraft: ReviewQuestDraft | null;
};

export type ReviewerCandidateFinding = {
  candidateId: string;
  category: string;
  title: string;
  verification: "llm_candidate";
  suggestedSeverity: string;
  suggestedConfidence: { label: string; score: number };
  explanation: string;
  attackPath: readonly string[];
  evidence: readonly { source: string; description: string; locations: readonly string[] }[];
  suggestedFix: readonly string[];
  limitations: readonly string[];
};

export type ReviewerCandidateAnalysis = {
  publicSummary: string;
  selectedBestiaryName: string;
  findings: readonly ReviewerCandidateFinding[];
};

export type StoredReview = {
  reviewId: string;
  reviewerAddress: string;
  decision: ReviewDecision;
  reviewSummary: string;
  reviewNotes: string;
  finalBestiaryName: string | null;
  finalQuestTitle: string | null;
  scores: {
    evidenceQuality: number;
    reproducibility: number;
    technicalAccuracy: number;
    remediationQuality: number;
    contributionValue: number;
    total: number;
  };
  createdAt: string;
};

export type ReviewBestiaryPublication = {
  displayName: string;
  publicationStatus: string;
  questConversionStatus: string;
};

export type ReviewCaseDetail = ReviewCaseSummary & {
  vulnerableSource: string;
  attackSource: string;
  fixedSource: string;
  analysis: ReviewerAnalysis | null;
  candidateAnalysis: ReviewerCandidateAnalysis | null;
  reviews: readonly StoredReview[];
  merit: { totalMerit: number };
  bestiary: ReviewBestiaryPublication | null;
};

export type ReviewDecisionPayload = {
  decision: ReviewDecision;
  evidenceQuality: number;
  reproducibility: number;
  technicalAccuracy: number;
  remediationQuality: number;
  contributionValue: number;
  reviewSummary: string;
  reviewNotes: string;
};

export type ReviewDecisionResult = {
  caseId: string;
  status: ReviewStatus;
  reviewId: string;
  meritAmount: number;
  bestiaryCreated: boolean;
  totalScore: number;
};
