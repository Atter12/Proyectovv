import { NextResponse } from "next/server";
import { requestHecomClientOtp } from "@/lib/auth/hecom-otp.server";

export async function POST(request: Request) {
  let body: { email?: string };
  try {
    body = (await request.json()) as { email?: string };
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const result = await requestHecomClientOtp({ email: body.email ?? "" });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    ok: true,
    message: result.message,
    // No exponer allowed/clienteIds al cliente en prod UX; útil en preview.
    ...(process.env.NODE_ENV !== "production"
      ? { allowed: result.allowed, clienteIds: result.clienteIds }
      : {}),
    retryAfterSec: result.retryAfterSec,
  });
}
