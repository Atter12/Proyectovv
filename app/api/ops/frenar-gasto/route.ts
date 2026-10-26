import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/guards.server";
import { getActingAsCliente } from "@/lib/hecom/selected-cliente.server";
import { bajarSaldoCuenta, congelarCuenta, type FrenarResult } from "@/lib/ops/frenar-gasto.server";
import { getPrepagoMonitorSnapshot } from "@/lib/ops/prepago-monitor.server";
import { resolvePaymentsFundingCapabilities } from "@/lib/payments/funding-roles.server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Congelar recorre todas las cuentas del cliente en TikTok, una por una.
export const maxDuration = 300;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACTIONS = new Set(["bajar", "cero", "congelar"]);

/**
 * Gerencia frena el gasto de un cliente desde Monitoreo:
 * bajar = quita un monto de una cuenta · cero = la deja en $0 · congelar = pausa y $0 en todas.
 * Solo cuentas que el monitoreo tiene vinculadas a ese cliente.
 */
export async function POST(request: Request) {
  const session = await requirePermission("payments:read");
  const capabilities = await resolvePaymentsFundingCapabilities({
    email: session.email,
    role: session.role,
  });
  if (!capabilities.isStaff && !capabilities.isSuperAdmin) {
    return NextResponse.json({ ok: false, error: "Solo gerencia." }, { status: 403 });
  }
  if (await getActingAsCliente(session.id)) {
    return NextResponse.json({ ok: false, error: "Sal de la vista de cliente." }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    clienteId?: string;
    action?: string;
    advertiserId?: string;
    amountUsd?: number;
    motivo?: string;
  };
  const clienteId = String(body.clienteId ?? "").trim().toLowerCase();
  const action = String(body.action ?? "");
  const motivo = String(body.motivo ?? "").trim().slice(0, 300);
  if (!UUID_RE.test(clienteId)) {
    return NextResponse.json({ ok: false, error: "Cliente inválido." }, { status: 400 });
  }
  if (!ACTIONS.has(action)) {
    return NextResponse.json({ ok: false, error: "Acción inválida." }, { status: 400 });
  }
  if (motivo.length < 3) {
    return NextResponse.json({ ok: false, error: "Escribe el motivo y quién lo ordenó." }, { status: 400 });
  }
  const amount = action === "bajar" ? Math.round(Number(body.amountUsd) * 100) / 100 : null;
  if (action === "bajar" && !(amount! > 0 && amount! <= 50_000)) {
    return NextResponse.json({ ok: false, error: "Monto inválido." }, { status: 400 });
  }

  const snapshot = await getPrepagoMonitorSnapshot();
  const cliente = snapshot.clientes.find((c) => c.id === clienteId);
  if (!cliente) {
    return NextResponse.json({ ok: false, error: "Cliente no encontrado en el monitoreo." }, { status: 404 });
  }

  let targets = cliente.accounts;
  if (action !== "congelar") {
    const adv = String(body.advertiserId ?? "").trim();
    targets = cliente.accounts.filter((a) => a.advertiserId === adv);
    if (!targets.length) {
      return NextResponse.json({ ok: false, error: "Esa cuenta no es de este cliente." }, { status: 400 });
    }
  }

  const results: FrenarResult[] = [];
  for (const a of targets) {
    try {
      results.push(
        action === "congelar"
          ? await congelarCuenta({ bm: a.bm, advertiserId: a.advertiserId })
          : await bajarSaldoCuenta({ bm: a.bm, advertiserId: a.advertiserId, amountUsd: amount }),
      );
    } catch (error) {
      results.push({
        advertiserId: a.advertiserId,
        ok: false,
        removedUsd: 0,
        leftUsd: null,
        message: error instanceof Error ? error.message.slice(0, 200) : "Error de TikTok.",
      });
    }
  }

  await createAdminClient()
    .from("audit_logs")
    .insert({
      action: `ops.frenar_gasto.${action}`,
      entity_type: "hecom_cliente",
      metadata: {
        by: session.email,
        hecom_cliente_id: clienteId,
        cliente_name: cliente.name,
        motivo,
        amount_usd: amount,
        removed_usd: Math.round(results.reduce((s, r) => s + r.removedUsd, 0) * 100) / 100,
        results,
      },
    })
    .then(() => undefined, () => undefined);

  return NextResponse.json({ ok: results.some((r) => r.ok), results });
}
