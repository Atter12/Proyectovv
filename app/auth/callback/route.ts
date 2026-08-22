import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { EmailOtpType } from "@supabase/supabase-js";
import { routes } from "@/config/routes";
import { serverEnv } from "@/lib/env/env.server";
import {
  isHecomOtpLoginEnabled,
  provisionHecomClienteAccess,
} from "@/lib/auth/hecom-otp.server";
import { logHecomOtp, maskEmail } from "@/lib/auth/hecom-otp-log.server";

type CookieToSet = {
  name: string;
  value: string;
  options?: Parameters<NextResponse["cookies"]["set"]>[2];
};

/**
 * Magic link / PKCE callback.
 * Preferimos token_hash (link propio con hashed_token) — estable con PKCE + Resend.
 * Misma provisión que el código OTP: 1 cliente → overview; N → /clientes.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const typeParam = url.searchParams.get("type");
  const flow = url.searchParams.get("flow");
  const nextRaw = url.searchParams.get("next");

  logHecomOtp("info", "callback_hit", {
    hasCode: Boolean(code),
    hasTokenHash: Boolean(tokenHash),
    type: typeParam,
    flow,
  });

  const fail = (reason: string) => {
    const target = new URL(routes.login, serverEnv.appUrl);
    target.searchParams.set("error", "magic_link");
    target.searchParams.set("reason", reason);
    return NextResponse.redirect(target);
  };

  const pendingCookies: CookieToSet[] = [];
  const supabase = createServerClient(
    serverEnv.supabaseUrl,
    serverEnv.supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          pendingCookies.push(...cookiesToSet);
        },
      },
    },
  );

  const redirectWithSession = (target: URL) => {
    const response = NextResponse.redirect(target);
    for (const { name, value, options } of pendingCookies) {
      response.cookies.set(name, value, options);
    }
    return response;
  };

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      logHecomOtp("error", "callback_exchange_failed", { error: error.message });
      return fail("exchange");
    }
  } else if (tokenHash) {
    const typesToTry: EmailOtpType[] = [];
    if (flow === "hecom") {
      typesToTry.push("magiclink");
    } else {
      if (
        typeParam === "email" ||
        typeParam === "magiclink" ||
        typeParam === "signup"
      ) {
        typesToTry.push(typeParam);
      }
      if (!typesToTry.includes("magiclink")) typesToTry.push("magiclink");
      if (!typesToTry.includes("email")) typesToTry.push("email");
    }

    let lastError: string | null = null;
    let verified = false;
    for (const type of typesToTry) {
      const { error } = await supabase.auth.verifyOtp({
        type,
        token_hash: tokenHash,
      });
      if (!error) {
        verified = true;
        logHecomOtp("info", "callback_verify_ok", { type });
        break;
      }
      lastError = error.message;
    }

    if (!verified) {
      logHecomOtp("error", "callback_verify_failed", {
        error: lastError,
        type: typeParam,
        tried: typesToTry,
      });
      return fail("verify");
    }
  } else {
    logHecomOtp("error", "callback_missing_token", {});
    return fail("missing");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isHecomFlow =
    flow === "hecom" || user?.user_metadata?.hecom_otp === true;

  let next: string = routes.overview;
  if (nextRaw && nextRaw.startsWith("/") && !nextRaw.startsWith("//")) {
    next = nextRaw;
  }

  if (isHecomFlow && isHecomOtpLoginEnabled() && user?.email) {
    const provisioned = await provisionHecomClienteAccess({
      userId: user.id,
      email: user.email,
    }).catch((error) => {
      logHecomOtp("error", "callback_provision_failed", {
        email: maskEmail(user.email ?? ""),
        error: error instanceof Error ? error.message : "unknown",
      });
      return null;
    });

    if (provisioned) {
      next = provisioned.nextPath;
      logHecomOtp("info", "callback_provision_ok", {
        email: maskEmail(user.email),
        next,
        isStaff: provisioned.isStaff,
        needsPicker: provisioned.needsPicker,
      });
    }
  }

  logHecomOtp("info", "callback_redirect", {
    next,
    cookieCount: pendingCookies.length,
  });
  return redirectWithSession(new URL(next, serverEnv.appUrl));
}
