/** Utilidades compartidas cliente/servidor para pago manual PEN. */

export function formatPenAmount(penCents: number): string {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(penCents / 100);
}
