"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { formatNumber } from "@/lib/format-number";
import type { AffiliateProgramOverview } from "@/types/affiliate";

interface ReferralLinkCardProps {
  data: Pick<
    AffiliateProgramOverview,
    "referralUrl" | "referralCode" | "stats"
  >;
}

export function ReferralLinkCard({ data }: ReferralLinkCardProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(data.referralUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  const metrics = [
    { label: "Clics", value: data.stats.clicks },
    { label: "Registros", value: data.stats.registrations },
    { label: "Activos", value: data.stats.activeReferrals },
  ];

  return (
    <Card className="relative overflow-hidden">
      <div className="absolute right-0 top-0 h-20 w-20 rounded-bl-[3rem] bg-gradient-to-br from-[#4056ff]/5 to-[#7c3aed]/10" />

      <div className="relative">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold text-[#0f172a]">
              Tu enlace de referencia
            </h3>
            <p className="mt-1 text-sm text-[#64748b]">
              Comparte este enlace para registrar nuevos anunciantes asociados a
              tu cuenta.
            </p>
          </div>
          <Badge variant="success">Activo</Badge>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="min-w-0 flex-1">
            <Input
              readOnly
              value={data.referralUrl}
              className="h-11 w-full bg-slate-50"
              aria-label="Enlace de referencia"
            />
          </div>
          <button
            type="button"
            onClick={handleCopy}
            aria-label="Copiar enlace de referencia"
            className={`inline-flex h-11 w-full shrink-0 items-center justify-center rounded-xl px-5 text-sm font-semibold text-white shadow-sm transition-all duration-200 sm:w-auto ${
              copied
                ? "bg-[#16a34a] hover:bg-[#16a34a]"
                : "bg-[#4056ff] hover:-translate-y-0.5 hover:bg-[#4056ff]/90 hover:shadow-md"
            }`}
          >
            {copied ? "¡Copiado!" : "Copiar enlace"}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-[#e5e7eb] pt-4">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wide text-[#64748b]">
              Código de referido
            </p>
            <p className="mt-0.5 font-mono text-sm font-semibold text-[#0f172a]">
              {data.referralCode}
            </p>
          </div>
          <div className="flex flex-wrap gap-4 sm:ml-auto">
            {metrics.map((m) => (
              <div key={m.label} className="text-center sm:text-right">
                <p className="text-[10px] font-medium uppercase tracking-wide text-[#64748b]">
                  {m.label}
                </p>
                <p className="mt-0.5 text-lg font-bold text-[#0f172a]">
                  {formatNumber(m.value)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}
