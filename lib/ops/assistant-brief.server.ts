import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createHecomAdminClient } from "@/lib/hecom/supabase.server";
import { todayYmdInTz } from "@/lib/hecom/gasto-date";
import {
  cobranzaBand,
  money,
  round2,
  type AssistantBrief,
  type AssistantCliente,
} from "@/lib/ops/assistant-answer";

const TTL_MS = 90_000;

let cached: { at: number; brief: AssistantBrief } | null = null;

type GastoRow = {
  client_id: string | null;
  gasto: number | null;
  fee: number | null;
  tiktok_stat_date: string | null;
  fecha_movimiento: string | null;
};

type CobroRow = {
  client_id: string | null;
  monto: number | null;
  fecha: string | null;
};

function monthLabel(ym: string): string {
  const [year, month] = ym.split("-").map(Number);
  if (!year || !month) return ym;
  const label = new Intl.DateTimeFormat("es-PE", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function nextMonth(ym: string): string {
  const [year, month] = ym.split("-").map(Number);
  const date = new Date(Date.UTC(year, month, 1));
  return date.toISOString().slice(0, 10);
}

async function fetchAll<T>(
  run: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < 8000; from += 1000) {
    const { data, error } = await run(from, from + 999);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}

function cargoOf(row: GastoRow): number {
  const gasto = Number(row.gasto) || 0;
  const fee = Number(row.fee) || 0;
  return gasto * (1 + fee / 100);
}

function dayKey(row: GastoRow): string {
  return String(row.tiktok_stat_date || row.fecha_movimiento || "").slice(0, 10);
}

export async function loadAssistantBrief(force = false): Promise<AssistantBrief> {
  if (!force && cached && Date.now() - cached.at < TTL_MS) return cached.brief;

  const today = todayYmdInTz("America/Lima");
  const month = today.slice(0, 7);
  const monthStart = `${month}-01`;
  const monthEnd = nextMonth(month);
  const hecom = createHecomAdminClient();

  const [clientesRes, gastos, cobrosMonth, cobrosHoy] = await Promise.all([
    hecom
      .from("clientes")
      .select("id,name,credito_form_slug,cobranza_rango")
      .order("name")
      .limit(2000),
    fetchAll<GastoRow>((from, to) =>
      hecom
        .from("gastos")
        .select("client_id,gasto,fee,tiktok_stat_date,fecha_movimiento")
        .gte("tiktok_stat_date", monthStart)
        .lt("tiktok_stat_date", monthEnd)
        .range(from, to),
    ),
    fetchAll<CobroRow>((from, to) =>
      hecom
        .from("cobros")
        .select("client_id,monto,fecha")
        .eq("periodo_resumen", month)
        .range(from, to),
    ),
    hecom
      .from("cobros")
      .select("client_id,monto,fecha")
      .eq("fecha", today)
      .limit(500),
  ]);

  if (clientesRes.error) throw new Error(clientesRes.error.message);
  if (cobrosHoy.error) throw new Error(cobrosHoy.error.message);

  const names = new Map<string, { name: string; agency: boolean; rango: string | null }>();
  for (const row of clientesRes.data ?? []) {
    const id = String(row.id || "");
    const name = String(row.name || "").trim();
    if (!id || !name) continue;
    names.set(id, {
      name,
      agency: Boolean(String(row.credito_form_slug || "").trim()),
      rango: row.cobranza_rango ? String(row.cobranza_rango).trim() : null,
    });
  }

  const cargo = new Map<string, number>();
  const spendToday = new Map<string, number>();
  for (const row of gastos) {
    const id = String(row.client_id || "");
    if (!id) continue;
    const amount = cargoOf(row);
    cargo.set(id, (cargo.get(id) || 0) + amount);
    if (dayKey(row) === today) {
      spendToday.set(id, (spendToday.get(id) || 0) + amount);
    }
  }

  const paidMonth = new Map<string, number>();
  for (const row of cobrosMonth) {
    const id = String(row.client_id || "");
    if (!id) continue;
    paidMonth.set(id, (paidMonth.get(id) || 0) + (Number(row.monto) || 0));
  }

  const paidToday = new Map<string, number>();
  for (const row of cobrosHoy.data ?? []) {
    const id = String(row.client_id || "");
    if (!id) continue;
    paidToday.set(id, (paidToday.get(id) || 0) + (Number(row.monto) || 0));
  }

  const clientes: AssistantCliente[] = [];
  for (const [id, meta] of names) {
    const cargoMonth = round2(cargo.get(id) || 0);
    const paid = round2(paidMonth.get(id) || 0);
    const debt = round2(Math.max(0, cargoMonth - paid));
    clientes.push({
      name: meta.name,
      agency: meta.agency,
      rango: meta.rango,
      spendToday: round2(spendToday.get(id) || 0),
      paidToday: round2(paidToday.get(id) || 0),
      cargoMonth,
      paidMonth: paid,
      debt,
      band: cobranzaBand({ rango: meta.rango, cargo: cargoMonth, paid }),
    });
  }

  const pagosHoy = [...paidToday.entries()]
    .map(([id, amount]) => ({
      name: names.get(id)?.name || "Cliente",
      amount: round2(amount),
    }))
    .filter((row) => row.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  const activosHoy = [...spendToday.entries()]
    .map(([id, spend]) => ({
      name: names.get(id)?.name || "Cliente",
      spend: round2(spend),
    }))
    .filter((row) => row.spend >= 1)
    .sort((a, b) => b.spend - a.spend);

  const rojos = clientes
    .filter((row) => row.band === "red")
    .sort((a, b) => b.debt - a.debt);

  const credito = clientes
    .filter(
      (row) =>
        (row.band === "green" || (row.agency && row.band !== "red")) &&
        row.debt < 150,
    )
    .sort((a, b) => a.debt - b.debt || b.paidMonth - a.paidMonth);

  let pendingVouchers = 0;
  try {
    const admin = createAdminClient();
    const pending = await admin
      .from("payment_intents")
      .select("id", { count: "exact", head: true })
      .eq("provider", "manual")
      .filter("metadata->>manual_review_status", "eq", "pending_review");
    pendingVouchers = pending.count ?? 0;
  } catch {
    pendingVouchers = 0;
  }

  const alertas: string[] = [];
  if (rojos.length) {
    alertas.push(
      `${rojos.length} en rojo. El más alto: ${rojos[0].name} con deuda ${money(rojos[0].debt)}.`,
    );
  }
  if (pendingVouchers > 0) {
    alertas.push(
      `${pendingVouchers} voucher${pendingVouchers === 1 ? "" : "s"} de pago manual esperando revisión.`,
    );
  }
  const activeInRed = activosHoy.filter((row) =>
    rojos.some((red) => red.name === row.name),
  );
  if (activeInRed.length) {
    alertas.push(
      `${activeInRed.length} siguen gastando hoy estando en rojo: ${activeInRed
        .slice(0, 5)
        .map((row) => row.name)
        .join(", ")}.`,
    );
  }

  const brief: AssistantBrief = {
    today,
    monthLabel: monthLabel(month),
    pagosHoy,
    pagosHoyTotal: round2(pagosHoy.reduce((sum, row) => sum + row.amount, 0)),
    activosHoy,
    rojos,
    credito: credito.slice(0, 20),
    alertas,
    clientes,
    pendingVouchers,
  };
  cached = { at: Date.now(), brief };
  return brief;
}
