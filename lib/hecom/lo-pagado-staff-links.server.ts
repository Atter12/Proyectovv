import "server-only";

import { serverEnv } from "@/lib/env/env.server";
import { loPagadoPublicUrl } from "@/lib/hecom/lo-pagado-public-token";
import { createHecomAdminClient } from "@/lib/hecom/supabase.server";

export type DebtLinkClient = {
  id: string;
  name: string;
  url: string;
};

export async function listDebtLinkClients(): Promise<{
  ready: boolean;
  clients: DebtLinkClient[];
}> {
  const secret = serverEnv.holisticWaSnapshotSecret;
  if (!secret) return { ready: false, clients: [] };

  const hecom = createHecomAdminClient();
  const { data, error } = await hecom
    .from("clientes")
    .select("id,name")
    .order("name", { ascending: true })
    .limit(1000);

  if (error) throw new Error(error.message);

  const clients = (data ?? [])
    .map((row) => {
      const id = String(row.id ?? "").trim();
      const name = String(row.name ?? "").trim();
      if (!id || !name) return null;
      return { id, name, url: loPagadoPublicUrl(id, secret) };
    })
    .filter((row): row is DebtLinkClient => row !== null);

  return { ready: true, clients };
}
