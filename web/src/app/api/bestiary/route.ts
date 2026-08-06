import { noStoreJson, reviewErrorResponse } from "@/reviews/http";
import { listBestiary } from "@/reviews/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return noStoreJson(await listBestiary());
  } catch (error) {
    return reviewErrorResponse(error);
  }
}
