import "server-only";
import { serverEnv } from "@/lib/env/env.server";

/**
 * Llamada a OpenAI que devuelve JSON (response_format json_object), con el
 * mismo modelo y clave que el resto de Ads Holistic (o el modelo que se pida).
 */
export async function callOpenAiJson(input: {
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
  /** Modelo distinto al de siempre (p. ej. la receta usa uno más fuerte). */
  model?: string;
}): Promise<{ json: Record<string, unknown>; model: string }> {
  const apiKey = serverEnv.openAiApiKey?.trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY no configurada.");
  const model = input.model?.trim() || serverEnv.openAiVisionModel;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      temperature: input.temperature ?? 0.2,
      max_tokens: input.maxTokens ?? 1200,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: input.system },
        { role: "user", content: input.user },
      ],
    }),
    signal: AbortSignal.timeout(input.timeoutMs ?? 45_000),
  });

  const data = (await response.json().catch(() => ({}))) as {
    error?: { message?: string };
    choices?: Array<{ message?: { content?: string } }>;
  };
  if (!response.ok) throw new Error(data.error?.message || `OpenAI ${response.status}`);

  const content = String(data.choices?.[0]?.message?.content ?? "").trim();
  try {
    const parsed = JSON.parse(content) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("no es objeto");
    return { json: parsed as Record<string, unknown>, model };
  } catch {
    throw new Error("OpenAI no devolvió un JSON válido.");
  }
}
