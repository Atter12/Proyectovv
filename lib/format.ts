export function formatMoney(cents: number | null | undefined, currency = "USD"): string {
  const amount = Number(cents ?? 0) / 100;
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatInteger(value: number | null | undefined): string {
  return new Intl.NumberFormat("es-PE").format(Number(value ?? 0));
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("es-PE", { dateStyle: "medium" }).format(date);
}

export function compactId(id: string | null | undefined): string {
  if (!id) return "—";
  return `${id.slice(0, 8)}…${id.slice(-4)}`;
}

export function percent(value: number | null | undefined): string {
  return `${Number(value ?? 0).toFixed(1)}%`;
}
