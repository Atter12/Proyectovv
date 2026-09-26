"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import {
  deleteActivityAction,
  deleteAgreementAction,
  deleteAllianceAction,
  deleteAllianceFileAction,
  deleteContactAction,
  deleteContractAction,
  deleteReminderAction,
  openAllianceFileAction,
  openContractFileAction,
  saveActivityAction,
  saveAgreementAction,
  saveContactAction,
  saveContractAction,
  saveReminderAction,
  uploadAllianceFileAction,
} from "@/features/alliances/actions";
import { AllianceEditor } from "@/features/alliances/components/AllianceEditor.client";
import { AllianceStatusBadge, AllianceTypeBadge, ContractStatusBadge } from "@/features/alliances/components/badges";
import { AreaField, FormError, SelectField, TextField, fieldClass } from "@/features/alliances/components/fields";
import {
  ACTIVITY_KIND_LABEL,
  ACTIVITY_KINDS,
  AGREEMENT_KIND_LABEL,
  AGREEMENT_KINDS,
  CONTRACT_STATUS_LABEL,
  CONTRACT_STATUSES,
  CONTRACT_TYPE_LABEL,
  CONTRACT_TYPES,
  FILE_CATEGORIES,
  FILE_CATEGORY_LABEL,
  REMINDER_PRIORITIES,
  REMINDER_PRIORITY_LABEL,
  REMINDER_STATUSES,
  REMINDER_STATUS_LABEL,
  describeNextAction,
  dueHint,
  formatAllianceDate,
  pickHeadlineContract,
  presentContractStatus,
  type ActivityKind,
  type AgreementKind,
  type ContractStatus,
  type ContractType,
  type FileCategory,
  type ReminderPriority,
  type ReminderStatus,
  type SignerDraft,
} from "@/features/alliances/lib/domain";
import type {
  AllianceActivityRecord,
  AllianceAgreementRecord,
  AllianceContactRecord,
  AllianceContractRecord,
  AllianceDetail,
  AllianceFileRecord,
  AllianceReminderRecord,
} from "@/features/alliances/lib/view";
import { formatDateTime } from "@/lib/format";

const TABS = [
  ["info", "Información"],
  ["contacts", "Contactos"],
  ["agreements", "Acuerdos"],
  ["contracts", "Contratos"],
  ["activities", "Actividades"],
  ["reminders", "Recordatorios"],
  ["files", "Archivos"],
] as const;

type TabId = (typeof TABS)[number][0];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function localDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function Panel({
  title,
  lede,
  action,
  children,
}: {
  title: string;
  lede: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 shadow-[var(--admin-shadow-1)] sm:p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-[var(--admin-text)]">{title}</h2>
          <p className="mt-1 text-sm text-[var(--admin-text-muted)]">{lede}</p>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function ConfirmDelete({
  label,
  onConfirm,
}: {
  label: string;
  onConfirm: () => Promise<{ ok: boolean; error?: string } | void>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <button type="button" className="text-xs font-medium text-[var(--admin-danger)] hover:underline" onClick={() => setOpen(true)}>
        {label}
      </button>
    );
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        className="text-xs font-semibold text-[var(--admin-danger)]"
        disabled={pending}
        onClick={() => {
          setError("");
          startTransition(async () => {
            const result = await onConfirm();
            if (result && "ok" in result && !result.ok) {
              setError(result.error ?? "No se pudo eliminar.");
              return;
            }
            setOpen(false);
            router.refresh();
          });
        }}
      >
        {pending ? "Eliminando…" : "Confirmar"}
      </button>
      <button type="button" className="text-xs text-[var(--admin-text-muted)]" onClick={() => setOpen(false)}>
        Cancelar
      </button>
      {error ? <span className="text-xs text-[var(--admin-danger)]">{error}</span> : null}
    </span>
  );
}

export function AllianceWorkspace({ detail, today }: { detail: AllianceDetail; today: string }) {
  const [tab, setTab] = useState<TabId>("info");
  const headline = pickHeadlineContract(
    detail.contracts.map((contract) => ({ status: contract.status, expiresOn: contract.expiresOn || null })),
    today,
  );
  const next = describeNextAction(
    detail.nextAction,
    detail.reminders.map((reminder) => ({
      title: reminder.title,
      dueOn: reminder.dueOn,
      status: reminder.status,
    })),
    today,
  );

  return (
    <div className="grid gap-5 xl:grid-cols-[18rem_minmax(0,1fr)]">
      <aside className="h-fit space-y-4 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 shadow-[var(--admin-shadow-1)]">
        <div className="flex flex-wrap gap-2">
          <AllianceTypeBadge type={detail.allianceType} />
          <AllianceStatusBadge status={detail.status} />
        </div>
        <Fact label="Responsable" value={detail.ownerName} />
        <Fact label="Contacto" value={detail.contactName || "Sin contacto principal"} detail={detail.email || detail.phone} />
        <Fact
          label="Contrato"
          value={headline ? CONTRACT_STATUS_LABEL[headline.status] : "Sin contrato"}
          detail={headline?.item.expiresOn ? `Vence ${formatAllianceDate(headline.item.expiresOn)}` : undefined}
        />
        <Fact
          label="Siguiente acción"
          value={next.text}
          detail={next.dueOn ? dueHint(next.dueOn, today) : undefined}
          alert={next.overdue}
        />
        <Fact label="Vigencia" value={`${formatAllianceDate(detail.startedOn)} – ${formatAllianceDate(detail.endsOn)}`} />
        {detail.commissionTerms ? <Fact label="Comisión" value={detail.commissionTerms} /> : null}
      </aside>

      <div className="min-w-0 space-y-4">
        <div className="flex gap-1 overflow-x-auto rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-1" role="tablist" aria-label="Ficha de la alianza">
          {TABS.map(([id, label]) => {
            const selected = tab === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={selected}
                className={`shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 ${
                  selected
                    ? "bg-[var(--admin-accent-soft)] text-[var(--admin-accent)]"
                    : "text-[var(--admin-text-muted)] hover:bg-[var(--admin-surface-hover)] hover:text-[var(--admin-text)]"
                }`}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            );
          })}
        </div>

        {tab === "info" ? <InfoTab detail={detail} /> : null}
        {tab === "contacts" ? <ContactsTab allianceId={detail.id} rows={detail.contacts} /> : null}
        {tab === "agreements" ? <AgreementsTab allianceId={detail.id} rows={detail.agreements} /> : null}
        {tab === "contracts" ? <ContractsTab allianceId={detail.id} rows={detail.contracts} today={today} /> : null}
        {tab === "activities" ? <ActivitiesTab allianceId={detail.id} rows={detail.activities} /> : null}
        {tab === "reminders" ? <RemindersTab allianceId={detail.id} rows={detail.reminders} today={today} ownerName={detail.ownerName} /> : null}
        {tab === "files" ? <FilesTab allianceId={detail.id} rows={detail.files} /> : null}
      </div>
    </div>
  );
}

function Fact({
  label,
  value,
  detail,
  alert = false,
}: {
  label: string;
  value: string;
  detail?: string;
  alert?: boolean;
}) {
  return (
    <div>
      <p className="text-[0.6875rem] font-medium uppercase tracking-[0.05em] text-[var(--admin-text-soft)]">{label}</p>
      <p className={`mt-1 text-sm ${alert ? "font-semibold text-[var(--admin-danger)]" : "text-[var(--admin-text)]"}`}>{value}</p>
      {detail ? <p className="mt-0.5 text-xs text-[var(--admin-text-muted)]">{detail}</p> : null}
    </div>
  );
}

function InfoTab({ detail }: { detail: AllianceDetail }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <Panel title="Información general" lede="Quién es la alianza, qué se acordó y qué aporta cada parte.">
      <AllianceEditor key={detail.updatedAt} allianceId={detail.id} initial={detail} submitLabel="Guardar ficha" />
      <div className="mt-6 border-t border-[var(--admin-border)] pt-4">
        <p className="text-sm text-[var(--admin-text-muted)]">Eliminar la alianza borra contratos, contactos, archivos y el historial.</p>
        <div className="mt-3">
          {error ? <p className="mb-2 text-sm text-[var(--admin-danger)]">{error}</p> : null}
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => {
              if (!window.confirm(`¿Eliminar la alianza ${detail.name}? Esta acción no se puede deshacer.`)) return;
              setError("");
              startTransition(async () => {
                const result = await deleteAllianceAction(detail.id);
                if (!result.ok) {
                  setError(result.error);
                  return;
                }
                router.push("/admin/alliances");
                router.refresh();
              });
            }}
          >
            {pending ? "Eliminando…" : "Eliminar alianza"}
          </Button>
        </div>
      </div>
    </Panel>
  );
}

function ContactsTab({ allianceId, rows }: { allianceId: string; rows: AllianceContactRecord[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AllianceContactRecord | null>(null);
  const [name, setName] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function begin(row?: AllianceContactRecord) {
    setEditing(row ?? null);
    setName(row?.name ?? "");
    setRoleTitle(row?.roleTitle ?? "");
    setPhone(row?.phone ?? "");
    setEmail(row?.email ?? "");
    setIsPrimary(row?.isPrimary ?? rows.length === 0);
    setError("");
    setOpen(true);
  }

  return (
    <Panel
      title="Contactos"
      lede="Puede haber varios. El principal también actualiza la ficha."
      action={<Button type="button" variant="secondary" onClick={() => (open ? setOpen(false) : begin())}>{open ? "Cerrar" : "Agregar contacto"}</Button>}
    >
      {open ? (
        <form
          className="mb-5 space-y-3 border-b border-[var(--admin-border)] pb-5"
          onSubmit={(event) => {
            event.preventDefault();
            setError("");
            startTransition(async () => {
              const result = await saveContactAction(allianceId, { name, roleTitle, phone, email, isPrimary }, editing?.id);
              if (!result.ok) {
                setError(result.error);
                return;
              }
              setOpen(false);
              router.refresh();
            });
          }}
        >
          <FormError message={error} />
          <div className="grid gap-3 md:grid-cols-2">
            <TextField label="Nombre" value={name} onChange={(event) => setName(event.target.value)} required />
            <TextField label="Cargo" value={roleTitle} onChange={(event) => setRoleTitle(event.target.value)} />
            <TextField label="Teléfono" value={phone} onChange={(event) => setPhone(event.target.value)} />
            <TextField label="Correo" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm text-[var(--admin-text)]">
            <input type="checkbox" checked={isPrimary} onChange={(event) => setIsPrimary(event.target.checked)} className="h-4 w-4 accent-[var(--admin-accent)]" />
            Contacto principal
          </label>
          <Button type="submit" disabled={pending}>{pending ? "Guardando…" : editing ? "Actualizar contacto" : "Guardar contacto"}</Button>
        </form>
      ) : null}
      {rows.length === 0 ? <Empty text="Aún no hay contactos además de los datos generales." /> : (
        <ul className="divide-y divide-[var(--admin-border)]">
          {rows.map((row) => (
            <li key={row.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium text-[var(--admin-text)]">{row.name}{row.isPrimary ? " · Principal" : ""}</p>
                <p className="text-sm text-[var(--admin-text-muted)]">{[row.roleTitle, row.phone, row.email].filter(Boolean).join(" · ") || "Sin datos de contacto"}</p>
              </div>
              <div className="flex items-center gap-3">
                <button type="button" className="text-xs font-medium text-[var(--admin-accent)]" onClick={() => begin(row)}>Editar</button>
                <ConfirmDelete label="Eliminar" onConfirm={() => deleteContactAction(allianceId, row.id)} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function AgreementsTab({ allianceId, rows }: { allianceId: string; rows: AllianceAgreementRecord[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AllianceAgreementRecord | null>(null);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<AgreementKind>("commission");
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function begin(row?: AllianceAgreementRecord) {
    setEditing(row ?? null);
    setTitle(row?.title ?? "");
    setKind(row?.kind ?? "commission");
    setBody(row?.body ?? "");
    setError("");
    setOpen(true);
  }

  return (
    <Panel
      title="Acuerdos"
      lede="Comisiones, exclusividad, territorios, metas y cualquier condición que no debe quedar en un chat."
      action={<Button type="button" variant="secondary" onClick={() => (open ? setOpen(false) : begin())}>{open ? "Cerrar" : "Agregar acuerdo"}</Button>}
    >
      {open ? (
        <form
          className="mb-5 space-y-3 border-b border-[var(--admin-border)] pb-5"
          onSubmit={(event) => {
            event.preventDefault();
            setError("");
            startTransition(async () => {
              const result = await saveAgreementAction(allianceId, { title, kind, body }, editing?.id);
              if (!result.ok) {
                setError(result.error);
                return;
              }
              setOpen(false);
              router.refresh();
            });
          }}
        >
          <FormError message={error} />
          <div className="grid gap-3 md:grid-cols-2">
            <TextField label="Título" value={title} onChange={(event) => setTitle(event.target.value)} required />
            <SelectField label="Tipo" value={kind} onChange={(event) => setKind(event.target.value as AgreementKind)}>
              {AGREEMENT_KINDS.map((item) => <option key={item} value={item}>{AGREEMENT_KIND_LABEL[item]}</option>)}
            </SelectField>
          </div>
          <AreaField label="Condición" value={body} onChange={(event) => setBody(event.target.value)} required />
          <Button type="submit" disabled={pending}>{pending ? "Guardando…" : "Guardar acuerdo"}</Button>
        </form>
      ) : null}
      {rows.length === 0 ? <Empty text="Todavía no hay condiciones registradas." /> : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li key={row.id} className="rounded-lg border border-[var(--admin-border)] p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.04em] text-[var(--admin-text-soft)]">{AGREEMENT_KIND_LABEL[row.kind]}</p>
                  <p className="mt-1 font-medium text-[var(--admin-text)]">{row.title}</p>
                </div>
                <div className="flex shrink-0 gap-3">
                  <button type="button" className="text-xs font-medium text-[var(--admin-accent)]" onClick={() => begin(row)}>Editar</button>
                  <ConfirmDelete label="Eliminar" onConfirm={() => deleteAgreementAction(allianceId, row.id)} />
                </div>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--admin-text-muted)]">{row.body}</p>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function ContractsTab({
  allianceId,
  rows,
  today,
}: {
  allianceId: string;
  rows: AllianceContractRecord[];
  today: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AllianceContractRecord | null>(null);
  const [contractType, setContractType] = useState<ContractType>("commercial");
  const [version, setVersion] = useState("1");
  const [status, setStatus] = useState<ContractStatus>("draft");
  const [sentOn, setSentOn] = useState("");
  const [expiresOn, setExpiresOn] = useState("");
  const [notes, setNotes] = useState("");
  const [signers, setSigners] = useState<SignerDraft[]>([{ name: "", email: "", roleTitle: "", signedOn: "" }]);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function begin(row?: AllianceContractRecord) {
    setEditing(row ?? null);
    setContractType(row?.contractType ?? "commercial");
    const nextVersion = rows.reduce((max, item) => Math.max(max, item.version), 0) + 1;
    setVersion(String(row?.version ?? nextVersion));
    setStatus(row?.status ?? "draft");
    setSentOn(row?.sentOn ?? "");
    setExpiresOn(row?.expiresOn ?? "");
    setNotes(row?.notes ?? "");
    setSigners(row?.signers.length ? row.signers.map((signer) => ({ name: signer.name, email: signer.email, roleTitle: signer.roleTitle, signedOn: signer.signedOn })) : [{ name: "", email: "", roleTitle: "", signedOn: "" }]);
    setError("");
    setOpen(true);
  }

  return (
    <Panel
      title="Contratos"
      lede="Registro manual del documento, la versión y quién debe firmar. La generación y FirmEasy llegan en fases posteriores."
      action={<Button type="button" variant="secondary" onClick={() => (open ? setOpen(false) : begin())}>{open ? "Cerrar" : "Registrar contrato"}</Button>}
    >
      {open ? (
        <form
          className="mb-5 space-y-3 border-b border-[var(--admin-border)] pb-5"
          onSubmit={(event) => {
            event.preventDefault();
            setError("");
            const form = event.currentTarget;
            const data = new FormData(form);
            data.set("allianceId", allianceId);
            if (editing) data.set("contractId", editing.id);
            data.set("contractType", contractType);
            data.set("version", version);
            data.set("status", status);
            data.set("sentOn", sentOn);
            data.set("expiresOn", expiresOn);
            data.set("notes", notes);
            data.set("signers", JSON.stringify(signers));
            startTransition(async () => {
              const result = await saveContractAction(data);
              if (!result.ok) {
                setError(result.error);
                return;
              }
              setOpen(false);
              form.reset();
              router.refresh();
            });
          }}
        >
          <FormError message={error} />
          <div className="grid gap-3 md:grid-cols-2">
            <SelectField label="Tipo" value={contractType} onChange={(event) => setContractType(event.target.value as ContractType)}>
              {CONTRACT_TYPES.map((item) => <option key={item} value={item}>{CONTRACT_TYPE_LABEL[item]}</option>)}
            </SelectField>
            <TextField label="Versión" type="number" min={1} max={99} value={version} onChange={(event) => setVersion(event.target.value)} />
            <SelectField label="Estado" value={status} onChange={(event) => setStatus(event.target.value as ContractStatus)}>
              {CONTRACT_STATUSES.map((item) => <option key={item} value={item}>{CONTRACT_STATUS_LABEL[item]}</option>)}
            </SelectField>
            <TextField label="Fecha de envío" type="date" value={sentOn} onChange={(event) => setSentOn(event.target.value)} />
            <TextField label="Vencimiento" type="date" value={expiresOn} onChange={(event) => setExpiresOn(event.target.value)} />
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-[var(--admin-text-muted)]">Archivo</span>
              <input name="file" type="file" className={`${fieldClass} py-2`} accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt" />
            </label>
          </div>
          <AreaField label="Notas" value={notes} onChange={(event) => setNotes(event.target.value)} />
          <div className="space-y-2">
            <p className="text-xs font-medium text-[var(--admin-text-muted)]">Firmantes</p>
            {signers.map((signer, index) => (
              <div key={index} className="grid gap-2 md:grid-cols-4">
                <input className={fieldClass} placeholder="Nombre" value={signer.name} onChange={(event) => setSigners((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item))} />
                <input className={fieldClass} placeholder="Correo" value={signer.email} onChange={(event) => setSigners((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, email: event.target.value } : item))} />
                <input className={fieldClass} placeholder="Rol" value={signer.roleTitle} onChange={(event) => setSigners((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, roleTitle: event.target.value } : item))} />
                <input className={fieldClass} type="date" value={signer.signedOn} onChange={(event) => setSigners((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, signedOn: event.target.value } : item))} />
              </div>
            ))}
            {signers.length < 8 ? (
              <button type="button" className="text-xs font-medium text-[var(--admin-accent)]" onClick={() => setSigners((current) => [...current, { name: "", email: "", roleTitle: "", signedOn: "" }])}>
                Agregar firmante
              </button>
            ) : null}
          </div>
          <p className="text-xs text-[var(--admin-text-muted)]">Proveedor de firma: registro manual. El identificador externo se usará cuando se conecte FirmEasy.</p>
          <Button type="submit" disabled={pending}>{pending ? "Guardando…" : "Guardar contrato"}</Button>
        </form>
      ) : null}
      <FormError message={open ? "" : error} />
      {rows.length === 0 ? <Empty text="Esta alianza todavía no tiene contratos ni adendas." /> : (
        <ul className="space-y-3">
          {rows.map((row) => {
            const shown = presentContractStatus(row.status, row.expiresOn || null, today);
            return (
              <li key={row.id} className="rounded-lg border border-[var(--admin-border)] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-[var(--admin-text)]">{CONTRACT_TYPE_LABEL[row.contractType]} · v{row.version}</p>
                    <ContractStatusBadge status={shown} />
                  </div>
                  <div className="flex items-center gap-3">
                    {row.hasFile ? (
                      <button type="button" className="text-xs font-medium text-[var(--admin-accent)]" onClick={() => openDocument(() => openContractFileAction(allianceId, row.id), setError)}>
                        Abrir archivo
                      </button>
                    ) : null}
                    <button type="button" className="text-xs font-medium text-[var(--admin-accent)]" onClick={() => begin(row)}>Editar</button>
                    <ConfirmDelete label="Eliminar" onConfirm={() => deleteContractAction(allianceId, row.id)} />
                  </div>
                </div>
                <p className="mt-2 text-sm text-[var(--admin-text-muted)]">
                  {row.fileName || "Sin archivo"} · Enviado {formatAllianceDate(row.sentOn)} · Vence {formatAllianceDate(row.expiresOn)}
                </p>
                {row.signers.length > 0 ? (
                  <ul className="mt-2 text-sm text-[var(--admin-text)]">
                    {row.signers.map((signer) => (
                      <li key={signer.id}>{signer.name}{signer.roleTitle ? ` · ${signer.roleTitle}` : ""}{signer.signedOn ? ` · firmó ${formatAllianceDate(signer.signedOn)}` : ""}</li>
                    ))}
                  </ul>
                ) : null}
                {row.notes ? <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--admin-text-muted)]">{row.notes}</p> : null}
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

function ActivitiesTab({ allianceId, rows }: { allianceId: string; rows: AllianceActivityRecord[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<ActivityKind>("meeting");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [occurredAt, setOccurredAt] = useState(localDateTime(new Date().toISOString()));
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <Panel
      title="Actividades"
      lede="Línea de tiempo de reuniones, llamadas, acuerdos y cambios."
      action={<Button type="button" variant="secondary" onClick={() => setOpen((value) => !value)}>{open ? "Cerrar" : "Registrar actividad"}</Button>}
    >
      {open ? (
        <form
          className="mb-5 space-y-3 border-b border-[var(--admin-border)] pb-5"
          onSubmit={(event) => {
            event.preventDefault();
            setError("");
            startTransition(async () => {
              const result = await saveActivityAction(allianceId, { kind, title, body, occurredAt });
              if (!result.ok) {
                setError(result.error);
                return;
              }
              setTitle("");
              setBody("");
              setOpen(false);
              router.refresh();
            });
          }}
        >
          <FormError message={error} />
          <div className="grid gap-3 md:grid-cols-2">
            <SelectField label="Tipo" value={kind} onChange={(event) => setKind(event.target.value as ActivityKind)}>
              {ACTIVITY_KINDS.map((item) => <option key={item} value={item}>{ACTIVITY_KIND_LABEL[item]}</option>)}
            </SelectField>
            <TextField label="Cuándo" type="datetime-local" value={occurredAt} onChange={(event) => setOccurredAt(event.target.value)} required />
          </div>
          <TextField label="Qué ocurrió" value={title} onChange={(event) => setTitle(event.target.value)} required />
          <AreaField label="Detalle" value={body} onChange={(event) => setBody(event.target.value)} />
          <Button type="submit" disabled={pending}>{pending ? "Guardando…" : "Guardar actividad"}</Button>
        </form>
      ) : null}
      {rows.length === 0 ? <Empty text="El historial empieza con la primera reunión o llamada." /> : (
        <ol className="space-y-0">
          {rows.map((row) => (
            <li key={row.id} className="relative border-l border-[var(--admin-border)] py-3 pl-4">
              <span className="absolute -left-1 top-5 h-2 w-2 rounded-full bg-[var(--admin-accent)]" aria-hidden />
              <p className="text-xs text-[var(--admin-text-soft)]">{ACTIVITY_KIND_LABEL[row.kind]} · {formatDateTime(row.occurredAt)}</p>
              <div className="mt-1 flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-[var(--admin-text)]">{row.title}</p>
                  {row.body ? <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--admin-text-muted)]">{row.body}</p> : null}
                </div>
                <ConfirmDelete label="Eliminar" onConfirm={() => deleteActivityAction(allianceId, row.id)} />
              </div>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}

function RemindersTab({
  allianceId,
  rows,
  today,
  ownerName,
}: {
  allianceId: string;
  rows: AllianceReminderRecord[];
  today: string;
  ownerName: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AllianceReminderRecord | null>(null);
  const [title, setTitle] = useState("");
  const [dueOn, setDueOn] = useState("");
  const [priority, setPriority] = useState<ReminderPriority>("normal");
  const [status, setStatus] = useState<ReminderStatus>("open");
  const [owner, setOwner] = useState(ownerName);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function begin(row?: AllianceReminderRecord) {
    setEditing(row ?? null);
    setTitle(row?.title ?? "");
    setDueOn(row?.dueOn ?? "");
    setPriority(row?.priority ?? "normal");
    setStatus(row?.status ?? "open");
    setOwner(row?.ownerName || ownerName);
    setNotes(row?.notes ?? "");
    setError("");
    setOpen(true);
  }

  const ordered = [...rows].sort((a, b) => {
    if (a.status === "open" && b.status !== "open") return -1;
    if (b.status === "open" && a.status !== "open") return 1;
    return a.dueOn.localeCompare(b.dueOn);
  });

  return (
    <Panel
      title="Recordatorios"
      lede="Seguimientos, renovaciones y tareas con fecha. El más próximo abierto aparece como siguiente acción."
      action={<Button type="button" variant="secondary" onClick={() => (open ? setOpen(false) : begin())}>{open ? "Cerrar" : "Nuevo recordatorio"}</Button>}
    >
      {open ? (
        <form
          className="mb-5 space-y-3 border-b border-[var(--admin-border)] pb-5"
          onSubmit={(event) => {
            event.preventDefault();
            setError("");
            startTransition(async () => {
              const result = await saveReminderAction(allianceId, { title, dueOn, priority, status, ownerName: owner, notes }, editing?.id);
              if (!result.ok) {
                setError(result.error);
                return;
              }
              setOpen(false);
              router.refresh();
            });
          }}
        >
          <FormError message={error} />
          <div className="grid gap-3 md:grid-cols-2">
            <TextField label="Recordatorio" value={title} onChange={(event) => setTitle(event.target.value)} required />
            <TextField label="Fecha" type="date" value={dueOn} onChange={(event) => setDueOn(event.target.value)} required />
            <SelectField label="Prioridad" value={priority} onChange={(event) => setPriority(event.target.value as ReminderPriority)}>
              {REMINDER_PRIORITIES.map((item) => <option key={item} value={item}>{REMINDER_PRIORITY_LABEL[item]}</option>)}
            </SelectField>
            <SelectField label="Estado" value={status} onChange={(event) => setStatus(event.target.value as ReminderStatus)}>
              {REMINDER_STATUSES.map((item) => <option key={item} value={item}>{REMINDER_STATUS_LABEL[item]}</option>)}
            </SelectField>
            <TextField label="Responsable" value={owner} onChange={(event) => setOwner(event.target.value)} />
          </div>
          <AreaField label="Notas" value={notes} onChange={(event) => setNotes(event.target.value)} />
          <Button type="submit" disabled={pending}>{pending ? "Guardando…" : "Guardar recordatorio"}</Button>
        </form>
      ) : null}
      {ordered.length === 0 ? <Empty text="No hay seguimientos programados." /> : (
        <ul className="divide-y divide-[var(--admin-border)]">
          {ordered.map((row) => {
            const overdue = row.status === "open" && row.dueOn < today;
            return (
              <li key={row.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className={`font-medium ${overdue ? "text-[var(--admin-danger)]" : "text-[var(--admin-text)]"}`}>{row.title}</p>
                  <p className="text-sm text-[var(--admin-text-muted)]">
                    {formatAllianceDate(row.dueOn)} · {dueHint(row.dueOn, today)} · {REMINDER_PRIORITY_LABEL[row.priority]} · {REMINDER_STATUS_LABEL[row.status]}
                    {row.ownerName ? ` · ${row.ownerName}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button type="button" className="text-xs font-medium text-[var(--admin-accent)]" onClick={() => begin(row)}>Editar</button>
                  <ConfirmDelete label="Eliminar" onConfirm={() => deleteReminderAction(allianceId, row.id)} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

function FilesTab({ allianceId, rows }: { allianceId: string; rows: AllianceFileRecord[] }) {
  const router = useRouter();
  const [category, setCategory] = useState<FileCategory>("proposal");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <Panel title="Archivos" lede="Propuestas, anexos y documentos comerciales de esta alianza. Máximo 10 MB.">
      <form
        className="mb-5 grid gap-3 border-b border-[var(--admin-border)] pb-5 md:grid-cols-[14rem_1fr_auto] md:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          setError("");
          const form = event.currentTarget;
          const data = new FormData(form);
          data.set("allianceId", allianceId);
          data.set("category", category);
          startTransition(async () => {
            const result = await uploadAllianceFileAction(data);
            if (!result.ok) {
              setError(result.error);
              return;
            }
            form.reset();
            setCategory("proposal");
            router.refresh();
          });
        }}
      >
        <SelectField label="Categoría" value={category} onChange={(event) => setCategory(event.target.value as FileCategory)}>
          {FILE_CATEGORIES.map((item) => <option key={item} value={item}>{FILE_CATEGORY_LABEL[item]}</option>)}
        </SelectField>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-[var(--admin-text-muted)]">Archivo</span>
          <input name="file" type="file" required className={`${fieldClass} py-2`} accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt" />
        </label>
        <Button type="submit" disabled={pending}>{pending ? "Subiendo…" : "Subir"}</Button>
        <div className="md:col-span-3"><FormError message={error} /></div>
      </form>
      {rows.length === 0 ? <Empty text="El repositorio de esta alianza está vacío." /> : (
        <ul className="divide-y divide-[var(--admin-border)]">
          {rows.map((row) => (
            <li key={row.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium text-[var(--admin-text)]">{row.name}</p>
                <p className="text-sm text-[var(--admin-text-muted)]">{FILE_CATEGORY_LABEL[row.category]} · {formatBytes(row.sizeBytes)} · {formatDateTime(row.createdAt)}</p>
              </div>
              <div className="flex items-center gap-3">
                <button type="button" className="text-xs font-medium text-[var(--admin-accent)]" onClick={() => openDocument(() => openAllianceFileAction(allianceId, row.id), setError)}>
                  Abrir
                </button>
                <ConfirmDelete label="Eliminar" onConfirm={() => deleteAllianceFileAction(allianceId, row.id)} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-sm text-[var(--admin-text-muted)]">{text}</p>;
}

function openDocument(
  load: () => Promise<{ ok: true; url: string } | { ok: false; error: string }>,
  setError: (message: string) => void,
) {
  void load().then((result) => {
    if (!result.ok) {
      setError(result.error);
      return;
    }
    window.open(result.url, "_blank", "noopener,noreferrer");
  });
}
