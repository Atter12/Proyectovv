"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { saveAllianceAction } from "@/features/alliances/actions";
import {
  ALLIANCE_STATUSES,
  ALLIANCE_STATUS_LABEL,
  ALLIANCE_TYPES,
  ALLIANCE_TYPE_LABEL,
  allianceInitials,
  formatAllianceDate,
  type AllianceDraft,
} from "@/features/alliances/lib/domain";
import { AllianceStatusBadge, AllianceTypeBadge } from "./badges";
import { areaClass, AreaField, FormError, FormSection, SelectField, TextField } from "./fields";

export function AllianceEditor({
  allianceId,
  initial,
  submitLabel,
  onCancel,
  onSaved,
  preview = false,
}: {
  allianceId?: string;
  initial: AllianceDraft;
  submitLabel: string;
  onCancel?: () => void;
  onSaved?: (id: string) => void;
  preview?: boolean;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function set<K extends keyof AllianceDraft>(key: K, value: AllianceDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    startTransition(async () => {
      const result = await saveAllianceAction(draft, allianceId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (result.id) onSaved?.(result.id);
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit}>
      <FormError message={error} />
      <div className={`grid items-start gap-5 ${preview ? "xl:grid-cols-[minmax(0,1fr)_18.5rem]" : ""} ${error ? "mt-4" : ""}`}>
        <div className="space-y-4">
          <FormSection
            step="1"
            title="Identidad"
            description="Cómo reconocerás esta alianza en la lista y en su ficha."
          >
            <TextField
              className="md:col-span-2"
              label="Nombre de la alianza"
              value={draft.name}
              onChange={(event) => set("name", event.target.value)}
              required
              maxLength={160}
              placeholder="Ej. Canal Andes Marketplace"
            />
            <SelectField
              label="Tipo"
              value={draft.allianceType}
              onChange={(event) => set("allianceType", event.target.value as AllianceDraft["allianceType"])}
            >
              {ALLIANCE_TYPES.map((type) => (
                <option key={type} value={type}>{ALLIANCE_TYPE_LABEL[type]}</option>
              ))}
            </SelectField>
            <SelectField
              label="Estado"
              value={draft.status}
              onChange={(event) => set("status", event.target.value as AllianceDraft["status"])}
            >
              {ALLIANCE_STATUSES.map((status) => (
                <option key={status} value={status}>{ALLIANCE_STATUS_LABEL[status]}</option>
              ))}
            </SelectField>
          </FormSection>

          <FormSection
            step="2"
            title="Personas"
            description="Quién la lleva por Holistic y a quién se escribe del otro lado."
          >
            <TextField
              label="Responsable interno"
              value={draft.ownerName}
              onChange={(event) => set("ownerName", event.target.value)}
              required
              maxLength={120}
            />
            <TextField
              label="Persona de contacto"
              hint="El contacto principal. Puedes agregar más en la ficha."
              value={draft.contactName}
              onChange={(event) => set("contactName", event.target.value)}
              maxLength={120}
            />
            <TextField
              label="Teléfono"
              value={draft.phone}
              onChange={(event) => set("phone", event.target.value)}
              maxLength={40}
            />
            <TextField
              label="Correo"
              type="email"
              value={draft.email}
              onChange={(event) => set("email", event.target.value)}
              maxLength={160}
            />
          </FormSection>

          <FormSection
            step="3"
            title="Condiciones"
            description="Vigencia del acuerdo y cómo se reparte el valor."
          >
            <TextField
              className="md:col-span-2"
              label="Comisión o porcentaje"
              hint="Ej. 15% sobre ventas del canal"
              value={draft.commissionTerms}
              onChange={(event) => set("commissionTerms", event.target.value)}
              maxLength={240}
            />
            <TextField
              label="Inicio"
              type="date"
              value={draft.startedOn}
              onChange={(event) => set("startedOn", event.target.value)}
            />
            <TextField
              label="Término"
              type="date"
              value={draft.endsOn}
              onChange={(event) => set("endsOn", event.target.value)}
            />
          </FormSection>

          <FormSection
            step="4"
            title="El acuerdo"
            description="El relato queda aquí. Contratos, anexos y archivos se agregan después, en la ficha."
          >
            <AreaField
              className="md:col-span-2"
              label="Descripción del acuerdo"
              value={draft.summary}
              onChange={(event) => set("summary", event.target.value)}
              maxLength={4000}
            />
            <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-3">
              <p className="mb-3 text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-[var(--admin-accent)]">Holistic</p>
              <textarea
                className={areaClass}
                aria-label="Qué aporta Holistic"
                placeholder="Qué aporta Holistic"
                value={draft.ourContribution}
                onChange={(event) => set("ourContribution", event.target.value)}
                maxLength={2000}
              />
            </div>
            <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-3">
              <p className="mb-3 text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-[var(--admin-text-muted)]">La otra parte</p>
              <textarea
                className={areaClass}
                aria-label="Qué aporta la otra parte"
                placeholder="Qué aporta la otra parte"
                value={draft.theirContribution}
                onChange={(event) => set("theirContribution", event.target.value)}
                maxLength={2000}
              />
            </div>
          </FormSection>

          <FormSection
            step="5"
            title="Siguiente paso"
            description="Opcional. Si luego creas un recordatorio, ese reemplaza esta nota."
          >
            <TextField
              className="md:col-span-2"
              label="Siguiente acción anotada"
              value={draft.nextAction}
              onChange={(event) => set("nextAction", event.target.value)}
              placeholder="Ej. Enviar propuesta revisada el viernes"
              maxLength={240}
            />
          </FormSection>

          <div className="flex flex-col-reverse gap-3 border-t border-[var(--admin-border)] pt-4 sm:flex-row sm:items-center sm:justify-between">
            {allianceId ? (
              <span />
            ) : (
              <p className="max-w-md text-xs leading-5 text-[var(--admin-text-soft)]">
                Al guardar abres la ficha para contratos, archivos y seguimiento.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {onCancel ? (
                <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
                  Cancelar
                </Button>
              ) : null}
              <Button type="submit" disabled={pending}>{pending ? "Guardando…" : submitLabel}</Button>
            </div>
          </div>
        </div>
        {preview ? <DraftPreview draft={draft} /> : null}
      </div>
    </form>
  );
}

function DraftPreview({ draft }: { draft: AllianceDraft }) {
  const name = draft.name.trim() || "Nueva alianza";
  const contactLine = [draft.email.trim(), draft.phone.trim()].filter(Boolean).join(" · ");

  return (
    <aside className="xl:sticky xl:top-4">
      <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 shadow-[var(--admin-shadow-1)]">
        <p className="text-[0.6875rem] font-medium uppercase tracking-[0.06em] text-[var(--admin-text-soft)]">Vista previa</p>
        <div className="mt-4 flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--admin-accent-soft)] text-sm font-semibold text-[var(--admin-accent)]">
            {allianceInitials(draft.name.trim() || "Nueva")}
          </span>
          <div className="min-w-0">
            <p className="truncate font-semibold text-[var(--admin-text)]">{name}</p>
            <p className="truncate text-xs text-[var(--admin-text-muted)]">{draft.ownerName.trim() || "Sin responsable"}</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <AllianceTypeBadge type={draft.allianceType} />
          <AllianceStatusBadge status={draft.status} />
        </div>
        <dl className="mt-4 space-y-3 border-t border-[var(--admin-border)] pt-4">
          <PreviewRow label="Contacto" value={draft.contactName.trim() || "Sin contacto"} detail={contactLine} />
          <PreviewRow
            label="Vigencia"
            value={`${formatAllianceDate(draft.startedOn)} – ${formatAllianceDate(draft.endsOn)}`}
          />
          <PreviewRow label="Comisión" value={draft.commissionTerms.trim() || "Sin definir"} />
          <PreviewRow label="Siguiente acción" value={draft.nextAction.trim() || "Se define en la ficha"} />
        </dl>
      </div>
    </aside>
  );
}

function PreviewRow({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div>
      <dt className="text-[0.6875rem] font-medium uppercase tracking-[0.05em] text-[var(--admin-text-soft)]">{label}</dt>
      <dd className="mt-1 text-sm text-[var(--admin-text)]">{value}</dd>
      {detail ? <dd className="mt-0.5 text-xs text-[var(--admin-text-muted)]">{detail}</dd> : null}
    </div>
  );
}
