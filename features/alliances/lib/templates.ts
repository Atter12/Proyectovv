/** Variables que una plantilla puede insertar y el generador rellena desde la ficha. */
export const TEMPLATE_FIELDS = [
  { key: "alianza", label: "Nombre de la alianza" },
  { key: "tipo", label: "Tipo de alianza" },
  { key: "responsable", label: "Responsable interno" },
  { key: "contacto", label: "Persona de contacto" },
  { key: "correo", label: "Correo" },
  { key: "telefono", label: "Teléfono" },
  { key: "comision", label: "Comisión o porcentaje" },
  { key: "inicio", label: "Fecha de inicio" },
  { key: "termino", label: "Fecha de término" },
  { key: "aporta_holistic", label: "Qué aporta Holistic" },
  { key: "aporta_contraparte", label: "Qué aporta la otra parte" },
  { key: "acuerdo", label: "Descripción del acuerdo" },
  { key: "ciudad", label: "Ciudad" },
  { key: "hoy", label: "Fecha del documento" },
] as const;

export type TemplateFieldKey = (typeof TEMPLATE_FIELDS)[number]["key"];

const TEMPLATE_CONTRACT_TYPES = ["commercial", "nda", "addendum", "renewal", "other"] as const;
export type TemplateContractType = (typeof TEMPLATE_CONTRACT_TYPES)[number];

export interface ContractTemplate {
  id: string;
  slug: string;
  name: string;
  contractType: TemplateContractType;
  description: string;
  body: string;
  active: boolean;
}

export interface TemplateDraft {
  name: string;
  contractType: TemplateContractType;
  description: string;
  body: string;
  active: boolean;
}

export interface AllianceTemplateSource {
  name: string;
  typeLabel: string;
  ownerName: string;
  contactName: string;
  email: string;
  phone: string;
  commissionTerms: string;
  startedOnLabel: string;
  endsOnLabel: string;
  ourContribution: string;
  theirContribution: string;
  summary: string;
  todayLabel: string;
}

const PLACEHOLDER = /\{\{\s*([a-z0-9_]+)\s*\}\}/gi;

export function templateFieldLabel(key: string): string {
  return TEMPLATE_FIELDS.find((field) => field.key === key)?.label ?? key.replace(/_/g, " ");
}

export function placeholdersIn(body: string): string[] {
  const found: string[] = [];
  for (const match of body.matchAll(PLACEHOLDER)) {
    const key = match[1]?.toLowerCase() ?? "";
    if (key && !found.includes(key)) found.push(key);
  }
  return found;
}

export function missingPlaceholders(body: string, values: Record<string, string>): string[] {
  return placeholdersIn(body).filter((key) => !values[key]?.trim());
}

export function renderTemplate(body: string, values: Record<string, string>): string {
  return body.replace(PLACEHOLDER, (_match, raw: string) => values[raw.toLowerCase()]?.trim() ?? "");
}

export function allianceTemplateValues(source: AllianceTemplateSource): Record<string, string> {
  return {
    alianza: source.name.trim(),
    tipo: source.typeLabel.trim(),
    responsable: source.ownerName.trim(),
    contacto: source.contactName.trim(),
    correo: source.email.trim(),
    telefono: source.phone.trim(),
    comision: source.commissionTerms.trim(),
    inicio: source.startedOnLabel.trim(),
    termino: source.endsOnLabel.trim(),
    aporta_holistic: source.ourContribution.trim(),
    aporta_contraparte: source.theirContribution.trim(),
    acuerdo: source.summary.trim(),
    ciudad: "Lima",
    hoy: source.todayLabel.trim(),
  };
}

export function parseTemplateDraft(input: TemplateDraft): { ok: true; value: TemplateDraft } | { ok: false; error: string } {
  const name = input.name.replace(/\s+/g, " ").trim().slice(0, 120);
  const description = input.description.replace(/\s+/g, " ").trim().slice(0, 240);
  const body = input.body.replace(/\r\n/g, "\n").trim().slice(0, 12000);
  if (name.length < 2) return { ok: false, error: "Escribe el nombre de la plantilla." };
  if (body.length < 20) return { ok: false, error: "La plantilla necesita el texto del contrato." };
  if (!placeholdersIn(body).length) {
    return { ok: false, error: "Incluye al menos una variable, por ejemplo {{alianza}}." };
  }
  if (!(TEMPLATE_CONTRACT_TYPES as readonly string[]).includes(input.contractType)) {
    return { ok: false, error: "El tipo de contrato no es válido." };
  }
  return {
    ok: true,
    value: {
      name,
      contractType: input.contractType,
      description,
      body,
      active: Boolean(input.active),
    },
  };
}

export function overlayTemplateValues(
  base: Record<string, string>,
  submitted: Record<string, string>,
  keys: string[],
): Record<string, string> {
  const next = { ...base };
  for (const key of keys) {
    const value = submitted[key];
    if (typeof value === "string") next[key] = value.replace(/\r\n/g, "\n").trim().slice(0, 4000);
  }
  return next;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function contractDocumentHtml(input: {
  title: string;
  parties: string;
  body: string;
}): string {
  const blocks = input.body
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      if (block.startsWith("# ")) {
        return `<h1>${escapeHtml(block.slice(2).trim())}</h1>`;
      }
      if (block.startsWith("## ")) {
        return `<h2>${escapeHtml(block.slice(3).trim())}</h2>`;
      }
      return `<p>${escapeHtml(block).replace(/\n/g, "<br />")}</p>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(input.title)}</title>
  <style>
    body { margin: 0; background: #f6f3ee; color: #1c1917; font: 16px/1.55 "Segoe UI", sans-serif; }
    main { max-width: 760px; margin: 32px auto; background: #fff; border: 1px solid #e7e0d6; padding: 48px 52px 64px; }
    header { display: flex; justify-content: space-between; gap: 24px; border-bottom: 2px solid #ff781f; padding-bottom: 16px; margin-bottom: 28px; }
    .brand { font-size: 13px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #e8451a; }
    .meta { text-align: right; font-size: 13px; color: #57534e; }
    h1 { font-size: 28px; line-height: 1.2; margin: 0 0 18px; }
    h2 { font-size: 16px; margin: 26px 0 8px; }
    p { margin: 0 0 12px; }
    footer { margin-top: 36px; font-size: 12px; color: #78716c; }
  </style>
</head>
<body>
  <main>
    <header>
      <div class="brand">Holistic Marketing</div>
      <div class="meta">${escapeHtml(input.parties)}</div>
    </header>
    ${blocks}
    <footer>Borrador generado desde una plantilla de Holistic. La firma electrónica se envía desde la ficha.</footer>
  </main>
</body>
</html>`;
}
