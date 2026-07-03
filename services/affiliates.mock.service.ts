import { affiliatesMock } from "@/mocks/affiliates.mock";
import type { AffiliateProgramOverview } from "@/types/affiliate";

export async function getAffiliateProgram(): Promise<AffiliateProgramOverview> {
  return affiliatesMock;
}
