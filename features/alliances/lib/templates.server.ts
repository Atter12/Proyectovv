import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ContractTemplate } from "@/features/alliances/lib/templates";
import type { ContractType } from "@/features/alliances/lib/domain";

export type TemplateLoadResult =
  | { ok: true; data: ContractTemplate[] }
  | { ok: false; error: "missing_table" | "unknown" };

function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const message = (error.message ?? "").toLowerCase();
  return error.code === "42P01" || error.code === "PGRST205" || message.includes("alliance_contract_templates");
}

interface TemplateRow {
  id: string;
  slug: string;
  name: string;
  contract_type: ContractType;
  description: string | null;
  body: string;
  is_active: boolean;
}

export async function listContractTemplates(): Promise<TemplateLoadResult> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("alliance_contract_templates")
      .select("id, slug, name, contract_type, description, body, is_active")
      .order("name", { ascending: true });
    if (error) return { ok: false, error: isMissingTable(error) ? "missing_table" : "unknown" };
    const rows = (data ?? []) as TemplateRow[];
    return {
      ok: true,
      data: rows.map((row) => ({
        id: row.id,
        slug: row.slug,
        name: row.name,
        contractType: row.contract_type,
        description: row.description ?? "",
        body: row.body.trim(),
        active: row.is_active,
      })),
    };
  } catch {
    return { ok: false, error: "unknown" };
  }
}
