import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isAuthPath, isProtectedPath } from "@/config/auth";
import { routes } from "@/config/routes";
import { verifySessionToken } from "@/lib/auth/session-token";

const SESSION_COOKIE_NAME = "dm_session";

function getSessionSecret(): string {
  if (process.env.NODE_ENV === "production" && !process.env.SESSION_SECRET) {
    throw new Error("[middleware] SESSION_SECRET es obligatorio en producción.");
  }
  return (
    process.env.SESSION_SECRET ??
    "dev-mock-session-secret-change-in-production"
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token
    ? await verifySessionToken(token, getSessionSecret())
    : null;

  if (isProtectedPath(pathname) && !session) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = routes.login;
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthPath(pathname) && session) {
    const overviewUrl = request.nextUrl.clone();
    overviewUrl.pathname = routes.overview;
    overviewUrl.search = "";
    return NextResponse.redirect(overviewUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/login",
    "/overview/:path*",
    "/ad-accounts/:path*",
    "/payments/:path*",
    "/affiliates/:path*",
    "/creative-analyzer/:path*",
  ],
};
