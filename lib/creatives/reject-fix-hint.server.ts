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

/** Nombre legible para copy — nunca "Video 3". */
function productLabelForCopy(input: {
  adName: string;
  accountName?: string | null;
  reasons?: string[];
}): string | null {
  const fromReasons = (input.reasons ?? []).join(" ");
  const brandInReason = fromReasons.match(
    /\b([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚáéíóúñ]{2,}(?:\s+[A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚáéíóúñ]{2,})?)\b/,
  );
  // MenLab / nombres de producto en el motivo
  const menlab = fromReasons.match(/\bMenLab\b/i);
  if (menlab) return "MenLab";

  const account = String(input.accountName ?? "")
    .replace(/\d+(\.\d+)?\s*USD.*$/i, "")
    .replace(/\s*-\s*Agencia\s*$/i, "")
    .replace(/_/g, " ")
    .trim();
  if (
    account &&
    account.length >= 3 &&
    account.length <= 28 &&
    !/^video\s*\d+/i.test(account)
  ) {
    return account.split(/\s+/).slice(0, 2).join(" ");
  }

  const raw = String(input.adName ?? "").replace(/\s+/g, " ").trim();
  if (/^VIDEO\s*\d+/i.test(raw) || !raw) return null;
  if (/USD\s*-?\s*Agencia/i.test(raw)) return null;
  if (raw.length > 28) return `${raw.slice(0, 25).trim()}…`;
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
  accountName?: string | null;
  reasons: string[];
}): RejectRecommendation {
  const label = productLabelForCopy({
    adName: input.adName,
    accountName: input.accountName,
    reasons: input.reasons,
  });
  const sexual = looksSexualFlag(input.reasons);
  const weight = looksWeightBan(input.reasons);

  if (weight || input.kind === "claims") {
    return {
      plan: "1) Subí un video nuevo sin metabolismo, grasa ni ‘bajar de peso’. 2) Pegá el texto sugerido. Apelar casi no gana en este caso.",
      adText: label
        ? `${label}: calidad y envío rápido. Pedí el tuyo hoy.`
        : "Calidad que se nota. Envío rápido. Pedí el tuyo hoy.",
      appeal: null,
    };
  }

  if (sexual) {
    return {
      plan: "1) Preferí subir una toma más amplia (menos zoom al cuerpo). 2) Si el video es solo gym sin sexo, recién ahí apelá.",
      adText: null,
      appeal:
        "El creativo es de entrenamiento en gimnasio, sin contenido sexual ni lenguaje sugerente. Solicito revisión: el rechazo parece un falso positivo.",
    };
  }

  if (input.kind === "media_invalid") {
    return {
      plan: "Subí el archivo de nuevo (export fresco). El mismo archivo no pasa. Después podés reenviar.",
      adText: null,
      appeal: null,
    };
  }

  if (input.kind === "landing") {
    return {
      plan: "Primero arreglá la página (producto, precio, privacidad). Otro video no lo soluciona.",
      adText: null,
      appeal: null,
    };
  }

  return {
    plan: "Primero subí un creativo corregido según el motivo. Apelar es el último paso si TikTok se equivocó.",
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
      accountName: input.accountName,
      reasons: input.reasons,
    });
  }

  const seed = (input.draftId ?? input.adName).slice(-6);
  const sexual = looksSexualFlag(input.reasons);
  const weight = looksWeightBan(input.reasons);
  const productHint =
    productLabelForCopy({
      adName: input.adName,
      accountName: input.accountName,
      reasons: input.reasons,
    }) || "el producto (sin inventar marca)";

  const prompt = `Sos estratega de TikTok Ads (ecom Latam). NO copies Ads Manager.
Orden de valor: 1) CORREGIR (subir otro video / texto) 2) apelar SOLO si es falso positivo.

Reglas:
- NUNCA uses "Video 1/2/3" como nombre de producto en adText.
- Producto sugerido a mencionar si hace falta: ${productHint}
- NO inventes “suplementos naturales / bienestar” genérico.
- Si pérdida de peso / sector prohibido: plan = corregir primero; appeal vacío. Ad text sin metabolismo/grasa/bajar de peso.
- Si marca “sexual” y puede ser gym: plan = corregir toma O apelar después; appeal listo para falso positivo.
- Variante ${seed}. Español claro.

Cuenta: ${input.accountName?.trim() || "sin cuenta"}
Video archivo: ${input.adName || "sin nombre"}
Texto actual: ${input.adText?.trim() || "no hay"}
Motivos TikTok: ${input.reasons.filter(Boolean).join(" | ") || "sin detalle"}
Flags: sexual=${sexual} weightBan=${weight} kind=${kind}

JSON SOLO:
{
  "plan": "máx 160 chars. Empezá por la corrección (subir otro). Apelar al final solo si aplica.",
  "adText": "máx 90 chars listos para pegar (sin Video N), o vacío",
  "appeal": "máx 200 chars solo si conviene apelar (falso positivo). Vacío en sector prohibido."
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
        accountName: input.accountName,
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
        accountName: input.accountName,
        reasons: input.reasons,
      });
    }
    if (
      /suplementos?\s+naturales|bienestar\s+diario|mejorar\s+tu\s+bienestar|Conocé Video\s*\d+/i.test(
        `${plan} ${String(parsed.adText ?? "")}`,
      ) &&
      !/suplement|bienestar/i.test(
        [input.adName, input.accountName, input.adText].join(" "),
      )
    ) {
      return fallbackRecommendation({
        kind,
        adName: input.adName,
        accountName: input.accountName,
        reasons: input.reasons,
      });
    }
    let adText =
      typeof parsed.adText === "string" && parsed.adText.trim().length >= 8
        ? clip(parsed.adText, AD_MAX)
        : null;
    if (adText && /Video\s*\d+/i.test(adText)) {
      adText = fallbackRecommendation({
        kind,
        adName: input.adName,
        accountName: input.accountName,
        reasons: input.reasons,
      }).adText;
    }
    let appeal =
      typeof parsed.appeal === "string" && parsed.appeal.trim().length >= 8
        ? clip(parsed.appeal, APPEAL_MAX)
        : null;
    // Sector prohibido: no empujar apelación
    if (weight) appeal = null;
    return { plan, adText, appeal };
  } catch (error) {
    console.warn(
      "[reject-fix-hint] failed",
      error instanceof Error ? error.message : "unknown",
    );
    return fallbackRecommendation({
      kind,
      adName: input.adName,
      accountName: input.accountName,
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
    if (/Conocé Video\s*\d+/i.test(raw)) return true;
    // Formato viejo plano (sin JSON) + motivos reales → regenerar con IA rica.
    const body = raw.slice(REJECT_REC_PREFIX.length).trim();
    if (body.startsWith("{")) {
      try {
        const parsed = JSON.parse(body) as { adText?: string; plan?: string };
        if (
          /Video\s*\d+/i.test(
            `${parsed.adText ?? ""} ${parsed.plan ?? ""}`,
          )
        ) {
          return true;
        }
      } catch {
        /* ignore */
      }
    }
    if (!body.startsWith("{") && d.tiktokRejectReasons.length > 0) {
      if (
        /no dejó el motivo|Exportá Video|modifica el producto|Conocé Video/i.test(
          body,
        ) ||
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
