import { NextResponse } from "next/server";
import { requestHecomClientOtp } from "@/lib/auth/hecom-otp.server";
import { logHecomOtp, maskEmail } from "@/lib/auth/hecom-otp-log.server";

export async function POST(request: Request) {
  let body: { email?: string };
  try {
    body = (await request.json()) as { email?: string };
  } catch {
    logHecomOtp("warn", "api_request_bad_json", {});
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const emailMasked = maskEmail(body.email ?? "");
  logHecomOtp("info", "api_request_hit", { email: emailMasked });

  const result = await requestHecomClientOtp({ email: body.email ?? "" });
  if (!result.ok) {
    logHecomOtp("error", "api_request_fail", {
      email: emailMasked,
      status: result.status,
      error: result.error,
    });
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  logHecomOtp("info", "api_request_ok", {
    email: emailMasked,
    sent: result.sent ?? result.allowed,
    allowed: result.allowed,
  });

  return NextResponse.json({
    ok: true,
    message: result.message,
    sent: result.sent ?? result.allowed,
    // No exponer allowed/clienteIds al cliente en prod UX; útil en preview.
    ...(process.env.NODE_ENV !== "production"
      ? { allowed: result.allowed, clienteIds: result.clienteIds }
      : {}),
    retryAfterSec: result.retryAfterSec,
  });
}
