import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { allocateWithOptionalTikTokFunding } from "@/lib/payments/allocate-with-tiktok.server";
import { reclaimFromAdAccountWithTikTok } from "@/lib/payments/reclaim-with-tiktok.server";
import { getAdAccountLedgerBalance } from "@/lib/ledger/ledger.server";

export interface TransferBetweenAdAccountsInput {
  organizationId: string;
  fromAdAccountId: string;
  toAdAccountId: string;
  amountCents: number;
  requestedBy: string;
  idempotencyKey?: string;
  agencyBmFunding?: boolean;
  forceLedgerOnly?: boolean;
}

export interface TransferBetweenAdAccountsResult {
  transferId: string;
  amountCents: number;
  requestedAmountCents: number;
  reclaimJournalId: string;
  allocateJournalId: string;
  reclaimPath: string;
  fromAccountName: string;
  toAccountName: string;
}

/**
 * Mueve saldo de cuenta ads A → cuenta ads B en un solo paso.
 * TikTok: DEDUCT/baja presupuesto en origen → RECHARGE/sube presupuesto en destino.
 * Ledger: refund origen → cartera → allocate destino (neto cartera ≈ 0).
 */
export async function transferBetweenAdAccountsWithTikTok(
  input: TransferBetweenAdAccountsInput,
): Promise<TransferBetweenAdAccountsResult> {
  if (input.fromAdAccountId === input.toAdAccountId) {
    throw new Error("Elegí dos cuentas distintas para transferir.");
  }

  const requested = Math.floor(input.amountCents);
  if (!Number.isFinite(requested) || requested <= 0) {
    throw new Error("Monto a transferir inválido.");
  }

  const admin = createAdminClient();
  const { data: rows, error } = await admin
    .from("ad_accounts")
    .select("id, organization_id, name, status, external_account_id")
    .in("id", [input.fromAdAccountId, input.toAdAccountId]);

  if (error) throw new Error(error.message);

  const fromAccount = rows?.find((r) => r.id === input.fromAdAccountId) as
    | {
        id: string;
        organization_id: string;
        name: string;
        status: string;
        external_account_id: string | null;
      }
    | undefined;
  const toAccount = rows?.find((r) => r.id === input.toAdAccountId) as
    | {
        id: string;
        organization_id: string;
        name: string;
        status: string;
        external_account_id: string | null;
      }
    | undefined;

  if (!fromAccount || fromAccount.organization_id !== input.organizationId) {
    throw new Error("Cuenta origen no encontrada en la organización.");
  }
  if (!toAccount || toAccount.organization_id !== input.organizationId) {
    throw new Error("Cuenta destino no encontrada en la organización.");
  }

  if (toAccount.status === "disabled") {
    throw new Error(
      "La cuenta destino está suspendida. Elegí una cuenta Activa/Aprobada.",
    );
  }

  const fromLedger = await getAdAccountLedgerBalance(fromAccount.id);
  const fromAvailable = fromLedger?.availableBalanceCents ?? 0;
  if (fromAvailable <= 0) {
    throw new Error(
      "La cuenta origen no tiene saldo Holistic para transferir.",
    );
  }
  if (requested > fromAvailable) {
    throw new Error(
      `Solo hay ${(fromAvailable / 100).toFixed(2)} USD disponibles en la cuenta origen.`,
    );
  }

  if (!toAccount.external_account_id?.trim()) {
    throw new Error(
      "La cuenta destino no tiene advertiser_id de TikTok. Completá el ID antes de transferir.",
    );
  }

  const transferId =
    input.idempotencyKey ??
    `transfer:${input.organizationId}:${input.fromAdAccountId}:${input.toAdAccountId}:${requested}:${randomUUID()}`;

  console.info("[payments/transfer] start", {
    transferId,
    from: fromAccount.id,
    to: toAccount.id,
    requested,
    fromStatus: fromAccount.status,
    toStatus: toAccount.status,
    agencyBmFunding: Boolean(input.agencyBmFunding),
  });

  let reclaimResult: Awaited<ReturnType<typeof reclaimFromAdAccountWithTikTok>>;
  try {
    reclaimResult = await reclaimFromAdAccountWithTikTok({
      organizationId: input.organizationId,
      adAccountId: fromAccount.id,
      amountCents: requested,
      requestedBy: input.requestedBy,
      forceLedgerOnly: Boolean(input.forceLedgerOnly),
      idempotencyKey: `transfer-reclaim:${transferId}`,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "No se pudo sacar saldo de la cuenta origen.";
    throw new Error(message);
  }

  const transferCents = reclaimResult.amountCents;
  if (transferCents <= 0) {
    throw new Error("No quedó monto transferible después de consultar TikTok.");
  }

  try {
    const allocateResult = await allocateWithOptionalTikTokFunding({
      organizationId: input.organizationId,
      adAccountId: toAccount.id,
      amountCents: transferCents,
      requestedBy: input.requestedBy,
      agencyBmFunding: Boolean(input.agencyBmFunding),
      idempotencyKey: `transfer-allocate:${transferId}`,
      description: `Transferencia ${fromAccount.name} → ${toAccount.name}`,
    });

    console.info("[payments/transfer] ok", {
      transferId,
      transferCents,
      reclaimJournalId: reclaimResult.journalId,
      allocateJournalId: allocateResult.journalId,
      reclaimPath: reclaimResult.path,
    });

    return {
      transferId,
      amountCents: transferCents,
      requestedAmountCents: requested,
      reclaimJournalId: reclaimResult.journalId,
      allocateJournalId: allocateResult.journalId,
      reclaimPath: reclaimResult.path,
      fromAccountName: fromAccount.name,
      toAccountName: toAccount.name,
    };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "No se pudo asignar a la cuenta destino.";
    console.error("[payments/transfer] allocate_failed_after_reclaim", {
      transferId,
      transferCents,
      reclaimJournalId: reclaimResult.journalId,
      message,
    });
    throw new Error(
      `${message} El saldo ya está en tu cartera Holistic (${(transferCents / 100).toFixed(2)} USD). Podés asignarlo manualmente a la cuenta destino o pedir ayuda a soporte.`,
    );
  }
}
