import { NextResponse } from "next/server";
import { routes } from "@/config/routes";
import { createClient } from "@/lib/supabase/server";
import { clearSelectedHecomCliente } from "@/lib/hecom/selected-cliente.server";
import { getSession } from "@/lib/auth/session.server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST() {
  const session = await getSession();
  const supabase = await createClient();
  await supabase.auth.signOut();
  try {
    await clearSelectedHecomCliente();
  } catch {
    // cookie clear best-effort
  }
  if (session?.id) {
    try {
      await createAdminClient()
        .from("web_push_subscriptions")
        .delete()
        .eq("user_id", session.id);
    } catch {
      // la suscripción se limpia en el próximo envío si ya no existe
    }
  }

  return NextResponse.json({
    ok: true,
    redirectTo: routes.login,
  });
}
