import type {
  ActivityKind,
  AgreementKind,
  AllianceDraft,
  AllianceHomeStats,
  AllianceListRow,
  ContractStatus,
  ContractType,
  FileCategory,
  ReminderPriority,
  ReminderStatus,
} from "@/features/alliances/lib/domain";

export interface AllianceContactRecord {
  id: string;
  name: string;
  roleTitle: string;
  phone: string;
  email: string;
  isPrimary: boolean;
}

export interface AllianceAgreementRecord {
  id: string;
  title: string;
  kind: AgreementKind;
  body: string;
}

export interface AllianceSignerRecord {
  id: string;
  name: string;
  email: string;
  roleTitle: string;
  signedOn: string;
}

export interface AllianceContractRecord {
  id: string;
  contractType: ContractType;
  version: number;
  status: ContractStatus;
  sentOn: string;
  expiresOn: string;
  notes: string;
  fileName: string;
  hasFile: boolean;
  signatureProvider: string;
  externalRef: string;
  signers: AllianceSignerRecord[];
  updatedAt: string;
}

export interface AllianceActivityRecord {
  id: string;
  kind: ActivityKind;
  title: string;
  body: string;
  occurredAt: string;
}

export interface AllianceReminderRecord {
  id: string;
  title: string;
  dueOn: string;
  priority: ReminderPriority;
  status: ReminderStatus;
  ownerName: string;
  notes: string;
}

export interface AllianceFileRecord {
  id: string;
  name: string;
  category: FileCategory;
  sizeBytes: number;
  createdAt: string;
}

export interface AllianceDetail extends AllianceDraft {
  id: string;
  updatedAt: string;
  contacts: AllianceContactRecord[];
  agreements: AllianceAgreementRecord[];
  contracts: AllianceContractRecord[];
  activities: AllianceActivityRecord[];
  reminders: AllianceReminderRecord[];
  files: AllianceFileRecord[];
}

export interface AllianceHome {
  today: string;
  rows: AllianceListRow[];
  stats: AllianceHomeStats;
}
