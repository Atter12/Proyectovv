import type {
  AssistantBlock,
  AssistantResponse,
  AssistantSource,
  AssistantTable,
} from "./assistant-response";

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
    "El semáforo de ads (rendimiento y tickets) sigue en Profit. Acá el score usa el cargo y los cobros del mes, junto con el rango de cobranza. Los cobros de 90 días y las recargas de la semana se muestran como historial.",
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

function getQuestionContext(brief: AssistantBrief, question: string) {
  const asked = question.trim();
  const named = findNamed(brief, asked);
  const aboutOne = Boolean(
    named &&
      wants(asked, ["score", "deuda", "como esta", "cómo está"]) &&
      !wants(asked, ["quienes", "quiénes", "cuales", "cuáles", "lista", "todos"]),
  );
  const aboutWeek =
    wants(asked, ["semana", "7 dia", "siete dia", "estos dias"]) ||
    (wants(asked, ["ultima", "ultimos"]) &&
      wants(asked, ["recarg", "fee", "cobr", "pago"]));

  return { asked, named, aboutOne, aboutWeek };
}

export function answerAssistant(brief: AssistantBrief, question: string): string {
  const { asked, named, aboutOne, aboutWeek } = getQuestionContext(brief, question);
  if (!asked) {
    return "Pregúntame por los pagos de hoy, quién está activo, las alertas, a quién dar crédito o quién está en rojo.";
  }

  if (aboutOne && named) {
    return cardCliente(named);
  }

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

function paymentsSource(brief: AssistantBrief): AssistantSource {
  return {
    label: "Hecom · Cobros",
    detail: `Cobros registrados el ${brief.today}, agrupados por cliente. Los importes están en USD.`,
  };
}

function activitySource(brief: AssistantBrief): AssistantSource {
  return {
    label: "Hecom · Gasto de ads",
    detail: `Cargo del ${brief.today}, incluido el fee. Se consideran activos los clientes con cargo de al menos ${money(1)}.`,
  };
}

function portfolioSource(brief: AssistantBrief): AssistantSource {
  return {
    label: "Hecom · Cartera",
    detail: `Corte de ${brief.monthLabel}: cargo de ads con fee, cobros del mes y rango de cobranza. El historial de cobros comprende los últimos 90 días al ${brief.today}.`,
  };
}

function rechargeSource(brief: AssistantBrief): AssistantSource {
  return {
    label: "AdsHolistic · Recargas",
    detail: `Recargas a cartera del ${brief.recarga7d.from} al ${brief.recarga7d.to}. Excluye cobros faltantes, pagos de deuda y transferencias internas.`,
  };
}

function clientsTable(rows: AssistantCliente[], caption: string): AssistantTable {
  return {
    columns: [
      { key: "name", label: "Cliente" },
      { key: "score", label: "Cobranza" },
      { key: "debt", label: "Deuda del mes", align: "right" },
      { key: "paid90", label: "Cobrado en 90 días", align: "right" },
    ],
    rows: rows.map((row) => ({
      name: row.name,
      score: bandLabel(row.band),
      debt: money(row.debt),
      paid90: money(row.paid90),
    })),
    caption,
  };
}

function clientBlock(brief: AssistantBrief, row: AssistantCliente): AssistantBlock {
  const account = row.agency ? "Tiene crédito de agencia." : "Es prepago.";
  const lastCobro = row.lastCobro
    ? `Último cobro: ${row.lastCobro}.`
    : "Sin cobros registrados en los últimos 90 días.";
  return {
    id: "client",
    title: row.name,
    text: `Cobranza en ${bandLabel(row.band)}. ${account} ${lastCobro}${row.rango ? ` Rango registrado: ${row.rango}.` : ""} El score se calcula con el cargo, los cobros del mes y el rango de cobranza; el rendimiento de ads se consulta en Profit.`,
    metrics: [
      { label: "Cargo del mes", value: money(row.cargoMonth) },
      { label: "Cobrado del mes", value: money(row.paidMonth) },
      { label: "Deuda del mes", value: money(row.debt) },
    ],
    table: {
      columns: [
        { key: "concept", label: "Historial y actividad" },
        { key: "amount", label: "Importe", align: "right" },
      ],
      rows: [
        { concept: "Cobrado en los últimos 90 días", amount: money(row.paid90) },
        { concept: "Recarga de los últimos 7 días", amount: money(row.recharge7d) },
        { concept: "Fee de recarga de los últimos 7 días", amount: money(row.fee7d) },
        { concept: "Cargo de ads hoy (incluye fee)", amount: money(row.spendToday) },
        { concept: "Cobrado hoy", amount: money(row.paidToday) },
      ],
      caption: `Corte: ${brief.today}. Importes en USD.`,
    },
    sources: [portfolioSource(brief), rechargeSource(brief)],
  };
}

/** Presentation-ready data from the same brief used by the plain-text assistant. */
export function buildAssistantResponse(
  brief: AssistantBrief,
  question: string,
): AssistantResponse {
  const reply = answerAssistant(brief, question);
  const { asked, named, aboutOne, aboutWeek } = getQuestionContext(brief, question);
  const blocks: AssistantBlock[] = [];
  const response = () => ({ reply, today: brief.today, blocks });

  if (!asked) {
    blocks.push({ id: "help", title: "¿Qué quieres consultar?", text: reply, sources: [] });
    return response();
  }

  if (aboutOne && named) {
    blocks.push(clientBlock(brief, named));
    return response();
  }

  if (aboutWeek) {
    const week = brief.recarga7d;
    blocks.push({
      id: "week",
      title: "Recarga y fee de la semana",
      text: `${week.count} recarga${week.count === 1 ? "" : "s"} a cartera del ${week.from} al ${week.to}. No incluye boletas de cobro faltante ni pagos de deuda del link.`,
      metrics: [
        { label: "Recarga a cartera", value: money(week.creditUsd) },
        { label: "Fee de recarga", value: money(week.feeUsd) },
        { label: "Total cobrado", value: money(week.creditUsd + week.feeUsd) },
      ],
      sources: [rechargeSource(brief)],
    });
  }

  if (!aboutWeek && wants(asked, ["pago", "pagos", "cobro", "cobrado", "deposito", "depósito"])) {
    const visible = brief.pagosHoy.slice(0, 15);
    blocks.push({
      id: "payments",
      title: "Pagos de hoy",
      text: brief.pagosHoy.length
        ? `Cobros del ${brief.today}, agrupados por cliente.`
        : `Hoy ${brief.today} no hay cobros registrados en Hecom.`,
      metrics: [
        { label: "Total cobrado", value: money(brief.pagosHoyTotal) },
        { label: "Clientes con pagos", value: String(brief.pagosHoy.length) },
      ],
      ...(visible.length ? {
        table: {
          columns: [
            { key: "name", label: "Cliente" },
            { key: "amount", label: "Cobrado hoy", align: "right" as const },
          ],
          rows: visible.map((row) => ({ name: row.name, amount: money(row.amount) })),
          caption: `Mostrando ${visible.length} de ${brief.pagosHoy.length} clientes. Importes en USD.`,
        },
      } : {}),
      sources: [paymentsSource(brief)],
    });
  }

  if (wants(asked, ["activo", "activos", "gastando", "gasto de hoy", "hoy estan", "hoy están"])) {
    const visible = brief.activosHoy.slice(0, 15);
    blocks.push({
      id: "active",
      title: "Clientes activos hoy",
      text: brief.activosHoy.length
        ? `Clientes con cargo de ads registrado el ${brief.today}. Los importes incluyen el fee.`
        : `Hoy ${brief.today} no veo gasto de ads cargado en Hecom. Los clientes aparecen cuando se sincroniza el gasto del día.`,
      metrics: [
        { label: "Clientes activos", value: String(brief.activosHoy.length) },
        { label: "Cargo de clientes activos", value: money(brief.activosHoy.reduce((sum, row) => sum + row.spend, 0)) },
      ],
      ...(visible.length ? {
        table: {
          columns: [
            { key: "name", label: "Cliente" },
            { key: "spend", label: "Cargo de ads", align: "right" as const },
          ],
          rows: visible.map((row) => ({ name: row.name, spend: money(row.spend) })),
          caption: `Mostrando ${visible.length} de ${brief.activosHoy.length} clientes. Incluye fee. Importes en USD.`,
        },
      } : {}),
      sources: [activitySource(brief)],
    });
  }

  if (wants(asked, ["alerta", "alertas", "riesgo", "revisar", "en orden", "monitore"])) {
    const hasAlerts = brief.alertas.length > 0 || brief.rojos.length > 0 || brief.pendingVouchers > 0;
    blocks.push({
      id: "alerts",
      title: "Alertas de cartera",
      text: hasAlerts
        ? "Hay puntos para revisar en la cartera y en los pagos manuales."
        : "No hay clientes en rojo ni vouchers pendientes en este corte.",
      metrics: [
        { label: "Clientes en rojo", value: String(brief.rojos.length) },
        { label: "Vouchers pendientes", value: String(brief.pendingVouchers) },
        { label: "Clientes activos hoy", value: String(brief.activosHoy.length) },
      ],
      ...(brief.alertas.length ? {
        table: {
          columns: [{ key: "alert", label: "Detalle de la alerta" }],
          rows: brief.alertas.map((alert) => ({ alert })),
          caption: `Corte: ${brief.today}.`,
        },
      } : {}),
      sources: [
        portfolioSource(brief),
        activitySource(brief),
        {
          label: "AdsHolistic · Pagos manuales",
          detail: `Vouchers pendientes de revisión al corte del ${brief.today}.`,
        },
      ],
    });
  }

  if (wants(asked, ["credito", "crédito", "cupo", "prestar"])) {
    const visible = brief.credito.slice(0, 12);
    blocks.push({
      id: "credit",
      title: "Candidatos a crédito",
      text: brief.credito.length
        ? `Candidatos según la cobranza de ${brief.monthLabel}. Esta lectura no asigna crédito: el cupo lo confirma gerencia.`
        : `Con el corte de ${brief.monthLabel} no hay candidatos claros para dar más crédito.`,
      metrics: [{ label: "Candidatos en el corte", value: String(brief.credito.length) }],
      ...(visible.length ? {
        table: clientsTable(visible, `Mostrando ${visible.length} de ${brief.credito.length} candidatos del corte. La selección incluye hasta 20 clientes. Importes en USD.`),
      } : {}),
      sources: [portfolioSource(brief)],
    });
  }

  if (wants(asked, ["rojo", "roja", "no pagan", "moroso", "deuda"]) && !aboutOne) {
    const visible = brief.rojos.slice(0, 12);
    blocks.push({
      id: "red",
      title: "Clientes en rojo",
      text: brief.rojos.length
        ? `Clientes en rojo por deuda o por rango de cobranza en ${brief.monthLabel}.`
        : `En ${brief.monthLabel} no hay clientes en rojo por deuda o por rango de cobranza.`,
      metrics: [
        { label: "Clientes en rojo", value: String(brief.rojos.length) },
        { label: "Deuda de clientes en rojo", value: money(brief.rojos.reduce((sum, row) => sum + row.debt, 0)) },
      ],
      ...(visible.length ? {
        table: clientsTable(visible, `Mostrando ${visible.length} de ${brief.rojos.length} clientes en rojo. Importes en USD.`),
      } : {}),
      sources: [portfolioSource(brief)],
    });
  }

  if (!blocks.length) {
    blocks.push(named
      ? clientBlock(brief, named)
      : { id: "help", title: "Puedo ayudarte con la cartera", text: reply, sources: [] });
  }

  return response();
}
