import { cache } from "react";
import { siteConfig } from "@/config/site";
import { createClient } from "@/lib/supabase/server";
import type { SessionUser } from "@/types/auth";
import type { Wallet } from "@/types/wallet";

export const getOrganizationWallet = cache(
  async (session: SessionUser): Promise<Wallet | null> => {
    if (!session.organizationId) return null;

    const supabase = await createClient();
    const [{ data: wallet }, { data: ledgerBalance }] = await Promise.all([
      supabase
        .from("wallets")
        .select("id, name, balance_cents, currency")
        .eq("organization_id", session.organizationId)
        .eq("status", "active")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle<{
          id: string;
          name: string;
          balance_cents: number;
          currency: string;
        }>(),
      supabase
        .from("v_wallet_ledger_balances")
        .select("wallet_id, available_balance_cents, currency")
        .eq("organization_id", session.organizationId)
        .maybeSingle<{
          wallet_id: string;
          available_balance_cents: number;
          currency: string;
        }>(),
    ]);

    if (!wallet && !ledgerBalance) return null;

    return {
      id: ledgerBalance?.wallet_id ?? wallet?.id ?? "pending",
      name: wallet?.name || siteConfig.walletName,
      balance:
        Number(ledgerBalance?.available_balance_cents ?? wallet?.balance_cents ?? 0) / 100,
      currency: ledgerBalance?.currency ?? wallet?.currency ?? "USD",
    };
  },
);
