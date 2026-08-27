import "server-only";
import { createHash } from "node:crypto";
import { serverEnv } from "@/lib/env/env.server";
import type { ManualChargeCurrency } from "@/lib/payments/manual-deposit.server";

export type VoucherAnalysisResult = {
  confirmed: boolean;
  needsReview: boolean;
  confidence: number;
  detectedAmount: number | null;
  detectedCurrency: ManualChargeCurrency | null;
  operationCode: string | null;
  paymentDate: string | null;
  beneficiaryMatch: boolean | null;
  reason: string;
  analysisMode: "openai_vision" | "trust_upload" | "pending_no_ai";
};

export function hashVoucherBuffer(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

function amountsMatch(
  expectedCents: number,
  detectedAmount: number,
  currency: ManualChargeCurrency,
): boolean {
  const detectedCents = Math.round(detectedAmount * 100);
  const toleranceCents = currency === "PEN" ? 100 : 50; // S/ 1 o $0.50
  return Math.abs(detectedCents - expectedCents) <= toleranceCents;
}

async function analyzeWithOpenAi(input: {
  buffer: Buffer;
  mimeType: string;
  expectedAmount: number;
  expectedCurrency: ManualChargeCurrency;
  holderNames: string[];
}): Promise<VoucherAnalysisResult | null> {
  const apiKey = serverEnv.openAiApiKey?.trim();
  if (!apiKey) return null;

  const base64 = input.buffer.toString("base64");
  const dataUrl = `data:${input.mimeType};base64,${base64}`;

  const prompt = `Analizá este comprobante de pago (transferencia/Yape/Plin/banco Perú).
Devolvé SOLO JSON válido con estas claves:
{
  "amount": number o null,
  "currency": "PEN" | "USD" | null,
  "operation_code": string o null,
  "payment_date": "YYYY-MM-DD" o null,
  "beneficiary_matches": boolean,
  "confidence": number entre 0 y 1,
  "notes": string corto en español
}
Monto esperado del cliente: ${input.expectedAmount} ${input.expectedCurrency}.
Beneficiarios válidos (parcial): ${input.holderNames.join(", ")}.`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: serverEnv.openAiVisionModel,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
      }),
    });

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message?: string };
    };

    if (!response.ok) {
      console.error("[voucher-analysis] openai error", data.error?.message);
      return null;
    }

    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content) as {
      amount?: number | null;
      currency?: string | null;
      operation_code?: string | null;
      payment_date?: string | null;
      beneficiary_matches?: boolean;
      confidence?: number;
      notes?: string;
    };

    const detectedCurrency =
      parsed.currency === "USD" || parsed.currency === "PEN"
        ? parsed.currency
        : input.expectedCurrency;
    const detectedAmount =
      typeof parsed.amount === "number" && Number.isFinite(parsed.amount)
        ? parsed.amount
        : null;
    const confidence =
      typeof parsed.confidence === "number"
        ? Math.min(1, Math.max(0, parsed.confidence))
        : 0;

    const expectedCents = Math.round(input.expectedAmount * 100);
    const amountOk =
      detectedAmount != null &&
      amountsMatch(expectedCents, detectedAmount, detectedCurrency);

    const beneficiaryOk = parsed.beneficiary_matches !== false;
    const confirmed =
      confidence >= 0.82 && amountOk && beneficiaryOk && detectedAmount != null;

    return {
      confirmed,
      needsReview: !confirmed,
      confidence,
      detectedAmount,
      detectedCurrency,
      operationCode: parsed.operation_code ?? null,
      paymentDate: parsed.payment_date ?? null,
      beneficiaryMatch: parsed.beneficiary_matches ?? null,
      reason: confirmed
        ? "Comprobante verificado automáticamente."
        : (parsed.notes ??
          "No pudimos confirmar el monto o beneficiario con certeza."),
      analysisMode: "openai_vision",
    };
  } catch (error) {
    console.error("[voucher-analysis] openai failed", error);
    return null;
  }
}

export async function analyzePaymentVoucher(input: {
  buffer: Buffer;
  mimeType: string;
  expectedAmount: number;
  expectedCurrency: ManualChargeCurrency;
  holderNames?: string[];
}): Promise<VoucherAnalysisResult> {
  const holders =
    input.holderNames?.length ?
      input.holderNames
    : ["Holistic", "HOLISTIC MARKETING"];

  const fromAi = await analyzeWithOpenAi({
    buffer: input.buffer,
    mimeType: input.mimeType,
    expectedAmount: input.expectedAmount,
    expectedCurrency: input.expectedCurrency,
    holderNames: holders,
  });

  if (fromAi) return fromAi;

  if (serverEnv.manualVoucherTrustUpload) {
    return {
      confirmed: true,
      needsReview: false,
      confidence: 0.5,
      detectedAmount: input.expectedAmount,
      detectedCurrency: input.expectedCurrency,
      operationCode: null,
      paymentDate: null,
      beneficiaryMatch: null,
      reason:
        "Comprobante recibido. Acreditación automática (modo confianza — activar IA en producción).",
      analysisMode: "trust_upload",
    };
  }

  return {
    confirmed: false,
    needsReview: true,
    confidence: 0,
    detectedAmount: null,
    detectedCurrency: null,
    operationCode: null,
    paymentDate: null,
    beneficiaryMatch: null,
    reason:
      "Comprobante recibido. Un agente lo revisará en breve (IA no configurada).",
    analysisMode: "pending_no_ai",
  };
}
