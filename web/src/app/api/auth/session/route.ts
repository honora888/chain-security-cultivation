import { cookies } from "next/headers";

import { AUTH_COOKIE_NAME, AUTH_SCHEMA_VERSION } from "@/auth/constants";
import { authErrorResponse, noStoreJson } from "@/auth/http";
import { readSession } from "@/auth/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const token = (await cookies()).get(AUTH_COOKIE_NAME)?.value;
    if (!token) {
      return noStoreJson({ ok: true, schemaVersion: AUTH_SCHEMA_VERSION, authenticated: false });
    }

    const session = await readSession(token);
    return noStoreJson(
      session
        ? { ok: true, schemaVersion: AUTH_SCHEMA_VERSION, authenticated: true, ...session }
        : { ok: true, schemaVersion: AUTH_SCHEMA_VERSION, authenticated: false },
    );
  } catch (error) {
    return authErrorResponse(error);
  }
}
