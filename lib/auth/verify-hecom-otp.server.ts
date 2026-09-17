import "server-only";
import { createServerClient } from "@supabase/ssr";
import type { EmailOtpType, User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import {
  completeHecomOtpSession,
  isHecomOtpStaffEmail,
} from "@/lib/auth/hecom-otp.server";
import { normalizeHecomOtpEmail } from "@/lib/auth/hecom-otp-email";
import { logHecomOtp, maskEmail } from "@/lib/auth/hecom-otp-log.server";
import { serverEnv } from "@/lib/env/env.server";

type CookieToSet = {
  name: string;
  value: string;
  options?: Parameters<NextResponse["cookies"]["set"]>[2];
};

export type VerifyHecomOtpResult =
  | {
      ok: true;
      email: string;
      nextPath: string;
      accountReady: boolean;
      needsPicker: boolean;
      isStaff: boolean;
      cookies: CookieToSet[];
    }
  | { ok: false; error: string; status: number };

/**
 * Verifica el código de 6 dígitos en servidor (misma sesión que el magic link).
 * Evita el doble verifyOtp en el browser que a veces invalida el token.
 */
export async function verifyHecomOtpCode(input: {
  email: string;
  token: string;
}): Promise<VerifyHecomOtpResult> {
  const email = normalizeHecomOtpEmail(input.email);
  const token = input.token.replace(/\D/g, "").slice(0, 6);
  const emailMasked = maskEmail(email);

  if (!email.includes("@")) {
    return { ok: false, error: "Correo inválido.", status: 400 };
  }
  if (!/^\d{6}$/.test(token)) {
    return {
      ok: false,
      error: "Introduce un código de 6 dígitos.",
      status: 400,
    };
  }

  const pendingCookies: CookieToSet[] = [];
  const supabase = createServerClient(
    serverEnv.supabaseUrl,
    serverEnv.supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return [];
        },
        setAll(cookiesToSet) {
          pendingCookies.push(...cookiesToSet);
        },
      },
    },
  );

  // generateLink(type: magiclink) → probar magiclink primero; email como fallback.
  const typesToTry: EmailOtpType[] = ["magiclink", "email"];
  let user: User | null = null;
  let lastError: string | null = null;

  for (const type of typesToTry) {
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type,
    });
    if (!error && data.user) {
      user = data.user;
      logHecomOtp("info", "verify_code_ok", {
        email: emailMasked,
        type,
        userId: data.user.id,
      });
      break;
    }
    lastError = error?.message ?? "verify_failed";
    logHecomOtp("warn", "verify_code_type_failed", {
      email: emailMasked,
      type,
      error: lastError,
    });
    // Código vencido: no gastar otro intento con el mismo token.
    if (/expired/i.test(lastError)) break;
  }

  if (!user) {
    logHecomOtp("error", "verify_code_failed", {
      email: emailMasked,
      error: lastError,
      tried: typesToTry,
    });
    return {
      ok: false,
      error: lastError ?? "No pudimos verificar el código.",
      status: 401,
    };
  }

  try {
    const { accountReady, provisioned } = await completeHecomOtpSession(user);

    logHecomOtp("info", "verify_code_provision_ok", {
      email: emailMasked,
      isStaff: provisioned.isStaff,
      nextPath: accountReady ? provisioned.nextPath : "/account-setup",
      accountReady,
    });

    return {
      ok: true,
      email,
      nextPath: accountReady ? provisioned.nextPath : "/account-setup",
      accountReady,
      needsPicker: provisioned.needsPicker,
      isStaff: provisioned.isStaff,
      cookies: pendingCookies,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo completar el acceso.";
    logHecomOtp("error", "verify_code_provision_fail", {
      email: emailMasked,
      error: message,
    });
    // Sesión ya válida: no botar al login. Staff → lista de clientes.
    const isStaff = isHecomOtpStaffEmail(user.email ?? email);
    return {
      ok: true,
      email,
      nextPath: isStaff ? "/clientes" : "/overview",
      accountReady: true,
      needsPicker: isStaff,
      isStaff,
      cookies: pendingCookies,
    };
  }
}
