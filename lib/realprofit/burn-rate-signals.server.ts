import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveOrganizationIdForHecomCliente } from "@/lib/hecom/resolve-cliente-organization.server";

export type BurnRateSignal = {
  kind: "burn_rate";
  severity: "info" | "warn" | "critical";
  title: string;
  detail: string;
};

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function hoursBetween(fromIso: string, to = new Date()): number {
  const fromMs = new Date(fromIso).getTime();
  if (!Number.isFinite(fromMs)) return 0;
  return Math.max(0, (to.getTime() - fromMs) / 3_600_000);
}

function formatHours(h: number): string {
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min`;
  if (h < 10) return `${h.toFixed(1)} h`;
  return `${Math.round(h)} h`;
}

function moneyUsd(cents: number): string {
  return `$${round2(cents / 100).toFixed(2)}`;
}

/**
 * Alerta gerencia: saldo quemado rápido tras la última asignación Holistic.
 * Usa ledger (allocation_to_ad_account + available + ad_spend_transactions).
 */
export async function buildBurnRateSignalsForCliente(input: {
  hecomClienteId: string;
  spendTodayUsd: number;
}): Promise<BurnRateSignal[]> {
  const hecomClienteId = input.hecomClienteId.trim();
  if (!hecomClienteId) return [];

  const organizationId =
    await resolveOrganizationIdForHecomCliente(hecomClienteId);
  if (!organizationId) return [];

  const admin = createAdminClient();

  const { data: accounts } = await admin
    .from("ad_accounts")
    .select("id, name, external_account_id")
    .eq("organization_id", organizationId)
    .eq("platform", "tiktok")
    .eq("metadata->>hecom_cliente_id", hecomClienteId)
    .limit(20);

  const rows = (accounts ?? []) as Array<{
    id: string;
    name: string | null;
    external_account_id: string | null;
  }>;
  if (rows.length === 0) return [];

  const signals: BurnRateSignal[] = [];

  for (const account of rows) {
    const { data: lastAlloc } = await admin
      .from("ledger_journals")
      .select("id, amount_cents, created_at, status")
      .eq("organization_id", organizationId)
      .eq("journal_type", "allocation_to_ad_account")
      .eq("source_table", "ad_accounts")
      .eq("source_id", account.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<{
        id: string;
        amount_cents: number;
        created_at: string;
        status: string;
      }>();

    if (!lastAlloc?.created_at) continue;
    if (String(lastAlloc.status ?? "").toLowerCase() === "reversed") continue;

    const allocCents = Math.max(0, Number(lastAlloc.amount_cents) || 0);
    if (allocCents <= 0) continue;

    const hoursElapsed = hoursBetween(lastAlloc.created_at);
    // Asignaciones muy viejas: solo miramos vaciado inminente / saldo 0.
    const recentAlloc = hoursElapsed <= 48;

    const { data: balance } = await admin
      .from("v_ad_account_ledger_balances")
      .select("available_balance_cents")
      .eq("ad_account_id", account.id)
      .maybeSingle<{ available_balance_cents: number }>();

    const availableCents = Math.max(
      0,
      Number(balance?.available_balance_cents) || 0,
    );

    const { data: spendRows } = await admin
      .from("ad_spend_transactions")
      .select("amount_cents")
      .eq("ad_account_id", account.id)
      .gte("occurred_at", lastAlloc.created_at)
      .limit(500);

    const spendFromTx = (spendRows ?? []).reduce(
      (sum, row) => sum + Math.max(0, Number(row.amount_cents) || 0),
      0,
    );

    let spentCents = spendFromTx;
    if (spentCents <= 0) {
      // Fallback: lo asignado menos lo que queda (si no hay sync de spend al ledger).
      spentCents = Math.max(0, allocCents - availableCents);
      // Si la asignación fue hoy y hay spend Holistic del día, no subestimar.
      const spendTodayCents = Math.round(
        Math.max(0, input.spendTodayUsd) * 100,
      );
      if (hoursElapsed <= 24 && spendTodayCents > spentCents) {
        spentCents = Math.min(allocCents, spendTodayCents);
      }
    }

    const label =
      String(account.name ?? "").trim() ||
      account.external_account_id ||
      "cuenta ads";
    const burnedPct = allocCents > 0 ? spentCents / allocCents : 0;
    const hoursSafe = Math.max(hoursElapsed, 0.25);
    const burnPerHour = spentCents / hoursSafe;
    const hoursToEmpty =
      availableCents > 0 && burnPerHour > 0
        ? availableCents / burnPerHour
        : null;

    if (availableCents <= 0 && (spentCents > 0 || input.spendTodayUsd > 0)) {
      signals.push({
        kind: "burn_rate",
        severity: "info",
        title: `${label}: saldo en $0`,
        detail: `Tras asignar ${moneyUsd(allocCents)}, ya no queda disponible en cartera Holistic.`,
      });
      continue;
    }

    if (recentAlloc && burnedPct >= 0.8 && hoursElapsed < 3) {
      signals.push({
        kind: "burn_rate",
        severity: "critical",
        title: `${label}: quemó ${(burnedPct * 100).toFixed(0)}% en ${formatHours(hoursElapsed)}`,
        detail: `Gastó ${moneyUsd(spentCents)} de ${moneyUsd(allocCents)} asignados. Ritmo crítico.`,
      });
      continue;
    }

    if (hoursToEmpty != null && hoursToEmpty < 2 && burnedPct >= 0.25) {
      signals.push({
        kind: "burn_rate",
        severity: "critical",
        title: `${label}: saldo se vacía en ~${formatHours(hoursToEmpty)}`,
        detail: `Quedan ${moneyUsd(availableCents)} · ya gastó ${moneyUsd(spentCents)} desde la última asignación.`,
      });
      continue;
    }

    if (recentAlloc && burnedPct >= 0.5 && hoursElapsed < 6) {
      signals.push({
        kind: "burn_rate",
        severity: "warn",
        title: `${label}: quemó ${(burnedPct * 100).toFixed(0)}% en ${formatHours(hoursElapsed)}`,
        detail: `Gastó ${moneyUsd(spentCents)} de ${moneyUsd(allocCents)}. Revisa pacing antes de que se agote.`,
      });
    }
  }

  const rank = (s: BurnRateSignal) =>
    s.severity === "critical" ? 0 : s.severity === "warn" ? 1 : 2;
  return signals.sort((a, b) => rank(a) - rank(b)).slice(0, 4);
}
