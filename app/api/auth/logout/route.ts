import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/config/auth";
import { routes } from "@/config/routes";
import { serverEnv } from "@/lib/env/env.server";

export async function POST() {
  const response = NextResponse.json({
    ok: true,
    redirectTo: routes.login,
  });

  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: serverEnv.isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return response;
}
