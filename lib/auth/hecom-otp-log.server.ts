import "server-only";

/** Logs legibles en Vercel Runtime Logs. Prefijo fijo para filtrar: `hecom-otp`. */
export function logHecomOtp(
  level: "info" | "warn" | "error",
  event: string,
  data: Record<string, unknown> = {},
): void {
  const payload = {
    scope: "hecom-otp",
    event,
    ts: new Date().toISOString(),
    ...data,
  };
  const line = `[hecom-otp] ${event} ${JSON.stringify(payload)}`;
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

/** Enmascara correo para logs (sigue siendo buscable por dominio / prefijo). */
export function maskEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  const at = normalized.indexOf("@");
  if (at < 1) return "***";
  const local = normalized.slice(0, at);
  const domain = normalized.slice(at + 1);
  const visible = local.slice(0, Math.min(3, local.length));
  return `${visible}***@${domain}`;
}
