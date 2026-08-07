import {
  contributionErrorResponse,
  noStoreJson,
  parseContributionInput,
  readJsonBody,
  resolveContributionCredential,
} from "@/contributions/http";
import { resubmitContribution } from "@/contributions/server";
import { GUARDIAN_ANALYSIS_DIGEST_HEADER } from "@/lib/guardian-analysis-digest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ caseId: string }> },
) {
  try {
    const { caseId } = await context.params;
    const input = parseContributionInput(await readJsonBody(request));
    const credential = resolveContributionCredential(
      input,
      request.headers.get(GUARDIAN_ANALYSIS_DIGEST_HEADER),
    );
    return noStoreJson(await resubmitContribution(caseId, credential));
  } catch (error) {
    return contributionErrorResponse(error);
  }
}
