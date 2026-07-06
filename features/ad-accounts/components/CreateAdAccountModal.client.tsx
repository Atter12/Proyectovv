"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { apiClient, ApiClientError } from "@/lib/api/api-client.client";
import { routes } from "@/config/routes";
import type { AdAccountPlatform } from "@/types/ad-account";

interface CreateAdAccountModalProps {
  open: boolean;
  onClose: () => void;
}

const MAX_NAME_LENGTH = 120;
const MAX_BC_ID_LENGTH = 64;
const platforms: { value: AdAccountPlatform; label: string }[] = [
  { value: "meta", label: "Meta" },
  { value: "tiktok", label: "TikTok" },
  { value: "google", label: "Google" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "other", label: "Otra" },
];

export function CreateAdAccountModal({ open, onClose }: CreateAdAccountModalProps) {
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

  useEffect(() => {
    if (!open) return;
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") handleClose();
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, handleClose]);

  if (!open) return null;

  const displayName = accountName.trim() || "Cuenta publicitaria Default";
  const displayBcId = bcId.trim() || "Manual/Demo";

  function parseAmount(value: string): number | undefined {
    if (!value.trim()) return undefined;
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
  }

  function validateBeforeConfirm() {
    if (!displayName.trim()) {
      setError("El nombre de cuenta es obligatorio.");
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
          : "No se pudo crear la cuenta publicitaria.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-[#0b1020]/40 backdrop-blur-sm"
        aria-label="Cerrar modal"
        onClick={handleClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-account-title"
        className="relative max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-[#e5e7eb] bg-white p-5 shadow-xl sm:p-6"
      >
        {step === "form" ? (
          <>
            <h2 id="create-account-title" className="text-lg font-semibold text-[#0f172a]">
              Crear cuenta publicitaria
            </h2>
            <p className="mt-1 text-sm text-[#64748b]">
              Configura una cuenta manual/demo o deja lista la información de vinculación externa.
            </p>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs font-medium text-[#64748b]">
                  Nombre de cuenta
                </label>
                <Input
                  placeholder="Cuenta publicitaria Default"
                  value={accountName}
                  maxLength={MAX_NAME_LENGTH}
                  onChange={(e) => setAccountName(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#64748b]">
                  Plataforma
                </label>
                <select
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value as AdAccountPlatform)}
                  className="h-10 w-full rounded-2xl border border-[var(--border-subtle)] bg-white/90 px-3.5 text-sm text-slate-950 shadow-sm focus:border-[#4056ff]/55 focus:outline-none focus:ring-4 focus:ring-[#4056ff]/10"
                >
                  {platforms.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#64748b]">
                  Huso horario
                </label>
                <Input value={timezone} maxLength={80} onChange={(e) => setTimezone(e.target.value)} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#64748b]">
                  Business Center / BC ID
                </label>
                <Input
                  placeholder="BC-0001"
                  value={bcId}
                  maxLength={MAX_BC_ID_LENGTH}
                  onChange={(e) => setBcId(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#64748b]">
                  ID de cuenta externa
                </label>
                <Input
                  placeholder="Opcional"
                  value={externalAccountId}
                  maxLength={MAX_BC_ID_LENGTH}
                  onChange={(e) => setExternalAccountId(e.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs font-medium text-[#64748b]">
                  Nombre externo visible
                </label>
                <Input
                  placeholder="Opcional"
                  value={externalAccountName}
                  maxLength={120}
                  onChange={(e) => setExternalAccountName(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#64748b]">
                  Presupuesto diario USD
                </label>
                <Input type="number" min="0" step="0.01" value={dailyBudget} onChange={(e) => setDailyBudget(e.target.value)} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#64748b]">
                  Límite mensual USD
                </label>
                <Input type="number" min="0" step="0.01" value={monthlyLimit} onChange={(e) => setMonthlyLimit(e.target.value)} />
              </div>
              <div className="sm:col-span-2 rounded-xl border border-[#e5e7eb] bg-slate-50 p-3">
                <label className="flex items-center gap-2 text-sm font-medium text-[#0f172a]">
                  <input
                    type="checkbox"
                    checked={autoRechargeEnabled}
                    onChange={(e) => setAutoRechargeEnabled(e.target.checked)}
                  />
                  Activar recarga automática
                </label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  disabled={!autoRechargeEnabled}
                  value={rechargeThreshold}
                  onChange={(e) => setRechargeThreshold(e.target.value)}
                  placeholder="Umbral de recarga USD"
                  className="mt-3"
                />
              </div>
            </div>

            {error && <p className="mt-3 text-xs text-red-600" role="alert">{error}</p>}

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={handleClose} className="h-11 w-full sm:w-auto">
                Cancelar
              </Button>
              <Button onClick={validateBeforeConfirm} className="h-11 w-full bg-[#4056ff] hover:bg-[#4056ff]/90 sm:w-auto">
                Continuar
              </Button>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-lg font-semibold text-[#0f172a]">Confirmar creación</h2>
            <p className="mt-1 text-sm text-[#64748b]">Revisa los datos antes de crear la cuenta.</p>
            <dl className="mt-5 space-y-3 rounded-xl border border-[#e5e7eb] bg-slate-50 p-4 text-sm">
              <div><dt className="text-xs text-[#64748b]">Nombre</dt><dd className="font-medium text-[#0f172a]">{displayName}</dd></div>
              <div><dt className="text-xs text-[#64748b]">Plataforma</dt><dd className="font-medium text-[#0f172a]">{platform}</dd></div>
              <div><dt className="text-xs text-[#64748b]">BC / ID</dt><dd className="font-medium text-[#0f172a]">{displayBcId}</dd></div>
              <div><dt className="text-xs text-[#64748b]">Huso horario</dt><dd className="font-medium text-[#0f172a]">{timezone}</dd></div>
            </dl>
            {error && <p className="mt-3 text-xs text-red-600" role="alert">{error}</p>}
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => setStep("form")} className="sm:w-auto" disabled={loading}>
                Volver
              </Button>
              <Button onClick={handleCreate} disabled={loading} className="bg-[#4056ff] hover:bg-[#4056ff]/90 sm:w-auto">
                {loading ? "Creando…" : "Crear cuenta"}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
