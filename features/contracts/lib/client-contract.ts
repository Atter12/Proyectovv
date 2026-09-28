const HOLISTIC_LEGAL_NAME = "HOLISTIC MARKETING PE E.I.R.L.";
const HOLISTIC_RUC = "20616314557";
const HOLISTIC_SERVICE =
  "Recarga de saldo publicitario y operación de cuentas de anuncios (TikTok) desde el panel Ads Holistic.";

export const CLIENT_FEE_PERCENT = 10;

export type ClientPartyType = "natural" | "company";
export type ClientDocType = "dni" | "ruc";

export interface ClientContractDraft {
  partyType: ClientPartyType;
  legalName: string;
  docType: ClientDocType;
  docNumber: string;
  address: string;
  phone: string;
  email: string;
}

export interface ClientContractValue extends ClientContractDraft {
  feePercent: typeof CLIENT_FEE_PERCENT;
  entryAmount: null;
  countryCode: string;
  nationalPhone: string;
}

const PARTY: Record<ClientPartyType, string> = {
  natural: "persona natural",
  company: "empresa",
};

const DOC: Record<ClientDocType, string> = {
  dni: "DNI",
  ruc: "RUC",
};

export function parseClientContract(
  input: ClientContractDraft,
): { ok: true; value: ClientContractValue } | { ok: false; error: string } {
  const partyType = input.partyType === "company" ? "company" : input.partyType === "natural" ? "natural" : null;
  if (!partyType) return { ok: false, error: "Elige persona natural o empresa." };

  const docType = input.docType === "ruc" ? "ruc" : input.docType === "dni" ? "dni" : null;
  if (!docType) return { ok: false, error: "Elige DNI o RUC." };
  if (partyType === "natural" && docType !== "dni") {
    return { ok: false, error: "Una persona natural se identifica con DNI." };
  }
  if (partyType === "company" && docType !== "ruc") {
    return { ok: false, error: "Una empresa se identifica con RUC." };
  }

  const docNumber = input.docNumber.replace(/\D/g, "");
  if (docType === "dni" && !/^\d{8}$/.test(docNumber)) {
    return { ok: false, error: "El DNI tiene 8 dígitos." };
  }
  if (docType === "ruc" && !/^\d{11}$/.test(docNumber)) {
    return { ok: false, error: "El RUC tiene 11 dígitos." };
  }

  const legalName = input.legalName.replace(/\s+/g, " ").trim();
  if (legalName.length < 2 || legalName.length > 160) {
    return { ok: false, error: "Escribe el nombre legal." };
  }

  const address = input.address.replace(/\s+/g, " ").trim();
  if (address.length < 8 || address.length > 240) {
    return { ok: false, error: "Escribe el domicilio." };
  }

  const phone = splitPeruPhone(input.phone);
  if (!phone) return { ok: false, error: "Escribe un celular válido para el aviso de FirmEasy." };

  const email = input.email.trim().toLowerCase();
  if (!email.includes("@") || email.length > 180) {
    return { ok: false, error: "Escribe un correo válido." };
  }

  return {
    ok: true,
    value: {
      partyType,
      legalName,
      docType,
      docNumber,
      address,
      phone: `${phone.countryCode}${phone.phone}`,
      email,
      feePercent: CLIENT_FEE_PERCENT,
      entryAmount: null,
      countryCode: phone.countryCode,
      nationalPhone: phone.phone,
    },
  };
}

export function clientContractBlocks(value: ClientContractValue): string {
  const party = PARTY[value.partyType];
  const doc = DOC[value.docType];
  const identified = value.partyType === "company" ? "identificada" : "identificado";
  return [
    "# Contrato de servicios Ads Holistic",
    "## Primero. Partes",
    `${HOLISTIC_LEGAL_NAME}, con RUC ${HOLISTIC_RUC}, y ${value.legalName}, ${party} ${identified} con ${doc} ${value.docNumber}, celebran este contrato de servicios.`,
    "## Segundo. Servicio",
    HOLISTIC_SERVICE,
    "## Tercero. Domicilio",
    `El cliente señala como domicilio ${value.address}.`,
    "## Cuarto. Comisión",
    `La comisión variable es el ${value.feePercent}% del gasto publicitario. Este porcentaje no lo modifica el cliente.`,
    "## Quinto. Avisos de firma",
    `Este contrato no tiene precio de entrada. FirmEasy envía el enlace de firma al celular ${value.phone} por WhatsApp y al correo ${value.email}.`,
  ].join("\n\n");
}

function splitPeruPhone(raw: string): { countryCode: string; phone: string } | null {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("51") && digits.length >= 11) digits = digits.slice(2);
  if (digits.length < 9 || digits.length > 12) return null;
  return { countryCode: "+51", phone: digits };
}
