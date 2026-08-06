import { contributionErrorResponse, noStoreJson } from "@/contributions/http";
import { getContribution } from "@/contributions/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ caseId: string }> },
) {
  try {
    const { caseId } = await context.params;
    return noStoreJson(await getContribution(caseId));
  } catch (error) {
    return contributionErrorResponse(error);
  }
}
