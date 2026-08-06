import { AUTH_CHAIN_ID, AUTH_SCHEMA_VERSION } from "@/auth/constants";
import {
  assertAllowedOrigin,
  assertExactObject,
  authErrorResponse,
  noStoreJson,
  readJsonBody,
  requireString,
} from "@/auth/http";
import { issueNonce } from "@/auth/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const origin = assertAllowedOrigin(request);
    const body = assertExactObject(await readJsonBody(request), ["walletAddress"]);
    const result = await issueNonce(requireString(body.walletAddress), origin);

    return noStoreJson({
      ok: true,
      schemaVersion: AUTH_SCHEMA_VERSION,
      walletAddress: result.walletAddress,
      chainId: AUTH_CHAIN_ID,
      nonceId: result.nonceId,
      nonce: result.nonce,
      message: result.message,
      issuedAt: result.issuedAt,
      expiresAt: result.expiresAt,
    });
  } catch (error) {
    return authErrorResponse(error);
  }
}
