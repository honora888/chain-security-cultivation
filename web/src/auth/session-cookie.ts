import type { NextResponse } from "next/server";

import {
  AUTH_COOKIE_MAX_AGE,
  AUTH_COOKIE_NAME,
} from "@/auth/constants";

export function setSessionCookie(response: NextResponse, request: Request, token: string): void {
  response.cookies.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: new URL(request.url).protocol === "https:",
    maxAge: AUTH_COOKIE_MAX_AGE,
  });
}

export function clearSessionCookie(response: NextResponse, request: Request): void {
  response.cookies.set(AUTH_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: new URL(request.url).protocol === "https:",
    maxAge: 0,
  });
}
