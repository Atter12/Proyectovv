/** Programa de alianzas comerciales (fase 1). Sin firma externa ni automatizaciones. */

export const ALLIANCE_TYPES = ["ecommerce", "agency", "commercial", "partner", "other"] as const;
export type AllianceType = (typeof ALLIANCE_TYPES)[number];

export const ALLIANCE_STATUSES = ["negotiating", "active", "paused", "ended"] as const;
export type AllianceStatus = (typeof ALLIANCE_STATUSES)[number];

export const CONTRACT_TYPES = ["commercial", "nda", "addendum", "renewal", "other"] as const;
export type ContractType = (typeof CONTRACT_TYPES)[number];

export const CONTRACT_STATUSES = [
  "draft",
  "in_review",
  "pending_signature",
  "signed",
  "expiring",
  "expired",
  "renewed",
] as const;
export type ContractStatus = (typeof CONTRACT_STATUSES)[number];

export const AGREEMENT_KINDS = [
  "commission",
  "responsibility",
  "deliverable",
  "exclusivity",
  "territory",
  "target",
  "other",
] as const;
export type AgreementKind = (typeof AGREEMENT_KINDS)[number];

export const ACTIVITY_KINDS = ["meeting", "call", "agreement", "message", "incident", "change"] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

export const REMINDER_PRIORITIES = ["low", "normal", "high"] as const;
export type ReminderPriority = (typeof REMINDER_PRIORITIES)[number];

export const REMINDER_STATUSES = ["open", "done", "cancelled"] as const;
export type ReminderStatus = (typeof REMINDER_STATUSES)[number];

export const FILE_CATEGORIES = ["proposal", "annex", "presentation", "commercial", "legal", "other"] as const;
export type FileCategory = (typeof FILE_CATEGORIES)[number];

export const ALLIANCE_FILES_BUCKET = "alliance-files";
export const ALLIANCE_FILE_MAX_BYTES = 10 * 1024 * 1024;
export const CONTRACT_EXPIRING_WINDOW_DAYS = 30;

const ALLOWED_FILE_EXTENSIONS = new Set([
  "pdf",
  "png",
  "jpg",
  "jpeg",
  "webp",
  "doc",
  "docx",
  "ppt",
  "pptx",
  "xls",
  "xlsx",
  "txt",
]);

export const ALLIANCE_TYPE_LABEL: Record<AllianceType, string> = {
  ecommerce: "Ecommerce",
  agency: "Agencia",
  commercial: "Comercial",
  partner: "Partner",
  other: "Otra",
};

export const ALLIANCE_STATUS_LABEL: Record<AllianceStatus, string> = {
  negotiating: "Negociación",
  active: "Activa",
  paused: "Pausada",
  ended: "Finalizada",
};

export const CONTRACT_TYPE_LABEL: Record<ContractType, string> = {
  commercial: "Alianza comercial",
  nda: "NDA",
  addendum: "Adenda",
  renewal: "Renovación",
  other: "Otro",
};

export const CONTRACT_STATUS_LABEL: Record<ContractStatus, string> = {
  draft: "Borrador",
  in_review: "Pendiente de revisión",
  pending_signature: "Pendiente de firma",
  signed: "Firmado",
  expiring: "Por vencer",
  expired: "Vencido",
  renewed: "Renovado",
};

export const AGREEMENT_KIND_LABEL: Record<AgreementKind, string> = {
  commission: "Comisión",
  responsibility: "Responsabilidad",
  deliverable: "Entregable",
  exclusivity: "Exclusividad",
  territory: "Territorio",
  target: "Meta",
  other: "Otra condición",
};

export const ACTIVITY_KIND_LABEL: Record<ActivityKind, string> = {
  meeting: "Reunión",
  call: "Llamada",
  agreement: "Acuerdo",
  message: "Mensaje",
  incident: "Incidencia",
  change: "Cambio",
};

export const REMINDER_PRIORITY_LABEL: Record<ReminderPriority, string> = {
  low: "Baja",
  normal: "Normal",
  high: "Alta",
};

export const REMINDER_STATUS_LABEL: Record<ReminderStatus, string> = {
  open: "Pendiente",
  done: "Hecho",
  cancelled: "Cancelado",
};

export const FILE_CATEGORY_LABEL: Record<FileCategory, string> = {
  proposal: "Propuesta",
  annex: "Anexo",
  presentation: "Presentación",
  commercial: "Documento comercial",
  legal: "Documento legal",
  other: "Otro",
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type FieldResult<T> = { ok: true; value: T } | { ok: false; error: string };

export interface AllianceDraft {
  name: string;
  allianceType: AllianceType;
  status: AllianceStatus;
  ownerName: string;
  contactName: string;
  phone: string;
  email: string;
  startedOn: string;
  endsOn: string;
  summary: string;
  ourContribution: string;
  theirContribution: string;
  commissionTerms: string;
  nextAction: string;
}

export interface ContactDraft {
  name: string;
  roleTitle: string;
  phone: string;
  email: string;
  isPrimary: boolean;
}

export interface AgreementDraft {
  title: string;
  kind: AgreementKind;
  body: string;
}

export interface SignerDraft {
  name: string;
  email: string;
  roleTitle: string;
  signedOn: string;
}

export interface ContractDraft {
  contractType: ContractType;
  version: number;
  status: ContractStatus;
  sentOn: string;
  expiresOn: string;
  notes: string;
  signers: SignerDraft[];
}

export interface ActivityDraft {
  kind: ActivityKind;
  title: string;
  body: string;
  occurredAt: string;
}

export interface ReminderDraft {
  title: string;
  dueOn: string;
  priority: ReminderPriority;
  status: ReminderStatus;
  ownerName: string;
  notes: string;
}

export interface AllianceReminderLite {
  title: string;
  dueOn: string;
  status: ReminderStatus;
}

export interface AllianceContractLite {
  status: ContractStatus;
  expiresOn: string | null;
}

export interface AllianceListRow {
  id: string;
  name: string;
  allianceType: AllianceType;
  status: AllianceStatus;
  ownerName: string;
  contactName: string;
  email: string;
  contractStatus: ContractStatus | null;
  nextAction: string;
  nextActionDueOn: string | null;
  nextActionOverdue: boolean;
  needsAttention: boolean;
}

export interface AllianceHomeStats {
  active: number;
  negotiating: number;
  pendingSignature: number;
  needsAttention: number;
}

export function todayInLima(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function addIsoDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const utc = new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1));
  utc.setUTCDate(utc.getUTCDate() + days);
  return utc.toISOString().slice(0, 10);
}

export function daysBetween(today: string, date: string): number {
  const start = Date.parse(`${today}T00:00:00Z`);
  const end = Date.parse(`${date}T00:00:00Z`);
  return Math.round((end - start) / 86_400_000);
}

export function formatAllianceDate(value: string | null | undefined): string {
  if (!value) return "—";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return "—";
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return new Intl.DateTimeFormat("es-PE", { dateStyle: "medium" }).format(date);
}

export function dueHint(dueOn: string, today: string): string {
  const days = daysBetween(today, dueOn);
  if (days === 0) return "Hoy";
  if (days === 1) return "Mañana";
  if (days > 1) return `En ${days} días`;
  if (days === -1) return "Ayer";
  return `Hace ${Math.abs(days)} días`;
}

export function isAllianceId(value: string): boolean {
  return UUID_RE.test(value);
}

export function presentContractStatus(
  status: ContractStatus,
  expiresOn: string | null | undefined,
  today: string,
): ContractStatus {
  if (!expiresOn || status === "draft" || status === "in_review" || status === "renewed") {
    return status;
  }
  if (expiresOn < today) {
    return status === "pending_signature" ? status : "expired";
  }
  if (status === "expired") return status;
  const horizon = addIsoDays(today, CONTRACT_EXPIRING_WINDOW_DAYS);
  if ((status === "signed" || status === "expiring") && expiresOn <= horizon) {
    return "expiring";
  }
  if (status === "expiring") return "signed";
  return status;
}

const HEADLINE_RANK: Record<ContractStatus, number> = {
  pending_signature: 1,
  expiring: 2,
  expired: 3,
  in_review: 4,
  draft: 5,
  signed: 6,
  renewed: 7,
};

export function pickHeadlineContract<T extends AllianceContractLite>(
  contracts: T[],
  today: string,
): { item: T; status: ContractStatus } | null {
  let best: { item: T; status: ContractStatus } | null = null;
  for (const item of contracts) {
    const status = presentContractStatus(item.status, item.expiresOn, today);
    if (!best || HEADLINE_RANK[status] < HEADLINE_RANK[best.status]) {
      best = { item, status };
    }
  }
  return best;
}

export function describeNextAction(
  manual: string,
  reminders: AllianceReminderLite[],
  today: string,
): { text: string; dueOn: string | null; overdue: boolean } {
  const open = reminders
    .filter((reminder) => reminder.status === "open" && DATE_RE.test(reminder.dueOn))
    .sort((a, b) => a.dueOn.localeCompare(b.dueOn));
  const next = open[0];
  if (next) {
    return {
      text: next.title.trim() || "Seguimiento",
      dueOn: next.dueOn,
      overdue: next.dueOn < today,
    };
  }
  const trimmed = manual.trim();
  return { text: trimmed || "Sin siguiente acción", dueOn: null, overdue: false };
}

export function buildAllianceListRow(input: {
  id: string;
  name: string;
  allianceType: AllianceType;
  status: AllianceStatus;
  ownerName: string;
  contactName: string;
  email: string;
  nextAction: string;
  contracts: AllianceContractLite[];
  reminders: AllianceReminderLite[];
  today: string;
}): AllianceListRow {
  const headline = pickHeadlineContract(input.contracts, input.today);
  const action = describeNextAction(input.nextAction, input.reminders, input.today);
  const contractStatus = headline?.status ?? null;
  const needsAttention =
    action.overdue ||
    contractStatus === "pending_signature" ||
    contractStatus === "expiring" ||
    contractStatus === "expired";

  return {
    id: input.id,
    name: input.name,
    allianceType: input.allianceType,
    status: input.status,
    ownerName: input.ownerName,
    contactName: input.contactName,
    email: input.email,
    contractStatus,
    nextAction: action.text,
    nextActionDueOn: action.dueOn,
    nextActionOverdue: action.overdue,
    needsAttention,
  };
}

export function summarizeAllianceHome(
  rows: AllianceListRow[],
  contracts: AllianceContractLite[],
  today: string,
): AllianceHomeStats {
  return {
    active: rows.filter((row) => row.status === "active").length,
    negotiating: rows.filter((row) => row.status === "negotiating").length,
    pendingSignature: contracts.filter(
      (contract) => presentContractStatus(contract.status, contract.expiresOn, today) === "pending_signature",
    ).length,
    needsAttention: rows.filter((row) => row.needsAttention).length,
  };
}

export function allianceInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "?";
  const second = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : (parts[0]?.[1] ?? "");
  return `${first}${second}`.toUpperCase();
}

export function safeStorageFileName(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? "archivo";
  const cleaned = base
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w.\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return (cleaned.slice(0, 80) || "archivo").toLowerCase();
}

export function fileExtension(name: string): string {
  const base = safeStorageFileName(name);
  const dot = base.lastIndexOf(".");
  return dot >= 0 ? base.slice(dot + 1) : "";
}

export function isAllowedAllianceFile(name: string, size: number): FieldResult<{ extension: string }> {
  if (!Number.isFinite(size) || size <= 0) return { ok: false, error: "El archivo está vacío." };
  if (size > ALLIANCE_FILE_MAX_BYTES) {
    return { ok: false, error: "El archivo supera el límite de 10 MB." };
  }
  const extension = fileExtension(name);
  if (!ALLOWED_FILE_EXTENSIONS.has(extension)) {
    return { ok: false, error: "Formato no admitido. Usa PDF, Office o imagen." };
  }
  return { ok: true, value: { extension } };
}

function cleanText(value: string, max: number): string {
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

function cleanBlock(value: string, max: number): string {
  return value.replace(/\r\n/g, "\n").trim().slice(0, max);
}

function optionalDate(value: string, label: string): FieldResult<string> {
  const trimmed = value.trim();
  if (!trimmed) return { ok: true, value: "" };
  if (!DATE_RE.test(trimmed) || Number.isNaN(Date.parse(`${trimmed}T00:00:00Z`))) {
    return { ok: false, error: `${label} no es una fecha válida.` };
  }
  return { ok: true, value: trimmed };
}

function optionalEmail(value: string): FieldResult<string> {
  const email = value.trim().toLowerCase();
  if (!email) return { ok: true, value: "" };
  if (email.length > 160 || !EMAIL_RE.test(email)) {
    return { ok: false, error: "El correo no es válido." };
  }
  return { ok: true, value: email };
}

function oneOf<T extends string>(value: string, allowed: readonly T[], label: string): FieldResult<T> {
  if ((allowed as readonly string[]).includes(value)) return { ok: true, value: value as T };
  return { ok: false, error: `${label} no es válido.` };
}

export function parseAllianceDraft(input: AllianceDraft): FieldResult<AllianceDraft> {
  const name = cleanText(input.name, 160);
  const ownerName = cleanText(input.ownerName, 120);
  if (name.length < 2) return { ok: false, error: "Escribe el nombre de la alianza." };
  if (ownerName.length < 2) return { ok: false, error: "Indica el responsable interno." };

  const allianceType = oneOf(input.allianceType, ALLIANCE_TYPES, "El tipo");
  if (!allianceType.ok) return allianceType;
  const status = oneOf(input.status, ALLIANCE_STATUSES, "El estado");
  if (!status.ok) return status;

  const email = optionalEmail(input.email);
  if (!email.ok) return email;
  const startedOn = optionalDate(input.startedOn, "La fecha de inicio");
  if (!startedOn.ok) return startedOn;
  const endsOn = optionalDate(input.endsOn, "La fecha de término");
  if (!endsOn.ok) return endsOn;
  if (startedOn.value && endsOn.value && endsOn.value < startedOn.value) {
    return { ok: false, error: "La fecha de término no puede ser anterior al inicio." };
  }

  return {
    ok: true,
    value: {
      name,
      allianceType: allianceType.value,
      status: status.value,
      ownerName,
      contactName: cleanText(input.contactName, 120),
      phone: cleanText(input.phone, 40),
      email: email.value,
      startedOn: startedOn.value,
      endsOn: endsOn.value,
      summary: cleanBlock(input.summary, 4000),
      ourContribution: cleanBlock(input.ourContribution, 2000),
      theirContribution: cleanBlock(input.theirContribution, 2000),
      commissionTerms: cleanText(input.commissionTerms, 240),
      nextAction: cleanText(input.nextAction, 240),
    },
  };
}

export function emptyAllianceDraft(): AllianceDraft {
  return {
    name: "",
    allianceType: "ecommerce",
    status: "negotiating",
    ownerName: "",
    contactName: "",
    phone: "",
    email: "",
    startedOn: "",
    endsOn: "",
    summary: "",
    ourContribution: "",
    theirContribution: "",
    commissionTerms: "",
    nextAction: "",
  };
}

export function parseContactDraft(input: ContactDraft): FieldResult<ContactDraft> {
  const name = cleanText(input.name, 120);
  if (name.length < 2) return { ok: false, error: "Escribe el nombre del contacto." };
  const email = optionalEmail(input.email);
  if (!email.ok) return email;
  return {
    ok: true,
    value: {
      name,
      roleTitle: cleanText(input.roleTitle, 120),
      phone: cleanText(input.phone, 40),
      email: email.value,
      isPrimary: Boolean(input.isPrimary),
    },
  };
}

export function parseAgreementDraft(input: AgreementDraft): FieldResult<AgreementDraft> {
  const title = cleanText(input.title, 160);
  const body = cleanBlock(input.body, 4000);
  if (title.length < 2) return { ok: false, error: "Escribe el título del acuerdo." };
  if (body.length < 2) return { ok: false, error: "Describe la condición acordada." };
  const kind = oneOf(input.kind, AGREEMENT_KINDS, "El tipo de acuerdo");
  if (!kind.ok) return kind;
  return { ok: true, value: { title, kind: kind.value, body } };
}

export function parseContractDraft(input: ContractDraft): FieldResult<ContractDraft> {
  const contractType = oneOf(input.contractType, CONTRACT_TYPES, "El tipo de contrato");
  if (!contractType.ok) return contractType;
  const status = oneOf(input.status, CONTRACT_STATUSES, "El estado del contrato");
  if (!status.ok) return status;
  const version = Number(input.version);
  if (!Number.isInteger(version) || version < 1 || version > 99) {
    return { ok: false, error: "La versión debe ser un número entre 1 y 99." };
  }
  const sentOn = optionalDate(input.sentOn, "La fecha de envío");
  if (!sentOn.ok) return sentOn;
  const expiresOn = optionalDate(input.expiresOn, "El vencimiento");
  if (!expiresOn.ok) return expiresOn;
  if (input.signers.length > 8) return { ok: false, error: "Un contrato admite hasta 8 firmantes." };

  const signers: SignerDraft[] = [];
  for (const signer of input.signers) {
    const name = cleanText(signer.name, 120);
    const email = optionalEmail(signer.email);
    if (!email.ok) return email;
    const signedOn = optionalDate(signer.signedOn, "La fecha de firma");
    if (!signedOn.ok) return signedOn;
    if (!name && !email.value && !signer.roleTitle.trim() && !signedOn.value) continue;
    if (name.length < 2) return { ok: false, error: "Cada firmante necesita un nombre." };
    signers.push({
      name,
      email: email.value,
      roleTitle: cleanText(signer.roleTitle, 120),
      signedOn: signedOn.value,
    });
  }

  return {
    ok: true,
    value: {
      contractType: contractType.value,
      version,
      status: status.value,
      sentOn: sentOn.value,
      expiresOn: expiresOn.value,
      notes: cleanBlock(input.notes, 2000),
      signers,
    },
  };
}

export function parseActivityDraft(input: ActivityDraft): FieldResult<ActivityDraft> {
  const kind = oneOf(input.kind, ACTIVITY_KINDS, "El tipo de actividad");
  if (!kind.ok) return kind;
  const title = cleanText(input.title, 160);
  if (title.length < 2) return { ok: false, error: "Escribe qué ocurrió." };
  const occurredAt = input.occurredAt.trim();
  const when = new Date(occurredAt);
  if (!occurredAt || Number.isNaN(when.getTime())) {
    return { ok: false, error: "Indica la fecha de la actividad." };
  }
  return {
    ok: true,
    value: {
      kind: kind.value,
      title,
      body: cleanBlock(input.body, 4000),
      occurredAt: when.toISOString(),
    },
  };
}

export function parseReminderDraft(input: ReminderDraft): FieldResult<ReminderDraft> {
  const title = cleanText(input.title, 160);
  if (title.length < 2) return { ok: false, error: "Escribe el recordatorio." };
  const dueOn = optionalDate(input.dueOn, "La fecha");
  if (!dueOn.ok) return dueOn;
  if (!dueOn.value) return { ok: false, error: "El recordatorio necesita una fecha." };
  const priority = oneOf(input.priority, REMINDER_PRIORITIES, "La prioridad");
  if (!priority.ok) return priority;
  const status = oneOf(input.status, REMINDER_STATUSES, "El estado");
  if (!status.ok) return status;
  return {
    ok: true,
    value: {
      title,
      dueOn: dueOn.value,
      priority: priority.value,
      status: status.value,
      ownerName: cleanText(input.ownerName, 120),
      notes: cleanBlock(input.notes, 2000),
    },
  };
}

export function parseFileCategory(value: string): FieldResult<FileCategory> {
  return oneOf(value, FILE_CATEGORIES, "La categoría del archivo");
}
