"use server";

import { revalidatePath } from "next/cache";
import { contractDocumentHtml } from "@/features/alliances/lib/templates";
import { buildContractPdf } from "@/features/alliances/lib/signature";
import { sendSignatureEnvelope } from "@/features/alliances/lib/signature.server";
import { isHecomOtpStaffEmail } from "@/lib/auth/hecom-otp.server";
import { requireSession } from "@/lib/auth/guards.server";
import { updateHecomClienteDocument } from "@/lib/hecom/clientes.server";
import { createAdminClient } from "@/lib/supabase/admin";
import { clientContractBlocks, parseClientContract } from "./lib/client-contract";
import { loadRegistrationContractPrefill } from "./lib/registration-contract.server";

export type SubmitClientContractResult =
  | { ok: true }
  | { ok: false; error: string };

export async function submitClientServiceContractAction(
  input: {
    partyType: string;
    legalName: string;
    docType: string;
    docNumber: string;
    address: string;
    phone: string;
  },
): Promise<SubmitClientContractResult> {
  const session = await requireSession();
  if (isHecomOtpStaffEmail(session.email)) {
    return { ok: false, error: "El contrato lo completa el cliente." };
  }

  const parsed = parseClientContract({
    partyType: input.partyType === "company" ? "company" : "natural",
    legalName: input.legalName,
    docType: input.docType === "ruc" ? "ruc" : "dni",
    docNumber: input.docNumber,
    address: input.address,
    phone: input.phone,
    email: session.email,
  });
  if (!parsed.ok) return parsed;

  const prefill = await loadRegistrationContractPrefill(session.email);
  const value = parsed.value;
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { ok: false, error: "No se pudo guardar el contrato." };
  }

  const existing = await admin
    .from("client_service_contracts")
    .select("status, external_ref")
    .eq("email", value.email)
    .maybeSingle<{ status: string; external_ref: string | null }>();
  if (existing.error && isMissingTable(existing.error.message)) {
    return { ok: false, error: "Falta aplicar la migración 046_client_service_contracts.sql." };
  }
  if (existing.data?.status === "pending_signature" || existing.data?.status === "signed") {
    return { ok: true };
  }

  const row = {
    user_id: session.id,
    email: value.email,
    hecom_cliente_id: prefill.hecomClienteId,
    party_type: value.partyType,
    legal_name: value.legalName,
    doc_type: value.docType,
    doc_number: value.docNumber,
    address: value.address,
    phone: value.phone,
    fee_percent: value.feePercent,
    status: "draft",
    updated_at: new Date().toISOString(),
  };
  const saved = await admin.from("client_service_contracts").upsert(row, { onConflict: "email" }).select("id").maybeSingle<{ id: string }>();
  if (saved.error || !saved.data) {
    return { ok: false, error: isMissingTable(saved.error?.message) ? "Falta aplicar la migración 046_client_service_contracts.sql." : "No se pudo guardar el contrato." };
  }

  if (prefill.hecomClienteId) {
    await updateHecomClienteDocument({
      clienteId: prefill.hecomClienteId,
      documentNumber: value.docNumber,
    });
  }

  const html = contractDocumentHtml({
    title: "Contrato de servicios Ads Holistic",
    parties: value.legalName,
    body: clientContractBlocks(value),
  });
  const pdf = buildContractPdf(html);
  const deadline = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const sent = await sendSignatureEnvelope({
    contractId: saved.data.id,
    name: `Contrato Ads Holistic · ${value.legalName}`,
    pdf: pdf.bytes,
    deadline: `${deadline}T23:59:59-05:00`,
    signers: [
      {
        name: value.legalName,
        email: value.email,
        countryCode: value.countryCode,
        phone: value.nationalPhone,
        page: pdf.pages,
        slot: 0,
      },
    ],
  });
  if (!sent.ok) return { ok: false, error: sent.error };

  const signUrl = sent.envelope.signers.find((signer) => signer.link)?.link ?? null;
  await admin
    .from("client_service_contracts")
    .update({
      status: "pending_signature",
      external_ref: sent.envelope.token,
      sign_url: signUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("id", saved.data.id);
  await admin.from("client_registration_intents").delete().eq("email", value.email);
  revalidatePath("/overview");
  return { ok: true };
}

function isMissingTable(message: string | undefined): boolean {
  const text = (message ?? "").toLowerCase();
  return text.includes("client_service_contracts") || text.includes("schema cache") || text.includes("does not exist");
}
