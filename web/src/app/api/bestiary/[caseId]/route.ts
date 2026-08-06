import { noStoreJson, reviewErrorResponse } from "@/reviews/http";
import { getPublishedBestiary } from "@/reviews/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ caseId: string }> },
) {
  try {
    const { caseId } = await context.params;
    return noStoreJson(await getPublishedBestiary(caseId));
  } catch (error) {
    return reviewErrorResponse(error);
  }
}
