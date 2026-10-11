import { NextResponse, type NextRequest } from "next/server";
import { resolveSignupCode } from "@/lib/partners/partners.server";

export const runtime = "nodejs";

/**
 * GET /api/partners/code?code=XXX — el registro valida el código de aliado o
 * de referido mientras el cliente lo escribe.
 */
export async function GET(request: NextRequest) {
  const resolved = await resolveSignupCode(request.nextUrl.searchParams.get("code"));
  if (!resolved) return NextResponse.json({ ok: false }, { status: 404 });
  return NextResponse.json(
    resolved.kind === "partner"
      ? { ok: true, kind: "partner", label: resolved.label }
      : { ok: true, kind: "referral", label: resolved.code },
  );
}
