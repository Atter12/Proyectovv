import { createAdminClient } from "@/lib/supabase/admin";

/** Admin client — misma Postgres que Real Profit (`rp_*`). */
export function getRealProfitAdmin() {
  return createAdminClient();
}

export function defaultProfitDateRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - 29);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}
