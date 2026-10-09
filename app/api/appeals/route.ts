import { NextResponse } from "next/server";
import { requirePermission } from "@/lib/auth/guards.server";
import { getSelectedHecomCliente } from "@/lib/hecom/selected-cliente.server";
import {
  createAppeal,
  getAppealPrefill,
  listAppealsForCliente,
} from "@/lib/appeals/account-appeals.server";

export const runtime = "nodejs";

/**
 * GET              → apelaciones del cliente (última por cuenta).
 * GET ?adAccountId → datos para abrir el formulario (motivo TikTok + datos del cliente).
 * POST multipart   → crea la apelación con documentos.
 */
export async function GET(request: Request) {
  const session = await requirePermission("payments:read");
  const selected = await getSelectedHecomCliente(session.id);
  if (!selected) {
    return NextResponse.json({ error: "Selecciona un cliente primero." }, { status: 400 });
  }
  const adAccountId = new URL(request.url).searchParams.get("adAccountId")?.trim();
  try {
    if (adAccountId) {
      const prefill = await getAppealPrefill({ hecomClienteId: selected.id, adAccountId });
      return NextResponse.json({ ok: true, prefill });
    }
    const appeals = await listAppealsForCliente(selected.id);
    return NextResponse.json({
      ok: true,
      appeals: appeals.map((a) => ({
        id: a.id,
        advertiserId: a.advertiserId,
        status: a.status,
        createdAt: a.createdAt,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo cargar.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(request: Request) {
  const session = await requirePermission("payments:read");
  const selected = await getSelectedHecomCliente(session.id);
  if (!selected) {
    return NextResponse.json({ error: "Selecciona un cliente primero." }, { status: 400 });
  }
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Formulario inválido." }, { status: 400 });
  }
  const text = (key: string) => String(form.get(key) ?? "").slice(0, 4000);
  const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  try {
    const appeal = await createAppeal({
      hecomClienteId: selected.id,
      hecomClienteName: selected.name ?? null,
      adAccountId: text("adAccountId").trim(),
      userId: session.id,
      companyName: text("companyName"),
      taxId: text("taxId"),
      storeUrl: text("storeUrl"),
      products: text("products"),
      contactEmail: text("contactEmail"),
      contactPhone: text("contactPhone"),
      notes: text("notes"),
      appealMessage: text("appealMessage"),
      files,
    });
    return NextResponse.json({ ok: true, appeal: { id: appeal.id, advertiserId: appeal.advertiserId, status: appeal.status } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo enviar la apelación.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
