import "server-only";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { createHecomAdminClient } from "@/lib/hecom/supabase.server";

export const HECOM_CLIENTE_COOKIE_ID = "vv_hecom_cliente_id";
export const HECOM_CLIENTE_COOKIE_NAME = "vv_hecom_cliente_name";
export const HECOM_CLIENTE_COOKIE_OWNER = "vv_hecom_cliente_owner";
export const HECOM_ACT_AS_CLIENTE_COOKIE = "vv_hecom_act_as_cliente";

const COOKIE_MAX_AGE = 60 * 60 * 24 * 400;

export type SelectedHecomCliente = {
  id: string;
  name: string;
};

/**
 * Cliente activo en el panel.
 * Scope por usuario: al cambiar de cuenta (cliente ↔ gerente) no se reutiliza
 * la selección del otro.
 *
 * La cookie solo se fija al hacer login. Si se pierde (otro navegador, cookies
 * borradas) y la sesión sigue viva, el cliente quedaba con el panel vacío: en
 * ese caso se usa su única ficha vinculada (hecom_cliente_user_links).
 * Gerentes no tienen fichas vinculadas: siguen eligiendo del CRM.
 */
export async function getSelectedHecomCliente(
  userId?: string | null,
): Promise<SelectedHecomCliente | null> {
  const store = await cookies();
  const id = store.get(HECOM_CLIENTE_COOKIE_ID)?.value?.trim() ?? "";
  const owner = store.get(HECOM_CLIENTE_COOKIE_OWNER)?.value?.trim() ?? "";
  if (!id || (userId && owner && owner !== userId)) {
    return userId ? resolveOnlyLinkedCliente(userId) : null;
  }

  const name =
    store.get(HECOM_CLIENTE_COOKIE_NAME)?.value?.trim() || "Cliente Hecom";
  return { id, name };
}

export async function setSelectedHecomCliente(input: {
  id: string;
  name: string;
  userId?: string | null;
}): Promise<void> {
  const store = await cookies();
  const id = input.id.trim();
  const name = input.name.trim() || "Cliente Hecom";
  if (!id) return;

  const common = {
    path: "/",
    maxAge: COOKIE_MAX_AGE,
    sameSite: "lax" as const,
    httpOnly: true,
  };

  store.set(HECOM_CLIENTE_COOKIE_ID, id, common);
  store.set(HECOM_CLIENTE_COOKIE_NAME, name.slice(0, 120), common);
  if (input.userId) {
    store.set(HECOM_CLIENTE_COOKIE_OWNER, input.userId, common);
  }
}

export async function getActingAsCliente(
  userId?: string | null,
): Promise<boolean> {
  const store = await cookies();
  const flag = store.get(HECOM_ACT_AS_CLIENTE_COOKIE)?.value?.trim();
  if (flag !== "1") return false;
  const owner = store.get(HECOM_CLIENTE_COOKIE_OWNER)?.value?.trim() ?? "";
  if (userId && owner && owner !== userId) return false;
  const id = store.get(HECOM_CLIENTE_COOKIE_ID)?.value?.trim() ?? "";
  return Boolean(id);
}

export async function setActingAsCliente(enabled: boolean): Promise<void> {
  const store = await cookies();
  const common = {
    path: "/",
    maxAge: COOKIE_MAX_AGE,
    sameSite: "lax" as const,
    httpOnly: true,
  };
  if (enabled) {
    store.set(HECOM_ACT_AS_CLIENTE_COOKIE, "1", common);
    return;
  }
  store.delete(HECOM_ACT_AS_CLIENTE_COOKIE);
}

export async function clearSelectedHecomCliente(): Promise<void> {
  const store = await cookies();
  store.delete(HECOM_CLIENTE_COOKIE_ID);
  store.delete(HECOM_CLIENTE_COOKIE_NAME);
  store.delete(HECOM_CLIENTE_COOKIE_OWNER);
  store.delete(HECOM_ACT_AS_CLIENTE_COOKIE);
}

/** Única ficha Hecom vinculada al usuario (cliente con login). null si tiene 0 o varias. */
async function resolveOnlyLinkedCliente(userId: string): Promise<SelectedHecomCliente | null> {
  try {
    const { data } = await createAdminClient()
      .from("hecom_cliente_user_links")
      .select("hecom_cliente_id")
      .eq("user_id", userId)
      .limit(2);
    const ids = [...new Set((data ?? []).map((r) => String(r.hecom_cliente_id ?? "")).filter(Boolean))];
    if (ids.length !== 1) return null;
    const { data: cliente } = await createHecomAdminClient()
      .from("clientes")
      .select("name")
      .eq("id", ids[0]!)
      .maybeSingle<{ name: string | null }>();
    return { id: ids[0]!, name: String(cliente?.name ?? "").trim() || "Cliente Hecom" };
  } catch (error) {
    console.warn("[selected-cliente] linked_fallback_failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
