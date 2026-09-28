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

function splitPeruPhone(raw: string): { countryCode: string; phone: string } | null {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("51") && digits.length >= 11) digits = digits.slice(2);
  if (digits.length < 9 || digits.length > 12) return null;
  return { countryCode: "+51", phone: digits };
}
