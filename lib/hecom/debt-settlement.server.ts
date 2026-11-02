import "server-only";
import { cache } from "react";
import { createHecomAdminClient } from "@/lib/hecom/supabase.server";
import { calculateMonthlyDebtSettlement } from "@/lib/hecom/debt-settlement";

/** Call only after the selected-client or signed public-link access check. */
export const getHecomMonthlyDebtSettlement = cache(async (clientId: string) => {
  try {
    if (!/^[0-9a-f-]{36}$/i.test(clientId)) return null;
    const db = createHecomAdminClient();
    async function all(table: string, fields: string, legacy = false) {
      const rows: Record<string, unknown>[] = [];
      let expected: number | null = null;
      for (let offset = 0; offset < 100000; offset += 500) {
        let query = db.from(table).select(fields, { count: "exact" });
        query = legacy
          ? query.is("client_id", null).eq("gastos.client_id", clientId)
          : query.eq("client_id", clientId);
        const { data, error, count } = await query.order("id").range(offset, offset + 499);
        if (error || count == null || !data) throw new Error("Incomplete settlement query");
        if (expected != null && expected !== count) throw new Error("Settlement changed during pagination");
        expected = count;
        rows.push(...(data as unknown as Record<string, unknown>[]));
        if (rows.length === expected) return rows;
        if (data.length !== 500 || rows.length > expected) throw new Error("Incomplete settlement page");
      }
      throw new Error("Settlement pagination limit reached");
    }
    const [gastos, direct, legacy, garantias] = await Promise.all([
      all("gastos", "id,client_id,gasto,fee,mes,fecha_movimiento"),
      all("cobros", "id,client_id,gasto_id,monto,fecha,periodo_resumen,codigo,funding_breakdown"),
      all("cobros", "id,client_id,gasto_id,monto,fecha,periodo_resumen,codigo,funding_breakdown,gastos!inner(client_id)", true),
      all("garantias", "id,client_id,gasto_id,valor,estado,periodo_resumen,fecha_colocacion"),
    ]);
    const cobros = [...new Map([...direct, ...legacy].map(row => [String(row.id), row])).values()];
    return calculateMonthlyDebtSettlement(clientId, gastos, cobros, garantias);
  } catch {
    // Never substitute a month's cash subtraction for an unavailable debt calculation.
    console.warn("[hecom] Complete settlement unavailable; debt must not be quoted.");
    return null;
  }
});
