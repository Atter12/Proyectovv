import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { userIsAllowedAdmin } from "@/lib/admin/allowlist";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ allowed: false, authenticated: false }, { status: 401 });
  }

  const allowed = userIsAllowedAdmin({ id: user.id, email: user.email });

  if (!allowed) {
    return NextResponse.json({ allowed: false, authenticated: true }, { status: 403 });
  }

  return NextResponse.json({ allowed: true, authenticated: true });
}
