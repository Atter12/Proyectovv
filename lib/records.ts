export type JsonRecord = Record<string, unknown>;

export function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function getString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function getNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function mergeMetadata(
  current: unknown,
  patch: JsonRecord,
): JsonRecord {
  return {
    ...(isRecord(current) ? current : {}),
    ...patch,
  };
}
