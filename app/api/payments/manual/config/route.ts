import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session.server";
import { getHolisticUsdPenRate } from "@/lib/payments/manual-deposit.server";
import { getPublicManualBankAccounts } from "@/lib/payments/manual-bank-accounts.server";
import { serverEnv } from "@/lib/env/env.server";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    fxRateUsdPen: getHolisticUsdPenRate(),
    bankAccounts: getPublicManualBankAccounts("PEN"),
    bankAccountsUsd: getPublicManualBankAccounts("USD"),
    aiEnabled: Boolean(serverEnv.openAiApiKey?.trim()),
    trustUploadMode: serverEnv.manualVoucherTrustUpload,
  });
}
