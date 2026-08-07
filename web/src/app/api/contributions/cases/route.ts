import {
  contributionErrorResponse,
  noStoreJson,
  parseContributionInput,
  readJsonBody,
} from "@/contributions/http";
import { createContribution, listContributions } from "@/contributions/server";
import {
  GUARDIAN_ANALYSIS_DIGEST_HEADER,
  GUARDIAN_ANALYSIS_DIGEST_PATTERN,
} from "@/lib/guardian-analysis-digest";
import { ContributionHttpError } from "@/contributions/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const input = parseContributionInput(await readJsonBody(request));
    const analysisDigest = request.headers.get(GUARDIAN_ANALYSIS_DIGEST_HEADER)?.trim() ?? "";
    if (!GUARDIAN_ANALYSIS_DIGEST_PATTERN.test(analysisDigest)) {
      throw new ContributionHttpError("INVALID_REQUEST");
    }
    return noStoreJson(await createContribution(input, analysisDigest), 201);
  } catch (error) {
    return contributionErrorResponse(error);
  }
}

export async function GET() {
  try {
    return noStoreJson(await listContributions());
  } catch (error) {
    return contributionErrorResponse(error);
  }
}
