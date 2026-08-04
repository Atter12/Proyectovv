import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

type BridgeJournal = {
  id: string;
  organization_id: string;
  status: string;
  amount_cents: number;
  reversed_by_journal_id: string | null;
  metadata: Record<string, unknown> | null;
};

type AllocationJournal = {
  id: string;
  metadata: Record<string, unknown> | null;
};

/**
 * Revierte depósitos "agency_bm_bridge" que no terminaron en una asignación.
 * Caso típico: TikTok falló después de acreditar el puente (bug viejo).
 */
export async function reverseOrphanedAgencyBmBridges(input: {
  organizationId: string;
  reason?: string;
}): Promise<{ reversed: number; amountCents: number; journalIds: string[] }> {
  const admin = createAdminClient();

  const { data: bridges, error: bridgesError } = await admin
    .from("ledger_journals")
    .select(
      "id, organization_id, status, amount_cents, reversed_by_journal_id, metadata",
    )
    .eq("organization_id", input.organizationId)
    .eq("status", "posted")
    .is("reversed_by_journal_id", null)
    .contains("metadata", { source: "agency_bm_bridge" })
    .limit(50);

  if (bridgesError) throw new Error(bridgesError.message);

  const candidates = (bridges ?? []) as BridgeJournal[];
  if (candidates.length === 0) {
    return { reversed: 0, amountCents: 0, journalIds: [] };
  }

  const { data: allocations, error: allocError } = await admin
    .from("ledger_journals")
    .select("id, metadata")
    .eq("organization_id", input.organizationId)
    .eq("status", "posted")
    .contains("metadata", { agency_bm_funding: true })
    .limit(100);

  if (allocError) throw new Error(allocError.message);

  const usedBridgeIds = new Set<string>();
  for (const row of (allocations ?? []) as AllocationJournal[]) {
    const bridgeId = row.metadata?.agency_bm_bridge_journal_id;
    if (typeof bridgeId === "string" && bridgeId.trim()) {
      usedBridgeIds.add(bridgeId.trim());
    }
  }

  const reason =
    input.reason ??
    "Reverso automático: puente BM sin asignación TikTok (saldo fantasma)";
  const journalIds: string[] = [];
  let amountCents = 0;

  for (const journal of candidates) {
    if (usedBridgeIds.has(journal.id)) continue;

    const { error: rpcError } = await admin.rpc("ledger_reverse_journal", {
      p_journal_id: journal.id,
      p_reason: reason,
      p_idempotency_key: `cleanup:agency-bm-bridge:${journal.id}`,
    });

    if (rpcError) {
      console.error("[payments] orphan_bridge_reverse_failed", {
        journalId: journal.id,
        error: rpcError.message,
      });
      continue;
    }

    journalIds.push(journal.id);
    amountCents += Math.abs(Number(journal.amount_cents) || 0);
  }

  if (journalIds.length > 0) {
    console.info("[payments] orphan_agency_bm_bridges_reversed", {
      organizationId: input.organizationId,
      reversed: journalIds.length,
      amountCents,
      journalIds,
    });
  }

  return { reversed: journalIds.length, amountCents, journalIds };
}
