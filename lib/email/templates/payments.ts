import { formatMoney } from "@/lib/format-money";

export function paymentSucceededTemplate(input: {
  appName: string;
  amountCents: number;
  currency: string;
  provider: string;
  dashboardUrl: string;
}) {
  const amount = formatMoney(input.amountCents / 100, input.currency);
  const subject = `Depósito confirmado por ${amount}`;
  const text = `Tu depósito de ${amount} vía ${input.provider} fue confirmado. Puedes revisar tu cartera en ${input.dashboardUrl}`;
  const html = `
    <div style="font-family:Inter,Arial,sans-serif;line-height:1.5;color:#0f172a">
      <h1 style="font-size:22px;margin:0 0 12px">Depósito confirmado</h1>
      <p>Tu depósito de <strong>${amount}</strong> vía <strong>${input.provider}</strong> fue confirmado.</p>
      <p>El saldo ya fue registrado en el ledger financiero de ${input.appName}.</p>
      <p><a href="${input.dashboardUrl}" style="display:inline-block;background:#4056ff;color:#fff;padding:10px 14px;border-radius:10px;text-decoration:none">Ver cartera</a></p>
    </div>
  `;
  return { subject, text, html };
}

export function manualPaymentCreatedTemplate(input: {
  appName: string;
  amountCents: number;
  currency: string;
  dashboardUrl: string;
}) {
  const amount = formatMoney(input.amountCents / 100, input.currency);
  const subject = `Solicitud de depósito manual registrada por ${amount}`;
  const text = `Registramos tu solicitud de depósito manual por ${amount}. El saldo se acreditará cuando el equipo financiero apruebe el comprobante.`;
  const html = `
    <div style="font-family:Inter,Arial,sans-serif;line-height:1.5;color:#0f172a">
      <h1 style="font-size:22px;margin:0 0 12px">Depósito manual registrado</h1>
      <p>Registramos tu solicitud de depósito manual por <strong>${amount}</strong>.</p>
      <p>El saldo se acreditará solo cuando el equipo financiero apruebe el comprobante.</p>
      <p><a href="${input.dashboardUrl}" style="display:inline-block;background:#4056ff;color:#fff;padding:10px 14px;border-radius:10px;text-decoration:none">Ver pagos</a></p>
    </div>
  `;
  return { subject, text, html };
}
