import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveOrganizationIdForHecomCliente } from "@/lib/hecom/resolve-cliente-organization.server";
import { getWalletLedgerBalance } from "@/lib/ledger/ledger.server";
import type { BurnRateSignal } from "@/lib/realprofit/burn-rate-signals.server";
import {
  computeClienteScore,
  type ClienteScore,
  type ClienteScoreInput,
} from "@/lib/realprofit/client-score";

export type ProfitStaffCollections = {
  failed45d: number | null;
  intents45d: number | null;
  openTickets: number | null;
};

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
  collections: ProfitStaffCollections;
  /** null solo si el loader falló antes de poder armar el score. */
  score: ClienteScore | null;
};

type ScoreSlice = Omit<
  ClienteScoreInput,
  "burnStatus" | "failedPayments45d" | "paymentIntents45d" | "openTickets"
>;

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function hoursBetween(fromIso: string, to = new Date()): number {
  const fromMs = new Date(fromIso).getTime();
  if (!Number.isFinite(fromMs)) return 0;
  return Math.max(0, (to.getTime() - fromMs) / 3_600_000);
}

const emptyCollections: ProfitStaffCollections = {
  failed45d: null,
  intents45d: null,
  openTickets: null,
};

function withScore(
  ops: Omit<ProfitStaffOps, "score">,
  score: ScoreSlice,
): ProfitStaffOps {
  return {
    ...ops,
    score: computeClienteScore({
      ...score,
      burnStatus: ops.burn.status,
      failedPayments45d: ops.collections.failed45d,
      paymentIntents45d: ops.collections.intents45d,
      openTickets: ops.collections.openTickets,
    }),
  };
}

function emptyOps(hint: string, score: ScoreSlice): ProfitStaffOps {
  return withScore(
    {
      walletAvailableUsd: null,
      adLedgerAvailableUsd: 0,
      accountsWithLedgerBalance: 0,
      lastAllocation: null,
      burn: { critical: 0, warn: 0, info: 0, status: "none" },
      creditHint: hint,
      collections: emptyCollections,
    },
    score,
  );
}

/**
 * Bloque solo gerencia: cartera, última asignación y lectura de crédito.
 * Queries en paralelo (sin N+1) para no tumbar el /api/profit.
 */
export async function loadProfitStaffOps(input: {
  hecomClienteId: string;
  spendTodayUsd: number;
  pacingLabel: string;
  burnSignals: BurnRateSignal[];
  score: ScoreSlice;
}): Promise<ProfitStaffOps> {
  const hecomClienteId = input.hecomClienteId.trim();
  if (!hecomClienteId) {
    return emptyOps(
      "Sin cliente Hecom — no hay ledger de cartera.",
      input.score,
    );
  }

  try {
    const organizationId =
      await resolveOrganizationIdForHecomCliente(hecomClienteId);
    if (!organizationId) {
      return emptyOps(
        "Sin org Holistic vinculada — no hay ledger de cartera para este cliente.",
        input.score,
      );
    }

    const admin = createAdminClient();
    const since45d = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString();

    const [{ data: accounts }, wallet, paymentsRes, ticketsRes] =
      await Promise.all([
      admin
        .from("ad_accounts")
        .select("id, name, external_account_id")
        .eq("organization_id", organizationId)
        .eq("platform", "tiktok")
        .eq("metadata->>hecom_cliente_id", hecomClienteId)
        .limit(40),
      getWalletLedgerBalance(organizationId).catch(() => null),
      admin
        .from("payment_intents")
        .select("status")
        .eq("organization_id", organizationId)
        .gte("created_at", since45d)
        .limit(150),
      admin
        .from("support_tickets")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", organizationId)
        .in("status", ["open", "pending"]),
    ]);

    let collections: ProfitStaffCollections = { ...emptyCollections };
    if (!paymentsRes.error) {
      const rows = (paymentsRes.data ?? []) as Array<{ status?: string }>;
      const failed = rows.filter((row) => {
        const status = String(row.status ?? "").toLowerCase();
        return status === "failed" || status === "cancelled";
      }).length;
      collections = {
        ...collections,
        failed45d: failed,
        intents45d: rows.length,
      };
    }
    if (!ticketsRes.error) {
      collections = {
        ...collections,
        openTickets: ticketsRes.count ?? 0,
      };
    }

    const rows = (accounts ?? []) as Array<{
      id: string;
      name: string | null;
      external_account_id: string | null;
    }>;
    const ids = rows.map((r) => r.id);
    const labelById = new Map(
      rows.map((r) => [
        r.id,
        String(r.name ?? "").trim() ||
          r.external_account_id ||
          "cuenta ads",
      ]),
    );

    let adLedgerAvailableUsd = 0;
    let accountsWithLedgerBalance = 0;
    let lastAllocation: ProfitStaffOps["lastAllocation"] = null;

    if (ids.length > 0) {
      const [{ data: balances }, { data: allocs }] = await Promise.all([
        admin
          .from("v_ad_account_ledger_balances")
          .select("ad_account_id, available_balance_cents")
          .in("ad_account_id", ids),
        admin
          .from("ledger_journals")
          .select("source_id, amount_cents, created_at, status")
          .eq("organization_id", organizationId)
          .eq("journal_type", "allocation_to_ad_account")
          .eq("source_table", "ad_accounts")
          .in("source_id", ids)
          .order("created_at", { ascending: false })
          .limit(80),
      ]);

      for (const bal of balances ?? []) {
        const avail = Math.max(
          0,
          Number(
            (bal as { available_balance_cents?: number })
              .available_balance_cents,
          ) || 0,
        );
        if (avail > 0) {
          accountsWithLedgerBalance += 1;
          adLedgerAvailableUsd += avail / 100;
        }
      }

      for (const raw of allocs ?? []) {
        const alloc = raw as {
          source_id: string;
          amount_cents: number;
          created_at: string;
          status: string;
        };
        if (String(alloc.status ?? "").toLowerCase() === "reversed") continue;
        if (!alloc.created_at) continue;
        const hoursAgo = hoursBetween(alloc.created_at);
        if (!lastAllocation || hoursAgo < lastAllocation.hoursAgo) {
          lastAllocation = {
            accountLabel: labelById.get(alloc.source_id) || "cuenta ads",
            amountUsd: round2((Number(alloc.amount_cents) || 0) / 100),
            hoursAgo: round2(hoursAgo),
            at: alloc.created_at,
          };
        }
      }
    }

    const burn = {
      critical: input.burnSignals.filter((s) => s.severity === "critical")
        .length,
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
        "Sin asignaciones Holistic recientes — no hay señal de quema (burn_rate). El gasto puede venir de crédito BM / saldo TikTok previo.";
    } else if (input.spendTodayUsd <= 0) {
      creditHint =
        "Sin gasto Holistic de hoy en snapshots. Si el live de arriba muestra gasto, prioriza ese número para crédito.";
    } else if (input.pacingLabel === "acelerando") {
      creditHint =
        "Pacing alto hoy vs 7d. Vigilar saldo asignado; aún sin alerta burn_rate dura.";
    } else {
      creditHint =
        "Sin alerta de quema. Para crédito mira pacing + concentración + deuda Hecom aparte.";
    }

    return withScore(
      {
        walletAvailableUsd: wallet
          ? round2(wallet.availableBalanceCents / 100)
          : null,
        adLedgerAvailableUsd: round2(adLedgerAvailableUsd),
        accountsWithLedgerBalance,
        lastAllocation,
        burn,
        creditHint,
        collections,
      },
      input.score,
    );
  } catch (error) {
    console.error("[profit-staff-ops] failed", {
      hecomClienteId,
      message: error instanceof Error ? error.message : String(error),
    });
    return emptyOps(
      "No se pudo leer el ledger ahora. Usa el gasto live de arriba para decidir.",
      input.score,
    );
  }
}
