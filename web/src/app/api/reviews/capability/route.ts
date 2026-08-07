import { getAuthenticatedSession, requireReviewerSession } from "@/reviews/authorization";
import { noStoreJson, reviewErrorResponse, ReviewHttpError } from "@/reviews/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getAuthenticatedSession();
    if (!session) {
      return noStoreJson({
        ok: true,
        schemaVersion: "contribution-review-v1",
        authenticated: false,
        reviewer: false,
      });
    }

    try {
      await requireReviewerSession();
      return noStoreJson({
        ok: true,
        schemaVersion: "contribution-review-v1",
        authenticated: true,
        reviewer: true,
      });
    } catch (error) {
      if (error instanceof ReviewHttpError && error.code === "REVIEWER_REQUIRED") {
        return noStoreJson({
          ok: true,
          schemaVersion: "contribution-review-v1",
          authenticated: true,
          reviewer: false,
        });
      }
      throw error;
    }
  } catch (error) {
    return reviewErrorResponse(error);
  }
}
