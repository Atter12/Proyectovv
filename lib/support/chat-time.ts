/** Horarios del inbox — siempre America/Lima (Perú). */

export const SUPPORT_CHAT_TZ = "America/Lima";
const LOCALE = "es-PE";

export function todayYmdInSupportTz(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SUPPORT_CHAT_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function ymdInSupportTz(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SUPPORT_CHAT_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: SUPPORT_CHAT_TZ,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** Burbuja de chat: hoy solo hora; otro día → "18 ago · 3:45 p. m." */
export function formatSupportChatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const day = ymdInSupportTz(iso);
  const time = formatTime(iso);
  if (day === todayYmdInSupportTz()) return time;
  const label = new Intl.DateTimeFormat(LOCALE, {
    timeZone: SUPPORT_CHAT_TZ,
    day: "2-digit",
    month: "short",
  }).format(date);
  return `${label} · ${time}`;
}

/** Lista lateral del inbox gerente. */
export function formatInboxListTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const day = ymdInSupportTz(iso);
  if (day === todayYmdInSupportTz()) return formatTime(iso);
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: SUPPORT_CHAT_TZ,
    day: "2-digit",
    month: "short",
  }).format(date);
}

export function supportChatDayKey(iso: string | undefined): string | null {
  if (!iso) return null;
  const day = ymdInSupportTz(iso);
  return day || null;
}

function yesterdayYmdInSupportTz(): string {
  const [y, m, d] = todayYmdInSupportTz().split("-").map(Number);
  const noonLima = new Date(Date.UTC(y, m - 1, d, 17, 0, 0));
  noonLima.setUTCDate(noonLima.getUTCDate() - 1);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SUPPORT_CHAT_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(noonLima);
}

/** Separador de día en el hilo: "Hoy", "Ayer", "lunes, 18 de agosto". */
export function formatSupportChatDaySeparator(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const day = ymdInSupportTz(iso);
  if (day === todayYmdInSupportTz()) return "Hoy";
  if (day === yesterdayYmdInSupportTz()) return "Ayer";

  const yearFmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: SUPPORT_CHAT_TZ,
    year: "numeric",
  });
  const sameYear =
    yearFmt.format(date) === yearFmt.format(new Date());

  if (sameYear) {
    const label = new Intl.DateTimeFormat(LOCALE, {
      timeZone: SUPPORT_CHAT_TZ,
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(date);
    return label.charAt(0).toUpperCase() + label.slice(1);
  }

  const label = new Intl.DateTimeFormat(LOCALE, {
    timeZone: SUPPORT_CHAT_TZ,
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function supportChatTimestamps(iso: string): {
  createdAt: string;
  timestamp: string;
} {
  return {
    createdAt: iso,
    timestamp: formatSupportChatTimestamp(iso),
  };
}

export function supportChatTimestampsNow(): {
  createdAt: string;
  timestamp: string;
} {
  return supportChatTimestamps(new Date().toISOString());
}
