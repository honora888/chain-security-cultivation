import {
  contributionErrorResponse,
  noStoreJson,
  parseContributionInput,
  readJsonBody,
} from "@/contributions/http";
import { createContribution, listContributions } from "@/contributions/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const input = parseContributionInput(await readJsonBody(request));
    return noStoreJson(await createContribution(input), 201);
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
