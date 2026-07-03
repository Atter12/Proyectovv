import { NextResponse } from "next/server";
import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
} from "@/config/auth";
import { routes } from "@/config/routes";
import { serverEnv } from "@/lib/env/env.server";
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

function missingSessionSecretResponse() {
  return NextResponse.json(
    {
      error:
        "SESSION_SECRET no está configurado en el servidor. Añádelo en Vercel → Project → Settings → Environment Variables y vuelve a desplegar.",
    },
    { status: 503 },
  );
}

export async function POST() {
  if (serverEnv.isProduction && !process.env.SESSION_SECRET) {
    return missingSessionSecretResponse();
  }

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
