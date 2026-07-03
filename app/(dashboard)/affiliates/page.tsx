import { AffiliateHero } from "@/features/affiliates/components/AffiliateHero";
import { AffiliateContent } from "@/features/affiliates/components/AffiliateContent.client";
import { getAffiliateProgram } from "@/services/affiliates.mock.service";

export default async function AffiliatesPage() {
  const program = await getAffiliateProgram();

  return (
    <div className="space-y-6">
      <AffiliateHero />
      <AffiliateContent program={program} />
    </div>
  );
}
