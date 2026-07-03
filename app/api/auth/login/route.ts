import { NextResponse } from "next/server";
import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
} from "@/config/auth";
import { routes } from "@/config/routes";
import { assertProductionSecrets, serverEnv } from "@/lib/env/env.server";
import { createMockSession } from "@/lib/auth/session.server";

function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: serverEnv.isProduction,
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

export async function POST() {
  assertProductionSecrets();

  if (serverEnv.authMode !== "mock") {
    return NextResponse.json(
      { error: "OAuth no configurado. AUTH_MODE debe ser mock." },
      { status: 501 },
    );
  }

  const token = await createMockSession();
  const response = NextResponse.json({
    ok: true,
    redirectTo: routes.overview,
    mode: "mock",
  });

  response.cookies.set(SESSION_COOKIE_NAME, token, sessionCookieOptions());
  return response;
}
