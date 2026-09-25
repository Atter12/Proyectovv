import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { authenticateHecomPaymentRead, parseHecomPaymentReadQuery, hecomPaymentReadResponse } from "@/lib/hecom/payment-detail.server";
import { paymentProofReference, validSignedPaymentProofUrl } from "@/lib/hecom/payment-proof";

/** Sign the existing private original. No copy, financial write or raw metadata. */
export async function handleHecomPaymentProof(request: Request, dependencies: {
  secret: string; supabaseUrl: string; createAdmin: () => SupabaseClient;
}) {
  const reply = hecomPaymentReadResponse;
  if (!dependencies.secret) return reply({ ok: false, error: "bridge_not_configured" }, 503);
  if (!authenticateHecomPaymentRead(request, dependencies.secret)) return reply({ ok: false, error: "unauthorized" }, 401);
  const query = parseHecomPaymentReadQuery(request);
  if (!query?.paymentId) return reply({ ok: false, error: "invalid_query" }, 400);
  try {
    const admin = dependencies.createAdmin();
    const { data, error } = await admin.from("payment_intents").select("id,organization_id,metadata")
      .eq("id", query.paymentId).eq("metadata->>hecom_cliente_id", query.clientId)
      .limit(1).abortSignal(AbortSignal.timeout(15_000)).maybeSingle();
    if (error) return reply({ ok: false, error: "payment_source_unavailable" }, 502);
    if (!data || data.id !== query.paymentId || data.metadata?.hecom_cliente_id !== query.clientId) {
      return reply({ ok: false, error: "proof_not_found" }, 404);
    }
    const proof = paymentProofReference(data);
    if (!proof) return reply({ ok: false, error: "proof_not_found" }, 404);
    const signed = await admin.storage.from("payment-proofs").createSignedUrl(proof.path, 300);
    if (signed.error || !validSignedPaymentProofUrl(signed.data?.signedUrl, dependencies.supabaseUrl, proof.path)) {
      return reply({ ok: false, error: "proof_unavailable" }, 502);
    }
    return reply({ ok: true, url: signed.data.signedUrl, expiresIn: 300, previewKind: proof.kind });
  } catch { return reply({ ok: false, error: "proof_unavailable" }, 502); }
}
