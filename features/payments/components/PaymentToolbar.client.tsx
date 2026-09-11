"use client";

import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/Input";
import type { PaymentAccountSortKey } from "@/lib/sort/payment-accounts";

interface PaymentToolbarProps {
  search: string;
  status: string;
  onSearchChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  sort?: PaymentAccountSortKey;
  onSortChange?: (value: PaymentAccountSortKey) => void;
  agencyBmFunding?: boolean;
}

export function PaymentToolbar({
  search,
  status,
  onSearchChange,
  onStatusChange,
  sort = "recommended",
  onSortChange,
  agencyBmFunding = false,
}: PaymentToolbarProps) {
  const t = useTranslations("payments");

  return (
    <div className="border-b border-[var(--auth-border)] bg-[var(--auth-bg)] px-3 py-3 sm:flex sm:flex-row sm:items-center sm:gap-3 sm:px-5 sm:py-3.5">
      <p className="mb-2.5 text-[12px] leading-5 text-[var(--auth-text-muted)] sm:hidden">
        {t("toolbar.hintBefore")}{" "}
        <span className="font-semibold text-[var(--auth-text)]">
          {agencyBmFunding
            ? t("assignmentTable.reload")
            : t("assignmentTable.assignBalance")}
        </span>{" "}
        {t("toolbar.hintAfter")}
      </p>
      <div className="flex flex-col gap-2 sm:flex-1 sm:flex-row sm:items-center sm:gap-3">
        <div className="w-full sm:max-w-xs sm:flex-1">
          <label htmlFor="payment-account-search" className="sr-only">
            {t("toolbar.search")}
          </label>
          <Input
            id="payment-account-search"
            placeholder={t("toolbar.search")}
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-11 w-full border-[var(--auth-border)] bg-white text-[13px]"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:contents">
          <label htmlFor="payment-account-status" className="sr-only">
            {t("toolbar.filterStatus")}
          </label>
          <select
            id="payment-account-status"
            value={status}
            onChange={(e) => onStatusChange(e.target.value)}
            className="h-11 w-full min-w-0 rounded-xl border border-[var(--auth-border)] bg-white px-2.5 text-[12px] text-[var(--auth-text)] focus:border-[var(--auth-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--auth-accent)]/15 sm:w-auto sm:px-3 sm:text-[13px]"
          >
            <option value="all">{t("toolbar.statusAll")}</option>
            <option value="active">{t("toolbar.statusActive")}</option>
            <option value="pending">{t("toolbar.statusPending")}</option>
            <option value="disabled">{t("toolbar.statusDisabled")}</option>
          </select>
          {onSortChange ? (
            <>
              <label htmlFor="payment-account-sort" className="sr-only">
                {t("toolbar.sortLabel")}
              </label>
              <select
                id="payment-account-sort"
                value={sort}
                onChange={(e) =>
                  onSortChange(e.target.value as PaymentAccountSortKey)
                }
                className="h-11 w-full min-w-0 rounded-xl border border-[var(--auth-border)] bg-white px-2.5 text-[12px] text-[var(--auth-text)] focus:border-[var(--auth-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--auth-accent)]/15 sm:w-auto sm:px-3 sm:text-[13px]"
              >
                <option value="recommended">{t("toolbar.sortRecommended")}</option>
                <option value="bm">{t("toolbar.sortBm")}</option>
                <option value="name">{t("toolbar.sortName")}</option>
                <option value="ledger_desc">{t("toolbar.sortLedgerDesc")}</option>
                <option value="ledger_asc">{t("toolbar.sortLedgerAsc")}</option>
              </select>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
