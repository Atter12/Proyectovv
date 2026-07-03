"use client";

import { Card } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import { ReferralStepList } from "./ReferralStepList";
import { ReferralLinkBox } from "./ReferralLinkBox.client";
import { BannerSelector } from "./BannerSelector.client";
import { AffiliateMilestonesTable } from "./AffiliateMilestonesTable";
import { AffiliateNotes } from "./AffiliateNotes";
import type { AffiliateProgram } from "@/types/affiliate";

interface AffiliateContentProps {
  program: AffiliateProgram;
}

export function AffiliateContent({ program }: AffiliateContentProps) {
  const tabs = [
    {
      id: "earn",
      label: "Gana dinero",
      content: (
        <div className="space-y-6">
          <ReferralStepList />
          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">
              Tu enlace de referencia
            </p>
            <ReferralLinkBox link={program.referralLink} />
          </div>
          <BannerSelector sizes={program.bannerSizes} />
          <AffiliateMilestonesTable milestones={program.milestones} />
          <AffiliateNotes notes={program.notes} />
        </div>
      ),
    },
    {
      id: "payments",
      label: "Pagos",
      content: (
        <Card>
          <p className="text-sm text-slate-600">
            Los pagos de comisiones se acreditan mensualmente en tu Cartera
            Default. Aún no tienes pagos pendientes en modo mock.
          </p>
        </Card>
      ),
    },
  ];

  return <Tabs tabs={tabs} />;
}
