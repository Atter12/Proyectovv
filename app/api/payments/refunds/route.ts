import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session.server";
import { hasPermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotificationBestEffort } from "@/lib/notifications/create-notification.server";

interface WalletSnapshot {
  walletId: string;
  currency: string;
  availableBalanceCents: number;
}

async function resolveWalletSnapshot(organizationId: string): Promise<WalletSnapshot | null> {
  const supabase = await createClient();
  const { data: ledgerBalance } = await supabase
    .from("v_wallet_ledger_balances")
    .select("wallet_id, currency, available_balance_cents")
    .eq("organization_id", organizationId)
    .maybeSingle<{
      wallet_id: string;
      currency: string;
      available_balance_cents: number;
    }>();

  if (ledgerBalance) {
    return {
      walletId: ledgerBalance.wallet_id,
      currency: ledgerBalance.currency,
      availableBalanceCents: Number(ledgerBalance.available_balance_cents ?? 0),
    };
  }

  const { data: wallet } = await supabase
    .from("wallets")
    .select("id, currency, balance_cents, reserved_balance_cents")
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle<{
      id: string;
      currency: string;
      balance_cents: number;
      reserved_balance_cents: number | null;
    }>();

  if (!wallet) return null;

  return {
    walletId: wallet.id,
    currency: wallet.currency,
    availableBalanceCents: Math.max(
      0,
      Number(wallet.balance_cents ?? 0) - Number(wallet.reserved_balance_cents ?? 0),
    ),
  };
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  if (!hasPermission(session.permissions, "payments:create")) {
    return NextResponse.json({ error: "Permiso denegado." }, { status: 403 });
  }

  if (!session.organizationId) {
    return NextResponse.json({ error: "Organización no disponible." }, { status: 400 });
  }

  let body: { amount?: number; reason?: string; currency?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Monto inválido." }, { status: 400 });
  }

  const amountCents = Math.round(amount * 100);
  const wallet = await resolveWalletSnapshot(session.organizationId);
  if (!wallet) {
    return NextResponse.json(
      { error: "No se encontró cartera activa." },
      { status: 404 },
    );
  }

  if (amountCents > wallet.availableBalanceCents) {
    return NextResponse.json(
      { error: "El monto supera el saldo disponible." },
      { status: 409 },
    );
  }

  const currency = (body.currency ?? wallet.currency ?? "USD").toUpperCase();
  if (currency !== wallet.currency.toUpperCase()) {
    return NextResponse.json(
      { error: "La moneda no coincide con la cartera." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const idempotencyKey = `refund-request:${session.organizationId}:${session.id}:${randomUUID()}`;
  const description = body.reason?.trim()
    ? `Solicitud de reembolso: ${body.reason.trim()}`
    : "Solicitud de reembolso desde dashboard";

  const { data, error } = await admin
    .from("wallet_transactions")
    .insert({
      wallet_id: wallet.walletId,
      organization_id: session.organizationId,
      type: "refund",
      amount_cents: amountCents,
      currency,
      status: "pending",
      description,
      idempotency_key: idempotencyKey,
      created_by: session.id,
      metadata: {
        source: "dashboard",
        request_status: "pending_review",
        requested_by: session.id,
        reason: body.reason?.trim() || null,
        available_balance_cents_at_request: wallet.availableBalanceCents,
      },
    })
    .select("id, amount_cents, currency, status, created_at")
    .single<{
      id: string;
      amount_cents: number;
      currency: string;
      status: string;
      created_at: string;
    }>();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "No se pudo crear el reembolso." },
      { status: 500 },
    );
  }

  await admin.from("audit_logs").insert({
    organization_id: session.organizationId,
    actor_user_id: session.id,
    action: "refund.requested",
    entity_type: "wallet_transaction",
    entity_id: data.id,
    metadata: { amount_cents: amountCents, currency },
  });

  await createNotificationBestEffort({
    organizationId: session.organizationId,
    userId: session.id,
    title: "Reembolso solicitado",
    body: "Tu solicitud quedó pendiente de revisión.",
    type: "refund_requested",
    data: { wallet_transaction_id: data.id, url: "/payments?tab=refunds" },
  });

  return NextResponse.json({
    ok: true,
    refundRequest: {
      id: data.id,
      amountCents: data.amount_cents,
      currency: data.currency,
      status: data.status,
      createdAt: data.created_at,
    },
  });
}
