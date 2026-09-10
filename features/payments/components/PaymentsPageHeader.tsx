import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/Badge";
import { DashboardPageIntro } from "@/components/layout/DashboardPageIntro";
import { PaymentsOpenAddBalanceButton } from "./PaymentsOpenAddBalanceButton.client";

export async function PaymentsPageHeader() {
  const t = await getTranslations("payments");

  return (
    <DashboardPageIntro
      description={t("header.description")}
      badges={
        <Badge variant="info" className="px-3 py-1">
          {t("header.sampleBadge")}
        </Badge>
      }
      actions={
        <PaymentsOpenAddBalanceButton className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-[var(--brand-primary)] px-5 text-[14px] font-semibold text-white shadow-sm transition-colors hover:bg-[var(--brand-primary-deep)] sm:h-10 sm:w-auto">
          {t("header.addBalance")}
        </PaymentsOpenAddBalanceButton>
      }
    />
  );
}
