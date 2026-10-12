import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isRadarCategory,
  isRadarObjective,
  normalizeAppearance,
  type RadarAppearance,
  type RadarCategory,
  type RadarObjective,
} from "@/lib/radar/categories";
import { normalizeTags, type VideoTags } from "@/lib/radar/tags";
import type { Taste } from "@/lib/radar/taste";

export type RadarStep = "pending" | "categories" | "round1" | "round2" | "done" | "skipped";

export type RadarSeed = {
  categoryName: RadarCategory | null;
  products: string[];
  objective: RadarObjective | null;
  currentStyle: VideoTags;
  summary: string;
  sources: string[];
  generatedAt: string;
};

export type RadarProfile = {
  hecomClienteId: string;
  categoryName: RadarCategory | null;
  products: string[];
  objective: RadarObjective | null;
  canAppear: RadarAppearance[];
  taste: Taste;
  seed: RadarSeed | null;
  onboardingStep: RadarStep;
  consentRadar: boolean;
  updatedAt: string | null;
};

const STEPS: RadarStep[] = ["pending", "categories", "round1", "round2", "done", "skipped"];

function toStringList(raw: unknown, max = 12): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    const value = typeof item === "string" ? item : (item as { name?: unknown })?.name;
    const text = String(value ?? "").trim().slice(0, 80);
    if (text && !out.includes(text)) out.push(text);
    if (out.length >= max) break;
  }
  return out;
}

/**
 * Productos: "teclados, mouse, monitores" escrito en una sola línea son tres
 * productos (la receta y la búsqueda trabajan uno por uno).
 */
function toProductList(raw: unknown, max = 12): string[] {
  if (!Array.isArray(raw)) return [];
  const split = raw.flatMap((item) => {
    const value = typeof item === "string" ? item : (item as { name?: unknown })?.name;
    return String(value ?? "").split(/[,;]/);
  });
  return toStringList(split, max);
}

export function parseSeed(raw: unknown): RadarSeed | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (!r.generatedAt) return null;
  return {
    categoryName: isRadarCategory(r.categoryName) ? r.categoryName : null,
    products: toProductList(r.products),
    objective: isRadarObjective(r.objective) ? r.objective : null,
    currentStyle: normalizeTags(r.currentStyle),
    summary: String(r.summary ?? "").slice(0, 400),
    sources: toStringList(r.sources, 10),
    generatedAt: String(r.generatedAt),
  };
}

function mapRow(row: Record<string, unknown>): RadarProfile {
  const canAppear = (row.can_appear as { who?: unknown } | null)?.who;
  const step = String(row.onboarding_step ?? "pending") as RadarStep;
  return {
    hecomClienteId: String(row.hecom_cliente_id),
    categoryName: isRadarCategory(row.category_name) ? row.category_name : null,
    products: toProductList(row.products),
    objective: isRadarObjective(row.objective) ? row.objective : null,
    canAppear: normalizeAppearance(canAppear),
    taste: (row.taste && typeof row.taste === "object" ? row.taste : {}) as Taste,
    seed: parseSeed(row.seed),
    onboardingStep: STEPS.includes(step) ? step : "pending",
    consentRadar: Boolean(row.consent_radar),
    updatedAt: row.updated_at ? String(row.updated_at) : null,
  };
}

export async function getRadarProfile(hecomClienteId: string): Promise<RadarProfile | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("radar_client_profiles")
    .select("*")
    .eq("hecom_cliente_id", hecomClienteId)
    .maybeSingle();
  if (error) throw new Error(`radar_client_profiles: ${error.message}`);
  return data ? mapRow(data as Record<string, unknown>) : null;
}

export async function saveRadarProfile(
  hecomClienteId: string,
  patch: Partial<{
    categoryName: RadarCategory | null;
    products: string[];
    objective: RadarObjective | null;
    canAppear: RadarAppearance[];
    taste: Taste;
    seed: RadarSeed;
    onboardingStep: RadarStep;
    consentRadar: boolean;
  }>,
): Promise<RadarProfile> {
  const row: Record<string, unknown> = {
    hecom_cliente_id: hecomClienteId,
    updated_at: new Date().toISOString(),
  };
  if (patch.categoryName !== undefined) row.category_name = patch.categoryName;
  if (patch.products !== undefined) row.products = toProductList(patch.products);
  if (patch.objective !== undefined) row.objective = patch.objective;
  if (patch.canAppear !== undefined) row.can_appear = { who: normalizeAppearance(patch.canAppear) };
  if (patch.taste !== undefined) row.taste = patch.taste;
  if (patch.seed !== undefined) row.seed = patch.seed;
  if (patch.onboardingStep !== undefined) row.onboarding_step = patch.onboardingStep;
  if (patch.consentRadar !== undefined) {
    row.consent_radar = patch.consentRadar;
    row.consented_at = patch.consentRadar ? new Date().toISOString() : null;
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("radar_client_profiles")
    .upsert(row, { onConflict: "hecom_cliente_id" })
    .select("*")
    .single();
  if (error) throw new Error(`radar_client_profiles: ${error.message}`);
  return mapRow(data as Record<string, unknown>);
}
