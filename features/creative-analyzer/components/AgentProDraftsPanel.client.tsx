"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CreativeDraftListItem } from "@/lib/creatives/types";
import { Button } from "@/components/ui/Button";
import { CrmPanel } from "@/components/dashboard/crm-ui";
import { apiClient, ApiClientError } from "@/lib/api/api-client.client";
import { cn } from "@/lib/cn";

function statusLabel(status: string) {
  switch (status) {
    case "draft":
      return "Listo para enviar";
    case "approved":
      return "Aprobado · falta TikTok";
    case "rejected":
      return "Rechazado";
    case "publishing":
      return "Creando en TikTok…";
    case "published":
      return "En TikTok (pausada)";
    case "failed":
      return "Falló el envío";
    default:
      return status;
  }
}

export function AgentProDraftsPanel({
  drafts,
  publishEnabled,
}: {
  drafts: CreativeDraftListItem[];
  publishEnabled: boolean;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function runAction(
    draftId: string,
    action: "approve" | "reject" | "publish",
    publish = false,
  ) {
    setBusyId(draftId);
    setError(null);
    setMessage(null);
    try {
      const res = await apiClient<{
        ok: boolean;
        status?: string;
        published?: boolean;
      }>("/api/creative-drafts", {
        method: "POST",
        body: JSON.stringify({ draftId, action, publish }),
      });
      if (action === "reject") {
        setMessage("Borrador rechazado.");
      } else if (res.published || action === "publish") {
        setMessage(
          "Listo: campaña creada en TikTok en pausa. Abrí Ads Manager para prenderla.",
        );
      } else {
        setMessage(
          "Brief aprobado. Cuando esté el publish, tocá Enviar campaña a TikTok.",
        );
      }
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : "No se pudo actualizar el borrador.",
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <CrmPanel
      title="Enviar campaña"
      subtitle={
        publishEnabled
          ? "IA arma el brief · vos mandás a TikTok (pausada)"
          : "IA arma el brief · falta activar publish en servidor"
      }
    >
      {!publishEnabled ? (
        <p className="mx-4 mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-950 sm:mx-5">
          El botón de TikTok está listo en la UI. Ops: poné{" "}
          <code className="rounded bg-white px-1">TIKTOK_CREATIVE_PUBLISH_ENABLED=true</code>{" "}
          y scopes Ads/Creative en la app TikTok.
        </p>
      ) : null}

      {error ? (
        <p
          className="mx-4 mt-3 rounded-lg bg-[#fef2f2] px-3 py-2 text-[12px] text-[#991b1b] sm:mx-5"
          role="alert"
        >
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="mx-4 mt-3 rounded-lg bg-[#ecf7f0] px-3 py-2 text-[12px] text-[#1f5c40] sm:mx-5">
          {message}
        </p>
      ) : null}

      {drafts.length === 0 ? (
        <div className="px-4 py-10 text-center sm:px-5">
          <p className="text-[14px] font-semibold text-[var(--auth-text)]">
            Sin campañas todavía
          </p>
          <p className="mt-1.5 text-[13px] text-[var(--auth-text-muted)]">
            Subí un video con cuenta Aprobada. La IA scorea y arma el brief acá
            para enviarlo a TikTok.
          </p>
        </div>
      ) : (
        <ul className="max-h-[32rem] space-y-3 overflow-y-auto p-3 sm:p-4">
          {drafts.map((draft) => {
            const canSend =
              draft.status === "draft" ||
              draft.status === "failed" ||
              draft.status === "approved";
            const canApproveOnly =
              draft.status === "draft" || draft.status === "failed";
            const canReject = draft.status === "draft";

            return (
              <li
                key={draft.id}
                className={cn(
                  "overflow-hidden rounded-[1.1rem] border bg-white shadow-[0_8px_20px_rgb(20_18_16_/_0.03)]",
                  canSend
                    ? "border-[rgb(255_120_31_/_0.28)]"
                    : "border-[rgb(20_18_16_/_0.08)]",
                )}
              >
                <div className="border-b border-[rgb(20_18_16_/_0.06)] bg-[rgb(255_248_243_/_0.55)] px-3.5 py-2.5 sm:px-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="min-w-0 truncate text-[13px] font-bold tracking-[-0.02em] text-[var(--auth-text)]">
                      {draft.brief.campaignName || draft.assetName || "Brief"}
                    </p>
                    <span className="rounded-md bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--auth-text-muted)] ring-1 ring-[rgb(20_18_16_/_0.08)]">
                      {statusLabel(draft.status)}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-[var(--auth-text-muted)]">
                    {[
                      draft.accountName,
                      draft.brief.objective,
                      `$${draft.brief.suggestedDailyBudgetUsd}/día`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>

                <div className="space-y-2.5 px-3.5 py-3 sm:px-4">
                  {draft.brief.hookCopy ? (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--auth-text-soft)]">
                        Hook (3s)
                      </p>
                      <p className="mt-0.5 text-[13px] font-medium leading-5 text-[var(--auth-text)]">
                        {draft.brief.hookCopy}
                      </p>
                    </div>
                  ) : null}
                  {draft.brief.adText ? (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--auth-text-soft)]">
                        Ad text
                      </p>
                      <p className="mt-0.5 text-[13px] leading-5 text-[var(--auth-text-muted)]">
                        {draft.brief.adText}
                      </p>
                    </div>
                  ) : null}
                  {draft.brief.audience ? (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--auth-text-soft)]">
                        Audiencia sugerida
                      </p>
                      <p className="mt-0.5 text-[12px] leading-5 text-[var(--auth-text-muted)]">
                        {draft.brief.audience}
                      </p>
                    </div>
                  ) : null}
                  <p className="text-[11px] text-[var(--auth-text-soft)]">
                    {draft.brief.adgroupName} → {draft.brief.adName}
                  </p>
                  {draft.errorMessage ? (
                    <p className="text-[12px] text-[#991b1b]">
                      {draft.errorMessage}
                    </p>
                  ) : null}
                </div>

                {canSend ? (
                  <div className="flex flex-col gap-2 border-t border-[rgb(20_18_16_/_0.06)] bg-[rgb(255_252_248)] px-3.5 py-3 sm:flex-row sm:px-4">
                    <Button
                      size="sm"
                      disabled={busyId === draft.id || !publishEnabled}
                      onClick={() => {
                        if (draft.status === "approved") {
                          void runAction(draft.id, "publish");
                        } else {
                          void runAction(draft.id, "approve", true);
                        }
                      }}
                      className="h-10 flex-1 rounded-xl bg-[var(--auth-accent)] text-[13px] font-bold text-white disabled:opacity-50"
                    >
                      {busyId === draft.id
                        ? "Enviando…"
                        : "Enviar campaña a TikTok"}
                    </Button>
                    {canApproveOnly ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyId === draft.id}
                        onClick={() => void runAction(draft.id, "approve", false)}
                        className="h-10 flex-1 rounded-xl border-[rgb(20_18_16_/_0.12)] text-[13px] font-semibold"
                      >
                        Solo aprobar brief
                      </Button>
                    ) : null}
                    {canReject ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyId === draft.id}
                        onClick={() => void runAction(draft.id, "reject")}
                        className="h-10 rounded-xl border-[rgb(20_18_16_/_0.12)] text-[13px] font-semibold text-[var(--auth-text-muted)] sm:px-4"
                      >
                        Rechazar
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </CrmPanel>
  );
}
