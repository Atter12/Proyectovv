export type EmailProviderId = "console" | "resend";

export interface SendEmailInput {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  templateKey: string;
  organizationId?: string | null;
  userId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface SendEmailResult {
  provider: EmailProviderId;
  providerMessageId: string | null;
  skipped: boolean;
}
