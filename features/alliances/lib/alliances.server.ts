import "server-only";
import {
  buildAllianceListRow,
  isAllianceId,
  summarizeAllianceHome,
  todayInLima,
  type ActivityKind,
  type AgreementKind,
  type AllianceContractLite,
  type AllianceStatus,
  type AllianceType,
  type ContractStatus,
  type ContractType,
  type FileCategory,
  type ReminderPriority,
  type ReminderStatus,
} from "@/features/alliances/lib/domain";
import type {
  AllianceContractRecord,
  AllianceDetail,
  AllianceHome,
} from "@/features/alliances/lib/view";
import { createAdminClient } from "@/lib/supabase/admin";

export type { AllianceDetail, AllianceHome };

type LoadResult<T> = { ok: true; data: T } | { ok: false; error: "missing_table" | "unknown" };

function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const message = (error.message ?? "").toLowerCase();
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    message.includes("alliances") ||
    message.includes("alliance_")
  );
}

function text(value: string | null | undefined): string {
  return value ?? "";
}

interface SignerRow {
  id: string;
  name: string;
  email: string | null;
  role_title: string | null;
  signed_on: string | null;
}

interface ContractRow {
  id: string;
  contract_type: ContractType;
  version: number;
  status: ContractStatus;
  sent_on: string | null;
  expires_on: string | null;
  notes: string | null;
  file_name: string | null;
  storage_path: string | null;
  signature_provider: string | null;
  external_ref: string | null;
  updated_at: string;
  alliance_contract_signers: SignerRow[] | null;
}

interface ContactRow {
  id: string;
  name: string;
  role_title: string | null;
  phone: string | null;
  email: string | null;
  is_primary: boolean;
}

interface AgreementRow {
  id: string;
  title: string;
  kind: AgreementKind;
  body: string;
}

interface ActivityRow {
  id: string;
  kind: ActivityKind;
  title: string;
  body: string | null;
  occurred_at: string;
}

interface ReminderRow {
  id: string;
  title: string;
  due_on: string;
  priority: ReminderPriority;
  status: ReminderStatus;
  owner_name: string | null;
  notes: string | null;
}

interface FileRow {
  id: string;
  name: string;
  category: FileCategory;
  size_bytes: number | null;
  created_at: string;
}

interface AllianceRow {
  id: string;
  name: string;
  alliance_type: AllianceType;
  status: AllianceStatus;
  owner_name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  started_on: string | null;
  ends_on: string | null;
  summary: string | null;
  our_contribution: string | null;
  their_contribution: string | null;
  commission_terms: string | null;
  next_action: string | null;
  updated_at: string;
  alliance_contacts?: ContactRow[] | null;
  alliance_agreements?: AgreementRow[] | null;
  alliance_contracts?: ContractRow[] | null;
  alliance_activities?: ActivityRow[] | null;
  alliance_reminders?: ReminderRow[] | null;
  alliance_files?: FileRow[] | null;
}

function mapContract(row: ContractRow): AllianceContractRecord {
  return {
    id: row.id,
    contractType: row.contract_type,
    version: row.version,
    status: row.status,
    sentOn: text(row.sent_on),
    expiresOn: text(row.expires_on),
    notes: text(row.notes),
    fileName: text(row.file_name),
    hasFile: Boolean(row.storage_path),
    signatureProvider: text(row.signature_provider) || "manual",
    externalRef: text(row.external_ref),
    updatedAt: row.updated_at,
    signers: (row.alliance_contract_signers ?? []).map((signer) => ({
      id: signer.id,
      name: signer.name,
      email: text(signer.email),
      roleTitle: text(signer.role_title),
      signedOn: text(signer.signed_on),
    })),
  };
}

function mapDetail(row: AllianceRow): AllianceDetail {
  const contracts = [...(row.alliance_contracts ?? [])]
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .map(mapContract);
  const reminders = [...(row.alliance_reminders ?? [])].sort((a, b) => a.due_on.localeCompare(b.due_on));
  const activities = [...(row.alliance_activities ?? [])].sort((a, b) =>
    b.occurred_at.localeCompare(a.occurred_at),
  );
  const files = [...(row.alliance_files ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at));

  return {
    id: row.id,
    name: row.name,
    allianceType: row.alliance_type,
    status: row.status,
    ownerName: row.owner_name,
    contactName: text(row.contact_name),
    phone: text(row.phone),
    email: text(row.email),
    startedOn: text(row.started_on),
    endsOn: text(row.ends_on),
    summary: text(row.summary),
    ourContribution: text(row.our_contribution),
    theirContribution: text(row.their_contribution),
    commissionTerms: text(row.commission_terms),
    nextAction: text(row.next_action),
    updatedAt: row.updated_at,
    contacts: (row.alliance_contacts ?? [])
      .map((contact) => ({
        id: contact.id,
        name: contact.name,
        roleTitle: text(contact.role_title),
        phone: text(contact.phone),
        email: text(contact.email),
        isPrimary: contact.is_primary,
      }))
      .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.name.localeCompare(b.name, "es")),
    agreements: (row.alliance_agreements ?? []).map((agreement) => ({
      id: agreement.id,
      title: agreement.title,
      kind: agreement.kind,
      body: agreement.body,
    })),
    contracts,
    activities: activities.map((activity) => ({
      id: activity.id,
      kind: activity.kind,
      title: activity.title,
      body: text(activity.body),
      occurredAt: activity.occurred_at,
    })),
    reminders: reminders.map((reminder) => ({
      id: reminder.id,
      title: reminder.title,
      dueOn: reminder.due_on,
      priority: reminder.priority,
      status: reminder.status,
      ownerName: text(reminder.owner_name),
      notes: text(reminder.notes),
    })),
    files: files.map((file) => ({
      id: file.id,
      name: file.name,
      category: file.category,
      sizeBytes: Number(file.size_bytes ?? 0),
      createdAt: file.created_at,
    })),
  };
}

const LIST_SELECT = `
  id, name, alliance_type, status, owner_name, contact_name, email, next_action,
  alliance_contracts ( status, expires_on ),
  alliance_reminders ( title, due_on, status )
`;

const DETAIL_SELECT = `
  id, name, alliance_type, status, owner_name, contact_name, phone, email,
  started_on, ends_on, summary, our_contribution, their_contribution, commission_terms,
  next_action, updated_at,
  alliance_contacts ( id, name, role_title, phone, email, is_primary ),
  alliance_agreements ( id, title, kind, body ),
  alliance_contracts (
    id, contract_type, version, status, sent_on, expires_on, notes, file_name,
    storage_path, signature_provider, external_ref, updated_at,
    alliance_contract_signers ( id, name, email, role_title, signed_on )
  ),
  alliance_activities ( id, kind, title, body, occurred_at ),
  alliance_reminders ( id, title, due_on, priority, status, owner_name, notes ),
  alliance_files ( id, name, category, size_bytes, created_at )
`;

export async function listAlliances(): Promise<LoadResult<AllianceHome>> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("alliances")
      .select(LIST_SELECT)
      .order("updated_at", { ascending: false });
    if (error) return { ok: false, error: isMissingTable(error) ? "missing_table" : "unknown" };

    const today = todayInLima();
    const source = (data ?? []) as unknown as Array<{
      id: string;
      name: string;
      alliance_type: AllianceType;
      status: AllianceStatus;
      owner_name: string;
      contact_name: string | null;
      email: string | null;
      next_action: string | null;
      alliance_contracts: Array<{ status: ContractStatus; expires_on: string | null }> | null;
      alliance_reminders: Array<{ title: string; due_on: string; status: ReminderStatus }> | null;
    }>;

    const contractsOf = (row: (typeof source)[number]): AllianceContractLite[] =>
      (row.alliance_contracts ?? []).map((contract) => ({
        status: contract.status,
        expiresOn: contract.expires_on,
      }));

    const rows = source.map((row) =>
      buildAllianceListRow({
        id: row.id,
        name: row.name,
        allianceType: row.alliance_type,
        status: row.status,
        ownerName: row.owner_name,
        contactName: text(row.contact_name),
        email: text(row.email),
        nextAction: text(row.next_action),
        today,
        contracts: contractsOf(row),
        reminders: (row.alliance_reminders ?? []).map((reminder) => ({
          title: reminder.title,
          dueOn: reminder.due_on,
          status: reminder.status,
        })),
      }),
    );

    const contracts = source.flatMap((row) => contractsOf(row));

    return { ok: true, data: { today, rows, stats: summarizeAllianceHome(rows, contracts, today) } };
  } catch {
    return { ok: false, error: "unknown" };
  }
}

export async function getAlliance(id: string): Promise<LoadResult<AllianceDetail | null>> {
  if (!isAllianceId(id)) return { ok: true, data: null };
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.from("alliances").select(DETAIL_SELECT).eq("id", id).maybeSingle();
    if (error) return { ok: false, error: isMissingTable(error) ? "missing_table" : "unknown" };
    if (!data) return { ok: true, data: null };
    return { ok: true, data: mapDetail(data as unknown as AllianceRow) };
  } catch {
    return { ok: false, error: "unknown" };
  }
}
