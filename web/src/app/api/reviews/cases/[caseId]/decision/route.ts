import {
  assertReviewOrigin,
  noStoreJson,
  parseReviewDecision,
  readReviewJsonBody,
  reviewErrorResponse,
} from "@/reviews/http";
import { applyReviewDecision } from "@/reviews/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ caseId: string }> },
) {
  try {
    assertReviewOrigin(request);
    const { caseId } = await context.params;
    const input = parseReviewDecision(await readReviewJsonBody(request));
    return noStoreJson(await applyReviewDecision(caseId, input));
  } catch (error) {
    return reviewErrorResponse(error);
  }
}
