import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session.server";
import { hasPermission } from "@/lib/auth/permissions";
import { createTikTokAccountForCliente } from "@/lib/hecom/create-tiktok-account-for-cliente.server";
import { getSelectedHecomCliente } from "@/lib/hecom/selected-cliente.server";
import {
  resolveTikTokCreateBmForCliente,
  TIKTOK_SELF_SERVE_CREATE_MAINTENANCE,
} from "@/lib/integrations/tiktok/bc-create-profiles";
import { isRecord } from "@/lib/records";

export const runtime = "nodejs";

/**
 * POST /api/ad-accounts/tiktok/create
 * Body opcional: { bmBucket?: "300"|"200"|"30"|"10" }
 * Callupe y otros overrides de ops fuerzan BM en server.
 */
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "No autenticado." }, { status: 401 });
    }
    if (!hasPermission(session.permissions, "adAccounts:create")) {
      return NextResponse.json({ error: "Permiso denegado." }, { status: 403 });
    }

    if (TIKTOK_SELF_SERVE_CREATE_MAINTENANCE) {
      return NextResponse.json(
        {
          error:
            "La creación de cuentas nuevas está en mantenimiento. Te avisaremos cuando esté lista.",
          code: "TIKTOK_CREATE_MAINTENANCE",
        },
        { status: 503 },
      );
    }

    const selected = await getSelectedHecomCliente(session.id);
    if (!selected?.id) {
      return NextResponse.json(
        { error: "Selecciona un cliente Hecom primero." },
        { status: 400 },
      );
    }

    let requestedBm: string | null = null;
    try {
      const body = (await request.json()) as unknown;
      if (isRecord(body) && body.bmBucket != null) {
        requestedBm = String(body.bmBucket).trim();
      }
    } catch {
      // body vacío OK
    }

    const bmBucket = resolveTikTokCreateBmForCliente(selected.id, requestedBm);

    const result = await createTikTokAccountForCliente({
      hecomClienteId: selected.id,
      userId: session.id,
      bmBucket,
    });

    if (!result.ok && result.needWhatsApp) {
      return NextResponse.json(result, { status: 409 });
    }

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo crear la cuenta.";
    console.error("[api/ad-accounts/tiktok/create]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
