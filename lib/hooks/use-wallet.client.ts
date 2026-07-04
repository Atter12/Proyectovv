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

export function useWallet() {
  const [wallet, setWallet] = useState<Wallet>(FALLBACK_WALLET);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await apiClient<WalletResponse>(routes.api.wallet);
      setWallet(data.wallet);
    } catch {
      setWallet(FALLBACK_WALLET);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const interval = setInterval(() => {
      void refresh();
    }, WALLET_REFRESH_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  return { wallet, loading, refresh };
}
