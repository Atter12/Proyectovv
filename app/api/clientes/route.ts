import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session.server";
import { getHecomSupabaseConfig } from "@/lib/hecom/supabase.server";
import { listHecomClientes } from "@/lib/hecom/clientes.server";

export const dynamic = "force-dynamic";

/**
 * Lista clientes del CRM Hecom Club (`public.clientes`), no organizations de Ecomdy.
 */
export async function GET() {
  const steps: Array<{ step: string; ok: boolean; detail?: string }> = [];

  try {
    const session = await getSession();
    if (!session) {
      steps.push({ step: "session", ok: false, detail: "No autenticado" });
      return NextResponse.json(
        { ok: false, error: "No autenticado", steps },
        { status: 401 },
      );
    }
    steps.push({
      step: "session",
      ok: true,
      detail: `${session.email} / org=${session.organizationId}`,
    });

    const hecomCfg = getHecomSupabaseConfig();
    steps.push({
      step: "hecom_env",
      ok: hecomCfg.configured,
      detail: `url=${hecomCfg.url} serviceRole=${Boolean(hecomCfg.serviceRoleKey)}`,
    });

    const { source, clientes, backupPath } = await listHecomClientes();
    steps.push({
      step: hecomCfg.configured ? "hecom_clientes_live" : "hecom_clientes_backup",
      ok: true,
      detail: hecomCfg.configured
        ? `${clientes.length} filas en public.clientes`
        : `${clientes.length} filas desde backup${backupPath ? ` (${backupPath})` : ""}`,
    });
    if (!hecomCfg.configured) {
      steps.push({
        step: "hecom_env_hint",
        ok: false,
        detail:
          "Sin HECOM_SUPABASE_SERVICE_ROLE_KEY: usando backup local. Para live, agregá la service role de Hecom en Vercel.",
      });
    }

    const clients = clientes.map((c) => {
      const primaryEmail = c.emails[0] ?? null;
      const tiktokCount =
        c.tiktokAccounts.length ||
        (c.tiktokAdvertiserId ? 1 : 0);

      return {
        id: c.id,
        name: c.name,
        slug: c.dni || c.id.slice(0, 8),
        status: "active",
        contactName: c.name,
        contactEmail: primaryEmail,
        biz: c.biz,
        phones: c.phones,
        avatarUrl: c.avatarUrl,
        walletBalanceCents: 0,
        walletCurrency: "USD",
        adAccountCount: tiktokCount,
        activeMemberCount: c.emails.length || 1,
        tiktokAdvertiserId: c.tiktokAdvertiserId,
        tiktokAccounts: c.tiktokAccounts,
      };
    });

    return NextResponse.json({
      ok: true,
      source,
      count: clients.length,
      clients,
      steps,
      note:
        "Fuente: Hecom Club CRM. Gastos TikTok usan TIKTOK_ACCESS_TOKEN de agencia + advertiser_id por cliente.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    steps.push({ step: "fatal", ok: false, detail: message });
    console.error("[api/clientes]", message, error);
    return NextResponse.json(
      {
        ok: false,
        error: message,
        hint:
          "Verificá que HECOM_SUPABASE_SERVICE_ROLE_KEY sea del proyecto Hecom (tabla public.clientes).",
        steps,
      },
      { status: 500 },
    );
  }
}
