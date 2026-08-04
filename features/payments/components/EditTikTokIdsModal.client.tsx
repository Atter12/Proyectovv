"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { DashboardModalShell } from "@/components/ui/DashboardModalShell.client";
import { apiClient, ApiClientError } from "@/lib/api/api-client.client";
import type { PaymentAccountAllocation } from "@/types/payment";

const BRANLYN_206 = "7655330910371594258";
const BM_200_BC = "7575005779271614480";

interface EditTikTokIdsModalProps {
  account: PaymentAccountAllocation | null;
  open: boolean;
  onClose: () => void;
}

/** Edita advertiser/BC de la cuenta Holistic usada al fondear (Pagos). */
export function EditTikTokIdsModal({
  account,
  open,
  onClose,
}: EditTikTokIdsModalProps) {
  const router = useRouter();
  const [advertiserId, setAdvertiserId] = useState(
    account?.externalAccountId ?? "",
  );
  const [bcId, setBcId] = useState(BM_200_BC);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open || !account) return null;

  async function handleSave() {
    const adv = advertiserId.trim();
    if (!adv) {
      setError("Pegá el TikTok Advertiser ID (ej. el de la cuenta Aprobada).");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await apiClient(`/api/ad-accounts/${account!.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          externalAccountId: adv,
          externalBusinessId: bcId.trim() || null,
          name: account!.name.includes("206")
            ? account!.name
            : account!.name.replace("204.0", "206.0").replace("204,0", "206,0"),
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
    <DashboardModalShell open onClose={onClose} maxWidthClassName="max-w-md">
      <h2 className="text-lg font-semibold text-[var(--foreground)]">
        ID TikTok de la cuenta
      </h2>
      <p className="mt-1 text-sm text-[var(--admin-text-muted,#64748b)]">
        Holistic fondea el advertiser que esté acá. Tiene que ser el de la
        cuenta <span className="font-medium text-[var(--foreground)]">Aprobada</span>{" "}
        en TikTok BM (no la suspendida).
      </p>
      <p className="mt-2 text-sm font-medium text-[var(--foreground)]">
        {account.name}
      </p>

      <div className="mt-5 space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[var(--admin-text-muted,#64748b)]">
            TikTok Advertiser ID
          </label>
          <Input
            value={advertiserId}
            onChange={(e) => setAdvertiserId(e.target.value)}
            placeholder="7655330910371594258"
            className="font-mono text-[13px]"
            autoFocus
          />
          <button
            type="button"
            className="mt-2 text-[12px] font-medium text-[#c45a18] underline-offset-2 hover:underline"
            onClick={() => setAdvertiserId(BRANLYN_206)}
          >
            Usar Branlyn 206 (aprobada)
          </button>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-[var(--admin-text-muted,#64748b)]">
            Business Center / BC ID
          </label>
          <Input
            value={bcId}
            onChange={(e) => setBcId(e.target.value)}
            placeholder={BM_200_BC}
            className="font-mono text-[13px]"
          />
          <p className="mt-1 text-[11px] text-[var(--admin-text-muted,#64748b)]">
            BM Entreprise 200 = {BM_200_BC}
          </p>
        </div>
      </div>

      {error ? (
        <p className="mt-3 text-xs text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={onClose} disabled={loading}>
          Cancelar
        </Button>
        <Button
          onClick={() => void handleSave()}
          disabled={loading}
          className="bg-[var(--brand-primary)] hover:bg-[var(--brand-primary-deep)]"
        >
          {loading ? "Guardando…" : "Guardar ID"}
        </Button>
      </div>
    </DashboardModalShell>
  );
}
