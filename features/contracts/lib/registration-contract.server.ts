import "server-only";
import { findHecomClientesByEmail } from "@/lib/hecom/clientes.server";
import { createAdminClient } from "@/lib/supabase/admin";

export interface RegistrationContractPrefill {
  legalName: string;
  docNumber: string;
  phone: string;
  email: string;
  hecomClienteId: string | null;
}

const OPEN_STATUSES = ["pending_signature", "signed"];

export async function recordRegistrationContractIntent(input: {
  email: string;
  hecomClienteId: string;
  legalName: string;
  docNumber: string;
  phone: string;
}): Promise<void> {
  const email = input.email.trim().toLowerCase();
  if (!email.includes("@")) return;
  try {
    const admin = createAdminClient();
    await admin.from("client_registration_intents").upsert(
      {
        email,
        hecom_cliente_id: input.hecomClienteId,
        legal_name: input.legalName.trim().slice(0, 160),
        doc_number: input.docNumber.replace(/\D/g, ""),
        phone: input.phone.trim().slice(0, 40),
      },
      { onConflict: "email" },
    );
  } catch {
    // Sin la migración el registro sigue; el contrato se ofrece al abrir /contrato.
  }
}

export async function clientNeedsServiceContract(email: string): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  if (!normalized.includes("@")) return false;
  try {
    const admin = createAdminClient();
    const intent = await admin
      .from("client_registration_intents")
      .select("email")
      .eq("email", normalized)
      .maybeSingle();
    if (intent.error || !intent.data) return false;
    const contract = await admin
      .from("client_service_contracts")
      .select("status")
      .eq("email", normalized)
      .maybeSingle<{ status: string }>();
    if (contract.error) return Boolean(intent.data);
    return !OPEN_STATUSES.includes(contract.data?.status ?? "");
  } catch {
    return false;
  }
}

export async function loadRegistrationContractPrefill(
  email: string,
): Promise<RegistrationContractPrefill> {
  const normalized = email.trim().toLowerCase();
  const fallback: RegistrationContractPrefill = {
    legalName: "",
    docNumber: "",
    phone: "",
    email: normalized,
    hecomClienteId: null,
  };
  try {
    const admin = createAdminClient();
    const intent = await admin
      .from("client_registration_intents")
      .select("hecom_cliente_id, legal_name, doc_number, phone")
      .eq("email", normalized)
      .maybeSingle<{
        hecom_cliente_id: string | null;
        legal_name: string;
        doc_number: string;
        phone: string;
      }>();
    if (!intent.error && intent.data) {
      return {
        legalName: intent.data.legal_name,
        docNumber: intent.data.doc_number,
        phone: intent.data.phone,
        email: normalized,
        hecomClienteId: intent.data.hecom_cliente_id,
      };
    }
  } catch {
    // Prefill vacío si falta la tabla.
  }

  try {
    const clientes = await findHecomClientesByEmail(normalized);
    const cliente = clientes[0];
    if (!cliente) return fallback;
    return {
      legalName: cliente.name ?? "",
      docNumber: cliente.dni ?? "",
      phone: cliente.phones[0] ?? "",
      email: normalized,
      hecomClienteId: cliente.id,
    };
  } catch {
    return fallback;
  }
}

export async function serviceContractAlreadySent(email: string): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  try {
    const admin = createAdminClient();
    const contract = await admin
      .from("client_service_contracts")
      .select("status")
      .eq("email", normalized)
      .maybeSingle<{ status: string }>();
    if (contract.error || !contract.data) return false;
    return OPEN_STATUSES.includes(contract.data.status);
  } catch {
    return false;
  }
}

export async function clientNeedsCheckout(email: string): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  if (!normalized.includes("@")) return false;
  try {
    const admin = createAdminClient();
    const contract = await admin
      .from("client_service_contracts")
      .select("status, requires_checkout, checkout_returned_at")
      .eq("email", normalized)
      .maybeSingle<{
        status: string;
        requires_checkout: boolean;
        checkout_returned_at: string | null;
      }>();
    if (contract.error || !contract.data) return false;
    return (
      contract.data.requires_checkout &&
      !contract.data.checkout_returned_at &&
      OPEN_STATUSES.includes(contract.data.status)
    );
  } catch {
    return false;
  }
}

export async function registrationNextPath(
  email: string,
): Promise<"/contrato" | "/pago" | null> {
  if (await clientNeedsServiceContract(email)) return "/contrato";
  if (await clientNeedsCheckout(email)) return "/pago";
  return null;
}

export async function completeNasCheckoutReturn(
  email: string,
  token: string,
): Promise<boolean> {
  const normalized = email.trim().toLowerCase();
  if (!/^[0-9a-f-]{36}$/i.test(token)) return false;
  try {
    const admin = createAdminClient();
    const contract = await admin
      .from("client_service_contracts")
      .select("id, checkout_token, checkout_returned_at, requires_checkout")
      .eq("email", normalized)
      .maybeSingle<{
        id: string;
        checkout_token: string | null;
        checkout_returned_at: string | null;
        requires_checkout: boolean;
      }>();
    if (contract.error || !contract.data?.requires_checkout) return false;
    if (contract.data.checkout_returned_at) return true;
    if (contract.data.checkout_token !== token) return false;
    const saved = await admin
      .from("client_service_contracts")
      .update({
        checkout_returned_at: new Date().toISOString(),
        checkout_token: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", contract.data.id)
      .eq("checkout_token", token);
    return !saved.error;
  } catch {
    return false;
  }
}
