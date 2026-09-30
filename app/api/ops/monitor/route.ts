import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/guards.server";
import { getActingAsCliente } from "@/lib/hecom/selected-cliente.server";
import { getPrepagoMonitorSnapshot } from "@/lib/ops/prepago-monitor.server";
import { resolvePaymentsFundingCapabilities } from "@/lib/payments/funding-roles.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Lee 4 BM de TikTok, sus movimientos, la cartera Holistic y Hecom (~15 s).
export const maxDuration = 60;

/** Monitoreo de prepago (solo lectura, solo gerencia). ?fresh=1 salta el caché de 3 min. */
export async function GET(request: Request) {
  const session = await requirePermission("payments:read");
  const capabilities = await resolvePaymentsFundingCapabilities({
    email: session.email,
    role: session.role,
  });
  if (!capabilities.isStaff && !capabilities.isSuperAdmin) {
    return NextResponse.json({ ok: false, error: "Solo gerencia." }, { status: 403 });
  }
  if (await getActingAsCliente(session.id)) {
    return NextResponse.json(
      { ok: false, error: "Sal de la vista de cliente para ver el monitoreo." },
      { status: 403 },
    );
  }

  const fresh = new URL(request.url).searchParams.get("fresh") === "1";
  try {
    const snapshot = await getPrepagoMonitorSnapshot({ fresh });
    return NextResponse.json({ ok: true, snapshot });
  } catch (error) {
    console.error("[ops/monitor] failed", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "No se pudo armar el monitoreo.",
      },
      { status: 500 },
    );
  }
}
