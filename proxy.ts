import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  isAccountSetupPath,
  isAdminLoginPath,
  isAdminProtectedPath,
  isGuestOnlyPath,
  isProtectedPath,
  isVerifyOtpPath,
} from "@/config/auth";
import { routes } from "@/config/routes";
import { userIsAllowedAdmin } from "@/lib/admin/allowlist";
import { resolveSafeNextPath } from "@/lib/auth/safe-next-path";
import { userCanAccessDashboard } from "@/lib/auth/dashboard-access";
import { updateSession } from "@/lib/supabase/middleware";

function buildAdminDestination(request: NextRequest): string {
  return resolveSafeNextPath(
    request.nextUrl.searchParams.get("next"),
    routes.adminOverview,
    { requiredPrefix: "/admin" },
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const { user, supabase, supabaseResponse } = await updateSession(request);

  const isAuthenticated = Boolean(user);
  const isEmailConfirmed = Boolean(user?.email_confirmed_at);
  const isAdminUser = isAuthenticated && user ? userIsAllowedAdmin(user) : false;

  const needsDashboardAccessCheck =
    isGuestOnlyPath(pathname) ||
    isVerifyOtpPath(pathname) ||
    isAccountSetupPath(pathname);

  const canAccessDashboard =
    needsDashboardAccessCheck && isAuthenticated && user
      ? await userCanAccessDashboard(supabase, user.id)
      : false;

  if (isAdminProtectedPath(pathname)) {
    if (!isAuthenticated) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = routes.adminLogin;
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
      verifyUrl.searchParams.set("context", "admin");
      verifyUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(verifyUrl);
    }

    if (!isAdminUser) {
      const unauthorizedUrl = request.nextUrl.clone();
      unauthorizedUrl.pathname = routes.adminUnauthorized;
      unauthorizedUrl.search = "";
      return NextResponse.redirect(unauthorizedUrl);
    }
  }

  if (isAdminLoginPath(pathname)) {
    if (isAuthenticated && !isEmailConfirmed) {
      const verifyUrl = request.nextUrl.clone();
      verifyUrl.pathname = routes.verifyOtp;
      verifyUrl.search = "";
      if (user?.email) {
        verifyUrl.searchParams.set("email", user.email);
      }
      verifyUrl.searchParams.set("context", "admin");
      verifyUrl.searchParams.set("next", buildAdminDestination(request));
      return NextResponse.redirect(verifyUrl);
    }

    if (isAuthenticated && isEmailConfirmed && isAdminUser) {
      const targetUrl = request.nextUrl.clone();
      targetUrl.pathname = buildAdminDestination(request);
      targetUrl.search = "";
      return NextResponse.redirect(targetUrl);
    }
  }

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
    const isAdminContext = request.nextUrl.searchParams.get("context") === "admin";
    const targetUrl = request.nextUrl.clone();

    if (isAdminContext && isAdminUser) {
      targetUrl.pathname = resolveSafeNextPath(
        request.nextUrl.searchParams.get("next"),
        routes.adminOverview,
        { requiredPrefix: "/admin" },
      );
    } else if (isAdminContext && !isAdminUser) {
      targetUrl.pathname = routes.adminUnauthorized;
    } else {
      targetUrl.pathname = canAccessDashboard
        ? routes.overview
        : routes.accountSetup;
    }

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
    "/forgot-password",
    "/account-setup",
    "/overview/:path*",
    "/ad-accounts/:path*",
    "/payments/:path*",
    "/affiliates/:path*",
    "/creative-analyzer/:path*",
    "/admin/:path*",
  ],
};
