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
};

const POLL_MS = 45_000;

export function useAdAccountLiveMetrics(enabled = true) {
  const [metricsByAdvertiser, setMetricsByAdvertiser] = useState<
    Record<string, AdAccountLiveMetricsClient>
  >({});
  const [loading, setLoading] = useState(enabled);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (!enabled || inFlight.current) return;
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
        err instanceof Error ? err.message : "No se pudo actualizar saldo en vivo.",
      );
    } finally {
      setLoading(false);
      inFlight.current = false;
    }
  }, [enabled]);

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
    pollSeconds: POLL_MS / 1000,
  };
}
