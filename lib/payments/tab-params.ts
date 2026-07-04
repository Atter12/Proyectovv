import type { PaymentTabKey } from "@/types/payment";

const PAYMENT_TABS: PaymentTabKey[] = [
  "assignment",
  "account-tx",
  "wallet-tx",
  "refunds",
];

export function parsePaymentTab(value: string | undefined): PaymentTabKey {
  if (value && PAYMENT_TABS.includes(value as PaymentTabKey)) {
    return value as PaymentTabKey;
  }
  return "assignment";
}

export function isTransactionTab(
  tab: PaymentTabKey,
): tab is Exclude<PaymentTabKey, "assignment"> {
  return tab !== "assignment";
}
