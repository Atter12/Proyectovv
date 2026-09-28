"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { routes } from "@/config/routes";
import type { AdAccountLiveMetricsClient } from "@/features/ad-accounts/hooks/useAdAccountLiveMetrics";
import { isTikTokBudgetCupoBalance } from "@/features/ad-accounts/lib/classify-tiktok-live-balance";
import { PaymentsGerenteAccountsSummary } from "@/features/payments/components/PaymentsGerenteAccountsSummary.client";
import { PaymentToolbar } from "@/features/payments/components/PaymentToolbar.client";
import { PaymentsTable } from "@/features/payments/components/PaymentsTable";
import { filterPaymentAccounts } from "@/lib/filter/payment-accounts";
import {
  sortPaymentAccounts,
  summarizePaymentAccounts,
  type PaymentAccountSortKey,
} from "@/lib/sort/payment-accounts";
import type { PaymentAccountAllocation } from "@/types/payment";

type CuentasPayload = {
  ok: boolean;
  error?: string;
  accounts?: PaymentAccountAllocation[];
  live?: AdAccountLiveMetricsClient[];
  updatedAt?: string | null;
  liveError?: string | null;
};

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      accounts: PaymentAccountAllocation[];
      live: Record<string, AdAccountLiveMetricsClient>;
      updatedAt: string | null;
    };

/**
 * Pulso de cuentas del cliente elegido en Links deuda (solo lectura).
 * Recargar / Cambiar ID / Recuperar abren Pagos con ese cliente: ahí están
 * los modales de siempre y la sesión queda en el cliente correcto.
 */
export function LinksDeudaCuentas({
  clienteId,
  clienteName,
}: {
  clienteId: string;
  clienteName: string;
}) {
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState<PaymentAccountSortKey>("recommended");
  const [opening, startOpening] = useTransition();
  const [openError, setOpenError] = useState<string | null>(null);

  useEffect(() => {
    // El panel monta este componente con key={clienteId}: cada cliente arranca limpio.
    let cancelled = false;
    fetch(`/api/links-deuda/${encodeURIComponent(clienteId)}/cuentas`, {
      credentials: "include",
      cache: "no-store",
    })
      .then(async (res) => {
        const json = (await res.json()) as CuentasPayload;
        if (cancelled) return;
        if (!res.ok || !json.ok) {
          setState({ status: "error", message: json.error ?? "No se pudieron cargar las cuentas." });
          return;
        }
        const live: Record<string, AdAccountLiveMetricsClient> = {};
        for (const row of json.live ?? []) {
          if (row?.advertiserId) live[row.advertiserId] = row;
        }
        setState({
          status: "ready",
          accounts: json.accounts ?? [],
          live,
          updatedAt: json.updatedAt ?? null,
        });
      })
      .catch(() => {
        if (!cancelled) {
          setState({ status: "error", message: "No se pudieron cargar las cuentas." });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [clienteId]);

  const accounts = useMemo(
    () => (state.status === "ready" ? state.accounts : []),
    [state],
  );
  const live = useMemo(
    () => (state.status === "ready" ? state.live : {}),
    [state],
  );

  const summary = useMemo(() => summarizePaymentAccounts(accounts), [accounts]);

  const liveTotals = useMemo(() => {
    let cash = 0;
    let cupo = 0;
    let cashCount = 0;
    let cupoCount = 0;
    const ids = new Set(
      accounts
        .map((account) => account.externalAccountId?.trim())
        .filter((id): id is string => Boolean(id)),
    );
    for (const id of ids) {
      const metric = live[id];
      if (metric?.balanceUsd == null) continue;
      if (isTikTokBudgetCupoBalance(metric)) {
        cupo += metric.balanceUsd;
        cupoCount += 1;
      } else {
        cash += metric.balanceUsd;
        cashCount += 1;
      }
    }
    const cashTotal = cashCount > 0 ? Math.round(cash * 100) / 100 : null;
    const cupoTotal = cupoCount > 0 ? Math.round(cupo * 100) / 100 : null;
    return {
      cash: cashTotal,
      cupo: cupoTotal,
      total: cashTotal != null || cupoTotal != null ? (cashTotal ?? 0) + (cupoTotal ?? 0) : null,
    };
  }, [accounts, live]);

  const filtered = useMemo(
    () => sortPaymentAccounts(filterPaymentAccounts(accounts, { search, status }), sort),
    [accounts, search, status, sort],
  );

  function openInPagos() {
    setOpenError(null);
    startOpening(async () => {
      try {
        const res = await fetch("/api/clientes/seleccionar", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clienteId, name: clienteName, actAsCliente: false }),
        });
        const json = (await res.json()) as { ok?: boolean; error?: string };
        if (!res.ok || !json.ok) {
          setOpenError(json.error ?? "No se pudo abrir Pagos.");
          return;
        }
        router.push(`${routes.payments}#asignar-saldo`);
        router.refresh();
      } catch {
        setOpenError("No se pudo abrir Pagos.");
      }
    });
  }

  return (
    <div className="overflow-hidden rounded-[22px] bg-white ring-1 ring-[#e8dfd4]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#efe8df] px-4 py-3.5 sm:px-5">
        <div className="min-w-0">
          <p className="text-[14px] font-semibold tracking-[-0.01em] text-[#1a1714]">
            Cuentas del cliente
          </p>
          <p className="mt-0.5 text-[12px] text-[#8a8177]">
            Recargar y los demás cambios se hacen en Pagos con este cliente.
          </p>
        </div>
        <button
          type="button"
          onClick={openInPagos}
          disabled={opening}
          className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full border border-[#e7d3c4] bg-white px-3.5 text-[12px] font-semibold text-[#1a1714] transition hover:border-[#d47840] hover:bg-[#fff8f1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d47840]/40 disabled:opacity-60"
        >
          {opening ? "Abriendo…" : "Gestionar en Pagos"}
          <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" aria-hidden>
            <path d="M5 10h10m-4-4 4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {openError ? (
        <p className="mx-4 mt-3 rounded-xl bg-red-50 px-3 py-2 text-[12px] text-red-700 ring-1 ring-red-200 sm:mx-5" role="alert">
          {openError}
        </p>
      ) : null}

      {state.status === "loading" ? (
        <div className="space-y-2 p-4 sm:p-5" aria-busy>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-[#f5f0ea]" />
            ))}
          </div>
          <div className="h-24 animate-pulse rounded-xl bg-[#faf8f5]" />
        </div>
      ) : state.status === "error" ? (
        <p className="m-4 rounded-2xl bg-[#fcfaf7] px-4 py-6 text-center text-[13px] text-[#9a3412] ring-1 ring-[#efe8df] sm:m-5">
          {state.message}
        </p>
      ) : (
        <>
          <PaymentsGerenteAccountsSummary
            summary={summary}
            liveCreditTotalUsd={liveTotals.total}
            liveCashTotalUsd={liveTotals.cash}
            liveCupoTotalUsd={liveTotals.cupo}
            lastUpdatedAt={state.updatedAt}
          />
          {accounts.length > 0 ? (
            <PaymentToolbar
              search={search}
              status={status}
              onSearchChange={setSearch}
              onStatusChange={setStatus}
              sort={sort}
              onSortChange={setSort}
              agencyBmFunding
            />
          ) : null}
          <PaymentsTable
            accounts={filtered}
            onAllocate={openInPagos}
            onReclaim={openInPagos}
            onTransfer={openInPagos}
            onEditTikTokIds={openInPagos}
            agencyBmFunding
            liveMetricsByAdvertiser={live}
          />
        </>
      )}
    </div>
  );
}
