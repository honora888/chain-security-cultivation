import { cookies } from "next/headers";

import { AUTH_COOKIE_NAME, AUTH_SCHEMA_VERSION } from "@/auth/constants";
import { clearSessionCookie } from "@/auth/session-cookie";
import { revokeSession } from "@/auth/server";
import { assertAllowedOrigin, authErrorResponse, noStoreJson } from "@/auth/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const token = (await cookies()).get(AUTH_COOKIE_NAME)?.value;
  try {
    assertAllowedOrigin(request);
    if (token) {
      await revokeSession(token);
    }
    const response = noStoreJson({ ok: true, schemaVersion: AUTH_SCHEMA_VERSION, authenticated: false });
    clearSessionCookie(response, request);
    return response;
  } catch (error) {
    const response = authErrorResponse(error);
    clearSessionCookie(response, request);
    return response;
  }
}
