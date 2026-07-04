import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session.server";
import { getPaymentTransactions } from "@/services/payments.service";
import type { PaymentTabKey } from "@/types/payment";

const VALID_TABS = ["account-tx", "wallet-tx", "refunds"] as const;

type TransactionTab = (typeof VALID_TABS)[number];

function isTransactionTab(value: string): value is TransactionTab {
  return VALID_TABS.includes(value as TransactionTab);
}

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const tab = new URL(request.url).searchParams.get("tab") ?? "";
  if (!isTransactionTab(tab)) {
    return NextResponse.json({ error: "Pestaña inválida." }, { status: 400 });
  }

  const transactions = await getPaymentTransactions(
    session,
    tab as Exclude<PaymentTabKey, "assignment">,
  );

  return NextResponse.json({ ok: true, transactions });
}
