/** Parse Hecom `gastos.camp` plantilla + optional `notas` from TikTok sync. */

export type HecomGastoDisplay = {
  title: string;
  meta: string | null;
};

/**
 * camp plantilla: "Name [N USD - Agencia]|advertiserId|BM200"
 * The "N USD" is BM/package label inside advertiser name — NOT the row spend.
 * notas (TikTok sync): "TikTok API | Campaign Name | CPA: $x | Conv: n | campaign:id"
 */
export function formatHecomGastoDisplay(
  camp: string | null,
  opts?: { notas?: string | null; fee?: number | null; fecha?: string | null },
): HecomGastoDisplay {
  const campaignFromNotas = parseCampaignFromNotas(opts?.notas ?? null);
  const plantilla = parseCampPlantilla(camp);

  const title =
    campaignFromNotas ||
    plantilla.advertiserName ||
    "Gasto ads";

  const metaParts: string[] = [];
  if (campaignFromNotas && plantilla.advertiserName) {
    metaParts.push(plantilla.advertiserName);
  }
  if (opts?.fecha) metaParts.push(opts.fecha);
  if (plantilla.bm) metaParts.push(plantilla.bm);
  if (plantilla.packageLabel) metaParts.push(`Paquete ${plantilla.packageLabel}`);
  if (plantilla.advertiserId) {
    metaParts.push(`ID …${plantilla.advertiserId.slice(-6)}`);
  }
  if (opts?.fee != null) metaParts.push(`Fee ${opts.fee}%`);

  return {
    title,
    meta: metaParts.length ? metaParts.join(" · ") : null,
  };
}

function parseCampaignFromNotas(notas: string | null): string | null {
  if (!notas?.trim()) return null;
  // "TikTok API | Campaign Name | CPA: $…"
  const parts = notas.split("|").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2 && /^tiktok/i.test(parts[0] ?? "")) {
    const name = parts[1];
    if (name && !/^CPA:/i.test(name) && !/^Conv:/i.test(name)) {
      return name.length > 64 ? `${name.slice(0, 61)}…` : name;
    }
  }
  return null;
}

function parseCampPlantilla(camp: string | null): {
  advertiserName: string | null;
  packageLabel: string | null;
  advertiserId: string | null;
  bm: string | null;
} {
  if (!camp?.trim()) {
    return {
      advertiserName: null,
      packageLabel: null,
      advertiserId: null,
      bm: null,
    };
  }

  const pipeParts = camp.split("|").map((p) => p.trim()).filter(Boolean);
  const head = pipeParts[0] ?? camp;
  const advertiserId = pipeParts[1] ?? null;
  const bmRaw = pipeParts[2] ?? null;
  const bm = bmRaw ? bmRaw.replace(/^BM\s*/i, "BM ") : null;

  const match = head.match(
    /^(.*?)\s+(\d+(?:\.\d+)?\s*USD)\s*[-–]\s*(.*)$/i,
  );

  if (match) {
    return {
      advertiserName: match[1].trim() || null,
      packageLabel: match[2].replace(/\s+/g, " ").trim(),
      advertiserId,
      bm,
    };
  }

  return {
    advertiserName: head.trim() || null,
    packageLabel: null,
    advertiserId,
    bm,
  };
}

export function formatHecomFecha(value: string | null): string | null {
  if (!value) return null;
  const raw = value.trim();
  const iso = raw.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  }
  // Ya viene como DD/MM/YYYY
  if (/^\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{4}/.test(raw)) {
    const m = raw.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
    if (m) {
      return `${m[1].padStart(2, "0")}/${m[2].padStart(2, "0")}/${m[3]}`;
    }
  }
  return value;
}

/** Advertiser id embedded in Hecom `gastos.camp` plantilla (pipe segment 2). */
export function getAdvertiserIdFromCamp(camp: string | null): string | null {
  return parseCampPlantilla(camp).advertiserId;
}

/** Campaign name from TikTok sync notes (`notas`). */
export function getCampaignNameFromHecomNotas(notas: string | null): string | null {
  return parseCampaignFromNotas(notas);
}

/** BM label from Hecom `gastos.camp` plantilla (pipe segment 3). */
export function getBmFromHecomCamp(camp: string | null): string | null {
  return parseCampPlantilla(camp).bm;
}

/** BM from camp plantilla, or from advertiser map when camp omits BM. */
export function resolveBmForGasto(
  row: { camp: string | null },
  bmByAdvertiser?: Map<string, string | null>,
): string | null {
  const fromCamp = getBmFromHecomCamp(row.camp);
  if (fromCamp) return fromCamp;
  const advertiserId = getAdvertiserIdFromCamp(row.camp);
  if (advertiserId && bmByAdvertiser?.has(advertiserId)) {
    return bmByAdvertiser.get(advertiserId) ?? null;
  }
  return null;
}
