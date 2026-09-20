import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env/env.server";
import { classifyTikTokRejectReasons } from "@/lib/creatives/tiktok-reject-action";
import type { CreativeDraftListItem } from "@/lib/creatives/types";
import {
  REJECT_REC_PREFIX,
  encodeRejectRecommendation,
  isEchoTikTokHint,
  parseRejectRecommendation,
  type RejectRecommendation,
} from "@/lib/creatives/reject-recommendation";

export {
  parseRejectRecommendation,
  REJECT_REC_PREFIX,
  isEchoTikTokHint,
  encodeRejectRecommendation,
};

const PLAN_MAX = 180;
const AD_MAX = 100;
const APPEAL_MAX = 220;

const HARD_STOP =
  /\b(arma de fuego|firearms?|explosiv|bomba|coca[ií]na|hero[ií]na|fentanilo|metanfetamina|pornograf[ií]a infantil|contenido sexual de menores|child sexual)\b/i;

function clip(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trim()}…`;
}

function shortCreativeLabel(adName: string): string | null {
  const raw = adName.replace(/\s+/g, " ").trim();
  if (!raw) return null;
  const videoNum = raw.match(/VIDEO\s*(\d+)/i);
  if (videoNum) return `Video ${videoNum[1]}`;
  if (/USD\s*-?\s*Agencia/i.test(raw) || /\d+\.\d+\s*USD/i.test(raw)) {
    return null;
  }
  if (raw.length > 36) return `${raw.slice(0, 33).trim()}…`;
  return raw;
}

function looksSexualFlag(reasons: string[]): boolean {
  return /sexual|sugerente|adulto|adult content|nude|desnud/i.test(
    reasons.join(" "),
  );
}

function looksWeightBan(reasons: string[]): boolean {
  return /p[eé]rdida de peso|bajar de peso|weight|grasa|metabolismo|sector prohibido|suplement/i.test(
    reasons.join(" "),
  );
}

function fallbackRecommendation(input: {
  kind: ReturnType<typeof classifyTikTokRejectReasons>;
  adName: string;
  reasons: string[];
}): RejectRecommendation {
  const label = shortCreativeLabel(input.adName);
  const sexual = looksSexualFlag(input.reasons);
  const weight = looksWeightBan(input.reasons);

  if (sexual && !weight) {
    return {
      plan: "TikTok a veces marca gym/cuerpo como ‘sexual’ por error. Apelá con el texto de abajo; si no pasa, subí una toma más amplia sin zoom al cuerpo.",
      adText: null,
      appeal:
        "El creativo es de entrenamiento en gimnasio, sin contenido sexual ni lenguaje sugerente. Solicito revisión: el rechazo parece un falso positivo.",
    };
  }

  if (weight || input.kind === "claims") {
    return {
      plan: "Apelar casi no gana en pérdida de peso. Subí un video nuevo sin metabolismo/grasa/bajar de peso y usá el texto sugerido.",
      adText: label
        ? `Conocé ${label}. Envío rápido. Pedí el tuyo hoy.`
        : "Producto listo para vos. Envío rápido. Pedí el tuyo hoy.",
      appeal: null,
    };
  }

  if (input.kind === "media_invalid") {
    return {
      plan: label
        ? `Exportá ${label} de nuevo (archivo fresco) y subilo acá. El mismo archivo no pasa.`
        : "Exportá el video de nuevo (archivo fresco) y subilo acá. El mismo archivo no pasa.",
      adText: null,
      appeal: null,
    };
  }

  if (input.kind === "landing") {
    return {
      plan: "Dejá el video. Arreglá la página: mismo producto, mismo precio y política de privacidad visible.",
      adText: null,
      appeal: null,
    };
  }

  return {
    plan: "Cambiá el inicio del video y el texto según el motivo, y subí la corrección acá.",
    adText: null,
    appeal: null,
  };
}

export async function suggestRejectFixHint(input: {
  adName: string;
  reasons: string[];
  accountName?: string | null;
  adText?: string | null;
  draftId?: string;
  tiktokSuggestions?: string[] | null;
}): Promise<RejectRecommendation | null> {
  const kind = classifyTikTokRejectReasons(input.reasons);
  const blob = [input.adName, ...input.reasons].join(" \n ");
  if (HARD_STOP.test(blob)) {
    return {
      plan: "Este caso no se corrige desde Creativos. Habla con tu gestor.",
      adText: null,
      appeal: null,
    };
  }

  const apiKey = serverEnv.openAiApiKey?.trim();
  if (!apiKey || kind === "media_invalid" || kind === "landing") {
    return fallbackRecommendation({
      kind,
      adName: input.adName,
      reasons: input.reasons,
    });
  }

  const seed = (input.draftId ?? input.adName).slice(-6);
  const sexual = looksSexualFlag(input.reasons);
  const weight = looksWeightBan(input.reasons);

  const prompt = `Sos estratega de TikTok Ads (ecom Latam). NO copies el texto de Ads Manager.
Tu valor: decir qué hacer en la práctica + un ad text seguro + (si aplica) texto de apelación.

Reglas:
- NO inventes categoría (nada de “suplementos naturales / bienestar”) si no está en los datos.
- Si el motivo es pérdida de peso / sector prohibido: di claro que APELAR casi no sirve; priorizá video/texto nuevos SIN metabolismo, grasa, bajar de peso, antes/después.
- Si el motivo es “sexual/sugerente” pero el video puede ser gym/fitness sin sexo: tratá como posible FALSO POSITIVO. Dale plan + appeal listo. No digas que el video es pornográfico.
- Variante ${seed}: cada respuesta distinta.
- Español claro, cliente de a pie.

Cuenta: ${input.accountName?.trim() || "sin cuenta"}
Video: ${input.adName || "sin nombre"}
Texto actual: ${input.adText?.trim() || "no hay"}
Motivos TikTok: ${input.reasons.filter(Boolean).join(" | ") || "sin detalle"}
Tips TikTok (NO copies literal): ${(input.tiktokSuggestions ?? []).join(" | ") || "ninguno"}
Flags: sexual=${sexual} weightBan=${weight} kind=${kind}

Devuelve SOLO JSON:
{
  "plan": "máx 160 caracteres. Qué hacer HOY (subir otro / apelar / cambiar landing). Accionable, no legalese.",
  "adText": "máx 90 caracteres listos para pegar, o vacío si no aplica",
  "appeal": "máx 200 caracteres para el botón Apelar, o vacío si no conviene apelar"
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
        temperature: 0.65,
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = (await response.json()) as {
      error?: { message?: string };
      choices?: Array<{ message?: { content?: string } }>;
    };
    if (!response.ok) {
      console.warn(
        "[reject-fix-hint] openai",
        data.error?.message ?? response.status,
      );
      return fallbackRecommendation({
        kind,
        adName: input.adName,
        reasons: input.reasons,
      });
    }
    const raw = data.choices?.[0]?.message?.content ?? "";
    const parsed = JSON.parse(raw) as {
      plan?: unknown;
      adText?: unknown;
      appeal?: unknown;
    };
    const plan =
      typeof parsed.plan === "string" ? clip(parsed.plan, PLAN_MAX) : "";
    if (plan.length < 8) {
      return fallbackRecommendation({
        kind,
        adName: input.adName,
        reasons: input.reasons,
      });
    }
    if (
      /suplementos?\s+naturales|bienestar\s+diario|mejorar\s+tu\s+bienestar/i.test(
        plan,
      ) &&
      !/suplement|bienestar/i.test(
        [input.adName, input.accountName, input.adText].join(" "),
      )
    ) {
      return fallbackRecommendation({
        kind,
        adName: input.adName,
        reasons: input.reasons,
      });
    }
    const adText =
      typeof parsed.adText === "string" && parsed.adText.trim().length >= 8
        ? clip(parsed.adText, AD_MAX)
        : null;
    const appeal =
      typeof parsed.appeal === "string" && parsed.appeal.trim().length >= 8
        ? clip(parsed.appeal, APPEAL_MAX)
        : null;
    return { plan, adText, appeal };
  } catch (error) {
    console.warn(
      "[reject-fix-hint] failed",
      error instanceof Error ? error.message : "unknown",
    );
    return fallbackRecommendation({
      kind,
      adName: input.adName,
      reasons: input.reasons,
    });
  }
}

export async function sameRejectWarning(input: {
  parentReasons: string[];
  assetName: string;
  summary: string;
  policyRisks: string[];
}): Promise<string | null> {
  const apiKey = serverEnv.openAiApiKey?.trim();
  if (!apiKey) return null;
  const parent = input.parentReasons.filter(Boolean).join(" | ");
  if (!parent) return null;

  const prompt = `Compará un anuncio que TikTok ya rechazó con el video nuevo que el cliente quiere reenviar.
Motivo anterior: ${parent}
Video nuevo: ${input.assetName}
Resumen IA: ${input.summary}
Riesgos detectados: ${input.policyRisks.join(" | ") || "ninguno"}

Si el video nuevo sigue teniendo EL MISMO problema, devolvé:
{ "same": true, "warning": "una frase en español, máximo 140 caracteres" }
Si no, { "same": false, "warning": "" }.`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: serverEnv.openAiVisionModel,
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    if (!response.ok) return null;
    const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? "") as {
      same?: unknown;
      warning?: unknown;
    };
    if (parsed.same !== true) return null;
    const warning =
      typeof parsed.warning === "string"
        ? clip(parsed.warning, PLAN_MAX)
        : "";
    return warning.length >= 8 ? warning : null;
  } catch (error) {
    console.warn(
      "[reject-fix-hint] same-check",
      error instanceof Error ? error.message : "unknown",
    );
    return null;
  }
}

export async function fillMissingRejectFixHints(
  drafts: CreativeDraftListItem[],
): Promise<number> {
  const pending = drafts.filter((d) => {
    if (d.status !== "published" || d.tiktokReviewStatus !== "rejected") {
      return false;
    }
    const raw = String(d.rejectFixHint ?? "");
    if (!raw.startsWith(REJECT_REC_PREFIX)) return true;
    if (isEchoTikTokHint(raw, d.tiktokSuggestions)) return true;
    // Formato viejo plano (sin JSON) + motivos reales → regenerar con IA rica.
    const body = raw.slice(REJECT_REC_PREFIX.length).trim();
    if (!body.startsWith("{") && d.tiktokRejectReasons.length > 0) {
      if (
        /no dejó el motivo|Exportá Video|modifica el producto/i.test(body) ||
        looksSexualFlag(d.tiktokRejectReasons) ||
        looksWeightBan(d.tiktokRejectReasons)
      ) {
        return true;
      }
    }
    return false;
  });
  if (pending.length === 0) return 0;

  const admin = createAdminClient();
  const results = await Promise.all(
    pending.slice(0, 8).map(async (draft) => {
      const name =
        draft.brief.adName || draft.brief.campaignName || draft.assetName || "";
      const fix = await suggestRejectFixHint({
        adName: name,
        reasons: draft.tiktokRejectReasons,
        accountName: draft.accountName,
        adText: draft.brief.adText,
        draftId: draft.id,
        tiktokSuggestions: draft.tiktokSuggestions,
      });
      if (!fix) return false;
      const stored = encodeRejectRecommendation(fix);
      const { error } = await admin
        .from("creative_publish_drafts")
        .update({ reject_fix_hint: stored })
        .eq("id", draft.id);
      if (error) {
        console.warn("[reject-fix-hint] save", error.message);
        return false;
      }
      draft.rejectFixHint = stored;
      return true;
    }),
  );
  return results.filter(Boolean).length;
}
