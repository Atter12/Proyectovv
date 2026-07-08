"use server";

import { redirect } from "next/navigation";
import { routes } from "@/config/routes";
import { createClient } from "@/lib/supabase/server";

export async function signOutAdminAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect(routes.adminLogin);
}
