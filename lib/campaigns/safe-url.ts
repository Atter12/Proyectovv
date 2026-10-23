/**
 * Reglas para abrir desde el servidor un link que pegó un usuario (página del
 * producto, fotos). Sin dependencias, para tests. Bloquea todo lo que no sea
 * internet público: localhost, redes privadas, metadata de la nube, etc.
 */

export type UrlCheck = { ok: true; url: URL } | { ok: false; reason: "invalid" | "protocol" | "port" | "host" };

const BLOCKED_HOSTS = /(^|\.)(localhost|local|internal|intranet|lan|home|corp|localdomain)$/i;

/** Link pegado por el usuario → URL https/http pública (sin credenciales ni puertos raros). */
export function checkPublicUrl(raw: string): UrlCheck {
  let url: URL;
  try {
    const value = raw.trim();
    // Con esquema ("ftp:", "file:") se respeta para rechazarlo; sin él, https.
    url = new URL(/^[a-z][a-z0-9+.-]*:(?!\d)/i.test(value) ? value : `https://${value}`);
  } catch {
    return { ok: false, reason: "invalid" };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return { ok: false, reason: "protocol" };
  if (url.username || url.password) return { ok: false, reason: "invalid" };
  if (url.port && url.port !== "80" && url.port !== "443") return { ok: false, reason: "port" };
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (!host.includes(".") && !host.includes(":")) return { ok: false, reason: "host" };
  if (BLOCKED_HOSTS.test(host)) return { ok: false, reason: "host" };
  if (isIpLiteral(host) && isPrivateAddress(host)) return { ok: false, reason: "host" };
  url.hash = "";
  return { ok: true, url };
}

export function isIpLiteral(host: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":");
}

function ipv4Parts(ip: string): number[] | null {
  const parts = ip.split(".").map(Number);
  return parts.length === 4 && parts.every((n) => Number.isInteger(n) && n >= 0 && n <= 255) ? parts : null;
}

/**
 * ¿La IP es de una red no pública? Cubre privadas, loopback, link-local
 * (169.254.x: metadata de AWS/GCP), CGNAT, multicast y reservadas, en IPv4 e
 * IPv6 (incluidas las IPv4 escondidas en IPv6).
 */
export function isPrivateAddress(ip: string): boolean {
  const v4 = ipv4Parts(ip);
  if (v4) {
    const [a, b] = v4;
    return (
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19))
    );
  }
  const v6 = ip.toLowerCase().replace(/^\[|\]$/g, "").split("%")[0];
  if (!v6.includes(":")) return true; // ni IPv4 ni IPv6 válida: no arriesgar
  const mapped = v6.match(/^(?:0*:)*:?ffff:(\d{1,3}(?:\.\d{1,3}){3})$/) ?? v6.match(/^::(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (mapped) return isPrivateAddress(mapped[1]);
  const hexMapped = v6.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (hexMapped) {
    const hi = parseInt(hexMapped[1], 16), lo = parseInt(hexMapped[2], 16);
    return isPrivateAddress(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
  }
  if (v6 === "::" || v6 === "::1") return true;
  const head = parseInt(v6.split(":")[0] || "0", 16);
  return (
    (head & 0xfe00) === 0xfc00 || // fc00::/7 únicas locales
    (head & 0xffc0) === 0xfe80 || // fe80::/10 link-local
    (head & 0xff00) === 0xff00 || // multicast
    head === 0x2001 && v6.startsWith("2001:db8") // documentación
  );
}
