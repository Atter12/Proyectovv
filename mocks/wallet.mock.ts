import type { Wallet } from "@/types/wallet";
import { siteConfig } from "@/config/site";

export const walletMock: Wallet = {
  id: "wallet-default",
  name: siteConfig.walletName,
  balance: 0,
  currency: "USD",
};
