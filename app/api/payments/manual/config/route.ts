import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session.server";
import { resolveHolisticUsdPenRate } from "@/lib/payments/fx-rate.server";
import { getPublicManualBankAccounts } from "@/lib/payments/manual-bank-accounts.server";
import { serverEnv } from "@/lib/env/env.server";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const fx = await resolveHolisticUsdPenRate();

  return NextResponse.json({
    ok: true,
    fxRateUsdPen: fx.usdPen,
    fxSource: fx.source,
    fxAsOf: fx.asOf,
    bankAccounts: getPublicManualBankAccounts("PEN"),
    bankAccountsUsd: getPublicManualBankAccounts("USD"),
    aiEnabled: Boolean(serverEnv.openAiApiKey?.trim()),
    trustUploadMode: serverEnv.manualVoucherTrustUpload,
  });
}
