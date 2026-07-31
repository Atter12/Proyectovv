import { sendTransactionalEmail } from "@/lib/email/email.server";
import { serverEnv } from "@/lib/env/env.server";
import { siteConfig } from "@/config/site";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Email de acceso cliente: código 6 dígitos + enlace mágico (Resend).
 */
export async function sendHecomOtpEmail(input: {
  to: string;
  code: string;
  magicLink: string;
}): Promise<{ sent: boolean; providerMessageId?: string }> {
  const brand = siteConfig.name;
  const logoUrl = `${serverEnv.appUrl.replace(/\/$/, "")}${siteConfig.logoSrc}`;
  const code = escapeHtml(input.code);
  const magicLink = escapeHtml(input.magicLink);
  const safeBrand = escapeHtml(brand);

  const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
<body style="margin:0;padding:0;background:#0f0e0c;font-family:Georgia,'Times New Roman',serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0f0e0c;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:480px;background:#1a1814;border:1px solid #2e2a24;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="padding:28px 28px 8px;text-align:center;">
              <img src="${logoUrl}" alt="${safeBrand}" width="180" style="display:inline-block;max-width:180px;height:auto;" />
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 0;text-align:center;">
              <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;letter-spacing:0.12em;text-transform:uppercase;color:#ff781f;font-weight:700;">
                ${safeBrand}
              </p>
              <h1 style="margin:12px 0 0;font-size:26px;line-height:1.25;color:#f7f3ec;font-weight:600;">
                Tu acceso
              </h1>
              <p style="margin:12px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#b7aea2;">
                Usá el código de 6 dígitos o el enlace mágico. Expira pronto y es de un solo uso.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 28px 8px;text-align:center;">
              <p style="margin:0 0 10px;font-family:Arial,Helvetica,sans-serif;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#8a8176;">
                Código
              </p>
              <div style="display:inline-block;padding:14px 22px;border-radius:12px;background:#0f0e0c;border:1px solid #3a342c;">
                <span style="font-family:ui-monospace,Menlo,Consolas,monospace;font-size:32px;letter-spacing:0.28em;color:#fff;font-weight:700;">
                  ${code}
                </span>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 28px 28px;text-align:center;">
              <a href="${magicLink}" style="display:inline-block;background:#ff781f;color:#fff;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;text-decoration:none;padding:14px 22px;border-radius:12px;">
                Entrar con enlace mágico
              </a>
              <p style="margin:18px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:#7a7268;">
                Si no pediste este acceso, ignorá este correo.
              </p>
            </td>
          </tr>
        </table>
        <p style="margin:18px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#5c564e;">
          © ${new Date().getFullYear()} ${safeBrand}
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    `${brand} — tu acceso`,
    ``,
    `Código: ${input.code}`,
    ``,
    `O abrí el enlace mágico:`,
    input.magicLink,
    ``,
    `Expira pronto y es de un solo uso.`,
  ].join("\n");

  return sendTransactionalEmail({
    to: input.to,
    subject: `Tu código de acceso — ${brand}`,
    html,
    text,
    templateKey: "auth.hecom.otp",
    idempotencyKey: `email:hecom_otp:${input.to}:${input.code}`,
    metadata: { channel: "hecom_otp" },
  });
}
