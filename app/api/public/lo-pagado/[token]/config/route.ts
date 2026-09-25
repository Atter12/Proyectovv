import { NextResponse } from "next/server";
import { getPublicManualBankAccounts } from "@/lib/payments/manual-bank-accounts.server";
import { getPublicManualBinancePayee } from "@/lib/payments/manual-binance.server";
import { resolveHolisticUsdPenRate } from "@/lib/payments/fx-rate.server";
import { resolvePublicLoPagado } from "@/lib/payments/public-lo-pagado.server";
import { serverEnv } from "@/lib/env/env.server";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> },
) {
  const { token } = await context.params;
  const ctx = await resolvePublicLoPagado(token);
  if (!ctx) {
    return NextResponse.json({ error: "Link inválido." }, { status: 404 });
  }

  const fx = await resolveHolisticUsdPenRate();
  return NextResponse.json({
    ok: true,
    fxRateUsdPen: fx.usdPen,
    fxSource: fx.source,
    fxAsOf: fx.asOf,
    bankAccounts: getPublicManualBankAccounts("PEN"),
    bankAccountsUsd: getPublicManualBankAccounts("USD"),
    binance: getPublicManualBinancePayee(),
    aiEnabled: Boolean(serverEnv.openAiApiKey?.trim()),
    trustUploadMode: serverEnv.manualVoucherTrustUpload,
  });
}
