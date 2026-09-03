"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiClient } from "@/lib/api/api-client.client";

export type AdAccountLiveMetricsClient = {
  advertiserId: string;
  accountName: string;
  bmBucket: string | null;
  balanceUsd: number | null;
  spendTodayUsd: number | null;
  fetchedAt: string;
  error?: string;
  paymentPortfolioType?: string | null;
  budgetMode?: string | null;
  budgetUsd?: number | null;
  budgetCostUsd?: number | null;
  showBudgetLimit?: boolean;
  isUnlimitedBudget?: boolean;
};

const POLL_MS = 45_000;

export type LiveMetricsRefreshOpts = {
  /** Ignora el poll en curso / encola otra pasada al terminar. */
  force?: boolean;
  /** Espera antes de pegarle a TikTok (budget tarda 1–2s en reflejarse). */
  delayMs?: number;
};

export function useAdAccountLiveMetrics(enabled = true) {
  const [metricsByAdvertiser, setMetricsByAdvertiser] = useState<
    Record<string, AdAccountLiveMetricsClient>
  >({});
  const [loading, setLoading] = useState(enabled);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  const pendingForce = useRef(false);

  const refresh = useCallback(
    async (opts?: LiveMetricsRefreshOpts) => {
      if (!enabled) return;

      if (opts?.delayMs && opts.delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, opts.delayMs));
      }

      if (inFlight.current) {
        if (opts?.force) pendingForce.current = true;
        return;
      }

      inFlight.current = true;
      setError(null);
      try {
        const data = await apiClient<{
          ok: boolean;
          accounts: AdAccountLiveMetricsClient[];
          updatedAt: string;
          tiktokConfigured: boolean;
        }>("/api/ad-accounts/live-metrics");

        const next: Record<string, AdAccountLiveMetricsClient> = {};
        for (const row of data.accounts ?? []) {
          next[row.advertiserId] = row;
        }
        setMetricsByAdvertiser(next);
        setLastUpdatedAt(data.updatedAt ?? new Date().toISOString());
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "No se pudo actualizar saldo en vivo.",
        );
      } finally {
        setLoading(false);
        inFlight.current = false;
        if (pendingForce.current) {
          pendingForce.current = false;
          void refresh({ force: true });
        }
      }
    },
    [enabled],
  );

  /** Tras Asignar / Transferir / Recuperar: refresco inmediato + uno diferido. */
  const refreshAfterFundingChange = useCallback(async () => {
    await refresh({ force: true });
    await refresh({ force: true, delayMs: 1500 });
  }, [refresh]);

  useEffect(() => {
    if (!enabled) return;
    void refresh();
    const timer = window.setInterval(() => {
      void refresh();
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [enabled, refresh]);

  return {
    metricsByAdvertiser,
    loading,
    lastUpdatedAt,
    error,
    refresh,
    refreshAfterFundingChange,
    pollSeconds: POLL_MS / 1000,
  };
}
