"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AdminMetricCard } from "@/components/admin/overview/AdminMetricCard";
import { Button } from "@/components/ui/Button";
import { allianceInitials, dueHint, emptyAllianceDraft, ALLIANCE_STATUSES, ALLIANCE_STATUS_LABEL, ALLIANCE_TYPES, ALLIANCE_TYPE_LABEL, type AllianceHomeStats, type AllianceListRow, type AllianceStatus, type AllianceType } from "@/features/alliances/lib/domain";
import type { FollowupStatsView, OwnerLoadItem, TypeShareItem } from "@/features/alliances/lib/view";
import { AllianceStatusBadge, AllianceTypeBadge, ContractStatusBadge } from "./badges";
import { AllianceEditor } from "./AllianceEditor.client";
import { fieldClass } from "./fields";

export function AllianceList({
  today,
  rows,
  stats,
  followup,
  byType,
  owners,
  alertsReady,
  basePath = "/admin/alliances",
}: {
  today: string;
  rows: AllianceListRow[];
  stats: AllianceHomeStats;
  followup: FollowupStatsView;
  byType: TypeShareItem[];
  owners: OwnerLoadItem[];
  alertsReady: boolean;
  basePath?: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [type, setType] = useState<AllianceType | "all">("all");
  const [status, setStatus] = useState<AllianceStatus | "all">("all");
  const [attention, setAttention] = useState(false);
  const [creating, setCreating] = useState(rows.length === 0);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (type !== "all" && row.allianceType !== type) return false;
      if (status !== "all" && row.status !== status) return false;
      if (attention && !row.needsAttention) return false;
      if (!needle) return true;
      return [row.name, row.ownerName, row.contactName, row.email, row.nextAction]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [attention, query, rows, status, type]);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminMetricCard label="Alianzas activas" value={String(stats.active)} detail="Relaciones en curso" accent="emerald" />
        <AdminMetricCard label="En negociación" value={String(stats.negotiating)} detail="Aún sin cerrar" accent="amber" />
        <AdminMetricCard label="Contratos por firmar" value={String(stats.pendingSignature)} detail="Pendientes de firma" accent="indigo" />
        <AdminMetricCard
          label="Requieren atención"
          value={String(stats.needsAttention)}
          detail="Firma, vencimiento o seguimiento atrasado"
          accent={stats.needsAttention > 0 ? "rose" : "indigo"}
          emphasized={stats.needsAttention > 0}
        />
      </div>
      <section className="grid gap-px overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-border)] shadow-[var(--admin-shadow-1)] sm:grid-cols-2 xl:grid-cols-4">
        <QuietStat label="Nuevas del mes" value={followup.newThisMonth} detail="Altas de este mes" />
        <QuietStat label="Por vencer" value={followup.expiring} detail="Firmados dentro de 30 días" tone={followup.expiring > 0 ? "warn" : "neutral"} />
        <QuietStat label="Seguimientos vencidos" value={followup.overdueFollowUps} detail="Recordatorios con fecha pasada" tone={followup.overdueFollowUps > 0 ? "alert" : "neutral"} />
        <QuietStat label="Renovaciones en curso" value={followup.pendingRenewals} detail="Renovaciones sin firmar" />
      </section>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 shadow-[var(--admin-shadow-1)]">
          <h2 className="text-sm font-semibold text-[var(--admin-text)]">Alianzas por tipo</h2>
          <ul className="mt-3 space-y-2">
            {byType.map((item) => {
              const max = Math.max(1, ...byType.map((entry) => entry.count));
              return (
                <li key={item.type} className="grid grid-cols-[7rem_1fr_2rem] items-center gap-3 text-sm">
                  <span className="text-[var(--admin-text-muted)]">{item.label}</span>
                  <span className="h-2 overflow-hidden rounded-full bg-[var(--admin-surface-soft)]">
                    <span className="block h-full rounded-full bg-[var(--admin-accent)]" style={{ width: `${Math.round((item.count / max) * 100)}%` }} />
                  </span>
                  <span className="text-right font-medium text-[var(--admin-text)]">{item.count}</span>
                </li>
              );
            })}
          </ul>
        </section>
        <section className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 shadow-[var(--admin-shadow-1)]">
          <h2 className="text-sm font-semibold text-[var(--admin-text)]">Responsables con seguimiento</h2>
          {owners.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--admin-text-muted)]">No hay recordatorios abiertos.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {owners.map((owner) => (
                <li key={owner.name} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-[var(--admin-text)]">{owner.name}</span>
                  <span className={owner.overdue > 0 ? "font-medium text-[var(--admin-danger)]" : "text-[var(--admin-text-muted)]"}>
                    {owner.open} abierto{owner.open === 1 ? "" : "s"}{owner.overdue > 0 ? ` · ${owner.overdue} vencido${owner.overdue === 1 ? "" : "s"}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      {alertsReady ? null : (
        <p className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-3 text-sm text-[var(--admin-text-muted)]">
          Falta aplicar supabase/migrations/041_alliance_followups.sql para guardar las alertas de 30, 15 y 7 días y las firmas que llevan más de una semana.
        </p>
      )}

      <section className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 shadow-[var(--admin-shadow-1)] sm:p-5">
        <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[var(--admin-text)]">Listado</h2>
            <p className="text-xs text-[var(--admin-text-muted)]">
              {visible.length === rows.length
                ? `${rows.length} alianza${rows.length === 1 ? "" : "s"}`
                : `${visible.length} de ${rows.length}`}
            </p>
          </div>
          <Button type="button" onClick={() => setCreating((open) => !open)}>
            {creating ? "Cerrar formulario" : "Nueva alianza"}
          </Button>
        </div>
        <div className="grid gap-3 md:grid-cols-[1fr_11rem_11rem_auto] md:items-end">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-[var(--admin-text-muted)]">Buscar</span>
            <input
              className={fieldClass}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Alianza, responsable o contacto"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-[var(--admin-text-muted)]">Tipo</span>
            <select className={fieldClass} value={type} onChange={(event) => setType(event.target.value as AllianceType | "all")}>
              <option value="all">Todos</option>
              {ALLIANCE_TYPES.map((item) => (
                <option key={item} value={item}>{ALLIANCE_TYPE_LABEL[item]}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-[var(--admin-text-muted)]">Estado</span>
            <select className={fieldClass} value={status} onChange={(event) => setStatus(event.target.value as AllianceStatus | "all")}>
              <option value="all">Todos</option>
              {ALLIANCE_STATUSES.map((item) => (
                <option key={item} value={item}>{ALLIANCE_STATUS_LABEL[item]}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            aria-pressed={attention}
            onClick={() => setAttention((current) => !current)}
            className={`h-10 rounded-lg border px-3 text-sm font-medium transition-colors duration-150 ${
              attention
                ? "border-[var(--admin-accent)] bg-[var(--admin-accent-soft)] text-[var(--admin-accent)]"
                : "border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-text-muted)] hover:border-[var(--admin-border-strong)] hover:text-[var(--admin-text)]"
            }`}
          >
            Solo atención
          </button>
        </div>
      </section>

      {creating ? (
        <section className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 shadow-[var(--admin-shadow-1)] sm:p-5">
          <div className="mb-5 max-w-2xl">
            <p className="text-[0.6875rem] font-medium uppercase tracking-[0.06em] text-[var(--admin-accent)]">Alta</p>
            <h2 className="mt-1 font-display text-xl font-medium tracking-tight text-[var(--admin-text)]">Nueva alianza</h2>
            <p className="mt-1 text-sm text-[var(--admin-text-muted)]">
              Primero el acuerdo y las personas. Contratos, archivos y seguimiento viven en la ficha.
            </p>
          </div>
          <AllianceEditor
            initial={emptyAllianceDraft()}
            submitLabel="Crear alianza"
            preview
            onCancel={() => setCreating(false)}
            onSaved={(id) => router.push(`${basePath}/${id}`)}
          />
        </section>
      ) : null}

      {visible.length === 0 ? (
        creating ? null : <div className="rounded-xl border border-dashed border-[var(--admin-border-strong)] bg-[var(--admin-surface)] px-6 py-12 text-center">
          <p className="font-display text-lg text-[var(--admin-text)]">
            {rows.length === 0 ? "Todavía no hay alianzas" : "Ninguna alianza coincide con el filtro"}
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm text-[var(--admin-text-muted)]">
            {rows.length === 0
              ? "Registra la primera relación comercial para tener contratos, contactos y la siguiente acción en un solo lugar."
              : "Prueba con otro nombre, tipo o estado."}
          </p>
        </div>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-[var(--admin-shadow-1)] md:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-soft)] text-xs font-medium uppercase tracking-[0.04em] text-[var(--admin-text-soft)]">
                <tr>
                  <th className="px-4 py-3 font-medium">Alianza</th>
                  <th className="px-4 py-3 font-medium">Tipo</th>
                  <th className="px-4 py-3 font-medium">Responsable</th>
                  <th className="px-4 py-3 font-medium">Contrato</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium">Próxima acción</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <tr key={row.id} className="border-b border-[var(--admin-border)] last:border-0 hover:bg-[var(--admin-surface-hover)]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[var(--admin-accent-soft)] text-xs font-semibold text-[var(--admin-accent)]">
                          {allianceInitials(row.name)}
                        </span>
                        <div className="min-w-0">
                          <Link href={`${basePath}/${row.id}`} className="font-semibold text-[var(--admin-text)] hover:text-[var(--admin-accent)]">
                            {row.name}
                          </Link>
                          <p className="mt-0.5 truncate text-xs text-[var(--admin-text-muted)]">
                            {row.contactName || "Sin contacto"}{row.email ? ` · ${row.email}` : ""}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3"><AllianceTypeBadge type={row.allianceType} /></td>
                    <td className="px-4 py-3 text-[var(--admin-text)]">{row.ownerName}</td>
                    <td className="px-4 py-3"><ContractStatusBadge status={row.contractStatus} /></td>
                    <td className="px-4 py-3"><AllianceStatusBadge status={row.status} /></td>
                    <td className="px-4 py-3">
                      <p className={row.nextActionOverdue ? "font-medium text-[var(--admin-danger)]" : "text-[var(--admin-text)]"}>{row.nextAction}</p>
                      {row.nextActionDueOn ? (
                        <p className="mt-0.5 text-xs text-[var(--admin-text-muted)]">{dueHint(row.nextActionDueOn, today)}</p>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 md:hidden">
            {visible.map((row) => (
              <Link
                key={row.id}
                href={`${basePath}/${row.id}`}
                className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 shadow-[var(--admin-shadow-1)]"
              >
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[var(--admin-accent-soft)] text-sm font-semibold text-[var(--admin-accent)]">
                    {allianceInitials(row.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-[var(--admin-text)]">{row.name}</p>
                    <p className="mt-0.5 text-xs text-[var(--admin-text-muted)]">{row.ownerName}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <AllianceTypeBadge type={row.allianceType} />
                  <AllianceStatusBadge status={row.status} />
                  <ContractStatusBadge status={row.contractStatus} />
                </div>
                <p className={`mt-3 text-sm ${row.nextActionOverdue ? "font-medium text-[var(--admin-danger)]" : "text-[var(--admin-text-muted)]"}`}>
                  {row.nextAction}
                </p>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function QuietStat({
  label,
  value,
  detail,
  tone = "neutral",
}: {
  label: string;
  value: number;
  detail: string;
  tone?: "neutral" | "warn" | "alert";
}) {
  const valueClass =
    tone === "alert"
      ? "text-[var(--admin-danger)]"
      : tone === "warn"
        ? "text-[var(--admin-warning)]"
        : "text-[var(--admin-text)]";

  return (
    <div className="bg-[var(--admin-surface)] px-4 py-3">
      <p className="text-xs text-[var(--admin-text-muted)]">{label}</p>
      <p className={`mt-1 font-display text-2xl font-medium tracking-tight ${valueClass}`}>{value}</p>
      <p className="mt-0.5 text-xs text-[var(--admin-text-soft)]">{detail}</p>
    </div>
  );
}
