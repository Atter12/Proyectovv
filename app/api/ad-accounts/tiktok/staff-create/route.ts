import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session.server";
import { isHecomOtpStaffEmail } from "@/lib/auth/hecom-otp.server";
import { isPaymentsSuperAdminEmail } from "@/lib/payments/funding-roles.server";
import { getSelectedHecomCliente } from "@/lib/hecom/selected-cliente.server";
import {
  detectClienteTikTokUsers,
  staffCreateTikTokAccounts,
} from "@/lib/hecom/staff-create-tiktok-accounts.server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isRecord } from "@/lib/records";

export const runtime = "nodejs";
export const maxDuration = 120;

/** Solo gerencia de verdad (correo staff), nunca un cliente ni el modo tester. */
async function requireStaff() {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ error: "No autenticado." }, { status: 401 }) };
  const email = String(session.email ?? "");
  if (!isHecomOtpStaffEmail(email) && !isPaymentsSuperAdminEmail(email)) {
    return { error: NextResponse.json({ error: "Solo gerencia puede crear cuentas aquí." }, { status: 403 }) };
  }
  const selected = await getSelectedHecomCliente(session.id);
  if (!selected?.id) {
    return { error: NextResponse.json({ error: "Selecciona un cliente primero." }, { status: 400 }) };
  }
  return { session, selected };
}

/** GET: usuarios de TikTok del cliente (para darles acceso a las cuentas nuevas). */
export async function GET() {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;
  try {
    const users = await detectClienteTikTokUsers(auth.selected.id);
    return NextResponse.json({ clienteId: auth.selected.id, users });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo leer TikTok." }, { status: 500 });
  }
}

/** POST { bmBucket, count, accessUserIds[] } */
export async function POST(request: Request) {
  const auth = await requireStaff();
  if ("error" in auth) return auth.error;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }
  if (!isRecord(body)) return NextResponse.json({ error: "JSON inválido." }, { status: 400 });

  try {
    const result = await staffCreateTikTokAccounts({
      hecomClienteId: auth.selected.id,
      bmBucket: String(body.bmBucket ?? ""),
      count: Number(body.count ?? 1),
      accessUserIds: Array.isArray(body.accessUserIds) ? body.accessUserIds.map(String) : [],
      actorUserId: auth.session.id,
    });
    await createAdminClient()
      .from("audit_logs")
      .insert({
        action: "tiktok.staff_create_accounts",
        entity_type: "ad_accounts",
        metadata: {
          by: auth.session.email,
          hecom_cliente_id: auth.selected.id,
          hecom_cliente_name: auth.selected.name,
          bm: String(body.bmBucket ?? ""),
          created: result.created,
          error: result.error,
        },
      })
      .then(() => undefined, () => undefined);
    return NextResponse.json(result, { status: result.created.length || !result.error ? 200 : 502 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo crear." }, { status: 400 });
  }
}
