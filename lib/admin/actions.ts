"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/admin/auth";
import { mergeJsonMetadata } from "@/lib/types/json";

type ActionScope = {
  organizationId?: string | null;
  actorUserId: string;
};

function getString(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

function getOptionalString(formData: FormData, key: string): string | null {
  const value = getString(formData, key);
  return value.length > 0 ? value : null;
}

async function insertAudit(scope: ActionScope, input: { action: string; entityType: string; entityId?: string | null; severity?: string; metadata?: Record<string, unknown> }) {
  const admin = createAdminClient();
  await admin.from("audit_logs").insert({
    organization_id: scope.organizationId ?? null,
    actor_user_id: scope.actorUserId,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    severity: input.severity ?? "info",
    metadata: input.metadata ?? {},
  });
}

async function notify(input: { organizationId?: string | null; userId?: string | null; title: string; body: string; type: string; data?: Record<string, unknown> }) {
  const admin = createAdminClient();
  await admin.from("notifications").insert({
    organization_id: input.organizationId ?? null,
    user_id: input.userId ?? null,
    title: input.title,
    body: input.body,
    type: input.type,
    data: input.data ?? {},
  });
}

export async function approveManualPaymentAction(formData: FormData) {
  const actor = await requireAdmin();
  const id = getString(formData, "id");
  const notes = getOptionalString(formData, "notes");
  if (!id) throw new Error("Falta el ID del pago.");

  const admin = createAdminClient();
  const { data: intent, error: intentError } = await admin
    .from("payment_intents")
    .select("id, organization_id, wallet_id, amount_cents, currency, provider, provider_reference, status, metadata, created_by")
    .eq("id", id)
    .maybeSingle<{
      id: string;
      organization_id: string;
      wallet_id: string;
      amount_cents: number;
      currency: string;
      provider: string;
      provider_reference: string | null;
      status: string;
      metadata: Record<string, unknown> | null;
      created_by: string | null;
    }>();
  if (intentError) throw new Error(intentError.message);
  if (!intent || intent.provider !== "manual") throw new Error("Pago manual no encontrado.");
  if (intent.status === "succeeded") return;

  const providerReference = intent.provider_reference ?? `manual:${intent.id}`;
  const { data: journalId, error: ledgerError } = await admin.rpc("ledger_confirm_deposit", {
    p_payment_intent_id: intent.id,
    p_provider_reference: providerReference,
    p_idempotency_key: `admin:manual-payment-approval:${intent.id}`,
    p_metadata: {
      approved_from: "admin_panel",
      approved_by: actor.id,
      approved_by_email: actor.email,
      notes,
    },
  });
  if (ledgerError) throw new Error(ledgerError.message);

  await admin
    .from("payment_intents")
    .update({
      status: "succeeded",
      provider_reference: providerReference,
      succeeded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      metadata: mergeJsonMetadata(intent.metadata, {
        manual_review_status: "approved",
        approved_by: actor.id,
        approved_by_email: actor.email,
        approved_at: new Date().toISOString(),
        approval_notes: notes,
        ledger_journal_id: String(journalId),
      }),
    })
    .eq("id", intent.id);

  await notify({
    organizationId: intent.organization_id,
    userId: intent.created_by,
    title: "Pago manual aprobado",
    body: "Tu comprobante fue aprobado y el saldo ya fue acreditado.",
    type: "payment_approved",
    data: { payment_intent_id: intent.id, ledger_journal_id: String(journalId), url: "/payments" },
  });

  await insertAudit({ organizationId: intent.organization_id, actorUserId: actor.id }, {
    action: "admin.manual_payment.approved",
    entityType: "payment_intent",
    entityId: intent.id,
    metadata: { amount_cents: intent.amount_cents, currency: intent.currency, ledger_journal_id: String(journalId), notes },
  });

  revalidatePath("/admin/payments");
  revalidatePath(`/admin/payments/${intent.id}`);
  revalidatePath("/admin/overview");
}

export async function rejectManualPaymentAction(formData: FormData) {
  const actor = await requireAdmin();
  const id = getString(formData, "id");
  const reason = getOptionalString(formData, "reason") ?? "Comprobante rechazado por revisión administrativa.";
  if (!id) throw new Error("Falta el ID del pago.");

  const admin = createAdminClient();
  const { data: intent, error } = await admin
    .from("payment_intents")
    .select("id, organization_id, amount_cents, currency, provider, status, metadata, created_by")
    .eq("id", id)
    .maybeSingle<{ id: string; organization_id: string; amount_cents: number; currency: string; provider: string; status: string; metadata: Record<string, unknown> | null; created_by: string | null }>();
  if (error) throw new Error(error.message);
  if (!intent || intent.provider !== "manual") throw new Error("Pago manual no encontrado.");
  if (intent.status === "succeeded") throw new Error("No se puede rechazar un pago ya aprobado.");

  const { error: updateError } = await admin
    .from("payment_intents")
    .update({
      status: "failed",
      failure_reason: reason,
      updated_at: new Date().toISOString(),
      metadata: mergeJsonMetadata(intent.metadata, {
        manual_review_status: "rejected",
        rejected_by: actor.id,
        rejected_by_email: actor.email,
        rejected_at: new Date().toISOString(),
        rejection_reason: reason,
      }),
    })
    .eq("id", intent.id);
  if (updateError) throw new Error(updateError.message);

  await notify({
    organizationId: intent.organization_id,
    userId: intent.created_by,
    title: "Pago manual rechazado",
    body: reason,
    type: "payment_rejected",
    data: { payment_intent_id: intent.id, url: "/payments" },
  });

  await insertAudit({ organizationId: intent.organization_id, actorUserId: actor.id }, {
    action: "admin.manual_payment.rejected",
    entityType: "payment_intent",
    entityId: intent.id,
    severity: "warning",
    metadata: { reason, amount_cents: intent.amount_cents, currency: intent.currency },
  });

  revalidatePath("/admin/payments");
  revalidatePath(`/admin/payments/${intent.id}`);
  revalidatePath("/admin/overview");
}

export async function approveRefundAction(formData: FormData) {
  const actor = await requireAdmin();
  const id = getString(formData, "id");
  const notes = getOptionalString(formData, "notes");
  if (!id) throw new Error("Falta el ID del reembolso.");

  const admin = createAdminClient();
  const { data: request, error } = await admin
    .from("wallet_transactions")
    .select("id, wallet_id, organization_id, type, amount_cents, currency, status, metadata, created_by, description")
    .eq("id", id)
    .maybeSingle<{ id: string; wallet_id: string; organization_id: string; type: string; amount_cents: number; currency: string; status: string; metadata: Record<string, unknown> | null; created_by: string | null; description: string | null }>();
  if (error) throw new Error(error.message);
  if (!request || request.type !== "refund") throw new Error("Solicitud de reembolso no encontrada.");
  if (request.status === "completed") return;

  const { data: withdrawalId, error: withdrawalError } = await admin.rpc("post_wallet_transaction", {
    p_organization_id: request.organization_id,
    p_wallet_id: request.wallet_id,
    p_type: "withdrawal",
    p_amount_cents: request.amount_cents,
    p_currency: request.currency,
    p_status: "completed",
    p_description: `Reembolso aprobado para solicitud ${request.id}`,
    p_external_reference: request.id,
    p_idempotency_key: `admin:refund-approval:${request.id}`,
    p_created_by: actor.id,
    p_metadata: {
      source: "admin_panel",
      refund_request_id: request.id,
      approved_by: actor.id,
      approved_by_email: actor.email,
      notes,
    },
  });
  if (withdrawalError) throw new Error(withdrawalError.message);

  const { error: updateError } = await admin
    .from("wallet_transactions")
    .update({
      status: "completed",
      metadata: mergeJsonMetadata(request.metadata, {
        request_status: "approved",
        approved_by: actor.id,
        approved_by_email: actor.email,
        approved_at: new Date().toISOString(),
        approval_notes: notes,
        payout_transaction_id: String(withdrawalId),
      }),
    })
    .eq("id", request.id);
  if (updateError) throw new Error(updateError.message);

  await notify({
    organizationId: request.organization_id,
    userId: request.created_by,
    title: "Reembolso aprobado",
    body: "Tu solicitud fue aprobada y está registrada como egreso de wallet.",
    type: "refund_approved",
    data: { wallet_transaction_id: request.id, payout_transaction_id: String(withdrawalId), url: "/payments?tab=refunds" },
  });

  await insertAudit({ organizationId: request.organization_id, actorUserId: actor.id }, {
    action: "admin.refund.approved",
    entityType: "wallet_transaction",
    entityId: request.id,
    metadata: { amount_cents: request.amount_cents, currency: request.currency, payout_transaction_id: String(withdrawalId), notes },
  });

  revalidatePath("/admin/refunds");
  revalidatePath("/admin/overview");
}

export async function rejectRefundAction(formData: FormData) {
  const actor = await requireAdmin();
  const id = getString(formData, "id");
  const reason = getOptionalString(formData, "reason") ?? "Solicitud rechazada por revisión administrativa.";
  if (!id) throw new Error("Falta el ID del reembolso.");

  const admin = createAdminClient();
  const { data: request, error } = await admin
    .from("wallet_transactions")
    .select("id, organization_id, type, amount_cents, currency, metadata, created_by")
    .eq("id", id)
    .maybeSingle<{ id: string; organization_id: string; type: string; amount_cents: number; currency: string; metadata: Record<string, unknown> | null; created_by: string | null }>();
  if (error) throw new Error(error.message);
  if (!request || request.type !== "refund") throw new Error("Solicitud de reembolso no encontrada.");

  const { error: updateError } = await admin
    .from("wallet_transactions")
    .update({
      status: "failed",
      metadata: mergeJsonMetadata(request.metadata, {
        request_status: "rejected",
        rejected_by: actor.id,
        rejected_by_email: actor.email,
        rejected_at: new Date().toISOString(),
        rejection_reason: reason,
      }),
    })
    .eq("id", request.id);
  if (updateError) throw new Error(updateError.message);

  await notify({
    organizationId: request.organization_id,
    userId: request.created_by,
    title: "Reembolso rechazado",
    body: reason,
    type: "refund_rejected",
    data: { wallet_transaction_id: request.id, url: "/payments?tab=refunds" },
  });

  await insertAudit({ organizationId: request.organization_id, actorUserId: actor.id }, {
    action: "admin.refund.rejected",
    entityType: "wallet_transaction",
    entityId: request.id,
    severity: "warning",
    metadata: { reason, amount_cents: request.amount_cents, currency: request.currency },
  });

  revalidatePath("/admin/refunds");
  revalidatePath("/admin/overview");
}

export async function updateAdAccountStatusAction(formData: FormData) {
  const actor = await requireAdmin();
  const id = getString(formData, "id");
  const status = getString(formData, "status");
  const allowed = new Set(["active", "pending", "disabled", "review"]);
  if (!id || !allowed.has(status)) throw new Error("Estado inválido.");
  const admin = createAdminClient();
  const { data: account, error } = await admin
    .from("ad_accounts")
    .select("id, organization_id, name, status, metadata")
    .eq("id", id)
    .maybeSingle<{ id: string; organization_id: string; name: string; status: string; metadata: Record<string, unknown> | null }>();
  if (error) throw new Error(error.message);
  if (!account) throw new Error("Cuenta publicitaria no encontrada.");
  const { error: updateError } = await admin
    .from("ad_accounts")
    .update({ status, updated_at: new Date().toISOString(), metadata: mergeJsonMetadata(account.metadata, { last_admin_status_update_by: actor.id, last_admin_status_update_at: new Date().toISOString() }) })
    .eq("id", id);
  if (updateError) throw new Error(updateError.message);
  await insertAudit({ organizationId: account.organization_id, actorUserId: actor.id }, { action: "admin.ad_account.status_updated", entityType: "ad_account", entityId: id, metadata: { previous_status: account.status, next_status: status } });
  revalidatePath("/admin/ad-accounts");
}

export async function archiveAdAccountAction(formData: FormData) {
  const actor = await requireAdmin();
  const id = getString(formData, "id");
  const mode = getString(formData, "mode");
  if (!id) throw new Error("Falta el ID de cuenta.");
  const admin = createAdminClient();
  const { data: account, error } = await admin
    .from("ad_accounts")
    .select("id, organization_id, status, metadata")
    .eq("id", id)
    .maybeSingle<{ id: string; organization_id: string; status: string; metadata: Record<string, unknown> | null }>();
  if (error) throw new Error(error.message);
  if (!account) throw new Error("Cuenta publicitaria no encontrada.");
  const metadata = mergeJsonMetadata(account.metadata, {
    archived_at: mode === "unarchive" ? null : new Date().toISOString(),
    archived_by: mode === "unarchive" ? null : actor.id,
    unarchived_at: mode === "unarchive" ? new Date().toISOString() : null,
    unarchived_by: mode === "unarchive" ? actor.id : null,
  });
  const { error: updateError } = await admin
    .from("ad_accounts")
    .update({ status: mode === "unarchive" ? "active" : "disabled", metadata, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (updateError) throw new Error(updateError.message);
  await insertAudit({ organizationId: account.organization_id, actorUserId: actor.id }, { action: mode === "unarchive" ? "admin.ad_account.unarchived" : "admin.ad_account.archived", entityType: "ad_account", entityId: id, metadata: { previous_status: account.status } });
  revalidatePath("/admin/ad-accounts");
}

export async function updateTicketAction(formData: FormData) {
  const actor = await requireAdmin();
  const id = getString(formData, "id");
  const status = getString(formData, "status");
  const priority = getString(formData, "priority");
  const assignToMe = formData.get("assign_to_me") === "on";
  if (!id) throw new Error("Falta ID de ticket.");
  const admin = createAdminClient();
  const { data: ticket, error } = await admin
    .from("support_tickets")
    .select("id, organization_id, requester_user_id, status, priority")
    .eq("id", id)
    .maybeSingle<{ id: string; organization_id: string | null; requester_user_id: string | null; status: string; priority: string }>();
  if (error) throw new Error(error.message);
  if (!ticket) throw new Error("Ticket no encontrado.");
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (["open", "pending", "resolved", "closed"].includes(status)) patch.status = status;
  if (["low", "normal", "high", "urgent"].includes(priority)) patch.priority = priority;
  if (assignToMe) patch.assigned_user_id = actor.id;
  if (status === "closed" || status === "resolved") patch.closed_at = new Date().toISOString();
  if (status === "open" || status === "pending") patch.closed_at = null;
  const { error: updateError } = await admin.from("support_tickets").update(patch).eq("id", id);
  if (updateError) throw new Error(updateError.message);
  await insertAudit({ organizationId: ticket.organization_id, actorUserId: actor.id }, { action: "admin.support_ticket.updated", entityType: "support_ticket", entityId: id, metadata: { previous_status: ticket.status, next_status: patch.status, previous_priority: ticket.priority, next_priority: patch.priority, assigned_to_me: assignToMe } });
  revalidatePath("/admin/support");
  revalidatePath(`/admin/support/${id}`);
}

export async function replyTicketAction(formData: FormData) {
  const actor = await requireAdmin();
  const id = getString(formData, "id");
  const body = getString(formData, "body");
  const internalNote = formData.get("internal_note") === "on";
  if (!id || !body) throw new Error("Mensaje vacío.");
  const admin = createAdminClient();
  const { data: ticket, error } = await admin
    .from("support_tickets")
    .select("id, organization_id, requester_user_id, subject")
    .eq("id", id)
    .maybeSingle<{ id: string; organization_id: string | null; requester_user_id: string | null; subject: string }>();
  if (error) throw new Error(error.message);
  if (!ticket) throw new Error("Ticket no encontrado.");
  const { error: insertError } = await admin.from("support_messages").insert({
    ticket_id: ticket.id,
    organization_id: ticket.organization_id,
    sender_user_id: actor.id,
    body,
    internal_note: internalNote,
    attachments: [],
  });
  if (insertError) throw new Error(insertError.message);
  await admin.from("support_tickets").update({ status: internalNote ? "pending" : "open", assigned_user_id: actor.id, updated_at: new Date().toISOString() }).eq("id", ticket.id);
  if (!internalNote) {
    await notify({
      organizationId: ticket.organization_id,
      userId: ticket.requester_user_id,
      title: "Soporte respondió tu ticket",
      body: ticket.subject,
      type: "support_reply",
      data: { ticket_id: ticket.id, url: "/payments" },
    });
  }
  await insertAudit({ organizationId: ticket.organization_id, actorUserId: actor.id }, { action: internalNote ? "admin.support_ticket.internal_note" : "admin.support_ticket.replied", entityType: "support_ticket", entityId: ticket.id, metadata: { body_preview: body.slice(0, 120) } });
  revalidatePath("/admin/support");
  revalidatePath(`/admin/support/${ticket.id}`);
}

export async function updateReferralAction(formData: FormData) {
  const actor = await requireAdmin();
  const id = getString(formData, "id");
  const mode = getString(formData, "mode");
  if (!id || !["approve", "reject", "paid"].includes(mode)) throw new Error("Acción de afiliado inválida.");
  const admin = createAdminClient();
  const { data: referral, error } = await admin
    .from("referrals")
    .select("id, referred_organization_id, status, metadata, commission_amount_cents, referrer_user_id")
    .eq("id", id)
    .maybeSingle<{ id: string; referred_organization_id: string | null; status: string; metadata: Record<string, unknown> | null; commission_amount_cents: number; referrer_user_id: string | null }>();
  if (error) throw new Error(error.message);
  if (!referral) throw new Error("Referral no encontrado.");
  const patch: Record<string, unknown> = { metadata: mergeJsonMetadata(referral.metadata, { last_admin_action_by: actor.id, last_admin_action_at: new Date().toISOString(), last_admin_action: mode }) };
  if (mode === "approve") {
    patch.status = "converted";
    patch.approved_at = new Date().toISOString();
    patch.converted_at = new Date().toISOString();
  }
  if (mode === "reject") {
    patch.status = "closed";
  }
  if (mode === "paid") {
    patch.paid_at = new Date().toISOString();
  }
  const { error: updateError } = await admin.from("referrals").update(patch).eq("id", id);
  if (updateError) throw new Error(updateError.message);
  await insertAudit({ organizationId: referral.referred_organization_id, actorUserId: actor.id }, { action: `admin.referral.${mode}`, entityType: "referral", entityId: id, metadata: { previous_status: referral.status, commission_amount_cents: referral.commission_amount_cents } });
  if (referral.referrer_user_id) {
    await notify({ organizationId: referral.referred_organization_id, userId: referral.referrer_user_id, title: "Actualización de referido", body: `Estado actualizado: ${mode}`, type: "referral_updated", data: { referral_id: id, url: "/affiliates" } });
  }
  revalidatePath("/admin/affiliates");
}

export async function updateCreativeJobAction(formData: FormData) {
  const actor = await requireAdmin();
  const id = getString(formData, "id");
  const status = getString(formData, "status");
  const errorMessage = getOptionalString(formData, "error_message");
  if (!id || !["queued", "pending", "processing", "completed", "failed"].includes(status)) throw new Error("Estado de job inválido.");
  const admin = createAdminClient();
  const { data: job, error } = await admin
    .from("creative_analysis_jobs")
    .select("id, organization_id, status")
    .eq("id", id)
    .maybeSingle<{ id: string; organization_id: string; status: string }>();
  if (error) throw new Error(error.message);
  if (!job) throw new Error("Job no encontrado.");
  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString(), error_message: errorMessage };
  if (status === "processing") patch.started_at = new Date().toISOString();
  if (status === "completed" || status === "failed") patch.finished_at = new Date().toISOString();
  const { error: updateError } = await admin.from("creative_analysis_jobs").update(patch).eq("id", id);
  if (updateError) throw new Error(updateError.message);
  await insertAudit({ organizationId: job.organization_id, actorUserId: actor.id }, { action: "admin.creative_job.updated", entityType: "creative_analysis_job", entityId: id, metadata: { previous_status: job.status, next_status: status, error_message: errorMessage } });
  revalidatePath("/admin/creatives");
}

export async function reverseJournalAction(formData: FormData) {
  const actor = await requireAdmin();
  const id = getString(formData, "id");
  const reason = getOptionalString(formData, "reason") ?? "Reversado desde panel admin";
  if (!id) throw new Error("Falta journal.");
  const admin = createAdminClient();
  const { data: journal, error } = await admin.from("ledger_journals").select("id, organization_id, status").eq("id", id).maybeSingle<{ id: string; organization_id: string; status: string }>();
  if (error) throw new Error(error.message);
  if (!journal) throw new Error("Journal no encontrado.");
  const { data: reversalId, error: rpcError } = await admin.rpc("ledger_reverse_journal", {
    p_journal_id: id,
    p_reason: reason,
    p_idempotency_key: `admin:journal-reversal:${id}`,
  });
  if (rpcError) throw new Error(rpcError.message);
  await insertAudit({ organizationId: journal.organization_id, actorUserId: actor.id }, { action: "admin.ledger_journal.reversed", entityType: "ledger_journal", entityId: id, severity: "warning", metadata: { reason, reversal_journal_id: String(reversalId), previous_status: journal.status } });
  revalidatePath("/admin/ledger");
  revalidatePath("/admin/overview");
}

export async function createReconciliationRunAction(formData: FormData) {
  const actor = await requireAdmin();
  const provider = getOptionalString(formData, "provider") ?? "internal";
  const reconciliationType = getOptionalString(formData, "reconciliation_type") ?? "full";
  const organizationId = getOptionalString(formData, "organization_id");
  const admin = createAdminClient();
  const { data: run, error } = await admin
    .from("financial_reconciliation_runs")
    .insert({
      organization_id: organizationId,
      provider,
      reconciliation_type: reconciliationType,
      status: "running",
      created_by: actor.id,
      metadata: { source: "admin_panel", started_by_email: actor.email },
    })
    .select("id")
    .single<{ id: string }>();
  if (error) throw new Error(error.message);

  const issues: Array<Record<string, unknown>> = [];
  let paymentQuery = admin
    .from("payment_intents")
    .select("id, organization_id, amount_cents, currency, status, provider, metadata")
    .eq("status", "succeeded")
    .limit(500);
  if (organizationId) paymentQuery = paymentQuery.eq("organization_id", organizationId);
  const { data: payments } = await paymentQuery;
  const paymentRows = Array.isArray(payments) ? payments as Array<{ id: string; organization_id: string; amount_cents: number; currency: string; provider: string; metadata: Record<string, unknown> | null }> : [];
  for (const payment of paymentRows) {
    const metadata = payment.metadata ?? {};
    if (!metadata.ledger_journal_id) {
      issues.push({
        reconciliation_run_id: run.id,
        organization_id: payment.organization_id,
        item_type: "payment_intent",
        source_reference: payment.id,
        status: "missing_in_ledger",
        provider_amount_cents: payment.amount_cents,
        ledger_amount_cents: null,
        currency: payment.currency,
        metadata: { provider: payment.provider, reason: "succeeded_payment_without_metadata_ledger_journal_id" },
      });
    }
  }
  if (issues.length > 0) await admin.from("financial_reconciliation_items").insert(issues);
  const totals = { checked_payments: paymentRows.length, issues: issues.length };
  await admin.from("financial_reconciliation_runs").update({ status: "completed", totals, finished_at: new Date().toISOString() }).eq("id", run.id);
  await insertAudit({ organizationId, actorUserId: actor.id }, { action: "admin.reconciliation.created", entityType: "financial_reconciliation_run", entityId: run.id, metadata: totals });
  revalidatePath("/admin/reconciliation");
}

export async function updateWebhookStatusAction(formData: FormData) {
  const actor = await requireAdmin();
  const id = getString(formData, "id");
  const status = getString(formData, "status");
  if (!id || !["received", "processing", "processed", "failed", "ignored"].includes(status)) throw new Error("Estado de webhook inválido.");
  const admin = createAdminClient();
  const { data: event, error } = await admin.from("webhook_events").select("id, provider, status").eq("id", id).maybeSingle<{ id: string; provider: string; status: string }>();
  if (error) throw new Error(error.message);
  if (!event) throw new Error("Webhook no encontrado.");
  const patch: Record<string, unknown> = { status };
  if (status === "processed") patch.processed_at = new Date().toISOString();
  const { error: updateError } = await admin.from("webhook_events").update(patch).eq("id", id);
  if (updateError) throw new Error(updateError.message);
  await insertAudit({ actorUserId: actor.id }, { action: "admin.webhook.status_updated", entityType: "webhook_event", entityId: id, metadata: { previous_status: event.status, next_status: status, provider: event.provider } });
  revalidatePath("/admin/webhooks");
}
