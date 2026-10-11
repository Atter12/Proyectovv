import { NextResponse, type NextRequest } from "next/server";
import { registerHecomClientOtp } from "@/lib/auth/hecom-otp.server";
import { isRegisterCountry } from "@/lib/auth/register-countries.shared";
import { HECOM_OTP_COOLDOWN_SECONDS } from "@/lib/auth/hecom-otp-email";
import { logHecomOtp, maskEmail } from "@/lib/auth/hecom-otp-log.server";
import { resolveSignupCode } from "@/lib/partners/partners.server";

export async function POST(request: NextRequest) {
  let body: {
    name?: string;
    dni?: string;
    phone?: string;
    email?: string;
    /** Slug del aliado (landing /a/<slug>) o código de referido (/r/<code>). */
    partner?: string;
    referralCode?: string;
    /** Código que el cliente escribió (aliado o referido); manda sobre el link. */
    promoCode?: string;
    /** PE, CO, EC o BR. */
    country?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    logHecomOtp("warn", "api_register_bad_json", {});
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const emailMasked = maskEmail(body.email ?? "");
  logHecomOtp("info", "api_register_hit", { email: emailMasked });

  // Código escrito a mano: se valida antes de crear la cuenta para que no se pierda.
  const typedCode = typeof body.promoCode === "string" ? body.promoCode.trim() : "";
  const promo = typedCode ? await resolveSignupCode(typedCode) : null;
  if (typedCode && !promo) {
    return NextResponse.json(
      { error: "Ese código no existe o ya no está activo. Revísalo o déjalo vacío." },
      { status: 400 },
    );
  }

  const result = await registerHecomClientOtp({
    name: body.name ?? "",
    dni: body.dni ?? "",
    phone: body.phone ?? "",
    email: body.email ?? "",
    country: isRegisterCountry(body.country) ? body.country : "PE",
    // El formulario los manda; las cookies cubren el caso en que no llegaron.
    attribution: {
      partnerSlug:
        (promo?.kind === "partner" ? promo.slug : null) ||
        body.partner ||
        request.cookies.get("ah_partner")?.value ||
        null,
      referralCode:
        (promo?.kind === "referral" ? promo.code : null) ||
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
