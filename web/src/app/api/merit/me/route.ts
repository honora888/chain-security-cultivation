import { noStoreJson, reviewErrorResponse } from "@/reviews/http";
import { getCurrentMerit } from "@/reviews/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return noStoreJson(await getCurrentMerit());
  } catch (error) {
    return reviewErrorResponse(error);
  }
}
