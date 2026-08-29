import "server-only";
import { serverEnv } from "@/lib/env/env.server";
import type { CreativeAnalysisInsight } from "@/lib/creatives/types";

const PROMPT_VERSION = "creative-analyze-v1";

function clampScore(n: unknown, fallback = 50): number {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(100, Math.max(0, Math.round(v)));
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item ?? "").trim())
    .filter(Boolean)
    .slice(0, 8);
}

export function creativeAnalyzePromptVersion(): string {
  return PROMPT_VERSION;
}

export async function analyzeCreativeWithOpenAi(input: {
  buffer: Buffer;
  mimeType: string;
  assetName: string;
  assetType: string;
}): Promise<CreativeAnalysisInsight | null> {
  const apiKey = serverEnv.openAiApiKey?.trim();
  if (!apiKey) return null;

  const isImage = input.mimeType.startsWith("image/");
  const base64 = input.buffer.toString("base64");
  const dataUrl = `data:${input.mimeType};base64,${base64}`;

  const prompt = `Sos un analista senior de creativos TikTok Ads (Latam ecom).
Evaluá este creativo "${input.assetName}" (tipo ${input.assetType}).
Devolvé SOLO JSON válido:
{
  "overall_score": number 0-100,
  "clarity_score": number 0-100,
  "brand_score": number 0-100,
  "compliance_score": number 0-100,
  "summary": "string corto en español",
  "hooks": ["ganchos visuales/verbales"],
  "policy_risks": ["riesgos de policy TikTok"],
  "why_it_may_perform": "por qué puede rendir",
  "recommendations": ["mejoras accionables"]
}
Sé concreto y comercial. Si es PDF/video sin frames, inferí por nombre y contexto.`;

  const content: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } }
  > = [{ type: "text", text: prompt }];

  if (isImage) {
    content.push({ type: "image_url", image_url: { url: dataUrl } });
  } else {
    content[0] = {
      type: "text",
      text: `${prompt}\n\nNota: el archivo es ${input.mimeType} (${Math.round(input.buffer.length / 1024)} KB). Analizá por nombre/tipo; no hay frame embebido.`,
    };
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: serverEnv.openAiVisionModel,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [{ role: "user", content }],
      }),
    });

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message?: string };
    };

    if (!response.ok) {
      console.error("[creative-analyze] openai error", data.error?.message);
      return null;
    }

    const raw = data.choices?.[0]?.message?.content;
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    return {
      overallScore: clampScore(parsed.overall_score),
      clarityScore: clampScore(parsed.clarity_score),
      brandScore: clampScore(parsed.brand_score),
      complianceScore: clampScore(parsed.compliance_score, 70),
      summary: String(parsed.summary ?? "Sin resumen.").trim().slice(0, 600),
      hooks: asStringArray(parsed.hooks),
      policyRisks: asStringArray(parsed.policy_risks),
      whyItMayPerform: String(parsed.why_it_may_perform ?? "")
        .trim()
        .slice(0, 600),
      recommendations: asStringArray(parsed.recommendations),
    };
  } catch (error) {
    console.error("[creative-analyze] failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return null;
  }
}

export async function buildAgentBriefWithOpenAi(input: {
  assetName: string;
  insight: CreativeAnalysisInsight;
  advertiserName?: string | null;
  spendHintUsd?: number | null;
}): Promise<import("@/lib/creatives/types").CreativeAgentBrief | null> {
  const apiKey = serverEnv.openAiApiKey?.trim();
  if (!apiKey) {
    return {
      objective: "TRAFFIC",
      audience: "Broad interest · lookalike compradores",
      hookCopy: input.insight.hooks[0] ?? "Hook en los primeros 2s",
      adText: input.insight.summary.slice(0, 100),
      callToAction: "SHOP_NOW",
      campaignName: `Holistic · ${input.assetName}`.slice(0, 80),
      adgroupName: "AG · Conversion test",
      adName: `Ad · ${input.assetName}`.slice(0, 80),
      suggestedDailyBudgetUsd: 20,
      landingPageUrl: null,
      notes: [
        "Brief fallback (sin OpenAI).",
        input.insight.whyItMayPerform || input.insight.summary,
      ],
    };
  }

  const prompt = `Armá un brief de campaña TikTok Ads (Agent Pro) en español comercial.
Creativo: ${input.assetName}
Cuenta: ${input.advertiserName ?? "N/D"}
Spend reciente (USD, hint): ${input.spendHintUsd ?? "n/d"}
Insight IA: ${JSON.stringify(input.insight)}

Devolvé SOLO JSON:
{
  "objective": "TRAFFIC" | "CONVERSIONS" | "REACH" | "VIDEO_VIEWS",
  "audience": "string",
  "hook_copy": "string",
  "ad_text": "string max 100 chars",
  "call_to_action": "SHOP_NOW" | "LEARN_MORE" | "ORDER_NOW" | "CONTACT_US",
  "campaign_name": "string",
  "adgroup_name": "string",
  "ad_name": "string",
  "suggested_daily_budget_usd": number entre 10 y 200,
  "landing_page_url": string o null,
  "notes": ["string"]
}`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: serverEnv.openAiVisionModel,
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message?: string };
    };
    if (!response.ok) {
      console.error("[agent-brief] openai error", data.error?.message);
      return null;
    }
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const budget = Number(parsed.suggested_daily_budget_usd);
    return {
      objective: String(parsed.objective ?? "TRAFFIC"),
      audience: String(parsed.audience ?? "").slice(0, 200),
      hookCopy: String(parsed.hook_copy ?? "").slice(0, 160),
      adText: String(parsed.ad_text ?? "").slice(0, 100),
      callToAction: String(parsed.call_to_action ?? "SHOP_NOW"),
      campaignName: String(parsed.campaign_name ?? input.assetName).slice(0, 100),
      adgroupName: String(parsed.adgroup_name ?? "Ad group").slice(0, 100),
      adName: String(parsed.ad_name ?? input.assetName).slice(0, 100),
      suggestedDailyBudgetUsd:
        Number.isFinite(budget) && budget >= 10 && budget <= 200
          ? Math.round(budget)
          : 20,
      landingPageUrl:
        typeof parsed.landing_page_url === "string" &&
        parsed.landing_page_url.startsWith("http")
          ? parsed.landing_page_url
          : null,
      notes: asStringArray(parsed.notes),
    };
  } catch (error) {
    console.error("[agent-brief] failed", {
      error: error instanceof Error ? error.message : "unknown",
    });
    return null;
  }
}
