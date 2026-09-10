import { formatMoney } from "@/lib/format-money";
import {
  escapeHtml,
  wrapHolisticEmail,
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

/** Aviso interno a gerentes: alguien subió comprobante de pago manual. */
export function manualPaymentPendingManagerTemplate(input: {
  appName: string;
  clientEmail: string | null;
  clientName: string | null;
  amountLabel: string;
  creditUsdLabel: string;
  paymentIntentId: string;
  adminUrl: string;
  operationCode?: string | null;
}) {
  const who =
    input.clientName?.trim() ||
    input.clientEmail?.trim() ||
    "Cliente Holistic";
  const subject = `Pago manual pendiente · ${input.amountLabel} · ${who}`;
  const wrapped = wrapHolisticEmail({
    title: "Pago manual por revisar",
    preview: subject,
    bodyHtml: `
      <p style="margin:0 0 12px;"><strong style="color:#1c1917">${escapeHtml(who)}</strong> envió un comprobante de pago manual.</p>
      <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;margin:0 0 14px;border:1px solid #ece7e0;border-radius:12px;background:#faf8f5;">
        <tr><td style="padding:12px 14px;font-size:13px;color:#8a8177;">Monto cobrado</td><td style="padding:12px 14px;text-align:right;font-size:14px;font-weight:700;color:#1c1917;">${escapeHtml(input.amountLabel)}</td></tr>
        <tr><td style="padding:0 14px 12px;font-size:13px;color:#8a8177;">Crédito cartera (USD)</td><td style="padding:0 14px 12px;text-align:right;font-size:14px;font-weight:700;color:#c2410c;">${escapeHtml(input.creditUsdLabel)}</td></tr>
        ${
          input.operationCode
            ? `<tr><td style="padding:0 14px 12px;font-size:13px;color:#8a8177;">Op. / ref.</td><td style="padding:0 14px 12px;text-align:right;font-size:13px;font-family:ui-monospace,Menlo,Consolas,monospace;color:#1c1917;">${escapeHtml(input.operationCode)}</td></tr>`
            : ""
        }
        ${
          input.clientEmail
            ? `<tr><td style="padding:0 14px 12px;font-size:13px;color:#8a8177;">Email</td><td style="padding:0 14px 12px;text-align:right;font-size:13px;color:#1c1917;">${escapeHtml(input.clientEmail)}</td></tr>`
            : ""
        }
      </table>
      <p style="margin:0;font-size:13px;color:#8a8177;">ID: <span style="font-family:ui-monospace,Menlo,Consolas,monospace">${escapeHtml(input.paymentIntentId)}</span></p>
    `,
    ctaLabel: "Revisar en admin",
    ctaUrl: input.adminUrl,
  });
  const text = `Pago manual pendiente. ${who} · ${input.amountLabel} (crédito ${input.creditUsdLabel}). Revisar: ${input.adminUrl}${wrapped.textFooter}`;
  return { subject, text, html: wrapped.html };
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
