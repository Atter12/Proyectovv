"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { apiClient, ApiClientError } from "@/lib/api/api-client.client";
import { routes } from "@/config/routes";

interface CreateAdAccountModalProps {
  open: boolean;
  onClose: () => void;
}

const MAX_NAME_LENGTH = 120;
const MAX_BC_ID_LENGTH = 64;

export function CreateAdAccountModal({ open, onClose }: CreateAdAccountModalProps) {
  const [accountName, setAccountName] = useState("");
  const [bcId, setBcId] = useState("");
  const [timezone, setTimezone] = useState("UTC-05 Lima");
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function resetForm() {
    setStep("form");
    setAccountName("");
    setBcId("");
    setTimezone("UTC-05 Lima");
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

  async function handleCreate() {
    setLoading(true);
    setError(null);

    try {
      await apiClient(routes.api.adAccounts, {
        method: "POST",
        body: JSON.stringify({
          name: displayName,
          platform: "meta",
          externalAccountId: displayBcId === "BC-0001" ? undefined : displayBcId,
          timezone,
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

  const displayName = accountName.trim() || "Default Ads Account";
  const displayBcId = bcId.trim() || "BC-0001";

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
        className="relative max-h-[calc(100vh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-[#e5e7eb] bg-white p-5 shadow-xl sm:p-6"
      >
        {step === "form" ? (
          <>
            <h2
              id="create-account-title"
              className="text-lg font-semibold text-[#0f172a]"
            >
              Crear cuenta publicitaria
            </h2>
            <p className="mt-1 text-sm text-[#64748b]">
              Configura una nueva cuenta publicitaria para tu organización.
            </p>

            <div className="mt-5 space-y-4">
              <div>
                <label
                  htmlFor="account-name"
                  className="mb-1.5 block text-xs font-medium text-[#64748b]"
                >
                  Nombre de cuenta
                </label>
                <Input
                  id="account-name"
                  placeholder="Default Ads Account"
                  value={accountName}
                  maxLength={MAX_NAME_LENGTH}
                  onChange={(e) => setAccountName(e.target.value)}
                />
              </div>
              <div>
                <label
                  htmlFor="bc-id"
                  className="mb-1.5 block text-xs font-medium text-[#64748b]"
                >
                  Identificación de BC
                </label>
                <Input
                  id="bc-id"
                  placeholder="BC-0001"
                  value={bcId}
                  maxLength={MAX_BC_ID_LENGTH}
                  onChange={(e) => setBcId(e.target.value)}
                />
              </div>
              <div>
                <label
                  htmlFor="timezone"
                  className="mb-1.5 block text-xs font-medium text-[#64748b]"
                >
                  Huso horario
                </label>
                <Input
                  id="timezone"
                  value={timezone}
                  maxLength={80}
                  onChange={(e) => setTimezone(e.target.value)}
                />
              </div>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={handleClose} className="h-11 w-full sm:w-auto">
                Cancelar
              </Button>
              <Button
                onClick={() => setStep("confirm")}
                className="h-11 w-full bg-[#4056ff] hover:bg-[#4056ff]/90 sm:w-auto"
              >
                Continuar
              </Button>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-lg font-semibold text-[#0f172a]">
              Confirmar creación
            </h2>
            <p className="mt-1 text-sm text-[#64748b]">
              Revisa los datos antes de crear la cuenta.
            </p>
            <dl className="mt-5 space-y-3 rounded-xl border border-[#e5e7eb] bg-slate-50 p-4 text-sm">
              <div>
                <dt className="text-xs text-[#64748b]">Nombre</dt>
                <dd className="font-medium text-[#0f172a]">{displayName}</dd>
              </div>
              <div>
                <dt className="text-xs text-[#64748b]">BC ID</dt>
                <dd className="font-medium text-[#0f172a]">{displayBcId}</dd>
              </div>
              <div>
                <dt className="text-xs text-[#64748b]">Huso horario</dt>
                <dd className="font-medium text-[#0f172a]">{timezone}</dd>
              </div>
            </dl>
            {error && (
              <p className="mt-3 text-xs text-red-600" role="alert">
                {error}
              </p>
            )}
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => setStep("form")} className="sm:w-auto" disabled={loading}>
                Volver
              </Button>
              <Button
                onClick={handleCreate}
                disabled={loading}
                className="bg-[#4056ff] hover:bg-[#4056ff]/90 sm:w-auto"
              >
                {loading ? "Creando…" : "Crear cuenta"}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
