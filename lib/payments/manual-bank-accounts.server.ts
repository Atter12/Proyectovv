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
    id: "bcp-usd",
    label: "BCP · Cuenta dólares",
    bank: "BCP",
    holder: "HOLISTIC MARKETING LLC",
    accountNumber: "PENDIENTE — configurar en Vercel",
    cci: "PENDIENTE",
    currencies: ["USD", "PEN"],
    notes: "Configurá MANUAL_PAYMENT_BANK_ACCOUNTS en Vercel con los datos reales.",
  },
  {
    id: "yape",
    label: "Yape",
    holder: "Holistic Marketing",
    accountNumber: "PENDIENTE",
    currencies: ["PEN"],
    notes: "Número Yape / Plin — configurar en env.",
  },
];

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
        label: String(row.label ?? id).trim(),
        bank: row.bank ? String(row.bank) : undefined,
        holder,
        accountNumber,
        cci: row.cci ? String(row.cci) : undefined,
        currencies: currencies.length ? currencies : ["PEN"],
        notes: row.notes ? String(row.notes) : undefined,
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
