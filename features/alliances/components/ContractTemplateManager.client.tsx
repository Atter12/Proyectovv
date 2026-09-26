"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { saveTemplateAction } from "@/features/alliances/actions";
import { CONTRACT_TYPE_LABEL, CONTRACT_TYPES, type ContractType } from "@/features/alliances/lib/domain";
import {
  TEMPLATE_FIELDS,
  parseTemplateDraft,
  type ContractTemplate,
  type TemplateDraft,
} from "@/features/alliances/lib/templates";
import { AreaField, FormError, SelectField, TextField } from "./fields";

const emptyDraft = (): TemplateDraft => ({
  name: "",
  contractType: "commercial",
  description: "",
  body: "En {{ciudad}}, el {{hoy}}, Holistic Marketing y {{alianza}} acuerdan:\n\n{{acuerdo}}\n",
  active: true,
});

export function ContractTemplateManager({
  templates,
  backHref,
}: {
  templates: ContractTemplate[];
  backHref: string;
}) {
  const router = useRouter();
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [open, setOpen] = useState(templates.length === 0);
  const [editing, setEditing] = useState<ContractTemplate | null>(null);
  const [draft, setDraft] = useState<TemplateDraft>(emptyDraft());
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function begin(template?: ContractTemplate) {
    setEditing(template ?? null);
    setDraft(
      template
        ? {
            name: template.name,
            contractType: template.contractType,
            description: template.description,
            body: template.body,
            active: template.active,
          }
        : emptyDraft(),
    );
    setError("");
    setOpen(true);
  }

  function insertVariable(key: string) {
    const token = `{{${key}}}`;
    const area = bodyRef.current;
    if (!area) {
      setDraft((current) => ({ ...current, body: `${current.body}${token}` }));
      return;
    }
    const start = area.selectionStart ?? draft.body.length;
    const end = area.selectionEnd ?? start;
    const body = `${draft.body.slice(0, start)}${token}${draft.body.slice(end)}`;
    setDraft((current) => ({ ...current, body }));
    requestAnimationFrame(() => {
      area.focus();
      const cursor = start + token.length;
      area.setSelectionRange(cursor, cursor);
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={backHref} className="text-sm font-semibold text-[var(--admin-accent)]">
          ← Alianzas
        </Link>
        <Button type="button" onClick={() => (open ? setOpen(false) : begin())}>
          {open ? "Cerrar" : "Nueva plantilla"}
        </Button>
      </div>

      {open ? (
        <form
          className="space-y-4 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 shadow-[var(--admin-shadow-1)] sm:p-5"
          onSubmit={(event) => {
            event.preventDefault();
            const parsed = parseTemplateDraft(draft);
            if (!parsed.ok) {
              setError(parsed.error);
              return;
            }
            setError("");
            startTransition(async () => {
              const result = await saveTemplateAction(parsed.value, editing?.id);
              if (!result.ok) {
                setError(result.error);
                return;
              }
              setOpen(false);
              router.refresh();
            });
          }}
        >
          <div>
            <h2 className="text-base font-semibold text-[var(--admin-text)]">
              {editing ? "Editar plantilla" : "Nueva plantilla"}
            </h2>
            <p className="mt-1 text-sm text-[var(--admin-text-muted)]">
              Escribe el contrato y marca los datos que salen de la ficha con variables.
            </p>
          </div>
          <FormError message={error} />
          <div className="grid gap-3 md:grid-cols-2">
            <TextField label="Nombre" value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} required />
            <SelectField
              label="Tipo de contrato"
              value={draft.contractType}
              onChange={(event) => setDraft((current) => ({ ...current, contractType: event.target.value as ContractType }))}
            >
              {CONTRACT_TYPES.map((type) => (
                <option key={type} value={type}>{CONTRACT_TYPE_LABEL[type]}</option>
              ))}
            </SelectField>
          </div>
          <TextField
            label="Para qué sirve"
            value={draft.description}
            onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))}
          />
          <div className="flex flex-wrap gap-1.5">
            {TEMPLATE_FIELDS.map((field) => (
              <button
                key={field.key}
                type="button"
                className="rounded-md bg-[var(--admin-accent-soft)] px-2 py-1 text-xs font-medium text-[var(--admin-accent)]"
                onClick={() => insertVariable(field.key)}
              >
                {field.label}
              </button>
            ))}
          </div>
          <AreaField
            ref={bodyRef}
            label="Texto"
            value={draft.body}
            onChange={(event) => setDraft((current) => ({ ...current, body: event.target.value }))}
          />
          <label className="flex items-center gap-2 text-sm text-[var(--admin-text)]">
            <input
              type="checkbox"
              checked={draft.active}
              onChange={(event) => setDraft((current) => ({ ...current, active: event.target.checked }))}
              className="h-4 w-4 accent-[var(--admin-accent)]"
            />
            Disponible al generar un contrato
          </label>
          <Button type="submit" disabled={pending}>{pending ? "Guardando…" : "Guardar plantilla"}</Button>
        </form>
      ) : null}

      {templates.length === 0 ? (
        <p className="text-sm text-[var(--admin-text-muted)]">Todavía no hay plantillas. Crea la primera o aplica la migración 039 para cargar las de Alianza comercial, NDA y Adenda.</p>
      ) : (
        <ul className="grid gap-3">
          {templates.map((template) => (
            <li key={template.id} className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 shadow-[var(--admin-shadow-1)]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-[var(--admin-text)]">{template.name}</p>
                  <p className="mt-1 text-sm text-[var(--admin-text-muted)]">
                    {CONTRACT_TYPE_LABEL[template.contractType]} · {template.active ? "Activa" : "Oculta"}
                    {template.description ? ` · ${template.description}` : ""}
                  </p>
                </div>
                <button type="button" className="text-xs font-medium text-[var(--admin-accent)]" onClick={() => begin(template)}>
                  Editar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
