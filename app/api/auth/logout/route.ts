import { NextResponse } from "next/server";
import { routes } from "@/config/routes";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  await supabase.auth.signOut();

  return NextResponse.json({
    ok: true,
    redirectTo: routes.login,
  });
}
