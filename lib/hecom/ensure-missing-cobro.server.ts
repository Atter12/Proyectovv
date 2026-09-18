import "server-only";
import { createHecomAdminClient } from "@/lib/hecom/supabase.server";
import {
  missingCobroCodigo,
  normalizePeriodoResumen,
} from "@/lib/payments/missing-cobro.shared";

export type EnsureMissingCobroInput = {
  hecomClienteId: string;
  paymentIntentId: string;
  /** USD bruto del cobro. */
  montoUsd: number;
  periodoResumen: string;
  fecha: string;
  hora?: string | null;
  metodo?: string | null;
  operationCode?: string | null;
  notas?: string | null;
  approvedByEmail?: string | null;
};

export type EnsureMissingCobroResult = {
  ok: boolean;
  created: boolean;
  idempotent: boolean;
  cobroId: string | null;
  codigo: string;
  reason?: string;
};

/**
 * Inserta cobro Hecom para un claim de “pago faltante”.
 * Idempotente por `codigo = C-MISS-{payment_intent_id}`.
 * No toca cartera Holistic.
 */
export async function ensureHecomMissingCobroFromClaim(
  input: EnsureMissingCobroInput,
): Promise<EnsureMissingCobroResult> {
  const codigo = missingCobroCodigo(input.paymentIntentId);
  const periodo = normalizePeriodoResumen(input.periodoResumen);
  if (!periodo) {
    return {
      ok: false,
      created: false,
      idempotent: false,
      cobroId: null,
      codigo,
      reason: "periodo_invalido",
    };
  }

  const monto = Number(input.montoUsd);
  if (!Number.isFinite(monto) || monto < 0.01) {
    return {
      ok: false,
      created: false,
      idempotent: false,
      cobroId: null,
      codigo,
      reason: "monto_invalido",
    };
  }

  const fecha = String(input.fecha ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return {
      ok: false,
      created: false,
      idempotent: false,
      cobroId: null,
      codigo,
      reason: "fecha_invalida",
    };
  }

  const hecom = createHecomAdminClient();

  const { data: existing, error: existingErr } = await hecom
    .from("cobros")
    .select("id, codigo, monto, periodo_resumen")
    .eq("codigo", codigo)
    .maybeSingle();

  if (existingErr) {
    console.error("[missing-cobro] lookup failed", existingErr.message);
    return {
      ok: false,
      created: false,
      idempotent: false,
      cobroId: null,
      codigo,
      reason: existingErr.message,
    };
  }

  if (existing?.id) {
    return {
      ok: true,
      created: false,
      idempotent: true,
      cobroId: String(existing.id),
      codigo,
    };
  }

  const metodo = String(input.metodo ?? "Interbank").trim() || "Interbank";
  const op = String(input.operationCode ?? "").trim();
  const extra = String(input.notas ?? "").trim();
  const by = String(input.approvedByEmail ?? "").trim();
  const notasParts = [
    `Claim Lo pagado · cobro faltante · PI=${input.paymentIntentId}`,
    op ? `op ${op}` : null,
    by ? `aprobado por ${by}` : null,
    extra || null,
  ].filter(Boolean);

  const horaRaw = String(input.hora ?? "").trim();
  const hora = /^\d{2}:\d{2}(:\d{2})?$/.test(horaRaw)
    ? horaRaw.length === 5
      ? `${horaRaw}:00`
      : horaRaw
    : null;

  const row = {
    client_id: input.hecomClienteId,
    gasto_id: null,
    monto: Math.round(monto * 100) / 100,
    fecha,
    hora,
    metodo,
    codigo,
    periodo_resumen: periodo,
    comprobante_urls: [] as string[],
    notas: notasParts.join(" · ").slice(0, 500),
  };

  const { data: inserted, error: insertErr } = await hecom
    .from("cobros")
    .insert(row)
    .select("id, codigo")
    .maybeSingle();

  if (insertErr) {
    // Race: another worker inserted same codigo
    if (/duplicate|unique|already exists/i.test(insertErr.message)) {
      const { data: again } = await hecom
        .from("cobros")
        .select("id")
        .eq("codigo", codigo)
        .maybeSingle();
      return {
        ok: true,
        created: false,
        idempotent: true,
        cobroId: again?.id ? String(again.id) : null,
        codigo,
      };
    }
    console.error("[missing-cobro] insert failed", insertErr.message);
    return {
      ok: false,
      created: false,
      idempotent: false,
      cobroId: null,
      codigo,
      reason: insertErr.message,
    };
  }

  return {
    ok: true,
    created: true,
    idempotent: false,
    cobroId: inserted?.id ? String(inserted.id) : null,
    codigo,
  };
}
