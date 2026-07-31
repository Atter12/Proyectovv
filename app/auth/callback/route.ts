import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { routes } from "@/config/routes";
import { serverEnv } from "@/lib/env/env.server";
import {
  isHecomOtpLoginEnabled,
  linkHecomClientesForUser,
} from "@/lib/auth/hecom-otp.server";

/**
 * Magic link / PKCE callback.
 * Supabase redirige acá tras el enlace del correo.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const flow = url.searchParams.get("flow");
  const nextRaw = url.searchParams.get("next");
  const next =
    nextRaw && nextRaw.startsWith("/") && !nextRaw.startsWith("//")
      ? nextRaw
      : routes.overview;

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      const fail = new URL(routes.login, serverEnv.appUrl);
      fail.searchParams.set("error", "magic_link");
      return NextResponse.redirect(fail);
    }
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type: type as "email" | "magiclink" | "signup",
      token_hash: tokenHash,
    });
    if (error) {
      const fail = new URL(routes.login, serverEnv.appUrl);
      fail.searchParams.set("error", "magic_link");
      return NextResponse.redirect(fail);
    }
  } else {
    const fail = new URL(routes.login, serverEnv.appUrl);
    fail.searchParams.set("error", "magic_link");
    return NextResponse.redirect(fail);
  }

  if (flow === "hecom" && isHecomOtpLoginEnabled()) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user?.email) {
      await linkHecomClientesForUser({
        userId: user.id,
        email: user.email,
      }).catch(() => undefined);
    }
  }

  return NextResponse.redirect(new URL(next, serverEnv.appUrl));
}
