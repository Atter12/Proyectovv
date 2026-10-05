import { NextResponse, type NextRequest } from "next/server";
import { registerHecomClientOtp } from "@/lib/auth/hecom-otp.server";
import { HECOM_OTP_COOLDOWN_SECONDS } from "@/lib/auth/hecom-otp-email";
import { logHecomOtp, maskEmail } from "@/lib/auth/hecom-otp-log.server";

export async function POST(request: NextRequest) {
  let body: {
    name?: string;
    dni?: string;
    phone?: string;
    email?: string;
    /** Slug del aliado (landing /a/<slug>) o código de referido (/r/<code>). */
    partner?: string;
    referralCode?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    logHecomOtp("warn", "api_register_bad_json", {});
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const emailMasked = maskEmail(body.email ?? "");
  logHecomOtp("info", "api_register_hit", { email: emailMasked });

  const result = await registerHecomClientOtp({
    name: body.name ?? "",
    dni: body.dni ?? "",
    phone: body.phone ?? "",
    email: body.email ?? "",
    // El formulario los manda; las cookies cubren el caso en que no llegaron.
    attribution: {
      partnerSlug: body.partner || request.cookies.get("ah_partner")?.value || null,
      referralCode:
        body.referralCode ||
        decodeURIComponent(request.cookies.get("vv_referral_code")?.value ?? "") ||
        null,
      visitorId: request.cookies.get("ah_vid")?.value ?? null,
    },
  });

  if (!result.ok) {
    logHecomOtp("error", "api_register_fail", {
      email: emailMasked,
      status: result.status,
      error: result.error,
    });
    return NextResponse.json(
      { error: result.error, retryAfterSec: result.retryAfterSec },
      { status: result.status },
    );
  }

  logHecomOtp("info", "api_register_ok", {
    email: emailMasked,
    sent: result.sent ?? result.allowed,
    allowed: result.allowed,
  });

  return NextResponse.json({
    ok: true,
    message: result.message,
    email: result.email,
    sent: result.sent ?? result.allowed,
    retryAfterSec: result.retryAfterSec ?? HECOM_OTP_COOLDOWN_SECONDS,
    ...(process.env.NODE_ENV !== "production"
      ? { allowed: result.allowed, clienteIds: result.clienteIds }
      : {}),
  });
}
