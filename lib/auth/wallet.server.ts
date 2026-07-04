import { siteConfig } from "@/config/site";
import { createClient } from "@/lib/supabase/server";
import type { SessionUser } from "@/types/auth";
import type { Wallet } from "@/types/wallet";

export async function getOrganizationWallet(
  session: SessionUser,
): Promise<Wallet | null> {
  if (!session.organizationId) return null;

  const supabase = await createClient();
  const { data: wallet } = await supabase
    .from("wallets")
    .select("id, name, balance, currency")
    .eq("organization_id", session.organizationId)
    .eq("status", "active")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<{
      id: string;
      name: string;
      balance: number;
      currency: string;
    }>();

  if (!wallet) return null;

  return {
    id: wallet.id,
    name: wallet.name || siteConfig.walletName,
    balance: Number(wallet.balance),
    currency: wallet.currency,
  };
}
