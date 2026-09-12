import "server-only";
import { serverEnv } from "@/lib/env/env.server";
import type { ManualChargeCurrency } from "@/lib/payments/manual-deposit.server";

export type ManualBankAccount = {
  id: string;
  label: string;
  bank?: string;
  holder: string;
  accountNumber: string;
  cci?: string;
  currencies: ManualChargeCurrency[];
  notes?: string;
};

const DEFAULT_ACCOUNTS: ManualBankAccount[] = [
  {
    id: "bcp-pen",
    label: "BCP - Cuenta corriente soles",
    bank: "BCP",
    holder: "HOLISTIC MARKETING LLC",
    accountNumber: "1947376966005",
    cci: "00219400737696600598",
    currencies: ["PEN"],
    notes: "Transferencia o deposito en soles (PEN).",
  },
  {
    id: "bcp-usd",
    label: "BCP - Cuenta corriente dolares",
    bank: "BCP",
    holder: "HOLISTIC MARKETING LLC",
    accountNumber: "1938022768168",
    cci: "00219300802276816813",
    currencies: ["USD"],
    notes: "Transferencia o deposito en dolares (USD).",
  },
];

function sanitizeBankText(value: string): string {
  return value
    .replace(/\uFFFD/g, "")
    .replace(/BCP\s*\?\s*/g, "BCP - ")
    .replace(/dep\?sito/gi, "deposito")
    .replace(/d\?lares/gi, "dolares")
    .replace(/·/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function parseAccountsFromEnv(): ManualBankAccount[] {
  const raw = serverEnv.manualPaymentBankAccountsJson?.trim();
  if (!raw) return DEFAULT_ACCOUNTS;

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_ACCOUNTS;

    const accounts: ManualBankAccount[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      const id = String(row.id ?? "").trim();
      const holder = String(row.holder ?? "").trim();
      const accountNumber = String(row.accountNumber ?? row.account_number ?? "").trim();
      if (!id || !holder || !accountNumber) continue;

      const currenciesRaw = row.currencies;
      const currencies: ManualChargeCurrency[] = Array.isArray(currenciesRaw)
        ? currenciesRaw
            .map((c) => String(c).toUpperCase())
            .filter((c): c is ManualChargeCurrency => c === "USD" || c === "PEN")
        : ["PEN"];

      accounts.push({
        id,
        label: sanitizeBankText(String(row.label ?? id).trim()),
        bank: row.bank ? String(row.bank) : undefined,
        holder,
        accountNumber,
        cci: row.cci ? String(row.cci) : undefined,
        currencies: currencies.length ? currencies : ["PEN"],
        notes: row.notes ? sanitizeBankText(String(row.notes)) : undefined,
      });
    }

    return accounts.length ? accounts : DEFAULT_ACCOUNTS;
  } catch {
    return DEFAULT_ACCOUNTS;
  }
}

export function getManualBankAccounts(
  chargeCurrency?: ManualChargeCurrency,
): ManualBankAccount[] {
  const all = parseAccountsFromEnv();
  if (!chargeCurrency) return all;
  return all.filter((a) => a.currencies.includes(chargeCurrency));
}

export function getPublicManualBankAccounts(
  chargeCurrency: ManualChargeCurrency,
): ManualBankAccount[] {
  return getManualBankAccounts(chargeCurrency);
}
