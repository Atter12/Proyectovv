import "server-only";
import { randomUUID } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPaymentProvider } from "@/lib/payments/providers";
import { isGatewayInMaintenance } from "@/lib/payments/gateway-config";
import {
  createPaymentIntentRecord,
  mergePaymentIntentMetadata,
  updatePaymentIntentRecord,
} from "@/lib/payments/payment-intents.server";
import { getPublicManualBankAccounts } from "@/lib/payments/manual-bank-accounts.server";
import type { SessionUser } from "@/types/auth";
import {
  REALPROFIT_COD_AMOUNT_CENTS,
  REALPROFIT_COD_PURPOSE,
  markRealProfitSubPending,
} from "@/lib/realprofit/subscription.server";

async function assertOrganizationExists(organizationId: string): Promise<void> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("organizations")
    .select("id")
    .eq("id", organizationId)
    .maybeSingle<{ id: string }>();
  if (!data?.id) {
    throw new Error(
      "No encontramos la organización del cliente. Recarga la página o pídele al equipo que revise el vínculo Hecom.",
    );
  }
}

async function resolveWalletId(organizationId: string): Promise<string> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("wallets")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (error) throw new Error(error.message);
  if (data?.id) return data.id;

  const { data: anyWallet } = await admin
    .from("wallets")
    .select("id, status")
    .eq("organization_id", organizationId)
    .limit(1)
    .maybeSingle<{ id: string; status: string }>();

  if (anyWallet?.id) {
    if (anyWallet.status !== "active") {
      const { error: reactivateErr } = await admin
        .from("wallets")
        .update({ status: "active", updated_at: new Date().toISOString() })
        .eq("id", anyWallet.id);
      if (reactivateErr) throw new Error(reactivateErr.message);
    }
    return anyWallet.id;
  }

  const { data: created, error: createErr } = await admin
    .from("wallets")
    .insert({
      organization_id: organizationId,
      name: "Cartera Default",
      balance_cents: 0,
      currency: "USD",
      status: "active",
    })
    .select("id")
    .maybeSingle<{ id: string }>();
  if (createErr || !created?.id) {
    throw new Error(
      createErr?.message || "No se encontró cartera activa para la organización.",
    );
  }
  return created.id;
}

export async function createRealProfitCodSubscribeIntent(input: {
  session: SessionUser;
  hecomClienteId: string;
  hecomClienteName?: string | null;
  organizationId: string;
  shopDomain?: string | null;
}): Promise<{
  paymentIntentId: string;
  status: string;
  amountCents: number;
  currency: string;
  bankAccounts: ReturnType<typeof getPublicManualBankAccounts>;
}> {
  if (isGatewayInMaintenance("manual")) {
    throw new Error(
      "El pago manual está deshabilitado temporalmente. Contacta a soporte.",
    );
  }

  await assertOrganizationExists(input.organizationId);

  const provider = getPaymentProvider("manual");
  if (!provider.isConfigured()) {
    throw new Error("Pago manual no configurado.");
  }

  const walletId = await resolveWalletId(input.organizationId);
  const idempotencyKey = `realprofit-cod:${input.hecomClienteId}:${new Date().toISOString().slice(0, 10)}`;
  const shopDomain = input.shopDomain
    ? input.shopDomain
        .trim()
        .replace(/^https?:\/\//i, "")
        .replace(/\/$/, "")
        .toLowerCase()
    : null;

  const intent = await createPaymentIntentRecord({
    organizationId: input.organizationId,
    walletId,
    amountCents: REALPROFIT_COD_AMOUNT_CENTS,
    currency: "USD",
    provider: "manual",
    createdBy: input.session.id,
    idempotencyKey,
    metadata: {
      provider: "manual",
      source: "profit_subscribe",
      purpose: REALPROFIT_COD_PURPOSE,
      hecom_cliente_id: input.hecomClienteId,
      hecom_cliente_name: input.hecomClienteName ?? null,
      shop_domain: shopDomain,
      charge_currency: "USD",
      fee_percent: 0,
      fee_amount_cents: 0,
      credit_amount_cents: 0,
      gross_amount_cents: REALPROFIT_COD_AMOUNT_CENTS,
      wallet_credit_currency: "USD",
      skip_wallet_credit: true,
      product: "realprofit_cod_monthly",
    },
  });

  await provider.createCheckout({
    amountCents: REALPROFIT_COD_AMOUNT_CENTS,
    currency: "USD",
    organizationId: input.organizationId,
    walletId,
    paymentIntentId: intent.id,
    idempotencyKey: intent.idempotencyKey ?? randomUUID(),
    customerEmail: input.session.email,
    concept: input.hecomClienteName
      ? `Real Profit COD · ${input.hecomClienteName}`
      : "Real Profit COD · +$20",
    metadata: {},
  });

  await updatePaymentIntentRecord(intent.id, {
    status: "requires_payment",
  });
  await mergePaymentIntentMetadata(intent.id, {
    manual_review_status: "awaiting_proof",
  });

  await markRealProfitSubPending({
    hecomClienteId: input.hecomClienteId,
    organizationId: input.organizationId,
    paymentIntentId: intent.id,
    userId: input.session.id,
  });

  return {
    paymentIntentId: intent.id,
    status: "requires_payment",
    amountCents: REALPROFIT_COD_AMOUNT_CENTS,
    currency: "USD",
    bankAccounts: getPublicManualBankAccounts("USD"),
  };
}
