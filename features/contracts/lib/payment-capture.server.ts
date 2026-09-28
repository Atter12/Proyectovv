import "server-only";
import { serverEnv } from "@/lib/env/env.server";

export interface NasCaptureReading {
  paid: boolean | null;
  looksLikeNas: boolean | null;
  edited: boolean | null;
  confidence: number | null;
  reference: string | null;
}

export async function readNasMembershipCapture(
  bytes: Uint8Array,
  mimeType: string,
): Promise<NasCaptureReading> {
  const apiKey = serverEnv.openAiApiKey?.trim();
  if (!apiKey) {
    return { paid: null, looksLikeNas: null, edited: null, confidence: null, reference: null };
  }

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
            {
              type: "text",
              text: `Mira esta captura de un pago de membresía NAS (comunidad HOLISTIS / Holistic).
Responde solo JSON:
{
  "paid": boolean,
  "looks_like_nas": boolean,
  "edited": boolean,
  "confidence": number entre 0 y 1,
  "reference": string o null,
  "notes": string corto
}
paid es true solo si se ve un cobro terminado (éxito, recibo o membresía activa), no un formulario todavía por pagar.
looks_like_nas es true si se reconoce NAS, HOLISTIS o la membresía de Holistic.
edited es true si la imagen parece armada, recortada para ocultar el estado, o reescrita.`,
            },
            {
              type: "image_url",
              image_url: { url: `data:${mimeType};base64,${Buffer.from(bytes).toString("base64")}` },
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    return { paid: null, looksLikeNas: null, edited: null, confidence: null, reference: null };
  }
  const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    return { paid: null, looksLikeNas: null, edited: null, confidence: null, reference: null };
  }
  const parsed = JSON.parse(content) as {
    paid?: boolean;
    looks_like_nas?: boolean;
    edited?: boolean;
    confidence?: number;
    reference?: string | null;
  };
  const reference = typeof parsed.reference === "string" ? parsed.reference.replace(/\s+/g, "").slice(0, 80) : null;
  return {
    paid: typeof parsed.paid === "boolean" ? parsed.paid : null,
    looksLikeNas: typeof parsed.looks_like_nas === "boolean" ? parsed.looks_like_nas : null,
    edited: typeof parsed.edited === "boolean" ? parsed.edited : null,
    confidence: typeof parsed.confidence === "number" ? Math.min(1, Math.max(0, parsed.confidence)) : null,
    reference: reference && reference.length >= 4 ? reference : null,
  };
}
