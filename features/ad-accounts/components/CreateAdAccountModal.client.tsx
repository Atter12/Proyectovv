"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

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

  function resetForm() {
    setStep("form");
    setAccountName("");
    setBcId("");
    setTimezone("UTC-05 Lima");
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  useEffect(() => {
    if (!open) return;
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") handleClose();
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [open, onClose]);

  if (!open) return null;

  function handleCreate() {
    handleClose();
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
              Vista mock — los datos no se guardan en backend.
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
              Revisa los datos antes de crear la cuenta mock.
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
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => setStep("form")} className="sm:w-auto">
                Volver
              </Button>
              <Button
                onClick={handleCreate}
                className="bg-[#4056ff] hover:bg-[#4056ff]/90 sm:w-auto"
              >
                Crear cuenta mock
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
