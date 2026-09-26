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
  phone: string;
  roleTitle: string;
  signedOn: string;
  signUrl: string;
  providerStatus: string;
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
  providerStatus: string;
  rejectionReason: string;
  hasSignedFile: boolean;
  signedFileName: string;
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

export interface OwnerLoadItem {
  name: string;
  open: number;
  overdue: number;
}

export interface TypeShareItem {
  type: string;
  label: string;
  count: number;
}

export interface ContractQueueItemView {
  id: string;
  allianceId: string;
  allianceName: string;
  contractType: string;
  version: number;
  shown: string;
  expiresOn: string;
  sentOn: string;
}

export interface CalendarEventView {
  id: string;
  date: string;
  allianceId: string;
  allianceName: string;
  title: string;
  kind: "reminder" | "expiry";
  overdue: boolean;
  priority: "low" | "normal" | "high";
}

export interface FollowupStatsView {
  expiring: number;
  newThisMonth: number;
  overdueFollowUps: number;
  pendingRenewals: number;
}

export interface AllianceHome {
  today: string;
  rows: AllianceListRow[];
  stats: AllianceHomeStats;
  followup: FollowupStatsView;
  byType: TypeShareItem[];
  owners: OwnerLoadItem[];
  queue: ContractQueueItemView[];
  events: CalendarEventView[];
  alertsReady: boolean;
}
