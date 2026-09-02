import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session.server";
import { hasPermission } from "@/lib/auth/permissions";
import { resolvePaymentsFundingCapabilities } from "@/lib/payments/funding-roles.server";
import { buildCrossBmFundingPlan } from "@/lib/payments/cross-bm-funding.server";
import { resolveBcIdForHecomBucket } from "@/lib/integrations/tiktok/bc-advertisers.server";
import { serverEnv } from "@/lib/env/env.server";

/**
 * Diagnóstico cross-BM para gerente: qué BM tienen cash/crédito y si el target puede fondearse.
 * GET /api/payments/cross-bm-status?advertiserId=&bcId=&amount=300
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  if (!hasPermission(session.permissions, "payments:create")) {
    return NextResponse.json({ error: "Permiso denegado." }, { status: 403 });
  }

  const capabilities = resolvePaymentsFundingCapabilities({
    email: session.email,
    role: session.role,
  });

  if (!capabilities.canAgencyBmFund) {
    return NextResponse.json(
      { error: "Solo gerentes/staff pueden consultar fondeo cross-BM." },
      { status: 403 },
    );
  }

  const url = new URL(request.url);
  const advertiserId = url.searchParams.get("advertiserId")?.trim() ?? "";
  const rawBcId = url.searchParams.get("bcId")?.trim() ?? "";
  const amount = Number(url.searchParams.get("amount") ?? "0");

  if (!advertiserId) {
    return NextResponse.json(
      { error: "advertiserId requerido." },
      { status: 400 },
    );
  }

  const bcId =
    resolveBcIdForHecomBucket(
      rawBcId,
      rawBcId || serverEnv.tiktokDefaultBcId.trim() || null,
    ) ?? "";

  if (!bcId) {
    return NextResponse.json(
      { error: "bcId requerido (o TIKTOK_DEFAULT_BC_ID en env)." },
      { status: 400 },
    );
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "amount inválido." }, { status: 400 });
  }

  try {
    const plan = await buildCrossBmFundingPlan({
      targetBcId: bcId,
      advertiserId,
      amountUsd: amount,
      organizationId: session.organizationId ?? undefined,
    });

    return NextResponse.json({ ok: true, plan });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo consultar cross-BM.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
