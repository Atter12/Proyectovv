import { NextResponse } from "next/server";
import { routes } from "@/config/routes";
import { createClient } from "@/lib/supabase/server";
import { clearSelectedHecomCliente } from "@/lib/hecom/selected-cliente.server";

export async function POST() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  try {
    await clearSelectedHecomCliente();
  } catch {
    // cookie clear best-effort
  }

  return NextResponse.json({
    ok: true,
    redirectTo: routes.login,
  });
}
