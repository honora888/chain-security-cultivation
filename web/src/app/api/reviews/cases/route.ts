import { ReviewHttpError, reviewErrorResponse, noStoreJson } from "@/reviews/http";
import { listReviewCases } from "@/reviews/server";
import { REVIEW_STATUS_VALUES, type ReviewCaseStatus } from "@/reviews/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const keys = [...url.searchParams.keys()];
    if (keys.some((key) => key !== "status") || url.searchParams.getAll("status").length > 1) {
      throw new ReviewHttpError("INVALID_REQUEST");
    }
    const requested = url.searchParams.get("status") ?? "pending_review";
    if (!REVIEW_STATUS_VALUES.includes(requested as ReviewCaseStatus)) {
      throw new ReviewHttpError("INVALID_REQUEST");
    }
    return noStoreJson(await listReviewCases(requested as ReviewCaseStatus));
  } catch (error) {
    return reviewErrorResponse(error);
  }
}
