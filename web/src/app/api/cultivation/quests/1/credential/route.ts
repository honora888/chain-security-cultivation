import { CULTIVATION_CREDENTIAL_SCHEMA_VERSION } from "@/features/cultivation/contracts";
import { getCurrentQuestOneCredential } from "@/features/cultivation/credential-server";
import {
  mapCultivationError,
  noStoreCultivationJson,
} from "@/features/cultivation/http";
import {
  ChainStatusQueryError,
  publicMessageForCode,
} from "@/lib/quest-1-chain-status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CHAIN_ERROR_STATUS: Record<string, number> = {
  CHAIN_NOT_CONFIGURED: 503,
  RPC_TIMEOUT: 504,
};

function credentialErrorResponse(error: unknown) {
  if (error instanceof ChainStatusQueryError) {
    return noStoreCultivationJson({
      ok: false,
      schemaVersion: CULTIVATION_CREDENTIAL_SCHEMA_VERSION,
      error: {
        code: error.code,
        message: publicMessageForCode(error.code),
      },
    }, CHAIN_ERROR_STATUS[error.code] ?? 502);
  }

  const mapped = mapCultivationError(error);
  return noStoreCultivationJson({
    ok: false,
    schemaVersion: CULTIVATION_CREDENTIAL_SCHEMA_VERSION,
    error: { code: mapped.code, message: mapped.message },
  }, mapped.status);
}

export async function GET() {
  try {
    return noStoreCultivationJson(await getCurrentQuestOneCredential());
  } catch (error) {
    return credentialErrorResponse(error);
  }
}
