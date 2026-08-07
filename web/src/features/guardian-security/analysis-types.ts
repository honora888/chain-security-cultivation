export type EvidenceProvenance =
  | "frozen-repository-evidence"
  | "human-reviewed"
  | "on-chain-fact"
  | "generated-inference"
  | "user-provided-unverified"
  | "known-limitation";

export type GuardianSecurityErrorCode =
  | "INVALID_CONTENT_TYPE"
  | "INVALID_JSON"
  | "INVALID_BODY"
  | "UNSUPPORTED_CASE"
  | "SOURCE_TOO_LARGE"
  | "UNSUPPORTED_VULNERABILITY"
  | "EVIDENCE_INCOMPLETE"
  | "CHAIN_NOT_CONFIGURED"
  | "CHAIN_ID_MISMATCH"
  | "CHAIN_EVIDENCE_UNAVAILABLE"
  | "CHAIN_EVIDENCE_MISMATCH"
  | "ANALYSIS_FAILED"
  | "INTERNAL_ERROR";

export interface GuardianSecurityFailure {
  ok: false;
  error: {
    code: GuardianSecurityErrorCode;
    message: string;
  };
}

export class GuardianSecurityError extends Error {
  readonly code: GuardianSecurityErrorCode;

  constructor(code: GuardianSecurityErrorCode) {
    super(code);
    this.code = code;
    this.name = "GuardianSecurityError";
  }
}

export interface EvidenceFact<T> {
  value: T;
  provenance: EvidenceProvenance;
  note?: string;
}

export interface QuestOneEvidenceProfile {
  caseId: "quest-1-reentrancy";
  displayName: string;
  sourceCommit: EvidenceFact<string>;
  freezeBaselineCommit: EvidenceFact<string>;
  vulnerabilityType: EvidenceFact<"Classic Reentrancy">;
  affectedFunction: EvidenceFact<"withdraw">;
  vulnerableContract: EvidenceFact<string>;
  attackerContract: EvidenceFact<string>;
  fixedContract: EvidenceFact<string>;
  foundry: EvidenceFact<{
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    vulnerableAttackReproduced: boolean;
    fixedRegressionPassed: boolean;
  }>;
  invariant: EvidenceFact<{
    name: string;
    runs: number;
    calls: number;
    reverts: number;
    passed: boolean;
  }>;
  slither: EvidenceFact<{
    vulnerableDetectors: readonly string[];
    fixedSamePathDetected: boolean;
    guardianTargetHighMedium: number;
  }>;
  humanConclusion: EvidenceFact<string>;
  contentHash: EvidenceFact<string>;
  reportHash: EvidenceFact<string>;
  knownLimitations: readonly EvidenceFact<string>[];
}

export interface GuardianBuiltinRequest {
  mode: "builtin";
  caseId: "quest-1-reentrancy";
}

export interface GuardianSampleInput {
  name: string;
  vulnerableSource: string;
  attackSource?: string;
  fixedSource?: string;
}

export interface GuardianSampleRequest {
  mode: "sample";
  sample: GuardianSampleInput;
}

export type GuardianSecurityRequest =
  | GuardianBuiltinRequest
  | GuardianSampleRequest;

export type SignalStrength = "weak" | "moderate" | "strong";
export type SignalSource =
  | "vulnerableSource"
  | "attackSource"
  | "fixedSource"
  | "frozenEvidence";

export interface ReentrancySignal {
  id: string;
  matched: boolean;
  strength: SignalStrength;
  source: SignalSource;
  evidenceType: EvidenceProvenance;
  explanation: string;
}

export interface MossVerifiedEvidence {
  status: "verified";
  protocol: "guardian";
  query: "guardian.quest";
  sourceCommit: string;
  network: {
    name: "Monad Testnet";
    chainId: 10143;
  };
  contract: { address: string };
  quest: {
    questId: "1";
    contentHash: string;
    metadataURI: string;
    active: boolean;
  };
  expectedContentHash: string;
  contentHashMatches: true;
  verifiedAt: string;
}

export interface MossNotApplicableEvidence {
  status: "not-applicable";
  reason: "User-provided samples are not registered Guardian quests.";
}

export type MossEvidence =
  | MossVerifiedEvidence
  | MossNotApplicableEvidence;

export interface AnalysisStatement {
  text: string;
  provenance: EvidenceProvenance;
}

export interface FormalAnalysis {
  formalType: "Classic Reentrancy";
  category: "Reentrancy";
  rootCause: string;
  affectedFunctions: readonly string[];
  prerequisites: readonly string[];
  attackPath: readonly string[];
  impact: string;
  repeatability: string;
  privilegeRequired: string;
  mitigations: readonly string[];
  evidence: readonly AnalysisStatement[];
  inferences: readonly AnalysisStatement[];
  limitations: readonly AnalysisStatement[];
}

export type ElementName = "Metal" | "Wood" | "Water" | "Fire" | "Earth";

export interface ElementClassification {
  primaryElement: ElementName;
  primaryElementLabel: string;
  secondaryElements: readonly ElementName[];
  elementScores: Record<ElementName, number>;
  rationale: readonly string[];
}

export type RealmName =
  | "Qi Refining"
  | "Foundation Establishment"
  | "Core Formation"
  | "Nascent Soul"
  | "Spirit Transformation"
  | "Mahayana"
  | "Tribulation";

export interface ComplexityFactor {
  id: string;
  matched: boolean;
  points: number;
  explanation: string;
}

export interface RealmClassification {
  realm: RealmName;
  realmLabel: string;
  realmScore: number;
  complexityFactors: readonly ComplexityFactor[];
  rationale: readonly string[];
}

export type SeverityLevel =
  | "Informational"
  | "Low"
  | "Medium"
  | "High"
  | "Critical";

export interface SeverityAssessment {
  level: SeverityLevel;
  score: number;
  maxScore: 12;
  breakdown: {
    impact: number;
    exploitability: number;
    repeatability: number;
    privilegeExposure: number;
  };
  rationale: readonly string[];
}

export type EvidenceLevel =
  | "PATTERN_MATCHED"
  | "ATTACK_STRUCTURE_PRESENT"
  | "FIX_CONTRAST_PRESENT"
  | "POC_VERIFIED"
  | "FIX_VERIFIED"
  | "HUMAN_REVIEWED";

export interface ConfidenceAssessment {
  score: number;
  label: "Low" | "Medium" | "High";
  evidenceLevel: EvidenceLevel;
  supportingFactors: readonly string[];
  missingEvidence: readonly string[];
}

export interface BestiaryDraft {
  name: string;
  formalType: "Classic Reentrancy";
  primaryElement: ElementName;
  secondaryElements: readonly ElementName[];
  realm: RealmName;
  severity: SeverityLevel;
  confidence: ConfidenceAssessment["label"];
  summary: string;
  attackPattern: readonly string[];
  prerequisites: readonly string[];
  impact: string;
  evidenceSummary: readonly string[];
  mitigations: readonly string[];
  knownLimitations: readonly string[];
  reviewStatus: "draft";
}

export interface QuestDraft {
  title: string;
  formalType: "Classic Reentrancy";
  realm: RealmName;
  primaryElement: ElementName;
  learningObjectives: readonly string[];
  scenario: string;
  dangerousCodeFocus: readonly string[];
  attackReplaySteps: readonly string[];
  classificationChallenge: string;
  repairSequence: readonly ["Checks", "Effects", "Interactions"];
  verificationChecklist: readonly string[];
  evidenceReferences: readonly string[];
  knownLimitations: readonly string[];
  rewardDraft: string;
  reviewStatus: "draft";
}

export interface GuardianSecuritySuccess {
  ok: true;
  schemaVersion: "guardian-security-analysis-v1";
  analyzedAt: string;
  agent: {
    mode: "deterministic-rules";
    externalModelConnected: false;
  };
  inputMode: "builtin" | "sample";
  case: {
    caseId: string;
    displayName: string;
    provenance: EvidenceProvenance;
    evidenceProfile?: QuestOneEvidenceProfile;
  };
  mossEvidence: MossEvidence;
  signals: readonly ReentrancySignal[];
  analysis: FormalAnalysis;
  classification: {
    elements: ElementClassification;
    realm: RealmClassification;
  };
  severity: SeverityAssessment;
  confidence: ConfidenceAssessment;
  bestiaryDraft: BestiaryDraft;
  questDraft: QuestDraft;
  review: {
    status: "draft";
    requiresHumanApproval: true;
    publishAllowed: false;
    reasons: readonly string[];
  };
  limitations: readonly string[];
}
