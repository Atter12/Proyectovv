import { formatMoney } from "@/lib/format-money";
import {
  escapeHtml,
  wrapHolisticEmail,
  wrapInternalEmail,
  EMAIL_MONO,
} from "@/lib/email/templates/layout";

export function paymentSucceededTemplate(input: {
  appName: string;
  amountCents: number;
  currency: string;
  provider: string;
  dashboardUrl: string;
}) {
  const amount = formatMoney(input.amountCents / 100, input.currency);
  const subject = `Depósito confirmado por ${amount}`;
  const providerLabel =
    input.provider === "manual"
      ? "pago manual"
      : input.provider === "crypto"
        ? "cripto"
        : input.provider;
  const wrapped = wrapHolisticEmail({
    title: "Depósito confirmado",
    preview: subject,
    bodyHtml: `
      <p style="margin:0 0 12px;">Tu depósito de <strong style="color:#1c1917">${escapeHtml(amount)}</strong> vía <strong style="color:#1c1917">${escapeHtml(providerLabel)}</strong> fue confirmado.</p>
      <p style="margin:0;">El saldo ya está disponible en tu cartera de ${escapeHtml(input.appName)}. Puedes asignarlo a tus cuentas TikTok cuando quieras.</p>
    `,
    ctaLabel: "Ver cartera",
    ctaUrl: input.dashboardUrl,
  });
  const text = `Tu depósito de ${amount} vía ${providerLabel} fue confirmado. Revisa tu cartera en ${input.dashboardUrl}${wrapped.textFooter}`;
  return { subject, text, html: wrapped.html };
}

export function manualPaymentCreatedTemplate(input: {
  appName: string;
  amountCents: number;
  currency: string;
  dashboardUrl: string;
}) {
  const amount = formatMoney(input.amountCents / 100, input.currency);
  const subject = `Solicitud de depósito manual registrada por ${amount}`;
  const wrapped = wrapHolisticEmail({
    title: "Depósito manual registrado",
    preview: subject,
    bodyHtml: `
      <p style="margin:0 0 12px;">Registramos tu solicitud de depósito manual por <strong style="color:#1c1917">${escapeHtml(amount)}</strong>.</p>
      <p style="margin:0;">El saldo se acredita cuando el equipo apruebe el comprobante. Te avisamos por email cuando quede listo.</p>
    `,
    ctaLabel: "Ver pagos",
    ctaUrl: input.dashboardUrl,
  });
  const text = `Registramos tu solicitud de depósito manual por ${amount}. El saldo se acreditará cuando el equipo apruebe el comprobante.${wrapped.textFooter}`;
  return { subject, text, html: wrapped.html };
}

export type ManualPaymentPendingKind =
  | "wallet"
  | "debt"
  | "missing_cobro"
  | "realprofit";

const PENDING_KIND_TITLE: Record<ManualPaymentPendingKind, string> = {
  wallet: "Recarga por revisar",
  debt: "Pago de deuda por revisar",
  missing_cobro: "Cobro faltante por revisar",
  realprofit: "Profit COD por revisar",
};

/** Qué pasa con el dinero cuando no es una recarga de cartera. */
const PENDING_KIND_DESTINATION: Record<Exclude<ManualPaymentPendingKind, "wallet">, string> = {
  debt: "Baja la deuda del mes (Lo pagado)",
  missing_cobro: "Se registra en Lo pagado",
  realprofit: "Real Profit COD",
};

const INK = "#1a1917";
const MUTED = "#6b665f";
const HAIRLINE = "#e8e4dd";

function listRow(
  label: string,
  valueHtml: string,
  options: { first?: boolean; quiet?: boolean } = {},
): string {
  const border = options.first ? "" : `border-top:1px solid ${HAIRLINE};`;
  return `
      <tr>
        <td style="${border}padding:13px 16px 13px 0;font-size:14px;color:${MUTED};vertical-align:top;white-space:nowrap;">${escapeHtml(label)}</td>
        <td align="right" style="${border}padding:13px 0;font-size:14px;color:${options.quiet ? MUTED : INK};vertical-align:top;">${valueHtml}</td>
      </tr>`;
}

function fileTypeLabel(fileName: string): string {
  const ext = fileName.split(".").pop()?.toUpperCase() ?? "";
  return ext === "JPEG" ? "JPG" : ext || "archivo";
}

function trimSentence(value: string): string {
  return value.trim().replace(/[.。]+$/, "");
}

/**
 * Aviso interno a gerentes: alguien subió comprobante de pago manual.
 * A la izquierda lo que se busca en el banco; a la derecha el voucher, para
 * cotejarlo en PC sin abrir el admin. El voucher también va como adjunto.
 */
export function manualPaymentPendingManagerTemplate(input: {
  kind: ManualPaymentPendingKind;
  /** Nombre real (cliente Hecom). Nunca el usuario de la plataforma. */
  clientName: string;
  clientEmail: string | null;
  chargedLabel: string;
  payMethodLabel: string;
  /** Titular que paga según el voucher, si la IA lo leyó. */
  payerName: string | null;
  destinationLabel: string | null;
  operationCode: string | null;
  /** Fecha del pago según el voucher; si la IA no la leyó, va la de envío. */
  paidAtLabel: string | null;
  submittedAtLabel: string;
  /** Solo recargas: lo que entra a la cartera. */
  creditLabel: string | null;
  feeLabel: string | null;
  reviewReason: string;
  checks: Array<{ label: string; ok: boolean }>;
  alerts: string[];
  paymentIntentId: string;
  adminUrl: string;
  proof: {
    fileName: string;
    attached: boolean;
    url: string | null;
    /** `cid` de la imagen incrustada; null si es PDF o pesa demasiado. */
    inlineCid: string | null;
  } | null;
}) {
  const title = PENDING_KIND_TITLE[input.kind];
  const subject = `[Acción] ${title} · ${input.chargedLabel} · ${input.payMethodLabel} · ${input.clientName}`;
  const preview = `${input.clientName} envió ${input.chargedLabel} por ${input.payMethodLabel}${input.operationCode ? ` · Op. ${input.operationCode}` : ""}.`;

  const operationHtml = input.operationCode
    ? `<span style="font-family:${EMAIL_MONO};font-size:13px;letter-spacing:0.02em;">${escapeHtml(input.operationCode)}</span>`
    : `<span style="color:${MUTED};">Sin número</span>`;

  const paymentRows = [
    listRow("Medio de pago", escapeHtml(input.payMethodLabel), { first: true }),
    input.payerName ? listRow("Pagado por", escapeHtml(input.payerName)) : "",
    input.destinationLabel
      ? listRow("Cuenta destino", escapeHtml(input.destinationLabel))
      : "",
    listRow("N° de operación", operationHtml),
    input.paidAtLabel
      ? listRow("Fecha del pago", escapeHtml(input.paidAtLabel))
      : listRow("Voucher enviado", escapeHtml(input.submittedAtLabel)),
  ].join("");

  const walletRows =
    input.kind === "wallet"
      ? [
          input.creditLabel
            ? listRow("Acredita en cartera", escapeHtml(input.creditLabel), { first: true, quiet: true })
            : "",
          input.feeLabel
            ? listRow("Fee Holistic", escapeHtml(input.feeLabel), { first: !input.creditLabel, quiet: true })
            : "",
        ].join("")
      : listRow("Destino", escapeHtml(PENDING_KIND_DESTINATION[input.kind]), { first: true, quiet: true });

  const walletBlock = walletRows.trim()
    ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:20px;border-top:1px solid ${HAIRLINE};">${walletRows}</table>`
    : "";

  const voucherHtml = input.proof
    ? `
          ${
            input.proof.inlineCid
              ? `<img src="cid:${escapeHtml(input.proof.inlineCid)}" alt="Voucher de ${escapeHtml(input.clientName)}" width="200" style="display:block;width:200px;max-width:100%;height:auto;border:1px solid ${HAIRLINE};border-radius:12px;" />`
              : `<div style="padding:28px 16px;border:1px solid ${HAIRLINE};border-radius:12px;text-align:center;font-size:13px;line-height:1.5;color:${MUTED};">Voucher en archivo<br />ábrelo desde el adjunto</div>`
          }
          <p style="margin:12px 0 0;font-size:12px;line-height:1.5;color:${MUTED};">
            ${input.proof.attached ? "Adjunto en este correo" : "Muy pesado para adjuntar"} · ${escapeHtml(fileTypeLabel(input.proof.fileName))}
          </p>
          ${
            input.proof.url
              ? `<p style="margin:6px 0 0;font-size:13px;"><a href="${escapeHtml(input.proof.url)}" style="color:${INK};text-decoration:underline;">Ver en tamaño completo</a></p>`
              : ""
          }`
    : `<div style="padding:28px 16px;border:1px solid ${HAIRLINE};border-radius:12px;text-align:center;font-size:13px;line-height:1.5;color:${MUTED};">No encontramos el voucher.<br />Revísalo en admin.</div>`;

  const failedChecks = input.checks.filter((c) => !c.ok).map((c) => c.label.toLowerCase());
  const checksText = input.checks.length
    ? failedChecks.length
      ? `no coincide: ${failedChecks.join(" y ")}`
      : input.checks.length > 1
        ? "monto y beneficiario del voucher coinciden"
        : `${input.checks[0]!.label.toLowerCase()} coincide`
    : null;
  const reviewLine = [trimSentence(input.reviewReason), checksText]
    .filter(Boolean)
    .join(" · ");

  const alertsHtml = input.alerts
    .map(
      (alert) => `
      <p style="margin:0 0 10px;padding:14px 18px;background:#fbeeec;border-radius:6px;font-size:14px;line-height:1.5;color:#8f1d12;text-align:center;">${escapeHtml(alert)}</p>`,
    )
    .join("");

  const bodyHtml = `
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
        <tr>
          <td class="hi-col" width="296" style="width:296px;padding-right:24px;vertical-align:top;">
            <p class="hi-amount" style="margin:0;font-size:40px;line-height:1.1;font-weight:700;letter-spacing:-0.02em;color:${INK};">${escapeHtml(input.chargedLabel)}</p>
            <p style="margin:14px 0 0;font-size:20px;line-height:1.3;color:${INK};">${escapeHtml(input.clientName)}</p>
            ${input.clientEmail ? `<p style="margin:6px 0 0;font-size:14px;color:${MUTED};">${escapeHtml(input.clientEmail)}</p>` : ""}

            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:28px;border-top:1px solid ${HAIRLINE};">
              ${paymentRows}
            </table>
            ${walletBlock}
          </td>
          <td class="hi-col hi-voucher" width="200" style="width:200px;vertical-align:top;">
            ${voucherHtml}
          </td>
        </tr>
      </table>

      <div style="margin-top:32px;">
        ${alertsHtml}
        <p style="margin:0;padding:14px 18px;background:#f6f1e8;border-radius:6px;font-size:14px;line-height:1.5;color:#5c574f;text-align:center;">${escapeHtml(reviewLine)}</p>
      </div>

      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:16px;">
        <tr>
          <td align="center" style="background:#141414;border-radius:6px;">
            <a href="${escapeHtml(input.adminUrl)}" style="display:block;padding:16px 20px;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;">Revisar pago</a>
          </td>
        </tr>
      </table>
  `;

  const html = wrapInternalEmail({
    label: title,
    preview,
    bodyHtml,
    footerNote: `Holistic Marketing · aviso interno para gerencia · Pago ${input.paymentIntentId.slice(0, 8)}`,
  });

  const textLines = [
    `${title}: ${input.clientName}${input.clientEmail ? ` (${input.clientEmail})` : ""}`,
    ...input.alerts.map((a) => `ALERTA: ${a}`),
    "",
    `Monto: ${input.chargedLabel}`,
    `Medio de pago: ${input.payMethodLabel}`,
    input.payerName ? `Pagado por: ${input.payerName}` : null,
    input.destinationLabel ? `Cuenta destino: ${input.destinationLabel}` : null,
    input.operationCode ? `N° de operación: ${input.operationCode}` : null,
    input.paidAtLabel
      ? `Fecha del pago: ${input.paidAtLabel}`
      : `Voucher enviado: ${input.submittedAtLabel}`,
    input.kind === "wallet"
      ? [
          input.creditLabel ? `Acredita en cartera: ${input.creditLabel}` : null,
          input.feeLabel ? `Fee Holistic: ${input.feeLabel}` : null,
        ]
          .filter(Boolean)
          .join("\n") || null
      : `Destino: ${PENDING_KIND_DESTINATION[input.kind]}`,
    "",
    reviewLine,
    input.proof?.url ? `Voucher: ${input.proof.url}` : null,
    `Revisar pago: ${input.adminUrl}`,
  ].filter((line): line is string => line !== null);

  return { subject, text: textLines.join("\n"), html };
}

/** Cliente: gerentes ya aceptaron el pago manual. */
export function manualPaymentApprovedClientTemplate(input: {
  appName: string;
  creditUsdLabel: string;
  chargedLabel: string;
  dashboardUrl: string;
}) {
  const subject = `Pago manual aprobado · ${input.creditUsdLabel} en tu cartera`;
  const wrapped = wrapHolisticEmail({
    title: "Pago manual aprobado",
    preview: subject,
    bodyHtml: `
      <p style="margin:0 0 12px;">Ya revisamos tu comprobante y acreditamos el saldo en tu cartera.</p>
      <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;margin:0 0 14px;border:1px solid #ffd7b8;border-radius:12px;background:#fff7f0;">
        <tr><td style="padding:14px;font-size:13px;color:#8a8177;">Acreditado en cartera</td><td style="padding:14px;text-align:right;font-size:20px;font-weight:700;color:#c2410c;">${escapeHtml(input.creditUsdLabel)}</td></tr>
        <tr><td style="padding:0 14px 14px;font-size:13px;color:#8a8177;">Monto del comprobante</td><td style="padding:0 14px 14px;text-align:right;font-size:14px;font-weight:600;color:#1c1917;">${escapeHtml(input.chargedLabel)}</td></tr>
      </table>
      <p style="margin:0;">Puedes asignar ese saldo a tus cuentas TikTok desde Pagos. El fee Holistic ya se descontó al recargar; al asignar es 1 a 1.</p>
    `,
    ctaLabel: "Ir a Pagos",
    ctaUrl: input.dashboardUrl,
  });
  const text = `Pago manual aprobado. Acreditamos ${input.creditUsdLabel} en tu cartera (comprobante ${input.chargedLabel}). Asigna saldo en ${input.dashboardUrl}${wrapped.textFooter}`;
  return { subject, text, html: wrapped.html };
}
