import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  isAccountSetupPath,
  isGuestOnlyPath,
  isProtectedPath,
  isVerifyOtpPath,
} from "@/config/auth";
import { routes } from "@/config/routes";
import { userCanAccessDashboard } from "@/lib/auth/dashboard-access";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const { user, supabase, supabaseResponse } = await updateSession(request);

  const isAuthenticated = Boolean(user);
  const isEmailConfirmed = Boolean(user?.email_confirmed_at);

  const needsDashboardAccessCheck =
    isGuestOnlyPath(pathname) ||
    isVerifyOtpPath(pathname) ||
    isAccountSetupPath(pathname);

  const canAccessDashboard =
    needsDashboardAccessCheck && isAuthenticated && user
      ? await userCanAccessDashboard(supabase, user.id)
      : false;

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
    const targetUrl = request.nextUrl.clone();
    targetUrl.pathname = canAccessDashboard
      ? routes.overview
      : routes.accountSetup;
    targetUrl.search = "";
    return NextResponse.redirect(targetUrl);
  }

  if (isGuestOnlyPath(pathname) && isAuthenticated && !isEmailConfirmed) {
    const verifyUrl = request.nextUrl.clone();
    verifyUrl.pathname = routes.verifyOtp;
    verifyUrl.search = "";
    if (user?.email) {
      verifyUrl.searchParams.set("email", user.email);
    }
    return NextResponse.redirect(verifyUrl);
  }

  if (isVerifyOtpPath(pathname) && isAuthenticated && isEmailConfirmed) {
    const targetUrl = request.nextUrl.clone();
    targetUrl.pathname = canAccessDashboard
      ? routes.overview
      : routes.accountSetup;
    targetUrl.search = "";
    return NextResponse.redirect(targetUrl);
  }

  if (isAccountSetupPath(pathname)) {
    if (!isAuthenticated) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = routes.login;
      loginUrl.search = "";
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

    if (canAccessDashboard) {
      const overviewUrl = request.nextUrl.clone();
      overviewUrl.pathname = routes.overview;
      overviewUrl.search = "";
      return NextResponse.redirect(overviewUrl);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/login",
    "/register",
    "/verify-otp",
    "/account-setup",
    "/overview/:path*",
    "/ad-accounts/:path*",
    "/payments/:path*",
    "/affiliates/:path*",
    "/creative-analyzer/:path*",
  ],
};
