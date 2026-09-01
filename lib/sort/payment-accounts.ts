import { parseBmBucketFromLabel } from "@/lib/hecom/bm-bucket.shared";
import type { PaymentAccountAllocation } from "@/types/payment";

export type PaymentAccountSortKey =
  | "recommended"
  | "bm"
  | "name"
  | "ledger_desc"
  | "ledger_asc";

function statusOrder(status: string): number {
  if (status === "active") return 0;
  if (status === "pending") return 1;
  if (status === "disabled") return 2;
  return 3;
}

function isReclaimableSuspended(account: PaymentAccountAllocation): boolean {
  return account.status === "disabled" && Number(account.balance) > 0;
}

function bmSortKey(account: PaymentAccountAllocation): number {
  const bucket = parseBmBucketFromLabel(account.bmLabel);
  if (!bucket) return 999;
  const n = Number.parseInt(bucket, 10);
  return Number.isFinite(n) ? n : 999;
}

function accountNameSortKey(name: string): { num: number | null; text: string } {
  const trimmed = name.trim();
  const match = trimmed.match(/^(\d+(?:[._]\d+)?)/);
  if (match) {
    const normalized = match[1].replace("_", ".");
    const num = Number.parseFloat(normalized);
    if (Number.isFinite(num)) {
      return { num, text: trimmed.toLowerCase() };
    }
  }
  return { num: null, text: trimmed.toLowerCase() };
}

function compareByName(a: PaymentAccountAllocation, b: PaymentAccountAllocation): number {
  const ka = accountNameSortKey(a.name);
  const kb = accountNameSortKey(b.name);
  if (ka.num != null && kb.num != null && ka.num !== kb.num) {
    return ka.num - kb.num;
  }
  if (ka.num != null && kb.num == null) return -1;
  if (ka.num == null && kb.num != null) return 1;
  return ka.text.localeCompare(kb.text, "es");
}

function compareRecommended(
  a: PaymentAccountAllocation,
  b: PaymentAccountAllocation,
): number {
  const reclaimA = isReclaimableSuspended(a) ? 0 : 1;
  const reclaimB = isReclaimableSuspended(b) ? 0 : 1;
  if (reclaimA !== reclaimB) return reclaimA - reclaimB;

  const statusDiff = statusOrder(a.status) - statusOrder(b.status);
  if (statusDiff !== 0) return statusDiff;

  const bmDiff = bmSortKey(a) - bmSortKey(b);
  if (bmDiff !== 0) return bmDiff;

  return compareByName(a, b);
}

/** Orden estable para gerente: recuperar → activas → BM → nombre. */
export function sortPaymentAccounts(
  accounts: PaymentAccountAllocation[],
  sortKey: PaymentAccountSortKey = "recommended",
): PaymentAccountAllocation[] {
  const copy = [...accounts];

  copy.sort((a, b) => {
    switch (sortKey) {
      case "bm": {
        const bmDiff = bmSortKey(a) - bmSortKey(b);
        if (bmDiff !== 0) return bmDiff;
        return compareByName(a, b);
      }
      case "name":
        return compareByName(a, b);
      case "ledger_desc":
        return Number(b.balance) - Number(a.balance) || compareRecommended(a, b);
      case "ledger_asc":
        return Number(a.balance) - Number(b.balance) || compareRecommended(a, b);
      case "recommended":
      default:
        return compareRecommended(a, b);
    }
  });

  return copy;
}

export function summarizePaymentAccounts(accounts: PaymentAccountAllocation[]) {
  let activeCount = 0;
  let pendingCount = 0;
  let reclaimableCount = 0;
  let totalLedgerUsd = 0;

  for (const account of accounts) {
    totalLedgerUsd += Number(account.balance) || 0;
    if (isReclaimableSuspended(account)) {
      reclaimableCount += 1;
      continue;
    }
    if (account.status === "active") activeCount += 1;
    else if (account.status === "pending") pendingCount += 1;
  }

  return {
    totalAccounts: accounts.length,
    activeCount,
    pendingCount,
    reclaimableCount,
    totalLedgerUsd,
  };
}
