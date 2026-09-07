import "server-only";

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
  | { ok: false; message: string } {
  const original = String(raw ?? "").trim();
  if (!original) {
    return {
      ok: false,
      message:
        "Completá el DNI (8 dígitos) o RUC (11 dígitos) del cliente en Hecom CRM para pagar con Yape.",
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
    message: `El documento en CRM (“${original}”) no es un DNI (8 dígitos) ni RUC (11). Actualizalo en Hecom para pagar con Yape.`,
  };
}
