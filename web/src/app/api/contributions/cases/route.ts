import {
  contributionErrorResponse,
  noStoreJson,
  parseContributionInput,
  readJsonBody,
  resolveContributionCredential,
} from "@/contributions/http";
import { createContribution, createSignedContribution, listContributions } from "@/contributions/server";
import { GUARDIAN_ANALYSIS_DIGEST_HEADER } from "@/lib/guardian-analysis-digest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const input = parseContributionInput(await readJsonBody(request));
    const credential = resolveContributionCredential(
      input,
      request.headers.get(GUARDIAN_ANALYSIS_DIGEST_HEADER),
    );
    return noStoreJson(
      credential.mode === "signed"
        ? await createSignedContribution(credential.input)
        : await createContribution(credential.input, credential.analysisDigest),
      201,
    );
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
