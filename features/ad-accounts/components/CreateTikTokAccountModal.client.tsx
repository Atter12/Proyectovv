"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { DashboardModalShell } from "@/components/ui/DashboardModalShell.client";
import { routes } from "@/config/routes";
import {
  DEFAULT_TIKTOK_CREATE_BM,
  TIKTOK_SELF_SERVE_ACCOUNT_LIMIT,
  TIKTOK_SELF_SERVE_CREATE_MAINTENANCE,
} from "@/lib/integrations/tiktok/bc-create-profiles";

interface CreateTikTokAccountModalProps {
  open: boolean;
  onClose: () => void;
  clienteName: string;
  currentAccountCount: number;
  /** Cupo del cliente; puede estar ampliado por gerencia. */
  accountLimit?: number;
}

type CreateOk = {
  ok: true;
  needWhatsApp: false;
  advertiserId: string;
  advertiserName: string;
  bmBucket: string;
  accountCountAfter: number;
};

type CreateNeedWa = {
  ok: false;
  needWhatsApp: true;
  accountCount: number;
  limit: number;
  whatsappUrl: string;
  message: string;
};

type QuotaPayload = {
  used: number;
  limit: number;
};

export function CreateTikTokAccountModal({
  open,
  onClose,
  clienteName,
  currentAccountCount,
  accountLimit = TIKTOK_SELF_SERVE_ACCOUNT_LIMIT,
}: CreateTikTokAccountModalProps) {
  const t = useTranslations("adAccounts.tiktokCreate");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [quotaLoading, setQuotaLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [whatsappUrl, setWhatsappUrl] = useState<string | null>(null);
  const [success, setSuccess] = useState<CreateOk | null>(null);
  const [liveUsed, setLiveUsed] = useState(currentAccountCount);
  const [liveLimit, setLiveLimit] = useState(accountLimit);

  const maintenance = TIKTOK_SELF_SERVE_CREATE_MAINTENANCE;
  const atLimit = liveUsed >= liveLimit;
  const remaining = Math.max(0, liveLimit - liveUsed);

  useEffect(() => {
    if (!open) return;
    setLiveUsed(currentAccountCount);
    setLiveLimit(accountLimit);
    setError(null);
    setWhatsappUrl(null);
    setSuccess(null);

    let cancelled = false;
    setQuotaLoading(true);
    void (async () => {
      try {
        const response = await fetch(routes.api.adAccountsTikTokCreate, {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });
        if (!response.ok) return;
        const json = (await response.json()) as QuotaPayload | { error?: string };
        if (cancelled || !("limit" in json) || !Number.isFinite(json.limit)) {
          return;
        }
        setLiveUsed(Number(json.used) || 0);
        setLiveLimit(Number(json.limit) || TIKTOK_SELF_SERVE_ACCOUNT_LIMIT);
      } catch {
        // Props del SSR como fallback.
      } finally {
        if (!cancelled) setQuotaLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, currentAccountCount, accountLimit]);

  const handleClose = useCallback(() => {
    setLoading(false);
    setQuotaLoading(false);
    setError(null);
    setWhatsappUrl(null);
    setSuccess(null);
    onClose();
  }, [onClose]);

  if (!open) return null;

  async function handleCreate() {
    if (maintenance) return;
    setLoading(true);
    setError(null);
    setWhatsappUrl(null);
    setSuccess(null);
    try {
      const response = await fetch(routes.api.adAccountsTikTokCreate, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bmBucket: DEFAULT_TIKTOK_CREATE_BM }),
      });
      const json = (await response.json()) as
        | CreateOk
        | CreateNeedWa
        | { error?: string };

      if (
        "needWhatsApp" in json &&
        json.needWhatsApp &&
        "whatsappUrl" in json
      ) {
        setWhatsappUrl(json.whatsappUrl);
        setError(json.message || t("limitReached"));
        if (Number.isFinite(json.accountCount)) setLiveUsed(json.accountCount);
        if (Number.isFinite(json.limit)) setLiveLimit(json.limit);
        return;
      }

      if (!response.ok) {
        setError(("error" in json && json.error) || t("errGeneric"));
        return;
      }

      if ("ok" in json && json.ok) {
        setSuccess(json);
        setLiveUsed(json.accountCountAfter);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errGeneric"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <DashboardModalShell open={open} onClose={handleClose}>
      <div className="space-y-4">
        <div>
          <h2
            id="create-tiktok-account-title"
            className="text-[17px] font-semibold tracking-tight text-[#1c1917]"
          >
            {maintenance ? t("maintenanceTitle") : t("title")}
          </h2>
          <p className="mt-1 text-[13px] leading-5 text-[#6f675f]">
            {maintenance
              ? t("maintenanceSubtitle", { name: clienteName })
              : t("subtitle", { name: clienteName })}
          </p>
        </div>

        {maintenance ? (
          <div className="rounded-xl border border-[#e8e1d8] bg-[#f7f5f2] px-4 py-3 text-sm leading-6 text-[#3f3a34]">
            <p className="font-semibold text-[#1c1917]">
              {t("maintenanceBadge")}
            </p>
            <p className="mt-1.5">{t("maintenanceBody")}</p>
          </div>
        ) : (
          <>
            <div className="rounded-2xl border border-[#e8e1d8] bg-[#f7f5f2] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-[#8a8278]">
                    {t("bmLabel")}
                  </p>
                  <p className="mt-1 text-[15px] font-semibold text-[#1c1917]">
                    {t("bmName")}
                  </p>
                  <p className="mt-0.5 text-[12px] text-[#6f675f]">
                    {t("bmHint")}
                  </p>
                </div>
                <span className="inline-flex items-center rounded-md bg-[#ecfdf5] px-2 py-1 text-[10px] font-bold text-[#047857]">
                  USD
                </span>
              </div>
              <div className="mt-4 border-t border-[#e4ddd6] pt-3 text-[12px] text-[#6f675f]">
                {quotaLoading
                  ? tCommon("loading")
                  : t("quota", {
                      used: liveUsed,
                      limit: liveLimit,
                      remaining,
                    })}
              </div>
            </div>

            {success ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                <p className="font-semibold">{t("successTitle")}</p>
                <p className="mt-1">{success.advertiserName}</p>
                <p className="mt-1 font-mono text-[12px]">
                  {success.advertiserId}
                </p>
                <p className="mt-2 text-[12px] text-emerald-800">
                  {t("successHint")}
                </p>
              </div>
            ) : null}

            {error ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                {error}
              </div>
            ) : null}
          </>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            className="h-11 rounded-xl"
          >
            {maintenance || success ? tCommon("close") : tCommon("cancel")}
          </Button>
          {maintenance ? null : whatsappUrl || atLimit ? (
            <a
              href={
                whatsappUrl ||
                `https://wa.me/51933484150?text=${encodeURIComponent(
                  t("whatsappPrefill", { name: clienteName }),
                )}`
              }
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-11 items-center justify-center rounded-xl bg-[#25D366] px-5 text-[13px] font-semibold text-white transition hover:brightness-105"
            >
              {t("whatsappCta")}
            </a>
          ) : success ? (
            <Button
              type="button"
              onClick={() => {
                handleClose();
                router.push(routes.payments);
              }}
              className="h-11 rounded-xl bg-[#ff781f] px-5 hover:bg-[#e85a1c]"
            >
              {t("goPayments")}
            </Button>
          ) : (
            <Button
              type="button"
              disabled={loading || quotaLoading}
              onClick={() => void handleCreate()}
              className="h-11 rounded-xl bg-[#ff781f] px-5 hover:bg-[#e85a1c]"
            >
              {loading ? t("creating") : t("confirm")}
            </Button>
          )}
        </div>
      </div>
    </DashboardModalShell>
  );
}
