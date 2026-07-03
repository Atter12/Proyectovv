import { Card } from "@/components/ui/Card";
import { AffiliateBannerStudio } from "./AffiliateBannerStudio.client";
import { AffiliateMilestones } from "./AffiliateMilestones";
import { AffiliateNotes } from "./AffiliateNotes";
import { ReferralLinkCard } from "./ReferralLinkCard.client";
import { ReferralWorkflow } from "./ReferralWorkflow";
import type { AffiliateProgramOverview, AffiliateTabKey } from "@/types/affiliate";

interface AffiliateTabContentProps {
  data: AffiliateProgramOverview;
  tab: AffiliateTabKey;
}

export function AffiliateTabContent({ data, tab }: AffiliateTabContentProps) {
  if (tab === "payments") {
    return (
      <Card className="border-dashed bg-slate-50/50">
        <div className="flex flex-col items-center py-8 text-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[#4056ff]/10 text-[#4056ff]">
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <p className="text-sm font-semibold text-[#0f172a]">
            Pagos de afiliados
          </p>
          <p className="mt-2 max-w-md text-sm text-[#64748b]">
            Tus pagos de afiliados aparecerán aquí cuando generes comisiones. Los
            acreditamos mensualmente en Cartera Default.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      <ReferralWorkflow steps={data.steps} />
      <ReferralLinkCard
        data={{
          referralUrl: data.referralUrl,
          referralCode: data.referralCode,
          stats: data.stats,
        }}
      />
      <AffiliateBannerStudio
        sizes={data.bannerSizes}
        defaultSize={data.selectedBannerSize}
        referralUrl={data.referralUrl}
      />
      <AffiliateMilestones milestones={data.milestones} />
      <AffiliateNotes notes={data.notes} />
    </div>
  );
}
