import { cultivationErrorResponse, noStoreCultivationJson } from "@/features/cultivation/http";
import { getCurrentCultivationProfile } from "@/features/cultivation/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return noStoreCultivationJson(await getCurrentCultivationProfile());
  } catch (error) {
    return cultivationErrorResponse(error);
  }
}
