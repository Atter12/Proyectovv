import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env/env.server";
import { classifyTikTokRejectReasons } from "@/lib/creatives/tiktok-reject-action";
import type { CreativeDraftListItem } from "@/lib/creatives/types";
import {
  REJECT_REC_PREFIX,
  parseRejectRecommendation,
} from "@/lib/creatives/reject-recommendation";

export { parseRejectRecommendation, REJECT_REC_PREFIX };

const HINT_MAX = 160;

const HARD_STOP =
  /\b(arma de fuego|firearms?|explosiv|bomba|coca[ií]na|hero[ií]na|fentanilo|metanfetamina|pornograf[ií]a infantil|contenido sexual de menores|child sexual)\b/i;

function clip(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= HINT_MAX) return clean;
  return `${clean.slice(0, HINT_MAX - 1).trim()}…`;
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

function fallbackRecommendation(input: {
  kind: ReturnType<typeof classifyTikTokRejectReasons>;
  adName: string;
  accountName: string | null;
}): string {
  const label = shortCreativeLabel(input.adName);
  if (input.kind === "media_invalid") {
    return label
      ? `Exportá ${label} de nuevo (archivo fresco) y subilo acá. El mismo archivo no pasa.`
      : `Exportá el video de nuevo (archivo fresco) y subilo acá. El mismo archivo no pasa.`;
  }
  if (input.kind === "landing") {
    return `Dejá el video. Revisá la página: mismo producto, mismo precio y política de privacidad.`;
  }
  if (input.kind === "claims") {
    return label
      ? `Probá un texto corto sin cura ni garantía, tipo: “Conocé ${label}. Pedí el tuyo hoy.”`
      : `Cambiá el texto: sin cura, sin garantía ni antes/después. Después subí la corrección.`;
  }
  if (input.kind === "policy") {
    return `Suavizá el inicio del video y el texto. Evitá la frase que TikTok marcó y subí la corrección.`;
  }
  return label
    ? `Subí una versión nueva de ${label} y cambiá el texto del anuncio antes de reenviar.`
    : `Subí una versión nueva del video y cambiá el texto del anuncio antes de reenviar.`;
}

export async function suggestRejectFixHint(input: {
  adName: string;
  reasons: string[];
  accountName?: string | null;
  adText?: string | null;
  draftId?: string;
}): Promise<string | null> {
  const kind = classifyTikTokRejectReasons(input.reasons);
  const blob = [input.adName, ...input.reasons].join(" \n ");
  if (HARD_STOP.test(blob)) {
    return "Este caso no se corrige desde Creativos. Habla con tu gestor.";
  }

  if (kind === "media_invalid" || kind === "landing") {
    return fallbackRecommendation({
      kind,
      adName: input.adName,
      accountName: input.accountName ?? null,
    });
  }

  const apiKey = serverEnv.openAiApiKey?.trim();
  if (!apiKey) {
    return fallbackRecommendation({
      kind,
      adName: input.adName,
      accountName: input.accountName ?? null,
    });
  }

  const seed = (input.draftId ?? input.adName).slice(-6);
  const prompt = `Sos copywriter de TikTok Ads para ecom Latam. Ayudás a pasar review.
NO inventes categoría de producto (nada de suplementos, bienestar, etc.) si no aparece en los datos.
Usá el nombre de la cuenta o del video. Cada respuesta debe ser distinta (variante ${seed}).

Cuenta: ${input.accountName?.trim() || "sin cuenta"}
Video: ${input.adName || "sin nombre"}
Texto actual: ${input.adText?.trim() || "no hay"}
Motivo TikTok: ${input.reasons.filter(Boolean).join(" | ") || "sin detalle"}

Devuelve SOLO JSON:
{ "fix": "máximo 100 caracteres en español. Si el rechazo es claim/policy: un ad text listo para pegar, sin promesas de cura/garantía/antes-después. Si no sabés el producto, usá el nombre de la cuenta. Nunca digas 'suplementos naturales' ni 'bienestar' genérico." }`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: serverEnv.openAiVisionModel,
        temperature: 0.7,
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
        accountName: input.accountName ?? null,
      });
    }
    const raw = data.choices?.[0]?.message?.content ?? "";
    const parsed = JSON.parse(raw) as { fix?: unknown };
    const fix = typeof parsed.fix === "string" ? clip(parsed.fix) : "";
    if (fix.length < 8) {
      return fallbackRecommendation({
        kind,
        adName: input.adName,
        accountName: input.accountName ?? null,
      });
    }
    if (
      /suplementos?\s+naturales|bienestar\s+diario|mejorar\s+tu\s+bienestar/i.test(
        fix,
      ) &&
      !/suplement|bienestar/i.test(
        [input.adName, input.accountName, input.adText].join(" "),
      )
    ) {
      return fallbackRecommendation({
        kind,
        adName: input.adName,
        accountName: input.accountName ?? null,
      });
    }
    return fix;
  } catch (error) {
    console.warn(
      "[reject-fix-hint] failed",
      error instanceof Error ? error.message : "unknown",
    );
    return fallbackRecommendation({
      kind,
      adName: input.adName,
      accountName: input.accountName ?? null,
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
      typeof parsed.warning === "string" ? clip(parsed.warning) : "";
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
    // Hints viejos que metían el nombre de la cuenta (ej. "Jesus … USD - Agencia").
    const body = raw.slice(REJECT_REC_PREFIX.length);
    if (/\d+\.\d+\s*USD|Agencia|Exportá\s+Jesus/i.test(body)) return true;
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
      });
      if (!fix) return false;
      const stored = `${REJECT_REC_PREFIX}${fix}`;
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
