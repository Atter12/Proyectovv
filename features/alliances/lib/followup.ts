const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SIGNATURE_STALE_DAYS = 7;
const EXPIRY_HORIZON_DAYS = 30;

export const FOLLOWUP_ALLIANCE_TYPES = ["ecommerce", "agency", "commercial", "partner", "other"] as const;
export type FollowupAllianceType = (typeof FOLLOWUP_ALLIANCE_TYPES)[number];

const TYPE_LABEL: Record<FollowupAllianceType, string> = {
  ecommerce: "Ecommerce",
  agency: "Agencia",
  commercial: "Comercial",
  partner: "Partner",
  other: "Otra",
};

export interface FollowupContract {
  id: string;
  contractType: string;
  version: number;
  status: string;
  expiresOn: string | null;
  sentOn: string | null;
  createdOn: string;
}

export interface FollowupReminder {
  id: string;
  title: string;
  dueOn: string;
  priority: "low" | "normal" | "high";
  status: "open" | "done" | "cancelled";
  ownerName: string;
  sourceKey: string;
}

export interface FollowupAlliance {
  id: string;
  name: string;
  allianceType: FollowupAllianceType;
  status: string;
  ownerName: string;
  createdOn: string;
  contracts: FollowupContract[];
  reminders: FollowupReminder[];
}

export interface PlannedReminder {
  sourceKey: string;
  allianceId: string;
  title: string;
  dueOn: string;
  priority: "low" | "normal" | "high";
  ownerName: string;
  notes: string;
}

export interface FollowupPlan {
  create: PlannedReminder[];
  completeKeys: string[];
}

export interface ContractQueueItem {
  id: string;
  allianceId: string;
  allianceName: string;
  contractType: string;
  version: number;
  shown: string;
  expiresOn: string;
  sentOn: string;
}

export interface CalendarEvent {
  id: string;
  date: string;
  allianceId: string;
  allianceName: string;
  title: string;
  kind: "reminder" | "expiry";
  overdue: boolean;
  priority: "low" | "normal" | "high";
}

export interface OwnerLoad {
  name: string;
  open: number;
  overdue: number;
}

export interface TypeShare {
  type: FollowupAllianceType;
  label: string;
  count: number;
}

export interface FollowupStats {
  expiring: number;
  newThisMonth: number;
  overdueFollowUps: number;
  pendingRenewals: number;
}

export interface AllianceBoard {
  stats: FollowupStats;
  byType: TypeShare[];
  owners: OwnerLoad[];
  queue: ContractQueueItem[];
  events: CalendarEvent[];
}

export function planAllianceAlerts(alliances: FollowupAlliance[], today: string): FollowupPlan {
  const create: PlannedReminder[] = [];
  const complete = new Set<string>();
  const known = new Map<string, FollowupReminder["status"]>();
  for (const alliance of alliances) {
    for (const reminder of alliance.reminders) {
      if (reminder.sourceKey) known.set(reminder.sourceKey, reminder.status);
    }
  }

  for (const alliance of alliances) {
    const ended = alliance.status === "ended";
    for (const contract of alliance.contracts) {
      const expiryKeys = [30, 15, 7, 0].map((band) => expiryKey(contract.id, band));
      const signatureKey = `signature:${contract.id}`;
      if (ended) {
        markOpen(complete, known, [...expiryKeys, signatureKey]);
        continue;
      }

      const daysUntil = contract.expiresOn && DATE_RE.test(contract.expiresOn) ? daysUntilDate(today, contract.expiresOn) : null;
      const band = expiryBand(contract.status, daysUntil);
      if (band === null) {
        markOpen(complete, known, expiryKeys);
      } else {
        const key = expiryKey(contract.id, band);
        markOpen(complete, known, expiryKeys.filter((item) => item !== key));
        if (!known.has(key)) {
          create.push({
            sourceKey: key,
            allianceId: alliance.id,
            title: clip(`${expiryTitle(band, daysUntil ?? 0)} · ${alliance.name}`, 160),
            dueOn: band === 0 ? contract.expiresOn || today : today,
            priority: band === 30 ? "normal" : "high",
            ownerName: clip(alliance.ownerName, 120),
            notes: "Alerta automática de vencimiento. La ficha tiene el contrato y el historial.",
          });
        }
      }

      const anchor = firstDate(contract.sentOn, contract.createdOn);
      const waiting = contract.status === "pending_signature" && anchor ? daysUntilDate(anchor, today) : null;
      if (waiting !== null && waiting >= SIGNATURE_STALE_DAYS) {
        if (!known.has(signatureKey)) {
          create.push({
            sourceKey: signatureKey,
            allianceId: alliance.id,
            title: clip(`Firma pendiente hace ${waiting} días · ${alliance.name}`, 160),
            dueOn: addDays(anchor, SIGNATURE_STALE_DAYS),
            priority: "high",
            ownerName: clip(alliance.ownerName, 120),
            notes: "La firma lleva más de una semana sin cerrarse.",
          });
        }
      } else {
        markOpen(complete, known, [signatureKey]);
      }
    }
  }

  return { create, completeKeys: [...complete] };
}

export function buildAllianceBoard(alliances: FollowupAlliance[], today: string): AllianceBoard {
  const month = today.slice(0, 7);
  const queue: ContractQueueItem[] = [];
  const events: CalendarEvent[] = [];
  const owners = new Map<string, OwnerLoad>();
  let expiring = 0;
  let newThisMonth = 0;
  let overdueFollowUps = 0;
  let pendingRenewals = 0;

  for (const alliance of alliances) {
    if (alliance.createdOn.startsWith(month)) newThisMonth += 1;
    const ended = alliance.status === "ended";
    for (const contract of alliance.contracts) {
      const shown = shownStatus(contract.status, contract.expiresOn, today);
      queue.push({
        id: contract.id,
        allianceId: alliance.id,
        allianceName: alliance.name,
        contractType: contract.contractType,
        version: contract.version,
        shown,
        expiresOn: contract.expiresOn ?? "",
        sentOn: contract.sentOn ?? "",
      });
      if (!ended && shown === "expiring") expiring += 1;
      if (!ended && contract.contractType === "renewal" && (shown === "draft" || shown === "in_review" || shown === "pending_signature")) {
        pendingRenewals += 1;
      }
      if (!ended && contract.expiresOn && (shown === "expiring" || shown === "expired" || shown === "signed")) {
        events.push({
          id: `expiry-${contract.id}`,
          date: contract.expiresOn,
          allianceId: alliance.id,
          allianceName: alliance.name,
          title: `Vence ${alliance.name}`,
          kind: "expiry",
          overdue: contract.expiresOn < today,
          priority: contract.expiresOn < today ? "high" : "normal",
        });
      }
    }
    for (const reminder of alliance.reminders) {
      if (reminder.status !== "open" || !DATE_RE.test(reminder.dueOn)) continue;
      const overdue = reminder.dueOn < today;
      if (overdue) overdueFollowUps += 1;
      const name = reminder.ownerName.trim() || alliance.ownerName.trim() || "Sin responsable";
      const load = owners.get(name) ?? { name, open: 0, overdue: 0 };
      load.open += 1;
      if (overdue) load.overdue += 1;
      owners.set(name, load);
      events.push({
        id: reminder.id || reminder.sourceKey,
        date: reminder.dueOn,
        allianceId: alliance.id,
        allianceName: alliance.name,
        title: reminder.title,
        kind: "reminder",
        overdue,
        priority: reminder.priority,
      });
    }
  }

  queue.sort((a, b) => (a.expiresOn || "9999").localeCompare(b.expiresOn || "9999") || a.allianceName.localeCompare(b.allianceName, "es"));
  events.sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title, "es"));

  return {
    stats: { expiring, newThisMonth, overdueFollowUps, pendingRenewals },
    byType: FOLLOWUP_ALLIANCE_TYPES.map((type) => ({
      type,
      label: TYPE_LABEL[type],
      count: alliances.filter((alliance) => alliance.allianceType === type && alliance.status !== "ended").length,
    })),
    owners: [...owners.values()].sort((a, b) => b.overdue - a.overdue || b.open - a.open || a.name.localeCompare(b.name, "es")).slice(0, 6),
    queue,
    events,
  };
}

export function buildMonthGrid(month: string): { date: string; inMonth: boolean }[] {
  const [year, monthNumber] = month.split("-").map(Number);
  const first = new Date(Date.UTC(year, (monthNumber || 1) - 1, 1));
  const lead = (first.getUTCDay() + 6) % 7;
  const cursor = new Date(first);
  cursor.setUTCDate(1 - lead);
  const cells: { date: string; inMonth: boolean }[] = [];
  for (let index = 0; index < 42; index += 1) {
    const date = cursor.toISOString().slice(0, 10);
    cells.push({ date, inMonth: date.startsWith(month) });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return cells;
}

function expiryBand(status: string, daysUntil: number | null): 30 | 15 | 7 | 0 | null {
  if (daysUntil === null) return null;
  if (status !== "signed" && status !== "expiring" && status !== "expired") return null;
  if (daysUntil < 0) return 0;
  if (daysUntil <= 7) return 7;
  if (daysUntil <= 15) return 15;
  if (daysUntil <= EXPIRY_HORIZON_DAYS) return 30;
  return null;
}

function expiryTitle(band: 30 | 15 | 7 | 0, daysUntil: number): string {
  if (band === 0) return "Contrato vencido";
  if (daysUntil <= 0) return "Vence hoy";
  if (daysUntil === 1) return "Vence mañana";
  return `Quedan ${daysUntil} días`;
}

function expiryKey(contractId: string, band: number): string {
  return `expiry:${contractId}:${band}`;
}

function markOpen(complete: Set<string>, known: Map<string, FollowupReminder["status"]>, keys: string[]) {
  for (const key of keys) {
    if (known.get(key) === "open") complete.add(key);
  }
}

function shownStatus(status: string, expiresOn: string | null, today: string): string {
  if (!expiresOn || status === "draft" || status === "in_review" || status === "renewed") return status;
  if (expiresOn < today) return status === "pending_signature" ? status : "expired";
  if ((status === "signed" || status === "expiring") && expiresOn <= addDays(today, EXPIRY_HORIZON_DAYS)) return "expiring";
  if (status === "expiring") return "signed";
  return status;
}

function daysUntilDate(today: string, date: string): number {
  const start = Date.parse(`${today}T00:00:00Z`);
  const end = Date.parse(`${date}T00:00:00Z`);
  return Math.round((end - start) / 86_400_000);
}

function addDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const utc = new Date(Date.UTC(year, (month || 1) - 1, day || 1));
  utc.setUTCDate(utc.getUTCDate() + days);
  return utc.toISOString().slice(0, 10);
}

function firstDate(preferred: string | null, fallback: string): string {
  if (preferred && DATE_RE.test(preferred)) return preferred;
  return DATE_RE.test(fallback) ? fallback : "";
}

function clip(value: string, max: number): string {
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}
