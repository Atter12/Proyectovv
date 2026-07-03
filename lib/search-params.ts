export function getSearchParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
  fallback = "",
): string {
  const value = params[key];
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value[0] ?? fallback;
  return fallback;
}
