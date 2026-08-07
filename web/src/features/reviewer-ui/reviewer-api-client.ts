import {
  REVIEW_STATUSES,
  type ReviewBestiaryDraft,
  type ReviewCaseDetail,
  type ReviewCaseSummary,
  type ReviewDecision,
  type ReviewDecisionPayload,
  type ReviewDecisionResult,
  type ReviewerAnalysis,
  type ReviewerCandidateBestiarySuggestion,
  type ReviewerCandidateAnalysis,
  type ReviewQuestDraft,
  type ReviewStatus,
  type StoredReview,
} from "./reviewer-types";
import {
  isGuardianConfidenceLabel,
  isGuardianConfidenceScore,
  isGuardianFindingSeverity,
  normalizeGuardianSuggestedConfidence,
} from "@/features/guardian-llm/confidence";
import {
  isCultivationElement,
  isCultivationRealm,
} from "@/features/guardian-security/cultivation-labels";

export type ReviewerErrorCode =
  | "AUTH_REQUIRED"
  | "REVIEWER_REQUIRED"
  | "CASE_NOT_FOUND"
  | "CASE_STATE_CONFLICT"
  | "CANDIDATE_REQUIRES_VERIFICATION"
  | "REVIEW_ALREADY_APPLIED"
  | "BESTIARY_NAME_UNAVAILABLE"
  | "INVALID_REVIEW_SCORE"
  | "DATABASE_NOT_CONFIGURED"
  | "DATABASE_UNAVAILABLE"
  | "INVALID_RESPONSE"
  | "NETWORK_ERROR";

const ERROR_MESSAGES: Record<ReviewerErrorCode, string> = {
  AUTH_REQUIRED: "请先签名入世，再进入守阁人审核台。",
  REVIEWER_REQUIRED: "此处为守阁人审核台，当前修仙身份没有审核权限。",
  CASE_NOT_FOUND: "未找到该案例，可能已被移除。",
  CASE_STATE_CONFLICT: "案例状态已改变，请重新加载后再审核。",
  CANDIDATE_REQUIRES_VERIFICATION: "需先完成人工验证与正式分类，当前候选草案暂不可发布。",
  REVIEW_ALREADY_APPLIED: "该审核决定已经处理，请重新加载卷宗。",
  BESTIARY_NAME_UNAVAILABLE: "拟定异兽名称已被占用，请返回卷宗核对名称状态。",
  INVALID_REVIEW_SCORE: "审核评分超出允许范围，请检查五维评分。",
  DATABASE_NOT_CONFIGURED: "审核服务尚未完成配置。",
  DATABASE_UNAVAILABLE: "审核服务暂不可用，请稍后重试。",
  INVALID_RESPONSE: "审核服务返回了无法识别的数据。",
  NETWORK_ERROR: "无法连接审核服务，请检查网络后重试。",
};

export class ReviewerApiError extends Error {
  readonly code: ReviewerErrorCode;
  readonly status: number | null;

  constructor(code: ReviewerErrorCode, status: number | null = null) {
    super(ERROR_MESSAGES[code]);
    this.name = "ReviewerApiError";
    this.code = code;
    this.status = status;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringArray(value: unknown): readonly string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string")
    ? value
    : [];
}

function recordAt(value: unknown, key: string): Record<string, unknown> | null {
  return isRecord(value) && isRecord(value[key]) ? value[key] : null;
}

function statusValue(value: unknown): ReviewStatus | null {
  return typeof value === "string" && REVIEW_STATUSES.includes(value as ReviewStatus)
    ? value as ReviewStatus
    : null;
}

function decisionValue(value: unknown): ReviewDecision | null {
  return value === "approved" || value === "changes_requested" || value === "rejected"
    ? value
    : null;
}

function parseSummary(value: unknown): ReviewCaseSummary | null {
  if (!isRecord(value)) return null;
  const caseId = nonEmptyString(value.caseId);
  const caseHash = nonEmptyString(value.caseHash);
  const caseName = nonEmptyString(value.caseName);
  const contributorAddress = nonEmptyString(value.contributorAddress);
  const status = statusValue(value.status);
  const createdAt = nonEmptyString(value.createdAt);
  const updatedAt = nonEmptyString(value.updatedAt) ?? createdAt;
  const severity = recordAt(value, "severity");
  const confidence = recordAt(value, "confidence");
  if (
    !caseId || !caseHash || !caseName || !contributorAddress || !status ||
    !createdAt || !updatedAt || !severity || !confidence
  ) return null;

  return {
    caseId,
    caseHash,
    caseName,
    contributorAddress,
    formalType: stringValue(value.formalType),
    primaryElement: stringValue(value.primaryElement),
    secondaryElements: stringArray(value.secondaryElements),
    severity: {
      label: stringValue(severity.label),
      score: numberValue(severity.score),
    },
    confidence: {
      label: stringValue(confidence.label),
      score: numberValue(confidence.score),
    },
    proposedBestiaryName: stringValue(value.proposedBestiaryName),
    status,
    createdAt,
    updatedAt,
  };
}

function parseStatements(value: unknown): readonly { text: string; provenance: string }[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!isRecord(entry)) return [];
    const text = nonEmptyString(entry.text);
    const provenance = nonEmptyString(entry.provenance);
    return text && provenance ? [{ text, provenance }] : [];
  });
}

function parseSignals(value: unknown): ReviewerAnalysis["signals"] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!isRecord(entry)) return [];
    const id = nonEmptyString(entry.id);
    const strength = nonEmptyString(entry.strength);
    const source = nonEmptyString(entry.source);
    const evidenceType = nonEmptyString(entry.evidenceType);
    const explanation = nonEmptyString(entry.explanation);
    if (!id || typeof entry.matched !== "boolean" || !strength || !source || !evidenceType || !explanation) {
      return [];
    }
    return [{ id, matched: entry.matched, strength, source, evidenceType, explanation }];
  });
}

function parseBestiaryDraft(value: unknown): ReviewBestiaryDraft | null {
  if (!isRecord(value)) return null;
  const name = nonEmptyString(value.name);
  const formalType = nonEmptyString(value.formalType);
  const primaryElement = nonEmptyString(value.primaryElement);
  const realm = nonEmptyString(value.realm);
  const severity = nonEmptyString(value.severity);
  const confidence = nonEmptyString(value.confidence);
  const summary = nonEmptyString(value.summary);
  const impact = nonEmptyString(value.impact);
  if (!name || !formalType || !primaryElement || !realm || !severity || !confidence || !impact) {
    return null;
  }
  const publicText = [
    summary,
    impact,
    ...stringArray(value.attackPattern),
    ...stringArray(value.prerequisites),
    ...stringArray(value.mitigations),
    ...stringArray(value.knownLimitations),
  ].filter((entry): entry is string => typeof entry === "string");
  return {
    name,
    formalType,
    primaryElement,
    secondaryElements: stringArray(value.secondaryElements),
    realm,
    severity,
    confidence,
    summary: nonEmptyString(value.summary),
    legacyEnglish: !publicText.some((entry) => /[\u3400-\u9fff]/u.test(entry)),
    attackPattern: stringArray(value.attackPattern),
    prerequisites: stringArray(value.prerequisites),
    impact,
    mitigations: stringArray(value.mitigations),
    knownLimitations: stringArray(value.knownLimitations),
  };
}

function parseQuestDraft(value: unknown): ReviewQuestDraft | null {
  if (!isRecord(value)) return null;
  const title = nonEmptyString(value.title);
  const scenario = nonEmptyString(value.scenario);
  const classificationChallenge = nonEmptyString(value.classificationChallenge);
  if (!title || !scenario || !classificationChallenge) return null;
  return {
    title,
    learningObjectives: stringArray(value.learningObjectives),
    scenario,
    dangerousCodeFocus: stringArray(value.dangerousCodeFocus),
    attackReplaySteps: stringArray(value.attackReplaySteps),
    classificationChallenge,
    repairSequence: stringArray(value.repairSequence),
    verificationChecklist: stringArray(value.verificationChecklist),
    knownLimitations: stringArray(value.knownLimitations),
  };
}

function parseAnalysis(value: unknown): ReviewerAnalysis | null {
  if (isRecord(value) && value.schemaVersion === "guardian-signed-contribution-v1") {
    const signedDraft = recordAt(value, "signedDraft");
    const claims = recordAt(signedDraft, "claims");
    const draft = recordAt(claims, "draft");
    value = draft?.analysis;
  }
  if (!isRecord(value)) return null;
  const analysis = recordAt(value, "analysis");
  const classification = recordAt(value, "classification");
  const elements = recordAt(classification, "elements");
  const realm = recordAt(classification, "realm");
  const severity = recordAt(value, "severity");
  const confidence = recordAt(value, "confidence");
  if (!analysis || !elements || !realm || !severity || !confidence) return null;

  return {
    formalType: nonEmptyString(analysis.formalType) ?? "未记录",
    rootCause: nonEmptyString(analysis.rootCause) ?? "未记录",
    affectedFunctions: stringArray(analysis.affectedFunctions),
    prerequisites: stringArray(analysis.prerequisites),
    attackPath: stringArray(analysis.attackPath),
    impact: nonEmptyString(analysis.impact) ?? "未记录",
    mitigations: stringArray(analysis.mitigations),
    limitations: parseStatements(analysis.limitations),
    signals: parseSignals(value.signals),
    primaryElement: nonEmptyString(elements.primaryElement) ?? "未记录",
    primaryElementLabel: nonEmptyString(elements.primaryElementLabel) ?? "未记录",
    secondaryElements: stringArray(elements.secondaryElements),
    realm: nonEmptyString(realm.realm) ?? "未记录",
    realmLabel: nonEmptyString(realm.realmLabel) ?? "未记录",
    severity: {
      level: nonEmptyString(severity.level) ?? "未记录",
      score: numberValue(severity.score),
      maxScore: numberValue(severity.maxScore),
    },
    confidence: {
      label: nonEmptyString(confidence.label) ?? "未记录",
      score: numberValue(confidence.score),
      evidenceLevel: nonEmptyString(confidence.evidenceLevel) ?? "未记录",
    },
    bestiaryDraft: parseBestiaryDraft(value.bestiaryDraft),
    questDraft: parseQuestDraft(value.questDraft),
  };
}

export function parseReviewerCandidateAnalysis(value: unknown): ReviewerCandidateAnalysis | null {
  if (!isRecord(value) || value.schemaVersion !== "guardian-signed-contribution-v1") return null;
  const signedDraft = recordAt(value, "signedDraft");
  const claims = recordAt(signedDraft, "claims");
  const draft = recordAt(claims, "draft");
  const analysis = recordAt(draft, "analysis");
  const enhancement = recordAt(analysis, "llmEnhancement");
  const selectedBestiaryName = nonEmptyString(draft?.selectedBestiaryName);
  const publicSummary = nonEmptyString(enhancement?.publicSummary);
  if (
    analysis?.schemaVersion !== "guardian-security-candidate-analysis-v1" ||
    !selectedBestiaryName ||
    !publicSummary ||
    !Array.isArray(enhancement?.candidateFindings)
  ) return null;

  const findings = enhancement.candidateFindings.map((value): ReviewerCandidateAnalysis["findings"][number] | null => {
    if (!isRecord(value) || value.verification !== "llm_candidate") return null;
    const confidence = recordAt(value, "suggestedConfidence");
    const candidateId = nonEmptyString(value.candidateId);
    const category = nonEmptyString(value.category);
    const title = nonEmptyString(value.title);
    const severity = nonEmptyString(value.suggestedSeverity);
    const confidenceLabel = nonEmptyString(confidence?.label);
    const confidenceScore = numberValue(confidence?.score);
    const explanation = nonEmptyString(value.explanation);
    if (
      !candidateId ||
      !category ||
      !title ||
      !isGuardianFindingSeverity(severity) ||
      !isGuardianConfidenceLabel(confidenceLabel) ||
      confidenceScore === null ||
      !isGuardianConfidenceScore(confidenceScore) ||
      !explanation
    ) return null;
    const evidence = Array.isArray(value.evidence) ? value.evidence.map((entry) => {
      if (!isRecord(entry)) return null;
      const source = nonEmptyString(entry.source);
      const description = nonEmptyString(entry.description);
      return source && description
        ? { source, description, locations: stringArray(entry.locations) }
        : null;
    }) : [];
    if (evidence.some((entry) => entry === null)) return null;
    return {
      candidateId,
      category,
      title,
      verification: "llm_candidate",
      suggestedSeverity: severity,
      suggestedConfidence: normalizeGuardianSuggestedConfidence({
        label: confidenceLabel,
        score: confidenceScore,
      }),
      explanation,
      attackPath: stringArray(value.attackPath),
      evidence: evidence as readonly { source: string; description: string; locations: readonly string[] }[],
      suggestedFix: stringArray(value.suggestedFix),
      limitations: stringArray(value.limitations),
    };
  });
  if (findings.length === 0 || findings.some((entry) => entry === null)) return null;
  const suggestion = Object.hasOwn(enhancement, "candidateBestiarySuggestion")
    ? parseReviewerCandidateBestiarySuggestion(
        enhancement.candidateBestiarySuggestion,
        findings.length,
      )
    : undefined;
  if (Object.hasOwn(enhancement, "candidateBestiarySuggestion") && !suggestion) return null;
  return {
    publicSummary,
    selectedBestiaryName,
    findings: findings as ReviewerCandidateAnalysis["findings"],
    ...(suggestion ? { candidateBestiarySuggestion: suggestion } : {}),
  };
}

function parseReviewerCandidateBestiarySuggestion(
  value: unknown,
  candidateCount: number,
): ReviewerCandidateBestiarySuggestion | null {
  if (!isRecord(value)) return null;
  const keys = [
    "candidateFindingIndex",
    "suggestedPrimaryElement",
    "suggestedSecondaryElements",
    "suggestedCultivationRealm",
    "lore",
    "behavior",
    "attackTechnique",
    "countermeasure",
    "cultivationLesson",
  ];
  if (Object.keys(value).length !== keys.length || !keys.every((key) => Object.hasOwn(value, key))) return null;
  const primary = value.suggestedPrimaryElement;
  const candidateFindingIndex = value.candidateFindingIndex;
  const rawSecondary = value.suggestedSecondaryElements;
  if (
    typeof candidateFindingIndex !== "number" ||
    !Number.isInteger(candidateFindingIndex) ||
    candidateFindingIndex < 0 ||
    candidateFindingIndex >= candidateCount ||
    !isCultivationElement(primary) ||
    !Array.isArray(rawSecondary) ||
    rawSecondary.length > 4 ||
    !rawSecondary.every(isCultivationElement) ||
    new Set(rawSecondary).size !== rawSecondary.length ||
    rawSecondary.includes(primary) ||
    !isCultivationRealm(value.suggestedCultivationRealm) ||
    !Array.isArray(value.behavior) ||
    value.behavior.length === 0
  ) return null;
  const secondary = rawSecondary as readonly typeof primary[];
  const behavior = stringArray(value.behavior);
  const prose = [
    value.lore,
    value.attackTechnique,
    value.countermeasure,
    value.cultivationLesson,
    ...behavior,
  ];
  if (!prose.every((item) => typeof item === "string" && item.trim() === item && /\p{Script=Han}/u.test(item))) return null;
  return {
    candidateFindingIndex,
    suggestedPrimaryElement: primary,
    suggestedSecondaryElements: secondary,
    suggestedCultivationRealm: value.suggestedCultivationRealm,
    lore: value.lore as string,
    behavior,
    attackTechnique: value.attackTechnique as string,
    countermeasure: value.countermeasure as string,
    cultivationLesson: value.cultivationLesson as string,
  };
}

function parseStoredReview(value: unknown): StoredReview | null {
  if (!isRecord(value)) return null;
  const reviewId = nonEmptyString(value.reviewId);
  const reviewerAddress = nonEmptyString(value.reviewerAddress);
  const decision = decisionValue(value.decision);
  const scores = recordAt(value, "scores");
  const createdAt = nonEmptyString(value.createdAt);
  if (!reviewId || !reviewerAddress || !decision || !scores || !createdAt) return null;
  const evidenceQuality = numberValue(scores.evidenceQuality);
  const reproducibility = numberValue(scores.reproducibility);
  const technicalAccuracy = numberValue(scores.technicalAccuracy);
  const remediationQuality = numberValue(scores.remediationQuality);
  const contributionValue = numberValue(scores.contributionValue);
  const total = numberValue(scores.total);
  if ([evidenceQuality, reproducibility, technicalAccuracy, remediationQuality, contributionValue, total].some((entry) => entry === null)) {
    return null;
  }
  return {
    reviewId,
    reviewerAddress,
    decision,
    reviewSummary: stringValue(value.reviewSummary) ?? "",
    reviewNotes: stringValue(value.reviewNotes) ?? "",
    finalBestiaryName: stringValue(value.finalBestiaryName),
    finalQuestTitle: stringValue(value.finalQuestTitle),
    scores: {
      evidenceQuality: evidenceQuality as number,
      reproducibility: reproducibility as number,
      technicalAccuracy: technicalAccuracy as number,
      remediationQuality: remediationQuality as number,
      contributionValue: contributionValue as number,
      total: total as number,
    },
    createdAt,
  };
}

function parseDetail(value: unknown): ReviewCaseDetail | null {
  const summary = parseSummary(value);
  if (!summary || !isRecord(value)) return null;
  const reviewsValue = Array.isArray(value.reviews) ? value.reviews.map(parseStoredReview) : [];
  if (reviewsValue.some((entry) => entry === null)) return null;
  const merit = recordAt(value, "merit");
  const totalMerit = numberValue(merit?.totalMerit);
  if (totalMerit === null) return null;
  const bestiaryValue = value.bestiary;
  let bestiary: ReviewCaseDetail["bestiary"] = null;
  if (bestiaryValue !== null) {
    if (!isRecord(bestiaryValue)) return null;
    const displayName = nonEmptyString(bestiaryValue.displayName);
    const publicationStatus = nonEmptyString(bestiaryValue.publicationStatus);
    const questConversionStatus = nonEmptyString(bestiaryValue.questConversionStatus);
    if (!displayName || !publicationStatus || !questConversionStatus) return null;
    bestiary = { displayName, publicationStatus, questConversionStatus };
  }
  return {
    ...summary,
    vulnerableSource: stringValue(value.vulnerableSource) ?? "",
    attackSource: stringValue(value.attackSource) ?? "",
    fixedSource: stringValue(value.fixedSource) ?? "",
    analysis: parseAnalysis(value.analysisJson),
    candidateAnalysis: parseReviewerCandidateAnalysis(value.analysisJson),
    reviews: reviewsValue as readonly StoredReview[],
    merit: { totalMerit },
    bestiary,
  };
}

async function responseBody(response: Response): Promise<Record<string, unknown>> {
  const value: unknown = await response.json().catch(() => null);
  if (!isRecord(value)) throw new ReviewerApiError("INVALID_RESPONSE", response.status);
  return value;
}

function mappedError(value: unknown, status: number): ReviewerApiError {
  const error = recordAt(value, "error");
  const code = stringValue(error?.code);
  if (code && Object.hasOwn(ERROR_MESSAGES, code)) {
    return new ReviewerApiError(code as ReviewerErrorCode, status);
  }
  if (status === 401) return new ReviewerApiError("AUTH_REQUIRED", status);
  if (status === 403) return new ReviewerApiError("REVIEWER_REQUIRED", status);
  if (status === 404) return new ReviewerApiError("CASE_NOT_FOUND", status);
  if (status === 409) return new ReviewerApiError("CASE_STATE_CONFLICT", status);
  if (status === 503) return new ReviewerApiError("DATABASE_UNAVAILABLE", status);
  return new ReviewerApiError("INVALID_RESPONSE", status);
}

async function reviewerFetch(url: string, init?: RequestInit): Promise<Record<string, unknown>> {
  let response: Response;
  try {
    const headers = new Headers(init?.headers);
    headers.set("Accept", "application/json");
    if (init?.body) headers.set("Content-Type", "application/json");
    response = await fetch(url, {
      ...init,
      credentials: "include",
      cache: "no-store",
      headers,
    });
  } catch {
    throw new ReviewerApiError("NETWORK_ERROR");
  }
  const body = await responseBody(response);
  if (!response.ok || body.ok !== true) throw mappedError(body, response.status);
  return body;
}

export async function fetchReviewCases(status: ReviewStatus): Promise<readonly ReviewCaseSummary[]> {
  const body = await reviewerFetch(`/api/reviews/cases?status=${encodeURIComponent(status)}`);
  if (!Array.isArray(body.cases)) throw new ReviewerApiError("INVALID_RESPONSE");
  const cases = body.cases.map(parseSummary);
  if (cases.some((entry) => entry === null)) throw new ReviewerApiError("INVALID_RESPONSE");
  return cases as readonly ReviewCaseSummary[];
}

export async function fetchAllReviewCases(): Promise<readonly ReviewCaseSummary[]> {
  const groups = await Promise.all(REVIEW_STATUSES.map(fetchReviewCases));
  return groups.flat();
}

export async function fetchReviewCase(caseId: string): Promise<ReviewCaseDetail> {
  const body = await reviewerFetch(`/api/reviews/cases/${encodeURIComponent(caseId)}`);
  const detail = parseDetail(body.case);
  if (!detail) throw new ReviewerApiError("INVALID_RESPONSE");
  return detail;
}

export async function submitReviewDecision(
  caseId: string,
  payload: ReviewDecisionPayload,
): Promise<ReviewDecisionResult> {
  const body = await reviewerFetch(
    `/api/reviews/cases/${encodeURIComponent(caseId)}/decision`,
    { method: "POST", body: JSON.stringify(payload) },
  );
  const status = statusValue(body.status);
  const returnedCaseId = nonEmptyString(body.caseId);
  const reviewId = nonEmptyString(body.reviewId);
  const meritAmount = numberValue(body.meritAmount);
  const totalScore = numberValue(body.totalScore);
  if (
    !status || !returnedCaseId || !reviewId || meritAmount === null ||
    totalScore === null || typeof body.bestiaryCreated !== "boolean"
  ) throw new ReviewerApiError("INVALID_RESPONSE");
  return {
    caseId: returnedCaseId,
    status,
    reviewId,
    meritAmount,
    bestiaryCreated: body.bestiaryCreated,
    totalScore,
  };
}
