import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session.server";
import { hasPermission } from "@/lib/auth/permissions";
import { getDepositFeePreviewForSession } from "@/lib/payments/resolve-hecom-deposit-fee.server";
import { splitDepositByFeePercent } from "@/lib/payments/deposit-fee";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  if (
    !hasPermission(session.permissions, "wallet:deposit") &&
    !hasPermission(session.permissions, "payments:create") &&
    !hasPermission(session.permissions, "payments:read")
  ) {
    return NextResponse.json({ error: "Permiso denegado." }, { status: 403 });
  }

  const url = new URL(request.url);
  const amountRaw = url.searchParams.get("amount");
  const amount = amountRaw != null ? Number(amountRaw) : null;

  const preview = await getDepositFeePreviewForSession({
    userId: session.id,
  });

  const breakdown =
    amount != null && Number.isFinite(amount) && amount > 0
      ? splitDepositByFeePercent(Math.round(amount * 100), preview.feePercent)
      : null;

  return NextResponse.json({
    ok: true,
    feePercent: preview.feePercent,
    feeSource: preview.feeSource,
    hecomClienteId: preview.hecomClienteId,
    hecomClienteName: preview.hecomClienteName,
    breakdown: breakdown
      ? {
          grossCents: breakdown.grossCents,
          creditCents: breakdown.creditCents,
          feeCents: breakdown.feeCents,
        }
      : null,
  });
}
