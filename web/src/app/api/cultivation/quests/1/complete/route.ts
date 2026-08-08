import { cultivationErrorResponse, noStoreCultivationJson, readCultivationJsonBody } from "@/features/cultivation/http";
import { parseQuestOneCompletionEvidence } from "@/features/cultivation/quest-one-completion";
import { completeQuestOne } from "@/features/cultivation/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const evidence = parseQuestOneCompletionEvidence(await readCultivationJsonBody(request));
    return noStoreCultivationJson(await completeQuestOne(evidence), 200);
  } catch (error) {
    return cultivationErrorResponse(error);
  }
}
