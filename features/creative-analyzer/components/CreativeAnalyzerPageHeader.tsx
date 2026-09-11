import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/Badge";
import { DashboardPageIntro } from "@/components/layout/DashboardPageIntro";

export async function CreativeAnalyzerPageHeader() {
  const t = await getTranslations("creatives");
  return (
    <DashboardPageIntro
      description={t("pageHeader.description")}
      badges={
        <>
          <Badge variant="info" className="px-3 py-1">
            {t("pageHeader.badgeLab")}
          </Badge>
          <Badge variant="default" className="px-3 py-1">
            {t("pageHeader.badgeSample")}
          </Badge>
        </>
      }
    />
  );
}
