import { NextResponse } from "next/server";

import { AuthHttpError } from "@/auth/http";
import { DatabaseConfigurationError } from "@/db/client";
import {
  REVIEW_BODY_MAX_BYTES,
  REVIEW_NOTES_MAX_CHARS,
  REVIEW_SCHEMA_VERSION,
  REVIEW_SCORE_LIMITS,
  REVIEW_SUMMARY_MAX_CHARS,
  type ReviewDecision,
} from "@/reviews/constants";

export type ReviewErrorCode =
  | "INVALID_REQUEST"
  | "INVALID_CASE_ID"
  | "AUTH_REQUIRED"
  | "REVIEWER_REQUIRED"
  | "ORIGIN_NOT_ALLOWED"
  | "CASE_NOT_FOUND"
  | "CASE_STATE_CONFLICT"
  | "CANDIDATE_REQUIRES_VERIFICATION"
  | "REVIEW_ALREADY_APPLIED"
  | "BESTIARY_NAME_UNAVAILABLE"
  | "INVALID_REVIEW_SCORE"
  | "PAYLOAD_TOO_LARGE"
  | "REVIEWER_CONFIGURATION_INVALID"
  | "DATABASE_NOT_CONFIGURED"
  | "DATABASE_UNAVAILABLE"
  | "BESTIARY_ENTRY_NOT_FOUND";

const REVIEW_MESSAGES: Record<ReviewErrorCode, string> = {
  INVALID_REQUEST: "审核请求格式不正确。",
  INVALID_CASE_ID: "案例编号格式不正确。",
  AUTH_REQUIRED: "请先完成钱包身份认证。",
  REVIEWER_REQUIRED: "当前钱包没有审核员权限。",
  ORIGIN_NOT_ALLOWED: "请求来源未被允许。",
  CASE_NOT_FOUND: "未找到该安全案例。",
  CASE_STATE_CONFLICT: "案例当前状态不允许执行该审核决定。",
  CANDIDATE_REQUIRES_VERIFICATION: "需先完成人工验证与正式分类，当前候选草案暂不可发布。",
  REVIEW_ALREADY_APPLIED: "该审核决定已经处理。",
  BESTIARY_NAME_UNAVAILABLE: "该异兽名称已被占用。",
  INVALID_REVIEW_SCORE: "审核评分不符合允许范围。",
  PAYLOAD_TOO_LARGE: "审核请求超过允许大小。",
  REVIEWER_CONFIGURATION_INVALID: "审核员权限尚未正确配置。",
  DATABASE_NOT_CONFIGURED: "审核服务尚未完成数据库配置。",
  DATABASE_UNAVAILABLE: "审核服务暂时不可用，请稍后重试。",
  BESTIARY_ENTRY_NOT_FOUND: "未找到已公开的异兽志条目。",
};

const REVIEW_STATUSES: Record<ReviewErrorCode, number> = {
  INVALID_REQUEST: 400,
  INVALID_CASE_ID: 400,
  AUTH_REQUIRED: 401,
  REVIEWER_REQUIRED: 403,
  ORIGIN_NOT_ALLOWED: 403,
  CASE_NOT_FOUND: 404,
  CASE_STATE_CONFLICT: 409,
  CANDIDATE_REQUIRES_VERIFICATION: 409,
  REVIEW_ALREADY_APPLIED: 409,
  BESTIARY_NAME_UNAVAILABLE: 409,
  INVALID_REVIEW_SCORE: 422,
  PAYLOAD_TOO_LARGE: 413,
  REVIEWER_CONFIGURATION_INVALID: 503,
  DATABASE_NOT_CONFIGURED: 503,
  DATABASE_UNAVAILABLE: 503,
  BESTIARY_ENTRY_NOT_FOUND: 404,
};

export class ReviewHttpError extends Error {
  readonly code: ReviewErrorCode;
  readonly status: number;

  constructor(code: ReviewErrorCode) {
    super(REVIEW_MESSAGES[code]);
    this.name = "ReviewHttpError";
    this.code = code;
    this.status = REVIEW_STATUSES[code];
  }
}

export function noStoreJson<T>(body: T, status = 200): NextResponse<T> {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export function reviewErrorResponse(error: unknown): NextResponse {
  const mapped = mapReviewError(error);
  return noStoreJson(
    {
      ok: false,
      schemaVersion: REVIEW_SCHEMA_VERSION,
      error: { code: mapped.code, message: mapped.message },
    },
    mapped.status,
  );
}

export function mapReviewError(error: unknown): ReviewHttpError {
  if (error instanceof ReviewHttpError) return error;
  if (error instanceof AuthHttpError) {
    if (error.code === "DATABASE_NOT_CONFIGURED") {
      return new ReviewHttpError("DATABASE_NOT_CONFIGURED");
    }
    if (error.code === "DATABASE_UNAVAILABLE") {
      return new ReviewHttpError("DATABASE_UNAVAILABLE");
    }
    return new ReviewHttpError("AUTH_REQUIRED");
  }
  if (error instanceof DatabaseConfigurationError) {
    return new ReviewHttpError("DATABASE_NOT_CONFIGURED");
  }
  return new ReviewHttpError("DATABASE_UNAVAILABLE");
}

export async function readReviewJsonBody(request: Request): Promise<unknown> {
  const contentType = request.headers.get("content-type")?.trim() ?? "";
  if (!/^application\/json(?:\s*;.*)?$/i.test(contentType)) {
    throw new ReviewHttpError("INVALID_REQUEST");
  }
  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    const length = Number(contentLength);
    if (!Number.isSafeInteger(length) || length < 0) {
      throw new ReviewHttpError("INVALID_REQUEST");
    }
    if (length > REVIEW_BODY_MAX_BYTES) {
      throw new ReviewHttpError("PAYLOAD_TOO_LARGE");
    }
  }
  const text = await request.text();
  if (text.length === 0) throw new ReviewHttpError("INVALID_REQUEST");
  if (new TextEncoder().encode(text).byteLength > REVIEW_BODY_MAX_BYTES) {
    throw new ReviewHttpError("PAYLOAD_TOO_LARGE");
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ReviewHttpError("INVALID_REQUEST");
  }
}

function exactObject(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ReviewHttpError("INVALID_REQUEST");
  }
  const object = value as Record<string, unknown>;
  const actual = Object.keys(object).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new ReviewHttpError("INVALID_REQUEST");
  }
  return object;
}

function requiredString(value: unknown, allowEmpty = false): string {
  if (typeof value !== "string" || (!allowEmpty && value.trim().length === 0) || value.includes("\u0000")) {
    throw new ReviewHttpError("INVALID_REQUEST");
  }
  return value;
}

function score(value: unknown, maximum: number): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0 || (value as number) > maximum) {
    throw new ReviewHttpError("INVALID_REVIEW_SCORE");
  }
  return value as number;
}

export type ReviewDecisionInput = {
  decision: ReviewDecision;
  evidenceQuality: number;
  reproducibility: number;
  technicalAccuracy: number;
  remediationQuality: number;
  contributionValue: number;
  reviewSummary: string;
  reviewNotes: string;
};

export function parseReviewDecision(value: unknown): ReviewDecisionInput {
  const object = exactObject(value, [
    "decision",
    "evidenceQuality",
    "reproducibility",
    "technicalAccuracy",
    "remediationQuality",
    "contributionValue",
    "reviewSummary",
    "reviewNotes",
  ]);
  const decision = object.decision;
  if (decision !== "approved" && decision !== "changes_requested" && decision !== "rejected") {
    throw new ReviewHttpError("INVALID_REQUEST");
  }
  const reviewSummary = requiredString(object.reviewSummary).trim();
  const reviewNotes = requiredString(object.reviewNotes, true);
  if (Array.from(reviewSummary).length > REVIEW_SUMMARY_MAX_CHARS) {
    throw new ReviewHttpError("INVALID_REQUEST");
  }
  if (Array.from(reviewNotes).length > REVIEW_NOTES_MAX_CHARS) {
    throw new ReviewHttpError("INVALID_REQUEST");
  }

  return {
    decision,
    evidenceQuality: score(object.evidenceQuality, REVIEW_SCORE_LIMITS.evidenceQuality),
    reproducibility: score(object.reproducibility, REVIEW_SCORE_LIMITS.reproducibility),
    technicalAccuracy: score(object.technicalAccuracy, REVIEW_SCORE_LIMITS.technicalAccuracy),
    remediationQuality: score(object.remediationQuality, REVIEW_SCORE_LIMITS.remediationQuality),
    contributionValue: score(object.contributionValue, REVIEW_SCORE_LIMITS.contributionValue),
    reviewSummary,
    reviewNotes,
  };
}

export function assertReviewOrigin(request: Request): string {
  const requestOrigin = new URL(request.url).origin;
  const origin = request.headers.get("origin");
  if (!origin || origin !== requestOrigin) {
    throw new ReviewHttpError("ORIGIN_NOT_ALLOWED");
  }
  return requestOrigin;
}
