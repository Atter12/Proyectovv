"use client";

import { useCallback, useEffect, useState } from "react";
import { routes } from "@/config/routes";
import { siteConfig } from "@/config/site";
import { apiClient } from "@/lib/api/api-client.client";
import type { Wallet } from "@/types/wallet";

const WALLET_REFRESH_MS = 30_000;

const FALLBACK_WALLET: Wallet = {
  id: "pending",
  name: siteConfig.walletName,
  balance: 0,
  currency: "USD",
};

interface WalletResponse {
  ok: boolean;
  wallet: Wallet;
}

async function fetchWallet(): Promise<Wallet> {
  try {
    const data = await apiClient<WalletResponse>(routes.api.wallet);
    return data.wallet;
  } catch {
    return FALLBACK_WALLET;
  }
}

export function useWallet() {
  const [wallet, setWallet] = useState<Wallet>(FALLBACK_WALLET);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const nextWallet = await fetchWallet();
    setWallet(nextWallet);
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load(isInitial: boolean) {
      const nextWallet = await fetchWallet();
      if (cancelled) return;
      setWallet(nextWallet);
      if (isInitial) setLoading(false);
    }

    void load(true);
    const interval = setInterval(() => {
      void load(false);
    }, WALLET_REFRESH_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return { wallet, loading, refresh };
}
