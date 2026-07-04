import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  isGuestOnlyPath,
  isProtectedPath,
  isVerifyOtpPath,
} from "@/config/auth";
import { routes } from "@/config/routes";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const { user, supabaseResponse } = await updateSession(request);

  const isAuthenticated = Boolean(user);
  const isEmailConfirmed = Boolean(user?.email_confirmed_at);

  if (isProtectedPath(pathname)) {
    if (!isAuthenticated) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = routes.login;
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }

    if (!isEmailConfirmed) {
      const verifyUrl = request.nextUrl.clone();
      verifyUrl.pathname = routes.verifyOtp;
      verifyUrl.search = "";
      if (user?.email) {
        verifyUrl.searchParams.set("email", user.email);
      }
      return NextResponse.redirect(verifyUrl);
    }
  }

  if (isGuestOnlyPath(pathname) && isAuthenticated && isEmailConfirmed) {
    const overviewUrl = request.nextUrl.clone();
    overviewUrl.pathname = routes.overview;
    overviewUrl.search = "";
    return NextResponse.redirect(overviewUrl);
  }

  if (
    isGuestOnlyPath(pathname) &&
    isAuthenticated &&
    !isEmailConfirmed
  ) {
    const verifyUrl = request.nextUrl.clone();
    verifyUrl.pathname = routes.verifyOtp;
    verifyUrl.search = "";
    if (user?.email) {
      verifyUrl.searchParams.set("email", user.email);
    }
    return NextResponse.redirect(verifyUrl);
  }

  if (isVerifyOtpPath(pathname) && isAuthenticated && isEmailConfirmed) {
    const overviewUrl = request.nextUrl.clone();
    overviewUrl.pathname = routes.overview;
    overviewUrl.search = "";
    return NextResponse.redirect(overviewUrl);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/login",
    "/register",
    "/verify-otp",
    "/overview/:path*",
    "/ad-accounts/:path*",
    "/payments/:path*",
    "/affiliates/:path*",
    "/creative-analyzer/:path*",
  ],
};
