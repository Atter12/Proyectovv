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
  type AllianceDraft,
} from "@/features/alliances/lib/domain";
import { AreaField, FormError, SelectField, TextField } from "./fields";

export function AllianceEditor({
  allianceId,
  initial,
  submitLabel,
  onCancel,
  onSaved,
}: {
  allianceId?: string;
  initial: AllianceDraft;
  submitLabel: string;
  onCancel?: () => void;
  onSaved?: (id: string) => void;
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
    <form onSubmit={submit} className="space-y-4">
      <FormError message={error} />
      <div className="grid gap-4 md:grid-cols-2">
        <TextField label="Nombre de la alianza" value={draft.name} onChange={(event) => set("name", event.target.value)} required maxLength={160} />
        <SelectField label="Tipo" value={draft.allianceType} onChange={(event) => set("allianceType", event.target.value as AllianceDraft["allianceType"])}>
          {ALLIANCE_TYPES.map((type) => (
            <option key={type} value={type}>{ALLIANCE_TYPE_LABEL[type]}</option>
          ))}
        </SelectField>
        <TextField label="Responsable interno" value={draft.ownerName} onChange={(event) => set("ownerName", event.target.value)} required maxLength={120} />
        <SelectField label="Estado" value={draft.status} onChange={(event) => set("status", event.target.value as AllianceDraft["status"])}>
          {ALLIANCE_STATUSES.map((status) => (
            <option key={status} value={status}>{ALLIANCE_STATUS_LABEL[status]}</option>
          ))}
        </SelectField>
        <TextField label="Persona de contacto" value={draft.contactName} onChange={(event) => set("contactName", event.target.value)} maxLength={120} />
        <TextField label="Teléfono" value={draft.phone} onChange={(event) => set("phone", event.target.value)} maxLength={40} />
        <TextField label="Correo" type="email" value={draft.email} onChange={(event) => set("email", event.target.value)} maxLength={160} />
        <TextField label="Comisión o porcentaje" value={draft.commissionTerms} onChange={(event) => set("commissionTerms", event.target.value)} placeholder="Ej. 15% sobre ventas del canal" maxLength={240} />
        <TextField label="Inicio" type="date" value={draft.startedOn} onChange={(event) => set("startedOn", event.target.value)} />
        <TextField label="Término" type="date" value={draft.endsOn} onChange={(event) => set("endsOn", event.target.value)} />
      </div>
      <AreaField label="Descripción del acuerdo" value={draft.summary} onChange={(event) => set("summary", event.target.value)} maxLength={4000} />
      <div className="grid gap-4 md:grid-cols-2">
        <AreaField label="Qué aporta Holistic" value={draft.ourContribution} onChange={(event) => set("ourContribution", event.target.value)} maxLength={2000} />
        <AreaField label="Qué aporta la otra parte" value={draft.theirContribution} onChange={(event) => set("theirContribution", event.target.value)} maxLength={2000} />
      </div>
      <TextField label="Siguiente acción anotada" value={draft.nextAction} onChange={(event) => set("nextAction", event.target.value)} placeholder="Se usa si no hay un recordatorio pendiente" maxLength={240} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>{pending ? "Guardando…" : submitLabel}</Button>
        {onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>Cancelar</Button>
        ) : null}
      </div>
    </form>
  );
}
