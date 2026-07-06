"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { apiClient, ApiClientError } from "@/lib/api/api-client.client";
import type { AdAccount, AdAccountPlatform, AdAccountStatus } from "@/types/ad-account";

interface ConfigureAdAccountModalProps {
  account: AdAccount;
  onClose: () => void;
}

const platforms: { value: AdAccountPlatform; label: string }[] = [
  { value: "meta", label: "Meta" },
  { value: "tiktok", label: "TikTok" },
  { value: "google", label: "Google" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "other", label: "Otra" },
];

const statuses: { value: Exclude<AdAccountStatus, "archived">; label: string }[] = [
  { value: "active", label: "Activa" },
  { value: "pending", label: "Pendiente" },
  { value: "disabled", label: "Desactivada" },
  { value: "review", label: "En revisión" },
];

export function ConfigureAdAccountModal({
  account,
  onClose,
}: ConfigureAdAccountModalProps) {
  const router = useRouter();
  const [name, setName] = useState(account.name);
  const [platform, setPlatform] = useState<AdAccountPlatform>(account.platform);
  const [status, setStatus] = useState<Exclude<AdAccountStatus, "archived">>(
    account.status === "archived" ? "disabled" : account.status,
  );
  const [externalBusinessId, setExternalBusinessId] = useState(account.externalBusinessId ?? "");
  const [externalAccountId, setExternalAccountId] = useState(account.externalAccountId ?? "");
  const [externalAccountName, setExternalAccountName] = useState(account.externalAccountName ?? "");
  const [timezone, setTimezone] = useState(account.timezone);
  const [dailyBudget, setDailyBudget] = useState(String(account.dailyBudget || ""));
  const [monthlyLimit, setMonthlyLimit] = useState(String(account.monthlyLimit || ""));
  const [autoRechargeEnabled, setAutoRechargeEnabled] = useState(account.autoRecharge);
  const [rechargeThreshold, setRechargeThreshold] = useState(String(account.rechargeThreshold || ""));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function parseAmount(value: string): number | undefined {
    if (!value.trim()) return undefined;
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
  }

  async function handleSave() {
    if (!name.trim()) {
      setError("El nombre es obligatorio.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await apiClient(`/api/ad-accounts/${account.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name,
          platform,
          status,
          externalBusinessId,
          externalAccountId,
          externalAccountName,
          timezone,
          dailyBudget: parseAmount(dailyBudget),
          monthlyLimit: parseAmount(monthlyLimit),
          autoRechargeEnabled,
          rechargeThreshold: parseAmount(rechargeThreshold),
        }),
      });
      onClose();
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "No se pudo guardar.");
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
        onClick={onClose}
      />
      <div className="relative max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-[#e5e7eb] bg-white p-5 shadow-xl sm:p-6">
        <h2 className="text-lg font-semibold text-[#0f172a]">Configurar cuenta</h2>
        <p className="mt-1 text-sm text-[#64748b]">
          Ajusta datos operativos internos sin depender de proveedores externos.
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-xs font-medium text-[#64748b]">Nombre</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#64748b]">Plataforma</label>
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
            <label className="mb-1.5 block text-xs font-medium text-[#64748b]">Estado</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as Exclude<AdAccountStatus, "archived">)}
              className="h-10 w-full rounded-2xl border border-[var(--border-subtle)] bg-white/90 px-3.5 text-sm text-slate-950 shadow-sm focus:border-[#4056ff]/55 focus:outline-none focus:ring-4 focus:ring-[#4056ff]/10"
            >
              {statuses.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#64748b]">Business Center / BC ID</label>
            <Input value={externalBusinessId} onChange={(e) => setExternalBusinessId(e.target.value)} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#64748b]">ID de cuenta externa</label>
            <Input value={externalAccountId} onChange={(e) => setExternalAccountId(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-xs font-medium text-[#64748b]">Nombre externo</label>
            <Input value={externalAccountName} onChange={(e) => setExternalAccountName(e.target.value)} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#64748b]">Huso horario</label>
            <Input value={timezone} onChange={(e) => setTimezone(e.target.value)} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#64748b]">Presupuesto diario USD</label>
            <Input type="number" min="0" step="0.01" value={dailyBudget} onChange={(e) => setDailyBudget(e.target.value)} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#64748b]">Límite mensual USD</label>
            <Input type="number" min="0" step="0.01" value={monthlyLimit} onChange={(e) => setMonthlyLimit(e.target.value)} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#64748b]">Umbral recarga USD</label>
            <Input type="number" min="0" step="0.01" value={rechargeThreshold} onChange={(e) => setRechargeThreshold(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 rounded-xl border border-[#e5e7eb] bg-slate-50 p-3 text-sm font-medium text-[#0f172a] sm:col-span-2">
            <input
              type="checkbox"
              checked={autoRechargeEnabled}
              onChange={(e) => setAutoRechargeEnabled(e.target.checked)}
            />
            Recarga automática activa
          </label>
        </div>

        {error && <p className="mt-3 text-xs text-red-600" role="alert">{error}</p>}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button onClick={handleSave} disabled={loading}>{loading ? "Guardando…" : "Guardar"}</Button>
        </div>
      </div>
    </div>
  );
}
