import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env/env.server";
import type { CreativeDraftListItem } from "@/lib/creatives/types";

const HINT_MAX = 180;

/** Solo estos casos no se “arreglan”. El resto (incluido ecom gris) sí. */
const HARD_STOP =
  /\b(arma de fuego|firearms?|explosiv|bomba|coca[ií]na|hero[ií]na|fentanilo|metanfetamina|pornograf[ií]a infantil|contenido sexual de menores|child sexual)\b/i;

function clip(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= HINT_MAX) return clean;
  return `${clean.slice(0, HINT_MAX - 1).trim()}…`;
}

export async function suggestRejectFixHint(input: {
  adName: string;
  reasons: string[];
}): Promise<string | null> {
  const blob = [input.adName, ...input.reasons].join(" \n ");
  if (HARD_STOP.test(blob)) {
    return "Este caso no se corrige desde Creativos. Habla con tu gestor.";
  }

  const apiKey = serverEnv.openAiApiKey?.trim();
  if (!apiKey) return null;

  const prompt = `Sos coach de TikTok Ads para una agencia de ecom en Latam.
El cliente quiere que ESTE anuncio pase la revisión. Tu trabajo es ayudarlo, no juzgar el producto.
Productos grises, suplementos, claims agresivos o “black” de ecom: igual das el arreglo concreto.
No sermonees. No digas "no vendas esto". No te niegues.
Límite: no ayudes con armas, drogas ilícitas ni contenido sexual de menores (eso no viene en este brief).

Video: ${input.adName || "sin nombre"}
Motivo de TikTok: ${input.reasons.filter(Boolean).join(" | ") || "sin motivo detallado"}

Devuelve SOLO JSON:
{ "fix": "una frase en español, máximo 160 caracteres, qué cambiar en el video o el texto para que TikTok lo acepte" }`;

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
      return null;
    }
    const raw = data.choices?.[0]?.message?.content ?? "";
    const parsed = JSON.parse(raw) as { fix?: unknown };
    const fix = typeof parsed.fix === "string" ? clip(parsed.fix) : "";
    return fix.length >= 8 ? fix : null;
  } catch (error) {
    console.warn(
      "[reject-fix-hint] failed",
      error instanceof Error ? error.message : "unknown",
    );
    return null;
  }
}

/** Si el archivo nuevo caería por el mismo motivo, una frase. Si no, null. */
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

Si el video nuevo sigue teniendo EL MISMO problema (mismo claim, mismo antes/después, mismo archivo inválido, misma página), devolvé:
{ "same": true, "warning": "una frase en español, máximo 140 caracteres, qué sigue mal" }
Si cambió lo suficiente para intentar de nuevo, devolvé { "same": false, "warning": "" }.
No juzgues el producto. Solo decí si va a caer por lo mismo.`;

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

/** Rellena reject_fix_hint solo en filas que aún no lo tienen. */
export async function fillMissingRejectFixHints(
  drafts: CreativeDraftListItem[],
): Promise<number> {
  const pending = drafts.filter(
    (d) =>
      d.status === "published" &&
      d.tiktokReviewStatus === "rejected" &&
      !d.rejectFixHint,
  );
  if (pending.length === 0) return 0;

  const admin = createAdminClient();
  const results = await Promise.all(
    pending.slice(0, 8).map(async (draft) => {
      const name =
        draft.brief.adName || draft.brief.campaignName || draft.assetName || "";
      const fix = await suggestRejectFixHint({
        adName: name,
        reasons: draft.tiktokRejectReasons,
      });
      if (!fix) return false;
      const { error } = await admin
        .from("creative_publish_drafts")
        .update({ reject_fix_hint: fix })
        .eq("id", draft.id);
      if (error) {
        console.warn("[reject-fix-hint] save", error.message);
        return false;
      }
      return true;
    }),
  );
  return results.filter(Boolean).length;
}
