import { adAccountsOverviewMock } from "@/mocks/ad-accounts.mock";
import type { AdAccountsOverview } from "@/types/ad-account";

export async function getAdAccountsOverview(): Promise<AdAccountsOverview> {
  return adAccountsOverviewMock;
}

/** @deprecated Use getAdAccountsOverview instead */
export async function getAdAccounts() {
  const overview = await getAdAccountsOverview();
  return overview.accounts;
}
