import type { PaymentGatewayId } from "@/types/payment";

export interface CreateCheckoutInput {
  amountCents: number;
  currency: string;
  organizationId: string;
  walletId: string;
  paymentIntentId: string;
  idempotencyKey: string;
  customerEmail?: string;
  /** DNI/RUC — requerido por Yape (services). */
  customerDocumentNumber?: string;
  customerDocumentType?: "DNI" | "RUC";
  customerName?: string;
  customerLastname?: string;
  customerPhone?: string;
  /** Concepto visible al deudor. */
  concept?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateCheckoutResult {
  providerReference: string | null;
  checkoutUrl: string | null;
  status: "created" | "requires_payment" | "processing";
  message?: string;
  /** Extra metadata to merge into payment_intents (ej. cobrana code/deeplinks). */
  resultMetadata?: Record<string, unknown>;
}

export interface VerifyWebhookInput {
  rawBody: string;
  signature: string | null;
  headers: Headers;
}

export interface VerifiedWebhookEvent {
  eventId: string;
  eventType: string;
  providerReference: string | null;
  paymentIntentId?: string;
  amountCents?: number;
  currency?: string;
  succeeded: boolean;
  failed: boolean;
  cancelled: boolean;
}

export interface PaymentProviderAdapter {
  id: PaymentGatewayId;
  isConfigured(): boolean;
  createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult>;
  verifyWebhook?(input: VerifyWebhookInput): Promise<VerifiedWebhookEvent | null>;
}

export class ProviderNotConfiguredError extends Error {
  constructor(provider: PaymentGatewayId) {
    super(`La pasarela "${provider}" aún no está configurada.`);
    this.name = "ProviderNotConfiguredError";
  }
}
