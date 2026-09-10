"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { DashboardModalShell } from "@/components/ui/DashboardModalShell.client";
import { apiClient, ApiClientError } from "@/lib/api/api-client.client";
import { routes } from "@/config/routes";
import type { AdAccountPlatform } from "@/types/ad-account";

interface CreateAdAccountModalProps {
  open: boolean;
  onClose: () => void;
}

const MAX_NAME_LENGTH = 120;
const MAX_BC_ID_LENGTH = 64;

export function CreateAdAccountModal({ open, onClose }: CreateAdAccountModalProps) {
  const t = useTranslations("adAccounts");
  const tCommon = useTranslations("common");
  const [accountName, setAccountName] = useState("");
  const [platform, setPlatform] = useState<AdAccountPlatform>("meta");
  const [bcId, setBcId] = useState("");
  const [externalAccountId, setExternalAccountId] = useState("");
  const [externalAccountName, setExternalAccountName] = useState("");
  const [timezone, setTimezone] = useState("America/Lima");
  const [dailyBudget, setDailyBudget] = useState("");
  const [monthlyLimit, setMonthlyLimit] = useState("");
  const [autoRechargeEnabled, setAutoRechargeEnabled] = useState(false);
  const [rechargeThreshold, setRechargeThreshold] = useState("");
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const platforms: { value: AdAccountPlatform; label: string }[] = [
    { value: "meta", label: "Meta" },
    { value: "tiktok", label: "TikTok" },
    { value: "google", label: "Google" },
    { value: "linkedin", label: "LinkedIn" },
    { value: "other", label: t("createModal.other") },
  ];

  function resetForm() {
    setStep("form");
    setAccountName("");
    setPlatform("meta");
    setBcId("");
    setExternalAccountId("");
    setExternalAccountName("");
    setTimezone("America/Lima");
    setDailyBudget("");
    setMonthlyLimit("");
    setAutoRechargeEnabled(false);
    setRechargeThreshold("");
    setError(null);
    setLoading(false);
  }

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [onClose]);

  if (!open) return null;

  const displayName = accountName.trim() || t("createModal.defaultName");
  const displayBcId = bcId.trim() || "Manual/Demo";

  function parseAmount(value: string): number | undefined {
    if (!value.trim()) return undefined;
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
  }

  function validateBeforeConfirm() {
    if (!displayName.trim()) {
      setError(t("createModal.nameRequired"));
      return;
    }
    setError(null);
    setStep("confirm");
  }

  async function handleCreate() {
    setLoading(true);
    setError(null);

    try {
      await apiClient(routes.api.adAccounts, {
        method: "POST",
        body: JSON.stringify({
          name: displayName,
          platform,
          externalBusinessId: bcId.trim() || undefined,
          externalAccountId: externalAccountId.trim() || undefined,
          externalAccountName: externalAccountName.trim() || undefined,
          timezone,
          dailyBudget: parseAmount(dailyBudget),
          monthlyLimit: parseAmount(monthlyLimit),
          autoRechargeEnabled,
          rechargeThreshold: parseAmount(rechargeThreshold),
        }),
      });
      handleClose();
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : t("createModal.createError"),
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <DashboardModalShell open={open} onClose={handleClose} maxWidthClassName="max-w-lg">
      {step === "form" ? (
        <>
          <h2 id="create-account-title" className="text-lg font-semibold text-[var(--foreground)]">
            {t("createModal.title")}
          </h2>
          <p className="mt-1 text-sm text-[var(--admin-text-muted,#64748b)]">
            Configura una cuenta manual/demo o deja lista la información de vinculación externa.
          </p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-medium text-[var(--admin-text-muted,#64748b)]">
                {t("createModal.name")}
              </label>
              <Input
                placeholder={t("createModal.defaultName")}
                value={accountName}
                maxLength={MAX_NAME_LENGTH}
                onChange={(e) => setAccountName(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--admin-text-muted,#64748b)]">
                {t("createModal.platform")}
              </label>
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value as AdAccountPlatform)}
                className="h-10 w-full rounded-xl border border-[var(--border-subtle)] bg-white/90 px-3.5 text-sm focus:border-[var(--brand-primary)]/55 focus:outline-none focus:ring-4 focus:ring-[var(--brand-primary)]/10"
              >
                {platforms.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--admin-text-muted,#64748b)]">
                {t("createModal.timezone")}
              </label>
              <Input
                value={timezone}
                maxLength={80}
                onChange={(e) => setTimezone(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--admin-text-muted,#64748b)]">
                {t("createModal.bcId")}
              </label>
              <Input
                placeholder="BC-0001"
                value={bcId}
                maxLength={MAX_BC_ID_LENGTH}
                onChange={(e) => setBcId(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--admin-text-muted,#64748b)]">
                {t("createModal.externalId")}
              </label>
              <Input
                placeholder={tCommon("optional")}
                value={externalAccountId}
                maxLength={MAX_BC_ID_LENGTH}
                onChange={(e) => setExternalAccountId(e.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-medium text-[var(--admin-text-muted,#64748b)]">
                {t("createModal.externalName")}
              </label>
              <Input
                placeholder={tCommon("optional")}
                value={externalAccountName}
                maxLength={120}
                onChange={(e) => setExternalAccountName(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--admin-text-muted,#64748b)]">
                {t("createModal.dailyBudget")}
              </label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={dailyBudget}
                onChange={(e) => setDailyBudget(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--admin-text-muted,#64748b)]">
                {t("createModal.monthlyLimit")}
              </label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={monthlyLimit}
                onChange={(e) => setMonthlyLimit(e.target.value)}
              />
            </div>
            <div className="sm:col-span-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-3">
              <label className="flex items-center gap-2 text-sm font-medium text-[var(--foreground)]">
                <input
                  type="checkbox"
                  checked={autoRechargeEnabled}
                  onChange={(e) => setAutoRechargeEnabled(e.target.checked)}
                />
                {t("createModal.autoRecharge")}
              </label>
              <Input
                type="number"
                min="0"
                step="0.01"
                disabled={!autoRechargeEnabled}
                value={rechargeThreshold}
                onChange={(e) => setRechargeThreshold(e.target.value)}
                placeholder={t("createModal.threshold")}
                className="mt-3"
              />
            </div>
          </div>

          {error && (
            <p className="mt-3 text-xs text-red-600" role="alert">
              {error}
            </p>
          )}

          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={handleClose} className="h-11 w-full sm:w-auto">
              {tCommon("cancel")}
            </Button>
            <Button
              onClick={validateBeforeConfirm}
              className="h-11 w-full bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-deep)] sm:w-auto"
            >
              {tCommon("continue")}
            </Button>
          </div>
        </>
      ) : (
        <>
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            {t("createModal.confirmTitle")}
          </h2>
          <p className="mt-1 text-sm text-[var(--admin-text-muted,#64748b)]">
            Revisa los datos antes de crear la cuenta.
          </p>
          <dl className="mt-5 space-y-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-soft)] p-4 text-sm">
            <div>
              <dt className="text-xs text-[var(--admin-text-muted,#64748b)]">
                {t("createModal.name")}
              </dt>
              <dd className="font-medium text-[var(--foreground)]">{displayName}</dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--admin-text-muted,#64748b)]">
                {t("createModal.platform")}
              </dt>
              <dd className="font-medium text-[var(--foreground)]">{platform}</dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--admin-text-muted,#64748b)]">
                {t("createModal.bcId")}
              </dt>
              <dd className="font-medium text-[var(--foreground)]">{displayBcId}</dd>
            </div>
            <div>
              <dt className="text-xs text-[var(--admin-text-muted,#64748b)]">
                {t("createModal.timezone")}
              </dt>
              <dd className="font-medium text-[var(--foreground)]">{timezone}</dd>
            </div>
          </dl>
          {error && (
            <p className="mt-3 text-xs text-red-600" role="alert">
              {error}
            </p>
          )}
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              onClick={() => setStep("form")}
              className="sm:w-auto"
              disabled={loading}
            >
              {tCommon("back")}
            </Button>
            <Button
              onClick={handleCreate}
              disabled={loading}
              className="bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-deep)] sm:w-auto"
            >
              {loading ? t("createModal.creating") : t("createModal.create")}
            </Button>
          </div>
        </>
      )}
    </DashboardModalShell>
  );
}
