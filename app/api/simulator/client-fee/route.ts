import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session.server";
import { resolvePaymentsFundingCapabilities } from "@/lib/payments/funding-roles.server";
import { getActingAsCliente, getSelectedHecomCliente } from "@/lib/hecom/selected-cliente.server";
import { getHecomCliente } from "@/lib/hecom/clientes.server";
import { normalizeFeePercent } from "@/lib/payments/deposit-fee";
import { createAdminClient } from "@/lib/supabase/admin";
import { paymentFeeEvidence, resolveClientFee, summarizeFunding, type FeePayment, type FeeJournal } from "@/lib/business-simulator/client-fee";
export const maxDuration = 60;
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
export async function GET() {
  const session = await getSession();
  if (!session || session.profileStatus !== "active") return reply({ error: "Inicia sesión para consultar el FEE." }, 401);
  const access = await resolvePaymentsFundingCapabilities({ email: session.email, role: session.role });
  if ((!access.isStaff && !access.isSuperAdmin) || await getActingAsCliente(session.id)) return reply({ error: "Consulta disponible solo para gerencia." }, 403);
  const selected = await getSelectedHecomCliente(session.id);
  if (!selected) return reply({ error: "Selecciona un cliente." }, 400);
  try {
    const client = await getHecomCliente(selected.id);
    if (!client) return reply({ error: "No se encontró el cliente." }, 404);
    const admin = createAdminClient();
    const since = new Date(Date.now() - 180 * 86400000).toISOString();
    // Only payment IDs explicitly attributed to the authorized, selected CRM client.
    const payments = await admin.from("payment_intents").select("id,organization_id,amount_cents,currency,provider,status,succeeded_at,metadata")
      .eq("metadata->>hecom_cliente_id", selected.id).eq("status", "succeeded").gte("succeeded_at", since)
      .order("succeeded_at", { ascending: false }).limit(100);
    const rows = (payments.data ?? []) as FeePayment[];
    const journalResult = !payments.error && rows.length ? await admin.from("ledger_journals")
      .select("source_id,organization_id,amount_cents,currency,status").eq("source_table", "payment_intents").eq("journal_type", "deposit_confirmed")
      .in("source_id", rows.map(p=>p.id)).limit(201) : { data: [], error: null };
    const journals = (journalResult.data ?? []) as FeeJournal[];
    const result = resolveClientFee(normalizeFeePercent(client.tiktokDefaultFee), client.tiktokAccounts.map(a=>normalizeFeePercent(a.fee)), payments.error || journalResult.error ? [] : rows.map(p=>paymentFeeEvidence(p,journals)));
    if (payments.error || journalResult.error) result.warnings.push("No se pudo verificar el historial de recargas. El acuerdo configurado se mantiene si existe.");
    return reply({ ...result, funding: payments.error || journalResult.error ? null : summarizeFunding(rows, journals), hecomClienteId: client.id, hecomClienteName: client.name, checkedAt: new Date().toISOString(), historyWindowDays: 180, historyLimit: 100 });
  } catch { return reply({ error: "No se pudo consultar el acuerdo del cliente. Reintenta la carga." }, 502); }
}
