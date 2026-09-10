"use client";

import { useTranslations } from "next-intl";
import { usePaymentsFundingMode } from "./PaymentsFundingModeContext.client";

export function PaymentsAllocateSectionCopy({
  walletBalanceLabel,
  walletBalance,
  clienteName,
}: {
  walletBalanceLabel: string;
  walletBalance: number;
  clienteName?: string;
}) {
  const t = useTranslations("payments");
  const { agencyBmFunding } = usePaymentsFundingMode();

  if (agencyBmFunding) {
    return (
      <>
        <h2 className="text-[1.2rem] font-semibold tracking-[-0.025em] text-[var(--auth-text)]">
          {t("allocate.titleManager")}
        </h2>
        <p className="mt-1.5 max-w-2xl text-[13px] leading-5 text-[var(--auth-text-muted)]">
          {t("allocate.bodyManager", {
            ofClient: clienteName
              ? t("allocate.ofClient", { name: clienteName })
              : "",
          })}
        </p>
      </>
    );
  }

  return (
    <>
      <h2 className="text-[1.2rem] font-semibold tracking-[-0.025em] text-[var(--auth-text)]">
        {t("allocate.titleClient")}
      </h2>
      <p className="mt-1.5 max-w-2xl text-[13px] leading-5 text-[var(--auth-text-muted)]">
        {walletBalance > 0 ? (
          <>{t("allocate.bodyWithBalance")}</>
        ) : (
          <>
            {t("allocate.bodyEmptyBefore", { balance: walletBalanceLabel })}{" "}
            <a
              href="#recargar-saldo"
              className="font-semibold text-[var(--auth-accent)] underline-offset-2 hover:underline"
            >
              {t("allocate.bodyEmptyCta")}
            </a>
            .
          </>
        )}
      </p>
    </>
  );
}
