import { getAddress } from "viem";
import { cookies } from "next/headers";

import { AUTH_COOKIE_NAME } from "@/auth/constants";
import { AuthHttpError } from "@/auth/http";
import { readSession, type AuthenticatedSession } from "@/auth/server";
import { ReviewHttpError } from "@/reviews/http";

export type ReviewerSession = AuthenticatedSession & { reviewerAddress: string };

export async function getAuthenticatedSession(): Promise<AuthenticatedSession | null> {
  const token = (await cookies()).get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    return await readSession(token);
  } catch (error) {
    if (error instanceof AuthHttpError && error.code === "DATABASE_NOT_CONFIGURED") {
      throw new ReviewHttpError("DATABASE_NOT_CONFIGURED");
    }
    if (error instanceof AuthHttpError && error.code === "DATABASE_UNAVAILABLE") {
      throw new ReviewHttpError("DATABASE_UNAVAILABLE");
    }
    throw new ReviewHttpError("AUTH_REQUIRED");
  }
}

function reviewerAllowlist(): Set<string> {
  const raw = process.env.REVIEWER_WALLET_ADDRESSES?.trim() ?? "";
  if (!raw) throw new ReviewHttpError("REVIEWER_CONFIGURATION_INVALID");
  const result = new Set<string>();
  for (const item of raw.split(",")) {
    const value = item.trim();
    if (!value) throw new ReviewHttpError("REVIEWER_CONFIGURATION_INVALID");
    try {
      result.add(getAddress(value).toLowerCase());
    } catch {
      throw new ReviewHttpError("REVIEWER_CONFIGURATION_INVALID");
    }
  }
  return result;
}

export async function requireAuthenticatedSession(): Promise<AuthenticatedSession> {
  const session = await getAuthenticatedSession();
  if (!session) throw new ReviewHttpError("AUTH_REQUIRED");
  return session;
}

export async function requireReviewerSession(): Promise<ReviewerSession> {
  const session = await getAuthenticatedSession();
  if (!session) throw new ReviewHttpError("AUTH_REQUIRED");
  const allowlist = reviewerAllowlist();
  const reviewerAddress = session.walletAddress.toLowerCase();
  if (!allowlist.has(reviewerAddress)) throw new ReviewHttpError("REVIEWER_REQUIRED");
  return { ...session, reviewerAddress };
}
