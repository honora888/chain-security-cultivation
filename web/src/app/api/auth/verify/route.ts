import { AUTH_SCHEMA_VERSION } from "@/auth/constants";
import {
  assertAllowedOrigin,
  assertExactObject,
  authErrorResponse,
  noStoreJson,
  readJsonBody,
  requireString,
} from "@/auth/http";
import { verifyWalletSignature } from "@/auth/server";
import { setSessionCookie } from "@/auth/session-cookie";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const origin = assertAllowedOrigin(request);
    const body = assertExactObject(await readJsonBody(request), [
      "walletAddress",
      "nonceId",
      "nonce",
      "signature",
    ]);
    const result = await verifyWalletSignature({
      walletAddress: requireString(body.walletAddress),
      nonceId: requireString(body.nonceId),
      nonce: requireString(body.nonce),
      signature: requireString(body.signature),
      origin,
    });

    const response = noStoreJson({
      ok: true,
      schemaVersion: AUTH_SCHEMA_VERSION,
      authenticated: true,
      walletAddress: result.walletAddress,
      expiresAt: result.expiresAt,
    });
    setSessionCookie(response, request, result.sessionToken);
    return response;
  } catch (error) {
    return authErrorResponse(error);
  }
}
