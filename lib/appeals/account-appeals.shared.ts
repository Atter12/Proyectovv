/** Tipos y reglas de apelaciones compartidos entre cliente y servidor (sin I/O). */

export type AppealStatus = "pending" | "sent" | "approved" | "rejected";

export const APPEAL_MAX_FILES = 6;
export const APPEAL_MAX_FILE_BYTES = 8 * 1024 * 1024;
export const APPEAL_MIME_TYPES = ["image/png", "image/jpeg", "image/webp", "application/pdf"];

export type AppealAttachment = {
  path: string;
  name: string;
  mimeType: string;
  size: number;
};

export type AppealRecord = {
  id: string;
  hecomClienteId: string;
  hecomClienteName: string | null;
  adAccountId: string | null;
  advertiserId: string;
  advertiserName: string | null;
  bmLabel: string | null;
  suspensionReason: string | null;
  suspensionUntil: string | null;
  companyName: string;
  taxId: string | null;
  storeUrl: string | null;
  products: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  clientNotes: string | null;
  appealMessage: string;
  attachments: AppealAttachment[];
  status: AppealStatus;
  staffNotes: string | null;
  createdAt: string;
  sentAt: string | null;
  resolvedAt: string | null;
};

export type AppealDraftInput = {
  advertiserId: string;
  accountName: string;
  companyName: string;
  taxId?: string;
  storeUrl?: string;
  products?: string;
  notes?: string;
  suspensionReason?: string | null;
  attachmentNames: string[];
};

/** Abierta = el cliente no puede mandar otra para esa cuenta. */
export function appealIsOpen(status: AppealStatus | null | undefined): boolean {
  return status === "pending" || status === "sent";
}

/** Plantilla cuando no hay IA: mismos datos, mismo tono. */
export function fallbackAppealMessage(input: AppealDraftInput): string {
  const sells = input.products?.trim()
    ? `The client sells ${input.products.trim()}`
    : "The client sells real products";
  const store = input.storeUrl?.trim() ? ` through ${input.storeUrl.trim()}` : "";
  const tax = input.taxId?.trim() ? ` (tax ID ${input.taxId.trim()})` : "";
  const docs = input.attachmentNames.length
    ? input.attachmentNames.join(", ")
    : "company registration, store URL and sample orders";
  return [
    `Hello TikTok team,`,
    ``,
    `We are Holistic Marketing, an advertising agency, and this ad account (ID ${input.advertiserId}, "${input.accountName}") belongs to our client ${input.companyName.trim()}${tax}, a registered company in Peru. We believe the suspension was a mistake.`,
    ``,
    `${sells}${store}, with real deliveries to customers and clear contact and return information. We have reviewed the account's ads and found no prohibited content. If any specific ad broke a policy, we will remove it and review every creative before relaunching.`,
    ``,
    `We kindly ask you to review the suspension and reinstate the account. Attached: ${docs}.`,
    ``,
    `Thank you,`,
    `Holistic Marketing team`,
  ].join("\n");
}
