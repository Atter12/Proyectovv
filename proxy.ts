import { NextResponse } from "next/server";
import type { NextFetchEvent, NextRequest } from "next/server";
import { clerkMiddleware } from "@clerk/nextjs/server";
import {
  isAccountSetupPath,
  isServiceContractPath,
  isCheckoutPath,
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
import { clerkLoginEnabled } from "@/lib/auth/clerk";
import { updateSession } from "@/lib/supabase/middleware";

function buildAdminDestination(request: NextRequest): string {
  return resolveSafeNextPath(
    request.nextUrl.searchParams.get("next"),
    routes.adminOverview,
    { requiredPrefix: "/admin" },
  );
}

function appendHecomOtpFlow(verifyUrl: URL) {
  if (process.env.AUTH_HECOM_OTP_LOGIN === "true") {
    verifyUrl.searchParams.set("flow", "hecom");
  }
}

async function runHolisticProxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const { user, supabase, supabaseResponse } = await updateSession(request);

  const isAuthenticated = Boolean(user);
  const isEmailConfirmed = Boolean(user?.email_confirmed_at);
  const isAdminUser = isAuthenticated && user ? userIsAllowedAdmin(user) : false;

  const needsDashboardAccessCheck =
    isGuestOnlyPath(pathname) ||
    isVerifyOtpPath(pathname) ||
    isAccountSetupPath(pathname) ||
    isServiceContractPath(pathname) ||
    isCheckoutPath(pathname);

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
      appendHecomOtpFlow(verifyUrl);
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
      appendHecomOtpFlow(verifyUrl);
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
      appendHecomOtpFlow(verifyUrl);
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
    appendHecomOtpFlow(verifyUrl);
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

  if (isAccountSetupPath(pathname) || isServiceContractPath(pathname) || isCheckoutPath(pathname)) {
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
      appendHecomOtpFlow(verifyUrl);
      return NextResponse.redirect(verifyUrl);
    }

    if (isAccountSetupPath(pathname) && canAccessDashboard) {
      const overviewUrl = request.nextUrl.clone();
      overviewUrl.pathname = routes.overview;
      overviewUrl.search = "";
      return NextResponse.redirect(overviewUrl);
    }
  }

  return supabaseResponse;
}

const clerkHandler = clerkMiddleware(async (_auth, request) => {
  return runHolisticProxy(request);
});

export async function proxy(request: NextRequest, event: NextFetchEvent) {
  if (clerkLoginEnabled()) {
    return clerkHandler(request, event);
  }
  return runHolisticProxy(request);
}

// Toda página que lea la sesión en el servidor debe pasar por aquí: el proxy
// es el único punto que puede guardar el token renovado en la cookie. Si una
// página queda fuera, Supabase rota el token sin persistirlo y cierra la sesión.
// `lib/auth/proxy-matcher.test.ts` verifica que no falte ninguna ruta del panel.
export const config = {
  matcher: [
    "/",
    "/login",
    "/register",
    "/verify-otp",
    "/forgot-password",
    "/account-setup",
    "/contrato",
    "/pago",
    "/pago/:path*",
    "/sign-in",
    "/sign-in/(.*)",
    "/sign-up",
    "/sign-up/(.*)",
    "/auth/clerk/(.*)",
    "/overview",
    "/overview/:path*",
    "/clientes",
    "/clientes/:path*",
    "/api/clientes",
    "/api/clientes/:path*",
    "/ad-accounts",
    "/ad-accounts/:path*",
    "/payments",
    "/payments/:path*",
    "/links-deuda",
    "/links-deuda/:path*",
    "/alianzas",
    "/alianzas/:path*",
    "/monitoreo",
    "/monitoreo/:path*",
    "/apelaciones",
    "/apelaciones/:path*",
    "/cobros",
    "/cobros/:path*",
    "/pixels",
    "/pixels/:path*",
    "/support",
    "/support/:path*",
    "/gastos",
    "/gastos/:path*",
    "/affiliates",
    "/affiliates/:path*",
    "/creative-analyzer",
    "/creative-analyzer/:path*",
    "/profit",
    "/profit/:path*",
    "/asistente",
    "/asistente/:path*",
    "/contratos-registro",
    "/contratos-registro/:path*",
    "/education",
    "/education/:path*",
    "/admin/:path*",
  ],
};
