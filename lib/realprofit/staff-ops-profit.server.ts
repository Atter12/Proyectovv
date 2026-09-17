import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveOrganizationIdForHecomCliente } from "@/lib/hecom/resolve-cliente-organization.server";
import { getWalletLedgerBalance } from "@/lib/ledger/ledger.server";
import type { BurnRateSignal } from "@/lib/realprofit/burn-rate-signals.server";

export type ProfitStaffOps = {
  walletAvailableUsd: number | null;
  adLedgerAvailableUsd: number;
  accountsWithLedgerBalance: number;
  lastAllocation: {
    accountLabel: string;
    amountUsd: number;
    hoursAgo: number;
    at: string;
  } | null;
  burn: {
    critical: number;
    warn: number;
    info: number;
    status: "critical" | "warn" | "info" | "none";
  };
  creditHint: string;
};

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function hoursBetween(fromIso: string, to = new Date()): number {
  const fromMs = new Date(fromIso).getTime();
  if (!Number.isFinite(fromMs)) return 0;
  return Math.max(0, (to.getTime() - fromMs) / 3_600_000);
}

/**
 * Bloque solo gerencia: cartera, última asignación y lectura de crédito.
 */
export async function loadProfitStaffOps(input: {
  hecomClienteId: string;
  spendTodayUsd: number;
  pacingLabel: string;
  burnSignals: BurnRateSignal[];
}): Promise<ProfitStaffOps> {
  const hecomClienteId = input.hecomClienteId.trim();
  const empty: ProfitStaffOps = {
    walletAvailableUsd: null,
    adLedgerAvailableUsd: 0,
    accountsWithLedgerBalance: 0,
    lastAllocation: null,
    burn: { critical: 0, warn: 0, info: 0, status: "none" },
    creditHint: "Sin org Holistic vinculada — no hay ledger de cartera.",
  };
  if (!hecomClienteId) return empty;

  const organizationId =
    await resolveOrganizationIdForHecomCliente(hecomClienteId);
  if (!organizationId) return empty;

  const admin = createAdminClient();
  const wallet = await getWalletLedgerBalance(organizationId).catch(() => null);

  const { data: accounts } = await admin
    .from("ad_accounts")
    .select("id, name, external_account_id")
    .eq("organization_id", organizationId)
    .eq("platform", "tiktok")
    .eq("metadata->>hecom_cliente_id", hecomClienteId)
    .limit(30);

  const rows = (accounts ?? []) as Array<{
    id: string;
    name: string | null;
    external_account_id: string | null;
  }>;

  let adLedgerAvailableUsd = 0;
  let accountsWithLedgerBalance = 0;
  let lastAllocation: ProfitStaffOps["lastAllocation"] = null;

  for (const account of rows) {
    const { data: bal } = await admin
      .from("v_ad_account_ledger_balances")
      .select("available_balance_cents")
      .eq("ad_account_id", account.id)
      .maybeSingle<{ available_balance_cents: number }>();
    const avail = Math.max(0, Number(bal?.available_balance_cents) || 0);
    if (avail > 0) {
      accountsWithLedgerBalance += 1;
      adLedgerAvailableUsd += avail / 100;
    }

    const { data: alloc } = await admin
      .from("ledger_journals")
      .select("amount_cents, created_at, status")
      .eq("organization_id", organizationId)
      .eq("journal_type", "allocation_to_ad_account")
      .eq("source_table", "ad_accounts")
      .eq("source_id", account.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<{
        amount_cents: number;
        created_at: string;
        status: string;
      }>();

    if (!alloc?.created_at) continue;
    if (String(alloc.status ?? "").toLowerCase() === "reversed") continue;

    const hoursAgo = hoursBetween(alloc.created_at);
    if (
      !lastAllocation ||
      hoursAgo < lastAllocation.hoursAgo
    ) {
      lastAllocation = {
        accountLabel:
          String(account.name ?? "").trim() ||
          account.external_account_id ||
          "cuenta ads",
        amountUsd: round2((Number(alloc.amount_cents) || 0) / 100),
        hoursAgo: round2(hoursAgo),
        at: alloc.created_at,
      };
    }
  }

  const burn = {
    critical: input.burnSignals.filter((s) => s.severity === "critical").length,
    warn: input.burnSignals.filter((s) => s.severity === "warn").length,
    info: input.burnSignals.filter((s) => s.severity === "info").length,
    status: (input.burnSignals.some((s) => s.severity === "critical")
      ? "critical"
      : input.burnSignals.some((s) => s.severity === "warn")
        ? "warn"
        : input.burnSignals.length > 0
          ? "info"
          : "none") as ProfitStaffOps["burn"]["status"],
  };

  let creditHint: string;
  if (burn.status === "critical") {
    creditHint =
      "Riesgo alto: quema de saldo crítica tras asignar. Evita ampliar crédito hasta ver pacing.";
  } else if (burn.status === "warn") {
    creditHint =
      "Ojo: está quemando asignación más rápido de lo normal. Revisa antes de dar más cupo.";
  } else if (!lastAllocation) {
    creditHint =
      "Sin asignaciones Holistic recientes — no hay señal de quema (burn_rate). El gasto viejo puede ser crédito BM previo.";
  } else if (input.spendTodayUsd <= 0) {
    creditHint =
      "Sin gasto hoy: no hay quema activa. Las señales info (silent/concentration) son del ranking, no de crédito urgente.";
  } else if (input.pacingLabel === "acelerando") {
    creditHint =
      "Pacing alto hoy vs 7d. Vigilar saldo asignado; aún sin alerta burn_rate dura.";
  } else {
    creditHint =
      "Sin alerta de quema. Criterio de crédito: mirar pacing + concentración + historial de deuda aparte.";
  }

  return {
    walletAvailableUsd: wallet
      ? round2(wallet.availableBalanceCents / 100)
      : null,
    adLedgerAvailableUsd: round2(adLedgerAvailableUsd),
    accountsWithLedgerBalance,
    lastAllocation,
    burn,
    creditHint,
  };
}
