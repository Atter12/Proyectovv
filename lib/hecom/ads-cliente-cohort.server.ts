import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/** Operational membership, not proof of a credit contract or an unpaid balance. */
export async function listAdsHolisticClienteIds(): Promise<Set<string>> {
  const admin = createAdminClient();
  const ids = new Set<string>();
  for (const table of ["hecom_cliente_user_links", "payment_intents"] as const) {
    let total: number | null = null;
    for (let offset = 0; total === null || offset < total; offset += 500) {
      let query = admin.from(table).select(table === "payment_intents"
        ? "id,hecom_cliente_id:metadata->>hecom_cliente_id" : "user_id,hecom_cliente_id", {count:"exact"});
      if (table === "payment_intents") query = query.eq("status", "succeeded").order("id");
      else query = query.order("hecom_cliente_id").order("user_id");
      const {data,error,count} = await query.range(offset, offset + 499);
      if (error || count === null || !Array.isArray(data)) throw new Error("No se pudo comprobar el catálogo de AdsHolistic.");
      if (total !== null && total !== count) throw new Error("El catálogo cambió durante la consulta. Vuelve a intentar.");
      total = count;
      if (data.length !== Math.min(500, Math.max(0,total-offset))) throw new Error("La consulta de clientes de AdsHolistic está incompleta.");
      for (const row of data as unknown as {hecom_cliente_id:unknown}[]) {
        const id=String(row.hecom_cliente_id ?? "").trim();
        if(id) ids.add(id);
      }
    }
  }
  return ids;
}
