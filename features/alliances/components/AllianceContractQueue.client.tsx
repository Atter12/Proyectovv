"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ContractStatusBadge } from "@/features/alliances/components/badges";
import { CONTRACT_TYPE_LABEL, formatAllianceDate, type ContractStatus, type ContractType } from "@/features/alliances/lib/domain";
import type { ContractQueueItemView } from "@/features/alliances/lib/view";

const FILTERS = [
  { id: "all", label: "Todos" },
  { id: "draft", label: "Borradores" },
  { id: "pending_signature", label: "Pendientes" },
  { id: "signed", label: "Firmados" },
  { id: "expiring", label: "Por vencer" },
  { id: "expired", label: "Vencidos" },
] as const;

export function AllianceContractQueue({
  rows,
  basePath,
}: {
  rows: ContractQueueItemView[];
  basePath: string;
}) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const visible = useMemo(
    () => rows.filter((row) => (filter === "all" ? true : filter === "signed" ? row.shown === "signed" || row.shown === "renewed" : row.shown === filter)),
    [filter, rows],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setFilter(item.id)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${
              filter === item.id
                ? "bg-[var(--admin-accent)] text-white"
                : "bg-[var(--admin-surface)] text-[var(--admin-text-muted)] ring-1 ring-[var(--admin-border)]"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
      {visible.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--admin-border-strong)] bg-[var(--admin-surface)] px-6 py-12 text-center text-sm text-[var(--admin-text-muted)]">
          No hay contratos en esta vista.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--admin-border)] overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)]">
          {visible.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div>
                <Link href={`${basePath}/${row.allianceId}`} className="font-semibold text-[var(--admin-text)] hover:text-[var(--admin-accent)]">
                  {row.allianceName}
                </Link>
                <p className="mt-0.5 text-sm text-[var(--admin-text-muted)]">
                  {typeLabel(row.contractType)} · v{row.version}
                  {row.sentOn ? ` · enviado ${formatAllianceDate(row.sentOn)}` : ""}
                  {row.expiresOn ? ` · vence ${formatAllianceDate(row.expiresOn)}` : ""}
                </p>
              </div>
              <ContractStatusBadge status={isContractStatus(row.shown) ? row.shown : null} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function typeLabel(value: string): string {
  return value in CONTRACT_TYPE_LABEL ? CONTRACT_TYPE_LABEL[value as ContractType] : "Contrato";
}

function isContractStatus(value: string): value is ContractStatus {
  return ["draft", "in_review", "pending_signature", "signed", "expiring", "expired", "renewed"].includes(value);
}
