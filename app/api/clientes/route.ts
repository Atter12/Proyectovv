import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session.server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { serverEnv } from "@/lib/env/env.server";

export const dynamic = "force-dynamic";

/**
 * Debug + data for /clientes.
 * Returns JSON so the browser can console.log the real error.
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

    const hasServiceRole = Boolean(serverEnv.supabaseServiceRoleKey);
    const hasUrl = Boolean(serverEnv.supabaseUrl);
    steps.push({
      step: "env",
      ok: hasUrl && hasServiceRole,
      detail: `url=${hasUrl} serviceRole=${hasServiceRole}`,
    });

    type ClientRow = {
      id: string;
      name: string;
      slug: string;
      status: string;
      contactName: string | null;
      contactEmail: string | null;
      walletBalanceCents: number;
      walletCurrency: string;
      adAccountCount: number;
      activeMemberCount: number;
    };

    let clients: ClientRow[] = [];
    let source: "service_role" | "user_rls" = "user_rls";

    if (hasUrl && hasServiceRole) {
      try {
        const admin = createAdminClient();
        const { data: orgs, error: orgError } = await admin
          .from("organizations")
          .select("id, name, slug, status, created_at")
          .order("created_at", { ascending: false })
          .limit(120);

        if (orgError) {
          steps.push({
            step: "organizations_admin",
            ok: false,
            detail: orgError.message,
          });
        } else {
          steps.push({
            step: "organizations_admin",
            ok: true,
            detail: `${orgs?.length ?? 0} orgs`,
          });
          source = "service_role";
          const orgIds = (orgs ?? []).map((o) => o.id);

          let wallets: Array<{
            organization_id: string;
            balance_cents: number;
            currency: string;
          }> = [];
          let adAccounts: Array<{ organization_id: string }> = [];
          let memberships: Array<{
            organization_id: string;
            user_id: string;
            status: string;
            role: string;
          }> = [];
          let profiles: Array<{ id: string; email: string; full_name: string | null }> =
            [];

          if (orgIds.length > 0) {
            const [wRes, aRes, mRes] = await Promise.all([
              admin
                .from("wallets")
                .select("organization_id, balance_cents, currency")
                .in("organization_id", orgIds),
              admin
                .from("ad_accounts")
                .select("organization_id")
                .in("organization_id", orgIds),
              admin
                .from("organization_memberships")
                .select("organization_id, user_id, status, role")
                .in("organization_id", orgIds)
                .eq("status", "active"),
            ]);

            if (wRes.error) {
              steps.push({ step: "wallets", ok: false, detail: wRes.error.message });
            } else {
              wallets = (wRes.data ?? []) as typeof wallets;
              steps.push({ step: "wallets", ok: true, detail: `${wallets.length}` });
            }

            if (aRes.error) {
              steps.push({
                step: "ad_accounts",
                ok: false,
                detail: aRes.error.message,
              });
            } else {
              adAccounts = (aRes.data ?? []) as typeof adAccounts;
              steps.push({
                step: "ad_accounts",
                ok: true,
                detail: `${adAccounts.length}`,
              });
            }

            if (mRes.error) {
              steps.push({
                step: "memberships",
                ok: false,
                detail: mRes.error.message,
              });
            } else {
              memberships = (mRes.data ?? []) as typeof memberships;
              steps.push({
                step: "memberships",
                ok: true,
                detail: `${memberships.length}`,
              });
              const userIds = [...new Set(memberships.map((m) => m.user_id))];
              if (userIds.length > 0) {
                const pRes = await admin
                  .from("profiles")
                  .select("id, email, full_name")
                  .in("id", userIds);
                if (pRes.error) {
                  steps.push({
                    step: "profiles",
                    ok: false,
                    detail: pRes.error.message,
                  });
                } else {
                  profiles = (pRes.data ?? []) as typeof profiles;
                  steps.push({
                    step: "profiles",
                    ok: true,
                    detail: `${profiles.length}`,
                  });
                }
              }
            }
          }

          const profileById = new Map(profiles.map((p) => [p.id, p]));

          clients = (orgs ?? []).map((org) => {
            const wallet = wallets.find((w) => w.organization_id === org.id);
            const orgMembers = memberships
              .filter((m) => m.organization_id === org.id)
              .sort((a, b) => {
                const score = (role: string) =>
                  role === "owner" ? 0 : role === "admin" ? 1 : 2;
                return score(a.role) - score(b.role);
              });
            const primary = orgMembers[0]
              ? profileById.get(orgMembers[0].user_id)
              : null;

            return {
              id: org.id,
              name: org.name,
              slug: org.slug,
              status: org.status,
              contactName: primary?.full_name ?? null,
              contactEmail: primary?.email ?? null,
              walletBalanceCents: Number(wallet?.balance_cents ?? 0),
              walletCurrency: wallet?.currency ?? "USD",
              adAccountCount: adAccounts.filter((a) => a.organization_id === org.id)
                .length,
              activeMemberCount: orgMembers.length,
            };
          });
        }
      } catch (adminErr) {
        steps.push({
          step: "admin_client",
          ok: false,
          detail:
            adminErr instanceof Error ? adminErr.message : "Error createAdminClient",
        });
      }
    }

    if (clients.length === 0) {
      const supabase = await createClient();
      const { data: orgs, error } = await supabase
        .from("organizations")
        .select("id, name, slug, status, created_at")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        steps.push({ step: "organizations_rls", ok: false, detail: error.message });
        return NextResponse.json(
          {
            ok: false,
            error: error.message,
            steps,
            hint: "Falta SUPABASE_SERVICE_ROLE_KEY o RLS bloquea organizations.",
          },
          { status: 500 },
        );
      }

      steps.push({
        step: "organizations_rls",
        ok: true,
        detail: `${orgs?.length ?? 0} orgs (RLS)`,
      });
      source = "user_rls";
      clients = (orgs ?? []).map((org) => ({
        id: org.id,
        name: org.name,
        slug: org.slug,
        status: org.status,
        contactName: session.name || null,
        contactEmail: session.email || null,
        walletBalanceCents: 0,
        walletCurrency: "USD",
        adAccountCount: 0,
        activeMemberCount: 1,
      }));
    }

    return NextResponse.json({
      ok: true,
      source,
      count: clients.length,
      clients,
      steps,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido";
    steps.push({ step: "fatal", ok: false, detail: message });
    console.error("[api/clientes]", message, error);
    return NextResponse.json({ ok: false, error: message, steps }, { status: 500 });
  }
}
