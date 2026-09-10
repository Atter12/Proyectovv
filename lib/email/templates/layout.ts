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

export { escapeHtml };
