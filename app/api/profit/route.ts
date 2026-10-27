import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/guards.server";
import {
  getActingAsCliente,
  getSelectedHecomCliente,
} from "@/lib/hecom/selected-cliente.server";
import {
  clampProfitDateRange,
  defaultProfitDateRange,
} from "@/lib/realprofit/db.server";
import { loadClienteProfitPromo } from "@/lib/realprofit/profit-snapshot.server";
import { loadRpConnections } from "@/lib/realprofit/connections.server";
import {
  buildRealProfitInstallUrl,
  realProfitBaseUrl,
} from "@/lib/realprofit/install-link.server";
import {
  resolvePaymentsFundingCapabilities,
} from "@/lib/payments/funding-roles.server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await requirePermission("adAccounts:read");
  const selected = await getSelectedHecomCliente(session.id);
  if (!selected) {
    return NextResponse.json(
      { error: "Selecciona un cliente primero." },
      { status: 400 },
    );
  }

  const rawFunding = await resolvePaymentsFundingCapabilities({
    email: session.email,
    role: session.role,
  });
  // “Ver como cliente” = vista de cliente: sin staffOps/score.
  const isStaff =
    (rawFunding.isStaff || rawFunding.isSuperAdmin) &&
    !(await getActingAsCliente(session.id));

  const url = new URL(request.url);
  const range = defaultProfitDateRange();
  const clamped = clampProfitDateRange({
    from: url.searchParams.get("from")?.trim() || range.from,
    to: url.searchParams.get("to")?.trim() || range.to,
  });
  const from = clamped.from;
  const to = clamped.to;

  try {
    const data = await loadClienteProfitPromo({
      hecomClienteId: selected.id,
      from,
      to,
      includeStaffOps: isStaff,
    });
    const connections = await loadRpConnections({
      hecomClienteId: selected.id,
      linkedStores: data.linkedStores,
    });
    return NextResponse.json({
      ok: true,
      cliente: { id: selected.id, name: selected.name },
      from,
      to,
      realProfitUrl: realProfitBaseUrl(),
      // Firmado con este cliente: al instalar, la tienda se vincula sola.
      installUrl: buildRealProfitInstallUrl(selected.id),
      connections,
      linkedStores: data.linkedStores,
      snapshots: data.snapshots,
      analysis: data.analysis,
      staffOps: isStaff ? data.staffOps ?? undefined : undefined,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "No se pudo cargar profit.",
      },
      { status: 500 },
    );
  }
}
