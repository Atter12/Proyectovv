export type CobranzaBand = "red" | "orange" | "yellow" | "green" | "idle";

export type AssistantCliente = {
  name: string;
  agency: boolean;
  rango: string | null;
  spendToday: number;
  paidToday: number;
  cargoMonth: number;
  paidMonth: number;
  debt: number;
  band: CobranzaBand;
  /** Cobros Hecom de los últimos 90 días. */
  paid90: number;
  /** Recarga a cartera de los últimos 7 días. */
  recharge7d: number;
  fee7d: number;
  lastCobro: string | null;
};

export type AssistantWeek = {
  from: string;
  to: string;
  count: number;
  creditUsd: number;
  feeUsd: number;
};

export type AssistantBrief = {
  today: string;
  monthLabel: string;
  pagosHoy: { name: string; amount: number }[];
  pagosHoyTotal: number;
  activosHoy: { name: string; spend: number }[];
  rojos: AssistantCliente[];
  credito: AssistantCliente[];
  alertas: string[];
  clientes: AssistantCliente[];
  pendingVouchers: number;
  recarga7d: AssistantWeek;
};

export function foldText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function cobranzaBand(input: {
  rango: string | null;
  cargo: number;
  paid: number;
}): CobranzaBand {
  const rango = foldText(input.rango || "");
  const cargo = Math.max(0, input.cargo);
  const paid = Math.max(0, input.paid);
  const debt = Math.max(0, cargo - paid);
  const ratio = cargo > 0 ? paid / cargo : 1;
  if (/roja|rojo/.test(rango) || (debt >= 200 && ratio < 0.35)) return "red";
  if (debt >= 80 && ratio < 0.6) return "orange";
  if (debt >= 20) return "yellow";
  if (cargo > 0) return "green";
  return "idle";
}

export function money(amount: number): string {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(round2(amount));
}

function bandLabel(band: CobranzaBand): string {
  switch (band) {
    case "red":
      return "rojo";
    case "orange":
      return "naranja";
    case "yellow":
      return "amarillo";
    case "green":
      return "verde";
    default:
      return "sin gasto este mes";
  }
}

function cardCliente(row: AssistantCliente): string {
  const lines = [
    row.name,
    `Score de cobranza: ${bandLabel(row.band)}. Este mes el cargo es ${money(row.cargoMonth)}, cobrado ${money(row.paidMonth)}, deuda ${money(row.debt)}.`,
    `En los últimos 90 días cobró ${money(row.paid90)}.`,
    row.recharge7d > 0 || row.fee7d > 0
      ? `Esta semana recargó ${money(row.recharge7d)} y el fee fue ${money(row.fee7d)}.`
      : "Esta semana no recargó cartera.",
    row.lastCobro ? `Último cobro: ${row.lastCobro}.` : null,
    row.agency ? "Tiene crédito de agencia." : "Es prepago.",
    row.rango ? `Rango de cobranza: ${row.rango}.` : null,
    row.spendToday > 0 ? `Hoy lleva ${money(row.spendToday)} de gasto en ads.` : null,
    "El semáforo de ads (rendimiento y tickets) sigue en Profit. Acá el score usa la deuda del mes, lo cobrado en 90 días y las recargas de la semana.",
  ];
  return lines.filter(Boolean).join("\n");
}

function lineCliente(row: AssistantCliente): string {
  return `${row.name}: ${bandLabel(row.band)}, deuda ${money(row.debt)} (90 días cobró ${money(row.paid90)})`;
}

function findNamed(brief: AssistantBrief, question: string): AssistantCliente | null {
  const q = foldText(question);
  let hit: AssistantCliente | null = null;
  for (const row of brief.clientes) {
    const name = foldText(row.name);
    if (name.length < 4) continue;
    if (!q.includes(name)) continue;
    if (!hit || name.length > foldText(hit.name).length) hit = row;
  }
  return hit;
}

function wants(question: string, words: string[]): boolean {
  const q = foldText(question);
  return words.some((word) => q.includes(word));
}

export function answerAssistant(brief: AssistantBrief, question: string): string {
  const asked = question.trim();
  if (!asked) {
    return "Pregúntame por los pagos de hoy, quién está activo, las alertas, a quién dar crédito o quién está en rojo.";
  }

  const named = findNamed(brief, asked);
  const aboutOne =
    named &&
    wants(asked, ["score", "deuda", "como esta", "cómo está"]) &&
    !wants(asked, ["quienes", "quiénes", "cuales", "cuáles", "lista", "todos"]);
  if (aboutOne) {
    return cardCliente(named);
  }

  const aboutWeek =
    wants(asked, ["semana", "7 dia", "siete dia", "estos dias"]) ||
    (wants(asked, ["ultima", "ultimos"]) &&
      wants(asked, ["recarg", "fee", "cobr", "pago"]));
  const parts: string[] = [];

  if (aboutWeek) {
    const week = brief.recarga7d;
    parts.push(
      `Del ${week.from} al ${week.to}: ${week.count} recargas a cartera.\nRecarga: ${money(week.creditUsd)}.\nFee: ${money(week.feeUsd)}.\nTotal cobrado: ${money(week.creditUsd + week.feeUsd)}.\nNo entran aquí las boletas de cobro faltante ni los pagos de deuda del link.`,
    );
  }

  if (!aboutWeek && wants(asked, ["pago", "pagos", "cobro", "cobrado", "deposito", "depósito"])) {
    if (!brief.pagosHoy.length) {
      parts.push(`Hoy ${brief.today} no hay cobros registrados en Hecom.`);
    } else {
      const lines = brief.pagosHoy
        .slice(0, 15)
        .map((row) => `• ${row.name}: ${money(row.amount)}`);
      const more =
        brief.pagosHoy.length > 15
          ? `\n…y ${brief.pagosHoy.length - 15} más.`
          : "";
      parts.push(
        `Pagos de hoy (${brief.today}): ${money(brief.pagosHoyTotal)} en ${brief.pagosHoy.length} cliente${brief.pagosHoy.length === 1 ? "" : "s"}.\n${lines.join("\n")}${more}`,
      );
    }
  }

  if (wants(asked, ["activo", "activos", "gastando", "gasto de hoy", "hoy estan", "hoy están"])) {
    if (!brief.activosHoy.length) {
      parts.push(
        `Hoy ${brief.today} no veo gasto de ads cargado en Hecom. Si el gasto del día todavía no sincronizó, más tarde sí aparecen.`,
      );
    } else {
      const lines = brief.activosHoy
        .slice(0, 15)
        .map((row) => `• ${row.name}: ${money(row.spend)}`);
      const more =
        brief.activosHoy.length > 15
          ? `\n…y ${brief.activosHoy.length - 15} más.`
          : "";
      parts.push(
        `Clientes con gasto hoy (${brief.today}): ${brief.activosHoy.length}.\n${lines.join("\n")}${more}`,
      );
    }
  }

  if (wants(asked, ["alerta", "alertas", "riesgo", "revisar", "en orden", "monitore"])) {
    if (!brief.alertas.length && !brief.rojos.length) {
      parts.push(
        `Hoy está en orden: no hay clientes en rojo ni vouchers trabados. Activos con gasto: ${brief.activosHoy.length}. Pagos del día: ${money(brief.pagosHoyTotal)}.`,
      );
    } else {
      const lines = brief.alertas.map((row) => `• ${row}`);
      parts.push(
        `Hay cosas para revisar.\n${lines.join("\n")}\n\nActivos hoy: ${brief.activosHoy.length}. Pagos hoy: ${money(brief.pagosHoyTotal)}.`,
      );
    }
  }

  if (wants(asked, ["credito", "crédito", "cupo", "prestar"])) {
    if (!brief.credito.length) {
      parts.push(
        "Con el corte de este mes no hay candidatos claros para dar más crédito. Los verdes son pocos o ya tienen deuda marcada.",
      );
    } else {
      const lines = brief.credito.slice(0, 12).map((row) => `• ${lineCliente(row)}`);
      parts.push(
        `Pueden ir a crédito o seguir con cupo, según cobranza de ${brief.monthLabel}:\n${lines.join("\n")}\n\nNo asigna solo. Esto es la lectura; el cupo lo confirmas tú.`,
      );
    }
  }

  if (wants(asked, ["rojo", "roja", "no pagan", "moroso", "deuda"]) && !aboutOne) {
    if (!brief.rojos.length) {
      parts.push(
        `En ${brief.monthLabel} no hay clientes en rojo por deuda o por rango de cobranza.`,
      );
    } else {
      const lines = brief.rojos.slice(0, 12).map((row) => `• ${lineCliente(row)}`);
      const more =
        brief.rojos.length > 12 ? `\n…y ${brief.rojos.length - 12} más en rojo.` : "";
      parts.push(
        `En rojo (${brief.monthLabel}), ${brief.rojos.length}:\n${lines.join("\n")}${more}`,
      );
    }
  }

  if (parts.length) return parts.join("\n\n");
  if (named) return cardCliente(named);

  return `Puedo armar la cartera de ${brief.monthLabel}, la recarga y el fee de esta semana, y el score de un cliente con su historial. Pregúntame, por ejemplo: cuánto recargaron esta semana, pagos de hoy, quién está en rojo, o el score de un cliente.`;
}
