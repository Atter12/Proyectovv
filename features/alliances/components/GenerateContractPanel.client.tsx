"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { generateContractAction } from "@/features/alliances/actions";
import {
  allianceTemplateValues,
  missingPlaceholders,
  placeholdersIn,
  renderTemplate,
  templateFieldLabel,
  type ContractTemplate,
} from "@/features/alliances/lib/templates";
import { ALLIANCE_TYPE_LABEL, CONTRACT_TYPE_LABEL, formatAllianceDate, type AllianceType } from "@/features/alliances/lib/domain";
import { FormError, TextField, fieldClass } from "./fields";

export function GenerateContractPanel({
  allianceId,
  source,
  today,
  templates,
  templatesHref,
  onClose,
}: {
  allianceId: string;
  source: {
    name: string;
    allianceType: AllianceType;
    ownerName: string;
    contactName: string;
    email: string;
    phone: string;
    commissionTerms: string;
    startedOn: string;
    endsOn: string;
    ourContribution: string;
    theirContribution: string;
    summary: string;
  };
  today: string;
  templates: ContractTemplate[] | null;
  templatesHref: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const suggested = useMemo(
    () =>
      allianceTemplateValues({
        name: source.name,
        typeLabel: ALLIANCE_TYPE_LABEL[source.allianceType],
        ownerName: source.ownerName,
        contactName: source.contactName,
        email: source.email,
        phone: source.phone,
        commissionTerms: source.commissionTerms,
        startedOnLabel: source.startedOn ? formatAllianceDate(source.startedOn) : "",
        endsOnLabel: source.endsOn ? formatAllianceDate(source.endsOn) : "",
        ourContribution: source.ourContribution,
        theirContribution: source.theirContribution,
        summary: source.summary,
        todayLabel: formatAllianceDate(today),
      }),
    [source, today],
  );
  const active = (templates ?? []).filter((template) => template.active);
  const [templateId, setTemplateId] = useState(active[0]?.id ?? "");
  const [values, setValues] = useState<Record<string, string>>(suggested);
  const [expiresOn, setExpiresOn] = useState(source.endsOn);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const selected = active.find((template) => template.id === templateId) ?? null;
  const keys = selected ? placeholdersIn(selected.body) : [];
  const preview = selected ? renderTemplate(selected.body, { ...suggested, ...values }) : "";
  const missing = selected ? missingPlaceholders(selected.body, { ...suggested, ...values }) : [];

  if (templates === null) {
    return (
      <div className="mb-5 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-soft)] p-4">
        <p className="text-sm text-[var(--admin-text)]">Falta aplicar la migración de plantillas para poder generar contratos.</p>
        <p className="mt-1 text-sm text-[var(--admin-text-muted)]">supabase/migrations/039_alliance_contract_templates.sql</p>
        <Button type="button" variant="outline" className="mt-3" onClick={onClose}>Cerrar</Button>
      </div>
    );
  }

  if (active.length === 0) {
    return (
      <div className="mb-5 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-soft)] p-4">
        <p className="text-sm text-[var(--admin-text)]">No hay plantillas activas.</p>
        <a href={templatesHref} className="mt-2 inline-block text-sm font-semibold text-[var(--admin-accent)]">Crear una plantilla</a>
      </div>
    );
  }

  return (
    <form
      className="mb-5 space-y-4 border-b border-[var(--admin-border)] pb-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (!selected) return;
        setError("");
        const payload = { ...suggested, ...values };
        startTransition(async () => {
          const result = await generateContractAction({
            allianceId,
            templateId: selected.id,
            values: payload,
            expiresOn,
          });
          if (!result.ok) {
            setError(result.error);
            return;
          }
          onClose();
          router.refresh();
        });
      }}
    >
      <div>
        <p className="text-sm font-semibold text-[var(--admin-text)]">Generar contrato</p>
        <p className="mt-1 text-sm text-[var(--admin-text-muted)]">
          Elige la plantilla, confirma los datos de la ficha y deja un borrador listo para revisar. La firma electrónica queda para después.
        </p>
      </div>
      <FormError message={error} />
      <div className="grid gap-2 sm:grid-cols-3">
        {active.map((template) => {
          const selectedCard = template.id === selected?.id;
          return (
            <button
              key={template.id}
              type="button"
              onClick={() => setTemplateId(template.id)}
              className={`rounded-lg border p-3 text-left ${
                selectedCard
                  ? "border-[var(--admin-accent)] bg-[var(--admin-accent-soft)]"
                  : "border-[var(--admin-border)] bg-[var(--admin-surface)]"
              }`}
            >
              <p className="text-sm font-semibold text-[var(--admin-text)]">{template.name}</p>
              <p className="mt-1 text-xs text-[var(--admin-text-muted)]">{CONTRACT_TYPE_LABEL[template.contractType]}</p>
            </button>
          );
        })}
      </div>
      {selected?.description ? <p className="text-sm text-[var(--admin-text-muted)]">{selected.description}</p> : null}
      <div className="grid gap-3 md:grid-cols-2">
        {keys.map((key) => (
          <label key={key} className="block md:col-span-1">
            <span className="mb-1.5 block text-xs font-medium text-[var(--admin-text-muted)]">{templateFieldLabel(key)}</span>
            {key === "acuerdo" || key === "aporta_holistic" || key === "aporta_contraparte" || key === "comision" ? (
              <textarea
                className={`${fieldClass} min-h-20 py-2`}
                value={values[key] ?? suggested[key] ?? ""}
                onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))}
              />
            ) : (
              <input
                className={fieldClass}
                value={values[key] ?? suggested[key] ?? ""}
                onChange={(event) => setValues((current) => ({ ...current, [key]: event.target.value }))}
              />
            )}
          </label>
        ))}
        <TextField label="Vencimiento del contrato" type="date" value={expiresOn} onChange={(event) => setExpiresOn(event.target.value)} />
      </div>
      <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-soft)] p-4">
        <p className="text-xs font-medium uppercase tracking-[0.04em] text-[var(--admin-text-soft)]">Vista previa</p>
        <pre className="mt-2 whitespace-pre-wrap font-sans text-sm text-[var(--admin-text)]">{preview}</pre>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending || missing.length > 0}>
          {pending ? "Generando…" : "Generar borrador"}
        </Button>
        <Button type="button" variant="outline" onClick={onClose} disabled={pending}>Cancelar</Button>
      </div>
      {missing.length > 0 ? (
        <p className="text-sm text-[var(--admin-text-muted)]">
          Falta completar: {missing.map(templateFieldLabel).join(", ")}.
        </p>
      ) : null}
    </form>
  );
}
