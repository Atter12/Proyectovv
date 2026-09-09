export type YapeDocumentType = "DNI" | "RUC";

export type NormalizedYapeDocument = {
  documentType: YapeDocumentType;
  documentNumber: string;
};

/**
 * Hecom a veces guarda códigos internos (ej. CL-…) en `dni`.
 * Cobrana/Yape exige DNI (8 dígitos) o RUC (11 dígitos).
 */
export function normalizeYapeDocument(
  raw: string | null | undefined,
):
  | { ok: true; value: NormalizedYapeDocument }
  | { ok: false; message: string; original: string } {
  const original = String(raw ?? "").trim();
  if (!original) {
    return {
      ok: false,
      original: "",
      message:
        "Ingresa tu DNI (8 dígitos) o RUC (11 dígitos) para pagar con Yape.",
    };
  }

  const digits = original.replace(/\D/g, "");

  if (digits.length === 8) {
    return {
      ok: true,
      value: { documentType: "DNI", documentNumber: digits },
    };
  }

  if (digits.length === 11) {
    return {
      ok: true,
      value: { documentType: "RUC", documentNumber: digits },
    };
  }

  return {
    ok: false,
    original,
    message: `“${original}” no es un DNI (8 dígitos) ni RUC (11). Ingresa tu documento para continuar.`,
  };
}

export function isValidYapeDocumentInput(raw: string | null | undefined): boolean {
  return normalizeYapeDocument(raw).ok;
}
