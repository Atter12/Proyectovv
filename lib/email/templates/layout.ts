import { siteConfig } from "@/config/site";
import { serverEnv } from "@/lib/env/env.server";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Shell Holistic para emails transaccionales (firma incluida). */
export function wrapHolisticEmail(input: {
  title: string;
  preview?: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
}): { html: string; textFooter: string } {
  const brand = escapeHtml(siteConfig.name);
  const company = escapeHtml(siteConfig.companyName ?? siteConfig.name);
  const logoUrl = `${serverEnv.appUrl.replace(/\/$/, "")}${siteConfig.logoSrc}`;
  const title = escapeHtml(input.title);
  const preview = input.preview ? escapeHtml(input.preview) : "";
  const year = new Date().getFullYear();
  const support = escapeHtml(serverEnv.supportEmail || "soporte@hecom.club");

  const cta =
    input.ctaLabel && input.ctaUrl
      ? `<tr>
            <td style="padding:8px 28px 28px;text-align:center;">
              <a href="${escapeHtml(input.ctaUrl)}" style="display:inline-block;background:#ff781f;color:#fff;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;text-decoration:none;padding:14px 22px;border-radius:12px;">
                ${escapeHtml(input.ctaLabel)}
              </a>
            </td>
          </tr>`
      : "";

  const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" />
  ${preview ? `<title>${preview}</title>` : ""}
</head>
<body style="margin:0;padding:0;background:#f7f4ef;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f7f4ef;padding:28px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:520px;background:#ffffff;border:1px solid #ece7e0;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="padding:24px 28px 8px;text-align:center;background:linear-gradient(180deg,#fffaf6 0%,#ffffff 100%);">
              <img src="${logoUrl}" alt="${brand}" width="160" style="display:inline-block;max-width:160px;height:auto;" />
              <p style="margin:12px 0 0;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#ff781f;font-weight:700;">
                ${brand}
              </p>
              <h1 style="margin:10px 0 0;font-size:22px;line-height:1.25;color:#1c1917;font-weight:700;">
                ${title}
              </h1>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 8px;font-size:15px;line-height:1.55;color:#5c564e;">
              ${input.bodyHtml}
            </td>
          </tr>
          ${cta}
          <tr>
            <td style="padding:0 28px 24px;border-top:1px solid #f0ebe4;">
              <p style="margin:18px 0 0;font-size:12px;line-height:1.5;color:#8a8177;">
                Equipo ${brand}<br/>
                Pagos y cartera · Ads Holistic<br/>
                <a href="mailto:${support}" style="color:#c2410c;text-decoration:none;">${support}</a>
              </p>
              <p style="margin:10px 0 0;font-size:11px;color:#b0a89e;">
                © ${year} ${company}. Este correo es transaccional.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return {
    html,
    textFooter: `\n\n—\nEquipo ${siteConfig.name}\nPagos y cartera · Ads Holistic\n${serverEnv.supportEmail || "soporte@hecom.club"}`,
  };
}

/** Pila de fuentes del sistema: en correo no se cargan fuentes web. */
export const EMAIL_SANS =
  // Sin Segoe UI: en Windows a 13–14 px se ve fina y borrosa; Arial queda nítida.
  "-apple-system,BlinkMacSystemFont,'Helvetica Neue',Helvetica,Arial,sans-serif";
export const EMAIL_MONO =
  "ui-monospace,SFMono-Regular,Menlo,Consolas,'Liberation Mono',monospace";

/**
 * Shell para avisos internos a gerencia: papel claro, logo pequeño y una
 * etiqueta de estado. Sin firma ni pie legal; solo los datos para decidir.
 */
export function wrapInternalEmail(input: {
  label: string;
  preview: string;
  bodyHtml: string;
  footerNote: string;
}): string {
  const label = escapeHtml(input.label);
  const preview = escapeHtml(input.preview);
  const brand = escapeHtml(siteConfig.name);
  const logoUrl = `${serverEnv.appUrl.replace(/\/$/, "")}${siteConfig.logoSrc}`;

  return `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="color-scheme" content="light" /><meta name="supported-color-schemes" content="light" />
  <title>${preview}</title>
  <style>
    @media (max-width:560px) {
      .hi-pad { padding-left:22px !important; padding-right:22px !important; }
      .hi-col { display:block !important; width:100% !important; padding:0 !important; }
      .hi-voucher { padding-top:28px !important; }
      .hi-voucher img { width:100% !important; max-width:260px !important; }
      .hi-head-logo { display:block !important; }
      .hi-head { display:block !important; text-align:left !important; padding-top:16px !important; }
      .hi-amount { font-size:34px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#f2f0eb;font-family:${EMAIL_SANS};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all;">${preview}&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f2f0eb;">
    <tr>
      <td align="center" style="padding:28px 12px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#fcfbf9;border-radius:6px;">
          <tr>
            <td class="hi-pad" style="padding:36px 40px 0;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td class="hi-head-logo" style="vertical-align:middle;">
                    <img src="${logoUrl}" alt="${brand}" width="104" style="display:block;width:104px;max-width:104px;height:auto;border:0;" />
                  </td>
                  <td class="hi-head" align="right" style="vertical-align:middle;font-size:12px;letter-spacing:0.14em;text-transform:uppercase;color:#57524b;">
                    ${label}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td class="hi-pad" style="padding:36px 40px 0;">
              ${input.bodyHtml}
            </td>
          </tr>
          <tr>
            <td class="hi-pad" style="padding:28px 40px 36px;font-size:13px;line-height:1.5;color:#6b665f;">
              ${escapeHtml(input.footerNote)}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export { escapeHtml };
