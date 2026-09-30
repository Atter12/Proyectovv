import "server-only";
import { serverEnv } from "@/lib/env/env.server";
import { todayYmdInTz } from "@/lib/hecom/gasto-date";
import type { AssistantResponse } from "@/lib/ops/assistant-response";
import { ASSISTANT_TOOLS, TOOL_LABELS, runAssistantTool } from "@/lib/ops/assistant-tools.server";

/**
 * Asistente de gerencia con IA: entiende la pregunta, consulta datos reales con
 * herramientas de solo lectura y responde en español simple. Nunca inventa:
 * si un dato no está en las herramientas, lo dice.
 */

const MAX_ROUNDS = 6;
const TIMEOUT_MS = 45_000;

export type AssistantTurn = { q: string; a: string };

type ChatMessage =
  | { role: "system" | "user" | "assistant"; content: string }
  | { role: "assistant"; content: string | null; tool_calls: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };

function systemPrompt(): string {
  const now = new Intl.DateTimeFormat("es-PE", {
    timeZone: "America/Lima",
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
  return `Eres el asistente de gerencia de Ads Holistic (agencia de TikTok Ads de Holistic Marketing, Perú). Respondes preguntas sobre los clientes a gerentes y soporte.

Hoy es ${now} (hora Lima). Fecha ISO de hoy: ${todayYmdInTz("America/Lima")}.

CÓMO TRABAJAS
- Siempre consulta las herramientas antes de responder datos. Nunca inventes montos, fechas, nombres ni estados.
- Si te nombran a un cliente, usa buscar_clientes y después estado_cliente. Si hay varias coincidencias posibles, pregunta cuál (muestra los nombres).
- "Hoy", "ayer", "esta semana", "este mes" se calculan en hora Lima. Para pagos de un rango usa la herramienta pagos con desde/hasta.
- "¿Qué están haciendo los clientes?", "¿qué movimientos hubo?" → actividad_reciente.
- "¿Dónde recargó?" = por qué medio pagó (Stripe, Yape/Cobrana, transferencia y banco) y a qué cuenta TikTok pasó el saldo (campo luego_lo_asigno_a o movimientos). Usa estado_cliente.
- "¿Ya pagó?" → responde primero Sí o No, con fecha y hora, monto y medio del último pago. Un pago "pendiente" o "en revisión" NO está pagado: dilo así.
- "¿Usa la plataforma?" → usa el campo uso_de_la_plataforma: si casi no entra o nunca pagó por la plataforma, dilo tal cual (no respondas solo "sí").
- Recargas de gerente: di a qué cliente y cuenta, el monto, la fecha y quién la hizo.

CONCEPTOS
- Prepago en Ads Holistic: el cliente recarga primero y solo gasta lo que pagó. Paga después: tiene acuerdo con gerencia, que tenga deuda es normal.
- Cliente de agencia en Hecom: no usa Ads Holistic, se le cobra por Hecom; su deuda no es un error de la plataforma. Si preguntan por deudas de Ads Holistic, usa deudas_del_mes con solo_ads_holistic=true.
- Gastado con fee = gasto de anuncios en TikTok + comisión. Deuda del mes = gastado con fee − cobrado del mes.
- Recarga por la plataforma = pago del cliente en Ads Holistic que entra a su cartera. Cobro en Hecom = el mismo pago registrado en el CRM (a veces también pagos por banco). No sumes las dos listas.
- Recarga de gerente desde el BM = saldo que puso un gerente sin que el cliente pagara.

CÓMO RESPONDES
- Español de Perú, claro y corto, como para alguien sin conocimientos técnicos. Primero la respuesta directa en una frase; después el detalle.
- Montos en USD con 2 decimales (ej. USD 110.00). Si el pago fue en soles, menciona ambos.
- Fechas como 30/09 14:25. Para listas usa una línea por ítem que empiece con "• " (sin sub-listas); máximo 15 ítems y, si hay más, termina con "…y N más".
- Si das un total y una lista, el total debe coincidir con lo que dice la herramienta; si la lista está recortada, dilo.
- Texto plano: sin asteriscos, sin negritas, sin títulos con #, sin tablas, sin IDs internos ni JSON.
- Si un dato no existe o está vacío, dilo claramente (ej. "No tiene pagos registrados en la plataforma").
- No puedes hacer cambios (pagos, saldos, bloqueos): solo consultas. Si te lo piden, explica que eso lo hace un gerente.`;
}

async function callOpenAi(messages: ChatMessage[], signal: AbortSignal) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serverEnv.openAiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_ASSISTANT_MODEL?.trim() || serverEnv.openAiVisionModel,
      temperature: 0.2,
      messages,
      tools: ASSISTANT_TOOLS,
      tool_choice: "auto",
    }),
    signal,
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`OpenAI ${response.status}: ${text.slice(0, 200)}`);
  }
  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null; tool_calls?: ToolCall[] } }>;
  };
  return json.choices?.[0]?.message ?? {};
}

export function isAssistantLlmEnabled(): boolean {
  return Boolean(serverEnv.openAiApiKey.trim()) && process.env.OPS_ASSISTANT_LLM !== "off";
}

/** Deja el texto plano aunque el modelo use markdown (negritas, títulos, guiones). */
export function plainAssistantText(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^[ \t]*[-*]\s+/gm, "• ")
    .replace(/^[ \t]+•\s+/gm, "   – ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function answerWithLlm(question: string, history: AssistantTurn[] = []): Promise<AssistantResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const used = new Set<string>();
  try {
    const messages: ChatMessage[] = [{ role: "system", content: systemPrompt() }];
    for (const turn of history.slice(-4)) {
      messages.push({ role: "user", content: turn.q.slice(0, 500) });
      messages.push({ role: "assistant", content: turn.a.slice(0, 1500) });
    }
    messages.push({ role: "user", content: question });

    for (let round = 0; round < MAX_ROUNDS; round++) {
      const msg = await callOpenAi(messages, controller.signal);
      const calls = msg.tool_calls ?? [];
      if (!calls.length) {
        const reply = plainAssistantText(String(msg.content ?? "")) || "No encontré una respuesta. ¿Puedes reformular la pregunta?";
        return {
          reply,
          today: todayYmdInTz("America/Lima"),
          blocks: [
            {
              id: "answer",
              title: "Respuesta",
              text: reply,
              sources: [...used].map((name) => ({
                label: TOOL_LABELS[name] ?? name,
                detail: "Datos consultados en vivo al momento de la pregunta.",
              })),
            },
          ],
        };
      }
      messages.push({ role: "assistant", content: msg.content ?? null, tool_calls: calls });
      const results = await Promise.all(
        calls.map(async (call) => {
          used.add(call.function.name);
          let args: Record<string, unknown> = {};
          try {
            args = JSON.parse(call.function.arguments || "{}");
          } catch {
            args = {};
          }
          const result = await runAssistantTool(call.function.name, args).catch((error) => ({
            error: error instanceof Error ? error.message : "No se pudo consultar.",
          }));
          return { id: call.id, content: JSON.stringify(result).slice(0, 24_000) };
        }),
      );
      for (const r of results) messages.push({ role: "tool", tool_call_id: r.id, content: r.content });
    }
    throw new Error("El asistente hizo demasiadas consultas.");
  } finally {
    clearTimeout(timer);
  }
}
